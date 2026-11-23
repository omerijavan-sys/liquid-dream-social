const CACHE_NAME = 'primegram-v4';
const urlsToCache = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Always live: the update check and server endpoints. Range requests (media seeking) are left to the network.
  if (url.pathname === '/version.json' || url.pathname.startsWith('/api/') || request.headers.has('range')) return;

  // Page loads: network first, but when offline serve the last cached app shell so the UI still opens.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            void caches.open(CACHE_NAME).then(cache => cache.put('/', response.clone()));
          }
          return response;
        })
        .catch(async () => (await caches.match('/', { cacheName: CACHE_NAME })) || Response.error())
    );
    return;
  }

  // Scripts, styles, fonts, images: serve from cache instantly and refresh in the background, so the app
  // boots offline after it has been opened once. Failures never throw into the page.
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then(response => {
          if (response.ok && response.type === 'basic') void cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const senderId = data.senderId;
  let path = data.url || '/';
  if (senderId && event.action === 'reply') {
    path = `/messages?to=${encodeURIComponent(senderId)}`;
  } else if (senderId && event.action === 'ai-reply') {
    path = `/messages?to=${encodeURIComponent(senderId)}&aiReply=1`;
  }
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) { try { await w.navigate(target); } catch (e) { /* ignore */ } }
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const senderId = typeof data.senderId === 'string' ? data.senderId : undefined;
  event.waitUntil(self.registration.showNotification(data.title || 'Primegram', {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { url: data.url || '/', senderId },
    actions: senderId ? [
      { action: 'reply', title: 'Reply' },
      { action: 'ai-reply', title: 'AI reply' },
    ] : [],
  }));
});
