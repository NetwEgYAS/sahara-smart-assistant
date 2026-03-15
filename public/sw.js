const CACHE_NAME = 'sahara-v2.0.0';
const ASSETS = ['/', '/index.html', '/app.js', '/config.json', '/modules/proxmox.js', '/modules/n8n.js', '/modules/integration.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});
