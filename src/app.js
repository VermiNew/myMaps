'use strict';

const React = window.React;
const ReactDOM = window.ReactDOM;
const h = React.createElement;
const MAP_STYLE_LIST = ['streets', 'satellite', 'dark'];
const MAP_STYLES = {
  streets: 'https://tiles.openfreemap.org/styles/positron',
  satellite: {
    version: 8,
    name: 'Satellite',
    sources: {
      'esri-satellite': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '© Esri'
      }
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 22 }
    ]
  },
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
};
const DEFAULT_MAP_STYLE = 'streets';
const DEFAULT_ORIGIN = [21.0374, 52.2518];
const TRAVEL_MODES = [
  { id: 'car', label: 'Samochód' },
  { id: 'bicycle', label: 'Rower' },
  { id: 'foot', label: 'Pieszo' }
];
const ROUTE_PREFERENCES = [
  { id: 'tollways', label: 'Drogi płatne', carOnly: true },
  { id: 'highways', label: 'Autostrady', carOnly: true },
  { id: 'ferries', label: 'Promy', carOnly: false }
];

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} godz. ${minutes % 60} min`;
}

function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

function formatArrivalTime(seconds) {
  return new Date(Date.now() + (seconds * 1000)).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function classifyManeuver(step, isLast) {
  if (isLast || step.type === 10) return { type: 'arrive', voiceId: 'arrive' };
  const roundaboutExits = [
    'first', 'second', 'third', 'fourth', 'fifth', 'sixth',
    'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'
  ];
  if (step.type === 7 && step.exit_number >= 1 && step.exit_number <= roundaboutExits.length) {
    return {
      type: 'straight',
      voiceId: `roundabout_exit_${roundaboutExits[step.exit_number - 1]}`
    };
  }
  const maneuverTypes = {
    0: { type: 'left', voiceId: 'left' },
    1: { type: 'right', voiceId: 'right' },
    2: { type: 'left', voiceId: 'turn_sharp_left' },
    3: { type: 'right', voiceId: 'turn_sharp_right' },
    4: { type: 'left', voiceId: 'turn_slight_left' },
    5: { type: 'right', voiceId: 'turn_slight_right' },
    6: { type: 'straight', voiceId: 'straight' },
    7: { type: 'straight', voiceId: 'roundabout_enter' },
    8: { type: 'straight', voiceId: 'roundabout_leave' },
    9: { type: 'left', voiceId: 'u_turn' },
    11: { type: 'straight', voiceId: 'straight' },
    12: { type: 'left', voiceId: 'keep_left' },
    13: { type: 'right', voiceId: 'keep_right' }
  };
  if (maneuverTypes[step.type]) {
    return maneuverTypes[step.type];
  }
  const normalizedInstruction = step.instruction.toLocaleLowerCase('pl');
  if (normalizedInstruction.includes('lewo')) return { type: 'left', voiceId: 'left' };
  if (normalizedInstruction.includes('prawo')) return { type: 'right', voiceId: 'right' };
  return { type: 'straight', voiceId: 'straight' };
}

function readPosition(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp
  };
}

function distanceBetween(first, second) {
  const toRadians = (value) => value * (Math.PI / 180);
  const latitudeDelta = toRadians(second[1] - first[1]);
  const longitudeDelta = toRadians(second[0] - first[0]);
  const firstLatitude = toRadians(first[1]);
  const secondLatitude = toRadians(second[1]);
  const haversine = (Math.sin(latitudeDelta / 2) ** 2)
    + (Math.cos(firstLatitude) * Math.cos(secondLatitude)
      * (Math.sin(longitudeDelta / 2) ** 2));
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function findClosestRoutePoint(userCoordinates, routeCoordinates) {
  if (!userCoordinates || routeCoordinates.length < 2) {
    return null;
  }
  const point = [userCoordinates.longitude, userCoordinates.latitude];
  let closest = null;

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    const referenceLatitude = ((start[1] + end[1] + point[1]) / 3) * (Math.PI / 180);
    const longitudeScale = Math.cos(referenceLatitude) * 111320;
    const latitudeScale = 110540;
    const segmentX = (end[0] - start[0]) * longitudeScale;
    const segmentY = (end[1] - start[1]) * latitudeScale;
    const pointX = (point[0] - start[0]) * longitudeScale;
    const pointY = (point[1] - start[1]) * latitudeScale;
    const segmentLengthSquared = (segmentX ** 2) + (segmentY ** 2);
    const fraction = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((pointX * segmentX) + (pointY * segmentY)) / segmentLengthSquared));
    const coordinate = [
      start[0] + ((end[0] - start[0]) * fraction),
      start[1] + ((end[1] - start[1]) * fraction)
    ];
    const distance = distanceBetween(point, coordinate);

    if (!closest || distance < closest.distance) {
      closest = { coordinate, distance, fraction, segmentIndex: index };
    }
  }
  return closest;
}

function measureRouteFromPoint(routeCoordinates, routePoint, endIndex) {
  if (!routePoint || routeCoordinates.length < 2 || endIndex <= routePoint.segmentIndex) {
    return 0;
  }
  const finalIndex = Math.min(endIndex, routeCoordinates.length - 1);
  let distance = distanceBetween(
    routePoint.coordinate,
    routeCoordinates[routePoint.segmentIndex + 1]
  );
  for (let index = routePoint.segmentIndex + 1; index < finalIndex; index += 1) {
    distance += distanceBetween(routeCoordinates[index], routeCoordinates[index + 1]);
  }
  return distance;
}

function createRouteOption(route) {
  const summary = route.properties.summary;
  const steps = route.properties.segments?.[0]?.steps || [];
  const routeManeuvers = steps.map((step, index) => {
    const maneuver = classifyManeuver(step, index === steps.length - 1);
    return {
      ...maneuver,
      distance: formatDistance(step.distance),
      instruction: step.instruction,
      rawDistance: step.distance,
      duration: step.duration,
      startIndex: step.way_points?.[0] ?? 0,
      endIndex: step.way_points?.[1] ?? 0
    };
  });
  return { route, routeManeuvers, summary };
}

const POI_CATEGORIES = [
  { id: 100, label: 'Restauracje' },
  { id: 102, label: 'Kawiarnie' },
  { id: 103, label: 'Bary' },
  { id: 301, label: 'Stacje paliw' },
  { id: 300, label: 'Parkingi' },
  { id: 401, label: 'Apteki' },
  { id: 400, label: 'Szpitale' },
  { id: 900, label: 'Bankomaty' }
];

const DESTINATIONS = [
  {
    id: 'museum',
    name: 'Muzeum Narodowe',
    address: 'Aleje Jerozolimskie 3, Warszawa',
    district: 'Śródmieście',
    coordinates: [21.0245, 52.2317],
    time: '18 min',
    distance: '5,7 km',
    routePath: 'M175 625C310 540 338 438 500 420s265 78 390-14 110-180 205-235',
    endpoint: [1095, 171],
    navigationPoints: [[175, 625], [360, 500], [560, 430], [820, 420], [980, 300], [1095, 171]]
  },
  {
    id: 'park',
    name: 'Park Skaryszewski',
    address: 'Aleja Zieleniecka, Warszawa',
    district: 'Praga-Południe',
    coordinates: [21.0647, 52.2442],
    time: '24 min',
    distance: '8,4 km',
    routePath: 'M175 625C305 570 410 600 510 545s172-130 290-70 190 160 320 135',
    endpoint: [1120, 610],
    navigationPoints: [[175, 625], [350, 585], [520, 545], [730, 470], [930, 520], [1120, 610]]
  },
  {
    id: 'library',
    name: 'Biblioteka Uniwersytecka',
    address: 'Dobra 56/66, Warszawa',
    district: 'Powiśle',
    coordinates: [21.0248, 52.2429],
    time: '15 min',
    distance: '4,3 km',
    routePath: 'M175 625C295 535 355 420 490 410s195 15 285-75 120-155 210-185',
    endpoint: [985, 150],
    navigationPoints: [[175, 625], [330, 500], [490, 410], [675, 400], [830, 290], [985, 150]]
  },
  {
    id: 'station',
    name: 'Warszawa Centralna',
    address: 'Aleje Jerozolimskie 54, Warszawa',
    district: 'Śródmieście',
    coordinates: [21.0039, 52.2285],
    time: '12 min',
    distance: '3,6 km',
    routePath: 'M175 625C280 555 315 470 430 445s200 25 305-45 125-110 205-95',
    endpoint: [940, 305],
    navigationPoints: [[175, 625], [315, 520], [430, 445], [610, 445], [770, 365], [940, 305]]
  }
];

const MANEUVERS = {
  museum: [
    { type: 'straight', distance: '300 m', instruction: 'Jedź prosto ulicą Targową' },
    { type: 'right', distance: '1,2 km', instruction: 'Skręć w prawo w aleję Solidarności' },
    { type: 'left', distance: '2,4 km', instruction: 'Trzymaj się lewej strony przy placu Bankowym' },
    { type: 'straight', distance: '900 m', instruction: 'Jedź prosto przez rondo de Gaulle’a' },
    { type: 'right', distance: '120 m', instruction: 'Skręć w prawo przy Muzeum Narodowym' },
    { type: 'arrive', distance: 'Cel', instruction: 'Miejsce docelowe jest po prawej stronie' }
  ],
  park: [
    { type: 'straight', distance: '450 m', instruction: 'Jedź prosto ulicą Zamoyskiego' },
    { type: 'right', distance: '700 m', instruction: 'Skręć w prawo w aleję Zieleniecką' },
    { type: 'left', distance: '1,6 km', instruction: 'Skręć łagodnie w lewo przy rondzie Waszyngtona' },
    { type: 'straight', distance: '800 m', instruction: 'Jedź prosto wzdłuż parku' },
    { type: 'right', distance: '80 m', instruction: 'Skręć w prawo na parking' },
    { type: 'arrive', distance: 'Cel', instruction: 'Park Skaryszewski jest przed Tobą' }
  ],
  library: [
    { type: 'straight', distance: '250 m', instruction: 'Jedź prosto ulicą Targową' },
    { type: 'left', distance: '950 m', instruction: 'Skręć w lewo w ulicę Świętokrzyską' },
    { type: 'right', distance: '1,1 km', instruction: 'Skręć w prawo w ulicę Dobrą' },
    { type: 'straight', distance: '600 m', instruction: 'Jedź prosto w kierunku Powiśla' },
    { type: 'left', distance: '90 m', instruction: 'Skręć w lewo przed biblioteką' },
    { type: 'arrive', distance: 'Cel', instruction: 'Biblioteka znajduje się po lewej stronie' }
  ],
  station: [
    { type: 'straight', distance: '350 m', instruction: 'Jedź prosto w kierunku centrum' },
    { type: 'left', distance: '800 m', instruction: 'Skręć w lewo w ulicę Marszałkowską' },
    { type: 'right', distance: '650 m', instruction: 'Skręć w prawo w Aleje Jerozolimskie' },
    { type: 'straight', distance: '500 m', instruction: 'Trzymaj się środkowego pasa' },
    { type: 'right', distance: '60 m', instruction: 'Skręć w prawo na podjazd dworca' },
    { type: 'arrive', distance: 'Cel', instruction: 'Dworzec Centralny jest przed Tobą' }
  ]
};

const VOICE_PHRASES = [
  { id: 'straight', label: 'Jedź prosto', description: 'Odtwarzane przed jazdą na wprost' },
  { id: 'left', label: 'Skręć w lewo', description: 'Odtwarzane przed skrętem w lewo' },
  { id: 'right', label: 'Skręć w prawo', description: 'Odtwarzane przed skrętem w prawo' },
  { id: 'arrive', label: 'Jesteś na miejscu', description: 'Odtwarzane po dotarciu do celu' }
];

function getDefaultVoiceUrl(phraseId) {
  return `./audio/default-voice/${phraseId}.mp3`;
}

const DISTANCE_VOICE_PROMPTS = [
  [10, 'in_10_m'],
  [20, 'in_20_m'],
  [30, 'in_30_m'],
  [40, 'in_40_m'],
  [50, 'in_50_m'],
  [60, 'in_60_m'],
  [70, 'in_70_m'],
  [80, 'in_80_m'],
  [90, 'in_90_m'],
  [100, 'in_100_m'],
  [150, 'in_150_m'],
  [200, 'in_200_m'],
  [300, 'in_300_m'],
  [400, 'in_400_m'],
  [500, 'in_500_m'],
  [600, 'in_600_m'],
  [700, 'in_700_m'],
  [800, 'in_800_m'],
  [900, 'in_900_m'],
  [1000, 'in_1_km'],
  [1500, 'in_1_5_km'],
  [2000, 'in_2_km'],
  [3000, 'in_3_km'],
  [5000, 'in_5_km'],
  [10000, 'in_10_km']
];

function getDistanceVoiceId(meters) {
  if (!Number.isFinite(meters) || meters < 15) {
    return null;
  }
  return DISTANCE_VOICE_PROMPTS.reduce((closest, prompt) => (
    Math.abs(prompt[0] - meters) < Math.abs(closest[0] - meters) ? prompt : closest
  ))[1];
}

const VOICE_DATABASE_NAME = 'mojamapa-voice';
const VOICE_STORE_NAME = 'clips';
const PLACE_HISTORY_KEY = 'mojamapa-place-history-v1';
const FAVORITE_PLACES_KEY = 'mojamapa-favorite-places-v1';

function readStoredPlaces(storageKey) {
  try {
    const places = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    return Array.isArray(places)
      ? places.filter((place) => (
        place
        && typeof place.id === 'string'
        && typeof place.name === 'string'
        && Array.isArray(place.coordinates)
        && place.coordinates.length === 2
        && place.coordinates.every(Number.isFinite)
      )).slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function writeStoredPlaces(storageKey, places) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(places));
  } catch {
    // Browsing in private mode can disable storage; navigation still works without saved places.
  }
}

function readSharedRoute() {
  const parameters = new URLSearchParams(window.location.search);
  const coordinates = parameters.get('to')?.split(',').map(Number);
  if (coordinates?.length !== 2 || !coordinates.every(Number.isFinite)) {
    return null;
  }
  const travelMode = TRAVEL_MODES.some((mode) => mode.id === parameters.get('mode'))
    ? parameters.get('mode')
    : 'car';
  const allowedFeatures = new Set(ROUTE_PREFERENCES.map((preference) => preference.id));
  const avoidedFeatures = (parameters.get('avoid') || '')
    .split(',')
    .filter((feature) => allowedFeatures.has(feature));
  const name = parameters.get('name') || 'Udostępniony cel';
  return {
    destination: {
      id: `shared-${coordinates.join('-')}`,
      name,
      address: parameters.get('address') || 'Cel udostępnionej trasy',
      district: 'Udostępnione',
      coordinates,
      time: 'Wyznacz trasę',
      distance: '—',
      isSearchResult: true
    },
    travelMode,
    avoidedFeatures
  };
}

function openVoiceDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = window.indexedDB.open(VOICE_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VOICE_STORE_NAME)) {
        database.createObjectStore(VOICE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStoredVoiceClips() {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VOICE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(VOICE_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function persistVoiceClip(id, blob) {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VOICE_STORE_NAME, 'readwrite');
    transaction.objectStore(VOICE_STORE_NAME).put({ id, blob, updatedAt: Date.now() });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function removeVoiceClip(id) {
  const database = await openVoiceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(VOICE_STORE_NAME, 'readwrite');
    transaction.objectStore(VOICE_STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function Icon({ name, size = 20 }) {
  const icons = {
    arrow: h('path', { d: 'M5 12h14M13 6l6 6-6 6' }),
    arrive: h('g', null,
      h('path', { d: 'M6 21V5' }),
      h('path', { d: 'M6 6h10l-2 4 2 4H6' })
    ),
    compass: h('g', null,
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'm15.4 8.6-2.2 4.6-4.6 2.2 2.2-4.6 4.6-2.2Z' })
    ),
    close: h('path', { d: 'M6 6l12 12M18 6 6 18' }),
    location: h('g', null,
      h('path', { d: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z' }),
      h('circle', { cx: 12, cy: 10, r: 2.4 })
    ),
    menu: h('path', { d: 'M4 7h16M4 12h16M4 17h16' }),
    mic: h('g', null,
      h('rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }),
      h('path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6' })
    ),
    route: h('path', { d: 'M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 15.5c4.5 0 1-7 6.5-7' }),
    left: h('path', { d: 'M19 19v-3a6 6 0 0 0-6-6H5m5-5-5 5 5 5' }),
    pause: h('g', null,
      h('path', { d: 'M9 5v14' }),
      h('path', { d: 'M15 5v14' })
    ),
    play: h('path', { d: 'm8 5 11 7-11 7Z' }),
    right: h('path', { d: 'M5 19v-3a6 6 0 0 1 6-6h8m-5-5 5 5-5 5' }),
    search: h('g', null,
      h('circle', { cx: 11, cy: 11, r: 7 }),
      h('path', { d: 'm20 20-4-4' })
    ),
    stop: h('rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 }),
    straight: h('path', { d: 'M12 20V5m-5 5 5-5 5 5' }),
    layers: h('g', null,
      h('path', { d: 'M2 12l10-8 10 8M2 17l10-8 10 8M2 22l10-8 10 8' })
    ),
    star: h('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }),
    trash: h('g', null,
      h('path', { d: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13' }),
      h('path', { d: 'M10 11v5M14 11v5' })
    ),
    volume: h('g', null,
      h('path', { d: 'M5 10v4h4l5 4V6L9 10H5Z' }),
      h('path', { d: 'M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12' })
    )
  };

  return h('svg', {
    className: 'icon',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }, icons[name]);
}

class MapCanvas extends React.Component {
  constructor(props) {
    super(props);
    this.mapContainer = null;
    this.map = null;
    this.originMarker = null;
    this.destinationMarker = null;
    this.poiMarkers = [];
    this.clickMarker = null;
    this.state = { mapError: false, bearing: 0, pitch: 0 };
    this.fitMap = this.fitMap.bind(this);
    this.resetNorth = this.resetNorth.bind(this);
  }

  componentDidMount() {
    try {
      const style = MAP_STYLES[this.props.mapStyle] || MAP_STYLES[DEFAULT_MAP_STYLE];
      this.map = new window.maplibregl.Map({
        container: this.mapContainer,
        style,
        center: [21.03, 52.24],
        zoom: 11.5,
        attributionControl: true
      });
      this.map.touchZoomRotate.disableRotation();
      this.map.once('load', () => {
        this.updateMarkers();
        this.updateRoute();
        this.fitMap();
      });
      this.map.on('click', (event) => {
        this.props.onMapClick?.([event.lngLat.lng, event.lngLat.lat]);
      });
      this.map.on('move', () => {
        const bearing = this.map.getBearing();
        const pitch = this.map.getPitch();
        if (bearing !== this.state.bearing || pitch !== this.state.pitch) {
          this.setState({ bearing, pitch });
        }
      });
      this.map.on('error', (event) => {
        if (!event.error || !this.map.loaded()) {
          this.setState({ mapError: true });
        }
      });
    } catch {
      this.setState({ mapError: true });
    }
  }

  componentDidUpdate(previousProps) {
    if (!this.map) {
      return;
    }
    if (previousProps.mapStyle !== this.props.mapStyle) {
      const style = MAP_STYLES[this.props.mapStyle] || MAP_STYLES[DEFAULT_MAP_STYLE];
      this.map.setStyle(style);
      this.map.once('style.load', () => {
        this.updateRoute();
      });
      return;
    }
    if (previousProps.destination !== this.props.destination) {
      this.updateDestinationMarker();
      this.fitMap();
    }
    if (previousProps.userCoordinates !== this.props.userCoordinates) {
      this.updateOriginMarker();
      if (this.props.navigationActive) {
        this.followUser();
      } else {
        this.fitMap();
      }
    }
    if (!previousProps.navigationActive && this.props.navigationActive) {
      this.updateOriginMarker();
      this.followUser();
    }
    if (previousProps.route !== this.props.route) {
      this.updateRoute();
      if (!this.props.navigationActive) {
        this.fitMap();
      }
    }
    if (previousProps.poiResults !== this.props.poiResults) {
      this.updatePoiMarkers();
    }
    if (previousProps.clickedLocation !== this.props.clickedLocation) {
      this.updateClickMarker();
    }
    if (previousProps.mapZoom !== this.props.mapZoom) {
      if (this.props.mapZoom === 1) {
        this.fitMap();
      } else {
        this.map.easeTo({
          zoom: 11.5 + ((this.props.mapZoom - 1) * 5),
          duration: 240
        });
      }
    }
  }

  componentWillUnmount() {
    if (this.map) {
      this.map.off('click');
    }
    this.originMarker?.remove();
    this.destinationMarker?.remove();
    this.removePoiMarkers();
    this.clickMarker?.remove();
    this.map?.remove();
  }

  getOrigin() {
    const { userCoordinates } = this.props;
    return userCoordinates
      ? [userCoordinates.longitude, userCoordinates.latitude]
      : DEFAULT_ORIGIN;
  }

  createMarker(className, label) {
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-label', label);
    element.setAttribute('role', 'img');
    return element;
  }

  updateMarkers() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    this.updateOriginMarker();
    this.updateDestinationMarker();
  }

  updateOriginMarker() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    if (!this.originMarker) {
      this.originMarker = new window.maplibregl.Marker({
        element: this.createMarker('map-origin-marker', 'Twoja lokalizacja')
      }).setLngLat(this.getOrigin()).addTo(this.map);
    } else {
      this.originMarker.setLngLat(this.getOrigin());
    }
    const element = this.originMarker.getElement();
    element.classList.toggle('is-navigating', this.props.navigationActive);
    const heading = this.props.userCoordinates?.heading;
    element.style.setProperty('--heading', `${Number.isFinite(heading) ? heading : 0}deg`);
  }

  updateDestinationMarker() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    this.destinationMarker?.remove();
    this.destinationMarker = new window.maplibregl.Marker({
      element: this.createMarker('map-destination-marker', `Cel: ${this.props.destination.name}`),
      anchor: 'bottom'
    }).setLngLat(this.props.destination.coordinates).addTo(this.map);
  }

  resetNorth() {
    if (!this.map) return;
    this.map.easeTo({ bearing: 0, pitch: 0, duration: 480 });
  }

  removePoiMarkers() {
    this.poiMarkers.forEach((marker) => marker.remove());
    this.poiMarkers = [];
  }

  updatePoiMarkers() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    this.removePoiMarkers();
    const pois = this.props.poiResults || [];
    pois.forEach((poi) => {
      const element = document.createElement('div');
      element.className = 'poi-marker';
      element.setAttribute('aria-label', poi.name);
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      element.addEventListener('click', () => {
        this.props.onPoiSelect?.(poi);
      });
      const marker = new window.maplibregl.Marker({ element })
        .setLngLat(poi.coordinates)
        .addTo(this.map);
      this.poiMarkers.push(marker);
    });
  }

  updateClickMarker() {
    this.clickMarker?.remove();
    this.clickMarker = null;
    const location = this.props.clickedLocation;
    if (!location || !this.map || !this.map.loaded()) {
      return;
    }
    const element = document.createElement('div');
    element.className = 'click-marker';
    element.setAttribute('aria-label', 'Wybrane miejsce');
    element.setAttribute('role', 'img');
    this.clickMarker = new window.maplibregl.Marker({ element })
      .setLngLat(location)
      .addTo(this.map);
  }

  followUser() {
    if (!this.map || !this.map.loaded() || !this.props.userCoordinates) {
      return;
    }
    this.map.easeTo({
      center: this.getOrigin(),
      zoom: Math.max(this.map.getZoom(), 16),
      duration: 480
    });
  }

  updateRoute() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    const routeData = this.props.route || {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [] },
      properties: {}
    };
    const routeSource = this.map.getSource('route');
    if (routeSource) {
      routeSource.setData(routeData);
      return;
    }
    this.map.addSource('route', { type: 'geojson', data: routeData });
    this.map.addLayer({
      id: 'route-outline',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': '#ffffff',
        'line-width': 11,
        'line-opacity': 0.92
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
    this.map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': '#2d6cf6',
        'line-width': 6
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
  }

  fitMap() {
    if (!this.map || !this.map.loaded()) {
      return;
    }
    this.props.onResetMap();
    const routeCoordinates = this.props.route?.geometry?.coordinates || [];
    const bounds = routeCoordinates.length > 0
      ? routeCoordinates.reduce(
        (routeBounds, coordinate) => routeBounds.extend(coordinate),
        new window.maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0])
      )
      : new window.maplibregl.LngLatBounds(this.getOrigin(), this.props.destination.coordinates);
    this.map.fitBounds(bounds, {
      padding: { top: 110, right: 100, bottom: 150, left: 100 },
      maxZoom: 14,
      duration: 420
    });
  }

  render() {
    const {
      destination,
      navigationActive,
      currentManeuver,
      tripComplete,
      locationStatus,
      navigationNotice,
      mapZoom,
      mapStyle,
      onZoomIn,
      onZoomOut,
      onMapStyleChange
    } = this.props;

    return h('div', { className: 'map-canvas', 'aria-label': 'Interaktywna mapa Warszawy' },
      h('div', {
        className: 'map-surface',
        ref: (element) => { this.mapContainer = element; }
      }),
      this.state.mapError
        ? h('div', { className: 'map-error', role: 'status' },
          h('strong', null, 'Mapa jest chwilowo niedostępna'),
          h('span', null, 'Sprawdź połączenie z internetem i odśwież stronę.')
        )
        : null,
      navigationNotice
        ? h('div', { className: 'navigation-notice', role: 'status', 'aria-live': 'polite' },
          h(Icon, { name: navigationNotice.icon, size: 16 }),
          h('span', null, navigationNotice.text)
        )
        : null,
      navigationActive || tripComplete
        ? h('div', { className: `navigation-instruction${tripComplete ? ' is-complete' : ''}` },
          h('span', { className: 'maneuver-icon' }, h(Icon, {
            name: tripComplete ? 'arrive' : currentManeuver.type,
            size: 28
          })),
          h('span', { className: 'instruction-copy' },
            h('small', null, tripComplete ? 'Dotarłeś na miejsce' : currentManeuver.distance),
            h('strong', null, tripComplete ? destination.name : currentManeuver.instruction)
          )
        )
        : null,
        h('div', { className: 'map-toolbar' },
        h('button', {
          className: `map-tool${mapStyle !== 'streets' ? ' is-active' : ''}`,
          type: 'button',
          onClick: onMapStyleChange,
          'aria-label': `Styl: ${mapStyle === 'dark' ? 'ciemny' : mapStyle === 'satellite' ? 'satelita' : 'ulice'}`
        }, h(Icon, { name: 'layers' })),
        h('button', {
          className: `map-tool${this.state.bearing !== 0 || this.state.pitch !== 0 ? ' is-active' : ''}`,
          type: 'button',
          onClick: this.resetNorth,
          'aria-label': 'Resetuj północ i pochylenie'
        },
          h('span', {
            style: { display: 'block', transform: `rotate(${-this.state.bearing}deg)`, transition: 'transform 240ms ease' }
          }, h(Icon, { name: 'compass' }))
        ),
        h('div', { className: 'zoom-group' },
          h('button', {
            className: 'map-tool',
            type: 'button',
            onClick: onZoomIn,
            disabled: mapZoom >= 1.3,
            'aria-label': 'Powiększ mapę'
          }, '+'),
          h('button', {
            className: 'map-tool',
            type: 'button',
            onClick: onZoomOut,
            disabled: mapZoom <= 0.85,
            'aria-label': 'Pomniejsz mapę'
          }, '−')
        ),
        h('span', { className: 'zoom-status', 'aria-live': 'polite' }, `${Math.round(mapZoom * 100)}%`)
      ),
      h('div', { className: 'tilt-group', 'aria-label': 'Pochylenie mapy' },
        h('button', {
          className: 'map-tool',
          type: 'button',
          onClick: () => this.map?.easeTo({ pitch: Math.min(this.state.pitch + 15, 60), duration: 240 }),
          disabled: this.state.pitch >= 60,
          'aria-label': 'Pochyl bardziej'
        }, '⌄'),
        h('button', {
          className: 'map-tool',
          type: 'button',
          onClick: () => this.map?.easeTo({ pitch: Math.max(this.state.pitch - 15, 0), duration: 240 }),
          disabled: this.state.pitch <= 0,
          'aria-label': 'Wypoziomuj'
        }, '⌃')
      ),
      locationStatus === 'ready' && !navigationActive && !tripComplete
        ? h('div', { className: 'location-confirmation' },
          h(Icon, { name: 'location', size: 15 }),
          h('span', null, 'Twoja lokalizacja')
        )
        : null,
      h('div', { className: 'map-credit' }, mapStyle === 'dark'
        ? '© CARTO · OpenStreetMap'
        : mapStyle === 'satellite' ? '© Esri · OpenStreetMap' : 'Dane © OpenStreetMap · OpenFreeMap')
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      destination: DESTINATIONS[1],
      query: '',
      searchOpen: false,
      searchResults: [],
      searchStatus: 'idle',
      searchMessage: '',
      route: null,
      routeManeuvers: null,
      routeSummary: null,
      routeAlternatives: [],
      selectedRouteIndex: 0,
      routeStatus: 'idle',
      routeMessage: '',
      travelMode: 'car',
      avoidedFeatures: ['tollways', 'ferries'],
      recentDestinations: readStoredPlaces(PLACE_HISTORY_KEY),
      favoritePlaces: readStoredPlaces(FAVORITE_PLACES_KEY),
      navigationActive: false,
      navigationPaused: false,
      stepIndex: 0,
      routeProgress: 0,
      distanceToManeuver: null,
      remainingDistance: null,
      remainingDuration: null,
      tripComplete: false,
      voiceStudioOpen: false,
      voiceClips: {},
      recordingPhraseId: null,
      voiceMessage: '',
      locationStatus: 'idle',
      locationMessage: '',
      gpsSignal: 'idle',
      networkOnline: navigator.onLine,
      userCoordinates: null,
      mapZoom: 1,
      mapStyle: DEFAULT_MAP_STYLE,
      menuOpen: false,
      poiCategory: null,
      poiResults: [],
      poiStatus: 'idle',
      poiMessage: '',
      clickedLocation: null,
      clickedLocationName: '',
      clickedLocationStatus: 'idle'
    };
    this.searchInput = null;
    this.voiceCloseButton = null;
    this.menuContainer = null;
    this.locationWatchId = null;
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordingChunks = [];
    this.currentAudio = null;
    this.currentAudioCompletion = null;
    this.voicePlaybackToken = 0;
    this.announcedDistanceThresholds = new Set();
    this.offRouteSince = null;
    this.lastRerouteAt = 0;
    this.rerouteInProgress = false;
    this.searchTimer = null;
    this.searchRequest = null;
    this.routeRequest = null;
    this.handleGlobalShortcut = this.handleGlobalShortcut.bind(this);
    this.handleDocumentPointerDown = this.handleDocumentPointerDown.bind(this);
    this.handleSearchChange = this.handleSearchChange.bind(this);
    this.handleNetworkOffline = this.handleNetworkOffline.bind(this);
    this.handleNetworkOnline = this.handleNetworkOnline.bind(this);
    this.handlePositionError = this.handlePositionError.bind(this);
    this.handlePositionUpdate = this.handlePositionUpdate.bind(this);
    this.calculateRoute = this.calculateRoute.bind(this);
    this.closeVoiceStudio = this.closeVoiceStudio.bind(this);
    this.deleteVoiceClip = this.deleteVoiceClip.bind(this);
    this.focusDestinationSearch = this.focusDestinationSearch.bind(this);
    this.openVoiceStudio = this.openVoiceStudio.bind(this);
    this.playVoiceClip = this.playVoiceClip.bind(this);
    this.locateUser = this.locateUser.bind(this);
    this.resetMapView = this.resetMapView.bind(this);
    this.returnToPlanner = this.returnToPlanner.bind(this);
    this.startNavigation = this.startNavigation.bind(this);
    this.startVoiceRecording = this.startVoiceRecording.bind(this);
    this.stopVoiceRecording = this.stopVoiceRecording.bind(this);
    this.stopNavigation = this.stopNavigation.bind(this);
    this.toggleNavigationPause = this.toggleNavigationPause.bind(this);
    this.toggleRoutePreference = this.toggleRoutePreference.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleGlobalShortcut);
    window.addEventListener('offline', this.handleNetworkOffline);
    window.addEventListener('online', this.handleNetworkOnline);
    document.addEventListener('mousedown', this.handleDocumentPointerDown);
    this.loadVoiceClips();
    this.registerServiceWorker();
    const sharedRoute = readSharedRoute();
    if (sharedRoute) {
      this.setState({
        destination: sharedRoute.destination,
        query: sharedRoute.destination.name,
        travelMode: sharedRoute.travelMode,
        avoidedFeatures: sharedRoute.avoidedFeatures,
        routeStatus: 'loading'
      }, this.calculateRoute);
    } else {
      this.calculateRoute();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleGlobalShortcut);
    window.removeEventListener('offline', this.handleNetworkOffline);
    window.removeEventListener('online', this.handleNetworkOnline);
    document.removeEventListener('mousedown', this.handleDocumentPointerDown);
    window.clearTimeout(this.searchTimer);
    this.searchRequest?.abort();
    this.routeRequest?.abort();
    this.stopLocationWatch();
    this.releaseMediaStream();
    this.stopCurrentAudio();
    Object.values(this.state.voiceClips).forEach((clip) => window.URL.revokeObjectURL(clip.url));
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  handleGlobalShortcut(event) {
    if (!this.state.navigationActive && !this.state.tripComplete && this.searchInput
      && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput.focus();
      this.setState({ searchOpen: true });
    }

    if (event.key === 'Escape' && this.state.voiceStudioOpen) {
      event.preventDefault();
      this.closeVoiceStudio();
      return;
    }

    if (event.key === 'Escape' && this.state.menuOpen) {
      event.preventDefault();
      this.setState({ menuOpen: false });
      return;
    }

    if (event.key === 'Escape') {
      this.setState({ searchOpen: false });
      if (this.searchInput) {
        this.searchInput.blur();
      }
    }
  }

  handleDocumentPointerDown(event) {
    if (this.state.menuOpen && this.menuContainer && !this.menuContainer.contains(event.target)) {
      this.setState({ menuOpen: false });
    }
  }

  handleNetworkOffline() {
    this.setState({ networkOnline: false });
    if (this.state.navigationActive) {
      this.playVoiceClip('internet_lost').catch(() => {});
    }
  }

  handleNetworkOnline() {
    const wasOffline = !this.state.networkOnline;
    this.setState({ networkOnline: true });
    if (wasOffline && this.state.navigationActive) {
      this.playVoiceClip('internet_restored').catch(() => {});
    }
  }

  registerServiceWorker() {
    const canRegister = 'serviceWorker' in navigator
      && window.isSecureContext
      && window.location.protocol !== 'file:';

    if (canRegister) {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // Offline support is optional; the application remains usable without registration.
      });
    }
  }

  selectDestination(destination) {
    window.clearTimeout(this.searchTimer);
    this.searchRequest?.abort();
    this.setState((state) => ({
      destination,
      query: destination.name,
      searchOpen: false,
      searchStatus: 'idle',
      searchMessage: '',
      route: null,
      routeManeuvers: null,
      routeSummary: null,
      routeAlternatives: [],
      selectedRouteIndex: 0,
      routeStatus: 'loading',
      routeMessage: '',
      recentDestinations: [
        destination,
        ...state.recentDestinations.filter((place) => place.id !== destination.id)
      ].slice(0, 8)
    }), () => {
      writeStoredPlaces(PLACE_HISTORY_KEY, this.state.recentDestinations);
      this.calculateRoute();
    });
  }

  toggleFavorite(destination, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.setState((state) => {
      const exists = state.favoritePlaces.some((p) => p.id === destination.id);
      const favoritePlaces = exists
        ? state.favoritePlaces.filter((p) => p.id !== destination.id)
        : [destination, ...state.favoritePlaces].slice(0, 8);
      writeStoredPlaces(FAVORITE_PLACES_KEY, favoritePlaces);
      return { favoritePlaces };
    });
  }

  async calculateRoute(startCoordinates = null) {
    if (!navigator.onLine) {
      this.setState({
        routeStatus: 'error',
        routeMessage: 'Brak połączenia z internetem. Wyznaczenie trasy będzie możliwe po przywróceniu sieci.'
      });
      return null;
    }
    this.routeRequest?.abort();
    this.routeRequest = new AbortController();
    const routeOrigin = startCoordinates || this.state.userCoordinates;
    const start = routeOrigin
      ? [routeOrigin.longitude, routeOrigin.latitude]
      : DEFAULT_ORIGIN;
    const end = this.state.destination.coordinates;
    const routeParameters = new URLSearchParams({
      start: start.join(','),
      end: end.join(','),
      mode: this.state.travelMode
    });
    if (this.state.avoidedFeatures.length > 0) {
      routeParameters.set('avoid', this.state.avoidedFeatures.join(','));
    }
    if (this.state.travelMode === 'car') {
      routeParameters.set('alternatives', 'true');
    }
    this.setState({ routeStatus: 'loading', routeMessage: '' });
    try {
      const response = await fetch(
        `/api/route?${routeParameters}`,
        { signal: this.routeRequest.signal }
      );
      const payload = await response.json();
      if (!response.ok || !payload.features?.[0]) {
        throw new Error(payload.error || 'Nie udało się wyznaczyć trasy.');
      }
      const routeAlternatives = payload.features.map(createRouteOption);
      const { route, routeManeuvers, summary } = routeAlternatives[0];
      this.setState((state) => ({
        route,
        routeManeuvers,
        routeSummary: summary,
        routeAlternatives,
        selectedRouteIndex: 0,
        routeStatus: 'ready',
        routeMessage: '',
        destination: {
          ...state.destination,
          time: formatDuration(summary.duration),
          distance: formatDistance(summary.distance)
        }
      }));
      return { route, routeManeuvers, summary };
    } catch (error) {
      if (error.name === 'AbortError') return null;
      this.setState({
        route: null,
        routeManeuvers: null,
        routeSummary: null,
        routeAlternatives: [],
        selectedRouteIndex: 0,
        routeStatus: 'error',
        routeMessage: error.message
      });
      return null;
    }
  }

  handleSearchChange(event) {
    const query = event.target.value;
    window.clearTimeout(this.searchTimer);
    this.searchRequest?.abort();
    this.setState({
      query,
      searchOpen: true,
      searchResults: [],
      searchStatus: query.trim().length >= 3 ? 'loading' : 'idle',
      searchMessage: ''
    });
    if (query.trim().length < 3) {
      return;
    }
    this.searchTimer = window.setTimeout(() => this.searchPlaces(query), 350);
  }

  async searchPlaces(query) {
    const normalizedQuery = query.trim();
    this.searchRequest = new AbortController();
    try {
      const response = await fetch(`/api/geocode?text=${encodeURIComponent(normalizedQuery)}`, {
        signal: this.searchRequest.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Nie udało się wyszukać miejsca.');
      }
      const results = (payload.features || []).map((feature) => {
        const properties = feature.properties || {};
        const label = properties.label || properties.name || 'Wybrane miejsce';
        const locality = properties.locality || properties.county || properties.region || 'Polska';
        return {
          id: properties.gid || `${feature.geometry.coordinates.join('-')}-${label}`,
          name: properties.name || label.split(',')[0],
          address: label,
          district: locality,
          coordinates: feature.geometry.coordinates,
          time: 'Wyznacz trasę',
          distance: '—',
          isSearchResult: true
        };
      });
      if (this.state.query.trim() !== normalizedQuery) {
        return;
      }
      this.setState({
        searchResults: results,
        searchStatus: 'ready',
        searchMessage: results.length === 0 ? 'Nie znaleźliśmy takiego miejsca.' : ''
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      this.setState({
        searchResults: [],
        searchStatus: 'error',
        searchMessage: error.message
      });
    }
  }

  requestCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      });
    });
  }

  handlePositionUpdate(position) {
    const userCoordinates = readPosition(position);
    const gpsSignal = userCoordinates.accuracy > 80 ? 'weak' : 'good';
    const previousGpsSignal = this.state.gpsSignal;
    this.setState({
      locationStatus: 'ready',
      locationMessage: `Dokładność około ${Math.round(userCoordinates.accuracy)} m`,
      gpsSignal,
      userCoordinates
    }, () => {
      if (this.state.navigationActive && previousGpsSignal === 'lost') {
        this.playVoiceClip('gps_restored').catch(() => {});
      } else if (this.state.navigationActive && gpsSignal === 'weak' && previousGpsSignal === 'good') {
        this.playVoiceClip('gps_weak').catch(() => {});
      }
      if (this.state.navigationActive && !this.state.navigationPaused) {
        this.updateNavigationProgress(userCoordinates);
      }
    });
  }

  handlePositionError(error) {
    const permissionDenied = error && error.code === 1;
    const gpsWasAvailable = this.state.gpsSignal !== 'lost';
    this.setState({
      locationStatus: 'error',
      gpsSignal: 'lost',
      locationMessage: permissionDenied
        ? 'Nie przyznano dostępu do lokalizacji.'
        : 'Utracono sygnał GPS. Próbuję ponownie.'
    });
    if (gpsWasAvailable && this.state.navigationActive) {
      this.playVoiceClip('gps_lost').catch(() => {});
    }
  }

  startLocationWatch() {
    if (!navigator.geolocation || this.locationWatchId !== null) {
      return;
    }
    this.locationWatchId = navigator.geolocation.watchPosition(
      this.handlePositionUpdate,
      this.handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000
      }
    );
  }

  stopLocationWatch() {
    if (this.locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
  }

  async locateUser() {
    if (!navigator.geolocation) {
      this.setState({
        locationStatus: 'error',
        locationMessage: 'Ta przeglądarka nie udostępnia lokalizacji.'
      });
      return;
    }

    this.setState({ locationStatus: 'locating', locationMessage: 'Ustalam Twoją pozycję…' });
    try {
      const position = await this.requestCurrentPosition();
      const userCoordinates = readPosition(position);
      this.setState({
        locationStatus: 'ready',
        locationMessage: `Dokładność około ${Math.round(userCoordinates.accuracy)} m`,
        userCoordinates,
        routeStatus: 'loading'
      });
      await this.calculateRoute(userCoordinates);
    } catch (error) {
      this.handlePositionError(error);
    }
  }

  selectTravelMode(travelMode) {
    if (travelMode === this.state.travelMode) {
      return;
    }
    this.setState({
      travelMode,
      route: null,
      routeManeuvers: null,
      routeSummary: null,
      routeAlternatives: [],
      selectedRouteIndex: 0,
      routeStatus: 'loading',
      routeMessage: ''
    }, this.calculateRoute);
  }

  toggleRoutePreference(featureId) {
    this.setState((state) => ({
      avoidedFeatures: state.avoidedFeatures.includes(featureId)
        ? state.avoidedFeatures.filter((item) => item !== featureId)
        : [...state.avoidedFeatures, featureId],
      routeAlternatives: [],
      selectedRouteIndex: 0,
      routeStatus: 'loading',
      routeMessage: ''
    }), this.calculateRoute);
  }

  selectRouteAlternative(selectedRouteIndex) {
    const routeOption = this.state.routeAlternatives[selectedRouteIndex];
    if (!routeOption || selectedRouteIndex === this.state.selectedRouteIndex) {
      return;
    }
    this.setState((state) => ({
      route: routeOption.route,
      routeManeuvers: routeOption.routeManeuvers,
      routeSummary: routeOption.summary,
      selectedRouteIndex,
      destination: {
        ...state.destination,
        time: formatDuration(routeOption.summary.duration),
        distance: formatDistance(routeOption.summary.distance)
      }
    }));
  }

  adjustMapZoom(delta) {
    this.setState((state) => ({
      mapZoom: Math.min(1.3, Math.max(0.85, Number((state.mapZoom + delta).toFixed(2))))
    }));
  }

  resetMapView() {
    this.setState({ mapZoom: 1 });
  }

  async fetchPois(categoryId) {
    if (!categoryId) return;
    this.setState({ poiCategory: categoryId, poiResults: [], poiStatus: 'loading' });
    try {
      const bbox = '20.85,52.10,21.30,52.40';
      const response = await fetch(`/api/pois?category=${categoryId}&bbox=${encodeURIComponent(bbox)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Nie udało się pobrać miejsc.');
      }
      const pois = (payload.features || []).map((feature) => {
        const props = feature.properties || {};
        return {
          id: props.osm_id || props.id || `${feature.geometry.coordinates.join('-')}`,
          name: props.name || 'Miejsce',
          address: [props.street, props.housenumber].filter(Boolean).join(' ') || props.locality || '',
          coordinates: feature.geometry.coordinates,
          distance: props.distance || 0,
          category: props.category_ids?.[0] || categoryId
        };
      });
      this.setState({ poiResults: pois, poiStatus: 'ready', poiMessage: '' });
    } catch (error) {
      this.setState({ poiStatus: 'error', poiMessage: error.message });
    }
  }

  async handleMapClick(coordinates) {
    if (this.state.navigationActive || this.state.tripComplete) {
      return;
    }
    this.setState({
      clickedLocation: coordinates,
      clickedLocationName: '',
      clickedLocationStatus: 'loading'
    });
    try {
      const response = await fetch(
        `/api/reverse-geocode?lat=${coordinates[1]}&lng=${coordinates[0]}`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error();
      const feature = payload.features?.[0];
      const name = feature?.properties?.name || feature?.properties?.label || 'Wybrane miejsce';
      this.setState({ clickedLocationName: name, clickedLocationStatus: 'ready' });
    } catch {
      this.setState({ clickedLocationName: 'Wybrane miejsce', clickedLocationStatus: 'ready' });
    }
  }

  confirmMapLocation() {
    const { clickedLocation, clickedLocationName } = this.state;
    if (!clickedLocation) return;
    const destination = {
      id: `clicked-${clickedLocation.join('-')}`,
      name: clickedLocationName,
      address: `${clickedLocation[1].toFixed(5)}, ${clickedLocation[0].toFixed(5)}`,
      district: 'Wybrane na mapie',
      coordinates: clickedLocation,
      time: 'Wyznacz trasę',
      distance: '—',
      isSearchResult: true
    };
    this.setState({ clickedLocation: null, clickedLocationName: '', clickedLocationStatus: 'idle' });
    this.selectDestination(destination);
  }

  cancelMapClick() {
    this.setState({ clickedLocation: null, clickedLocationName: '', clickedLocationStatus: 'idle' });
  }

  selectPoiDestination(poi) {
    const destination = {
      id: `poi-${poi.id}`,
      name: poi.name,
      address: poi.address || 'Miejsce wyszukane',
      district: 'Warszawa',
      coordinates: poi.coordinates,
      time: 'Wyznacz trasę',
      distance: '—',
      isSearchResult: true
    };
    this.selectDestination(destination);
  }

  toggleMapStyle() {
    this.setState((state) => {
      const currentIndex = MAP_STYLE_LIST.indexOf(state.mapStyle);
      const nextIndex = (currentIndex + 1) % MAP_STYLE_LIST.length;
      return { mapStyle: MAP_STYLE_LIST[nextIndex] };
    });
  }

  async loadVoiceClips() {
    try {
      const storedClips = await readStoredVoiceClips();
      const voiceClips = storedClips.reduce((clips, storedClip) => {
        clips[storedClip.id] = {
          blob: storedClip.blob,
          url: window.URL.createObjectURL(storedClip.blob)
        };
        return clips;
      }, {});
      this.setState({ voiceClips });
    } catch (error) {
      this.setState({ voiceMessage: 'Nagrania będą dostępne po otwarciu aplikacji przez bezpieczne połączenie.' });
    }
  }

  openVoiceStudio() {
    this.setState({ voiceStudioOpen: true, voiceMessage: '', menuOpen: false }, () => {
      if (this.voiceCloseButton) {
        this.voiceCloseButton.focus();
      }
    });
  }

  focusDestinationSearch() {
    this.setState({ menuOpen: false, searchOpen: true }, () => {
      if (this.searchInput) {
        this.searchInput.focus();
      }
    });
  }

  returnToPlanner() {
    this.stopNavigation();
    this.setState({ menuOpen: false });
  }

  closeVoiceStudio() {
    if (this.state.recordingPhraseId) {
      this.stopVoiceRecording();
    }
    this.setState({ voiceStudioOpen: false });
  }

  releaseMediaStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  async startVoiceRecording(phraseId) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function'
      || typeof window.MediaRecorder !== 'function') {
      this.setState({ voiceMessage: 'Ta przeglądarka nie obsługuje nagrywania dźwięku.' });
      return;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordingChunks = [];
      this.mediaRecorder = new window.MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };
      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.recordingChunks, { type: mimeType });
        this.releaseMediaStream();

        if (blob.size === 0) {
          this.setState({ recordingPhraseId: null, voiceMessage: 'Nie udało się zapisać dźwięku. Spróbuj ponownie.' });
          return;
        }

        try {
          await persistVoiceClip(phraseId, blob);
          this.setState((state) => {
            const previousClip = state.voiceClips[phraseId];
            if (previousClip) {
              window.URL.revokeObjectURL(previousClip.url);
            }
            return {
              voiceClips: {
                ...state.voiceClips,
                [phraseId]: { blob, url: window.URL.createObjectURL(blob) }
              },
              recordingPhraseId: null,
              voiceMessage: 'Nagranie zapisane tylko na tym urządzeniu.'
            };
          });
        } catch (error) {
          this.setState({ recordingPhraseId: null, voiceMessage: 'Nie udało się zapisać nagrania lokalnie.' });
        }
      };
      this.mediaRecorder.start();
      this.setState({ recordingPhraseId: phraseId, voiceMessage: 'Nagrywanie trwa. Powiedz komunikat naturalnie.' });
    } catch (error) {
      this.releaseMediaStream();
      this.setState({ recordingPhraseId: null, voiceMessage: 'Dostęp do mikrofonu został zablokowany.' });
    }
  }

  stopVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      return;
    }
    this.releaseMediaStream();
    this.setState({ recordingPhraseId: null });
  }

  playVoiceClip(phraseId) {
    const playbackToken = this.voicePlaybackToken + 1;
    this.voicePlaybackToken = playbackToken;
    return this.playVoiceItem(phraseId, playbackToken);
  }

  playVoiceItem(phraseId, playbackToken) {
    const clip = this.state.voiceClips[phraseId];
    const audioUrl = clip?.url || getDefaultVoiceUrl(phraseId);

    this.stopCurrentAudio();
    this.currentAudio = new Audio(audioUrl);
    return new Promise((resolve, reject) => {
      const audio = this.currentAudio;
      const complete = () => {
        if (this.currentAudioCompletion === complete) {
          this.currentAudioCompletion = null;
        }
        resolve();
      };
      this.currentAudioCompletion = complete;
      audio.onended = complete;
      audio.onerror = () => {
        this.currentAudioCompletion = null;
        reject(new Error(`Voice clip ${phraseId} is unavailable.`));
      };
      if (playbackToken !== this.voicePlaybackToken) {
        this.currentAudioCompletion = null;
        resolve();
        return;
      }
      audio.play().catch(reject);
    });
  }

  async playVoiceSequence(phraseIds) {
    const playbackToken = this.voicePlaybackToken + 1;
    this.voicePlaybackToken = playbackToken;
    this.stopCurrentAudio();
    for (const phraseId of phraseIds.filter(Boolean)) {
      if (playbackToken !== this.voicePlaybackToken) {
        return;
      }
      await this.playVoiceItem(phraseId, playbackToken);
    }
  }

  stopCurrentAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if (this.currentAudioCompletion) {
      const complete = this.currentAudioCompletion;
      this.currentAudioCompletion = null;
      complete();
    }
  }

  async deleteVoiceClip(phraseId) {
    try {
      await removeVoiceClip(phraseId);
      this.setState((state) => {
        const clip = state.voiceClips[phraseId];
        if (clip) {
          window.URL.revokeObjectURL(clip.url);
        }
        const voiceClips = { ...state.voiceClips };
        delete voiceClips[phraseId];
        return { voiceClips, voiceMessage: 'Nagranie usunięte z tego urządzenia.' };
      });
    } catch (error) {
      this.setState({ voiceMessage: 'Nie udało się usunąć nagrania.' });
    }
  }

  announceInstruction(instruction, voiceId, distance = null) {
    const phraseIds = voiceId === 'arrive'
      ? [voiceId]
      : [getDistanceVoiceId(distance), voiceId];
    this.playVoiceSequence(phraseIds).catch(() => {
      this.setState({ voiceMessage: `Nie udało się odtworzyć komunikatu: ${instruction}` });
    });
  }

  getActiveManeuvers() {
    return this.state.routeManeuvers || MANEUVERS[this.state.destination.id] || MANEUVERS.park;
  }

  completeNavigation() {
    if (!this.state.navigationActive) {
      return;
    }
    this.stopLocationWatch();
    this.playVoiceClip('arrive').catch(() => {});
    this.setState({
      navigationActive: false,
      navigationPaused: false,
      stepIndex: Math.max(0, this.getActiveManeuvers().length - 1),
      routeProgress: 100,
      distanceToManeuver: 0,
      remainingDistance: 0,
      remainingDuration: 0,
      tripComplete: true
    });
  }

  async recalculateRoute(userCoordinates) {
    const now = Date.now();
    if (this.rerouteInProgress || !this.state.navigationActive
      || !navigator.onLine || now - this.lastRerouteAt < 30000) {
      return;
    }

    this.rerouteInProgress = true;
    this.lastRerouteAt = now;
    this.offRouteSince = null;
    const previousRoute = {
      route: this.state.route,
      routeManeuvers: this.state.routeManeuvers,
      routeSummary: this.state.routeSummary
    };
    this.setState({ routeStatus: 'loading', routeMessage: 'Zmieniam trasę…' });
    this.playVoiceClip('route_recalculating').catch(() => {});

    const routeResult = await this.calculateRoute(userCoordinates);
    if (routeResult && this.state.navigationActive) {
      this.announcedDistanceThresholds.clear();
      this.setState({
        route: routeResult.route,
        routeManeuvers: routeResult.routeManeuvers,
        routeSummary: routeResult.summary,
        routeStatus: 'ready',
        routeMessage: 'Trasa została zaktualizowana.',
        stepIndex: 0,
        routeProgress: 0,
        distanceToManeuver: routeResult.routeManeuvers[0]?.rawDistance ?? null,
        remainingDistance: routeResult.summary.distance,
        remainingDuration: routeResult.summary.duration
      }, () => {
        this.playVoiceClip('route_updated').catch(() => {});
        this.updateNavigationProgress(userCoordinates);
      });
    } else if (this.state.navigationActive) {
      this.setState({
        ...previousRoute,
        routeStatus: 'ready',
        routeMessage: 'Nie udało się zmienić trasy. Prowadzę po poprzedniej.'
      });
    }
    this.rerouteInProgress = false;
  }

  updateNavigationProgress(userCoordinates) {
    const routeCoordinates = this.state.route?.geometry?.coordinates || [];
    const maneuvers = this.state.routeManeuvers || [];
    if (routeCoordinates.length < 2 || maneuvers.length === 0) {
      return;
    }

    const userPoint = [userCoordinates.longitude, userCoordinates.latitude];
    const destinationDistance = distanceBetween(userPoint, this.state.destination.coordinates);
    const arrivalRadius = Math.max(25, Math.min(userCoordinates.accuracy || 25, 50));
    if (destinationDistance <= arrivalRadius) {
      this.completeNavigation();
      return;
    }

    const routePoint = findClosestRoutePoint(userCoordinates, routeCoordinates);
    if (!routePoint) {
      return;
    }
    const reliableAccuracy = Number.isFinite(userCoordinates.accuracy)
      ? userCoordinates.accuracy
      : 25;
    const offRouteThreshold = Math.max(45, Math.min(reliableAccuracy * 1.5, 100));
    if (reliableAccuracy <= 100 && routePoint.distance > offRouteThreshold) {
      if (this.offRouteSince === null) {
        this.offRouteSince = Date.now();
      }
      if (Date.now() - this.offRouteSince >= 6000) {
        this.recalculateRoute(userCoordinates);
      }
      return;
    }
    this.offRouteSince = null;

    const routeIndex = routePoint.segmentIndex + routePoint.fraction;
    let stepIndex = maneuvers.findIndex((maneuver) => maneuver.endIndex >= routeIndex);
    if (stepIndex < 0) {
      stepIndex = maneuvers.length - 1;
    }
    stepIndex = Math.max(this.state.stepIndex, stepIndex);

    const currentManeuver = maneuvers[stepIndex];
    const distanceToManeuver = measureRouteFromPoint(
      routeCoordinates,
      routePoint,
      currentManeuver.endIndex
    );
    const remainingDistance = measureRouteFromPoint(
      routeCoordinates,
      routePoint,
      routeCoordinates.length - 1
    );
    const totalDistance = this.state.routeSummary?.distance || remainingDistance;
    const totalDuration = this.state.routeSummary?.duration || 0;
    const remainingDuration = totalDistance > 0
      ? totalDuration * (remainingDistance / totalDistance)
      : 0;
    const routeProgress = totalDistance > 0
      ? Math.max(0, Math.min(100, Math.round((1 - (remainingDistance / totalDistance)) * 100)))
      : 0;
    const previousDistanceToManeuver = this.state.distanceToManeuver;
    const stepChanged = stepIndex !== this.state.stepIndex;
    const crossedThreshold = stepChanged || !Number.isFinite(previousDistanceToManeuver)
      ? null
      : [1000, 500, 200, 100, 50, 20]
        .filter((threshold) => (
          previousDistanceToManeuver > threshold
          && distanceToManeuver <= threshold
          && !this.announcedDistanceThresholds.has(threshold)
        ))
        .sort((first, second) => first - second)[0] ?? null;

    if (stepChanged) {
      this.announcedDistanceThresholds.clear();
    } else if (crossedThreshold !== null) {
      this.announcedDistanceThresholds.add(crossedThreshold);
    }

    this.setState({
      stepIndex,
      routeProgress,
      distanceToManeuver,
      remainingDistance,
      remainingDuration
    }, () => {
      if (stepChanged) {
        this.announceInstruction(
          currentManeuver.instruction,
          currentManeuver.voiceId || currentManeuver.type,
          distanceToManeuver
        );
      } else if (crossedThreshold !== null) {
        this.announceInstruction(
          currentManeuver.instruction,
          currentManeuver.voiceId || currentManeuver.type,
          crossedThreshold
        );
      }
    });
  }

  async startNavigation() {
    if (!navigator.geolocation) {
      this.setState({
        locationStatus: 'error',
        locationMessage: 'Ta przeglądarka nie udostępnia lokalizacji.'
      });
      return;
    }

    let userCoordinates = this.state.userCoordinates;
    let maneuvers = this.getActiveManeuvers();
    let routeSummary = this.state.routeSummary;
    if (!userCoordinates) {
      this.setState({ locationStatus: 'locating', locationMessage: 'Ustalam pozycję startową…' });
      try {
        const position = await this.requestCurrentPosition();
        userCoordinates = readPosition(position);
        this.setState({
          locationStatus: 'ready',
          locationMessage: `Dokładność około ${Math.round(userCoordinates.accuracy)} m`,
          userCoordinates
        });
        const routeResult = await this.calculateRoute(userCoordinates);
        if (!routeResult) {
          return;
        }
        maneuvers = routeResult.routeManeuvers;
        routeSummary = routeResult.summary;
      } catch (error) {
        this.handlePositionError(error);
        return;
      }
    }

    const firstManeuver = maneuvers[0];
    this.announcedDistanceThresholds.clear();
    this.offRouteSince = null;
    this.setState({
      navigationActive: true,
      navigationPaused: false,
      stepIndex: 0,
      routeProgress: 0,
      distanceToManeuver: maneuvers[0].rawDistance ?? null,
      remainingDistance: routeSummary?.distance ?? null,
      remainingDuration: routeSummary?.duration ?? null,
      tripComplete: false,
      searchOpen: false
    }, () => {
      this.announceInstruction(
        firstManeuver.instruction,
        firstManeuver.voiceId || firstManeuver.type,
        firstManeuver.rawDistance
      );
      this.startLocationWatch();
    });
  }

  toggleNavigationPause() {
    if (this.state.navigationPaused) {
      this.setState({ navigationPaused: false });
      return;
    }

    this.setState({ navigationPaused: true });
  }

  stopNavigation() {
    this.voicePlaybackToken += 1;
    this.stopCurrentAudio();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setState({
      navigationActive: false,
      navigationPaused: false,
      stepIndex: 0,
      routeProgress: 0,
      distanceToManeuver: null,
      remainingDistance: null,
      remainingDuration: null,
      tripComplete: false
    });
    this.offRouteSince = null;
    this.rerouteInProgress = false;
    this.stopLocationWatch();
  }

  renderPlannerFlow(query, recentDestinations, searchOpen) {
    return h('div', { className: 'sidebar-flow planner-flow' },
      h('section', { className: 'journey-panel' },
        h('p', { className: 'eyebrow' }, 'Nowa podróż'),
        h('h1', null, 'Dokąd jedziemy?'),
        h('p', { className: 'intro' }, 'Wybierz cel. Resztę poprowadzimy spokojnie — i Twoim głosem.'),
        h('div', { className: 'route-options', 'aria-label': 'Sposób i preferencje podróży' },
          h('div', { className: 'travel-mode-picker', role: 'group', 'aria-label': 'Sposób podróży' },
            TRAVEL_MODES.map((mode) => h('button', {
              className: `travel-mode${this.state.travelMode === mode.id ? ' is-active' : ''}`,
              key: mode.id,
              type: 'button',
              onClick: () => this.selectTravelMode(mode.id),
              'aria-pressed': this.state.travelMode === mode.id
            }, mode.label))
          ),
          h('div', { className: 'route-preferences' },
            ROUTE_PREFERENCES
              .filter((preference) => !preference.carOnly || this.state.travelMode === 'car')
              .map((preference) => {
                const avoided = this.state.avoidedFeatures.includes(preference.id);
                return h('button', {
                  className: `route-preference${avoided ? ' is-active' : ''}`,
                  key: preference.id,
                  type: 'button',
                  onClick: () => this.toggleRoutePreference(preference.id),
                  'aria-pressed': avoided
                }, `${avoided ? 'Omijaj' : 'Zezwalaj'}: ${preference.label.toLocaleLowerCase('pl')}`);
              })
          )
        ),
        h('div', { className: 'search-area' },
          h('label', { className: 'search-box' },
            h(Icon, { name: 'search', size: 21 }),
            h('input', {
              ref: (element) => { this.searchInput = element; },
              type: 'search',
              value: query,
              placeholder: 'Wpisz adres lub miejsce',
              'aria-label': 'Cel podróży',
              'aria-expanded': searchOpen,
              onFocus: () => this.setState({ searchOpen: true }),
              onChange: this.handleSearchChange
            }),
            h('kbd', null, '⌘ K')
          ),
          searchOpen ? this.renderSearchResults() : null
        ),
        h('button', {
          className: `location-button is-${this.state.locationStatus}`,
          type: 'button',
          onClick: this.locateUser,
          disabled: this.state.locationStatus === 'locating'
        },
          h(Icon, { name: 'location' }),
          h('span', null, this.state.locationStatus === 'locating'
            ? 'Ustalam lokalizację…'
            : this.state.locationStatus === 'ready' ? 'Lokalizacja ustawiona' : 'Użyj mojej lokalizacji')
        ),
        this.state.locationMessage
          ? h('p', {
            className: `location-message is-${this.state.locationStatus}`,
            role: 'status',
            'aria-live': 'polite'
          }, this.state.locationMessage)
          : null,
        this.state.routeAlternatives.length > 1
          ? h('div', { className: 'route-alternatives', 'aria-label': 'Warianty trasy' },
            h('span', { className: 'route-alternatives-label' }, 'Warianty trasy'),
            h('div', { className: 'route-alternative-list' },
              this.state.routeAlternatives.map((routeOption, index) => h('button', {
                className: `route-alternative${this.state.selectedRouteIndex === index ? ' is-active' : ''}`,
                key: index,
                type: 'button',
                onClick: () => this.selectRouteAlternative(index),
                'aria-pressed': this.state.selectedRouteIndex === index
              },
              h('strong', null, index === 0 ? 'Najszybsza' : `Trasa ${index + 1}`),
              h('small', null,
                `${formatDuration(routeOption.summary.duration)} · ${formatDistance(routeOption.summary.distance)}`)
              ))
            )
          )
          : null
      ),
      h('section', { className: 'recent-section' },
        h('div', { className: 'section-heading' },
          h('h2', null, 'Ostatnie miejsca'),
          h('button', {
            type: 'button',
            onClick: () => {
              writeStoredPlaces(PLACE_HISTORY_KEY, []);
              this.setState({ recentDestinations: [] });
            }
          }, 'Wyczyść')
        ),
        recentDestinations.length > 0
          ? recentDestinations.map((recentDestination) => h('button', {
            className: 'place-card',
            key: recentDestination.id,
            type: 'button',
            onClick: () => this.selectDestination(recentDestination)
          },
          h('span', { className: 'place-icon' }, h(Icon, { name: 'location', size: 18 })),
          h('span', { className: 'place-copy' },
            h('strong', null, recentDestination.name),
            h('small', null, recentDestination.address)
          ),
          h('button', {
            className: 'favorite-star',
            type: 'button',
            onClick: (event) => this.toggleFavorite(recentDestination, event),
            'aria-label': this.state.favoritePlaces.some((p) => p.id === recentDestination.id) ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'
          }, h(Icon, { name: 'star', size: 16 })),
          h(Icon, { name: 'arrow', size: 18 })
          ))
          : h('p', { className: 'empty-recent' }, 'Wybrane miejsca pojawią się tutaj.')
      ),
      this.state.favoritePlaces.length > 0
        ? h('section', { className: 'recent-section' },
          h('div', { className: 'section-heading' },
            h('h2', null, 'Ulubione'),
            h('button', {
              type: 'button',
              onClick: () => {
                writeStoredPlaces(FAVORITE_PLACES_KEY, []);
                this.setState({ favoritePlaces: [] });
              }
            }, 'Wyczyść')
          ),
          this.state.favoritePlaces.map((fav) => h('button', {
            className: 'place-card',
            key: fav.id,
            type: 'button',
            onClick: () => this.selectDestination(fav)
          },
          h('span', { className: 'place-icon' }, h(Icon, { name: 'star', size: 18 })),
          h('span', { className: 'place-copy' },
            h('strong', null, fav.name),
            h('small', null, fav.address)
          ),
          h('button', {
            className: 'favorite-star is-active',
            type: 'button',
            onClick: (event) => this.toggleFavorite(fav, event),
            'aria-label': 'Usuń z ulubionych'
          }, h(Icon, { name: 'star', size: 16 })),
          h(Icon, { name: 'arrow', size: 18 })
          ))
        )
        : null,
      h('section', { className: 'poi-section' },
        h('div', { className: 'section-heading' },
          h('h2', null, 'Miejsca w okolicy'),
          h('button', {
            type: 'button',
            onClick: () => this.setState({ poiCategory: null, poiResults: [], poiStatus: 'idle', poiMessage: '' })
          }, this.state.poiCategory ? 'Wyczyść' : '')
        ),
        h('div', { className: 'poi-grid' },
          POI_CATEGORIES.map((cat) => h('button', {
            className: `poi-chip${this.state.poiCategory === cat.id ? ' is-active' : ''}`,
            key: cat.id,
            type: 'button',
            onClick: () => this.state.poiCategory === cat.id
              ? this.setState({ poiCategory: null, poiResults: [], poiStatus: 'idle', poiMessage: '' })
              : this.fetchPois(cat.id)
          }, cat.label))
        ),
        this.state.poiStatus === 'loading'
          ? h('p', { className: 'poi-status' }, 'Szukam miejsc w Warszawie…')
          : this.state.poiStatus === 'error'
            ? h('p', { className: 'poi-status is-error' }, this.state.poiMessage || 'Nie udało się pobrać miejsc.')
            : this.state.poiResults.length > 0
              ? h('div', { className: 'poi-results' },
                this.state.poiResults.slice(0, 10).map((poi) => h('button', {
                  className: 'place-card',
                  key: poi.id,
                  type: 'button',
                  onClick: () => this.selectPoiDestination(poi)
                },
                h('span', { className: 'place-icon' }, h(Icon, { name: 'location', size: 18 })),
                h('span', { className: 'place-copy' },
                  h('strong', null, poi.name),
                  h('small', null, poi.address || 'Warszawa')
                ),
                h(Icon, { name: 'arrow', size: 18 })
                ))
              )
              : this.state.poiCategory
                ? h('p', { className: 'poi-status' }, 'Brak miejsc w tej kategorii.')
                : null
      )
    );
  }

  renderNavigationFlow(destination, maneuvers, currentManeuver) {
    const progress = this.state.tripComplete ? 100 : this.state.routeProgress;
    const visibleManeuvers = maneuvers.slice(this.state.stepIndex, this.state.stepIndex + 3);

    return h('div', { className: 'sidebar-flow navigation-flow' },
      h('section', { className: 'navigation-overview' },
        h('p', { className: 'eyebrow' }, this.state.tripComplete
          ? 'Podróż zakończona'
          : this.state.navigationPaused ? 'Nawigacja wstrzymana' : 'Nawigacja aktywna'),
        h('h1', { className: 'navigation-title' }, this.state.tripComplete ? 'Jesteś na miejscu.' : 'Jedziemy.'),
        h('p', { className: 'intro' }, this.state.tripComplete
          ? `Dotarłeś do: ${destination.name}.`
          : this.state.routeStatus === 'loading'
            ? 'Zjechano z trasy. Wyznaczam nowy przebieg…'
            : 'GPS śledzi Twoją pozycję i prowadzi po wyznaczonej trasie.'),
        h('div', { className: 'destination-card' },
          h('span', { className: 'destination-pin' }, h(Icon, { name: 'location', size: 19 })),
          h('span', { className: 'place-copy' },
            h('strong', null, destination.name),
            h('small', null, destination.address)
          )
        ),
        h('div', { className: 'trip-progress', 'aria-label': `Postęp podróży ${progress}%` },
          h('span', { style: { width: `${progress}%` } })
        )
      ),
      h('section', { className: 'maneuvers-section' },
        h('div', { className: 'section-heading' },
          h('h2', null, this.state.tripComplete ? 'Podsumowanie' : 'Dalsza trasa'),
          h('span', { className: 'step-counter' }, `${this.state.stepIndex + 1}/${maneuvers.length}`)
        ),
        this.state.tripComplete
          ? h('div', { className: 'arrival-note' },
            h('strong', null, 'Dobra robota.'),
            h('p', null, 'Możesz zakończyć nawigację i wybrać kolejne miejsce.')
          )
          : visibleManeuvers.map((maneuver, index) => h('div', {
            className: `maneuver-row${index === 0 ? ' is-current' : ''}`,
            key: `${maneuver.type}-${this.state.stepIndex + index}`
          },
          h('span', { className: 'maneuver-list-icon' }, h(Icon, { name: maneuver.type, size: 20 })),
          h('span', { className: 'maneuver-copy' },
            h('strong', null, maneuver.instruction),
            h('small', null, maneuver.distance)
          )
          )),
        !this.state.tripComplete
          ? h('p', { className: 'current-voice-line', 'aria-live': 'polite' },
            h(Icon, { name: 'mic', size: 15 }),
            h('span', null, `Teraz: ${currentManeuver.instruction}`)
          )
          : null
      )
    );
  }

  renderVoiceCard() {
    const clipCount = Object.keys(this.state.voiceClips).length;
    const maneuvers = this.getActiveManeuvers();
    const currentManeuver = maneuvers[Math.min(this.state.stepIndex, maneuvers.length - 1)];
    const customVoiceActive = this.state.navigationActive
      && Boolean(currentManeuver && this.state.voiceClips[currentManeuver.type]);
    const statusText = customVoiceActive
      ? 'Teraz odtwarzany jest Twój głos'
      : clipCount > 0
        ? `Głos gotowy · ${clipCount}/4 nagrane lokalnie`
        : 'Twój głos · 121 komunikatów gotowych';

    return h('button', {
      className: `voice-card${clipCount > 0 ? ' is-configured' : ''}`,
      type: 'button',
      onClick: this.openVoiceStudio,
      'aria-haspopup': 'dialog'
    },
      h('span', { className: 'voice-icon' }, h(Icon, { name: 'mic', size: 21 })),
      h('span', { className: 'voice-copy' },
        h('strong', null, 'Twój głos'),
        h('small', null, statusText)
      ),
      h('span', {
        className: 'status-dot',
        'aria-label': clipCount > 0 ? 'Głos częściowo skonfigurowany' : 'Nie skonfigurowano'
      })
    );
  }

  renderAppMenu(navigationMode) {
    if (!this.state.menuOpen) {
      return null;
    }

    return h('nav', { className: 'app-menu', 'aria-label': 'Menu aplikacji' },
      h('div', { className: 'app-menu-heading' },
        h('strong', null, 'MojaMapa'),
        h('small', null, 'Wersja demonstracyjna')
      ),
      h('button', { className: 'app-menu-item', type: 'button', onClick: this.openVoiceStudio },
        h('span', { className: 'menu-item-icon' }, h(Icon, { name: 'mic', size: 18 })),
        h('span', null,
          h('strong', null, 'Studio głosu'),
          h('small', null, 'Nagraj i odsłuchaj komunikaty')
        )
      ),
      navigationMode
        ? h('button', { className: 'app-menu-item', type: 'button', onClick: this.returnToPlanner },
          h('span', { className: 'menu-item-icon' }, h(Icon, { name: 'stop', size: 17 })),
          h('span', null,
            h('strong', null, 'Wróć do planowania'),
            h('small', null, 'Zakończ bieżącą symulację')
          )
        )
        : h('button', { className: 'app-menu-item', type: 'button', onClick: this.focusDestinationSearch },
          h('span', { className: 'menu-item-icon' }, h(Icon, { name: 'search', size: 18 })),
          h('span', null,
            h('strong', null, 'Wyszukaj miejsce'),
            h('small', null, 'Przejdź od razu do pola celu')
          )
        ),
      h('div', { className: 'app-menu-note' },
        h(Icon, { name: 'route', size: 15 }),
        h('span', null, 'Trasy i czasy są przykładowe. Nagrania pozostają na urządzeniu.')
      )
    );
  }

  renderVoiceStudio() {
    if (!this.state.voiceStudioOpen) {
      return null;
    }

    const clipCount = Object.keys(this.state.voiceClips).length;
    return h('div', {
      className: 'voice-studio-backdrop',
      role: 'presentation',
      onMouseDown: (event) => {
        if (event.target === event.currentTarget) {
          this.closeVoiceStudio();
        }
      }
    },
    h('section', {
      className: 'voice-studio-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'voice-studio-title',
      onMouseDown: (event) => event.stopPropagation()
    },
    h('header', { className: 'voice-studio-header' },
      h('div', null,
        h('p', { className: 'eyebrow' }, 'Prywatnie i lokalnie'),
        h('h2', { id: 'voice-studio-title' }, 'Studio głosu'),
        h('p', null, 'Nagraj krótkie wskazówki. Pliki pozostają wyłącznie w tej przeglądarce.')
      ),
      h('button', {
        ref: (element) => { this.voiceCloseButton = element; },
        className: 'studio-close-button',
        type: 'button',
        onClick: this.closeVoiceStudio,
        'aria-label': 'Zamknij studio głosu'
      }, h(Icon, { name: 'close', size: 20 }))
    ),
    h('div', { className: 'voice-studio-progress' },
      h('span', null, `${clipCount} z ${VOICE_PHRASES.length} gotowe`),
      h('div', { className: 'voice-progress-track', 'aria-hidden': true },
        h('span', { style: { width: `${(clipCount / VOICE_PHRASES.length) * 100}%` } })
      )
    ),
    h('div', { className: 'voice-phrase-list' },
      VOICE_PHRASES.map((phrase) => {
        const clipReady = Boolean(this.state.voiceClips[phrase.id]);
        const isRecording = this.state.recordingPhraseId === phrase.id;
        const recordingAnotherPhrase = Boolean(this.state.recordingPhraseId) && !isRecording;

        return h('article', {
          className: `voice-phrase-row${clipReady ? ' is-ready' : ''}${isRecording ? ' is-recording' : ''}`,
          key: phrase.id
        },
        h('span', { className: 'phrase-icon' }, h(Icon, { name: phrase.id, size: 21 })),
        h('span', { className: 'phrase-copy' },
          h('strong', null, phrase.label),
          h('small', null, isRecording ? 'Mów teraz…' : phrase.description)
        ),
        h('span', { className: 'phrase-actions' },
          h('button', {
            className: 'phrase-action-button',
            type: 'button',
            onClick: () => this.playVoiceClip(phrase.id).catch(() => {
              this.setState({ voiceMessage: 'Nie udało się odtworzyć nagrania.' });
            }),
            disabled: Boolean(this.state.recordingPhraseId),
            'aria-label': `Odtwórz: ${phrase.label}`
          }, h(Icon, { name: 'volume', size: 18 })),
          h('button', {
            className: `record-button${isRecording ? ' is-recording' : ''}`,
            type: 'button',
            onClick: () => isRecording
              ? this.stopVoiceRecording()
              : this.startVoiceRecording(phrase.id),
            disabled: recordingAnotherPhrase
          }, isRecording ? 'Zatrzymaj' : clipReady ? 'Nagraj ponownie' : 'Nagraj'),
          clipReady ? h('button', {
            className: 'phrase-action-button is-danger',
            type: 'button',
            onClick: () => this.deleteVoiceClip(phrase.id),
            disabled: Boolean(this.state.recordingPhraseId),
            'aria-label': `Usuń nagranie: ${phrase.label}`
          }, h(Icon, { name: 'trash', size: 17 })) : null
        ));
      })
    ),
    h('div', { className: 'voice-studio-footer' },
      h('p', { className: 'privacy-note' },
        h(Icon, { name: 'mic', size: 15 }),
        h('span', null, 'Nagrania nie są przesyłane na serwer i możesz je usunąć w każdej chwili.')
      ),
      h('p', { className: 'voice-message', role: 'status', 'aria-live': 'polite' },
        this.state.voiceMessage || 'Najlepiej nagrywać w cichym miejscu, trzymając telefon blisko.'
      ),
      h('button', { className: 'studio-done-button', type: 'button', onClick: this.closeVoiceStudio }, 'Gotowe')
    )
    ));
  }

  renderMapFooter(destination, maneuvers) {
    if (this.state.clickedLocation) {
      return h('div', { className: 'route-summary map-click-confirm' },
        h('div', null,
          h('span', { className: 'summary-label' }, this.state.clickedLocationStatus === 'loading'
            ? 'Sprawdzam miejsce…'
            : 'Kliknięto na mapie'),
          h('strong', null, this.state.clickedLocationStatus === 'loading'
            ? '…'
            : this.state.clickedLocationName),
          h('small', null, 'Wybierz poniżej, aby ustawić jako cel')
        ),
        h('div', { className: 'control-buttons' },
          h('button', {
            className: 'primary-button',
            type: 'button',
            onClick: () => this.confirmMapLocation(),
            disabled: this.state.clickedLocationStatus === 'loading'
          },
            h('span', null, 'Jedź tutaj'),
            h(Icon, { name: 'arrow', size: 17 })
          ),
          h('button', {
            className: 'secondary-control danger-control',
            type: 'button',
            onClick: () => this.cancelMapClick(),
            'aria-label': 'Anuluj'
          }, h(Icon, { name: 'close', size: 17 }))
        )
      );
    }

    if (this.state.tripComplete) {
      return h('div', { className: 'route-summary arrival-summary' },
        h('div', null,
          h('span', { className: 'summary-label' }, 'Podróż zakończona'),
          h('strong', null, destination.name),
          h('small', null, `${destination.distance} · dotarłeś do celu`)
        ),
        h('button', { className: 'primary-button', type: 'button', onClick: this.stopNavigation },
          h('span', null, 'Zakończ'),
          h(Icon, { name: 'stop', size: 17 })
        )
      );
    }

    if (this.state.navigationActive) {
      const remainingDuration = this.state.remainingDuration;
      const remainingDistance = this.state.remainingDistance;
      return h('div', { className: 'route-summary navigation-controls' },
        h('div', null,
          h('span', { className: 'summary-label' }, this.state.navigationPaused ? 'Nawigacja wstrzymana' : 'W drodze'),
          h('strong', null, remainingDuration === null || remainingDistance === null
            ? 'Obliczam pozostały czas…'
            : `${formatDuration(remainingDuration)} · ${formatDistance(remainingDistance)}`),
          h('small', null, remainingDuration === null
            ? destination.name
            : `Przyjazd około ${formatArrivalTime(remainingDuration)} · ${destination.name}`)
        ),
        h('div', { className: 'control-buttons' },
          h('button', {
            className: 'secondary-control',
            type: 'button',
            onClick: this.toggleNavigationPause,
            'aria-label': this.state.navigationPaused ? 'Wznów nawigację' : 'Wstrzymaj nawigację'
          }, h(Icon, { name: this.state.navigationPaused ? 'play' : 'pause', size: 19 })),
          h('button', {
            className: 'secondary-control danger-control',
            type: 'button',
            onClick: this.stopNavigation,
            'aria-label': 'Zakończ nawigację'
          }, h(Icon, { name: 'stop', size: 17 }))
        )
      );
    }

    const travelModeLabel = TRAVEL_MODES
      .find((mode) => mode.id === this.state.travelMode)?.label.toLocaleLowerCase('pl') || 'trasa';
    const routeDescription = [
      travelModeLabel,
      this.state.avoidedFeatures.includes('tollways') && this.state.travelMode === 'car'
        ? 'bez dróg płatnych'
        : null,
      this.state.avoidedFeatures.includes('ferries') ? 'bez promów' : null
    ].filter(Boolean).join(' · ');

    return h('div', { className: 'route-summary' },
      h('div', null,
        h('span', { className: 'summary-label' }, destination.name),
        h('strong', null, this.state.routeStatus === 'loading' ? 'Wyznaczam…' : destination.time),
        h('small', null, this.state.routeStatus === 'error'
          ? this.state.routeMessage
          : `${destination.distance} · ${routeDescription}`)
      ),
      h('button', {
        className: 'primary-button',
        type: 'button',
        onClick: this.startNavigation,
        disabled: this.state.routeStatus !== 'ready'
      },
        h('span', null, 'Rozpocznij'),
        h(Icon, { name: 'arrow', size: 18 })
      )
    );
  }

  renderSearchResults() {
    const normalizedQuery = this.state.query.trim().toLocaleLowerCase('pl');
    const localMatches = DESTINATIONS.filter((destination) => {
      if (!normalizedQuery) {
        return true;
      }
      return `${destination.name} ${destination.address} ${destination.district}`
        .toLocaleLowerCase('pl')
        .includes(normalizedQuery);
    });
    const waitingForRemoteResults = normalizedQuery.length >= 3
      && this.state.searchStatus === 'loading';
    const matches = normalizedQuery.length >= 3 && this.state.searchStatus === 'ready'
      ? this.state.searchResults
      : localMatches;

    return h('div', { className: 'search-results', role: 'listbox', 'aria-label': 'Podpowiedzi miejsc' },
      h('div', { className: 'search-results-label' },
        normalizedQuery ? 'Wyniki wyszukiwania' : 'Popularne w pobliżu'),
      waitingForRemoteResults
        ? h('p', { className: 'empty-results', role: 'status' }, 'Szukam miejsc…')
        : this.state.searchStatus === 'error'
          ? h('p', { className: 'empty-results is-error', role: 'status' }, this.state.searchMessage)
          : matches.length > 0
        ? matches.map((destination) => h('button', {
          className: 'search-result',
          key: destination.id,
          type: 'button',
          role: 'option',
          onMouseDown: (event) => event.preventDefault(),
          onClick: () => this.selectDestination(destination)
        },
        h('span', { className: 'place-icon' }, h(Icon, { name: 'location', size: 18 })),
        h('span', { className: 'place-copy' },
          h('strong', null, destination.name),
          h('small', null, `${destination.address} · ${destination.district}`)
        ),
        h('span', { className: 'result-time' }, destination.isSearchResult ? 'Wybierz' : destination.time)
        ))
            : h('p', { className: 'empty-results' }, this.state.searchMessage || 'Nie znaleźliśmy takiego miejsca.')
    );
  }

  render() {
    const {
      destination,
      query,
      recentDestinations,
      searchOpen,
      navigationActive,
      stepIndex,
      tripComplete,
      locationStatus,
      gpsSignal,
      networkOnline,
      userCoordinates,
      route,
      routeManeuvers,
      distanceToManeuver,
      mapZoom,
      menuOpen
    } = this.state;
    const maneuvers = routeManeuvers || MANEUVERS[destination.id] || MANEUVERS.park;
    const baseManeuver = maneuvers[Math.min(stepIndex, maneuvers.length - 1)];
    const currentManeuver = navigationActive && distanceToManeuver !== null
      ? { ...baseManeuver, distance: formatDistance(distanceToManeuver) }
      : baseManeuver;
    const navigationMode = navigationActive || tripComplete;
    const navigationNotice = !networkOnline
      ? {
        icon: 'route',
        text: 'Brak internetu — nowa trasa będzie dostępna po odzyskaniu połączenia.'
      }
      : gpsSignal === 'lost'
        ? { icon: 'location', text: 'Brak sygnału GPS — próbuję odzyskać pozycję.' }
        : gpsSignal === 'weak'
          ? { icon: 'location', text: 'Słaby sygnał GPS — pozycja może być niedokładna.' }
          : null;

    return h('main', { className: `app-shell${navigationMode ? ' is-navigating' : ''}` },
      h('aside', { className: 'sidebar' },
        h('header', { className: 'brand-row' },
          h('a', { className: 'brand', href: '#', 'aria-label': 'MojaMapa — strona główna' },
            h('span', { className: 'brand-mark' }, h(Icon, { name: 'route', size: 23 })),
            h('span', null, 'MojaMapa')
          ),
          h('div', {
            className: 'menu-container',
            ref: (element) => { this.menuContainer = element; }
          },
          h('button', {
            className: `icon-button${menuOpen ? ' is-active' : ''}`,
            type: 'button',
            onClick: () => this.setState({ menuOpen: !menuOpen }),
            'aria-label': menuOpen ? 'Zamknij menu' : 'Otwórz menu',
            'aria-expanded': menuOpen
          }, h(Icon, { name: menuOpen ? 'close' : 'menu' })),
          this.renderAppMenu(navigationMode)
          )
        ),
        navigationMode
          ? this.renderNavigationFlow(destination, maneuvers, currentManeuver)
          : this.renderPlannerFlow(query, recentDestinations, searchOpen),
        this.renderVoiceCard()
      ),
      h('section', { className: 'map-region' },
        h(MapCanvas, {
          destination,
          navigationActive,
          currentManeuver,
          tripComplete,
          locationStatus,
          navigationNotice: navigationActive ? navigationNotice : null,
          userCoordinates,
          route,
          mapZoom,
          mapStyle: this.state.mapStyle,
          poiResults: this.state.poiResults,
          onZoomIn: () => this.adjustMapZoom(0.15),
          onZoomOut: () => this.adjustMapZoom(-0.15),
          onResetMap: this.resetMapView,
          onMapStyleChange: this.toggleMapStyle,
          onPoiSelect: (poi) => this.selectPoiDestination(poi),
          onMapClick: this.handleMapClick,
          clickedLocation: this.state.clickedLocation
        }),
        this.renderMapFooter(destination, maneuvers)
      ),
      this.renderVoiceStudio()
    );
  }

}

ReactDOM.render(h(App), document.getElementById('root'));
