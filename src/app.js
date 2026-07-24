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
    endpoint: [1095, 171]
  },
  {
    id: 'park',
    name: 'Park Skaryszewski',
    address: 'Aleja Zieleniecka, Warszawa',
    district: 'Praga-Południe',
    time: '24 min',
    distance: '8,4 km',
    routePath: 'M175 625C305 570 410 600 510 545s172-130 290-70 190 160 320 135',
    endpoint: [1120, 610]
  },
  {
    id: 'library',
    name: 'Biblioteka Uniwersytecka',
    address: 'Dobra 56/66, Warszawa',
    district: 'Powiśle',
    time: '15 min',
    distance: '4,3 km',
    routePath: 'M175 625C295 535 355 420 490 410s195 15 285-75 120-155 210-185',
    endpoint: [985, 150]
  },
  {
    id: 'station',
    name: 'Warszawa Centralna',
    address: 'Aleje Jerozolimskie 54, Warszawa',
    district: 'Śródmieście',
    time: '12 min',
    distance: '3,6 km',
    routePath: 'M175 625C280 555 315 470 430 445s200 25 305-45 125-110 205-95',
    endpoint: [940, 305]
  }
];

function Icon({ name, size = 20 }) {
  const icons = {
    arrow: h('path', { d: 'M5 12h14M13 6l6 6-6 6' }),
    compass: h('g', null,
      h('circle', { cx: 12, cy: 12, r: 9 }),
      h('path', { d: 'm15.4 8.6-2.2 4.6-4.6 2.2 2.2-4.6 4.6-2.2Z' })
    ),
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
    search: h('g', null,
      h('circle', { cx: 11, cy: 11, r: 7 }),
      h('path', { d: 'm20 20-4-4' })
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

function MapCanvas({ destination }) {
  const routePath = destination.routePath;
  const endpoint = destination.endpoint;

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
      h('g', { transform: 'translate(175 625)' },
        h('circle', { r: 20, fill: '#ffffff', opacity: 0.92 }),
        h('circle', { r: 10, fill: '#2d6cf6' }),
        h('circle', { r: 4, fill: '#ffffff' })
      ),
      h('g', { transform: `translate(${endpoint[0]} ${endpoint[1]})` },
        h('path', { d: 'M0-28C-17-28-28-16-28 0c0 22 28 47 28 47S28 22 28 0C28-16 17-28 0-28Z', fill: '#172234' }),
        h('circle', { r: 8, fill: '#fff' })
      )
    ),
    h('div', { className: 'map-toolbar' },
      h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Wyśrodkuj mapę' }, h(Icon, { name: 'compass' })),
      h('div', { className: 'zoom-group' },
        h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Powiększ mapę' }, '+'),
        h('button', { className: 'map-tool', type: 'button', 'aria-label': 'Pomniejsz mapę' }, '−')
      )
    ),
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
      recentDestinationIds: ['museum', 'park']
    };
    this.searchInput = null;
    this.handleGlobalShortcut = this.handleGlobalShortcut.bind(this);
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleGlobalShortcut);
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.handleGlobalShortcut);
  }

  handleGlobalShortcut(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput.focus();
      this.setState({ searchOpen: true });
    }

    if (event.key === 'Escape') {
      this.setState({ searchOpen: false });
      this.searchInput.blur();
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
    const { destination, query, recentDestinationIds, searchOpen } = this.state;
    const recentDestinations = recentDestinationIds
      .map((id) => DESTINATIONS.find((item) => item.id === id))
      .filter(Boolean);

    return h('main', { className: 'app-shell' },
    h('aside', { className: 'sidebar' },
      h('header', { className: 'brand-row' },
        h('a', { className: 'brand', href: '#', 'aria-label': 'MojaMapa — strona główna' },
          h('span', { className: 'brand-mark' }, h(Icon, { name: 'route', size: 23 })),
          h('span', null, 'MojaMapa')
        ),
        h('button', { className: 'icon-button', type: 'button', 'aria-label': 'Otwórz menu' }, h(Icon, { name: 'menu' }))
      ),
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
        h('button', { className: 'location-button', type: 'button' },
          h(Icon, { name: 'location' }),
          h('span', null, 'Użyj mojej lokalizacji')
        )
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
      ),
      h('footer', { className: 'voice-card' },
        h('span', { className: 'voice-icon' }, h(Icon, { name: 'mic', size: 21 })),
        h('span', { className: 'voice-copy' },
          h('strong', null, 'Twój głos'),
          h('small', null, 'Studio nagrań jest gotowe do konfiguracji')
        ),
        h('span', { className: 'status-dot', 'aria-label': 'Nie skonfigurowano' })
      )
    ),
    h('section', { className: 'map-region' },
      h(MapCanvas, { destination }),
      h('div', { className: 'route-summary' },
        h('div', null,
          h('span', { className: 'summary-label' }, destination.name),
          h('strong', null, destination.time),
          h('small', null, `${destination.distance} · bez opłat`)
        ),
        h('button', { className: 'primary-button', type: 'button' },
          h('span', null, 'Rozpocznij'),
          h(Icon, { name: 'arrow', size: 18 })
        )
      )
    )
    );
  }
}

ReactDOM.render(h(App), document.getElementById('root'));
