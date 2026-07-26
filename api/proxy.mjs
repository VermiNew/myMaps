const osrmProfiles = {
  car: 'driving',
  bicycle: 'cycling',
  foot: 'walking'
};

const poiCategoryTags = {
  100: { amenity: 'restaurant' },
  102: { amenity: 'cafe' },
  103: { amenity: 'bar' },
  301: { amenity: 'fuel' },
  300: { amenity: 'parking' },
  401: { amenity: 'pharmacy' },
  400: { amenity: 'hospital' },
  900: { amenity: 'atm' }
};

let lastNominatimCall = 0;

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

function readCoords(value) {
  const c = value?.split(',').map(Number);
  return c?.length === 2 && c.every(Number.isFinite) ? c : null;
}

async function nominatimFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MojaMapa/1.0', 'Referer': 'https://my-maps.vercel.app' }
  });
  return res;
}

async function handleGeocode(url, res) {
  const text = url.searchParams.get('text')?.trim();
  if (!text || text.length < 3) {
    sendJson(res, 400, { error: 'Wpisz co najmniej 3 znaki.' });
    return;
  }
  try {
    const u = new URL('https://nominatim.openstreetmap.org/search');
    u.searchParams.set('q', text);
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('limit', '6');
    u.searchParams.set('accept-language', 'pl');
    u.searchParams.set('countrycodes', 'pl');
    const upstreamRes = await nominatimFetch(u);
    const data = await upstreamRes.json();
    if (!upstreamRes.ok) {
      sendJson(res, 502, { error: 'Wyszukiwanie jest chwilowo niedostępne.' });
      return;
    }
    const features = (data || []).map((item) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(item.lon), Number(item.lat)] },
      properties: {
        gid: `nominatim-${item.osm_type}-${item.osm_id}`,
        name: item.name || item.display_name?.split(',')[0] || '',
        label: item.display_name || '',
        locality: item.city || item.town || item.village || item.county || 'Polska',
        street: item.address?.road || '',
        housenumber: item.address?.house_number || ''
      }
    }));
    sendJson(res, 200, { features, type: 'FeatureCollection' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z wyszukiwarką miejsc.' });
  }
}

async function handleReverseGeocode(url, res) {
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  if (!lat || !lng || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    sendJson(res, 400, { error: 'Nieprawidłowe współrzędne.' });
    return;
  }
  try {
    const u = new URL('https://nominatim.openstreetmap.org/reverse');
    u.searchParams.set('lat', lat);
    u.searchParams.set('lon', lng);
    u.searchParams.set('format', 'jsonv2');
    u.searchParams.set('accept-language', 'pl');
    u.searchParams.set('zoom', '18');
    const upstreamRes = await nominatimFetch(u);
    const data = await upstreamRes.json();
    if (!upstreamRes.ok || data.error) {
      sendJson(res, 502, { error: 'Geokodowanie jest chwilowo niedostępne.' });
      return;
    }
    const props = data.address || {};
    const features = [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(data.lon || lng), Number(data.lat || lat)] },
      properties: {
        name: data.name || props.road || props.hamlet || props.city || 'Wybrane miejsce',
        label: data.display_name || '',
        locality: props.city || props.town || props.village || props.county || 'Polska',
        street: props.road || '',
        housenumber: props.house_number || ''
      }
    }];
    sendJson(res, 200, { features, type: 'FeatureCollection' });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z usługą geokodowania.' });
  }
}

function osrmManeuverType(type, modifier) {
  if (type === 'depart') return 11;
  if (type === 'arrive') return 10;
  if (type === 'roundabout' || type === 'rotary') return 7;
  if (type === 'exit roundabout' || type === 'exit rotary') return 8;
  if (type === 'fork' && modifier === 'left') return 12;
  if (type === 'fork' && modifier === 'right') return 13;
  if (type === 'merge' && modifier === 'left') return 12;
  if (type === 'merge' && modifier === 'right') return 13;
  if (type === 'end of road') {
    const endMap = { left: 0, right: 1, straight: 6 };
    return endMap[modifier] ?? 6;
  }
  const modMap = { left: 0, right: 1, 'sharp left': 2, 'sharp right': 3, 'slight left': 4, 'slight right': 5, straight: 6, uturn: 9 };
  return modMap[modifier] ?? 11;
}

function buildOsrmUrl(profile, coordinates) {
  const coordStr = coordinates.map((c) => c.join(',')).join(';');
  return `https://router.project-osrm.org/route/v1/${profile}/${coordStr}?geometries=geojson&steps=true&overview=full&alternatives=3`;
}

function osrmInstruction(type, modifier, name, exit) {
  const part = name ? ` — ${name}` : '';
  if (type === 'depart') return 'Kieruj się w wyznaczonym kierunku' + part;
  if (type === 'arrive') return 'Dotarłeś do celu';
  if (type === 'roundabout' || type === 'rotary') return exit ? `Wjazd na rondo — ${exit}. zjazd` : 'Wjedź na rondo';
  if (type === 'exit roundabout' || type === 'exit rotary') return 'Zjazd z ronda' + part;
  const modPhrases = {
    'left': 'Skręć w lewo',
    'right': 'Skręć w prawo',
    'sharp left': 'Skręć ostro w lewo',
    'sharp right': 'Skręć ostro w prawo',
    'slight left': 'Skręć delikatnie w lewo',
    'slight right': 'Skręć delikatnie w prawo',
    'straight': 'Jedź prosto',
    'uturn': 'Zawróć'
  };
  return (modPhrases[modifier] || 'Kontynuuj') + part;
}

