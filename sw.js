// sw.js — Service Worker Poupoules
// Incrémente CACHE_VERSION à chaque déploiement pour déclencher la popup de mise à jour
const CACHE_VERSION = 'poupoules-v7';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './extensions.js',
    './stats.js',
    './style.css',
    './manifest.json',
    './icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js',
];

// Installation : mise en cache de tous les assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    // Ne pas attendre l'ancien SW — sera activé après skipWaiting explicite
});

// Activation : suppression des anciens caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE_VERSION; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch : cache-first, fallback réseau
self.addEventListener('fetch', function(event) {
    // On ne cache pas les requêtes Firebase/Google
    if (event.request.url.includes('firestore') ||
        event.request.url.includes('googleapis') ||
        event.request.url.includes('gstatic') ||
        event.request.url.includes('firebase')) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            return cached || fetch(event.request).then(function(response) {
                // Mettre en cache les nouvelles ressources valides
                if (response && response.status === 200 && response.type === 'basic') {
                    var clone = response.clone();
                    caches.open(CACHE_VERSION).then(function(cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        }).catch(function() {
            // Offline : retourner index.html pour la navigation
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});

// Message SKIP_WAITING : déclenché par applyUpdate()
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
