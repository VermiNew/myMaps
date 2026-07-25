import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiKey = process.env.FISH_AUDIO_API_KEY;
const referenceId = process.env.FISH_AUDIO_REFERENCE_ID;
const model = process.env.FISH_AUDIO_MODEL || 's2.1-pro-free';
const root = fileURLToPath(new URL('..', import.meta.url));
const outputDirectory = join(root, 'public', 'audio', 'default-voice');
const overwrite = process.argv.includes('--overwrite');
const onlyId = process.argv.find((argument) => argument.startsWith('--only='))?.split('=')[1];
const onlyCategory = process.argv.find((argument) => argument.startsWith('--category='))?.split('=')[1];

if (!apiKey || !referenceId) {
  throw new Error('Set FISH_AUDIO_API_KEY and FISH_AUDIO_REFERENCE_ID before running this script.');
}

const phrases = [
  { id: 'straight', category: 'maneuver', text: 'Jedź prosto.' },
  { id: 'left', category: 'maneuver', text: 'Skręć w lewo.' },
  { id: 'right', category: 'maneuver', text: 'Skręć w prawo.' },
  { id: 'arrive', category: 'arrival', text: 'Jesteś na miejscu.' },
  { id: 'turn_slight_left', category: 'maneuver', text: 'Skręć łagodnie w lewo.' },
  { id: 'turn_slight_right', category: 'maneuver', text: 'Skręć łagodnie w prawo.' },
  { id: 'turn_sharp_left', category: 'maneuver', text: 'Skręć ostro w lewo.' },
  { id: 'turn_sharp_right', category: 'maneuver', text: 'Skręć ostro w prawo.' },
  { id: 'keep_left', category: 'maneuver', text: 'Trzymaj się lewej strony.' },
  { id: 'keep_right', category: 'maneuver', text: 'Trzymaj się prawej strony.' },
  { id: 'change_lane_left', category: 'maneuver', text: 'Zmień pas na lewy.' },
  { id: 'change_lane_right', category: 'maneuver', text: 'Zmień pas na prawy.' },
  { id: 'merge_left', category: 'maneuver', text: 'Włącz się do ruchu z lewej strony.' },
  { id: 'merge_right', category: 'maneuver', text: 'Włącz się do ruchu z prawej strony.' },
  { id: 'take_ramp_left', category: 'maneuver', text: 'Wjedź na zjazd po lewej stronie.' },
  { id: 'take_ramp_right', category: 'maneuver', text: 'Wjedź na zjazd po prawej stronie.' },
  { id: 'exit_left', category: 'maneuver', text: 'Zjedź w lewo.' },
  { id: 'exit_right', category: 'maneuver', text: 'Zjedź w prawo.' },
  { id: 'exit_now', category: 'maneuver', text: 'Zjedź teraz.' },
  { id: 'u_turn', category: 'maneuver', text: 'Zawróć.' },
  { id: 'u_turn_when_possible', category: 'maneuver', text: 'Zawróć, gdy będzie to możliwe.' },
  { id: 'continue_road', category: 'maneuver', text: 'Kontynuuj jazdę tą drogą.' },
  { id: 'follow_road', category: 'maneuver', text: 'Jedź dalej zgodnie z przebiegiem drogi.' },
  { id: 'follow_signs', category: 'maneuver', text: 'Jedź zgodnie ze znakami.' },
  { id: 'stay_lane', category: 'maneuver', text: 'Pozostań na obecnym pasie.' },
  { id: 'then_left', category: 'sequence', text: 'Następnie skręć w lewo.' },
  { id: 'then_right', category: 'sequence', text: 'Następnie skręć w prawo.' },
  { id: 'then_straight', category: 'sequence', text: 'Następnie jedź prosto.' },
  { id: 'then_u_turn', category: 'sequence', text: 'Następnie zawróć.' },
  { id: 'prepare_left', category: 'sequence', text: 'Przygotuj się do skrętu w lewo.' },
  { id: 'prepare_right', category: 'sequence', text: 'Przygotuj się do skrętu w prawo.' },
  { id: 'prepare_u_turn', category: 'sequence', text: 'Przygotuj się do zawrócenia.' },
  { id: 'roundabout_enter', category: 'roundabout', text: 'Wjedź na rondo.' },
  { id: 'roundabout_straight', category: 'roundabout', text: 'Na rondzie jedź prosto.' },
  { id: 'roundabout_left', category: 'roundabout', text: 'Na rondzie skręć w lewo.' },
  { id: 'roundabout_right', category: 'roundabout', text: 'Na rondzie skręć w prawo.' },
  { id: 'roundabout_leave', category: 'roundabout', text: 'Opuść rondo.' },
  ...[
    ['first', 'pierwszy'],
    ['second', 'drugi'],
    ['third', 'trzeci'],
    ['fourth', 'czwarty'],
    ['fifth', 'piąty'],
    ['sixth', 'szósty'],
    ['seventh', 'siódmy'],
    ['eighth', 'ósmy'],
    ['ninth', 'dziewiąty'],
    ['tenth', 'dziesiąty'],
    ['eleventh', 'jedenasty'],
    ['twelfth', 'dwunasty']
  ].map(([id, ordinal]) => ({
    id: `roundabout_exit_${id}`,
    category: 'roundabout',
    text: `Na rondzie wybierz ${ordinal} zjazd.`
  })),
  ...[
    ['north', 'północ'],
    ['north_east', 'północny wschód'],
    ['east', 'wschód'],
    ['south_east', 'południowy wschód'],
    ['south', 'południe'],
    ['south_west', 'południowy zachód'],
    ['west', 'zachód'],
    ['north_west', 'północny zachód']
  ].map(([id, direction]) => ({
    id: `head_${id}`,
    category: 'direction',
    text: `Kieruj się na ${direction}.`
  })),
  ...[
    ['10_m', 'dziesięć metrów'],
    ['20_m', 'dwadzieścia metrów'],
    ['30_m', 'trzydzieści metrów'],
    ['40_m', 'czterdzieści metrów'],
    ['50_m', 'pięćdziesiąt metrów'],
    ['60_m', 'sześćdziesiąt metrów'],
    ['70_m', 'siedemdziesiąt metrów'],
    ['80_m', 'osiemdziesiąt metrów'],
    ['90_m', 'dziewięćdziesiąt metrów'],
    ['100_m', 'sto metrów'],
    ['150_m', 'sto pięćdziesiąt metrów'],
    ['200_m', 'dwieście metrów'],
    ['300_m', 'trzysta metrów'],
    ['400_m', 'czterysta metrów'],
    ['500_m', 'pięćset metrów'],
    ['600_m', 'sześćset metrów'],
    ['700_m', 'siedemset metrów'],
    ['800_m', 'osiemset metrów'],
    ['900_m', 'dziewięćset metrów'],
    ['1_km', 'jeden kilometr'],
    ['1_5_km', 'półtora kilometra'],
    ['2_km', 'dwa kilometry'],
    ['3_km', 'trzy kilometry'],
    ['5_km', 'pięć kilometrów'],
    ['10_km', 'dziesięć kilometrów']
  ].map(([id, distance]) => ({
    id: `in_${id}`,
    category: 'distance',
    text: `Za ${distance}.`
  })),
  { id: 'destination_ahead', category: 'arrival', text: 'Miejsce docelowe jest przed Tobą.' },
  { id: 'destination_left', category: 'arrival', text: 'Miejsce docelowe będzie po lewej stronie.' },
  { id: 'destination_right', category: 'arrival', text: 'Miejsce docelowe będzie po prawej stronie.' },
  { id: 'destination_reached', category: 'arrival', text: 'Dotarłeś do miejsca docelowego.' },
  { id: 'internet_lost', category: 'status', text: 'Utracono połączenie z internetem.' },
  { id: 'internet_restored', category: 'status', text: 'Połączenie z internetem zostało przywrócone.' },
  { id: 'offline_mode', category: 'status', text: 'Korzystasz teraz z danych zapisanych offline.' },
  { id: 'gps_lost', category: 'status', text: 'Brak zasięgu Gie Pe Es.' },
  { id: 'gps_weak', category: 'status', text: 'Sygnał Gie Pe Es jest słaby.' },
  { id: 'gps_restored', category: 'status', text: 'Sygnał Gie Pe Es został przywrócony.' },
  { id: 'location_permission_needed', category: 'status', text: 'Włącz dostęp do lokalizacji, aby rozpocząć nawigację.' },
  { id: 'route_calculating', category: 'route', text: 'Wyznaczam trasę.' },
  { id: 'route_ready', category: 'route', text: 'Trasa jest gotowa.' },
  { id: 'route_recalculating', category: 'route', text: 'Zmieniam trasę.' },
  { id: 'route_updated', category: 'route', text: 'Trasa została zaktualizowana.' },
  { id: 'better_route_found', category: 'route', text: 'Znaleziono szybszą trasę.' },
  { id: 'route_unavailable', category: 'route', text: 'Nie udało się wyznaczyć trasy.' },
  { id: 'eta_updated', category: 'route', text: 'Godzina przyjazdu została zaktualizowana.' },
  { id: 'navigation_started', category: 'route', text: 'Rozpoczynam nawigację.' },
  { id: 'navigation_paused', category: 'route', text: 'Nawigacja została wstrzymana.' },
  { id: 'navigation_resumed', category: 'route', text: 'Nawigacja została wznowiona.' },
  { id: 'navigation_ended', category: 'route', text: 'Nawigacja została zakończona.' },
  { id: 'slow_down', category: 'safety', text: 'Zwolnij.' },
  { id: 'speed_limit', category: 'safety', text: 'Uwaga, zmiana ograniczenia prędkości.' },
  { id: 'speed_exceeded', category: 'safety', text: 'Przekraczasz dozwoloną prędkość.' },
  { id: 'traffic_ahead', category: 'safety', text: 'Przed Tobą utrudnienia w ruchu.' },
  { id: 'congestion_ahead', category: 'safety', text: 'Przed Tobą korek.' },
  { id: 'accident_ahead', category: 'safety', text: 'Przed Tobą wypadek.' },
  { id: 'roadworks_ahead', category: 'safety', text: 'Przed Tobą roboty drogowe.' },
  { id: 'hazard_ahead', category: 'safety', text: 'Uwaga, niebezpieczeństwo na drodze.' },
  { id: 'road_closed', category: 'safety', text: 'Droga przed Tobą jest zamknięta.' },
  { id: 'railway_crossing', category: 'safety', text: 'Zbliżasz się do przejazdu kolejowego.' },
  { id: 'school_zone', category: 'safety', text: 'Uwaga, strefa szkolna.' },
  { id: 'tunnel_ahead', category: 'safety', text: 'Wjedź do tunelu.' },
  { id: 'ferry_ahead', category: 'safety', text: 'Wjedź na prom.' },
  { id: 'toll_road', category: 'safety', text: 'Wjeżdżasz na drogę płatną.' },
  { id: 'border_crossing', category: 'safety', text: 'Zbliżasz się do przejścia granicznego.' },
  { id: 'battery_low', category: 'status', text: 'Poziom baterii jest niski.' },
  { id: 'search_unavailable', category: 'status', text: 'Wyszukiwanie miejsc jest chwilowo niedostępne.' }
];

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function generatePhrase(phrase) {
  const outputPath = join(outputDirectory, `${phrase.id}.mp3`);
  if (!overwrite && await fileExists(outputPath)) {
    console.log(`skip ${phrase.id}`);
    return 'skipped';
  }

  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model
    },
    body: JSON.stringify({
      text: `[calm] ${phrase.text}`,
      reference_id: referenceId,
      format: 'mp3'
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Fish Audio rejected ${phrase.id} (${response.status}): ${details}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length < 1024) {
    throw new Error(`Generated audio for ${phrase.id} is unexpectedly small.`);
  }
  await writeFile(outputPath, audio);
  console.log(`generated ${phrase.id} (${audio.length} bytes)`);
  return 'generated';
}

await mkdir(outputDirectory, { recursive: true });
let generated = 0;
let skipped = 0;
const selectedPhrases = phrases.filter((phrase) => (
  (!onlyId || phrase.id === onlyId)
  && (!onlyCategory || phrase.category === onlyCategory)
));
if (selectedPhrases.length === 0) {
  throw new Error('No phrases match the requested selection.');
}
for (const phrase of selectedPhrases) {
  const result = await generatePhrase(phrase);
  if (result === 'generated') generated += 1;
  if (result === 'skipped') skipped += 1;
}

const availablePhrases = [];
for (const phrase of phrases) {
  if (await fileExists(join(outputDirectory, `${phrase.id}.mp3`))) {
    availablePhrases.push(phrase);
  }
}
const catalogPath = join(outputDirectory, 'catalog.json');
await writeFile(catalogPath, `${JSON.stringify({
  version: 1,
  model,
  clips: availablePhrases.map((phrase) => ({
    ...phrase,
    file: `${phrase.id}.mp3`
  }))
}, null, 2)}\n`);

console.log(`Voice catalog ready: ${generated} generated, ${skipped} skipped.`);
