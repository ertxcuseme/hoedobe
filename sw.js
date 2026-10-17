// Hoedobe offline helper. Keeps a copy of the app and its libraries so it opens with no signal.
const V = 'hoedobe-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.allSettled([...CORE, ...LIBS].map(u => c.add(new Request(u, { cache: 'reload' }))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const lib = u.hostname === 'cdnjs.cloudflare.com';
  if (!lib && u.origin !== location.origin) return;           // phone-signature connection etc. go straight to the network
  if (lib) {                                                   // versioned libraries never change: cache first
    e.respondWith(caches.match(r.url).then(m => m || fetch(r).then(res => { const c = res.clone(); caches.open(V).then(ca => ca.put(r.url, c)); return res; })));
    return;
  }
  // The app itself: show the saved copy right away, refresh it in the background for next time.
  e.respondWith(caches.open(V).then(async ca => {
    const hit = await ca.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) ca.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === 'navigate') { const idx = await ca.match('./index.html'); if (idx) return idx; }
    return new Response('Offline', { status: 503 });
  }));
});
