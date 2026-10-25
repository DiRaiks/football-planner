// Service worker of the installed app (PWA). Hashed assets come from the cache; pages
// and the match list come from the network, and from the cache when offline.
const VERSION = 'v1';
const SHELL = `fp-shell-${VERSION}`;
const ASSETS = 'fp-assets';
// Cleared by the page on logout (src/lib/pwa.ts)
const API = 'fp-api';
const SHELL_FILES = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('fp-shell-') && key !== SHELL)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** The network, saving the answer; the saved answer when the network fails */
const networkFirst = async (request, cacheName, cacheKey = request) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
};

const cacheFirst = async (request) => {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Every page is the same index.html of the single-page app
    event.respondWith(networkFirst(request, SHELL, '/'));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (
    url.pathname.startsWith('/v1/events') ||
    url.pathname === '/v1/auth/me'
  ) {
    event.respondWith(networkFirst(request, API));
  }
});
