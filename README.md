# MojaMapa

MojaMapa to dopracowany prototyp nawigacji działającej w przeglądarce. Pozwala wybrać przykładowy cel, przejść przez symulowaną trasę i zastąpić komunikaty systemowe krótkimi nagraniami własnego głosu.

## Co działa

- wyszukiwanie i wybór jednego z przykładowych miejsc,
- dynamiczna trasa, czas przejazdu i lista manewrów,
- sterowana symulacja nawigacji: start, pauza, następny manewr i zakończenie,
- polskie komunikaty systemowe jako bezpieczny fallback,
- lokalne studio czterech podstawowych nagrań głosowych,
- przechowywanie nagrań w IndexedDB bez wysyłania ich na serwer,
- obsługa lokalizacji z czytelnym stanem zgody lub błędu,
- powiększanie, pomniejszanie i reset widoku mapy,
- responsywny interfejs na komputer i telefon,
- manifest PWA i pamięć podręczna offline.

## Ważne ograniczenie

Mapa, miejsca, czasy i przebieg tras są danymi demonstracyjnymi. Projekt nie korzysta jeszcze z aktualnych danych drogowych ani silnika wyznaczania tras. Interfejs i przepływ są kompletne jako samodzielny prototyp produktu, ale nie należy używać go do realnej nawigacji drogowej.

## Wymagania

- Node.js `26.x`
- nowoczesna przeglądarka oparta na Chromium, Firefox lub Safari

Mikrofon, geolokalizacja i instalacja PWA wymagają uruchomienia przez `localhost` albo HTTPS. Nie otwieraj `index.html` bezpośrednio jako pliku.

## Uruchomienie

Projekt nie wymaga instalowania paczek npm — potrzebne pliki przeglądarkowe znajdują się w katalogu `vendor/`.

```bash
npm run lint
npm run build
npm run preview
```

Następnie otwórz:

```text
http://127.0.0.1:4173
```

Podczas pracy możesz użyć:

```bash
npm run dev
```

Polecenie buduje aplikację i uruchamia lokalny serwer. Po zmianie plików uruchom je ponownie.

## Nagrania głosowe

1. Otwórz kartę **Twój głos** albo wybierz **Studio głosu** z menu.
2. Nagraj komunikaty dla jazdy prosto, skrętu w lewo, skrętu w prawo i dotarcia do celu.
3. Nagrania są zapisywane tylko w bieżącej przeglądarce.
4. Podczas symulacji aplikacja używa nagrania odpowiadającego rodzajowi manewru. Gdy go brakuje, używa polskiej syntezy systemowej.

Usunięcie danych witryny w przeglądarce usuwa również nagrania.

## Struktura

```text
public/      dokument HTML, manifest, ikona i service worker
src/         logika aplikacji i style
vendor/      lokalne pliki React i ReactDOM
scripts/     lint, build i prosty serwer podglądu
dist/        wynik polecenia npm run build
AGENTS.md    zasady pracy nad projektem
```

## Weryfikacja zmian

Każdy działający etap projektu był sprawdzany w tej kolejności:

```bash
npm run lint
npm run build
```

Następnie aplikacja była otwierana w Chromium przez Playwright i kontrolowana wizualnie na widoku desktopowym oraz mobilnym. Historia Git zachowuje każdy zweryfikowany etap jako osobny Conventional Commit.
