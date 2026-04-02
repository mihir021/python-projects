const CACHE_NAME = 'music-pwa-v2';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/style.css',
    './assets/js/app.js',
    './assets/js/player.js',
    './assets/js/playlist.js',
    './assets/js/ui.js',
    './assets/icons/default-cover.png',
    './assets/icons/icon-192x192.png',
    './assets/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
];

// Install event: cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event: network first, fallback to cache
// For songs/audio, we want to skip caching completely or implement range requests.
// For now, only cache the shell and use network only for audio
self.addEventListener('fetch', event => {
    // Exclude audio files from standard cache strategy due to range request issues
    if (event.request.url.includes('.mp3') || event.request.url.includes('.wav') || event.request.headers.get('range')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Network request if not cached
                return fetch(event.request).then(response => {
                    // Check if received a valid response
                    if(!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Cache the fetched response for future
                    // Clone because response is a stream and can only be consumed once
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                }).catch(() => {
                    // Fallbacks for offline when network fails
                    // e.g., if page navigation, return index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});
