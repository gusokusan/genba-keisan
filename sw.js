// 電波が弱い現場でも開けるように、ページを端末に保存しておく
const CACHE = "genba-mutsbdrf";
const FILES = ["index.html","concrete.html","slope.html","rebar.html","weight.html","soil.html","dump.html","pave.html","steel.html","count.html","area.html","hayami-h-beam.html","hayami-katawaku.html","hayami-rebar-lap.html","hayami-rebar-anchor.html","hayami-tankan.html","hayami-shikiteppan.html","hayami-namakon.html","about.html","assets/style.css","assets/app.js","assets/data.js","assets/icon.svg","assets/icon-192.png","assets/icon-512.png","manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
