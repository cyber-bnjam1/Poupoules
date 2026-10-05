const VERSION = '1.1.0';
const CACHE = `poupoules-v${VERSION}`;
const ASSETS = ['./', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icon.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
});

// Réseau d'abord pour les fichiers de l'app, cache en secours hors ligne.
// Les requêtes Firebase / Google ne passent pas par le cache.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(response => {
        if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
        return response;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(c => c || caches.match('./index.html')))
  );
});
