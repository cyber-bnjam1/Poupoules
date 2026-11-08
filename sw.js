const VERSION = '3.0.0';
const CACHE = `poupoules-v${VERSION}`;
const ASSETS = ['./', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icon.png'];
const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('poupoules-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // SDK Firebase : cache d'abord (versionné dans l'URL), pour démarrer hors ligne.
  if (request.url.startsWith(FIREBASE_CDN)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
      return response;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Fichiers de l'app : réseau d'abord, cache en secours.
  event.respondWith(fetch(request).then(response => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('./index.html'))));
});
