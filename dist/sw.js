/* Shellback service worker — offline cache for the served edition.
 * Network-first: while the local server is running the newest build is always used (no
 * "one load behind" after an update); the cache answers only when the server is not reachable.
 * Successful responses refresh the cache so the offline copy tracks the latest build. */
const BUILD_ID = 'ca87604ad166';
const CACHE = `shellback-${BUILD_ID}`;
// activate deletes every other cache of this origin, including the pre-rename `synapse-<build>` ones.
const PRECACHE = ["./","./index.html","./assets/app.js","./assets/app.css"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
