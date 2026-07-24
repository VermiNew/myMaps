'use strict';

const h = React.createElement;

const DESTINATIONS = [
  {
    id: 'museum',
    name: 'Muzeum Narodowe',
    address: 'Aleje Jerozolimskie 3, Warszawa',
    district: 'Śródmieście',
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

const VOICE_DATABASE_NAME = 'mojamapa-voice';
const VOICE_STORE_NAME = 'clips';

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

function MapCanvas({ destination, navigationActive, stepIndex, currentManeuver, tripComplete, locationStatus }) {
  const routePath = destination.routePath;
  const endpoint = destination.endpoint;
  const currentPoint = destination.navigationPoints[Math.min(stepIndex, destination.navigationPoints.length - 1)];

  return h('div', { className: 'map-canvas', 'aria-label': 'Mapa demonstracyjna Warszawy' },
    h('svg', { className: 'map-art', viewBox: '0 0 1200 800', role: 'img', 'aria-label': 'Stylizowana mapa ulic' },
      h('defs', null,
        h('pattern', { id: 'minor-grid', width: 52, height: 52, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(16)' },
          h('path', { d: 'M 52 0 L 0 0 0 52', fill: 'none', stroke: '#d9d7d0', strokeWidth: 1 })
        ),
        h('filter', { id: 'route-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' },
          h('feDropShadow', { dx: 0, dy: 5, stdDeviation: 7, floodColor: '#101827', floodOpacity: 0.22 })
        )
      ),
      h('rect', { width: 1200, height: 800, fill: '#eceae3' }),
      h('rect', { width: 1200, height: 800, fill: 'url(#minor-grid)', opacity: 0.58 }),
      h('path', { className: 'river', d: 'M-40 690C160 560 180 420 360 340S680 290 720 120 980-20 1260 80' }),
      h('g', { className: 'parks' },
        h('path', { d: 'M70 90h230l35 140-70 90-205-44Z' }),
        h('path', { d: 'M800 470l290-50 90 180-180 150-210-85Z' }),
        h('path', { d: 'M430 500l180-20 45 145-90 110-170-45Z' })
      ),
      h('g', { className: 'roads roads-major' },
        h('path', { d: 'M-40 600C220 520 270 355 530 370s390 145 720 20' }),
        h('path', { d: 'M230-30c25 210 90 330 270 450s235 185 260 410' }),
        h('path', { d: 'M810-40c-80 180-110 290-30 410s210 190 390 250' })
      ),
      h('g', { className: 'roads roads-local' },
        h('path', { d: 'M30 180c260 70 405 20 610-105' }),
        h('path', { d: 'M70 730c230-160 440-135 650-10' }),
        h('path', { d: 'M340 40c-45 170-30 330 65 520' }),
        h('path', { d: 'M610 20c25 170 10 310-85 480' }),
        h('path', { d: 'M920 100c-90 150-115 300-70 460' }),
        h('path', { d: 'M1020 250c-220 15-385 130-500 340' })
      ),
      h('path', { className: 'route-line-back', d: routePath, filter: 'url(#route-shadow)' }),
      h('path', { className: 'route-line', d: routePath }),
      h('g', { className: 'map-labels' },
        h('text', { x: 115, y: 150 }, 'Żoliborz'),
        h('text', { x: 475, y: 285 }, 'Śródmieście'),
        h('text', { x: 880, y: 350 }, 'Praga-Północ'),
        h('text', { x: 770, y: 690 }, 'Saska Kępa')
      ),
      h('g', {
        className: `start-marker${locationStatus === 'ready' ? ' is-located' : ''}`,
        transform: 'translate(175 625)'
      },
        h('circle', { r: 20, fill: '#ffffff', opacity: 0.92 }),
        h('circle', { r: 10, fill: '#2d6cf6' }),
        h('circle', { r: 4, fill: '#ffffff' })
      ),
      h('g', { transform: `translate(${endpoint[0]} ${endpoint[1]})` },
        h('path', { d: 'M0-28C-17-28-28-16-28 0c0 22 28 47 28 47S28 22 28 0C28-16 17-28 0-28Z', fill: '#172234' }),
        h('circle', { r: 8, fill: '#fff' })
      ),
      navigationActive || tripComplete
        ? h('g', {
          className: 'navigation-marker',
          transform: `translate(${currentPoint[0]} ${currentPoint[1]})`
        },
        h('circle', { r: 25, fill: '#ffffff', opacity: 0.92 }),
        h('circle', { r: 17, fill: tripComplete ? '#1f8a5b' : '#2d6cf6' }),
        h('path', { d: 'M0-9 7 8 0 5-7 8Z', fill: '#ffffff' })
        )
        : null
    ),
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
      h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Wyśrodkuj mapę' }, h(Icon, { name: 'compass' })),
      h('div', { className: 'zoom-group' },
        h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Powiększ mapę' }, '+'),
        h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Pomniejsz mapę' }, '−')
      )
    ),
    locationStatus === 'ready' && !navigationActive && !tripComplete
      ? h('div', { className: 'location-confirmation' },
        h(Icon, { name: 'location', size: 15 }),
        h('span', null, 'Twoja lokalizacja')
      )
      : null,
    h('div', { className: 'map-credit' }, 'Mapa demonstracyjna · dane przykładowe')
  );
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      destination: DESTINATIONS[1],
      query: '',
      searchOpen: false,
      recentDestinationIds: ['museum', 'park'],
      navigationActive: false,
      navigationPaused: false,
      stepIndex: 0,
      tripComplete: false,
      voiceStudioOpen: false,
      voiceClips: {},
      recordingPhraseId: null,
      voiceMessage: '',
      locationStatus: 'idle',
      locationMessage: '',
      userCoordinates: null
    };
    this.searchInput = null;
    this.voiceCloseButton = null;
    this.navigationTimer = null;
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordingChunks = [];
    this.currentAudio = null;
    this.handleGlobalShortcut = this.handleGlobalShortcut.bind(this);
    this.advanceNavigation = this.advanceNavigation.bind(this);
    this.closeVoiceStudio = this.closeVoiceStudio.bind(this);
    this.deleteVoiceClip = this.deleteVoiceClip.bind(this);
    this.openVoiceStudio = this.openVoiceStudio.bind(this);
    this.playVoiceClip = this.playVoiceClip.bind(this);
    this.locateUser = this.locateUser.bind(this);
    this.startNavigation = this.startNavigation.bind(this);
    this.startVoiceRecording = this.startVoiceRecording.bind(this);
    this.stopVoiceRecording = this.stopVoiceRecording.bind(this);
    this.stopNavigation = this.stopNavigation.bind(this);
    this.toggleNavigationPause = this.toggleNavigationPause.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleGlobalShortcut);
    this.loadVoiceClips();
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleGlobalShortcut);
    window.clearInterval(this.navigationTimer);
    this.releaseMediaStream();
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
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

    if (event.key === 'Escape') {
      this.setState({ searchOpen: false });
      if (this.searchInput) {
        this.searchInput.blur();
      }
    }
  }

  selectDestination(destination) {
    this.setState((state) => ({
      destination,
      query: destination.name,
      searchOpen: false,
      recentDestinationIds: [
        destination.id,
        ...state.recentDestinationIds.filter((id) => id !== destination.id)
      ].slice(0, 3)
    }));
  }

  locateUser() {
    if (!navigator.geolocation) {
      this.setState({
        locationStatus: 'error',
        locationMessage: 'Ta przeglądarka nie udostępnia lokalizacji.'
      });
      return;
    }

    this.setState({ locationStatus: 'locating', locationMessage: 'Ustalam Twoją pozycję…' });
    navigator.geolocation.getCurrentPosition((position) => {
      this.setState({
        locationStatus: 'ready',
        locationMessage: `Dokładność około ${Math.round(position.coords.accuracy)} m · trasa demonstracyjna`,
        userCoordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      });
    }, (error) => {
      const permissionDenied = error && error.code === 1;
      this.setState({
        locationStatus: 'error',
        locationMessage: permissionDenied
          ? 'Nie przyznano dostępu do lokalizacji.'
          : 'Nie udało się ustalić pozycji. Spróbuj ponownie.'
      });
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
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
    this.setState({ voiceStudioOpen: true, voiceMessage: '' }, () => {
      if (this.voiceCloseButton) {
        this.voiceCloseButton.focus();
      }
    });
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
    const clip = this.state.voiceClips[phraseId];
    if (!clip) {
      return Promise.reject(new Error('Voice clip is unavailable.'));
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentAudio = new Audio(clip.url);
    return this.currentAudio.play();
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

  speakWithSystem(instruction) {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      return;
    }

    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(instruction);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  announceInstruction(instruction, type) {
    if (this.state.voiceClips[type]) {
      this.playVoiceClip(type).catch(() => this.speakWithSystem(instruction));
      return;
    }
    this.speakWithSystem(instruction);
  }

  scheduleNavigationStep() {
    window.clearInterval(this.navigationTimer);
    this.navigationTimer = window.setInterval(this.advanceNavigation, 5000);
  }

  startNavigation() {
    const firstManeuver = MANEUVERS[this.state.destination.id][0];
    this.setState({
      navigationActive: true,
      navigationPaused: false,
      stepIndex: 0,
      tripComplete: false,
      searchOpen: false
    }, () => {
      this.announceInstruction(firstManeuver.instruction, firstManeuver.type);
      this.scheduleNavigationStep();
    });
  }

  advanceNavigation() {
    const maneuvers = MANEUVERS[this.state.destination.id];
    const nextIndex = this.state.stepIndex + 1;

    if (nextIndex >= maneuvers.length) {
      window.clearInterval(this.navigationTimer);
      this.setState({ navigationActive: false, tripComplete: true });
      return;
    }

    this.setState({ stepIndex: nextIndex }, () => {
      this.announceInstruction(maneuvers[nextIndex].instruction, maneuvers[nextIndex].type);
      if (!this.state.navigationPaused) {
        this.scheduleNavigationStep();
      }
    });
  }

  toggleNavigationPause() {
    if (this.state.navigationPaused) {
      this.setState({ navigationPaused: false }, () => this.scheduleNavigationStep());
      return;
    }

    window.clearInterval(this.navigationTimer);
    this.setState({ navigationPaused: true });
  }

  stopNavigation() {
    window.clearInterval(this.navigationTimer);
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setState({
      navigationActive: false,
      navigationPaused: false,
      stepIndex: 0,
      tripComplete: false
    });
  }

  renderPlannerFlow(query, recentDestinations, searchOpen) {
    return h('div', { className: 'sidebar-flow planner-flow' },
      h('section', { className: 'journey-panel' },
        h('p', { className: 'eyebrow' }, 'Nowa podróż'),
        h('h1', null, 'Dokąd jedziemy?'),
        h('p', { className: 'intro' }, 'Wybierz cel. Resztę poprowadzimy spokojnie — i Twoim głosem.'),
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
              onChange: (event) => this.setState({ query: event.target.value, searchOpen: true })
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
          : null
      ),
      h('section', { className: 'recent-section' },
        h('div', { className: 'section-heading' },
          h('h2', null, 'Ostatnie miejsca'),
          h('button', {
            type: 'button',
            onClick: () => this.setState({ recentDestinationIds: [] })
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
          h(Icon, { name: 'arrow', size: 18 })
          ))
          : h('p', { className: 'empty-recent' }, 'Wybrane miejsca pojawią się tutaj.')
      )
    );
  }

  renderNavigationFlow(destination, maneuvers, currentManeuver) {
    const progress = Math.round((this.state.stepIndex / (maneuvers.length - 1)) * 100);
    const visibleManeuvers = maneuvers.slice(this.state.stepIndex, this.state.stepIndex + 3);

    return h('div', { className: 'sidebar-flow navigation-flow' },
      h('section', { className: 'navigation-overview' },
        h('p', { className: 'eyebrow' }, this.state.tripComplete
          ? 'Podróż zakończona'
          : this.state.navigationPaused ? 'Nawigacja wstrzymana' : 'Nawigacja aktywna'),
        h('h1', { className: 'navigation-title' }, this.state.tripComplete ? 'Jesteś na miejscu.' : 'Jedziemy.'),
        h('p', { className: 'intro' }, this.state.tripComplete
          ? `Dotarłeś do: ${destination.name}.`
          : 'Symulacja prowadzi po trasie i odczytuje kolejne wskazówki.'),
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
    const maneuvers = MANEUVERS[this.state.destination.id];
    const currentManeuver = maneuvers[Math.min(this.state.stepIndex, maneuvers.length - 1)];
    const customVoiceActive = this.state.navigationActive && Boolean(this.state.voiceClips[currentManeuver.type]);
    const statusText = customVoiceActive
      ? 'Teraz odtwarzany jest Twój głos'
      : clipCount > 0
        ? `${clipCount}/4 ${clipCount === 1 ? 'nagranie gotowe' : 'nagrania gotowe'}`
        : 'Nagraj cztery podstawowe komunikaty';

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
      h('span', null, `${clipCount} z 4 gotowe`),
      h('div', { className: 'voice-progress-track', 'aria-hidden': true },
        h('span', { style: { width: `${clipCount * 25}%` } })
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
          clipReady ? h('button', {
            className: 'phrase-action-button',
            type: 'button',
            onClick: () => this.playVoiceClip(phrase.id).catch(() => {
              this.setState({ voiceMessage: 'Nie udało się odtworzyć nagrania.' });
            }),
            disabled: Boolean(this.state.recordingPhraseId),
            'aria-label': `Odtwórz: ${phrase.label}`
          }, h(Icon, { name: 'volume', size: 18 })) : null,
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
    if (this.state.tripComplete) {
      return h('div', { className: 'route-summary arrival-summary' },
        h('div', null,
          h('span', { className: 'summary-label' }, 'Podróż zakończona'),
          h('strong', null, destination.name),
          h('small', null, `${destination.distance} · trasa demonstracyjna`)
        ),
        h('button', { className: 'primary-button', type: 'button', onClick: this.stopNavigation },
          h('span', null, 'Zakończ'),
          h(Icon, { name: 'stop', size: 17 })
        )
      );
    }

    if (this.state.navigationActive) {
      const remainingSteps = maneuvers.length - this.state.stepIndex - 1;
      return h('div', { className: 'route-summary navigation-controls' },
        h('div', null,
          h('span', { className: 'summary-label' }, this.state.navigationPaused ? 'Nawigacja wstrzymana' : 'W drodze'),
          h('strong', null, remainingSteps === 0 ? 'Ostatni manewr' : `${remainingSteps} manewry`),
          h('small', null, destination.name)
        ),
        h('div', { className: 'control-buttons' },
          h('button', {
            className: 'secondary-control',
            type: 'button',
            onClick: this.toggleNavigationPause,
            'aria-label': this.state.navigationPaused ? 'Wznów nawigację' : 'Wstrzymaj nawigację'
          }, h(Icon, { name: this.state.navigationPaused ? 'play' : 'pause', size: 19 })),
          h('button', { className: 'next-control', type: 'button', onClick: this.advanceNavigation },
            h('span', null, 'Następny'),
            h(Icon, { name: 'arrow', size: 17 })
          ),
          h('button', {
            className: 'secondary-control danger-control',
            type: 'button',
            onClick: this.stopNavigation,
            'aria-label': 'Zakończ nawigację'
          }, h(Icon, { name: 'stop', size: 17 }))
        )
      );
    }

    return h('div', { className: 'route-summary' },
      h('div', null,
        h('span', { className: 'summary-label' }, destination.name),
        h('strong', null, destination.time),
        h('small', null, `${destination.distance} · bez opłat`)
      ),
      h('button', { className: 'primary-button', type: 'button', onClick: this.startNavigation },
        h('span', null, 'Rozpocznij'),
        h(Icon, { name: 'arrow', size: 18 })
      )
    );
  }

  renderSearchResults() {
    const normalizedQuery = this.state.query.trim().toLocaleLowerCase('pl');
    const matches = DESTINATIONS.filter((destination) => {
      if (!normalizedQuery) {
        return true;
      }
      return `${destination.name} ${destination.address} ${destination.district}`
        .toLocaleLowerCase('pl')
        .includes(normalizedQuery);
    });

    return h('div', { className: 'search-results', role: 'listbox', 'aria-label': 'Podpowiedzi miejsc' },
      h('div', { className: 'search-results-label' }, normalizedQuery ? 'Najlepsze dopasowania' : 'Popularne w pobliżu'),
      matches.length > 0
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
        h('span', { className: 'result-time' }, destination.time)
        ))
        : h('p', { className: 'empty-results' }, 'Nie znaleźliśmy takiego miejsca w wersji demonstracyjnej.')
    );
  }

  render() {
    const {
      destination,
      query,
      recentDestinationIds,
      searchOpen,
      navigationActive,
      stepIndex,
      tripComplete,
      locationStatus
    } = this.state;
    const recentDestinations = recentDestinationIds
      .map((id) => DESTINATIONS.find((item) => item.id === id))
      .filter(Boolean);
    const maneuvers = MANEUVERS[destination.id];
    const currentManeuver = maneuvers[Math.min(stepIndex, maneuvers.length - 1)];
    const navigationMode = navigationActive || tripComplete;

    return h('main', { className: `app-shell${navigationMode ? ' is-navigating' : ''}` },
      h('aside', { className: 'sidebar' },
        h('header', { className: 'brand-row' },
          h('a', { className: 'brand', href: '#', 'aria-label': 'MojaMapa — strona główna' },
            h('span', { className: 'brand-mark' }, h(Icon, { name: 'route', size: 23 })),
            h('span', null, 'MojaMapa')
          ),
          h('button', { className: 'icon-button', type: 'button', 'aria-label': 'Otwórz menu' }, h(Icon, { name: 'menu' }))
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
          stepIndex,
          currentManeuver,
          tripComplete,
          locationStatus
        }),
        this.renderMapFooter(destination, maneuvers)
      ),
      this.renderVoiceStudio()
    );
  }

}

ReactDOM.render(h(App), document.getElementById('root'));
