const CACHE_NAME = 'arntags-shell-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => {
              return (
                cacheName.startsWith(
                  'arntags-shell-',
                ) &&
                cacheName !== CACHE_NAME
              );
            })
            .map((cacheName) =>
              caches.delete(cacheName),
            ),
        ),
      ),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    }),
  );
});