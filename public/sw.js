// The server fills in the build fingerprint of public/ below, so each deploy gets a fresh shell cache.
const VERSION = "upkorean-__BUILD__";
const SHELL = [
  "/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/css/styles.css",
  "/js/vocab.js", "/js/examples.js", "/js/util.js", "/js/store.js", "/js/exercise.js",
  "/js/views-auth.js", "/js/tutor.js", "/js/views.js", "/js/app.js"
];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache so the new version never stores stale files.
  const requests = SHELL.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((cache) => cache.put("/index.html", copy)); }
      return res;
    }).catch(() => caches.match("/index.html")));
    return;
  }

  // Only the versioned app shell is served from the cache. API calls and narrator audio (which needs the
  // account's session and range requests) always go to the network and use normal HTTP caching.
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
