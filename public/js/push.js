// Web Push reminders in the browser: permission, subscription, and handing the subscription to the server.
(function () {
  const S = window.S;
  const P = (window.Push = {});

  const b64url = (s) => {
    const raw = atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  const sameKey = (buf, key) => {
    if (!buf) return false;
    const a = new Uint8Array(buf), b = b64url(key);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  };

  P.supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // iPhone and iPad only allow web push for a site added to the Home Screen and opened from there.
  P.needsInstall = () => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    return ios && !standalone;
  };
  // "granted" | "denied" | "default" | "install" (iPhone, not on Home Screen) | "unsupported"
  P.permission = () => {
    if (!P.supported()) return P.needsInstall() ? "install" : "unsupported";
    return Notification.permission;
  };

  // Resolves with the active registration, or null if the service worker is not up within a few seconds.
  const registration = () => Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
  ]);

  // Asks for permission if needed, subscribes this browser and registers it for the signed-in account.
  // Returns "on" or the reason it could not: "denied" | "install" | "unsupported".
  P.enable = async ({ ask = true } = {}) => {
    const perm = P.permission();
    if (perm === "install" || perm === "unsupported" || !S.config.push) return perm === "install" ? "install" : "unsupported";
    let granted = perm === "granted";
    if (!granted && perm === "default" && ask) granted = (await Notification.requestPermission()) === "granted";
    if (!granted) return "denied";
    const reg = await registration();
    if (!reg) throw new Error("Service worker ishga tushmadi — sahifani yangilab qayta urinib ko'ring");
    let sub = await reg.pushManager.getSubscription();
    // A subscription made for other server keys cannot receive our messages.
    if (sub && !sameKey(sub.options && sub.options.applicationServerKey, S.config.push)) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64url(S.config.push) });
    await S.api("POST", "/push/subscribe", { subscription: sub.toJSON(), tz: new Date().getTimezoneOffset() });
    return "on";
  };

  async function currentSubscription() {
    if (!P.supported()) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }
  // Signing out: the account stops sending here and the browser drops the subscription.
  P.disconnect = async () => {
    const sub = await currentSubscription();
    if (!sub) return;
    try { await S.api("POST", "/push/unsubscribe", { endpoint: sub.endpoint }); } catch { /* signed out already */ }
    await sub.unsubscribe();
  };
  // The account is gone (the server already removed its subscriptions).
  P.forgetDevice = async () => { const sub = await currentSubscription(); if (sub) await sub.unsubscribe(); };

  P.test = () => S.api("POST", "/push/test", {});

  // Keeps the server's copy current (new keys, a restored database, an expired subscription) without asking again.
  P.refresh = () => {
    const r = S.user && S.state && S.state.profile.reminders;
    if (!r || !r.on || S.user.demo || P.permission() !== "granted") return;
    P.enable({ ask: false }).catch(() => { /* retried on the next visit */ });
  };

  P.explain = (result) => ({
    denied: "Bildirishnomalar brauzerda bloklangan. Sayt sozlamalarida (manzil satridagi qulf belgisi) ruxsat bering.",
    install: "iPhone'da eslatmalar uchun: Safari'da «Ulashish» → «Bosh ekranga qo'shish», keyin UpKorean'ni bosh ekrandan oching.",
    unsupported: "Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi. Chrome, Edge yoki Firefox'da oching.",
  })[result] || "";
})();