function buildOsrmStep(step, geometry) {
  const man = step.maneuver || {};
  const loc = man.location || [0, 0];
  let startIdx = 0;
  for (let i = 0; i < geometry.length; i++) {
    const g = geometry[i];
    if (Math.abs(g[0] - loc[0]) < 0.0001 && Math.abs(g[1] - loc[1]) < 0.0001) {
      startIdx = i;
      break;
    }
  }
  const endIdx = Math.min(startIdx + Math.max(1, Math.round(geometry.length * step.distance / (step.duration || 1))), geometry.length - 1);
  const instruction = osrmInstruction(man.type, man.modifier, step.name || step.ref || '', man.exit);
  return {
    distance: Math.round(step.distance),
    duration: Math.round(step.duration),
    type: osrmManeuverType(man.type, man.modifier),
    instruction,
    way_points: [startIdx, endIdx],
    exit_number: man.exit || 0
  };
}

function osrmToOrsRoute(osrmRoute) {
  const geom = osrmRoute.geometry;
  const legs = osrmRoute.legs || [];
  const steps = legs.flatMap((leg) => (leg.steps || []).map((s) => buildOsrmStep(s, geom.coordinates)));
  const totalDistance = legs.reduce((a, l) => a + l.distance, 0);
  const totalDuration = legs.reduce((a, l) => a + l.duration, 0);
  return {
    type: 'Feature',
    geometry: geom,
    properties: {
      summary: { distance: Math.round(totalDistance), duration: Math.round(totalDuration) },
      segments: [{ steps, distance: Math.round(totalDistance), duration: Math.round(totalDuration) }],
      way_points: [0, geom.coordinates.length - 1]
    }
  };
}

async function handleRoute(url, res) {
  const start = readCoords(url.searchParams.get('start'));
  const end = readCoords(url.searchParams.get('end'));
  const rawWaypoints = url.searchParams.get('waypoints');
  const waypoints = rawWaypoints ? rawWaypoints.split('|').map((w) => readCoords(w)).filter(Boolean) : [];
  const mode = url.searchParams.get('mode') || 'car';
  const profile = osrmProfiles[mode];
  if (!start || !end || !profile) {
    sendJson(res, 400, { error: 'Nieprawidłowe parametry trasy.' });
    return;
  }
  try {
    const coordinates = [start, ...waypoints, end];
    const upstreamRes = await fetch(buildOsrmUrl(profile, coordinates), {
      headers: { 'User-Agent': 'MojaMapa/1.0' }
    });
    const data = await upstreamRes.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      sendJson(res, 502, { error: 'Nie udało się wyznaczyć trasy.' });
      return;
    }
    const features = data.routes.map(osrmToOrsRoute);
    sendJson(res, 200, { features, type: 'FeatureCollection', metadata: { provider: 'osrm', attribution: '© OpenStreetMap contributors' } });
  } catch {
    sendJson(res, 502, { error: 'Nie udało się połączyć z usługą tras.' });
  }
}

async function handlePois(url, res) {
  const categoryId = Number(url.searchParams.get('category'));
  const bbox = url.searchParams.get('bbox');
  if (!categoryId || !bbox) {
    sendJson(res, 400, { error: 'Brak wymaganych parametrów.' });
    return;
  }
  const tag = poiCategoryTags[categoryId];
  if (!tag) {
    sendJson(res, 400, { error: 'Nieznana kategoria.' });
    return;
  }
  try {
    const key = Object.keys(tag)[0];
    const value = tag[key];
    const [west, south, east, north] = bbox.split(',').map(Number);
    const query = `[out:json][timeout:15];(node["${key}"="${value}"](${south},${west},${north},${east});way["${key}"="${value}"](${south},${west},${north},${east}););out center 10;`;
    const upstreamRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MojaMapa/1.0' },
      body: new URLSearchParams({ data: query })
    });
    const data = await upstreamRes.json();
    if (!upstreamRes.ok) {
      sendJson(res, 502, { error: 'Wyszukiwanie POI jest chwilowo niedostępne.' });
      return;
    }
    const features = (data.elements || []).map((el) => {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat ?? 0;
      const lon = el.lon ?? el.center?.lon ?? 0;
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          osm_id: el.id,
          id: `overpass-${el.id}`,
          name: tags.name || tags.brand || 'Miejsce',
          street,
          housenumber: tags['addr:housenumber'] || '',
          locality: tags['addr:city'] || tags['addr:place'] || '',
          distance: 0,
          category_ids: [0]
        }
      };
    });
    sendJson(res, 200, { features, type: 'FeatureCollection' });
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
