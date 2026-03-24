// The Daily Athlete — Service Worker
// Minimal caching: only immutable static assets + offline fallback
// Page navigation and data requests are NEVER cached by the SW

const STATIC_CACHE = 'static-v3';
const OFFLINE_URL = '/offline.html';

// Pre-cache the offline fallback on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Clean up ALL old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // NEVER intercept API routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__/')) return;

  // Static assets with hashed filenames: cache-first (immutable)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation: network-only with offline fallback
  // NEVER cache page responses — let Next.js handle freshness
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Everything else (JS chunks, CSS, images): network-only
  // Don't cache or intercept — prevents stale responses after deploys
  // The browser's own HTTP cache handles this via Cache-Control headers
});

// ── Push Notifications ──

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const { title, body, url, icon } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'The Daily Athlete', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
