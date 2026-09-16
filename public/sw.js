const VERSION = "upkorean-v1";
const SHELL = [
  "/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/css/styles.css",
  "/js/vocab.js", "/js/examples.js", "/js/util.js", "/js/store.js", "/js/exercise.js",
  "/js/views-auth.js", "/js/tutor.js", "/js/views.js", "/js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((cache) => cache.put("/index.html", copy));
      return res;
    }).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => {
      if (res.ok && (url.pathname.startsWith("/media/clip/") || SHELL.includes(url.pathname))) {
        const copy = res.clone();
        caches.open(VERSION).then((cache) => cache.put(req, copy));
      }
      return res;
    });
    return cached || network;
  }));
});
