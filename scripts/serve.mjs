import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { loadEnvFile } from 'node:process';

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const dir = args[0] || 'public';
const root = join(process.cwd(), dir);
const port = Number(portIndex !== -1 ? args[portIndex + 1] : (args[1] || '4173'));
try {
  loadEnvFile(join(process.cwd(), '.env.local'));
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

const openRouteServiceApiKey = process.env.OPENROUTESERVICE_API_KEY;
const routeProfiles = {
  car: 'driving-car',
  bicycle: 'cycling-regular',
  foot: 'foot-walking'
};
const allowedAvoidFeatures = {
  car: new Set(['tollways', 'highways', 'ferries']),
  bicycle: new Set(['ferries']),
  foot: new Set(['ferries'])
};
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
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

async function handleReverseGeocode(requestUrl, response) {
  const lat = requestUrl.searchParams.get('lat');
  const lng = requestUrl.searchParams.get('lng');
  if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    sendJson(response, 400, { error: 'Nieprawidłowe współrzędne.' });
    return;
  }
  if (!openRouteServiceApiKey) {
    sendJson(response, 503, { error: 'Geokodowanie nie zostało skonfigurowane.' });
    return;
  }

  const upstreamUrl = new URL('https://api.openrouteservice.org/geocode/reverse');
  upstreamUrl.searchParams.set('point.lat', lat);
  upstreamUrl.searchParams.set('point.lon', lng);
  upstreamUrl.searchParams.set('size', '1');
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
        error: 'Geokodowanie jest chwilowo niedostępne.'
      });
      return;
    }
    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: 'Nie udało się połączyć z usługą geokodowania.' });
  }
}

function readCoordinates(value) {
  const coordinates = value?.split(',').map(Number);
  return coordinates?.length === 2 && coordinates.every(Number.isFinite) ? coordinates : null;
}

async function handleRouting(requestUrl, response) {
  const start = readCoordinates(requestUrl.searchParams.get('start'));
  const end = readCoordinates(requestUrl.searchParams.get('end'));
  const rawWaypoints = requestUrl.searchParams.get('waypoints');
  const waypoints = rawWaypoints
    ? rawWaypoints.split('|').map((w) => readCoordinates(w)).filter(Boolean)
    : [];
  const mode = requestUrl.searchParams.get('mode') || 'car';
  const profile = routeProfiles[mode];
  const includeAlternatives = mode === 'car' && requestUrl.searchParams.get('alternatives') === 'true';
  const avoidFeatures = (requestUrl.searchParams.get('avoid') || '')
    .split(',')
    .filter((feature) => allowedAvoidFeatures[mode]?.has(feature));
  if (!start || !end) {
    sendJson(response, 400, { error: 'Nieprawidłowe współrzędne trasy.' });
    return;
  }
  if (!profile) {
    sendJson(response, 400, { error: 'Nieobsługiwany sposób podróży.' });
    return;
  }
  if (!openRouteServiceApiKey) {
    sendJson(response, 503, { error: 'Wyznaczanie tras nie zostało skonfigurowane.' });
    return;
  }

  const coordinates = [start, ...waypoints, end];

  try {
    const upstreamResponse = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: 'POST',
        headers: {
          Authorization: openRouteServiceApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'MojaMapa/1.0'
        },
        body: JSON.stringify({
          coordinates,
          instructions: true,
          language: 'pl',
          ...(avoidFeatures.length > 0 ? {
            options: { avoid_features: avoidFeatures }
          } : {}),
          ...(includeAlternatives ? {
            alternative_routes: {
              target_count: 3,
              weight_factor: 1.4,
              share_factor: 0.6
            }
          } : {})
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

async function handlePois(requestUrl, response) {
  const categoryId = requestUrl.searchParams.get('category');
  const bbox = requestUrl.searchParams.get('bbox');
  if (!categoryId || !bbox) {
    sendJson(response, 400, { error: 'Brak wymaganych parametrów: category, bbox.' });
    return;
  }
  if (!openRouteServiceApiKey) {
    sendJson(response, 503, { error: 'Wyszukiwanie POI nie zostało skonfigurowane.' });
    return;
  }

  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  if ([minLng, minLat, maxLng, maxLat].some((v) => !Number.isFinite(v))) {
    sendJson(response, 400, { error: 'Nieprawidłowe współrzędne bbox.' });
    return;
  }

  try {
    const upstreamResponse = await fetch('https://api.openrouteservice.org/v2/pois', {
      method: 'POST',
      headers: {
        Authorization: openRouteServiceApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'MojaMapa/1.0'
      },
      body: JSON.stringify({
        request: 'pois',
        geometry: {
          bbox: [[minLng, minLat], [maxLng, maxLat]]
        },
        filter_category_ids: [Number(categoryId)],
        sort_by: 'distance'
      })
    });
    const payload = await upstreamResponse.json();
    if (!upstreamResponse.ok) {
      sendJson(response, upstreamResponse.status, {
        error: 'Wyszukiwanie miejsc jest chwilowo niedostępne.'
      });
      return;
    }
    sendJson(response, 200, payload);
  } catch {
    sendJson(response, 502, { error: 'Nie udało się połączyć z usługą POI.' });
  }
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Nieprawidłowe kodowanie URL.');
    return;
  }
  if (pathname === '/api/geocode') {
    await handleGeocoding(requestUrl, response);
    return;
  }
  if (pathname === '/api/reverse-geocode') {
    await handleReverseGeocode(requestUrl, response);
    return;
  }
  if (pathname === '/api/route') {
    await handleRouting(requestUrl, response);
    return;
  }
  if (pathname === '/api/pois') {
    await handlePois(requestUrl, response);
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
  console.log(`Serving ${dir} at http://127.0.0.1:${port}`);
});
