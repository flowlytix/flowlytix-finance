// Flowlytix Money service worker: keeps the app shell (the page and its icons) so Money opens from the home screen, even offline.
// It never touches /api/ (sign-in, plan, prices…) or anything from another site (Google sign-in, Drive, Sheets, analytics):
// those always go straight to the network, so no one's money data or tokens are ever stored here.
// Change CACHE when the shell list changes; old caches are deleted on activate.
const CACHE = "money-shell-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icons/money-192.png", "/icons/money-512.png", "/icons/apple-touch-icon.png"];
const PAGES = new Set(["/", "/index.html", "/work"]);

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return; // straight to the network
  if (req.mode === "navigate" && PAGES.has(url.pathname)) {
    // the app page: always the newest from the network (deploys show at once); the saved copy only when offline
    const key = url.pathname === "/work" ? "/work" : "/";
    e.respondWith(fetch(req).then(res => {
      if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(r => r || caches.match("/"))));
    return;
  }
  if (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
