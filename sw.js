const CACHE = 'nikdel-curtain-v6';
const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'model-viewer-umd.min.js',
  'decorative_curtain.glb', 'decorative_curtain.usdz',
  'nikdel_logo.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'
];
const OPTIONAL = ['demo.mp4'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(OPTIONAL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const cs = await self.clients.matchAll();
    cs.forEach(c => c.postMessage('cached'));
  })());
});

async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range'));
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1)
    }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let res = await cache.match(req, { ignoreSearch: true });
    if (!res && req.mode === 'navigate') res = await cache.match('index.html');
    if (!res) {
      try { return await fetch(req); } catch (_) { return new Response('Offline', { status: 503 }); }
    }
    if (req.headers.get('range')) return rangeResponse(req, res);
    return res;
  })());
});
