const openRouteServiceApiKey = process.env.OPENROUTESERVICE_API_KEY;

const ROUTE_PROFILES = {
  car: 'driving-car',
  bicycle: 'cycling-regular',
  foot: 'foot-walking'
};

const ALLOWED_AVOID_FEATURES = {
  car: new Set(['tollways', 'highways', 'ferries']),
  bicycle: new Set(['ferries']),
  foot: new Set(['ferries'])
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function sendPlain(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function readCoordinates(value) {
  const coords = value?.split(',').map(Number);
  return coords?.length === 2 && coords.every(Number.isFinite) ? coords : null;
}

function apiKeyGuard(res) {
  if (!openRouteServiceApiKey) {
    sendJson(res, 503, { error: 'Usługa nie została skonfigurowana.' });
    return false;
  }
  return true;
}

async function handleGeocode(url, res) {
  if (!apiKeyGuard(res)) return;
  const text = url.searchParams.get('text')?.trim();
  if (!text || text.length < 3) {
    sendJson(res, 400, { error: 'Wpisz co najmniej 3 znaki.' });
    return;
  }
  try {
    const upstream = new URL('https://api.openrouteservice.org/geocode/search');
    upstream.searchParams.set('text', text);
    upstream.searchParams.set('size', '6');
    upstream.searchParams.set('boundary.country', 'PL');
    upstream.searchParams.set('lang', 'pl');
    const upstreamRes = await fetch(upstream, {
      headers: { Authorization: openRouteServiceApiKey, 'User-Agent': 'MojaMapa/1.0' }
    });
    const payload = await upstreamRes.json();
    sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status,
      upstreamRes.ok ? payload : { error: 'Wyszukiwanie jest chwilowo niedostępne.' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z wyszukiwarką miejsc.' });
  }
}

async function handleReverseGeocode(url, res) {
  if (!apiKeyGuard(res)) return;
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    sendJson(res, 400, { error: 'Nieprawidłowe współrzędne.' });
    return;
  }
  try {
    const upstream = new URL('https://api.openrouteservice.org/geocode/reverse');
    upstream.searchParams.set('point.lat', lat);
    upstream.searchParams.set('point.lon', lng);
    upstream.searchParams.set('size', '1');
    upstream.searchParams.set('lang', 'pl');
    const upstreamRes = await fetch(upstream, {
      headers: { Authorization: openRouteServiceApiKey, 'User-Agent': 'MojaMapa/1.0' }
    });
    const payload = await upstreamRes.json();
    sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status,
      upstreamRes.ok ? payload : { error: 'Geokodowanie jest chwilowo niedostępne.' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z usługą geokodowania.' });
  }
}

async function handleRoute(url, res) {
  if (!apiKeyGuard(res)) return;
  const start = readCoordinates(url.searchParams.get('start'));
  const end = readCoordinates(url.searchParams.get('end'));
  const rawWaypoints = url.searchParams.get('waypoints');
  const waypoints = rawWaypoints
    ? rawWaypoints.split('|').map((w) => readCoordinates(w)).filter(Boolean)
    : [];
  const mode = url.searchParams.get('mode') || 'car';
  const profile = ROUTE_PROFILES[mode];
  const includeAlternatives = mode === 'car' && url.searchParams.get('alternatives') === 'true';
  const avoidFeatures = (url.searchParams.get('avoid') || '')
    .split(',').filter((f) => ALLOWED_AVOID_FEATURES[mode]?.has(f));
  if (!start || !end || !profile) {
    sendJson(res, 400, { error: 'Nieprawidłowe parametry trasy.' });
    return;
  }
  try {
    const body = {
      coordinates: [start, ...waypoints, end],
      instructions: true,
      language: 'pl',
      ...(avoidFeatures.length > 0 ? { options: { avoid_features: avoidFeatures } } : {}),
      ...(includeAlternatives ? { alternative_routes: { target_count: 3, weight_factor: 1.4, share_factor: 0.6 } } : {})
    };
    const upstreamRes = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: 'POST',
        headers: {
          Authorization: openRouteServiceApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'MojaMapa/1.0'
        },
        body: JSON.stringify(body)
      }
    );
    const payload = await upstreamRes.json();
    sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status,
      upstreamRes.ok ? payload : { error: 'Nie udało się wyznaczyć trasy.' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z usługą tras.' });
  }
}

async function handlePois(url, res) {
  if (!apiKeyGuard(res)) return;
  const categoryId = url.searchParams.get('category');
  const bbox = url.searchParams.get('bbox');
  if (!categoryId || !bbox) {
    sendJson(res, 400, { error: 'Brak wymaganych parametrów.' });
    return;
  }
  const nums = bbox.split(',').map(Number);
  if (nums.length !== 4 || nums.some((v) => !Number.isFinite(v))) {
    sendJson(res, 400, { error: 'Nieprawidłowe współrzędne.' });
    return;
  }
  try {
    const upstreamRes = await fetch('https://api.openrouteservice.org/v2/pois', {
      method: 'POST',
      headers: {
        Authorization: openRouteServiceApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'MojaMapa/1.0'
      },
      body: JSON.stringify({
        request: 'pois',
        geometry: { bbox: [[nums[0], nums[1]], [nums[2], nums[3]]] },
        filter_category_ids: [Number(categoryId)],
        sort_by: 'distance'
      })
    });
    const payload = await upstreamRes.json();
    sendJson(res, upstreamRes.ok ? 200 : upstreamRes.status,
      upstreamRes.ok ? payload : { error: 'Wyszukiwanie POI jest chwilowo niedostępne.' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z usługą POI.' });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/^\/api\//, '');

  if (pathname === 'geocode') await handleGeocode(url, res);
  else if (pathname === 'reverse-geocode') await handleReverseGeocode(url, res);
  else if (pathname === 'route') await handleRoute(url, res);
  else if (pathname === 'pois') await handlePois(url, res);
  else sendPlain(res, 404, 'Not found');
}
