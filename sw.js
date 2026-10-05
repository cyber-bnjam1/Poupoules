const VERSION = '2.3.0';
const CACHE = `poupoules-v${VERSION}`;
const ASSETS = ['./', './index.html', './styles.css', './app.js', './firebase-config.js', './manifest.webmanifest', './icon.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage({ version: VERSION });
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => { if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone())); return response; }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || caches.match('./index.html'))));
});
