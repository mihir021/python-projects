// Service Worker for Pulse Player PWA
const CACHE_NAME = 'pulse-player-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/app.js',
  './assets/js/player.js',
  './assets/js/playlist.js',
  './assets/js/ui.js',
  './assets/icons/icon-72.png',
  './assets/icons/icon-96.png',
  './assets/icons/icon-120.png',
  './assets/icons/icon-128.png',
  './assets/icons/icon-144.png',
  './assets/icons/icon-152.png',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/covers/dreams.png',
  './assets/covers/skyline.png',
  './assets/covers/love-dose.png',
  './assets/covers/desi-kalakaar.png',
  './assets/covers/i-wanna-be-yours.svg',
  './assets/covers/believer.png',
  './assets/covers/blue-eyes.png',
  './data/songs.json'
];

const AUDIO_CACHE = 'pulse-audio-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);

      try {
        const response = await fetch('./data/songs.json');
        const songs = await response.clone().json();
        const audioFiles = (songs || []).map((song) => song.file).filter(Boolean);
        if (audioFiles.length) {
          const audioCache = await caches.open(AUDIO_CACHE);
          await audioCache.addAll(audioFiles);
        }
      } catch (error) {
        // Skip audio pre-cache if offline during install.
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (requestUrl.pathname.endsWith('.mp3') || event.request.destination === 'audio') {
    event.respondWith(cacheFirst(event.request, AUDIO_CACHE));
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    return cached || cache.match('./index.html');
  }
}
