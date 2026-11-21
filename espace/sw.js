// Service worker de l'espace Vos Racines : réseau d'abord, cache en secours (rend l'espace installable).
const CACHE = 'vr-espace-v16';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith('/espace/')) return;
  if (/apiKey=|oobCode=/.test(u.search)) return;
  // 18/11/2026 : toujours revalider auprès du serveur (sinon le cache HTTP de 10 min garde l'ancienne version de l'espace)
  const frais = r.mode === 'navigate' ? fetch(r.url, {cache: 'no-cache', credentials: 'same-origin'}) : fetch(r, {cache: 'no-cache'});
  e.respondWith(frais.then(rep => {
    if (rep.ok) { const c = rep.clone(); caches.open(CACHE).then(ca => ca.put(r, c)); }
    return rep;
  }).catch(() => caches.match(r).then(m => m || caches.match('/espace/'))));
});
// 18/11/2026 : notifications de l'application (envoyées par HQ, notifier.py) ; un clic ouvre l'espace à la bonne page.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = {titre: 'Vos Racines', corps: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Vos Racines', {body: d.corps || '', tag: d.tag, icon: '/espace/icones/icone-192.png', badge: '/espace/icones/badge-96.png', data: {url: d.url || '#admin'}}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const cible = new URL('/espace/' + (e.notification.data && e.notification.data.url || ''), self.location.origin).href;
  e.waitUntil(clients.matchAll({type: 'window', includeUncontrolled: true}).then(ws => {
    const w = ws.find(x => x.url.includes('/espace/')); if (w) { w.focus(); return w.navigate ? w.navigate(cible) : null; }
    return clients.openWindow(cible);
  }));
});
