// Versioned app-shell SW. 1.0.1+202610102136 is stamped by scripts/build.mjs. Prompted update flow (no unconditional skipWaiting).
const VERSION = '1.0.1+202610102136';
const CACHE = 'tt-' + VERSION;
const SHELL = ['./', 'index.html', 'app.js', 'tokens.css', 'app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('tt-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
// Same-origin GET: cache-first for the versioned shell (instant at 3am, immune to lie-fi); network for everything else.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate') { e.respondWith(caches.match('./').then((r) => r || fetch(e.request))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
// Classic push fallback (send Declarative Web Push payloads from the server where supported).
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Reminder' }; }
  const n = d.notification || d; // accepts declarative-shaped payloads too
  e.waitUntil(self.registration.showNotification(n.title || 'Reminder', { body: n.body || '', tag: n.tag || 'reminder', data: { url: n.navigate || (n.data && n.data.url) || './' }, icon: 'icons/icon-192.png' }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) { if ('navigate' in c) { await c.focus(); return c.navigate(url); } }
    return self.clients.openWindow(url);
  })());
});
