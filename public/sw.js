/**
 * Laya (లయ) — Mobile Service Worker for Offline Habit Caching & PWA Support
 */

const CACHE_NAME = 'laya-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/css/style.css',
  '/css/tokens.css',
  '/css/reset.css',
  '/css/navbar.css',
  '/css/layout.css',
  '/css/cards.css',
  '/css/controls.css',
  '/css/forms.css',
  '/css/modals.css',
  '/css/metrics.css',
  '/css/charts.css',
  '/js/main.js',
  '/js/core/api.js',
  '/js/core/state.js',
  '/js/components/header-shell.js',
  '/js/components/group-tabs.js',
  '/js/components/task-card.js',
  '/js/components/task-modal.js',
  '/js/components/chart-block.js',
  '/js/components/chart-svg.js',
  '/js/components/system-modals.js',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass API requests directly to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Network-first with cache fallback for static app assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});
