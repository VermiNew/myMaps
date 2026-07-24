import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { loadEnvFile } from 'node:process';

const [directory = 'public', rawPort = '4173'] = process.argv.slice(2);
const root = join(process.cwd(), directory);
const port = Number(rawPort);
try {
  loadEnvFile(join(process.cwd(), '.env.local'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const openRouteServiceApiKey = process.env.OPENROUTESERVICE_API_KEY;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
}

async function handleGeocoding(requestUrl, response) {
  const text = requestUrl.searchParams.get('text')?.trim();
  if (!text || text.length < 3) {
    sendJson(response, 400, { error: 'Wpisz co najmniej 3 znaki.' });
    return;
  }
  if (!openRouteServiceApiKey) {
    sendJson(response, 503, { error: 'Wyszukiwanie nie zostało skonfigurowane.' });
    return;
  }

  const upstreamUrl = new URL('https://api.openrouteservice.org/geocode/search');
  upstreamUrl.searchParams.set('text', text);
  upstreamUrl.searchParams.set('size', '6');
  upstreamUrl.searchParams.set('boundary.country', 'PL');
  upstreamUrl.searchParams.set('lang', 'pl');

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Authorization: openRouteServiceApiKey,
        'User-Agent': 'MojaMapa/1.0'
      }
    });
    const payload = await upstreamResponse.json();
    if (!upstreamResponse.ok) {
      sendJson(response, upstreamResponse.status, {
        error: 'Usługa wyszukiwania jest chwilowo niedostępna.'
      });
      return;
    }
    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: 'Nie udało się połączyć z wyszukiwarką miejsc.' });
  }
}

function readCoordinates(value) {
  const coordinates = value?.split(',').map(Number);
  return coordinates?.length === 2 && coordinates.every(Number.isFinite) ? coordinates : null;
}

async function handleRouting(requestUrl, response) {
  const start = readCoordinates(requestUrl.searchParams.get('start'));
  const end = readCoordinates(requestUrl.searchParams.get('end'));
  if (!start || !end) {
    sendJson(response, 400, { error: 'Nieprawidłowe współrzędne trasy.' });
    return;
  }
  if (!openRouteServiceApiKey) {
    sendJson(response, 503, { error: 'Wyznaczanie tras nie zostało skonfigurowane.' });
    return;
  }

  try {
    const upstreamResponse = await fetch(
      'https://api.openrouteservice.org/v2/directions/driving-car/geojson',
      {
        method: 'POST',
        headers: {
          Authorization: openRouteServiceApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'MojaMapa/1.0'
        },
        body: JSON.stringify({
          coordinates: [start, end],
          instructions: true,
          language: 'pl'
        })
      }
    );
    const payload = await upstreamResponse.json();
    if (!upstreamResponse.ok) {
      sendJson(response, upstreamResponse.status, {
        error: 'Nie udało się wyznaczyć tej trasy.'
      });
      return;
    }
    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: 'Nie udało się połączyć z usługą tras.' });
  }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === '/api/geocode') {
    await handleGeocoding(requestUrl, response);
    return;
  }
  if (pathname === '/api/route') {
    await handleRouting(requestUrl, response);
    return;
  }

  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

  try {
    const metadata = await stat(filePath);
    if (metadata.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nie znaleziono zasobu.');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${directory} at http://127.0.0.1:${port}`);
});
