// The server fills in the build fingerprint of the web payload below, so each deploy gets a fresh shell cache.
const VERSION = "upkorean-__BUILD__";
// The three corpus files stay in the shell even though index.html no longer loads them: S.loadCorpus()
// asks for them after sign-in, and offline they have to come from here.
const SHELL = [
  "/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/badge-72.png", "/css/styles.css",
  "/js/vocab.js", "/js/examples.js", "/js/roots.js", "/js/util.js", "/js/sync.js", "/js/store.js", "/js/push.js", "/js/exercise.js",
  "/js/views-auth.js", "/js/views.js", "/js/app.js"
];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's HTTP cache so the new version never stores stale files.
  const requests = SHELL.map((url) => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

// install's addAll rejects as a batch, so one 404 can leave the shell cache empty. Without this the
// learner would get the browser's raw network error page instead of a hint about what happened.
const offlinePage = () => new Response(`<!doctype html><meta charset="utf-8"><title>UpKorean</title><body style="font:16px/1.6 system-ui;padding:48px 24px;text-align:center">Internet yo'q. Ulanishni tekshirib, sahifani yangilang.`, { headers: { "Content-Type": "text/html; charset=utf-8" } });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      // Only the app root is the shell: every other page (/privacy opens in a new tab) is a navigation too,
      // and caching it here would replace the app with that page the next time it is opened offline.
      if (res.ok && url.pathname === "/") { const copy = res.clone(); caches.open(VERSION).then((cache) => cache.put("/index.html", copy)); }
      return res;
    }).catch(() => caches.match("/index.html").then((cached) => cached || offlinePage())));
    return;
  }

  // Only the versioned app shell is served from the cache. API calls and narrator audio (which needs the
  // account's session and range requests) always go to the network and use normal HTTP caching.
  if (!SHELL.includes(url.pathname)) return;
  // The page asks for "/js/store.js?v=<build>" while the shell was cached under the bare path, so the
  // build id is ignored when matching. It is not lost: it is this cache's name, and a new build empties
  // the old cache in activate.
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req)));
});

// ---------- Reminders (Web Push) ----------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "UpKorean", {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "upkorean", // a newer reminder of the same kind replaces the old one
    lang: "uz",
    data: { url: data.url || "/" },
  }));
});

// Open the app on the reminder's page: reuse an open tab (the page switches routes itself) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const win = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (!win) return self.clients.openWindow(url);
    win.postMessage({ type: "open", url });
    return win.focus();
  }));
});
