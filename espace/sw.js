// Service worker de l'espace Vos Racines : réseau d'abord, cache en secours (rend l'espace installable).
const CACHE = 'vr-espace-v4';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/espace/')) return;
  if (/apiKey=|oobCode=/.test(u.search)) return;
  e.respondWith(fetch(r).then(rep => {
    if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(ca => ca.put(r, c)); }
    return rep;
  }).catch(() => caches.match(r).then(m => m || caches.match('/espace/'))));
});
