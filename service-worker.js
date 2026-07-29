const ATLAS_CACHE = 'atlas-v2-1-0-oficial-shell-v3';
const ATLAS_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/v2.css',
  './js/v2.js',
  './config/config.js',
  './assets/vendor/lucide.min.js',
  './assets/vendor/supabase.min.js',
  './assets/vendor/xlsx.full.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(ATLAS_CACHE).then((cache) => cache.addAll(ATLAS_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('atlas-v2-') && key !== ATLAS_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isStatic = /\.(?:css|js|png|ico|webmanifest)$/.test(url.pathname);

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(ATLAS_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const update = fetch(request)
          .then((response) => {
            if (response.ok) caches.open(ATLAS_CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          })
          .catch(() => cached);
        return cached || update;
      }),
    );
  }
});
