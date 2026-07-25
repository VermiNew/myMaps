'use strict';

const CACHE_NAME = 'mojamapa-v4';
const VOICE_CATALOG_URL = './audio/default-voice/catalog.json';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './src/styles.css',
  './src/bootstrap.mjs',
  './src/app.js',
  './vendor/maplibre-gl.css',
  './vendor/maplibre-gl.mjs',
  './vendor/maplibre-gl-shared.mjs',
  './vendor/maplibre-gl-worker.mjs',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js'
];

async function cacheVoiceLibrary(cache) {
  const catalogResponse = await fetch(VOICE_CATALOG_URL);
  if (!catalogResponse.ok) {
    throw new Error('Voice catalog is unavailable.');
  }
  const catalog = await catalogResponse.clone().json();
  await cache.put(VOICE_CATALOG_URL, catalogResponse);
  await cache.addAll(
    catalog.clips.map((clip) => `./audio/default-voice/${clip.file}`)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(CORE_ASSETS);
        await cacheVoiceLibrary(cache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => cachedResponse || fetch(event.request)
        .then((networkResponse) => {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          return networkResponse;
        }))
      .catch(() => caches.match('./index.html'))
  );
});
