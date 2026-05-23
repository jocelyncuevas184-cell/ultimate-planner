// Ultimate Planner Service Worker v130
const CACHE = 'ultiplanner-v130';
const BASE = self.location.pathname.replace('/sw.js','').replace(/\/$/, '');

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => 
      c.addAll([BASE+'/', BASE+'/index.html', BASE+'/manifest.json', BASE+'/icon-192.png', BASE+'/icon-512.png'])
       .catch(()=>{})
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || 
      url.hostname.includes('anthropic') || url.hostname.includes('gstatic') ||
      url.hostname.includes('cloudflare') || url.hostname.includes('workers.dev')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchFresh = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      // Network first for HTML, cache first for assets
      if (e.request.url.endsWith('.html') || e.request.url.includes('index')) {
        return fetchFresh.catch(() => cached || new Response('Offline'));
      }
      return cached || fetchFresh;
    })
  );
});

// FCM Push
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = { title: 'Ultimate Planner', body: e.data ? e.data.text() : '' }; }
  const title = data.notification?.title || data.title || '🔔 Ultimate Planner';
  const body  = data.notification?.body  || data.body  || 'May bagong reminder!';
  const icon  = BASE + '/icon-192.png';
  const tag   = data.data?.tag || data.tag || 'up-notif';
  const url   = data.data?.url || BASE + '/';
  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge: icon, tag,
      data: { url },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '📱 Buksan' },
        { action: 'dismiss', title: '✖ Dismiss' }
      ]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || BASE + '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
