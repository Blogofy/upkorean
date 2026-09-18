// Data model, persistence (localStorage), spaced repetition and derived statistics.
(function () {
  const U = window.U;

  // ---------- Static course data ----------
  const WORDS = [];
  window.UK_VOCAB.forEach((list, di) => list.forEach(([ko, uz], i) => WORDS.push({ id: `${di + 1}-${i}`, day: di + 1, i, ko, uz })));
  const BY_ID = Object.fromEntries(WORDS.map((w) => [w.id, w]));
  const DAYS = window.UK_VOCAB.length;
  const DAY_WORDS = Array.from({ length: DAYS }, (_, d) => WORDS.filter((w) => w.day === d + 1));
  // One book sentence per word, keyed by word id so repeated words (e.g. 위험하다 on Day 6 and 25) keep their own sentence.
  const EXAMPLES = Object.fromEntries((window.UK_EXAMPLES || []).map((e) => [e.id, e]));
  // How each word is built (js/roots.js), and every word that contains a given hanja.
  const ROOTS = window.UK_ROOTS || {};
  const HANJA_WORDS = new Map();
  for (const [id, r] of Object.entries(ROOTS)) for (const p of r.parts || []) if (p.h) HANJA_WORDS.set(p.h, [...(HANJA_WORDS.get(p.h) || []), id]);

  // Review ladder: a new word comes back after 1, 3, 7, 16, 35 days (cumulative).
  const INTERVALS = [1, 2, 4, 9, 19, 40];
  const MASTER_STEP = 4;
  const LEVELS = [0, 500, 1200, 2000, 3500, 5500, 8000, 11000, 15000, 20000, 26000];
  const PACES = {
    11: { blocks: 3, min: 12, name: "Yengil", desc: "Kuniga ~12 daqiqa, kun 3 sessiyaga bo'linadi" },
    17: { blocks: 2, min: 22, name: "Muvozanatli", desc: "Kuniga ~22 daqiqa — eng ko'p tanlanadigan temp" },
    33: { blocks: 1, min: 40, name: "Intensiv", desc: "Kuniga ~40 daqiqa, butun kun bir sessiyada" },
  };
  // A day's review goal, by pace: how many review items this learner is asked for, whatever the queue holds.
  // Whoever chose a longer sitting carries more of the load. Everything above the goal is moved into the
  // coming days (S.newDay), so the number on the dashboard is one a learner can finish today — a queue that
  // grows every day is read as one's own failure and is why the review button was abandoned in week two.
  const REVIEW_GOALS = { 11: 60, 17: 90, 33: 140 };
  // Minutes per question, at the rate the app already plans with: S.dayPlan prices its "recall" stage at
  // 0.3 min an item and exercise.js prices a mixed quiz question the same.
  const ITEM_MIN = 0.3;
  // How far ahead the overflow may land. A word pushed further than a week is a word lost anyway.
  const PUSH_DAYS = 7;
  const EX_TYPES = ["mc", "mcr", "type", "listen", "sent"];
  const TYPE_NAMES = { mc: "Koreyscha → o'zbekcha", mcr: "O'zbekcha → koreyscha", type: "Yozish", listen: "Tinglash", sent: "Gapni to'ldirish" };

  // ---------- Local storage (UI prefs + offline backup of progress) ----------
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("local save failed", e); } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  function freshState(profile) {
    return {
      v: 1,
      profile: Object.assign({
        name: "", email: "", joined: U.today(), pace: 17, onboarded: false,
        reminders: { on: true, learn: "09:00", review: "20:30", streak: true, social: false },
      }, profile),
      settings: { theme: LS.get("uk:theme", "system"), roman: true, autoAudio: true, speechRate: 0.92, apiKey: "" },
      words: {}, days: {}, act: {}, notes: {}, log: [], xp: 0, bestStreak: 0,
      typeStats: Object.fromEntries(EX_TYPES.map((t) => [t, { ok: 0, bad: 0 }])),
      firstTry: { ok: 0, total: 0 },
      quizResults: [], reviewSessions: 0,
      tutor: { sessions: 0, lastAt: null, lastMin: 0, current: null },
      achievements: {}, challengeDone: {}, dueStart: null,
    };
  }

  const S = { WORDS, BY_ID, DAYS, DAY_WORDS, EXAMPLES, INTERVALS, MASTER_STEP, PACES, EX_TYPES, TYPE_NAMES, TOTAL: WORDS.length, state: null, user: null, config: {}, syncError: false, offline: !navigator.onLine };

  // ---------- Server API ----------
  async function api(method, path, body) {
    let res;
    try {
      res = await fetch("/api" + path, {
        method, credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json" } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      const e = new Error("Serverga ulanib bo'lmadi. Internetni tekshiring."); e.status = 0; throw e;
    }
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) { const e = new Error(data.error || "Serverda xatolik"); e.status = res.status; e.field = data.field; e.data = data; throw e; }
    return data;
  }
  S.api = api;

  function normalize(st) {
    const f = freshState({});
    for (const k of Object.keys(f)) if (st[k] === undefined) st[k] = f[k];
    for (const t of EX_TYPES) if (!st.typeStats[t]) st.typeStats[t] = { ok: 0, bad: 0 };
    st.settings = Object.assign(f.settings, st.settings);
    st.profile = Object.assign(f.profile, st.profile);
    return st;
  }

  // ---------- Progress sync ----------
  // base   — progress exactly as the server stores it at version baseAt; saves send only the difference.
  // dirty  — S.state has changes the server has not confirmed yet (also kept in localStorage).
  // A save names its baseAt. If another device saved first, the server answers 409 with its progress, and the
  // two are merged (sync.js) before trying again. Each save carries a random rev, so a device can recognise
  // its own save when the answer was lost and never merges the same work twice.
  const cacheKey = () => `uk:cache:${S.user.id}`;
  const baseKey = () => `uk:base:${S.user.id}`;
  const sendingKey = () => `uk:sending:${S.user.id}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const tzOffset = () => new Date().getTimezoneOffset();
  const newRev = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

  let base = null, baseAt = null, dirty = false, saveTimer = null, inflight = null, lost = null, conflicts = 0;
  const setBase = (state, at) => { base = state; baseAt = at; LS.set(baseKey(), { at, state }); };
  const keepLocal = () => LS.set(cacheKey(), { v: 2, dirty, state: S.state });
  const forgetLocal = () => { LS.del(cacheKey()); LS.del(baseKey()); LS.del(sendingKey()); base = null; baseAt = null; dirty = false; };
  // Swap in merged progress without replacing the S.state object other modules hold on to.
  function replaceState(next) {
    next = normalize(next);
    for (const k of Object.keys(S.state)) if (!(k in next)) delete S.state[k];
    Object.assign(S.state, next);
  }
  const MERGED = "Boshqa qurilmadagi progress bilan birlashtirildi";

  // Load progress from the server and reconcile it with this device's unsynced copy, if any.
  S.loadProgress = async () => {
    const cache = LS.get(cacheKey(), null);
    const saved = LS.get(baseKey(), null);
    const sentRev = LS.get(sendingKey(), null);
    lost = null; conflicts = 0;
    let remote;
    try {
      remote = await api("GET", "/progress");
      S.offline = false;
    } catch (e) {
      if (e.status !== 0 || !cache || !cache.state) throw e;
      // Offline: continue from this device's copy; it syncs when the connection returns.
      S.offline = true;
      S.state = normalize(cache.state);
      base = saved ? saved.state : null; baseAt = saved ? saved.at : null;
      dirty = cache.v === 2 ? !!cache.dirty : true;
      return finishLoad();
    }
    // Old app versions stored { at, state } and compared clocks; treat a newer copy as unsynced.
    const unsynced = !!(cache && cache.state && (cache.v === 2 ? cache.dirty : !remote.updatedAt || cache.at > remote.updatedAt));
    let st = remote.state, merged = false;
    if (unsynced) {
      if (!remote.state) st = cache.state;
      // The server still holds what this device last knew, or this device's own last save: nothing to merge.
      else if ((saved && saved.at === remote.updatedAt) || (sentRev && sentRev === remote.rev)) st = cache.state;
      else { st = UKSync.mergeStates(cache.v === 2 && saved ? saved.state : null, cache.state, remote.state); merged = true; }
    }
    setBase(remote.state, remote.updatedAt);
    // A copy: base must keep the server's version while S.state changes.
    S.state = normalize(st ? clone(st) : freshState({ joined: S.user.createdAt || U.today() }));
    dirty = unsynced || !remote.state;
    finishLoad();
    if (merged) U.toast(MERGED);
  };
  function finishLoad() {
    S.state.profile.name = S.user.name;
    S.state.profile.email = S.user.email;
    if (S.state.settings.theme) S.applyTheme(S.state.settings.theme);
    S.newDay(); // the queue is bounded before the first render, never during one
    if (dirty) S.save(); else keepLocal();
  }

  S.save = () => {
    if (!S.state || !S.user) return;
    dirty = true;
    keepLocal();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(S.flush, 700);
  };

  S.flush = async () => {
    clearTimeout(saveTimer);
    while (inflight) await inflight;
    if (!dirty || !S.user || !S.state) return;
    dirty = false;
    inflight = pushProgress().finally(() => { inflight = null; });
    return inflight;
  };

  async function pushProgress() {
    const snap = clone(S.state);
    const rev = newRev();
    const body = { baseAt, rev, tz: tzOffset() };
    let method = "PUT";
    if (base) {
      body.changes = UKSync.diffState(base, snap);
      if (!body.changes.length) { keepLocal(); return; }
      method = "PATCH";
    } else body.state = snap;
    LS.set(sendingKey(), rev);
    try {
      const r = await api(method, "/progress", body);
      setBase(snap, r.updatedAt);
      lost = null; conflicts = 0; S.syncError = false;
      keepLocal();
      if (dirty) saveTimer = setTimeout(S.flush, 700);
    } catch (e) {
      dirty = true;
      if (e.status === 401) { U.toast("Sessiya tugadi — qaytadan kiring"); S.user = null; location.hash = "#/login"; return; }
      if (e.status === 409 && e.data && e.data.conflict) {
        const d = e.data;
        if (lost && d.rev && d.rev === lost.rev) {
          // An earlier save of ours did arrive; only its answer was lost. The server holds that snapshot.
          setBase(lost.snap, d.updatedAt);
        } else {
          replaceState(UKSync.mergeStates(base, S.state, d.state));
          setBase(d.state, d.updatedAt);
          U.toast(MERGED);
          if (window.App && !/^#\/(session|tutor|onboarding)/.test(location.hash)) window.App.render();
        }
        lost = null;
        keepLocal();
        // Retry right away; if devices keep colliding, slow down.
        if (++conflicts <= 3) { saveTimer = setTimeout(S.flush, 0); return; }
      } else if (e.status === 0) {
        lost = { rev, snap }; // the save may still have reached the server
      }
      S.syncError = true;
      saveTimer = setTimeout(S.flush, 8000);
    }
  }

  // Best effort when the tab closes: send the (usually small) difference. Browsers cap keepalive requests at
  // ~64 KB; anything larger stays in localStorage and syncs on the next visit.
  window.addEventListener("pagehide", () => {
    if (!dirty || !S.user || !S.state || !base || inflight) return;
    const changes = UKSync.diffState(base, S.state);
    if (!changes.length) return;
    const rev = newRev();
    const body = JSON.stringify({ baseAt, rev, tz: tzOffset(), changes });
    if (body.length > 60000) return;
    LS.set(sendingKey(), rev);
    fetch("/api/progress", { method: "PATCH", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { S.flush(); return; }
    // Coming back to a tab that stayed open overnight is the other moment the local date changes (boot is the
    // first). The day is rolled over here, outside any render, and the page is redrawn if anything moved.
    if (S.newDay() && window.App && !/^#\/(session|tutor|onboarding)/.test(location.hash)) window.App.render();
  });

  // ---------- Accounts ----------
  S.boot = async () => {
    try {
      S.config = await api("GET", "/config");
      LS.set("uk:config", S.config);
    } catch { S.config = LS.get("uk:config", {}); S.offline = true; }
    try {
      const { user } = await api("GET", "/auth/me");
      S.user = user;
      LS.set("uk:user", user);
      await S.loadProgress();
    } catch (e) {
      if (e.status === 0) {
        const cachedUser = LS.get("uk:user", null);
        if (!cachedUser) throw e;
        S.user = cachedUser;
        S.offline = true;
        await S.loadProgress();
      } else {
        S.user = null; S.state = null;
        if (e.status === 401) LS.del("uk:user");
        else throw e;
      }
    }
  };
  const signedIn = async ({ user }) => { S.user = user; LS.set("uk:user", user); await S.loadProgress(); };
  S.register = async (name, email, password) => signedIn(await api("POST", "/auth/register", { name, email, password }));
  S.login = async (email, password) => signedIn(await api("POST", "/auth/login", { email, password }));
  S.googleLogin = async (accessToken) => { const r = await api("POST", "/auth/google", { accessToken }); await signedIn(r); return r; };
  S.forgot = (email) => api("POST", "/auth/forgot", { email });
  S.resetPassword = async (token, password) => signedIn(await api("POST", "/auth/reset", { token, password }));
  S.demo = async () => {
    const r = await api("POST", "/auth/demo", {});
    S.user = r.user;
    // The server just cleared the demo progress, so any copy a previous visitor left here is stale.
    forgetLocal(); S.state = S.buildDemoState(); S.newDay(); S.save(); await S.flush();
  };
  S.logout = async () => {
    await S.flush().catch(() => {});
    // This browser should stop receiving the account's reminders once someone else may use it.
    if (window.Push) await window.Push.disconnect().catch(() => {});
    try { await api("POST", "/auth/logout", {}); } catch { /* already signed out */ }
    // The local backup only matters for progress the server has not received yet; on a shared computer
    // it would otherwise stay readable after signing out.
    if (!dirty) forgetLocal();
    LS.del("uk:user");
    S.user = null; S.state = null;
  };
  S.updateName = async (name) => {
    const { user } = await api("PATCH", "/account", { name });
    S.user = user; S.state.profile.name = user.name; S.save();
  };
  S.changePassword = async (current, next) => {
    const { user } = await api("POST", "/account/password", { current, next });
    S.user = user; LS.set("uk:user", user);
  };
  S.deleteAccount = async (password) => {
    await api("DELETE", "/account", { password });
    if (window.Push) await window.Push.forgetDevice().catch(() => {});
    forgetLocal(); LS.del("uk:last"); LS.del("uk:user");
    S.user = null; S.state = null;
  };
  S.leaderboard = () => api("GET", `/leaderboard?tz=${tzOffset()}`);
  S.tutor = (payload) => api("POST", "/tutor", payload);

  // Theme preference: "system" (follow the device), "light" or "dark".
  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  let themePref = "system";
  let forcedLight = false; // sign-in pages are always light, whatever the preference
  S.themePref = () => themePref;
  S.savedTheme = () => LS.get("uk:theme", "system");
  S.applyTheme = (t) => {
    themePref = t === "dark" || t === "light" ? t : "system";
    const dark = !forcedLight && (themePref === "dark" || (themePref === "system" && !!darkQuery && darkQuery.matches));
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0C1110" : "#F4F7F6");
  };
  S.forceLight = (on) => { if (forcedLight !== on) { forcedLight = on; S.applyTheme(themePref); } };
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", () => { if (themePref === "system") S.applyTheme("system"); });
  S.setTheme = (t) => {
    LS.set("uk:theme", t);
    S.applyTheme(t);
    if (S.state) { S.state.settings.theme = t; S.save(); }
  };

  // ---------- Words & spaced repetition ----------
  S.ws = (id) => S.state.words[id] || null;
  const touch = (id) => (S.state.words[id] = S.state.words[id] || { s: 0, due: null, learned: null, seen: 0, ok: 0, bad: 0, lapses: 0, flag: false, forgot: false, last: null });
  S.word = (id) => BY_ID[id];
  S.example = (id) => EXAMPLES[id] || null;
  S.clozeExample = (id) => (EXAMPLES[id] && EXAMPLES[id].cloze ? EXAMPLES[id] : null);
  S.roots = (id) => ROOTS[id] || null;
  // Other course words sharing a hanja with this one: [{ k, h, uz, ids }]
  S.rootLinks = (id) => ((ROOTS[id] && ROOTS[id].parts) || []).filter((p) => p.h)
    .map((p) => ({ k: p.k, h: p.h, uz: p.uz, ids: (HANJA_WORDS.get(p.h) || []).filter((other) => other !== id && BY_ID[other].ko !== BY_ID[id].ko) }))
    .filter((l) => l.ids.length);
  // Days whose words all have memory aids are taught with the guided flow (meet → match → recall).
  S.guidedDay = (d) => !!DAY_WORDS[d - 1] && DAY_WORDS[d - 1].every((w) => ROOTS[w.id]);
  // Word origin: 한자어 (built from hanja), 고유어 (pure Korean), 외래어 (borrowed).
  S.ORIGINS = {
    sino: { ko: "한자어", uz: "Ieroglifli so'z", desc: "xitoycha ieroglif (hanja)lardan yasalgan" },
    native: { ko: "고유어", uz: "Sof koreyscha", desc: "asl koreyscha so'z" },
    loan: { ko: "외래어", uz: "O'zlashma", desc: "chet tildan olingan" },
  };
  S.origin = (id) => (ROOTS[id] && ROOTS[id].origin) || "native";
  S.note = (id) => (S.state.notes && S.state.notes[id]) || "";
  S.setNote = (id, text) => {
    const t = String(text || "").slice(0, 140);
    if (t.trim()) S.state.notes[id] = t; else delete S.state.notes[id];
    S.save();
  };
  S.mastery = (id) => { const w = S.ws(id); return w && w.learned ? Math.min(5, w.s) : 0; };
  S.isLearned = (id) => { const w = S.ws(id); return !!(w && w.learned); };
  S.isMastered = (id) => { const w = S.ws(id); return !!(w && w.learned && w.s >= MASTER_STEP); };
  S.isWeak = (id) => { const w = S.ws(id); return !!(w && w.learned && w.bad >= 2 && w.s < 3); };

  // ±15% on every interval, so the 33 words met on one day stop coming back as one wave on exactly the same
  // later days. Never sooner than tomorrow. INTERVALS[0] = 1 and INTERVALS[1] = 2 cannot spread at this
  // width — they round back to themselves; the scatter starts at the 4-day step and grows from there.
  const fuzz = (days) => Math.max(1, Math.round(days * (0.85 + Math.random() * 0.3)));

  function setStep(w, s) {
    const prev = w.s;
    w.s = U.clamp(s, 0, 5);
    if (prev >= 3 && w.s <= 1 && w.learned) { w.forgot = true; w.lapses++; }
    if (w.s >= 3) w.forgot = false;
    w.due = U.addDays(U.today(), fuzz(INTERVALS[w.s]));
  }
  const gradeStep = (w, g) => {
    const first = !w || !w.learned;
    const s = w ? w.s : 0;
    if (g === 1) return 0;
    if (g === 2) return first ? 0 : Math.max(0, s);
    if (g === 3) return first ? 1 : s + 1;
    return first ? 2 : s + 2;
  };
  S.previewInterval = (id, g) => INTERVALS[U.clamp(gradeStep(S.ws(id), g), 0, 5)];

  // Flash-card self assessment: 1 Bilmadim · 2 Qiyin · 3 Bildim · 4 Oson
  S.grade = (id, g) => {
    const w = touch(id);
    const first = !w.learned;
    const step = gradeStep(w, g);
    if (first) { w.learned = U.today(); act().learned++; }
    w.seen++; w.last = U.today();
    if (g === 1) w.bad++; else if (g >= 3) w.ok++;
    setStep(w, step);
    S.addXP(first ? 4 : 2);
    return INTERVALS[w.s];
  };

  // First meeting with a word on the guided flow: it counts as learned and comes back tomorrow unless the
  // practice right after goes without a mistake (S.settleIntroduced).
  S.introduce = (id) => {
    const w = touch(id);
    if (!w.learned) { w.learned = U.today(); act().learned++; setStep(w, 0); S.addXP(4); }
    w.seen++; w.last = U.today();
  };
  S.settleIntroduced = (ids, mistakes) => {
    for (const id of ids) {
      const w = S.ws(id);
      if (w && w.learned === U.today() && w.s === 0 && !mistakes[id]) setStep(w, 1);
    }
  };

  // Exercise answer. mode: "learn" (same-day recall), "review" (spaced repetition), "quiz" (free practice)
  S.answer = (id, correct, type, mode) => {
    const w = touch(id);
    // Is this answer the word's scheduled moment? Read before anything else: it is what stops a word answered
    // several times inside one session from walking up the ladder once per question.
    const scheduled = !w.due || w.due <= U.today();
    const fresh = !w.learned || w.learned === U.today();
    if (!w.learned) { w.learned = U.today(); act().learned++; }
    w.seen++; w.last = U.today();
    if (S.state.typeStats[type]) S.state.typeStats[type][correct ? "ok" : "bad"]++;
    if (correct) {
      w.ok++;
      // The day's own test advances the schedule exactly as a review session does. At pace 11 or 17 a day is
      // spread over two or three sittings, so its later blocks fall on the day the earlier ones are due, and
      // those correct answers used to count for nothing. A word introduced today is already due tomorrow, so
      // its first day is never touched by this; free practice never advances a word at all.
      if (mode !== "quiz" && scheduled) setStep(w, w.s + 1);
      S.addXP(3);
    } else {
      w.bad++;
      // Free practice records the miss — w.bad feeds S.isWeak, typeStats feeds the reports — but leaves the
      // ladder alone: drilling hard words late at night must not cost a month of consolidation. lapses and
      // forgot stay untouched for the same reason: both mean "recall failed at the moment the schedule chose
      // it", and a word picked by the learner, often minutes after seeing it, is no such moment.
      if (mode !== "quiz") { setStep(w, 0); w.due = U.addDays(U.today(), 1); } // wrong words come back tomorrow
    }
    // A due word cleared in the day's own test is a review; without this the day's target could not be reached.
    if (mode === "review" || (mode === "learn" && scheduled && !fresh)) act().reviewed++;
  };
  S.flag = (id, on) => { const w = touch(id); w.flag = on === undefined ? !w.flag : on; S.save(); return w.flag; };

  // ---------- Activity, XP, log ----------
  function act(date) {
    const k = date || U.today();
    const a = (S.state.act[k] = S.state.act[k] || { learned: 0, reviewed: 0, xp: 0, min: { learn: 0, review: 0, quiz: 0, tutor: 0 } });
    return a;
  }
  S.act = act;
  S.addXP = (n) => { S.state.xp += n; act().xp += n; };
  S.addMinutes = (cat, min) => { if (min > 0) act().min[cat] = (act().min[cat] || 0) + min; };
  S.log = (text, kind = "p") => { S.state.log.unshift({ t: Date.now(), text, kind }); S.state.log = S.state.log.slice(0, 30); };
  const actMinutes = (a) => (a ? Object.values(a.min).reduce((s, v) => s + v, 0) : 0);
  const isActive = (a) => !!a && (a.learned > 0 || a.reviewed > 0 || actMinutes(a) >= 1);

  S.streak = () => {
    let d = U.today();
    if (!isActive(S.state.act[d])) d = U.addDays(d, -1);
    let n = 0;
    while (isActive(S.state.act[d])) { n++; d = U.addDays(d, -1); }
    if (n > (S.state.bestStreak || 0)) S.state.bestStreak = n;
    return n;
  };
  S.levelInfo = () => {
    const xp = S.state.xp;
    let lv = 1;
    while (lv < LEVELS.length && xp >= LEVELS[lv]) lv++;
    const next = LEVELS[lv] || LEVELS[LEVELS.length - 1] + 6000;
    return { level: lv, xp, next, toNext: next - xp, pct: U.clamp(U.pct(xp, next), 0, 100) };
  };
  S.totalMinutes = (fromKey) => Object.entries(S.state.act).filter(([k]) => !fromKey || k >= fromKey).reduce((s, [, a]) => s + actMinutes(a), 0);
  S.minutesBy = (cat) => Object.values(S.state.act).reduce((s, a) => s + (a.min[cat] || 0), 0);
  S.activeDays = () => Object.keys(S.state.act).filter((k) => isActive(S.state.act[k])).length;
  S.dayMinutes = (key) => actMinutes(S.state.act[key]);

  // ---------- Course structure ----------
  S.dayPlan = (d) => {
    const ds = S.state.days[d];
    const pace = (ds && ds.pace) || S.state.profile.pace;
    const words = DAY_WORDS[d - 1];
    const nb = (PACES[pace] || PACES[17]).blocks;
    const base = Math.floor(words.length / nb), extra = words.length % nb;
    const blocks = []; let at = 0;
    for (let b = 0; b < nb; b++) { const n = base + (b < extra ? 1 : 0); blocks.push(words.slice(at, at + n).map((w) => w.id)); at += n; }
    const stages = [];
    const guided = S.guidedDay(d);
    blocks.forEach((ids, b) => {
      stages.push(guided
        ? { kind: "learn", block: b, label: `Tanishish va mashq — ${ids.length} so'z`, min: Math.max(4, Math.round(ids.length * 0.6)) }
        : { kind: "learn", block: b, label: `O'rganish — ${ids.length} so'z`, min: Math.max(3, Math.round(ids.length * 0.47)) });
      if (b < blocks.length - 1) stages.push({ kind: "recall", block: b, label: "Faol eslash", min: Math.max(2, Math.round(ids.length * 0.3)) });
      else stages.push({ kind: "mixed", block: -1, label: "Aralash test", min: 4 });
    });
    return { pace, blocks, stages, words: words.map((w) => w.id), minutes: stages.reduce((s, x) => s + x.min, 0) };
  };
  S.dayState = (d) => S.state.days[d] || { stage: 0, done: false };
  S.currentDay = () => { for (let d = 1; d <= DAYS; d++) if (!S.dayState(d).done) return d; return DAYS; };
  S.courseDone = () => S.dayState(DAYS).done && Array.from({ length: DAYS }, (_, i) => S.dayState(i + 1).done).every(Boolean);
  S.dayLearned = (d) => DAY_WORDS[d - 1].filter((w) => S.isLearned(w.id)).length;
  S.dayStatus = (d) => {
    const ds = S.dayState(d);
    if (ds.done) return DAY_WORDS[d - 1].every((w) => S.isMastered(w.id)) ? "mastered" : "completed";
    const cur = S.currentDay();
    if (d === cur || ds.stage > 0) return "progress";
    if (d <= cur + 2) return "available";
    return "locked";
  };
  S.daysDone = () => Array.from({ length: DAYS }, (_, i) => i + 1).filter((d) => S.dayState(d).done).length;
  S.dayTitle = (d) => {
    const picks = DAY_WORDS[d - 1].map((w) => w.uz.split("/")[0].trim()).filter((u) => !/\s/.test(u)).slice(0, 3);
    const t = picks.join(", ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  // ---------- Selectors ----------
  S.learnedIds = () => Object.keys(S.state.words).filter((id) => S.isLearned(id) && BY_ID[id]);
  // Most overdue first, and inside one due date the least consolidated first. S.newDay and S.reviewQueue both
  // cut this one order, from opposite ends: the overflow comes off the front, today's queue off the back.
  S.dueIds = () => S.learnedIds().filter((id) => S.ws(id).due && S.ws(id).due <= U.today())
    .sort((a, b) => S.ws(a).due.localeCompare(S.ws(b).due) || S.ws(a).s - S.ws(b).s);
  S.weakIds = () => S.learnedIds().filter(S.isWeak).sort((a, b) => S.ws(b).bad - S.ws(a).bad);
  S.flaggedIds = () => S.learnedIds().filter((id) => S.ws(id).flag);
  S.forgottenIds = () => S.learnedIds().filter((id) => S.ws(id).forgot);
  S.masteredIds = () => S.learnedIds().filter(S.isMastered);
  S.accuracy = () => {
    let ok = 0, all = 0;
    for (const t of EX_TYPES) { ok += S.state.typeStats[t].ok; all += S.state.typeStats[t].ok + S.state.typeStats[t].bad; }
    return all ? U.pct(ok, all) : null;
  };
  S.typeAccuracy = (t) => { const s = S.state.typeStats[t]; const all = s.ok + s.bad; return all ? U.pct(s.ok, all) : null; };

  // ---------- The daily review goal ----------
  const paceGoal = () => REVIEW_GOALS[S.state.profile.pace] || REVIEW_GOALS[17];
  // Today's review target for this learner: goal — the pace's target, due — what is really due now,
  // done — review items already cleared today, left — what is still to do, minutes — a rough cost for it.
  // A pure read: it is called from render paths and must not write state or hand out XP.
  S.reviewGoal = () => {
    const goal = paceGoal();
    const due = S.dueIds().length;
    const done = (S.state.act[U.today()] || {}).reviewed || 0; // act() would create today's entry
    // Both bounds matter: never more than the queue holds, never more than the goal still allows.
    const left = Math.min(due, Math.max(0, goal - done));
    return { goal, due, done, left, minutes: left ? Math.max(1, Math.round(left * ITEM_MIN)) : 0 };
  };

  // The ids a review session should run. "due" is today's queue already cut to the goal (most overdue first),
  // so nothing else has to know the rule; the hand-picked lists are unchanged. Passing n overrides the cut —
  // that is how an extra round is offered once the day's goal is already met.
  S.reviewQueue = (mode = "due", n) => {
    if (mode === "due") return S.dueIds().slice(0, n === undefined ? S.reviewGoal().left : n);
    const pick = { weak: S.weakIds, flag: S.flaggedIds, forgot: S.forgottenIds }[mode];
    if (!pick) return [];
    return n === undefined ? pick() : pick().slice(0, n);
  };

  // The day transition. Runs once per local day and never from a render: at boot (finishLoad) and when the tab
  // comes back on a new date. Today's queue is cut to the goal and the overflow is moved into the coming days,
  // so a learner doing their part meets a number they can finish instead of a debt that grows every day.
  // Returns true when it actually rolled the day over.
  S.newDay = () => {
    if (!S.state) return false;
    const t = U.today();
    if (S.state.dueStart && S.state.dueStart.date === t) return false; // already done today
    const goal = paceGoal();
    const ids = S.dueIds(); // most overdue first
    if (ids.length > goal) pushForward(ids.slice(0, ids.length - goal), t);
    // The day's target is fixed here and saved: read back by S.challenge, it must not shrink as the queue drains.
    S.state.dueStart = { date: t, n: Math.min(goal, ids.length) };
    S.save();
    return true;
  };

  // What did not fit today goes to the emptiest of the coming days, so each of those also lands near the goal
  // instead of inheriting the whole pile.
  // What moves is the *most* overdue, and that was measured rather than assumed. Keeping the oldest words and
  // pushing the freshly due ones looks kinder, but a pushed word gets a later due date, which puts it behind
  // the backlog the next day and then for ever: over a simulated 30 days at pace 17 it left every word one
  // step short of consolidation — 0 words mastered against 331 the other way round, where a pushed word comes
  // back as a freshly due one and is reviewed, so nothing starves. It also reads the forgetting curve
  // honestly: a repetition buys most at the word's scheduled moment, while a word already ten days late has
  // decayed anyway and one more day changes little.
  function pushForward(ids, t) {
    const days = Array.from({ length: PUSH_DAYS }, (_, i) => U.addDays(t, i + 1));
    const load = Object.fromEntries(days.map((d) => [d, 0]));
    for (const id of S.learnedIds()) { const d = S.ws(id).due; if (d && d in load) load[d]++; }
    for (const id of ids) {
      const to = days.reduce((a, b) => (load[b] < load[a] ? b : a)); // emptiest, earliest on a tie
      load[to]++;
      S.ws(id).due = to;
    }
  }

  S.weekRhythm = () => {
    const start = U.weekStart(U.today());
    return U.WEEK_SHORT.map((lbl, i) => {
      const key = U.addDays(start, i);
      return { lbl, key, min: S.dayMinutes(key), words: (S.state.act[key] || {}).learned || 0, today: key === U.today(), future: key > U.today() };
    });
  };

  // Daily challenge (resets every day); AI is excluded while that feature is locked.
  S.challenge = () => {
    const t = U.today();
    const { goal, due } = S.reviewGoal();
    // The review target is the day's goal, not the whole queue: a target nobody can reach is one they stop
    // reading. S.newDay fixes it when the day turns over; this is the fallback for a page that was already
    // open then. It is saved — an unsaved target came back as a different, smaller number after a reload.
    const ds = S.state.dueStart;
    if (!ds || ds.date !== t) { S.state.dueStart = { date: t, n: Math.min(goal, due) }; S.save(); }
    else if (ds.n > goal) { ds.n = goal; S.save(); } // a target saved before the goal existed
    const a = act();
    const dayTotal = DAY_WORDS[S.currentDay() - 1].length;
    const items = [
      { label: `${dayTotal} so'z o'rganish`, cur: Math.min(a.learned, dayTotal), goal: dayTotal },
      S.state.dueStart.n > 0
        ? { label: `${S.state.dueStart.n} so'zni takrorlash`, cur: Math.min(a.reviewed, S.state.dueStart.n), goal: S.state.dueStart.n }
        : { label: "Bugun takrorlash yo'q", cur: 1, goal: 1 },
    ];
    const done = items.every((i) => i.cur >= i.goal);
    if (done && !S.state.challengeDone[t]) { S.state.challengeDone[t] = true; S.addXP(120); S.log("Kunlik vazifa bajarildi — +120 XP", "ok"); S.save(); }
    return { items, done, reward: 120 };
  };

  // ---------- Achievements ----------
  const ACH = [
    { id: "first", g: "첫", t: "Birinchi qadam", d: "1-kun tugatildi", ok: () => S.dayState(1).done, p: () => `${S.dayLearned(1)} / ${DAY_WORDS[0].length}` },
    { id: "s3", g: "삼", t: "3 kunlik seriya", d: "3 kun ketma-ket", ok: () => S.state.bestStreak >= 3, p: () => `${S.streak()} / 3` },
    { id: "s10", g: "십", t: "10 kunlik seriya", d: "10 kun ketma-ket", ok: () => S.state.bestStreak >= 10, p: () => `${S.streak()} / 10` },
    { id: "s30", g: "삼십", t: "30 kunlik seriya", d: "30 kun ketma-ket", ok: () => S.state.bestStreak >= 30, p: () => `${S.streak()} / 30` },
    { id: "w100", g: "백", t: "100 so'z", d: "100 ta so'z o'rganildi", ok: () => S.learnedIds().length >= 100, p: () => `${S.learnedIds().length} / 100` },
    { id: "w500", g: "오백", t: "500 so'z", d: "500 ta so'z o'rganildi", ok: () => S.learnedIds().length >= 500, p: () => `${S.learnedIds().length} / 500` },
    { id: "wall", g: "천", t: `${S.TOTAL} so'z`, d: "Barcha so'zlar", ok: () => S.learnedIds().length >= S.TOTAL, p: () => `${S.learnedIds().length} / ${S.TOTAL}` },
    { id: "m50", g: "숙달", t: "50 ta o'zlashtirilgan", d: "50 so'z to'liq o'zlashtirildi", ok: () => S.masteredIds().length >= 50, p: () => `${S.masteredIds().length} / 50` },
    { id: "perfect", g: "완벽", t: "Mukammal test", d: "10+ savolda 100%", ok: () => S.state.quizResults.some((r) => r.total >= 10 && r.ok === r.total), p: () => "0 / 1" },
    { id: "rev10", g: "복습", t: "Takrorlash ustasi", d: "10 ta takrorlash sessiyasi", ok: () => S.state.reviewSessions >= 10, p: () => `${S.state.reviewSessions} / 10` },
    { id: "week", g: "주", t: "Birinchi hafta", d: "7 kun tugatildi", ok: () => S.daysDone() >= 7, p: () => `${S.daysDone()} / 7 kun` },
    { id: "half", g: "반", t: "Yarim yo'l", d: "15 kun tugatildi", ok: () => S.daysDone() >= 15, p: () => `${S.daysDone()} / 15 kun` },
    { id: "ear", g: "귀", t: "Yaxshi quloq", d: "Tinglash 90%+ (20+ javob)", ok: () => { const s = S.state.typeStats.listen; return s.ok + s.bad >= 20 && S.typeAccuracy("listen") >= 90; }, p: () => `${S.typeAccuracy("listen") ?? 0}%` },
    { id: "hand", g: "손", t: "Hangul yozuvchi", d: "Yozishda 50 to'g'ri", ok: () => S.state.typeStats.type.ok >= 50, p: () => `${S.state.typeStats.type.ok} / 50` },
    { id: "grad", g: "졸업", t: "Kurs tamom", d: `${DAYS} kun tugatildi`, ok: () => S.daysDone() >= DAYS, p: () => `${S.daysDone()} / ${DAYS} kun` },
  ];
  S.achievements = () => {
    let changed = false;
    const list = ACH.map((a) => {
      const done = !!S.state.achievements[a.id] || a.ok();
      if (done && !S.state.achievements[a.id]) { S.state.achievements[a.id] = U.today(); changed = true; S.log(`Yutuq ochildi — ${a.t}`, "pd"); }
      return { ...a, done, when: S.state.achievements[a.id], prog: done ? null : a.p() };
    });
    if (changed) S.save();
    return list;
  };

  // ---------- Demo data (mirrors the design's sample user) ----------
  S.buildDemoState = () => {
    const st = freshState({ name: S.user.name, email: S.user.email, joined: U.addDays(U.today(), -12), onboarded: true });
    const t = U.today();
    for (let i = 12; i >= 1; i--) {
      const k = U.addDays(t, -i);
      st.act[k] = { learned: 0, reviewed: 8 + ((i * 7) % 17), xp: 90 + ((i * 13) % 60), min: { learn: 6 + (i % 5) * 3, review: 7 + (i % 4) * 2, quiz: 3 + (i % 3) * 2, tutor: i % 4 === 0 ? 12 : 0 } };
    }
    const weak = { "1-18": 3, "2-20": 2, "3-0": 2, "4-25": 2, "1-21": 2, "2-2": 2, "3-19": 3, "4-9": 2, "2-16": 2 };
    for (let d = 1; d <= 4; d++) {
      const learnedOn = U.addDays(t, -(5 - d));
      st.act[learnedOn].learned = DAY_WORDS[d - 1].length;
      DAY_WORDS[d - 1].forEach((w, i) => {
        const r = (i * 37 + d * 11) % 100;
        let s = d === 1 ? (r < 80 ? 4 + (r % 2) : 3) : d === 2 ? (r < 62 ? 4 : 3) : d === 3 ? (r < 30 ? 4 : 2 + (r % 2)) : (r < 22 ? 4 : 1 + (r % 3));
        const bad = weak[w.id] || (r % 9 === 0 ? 1 : 0);
        if (weak[w.id]) s = Math.min(s, bad >= 3 ? 1 : 2);
        const dueOff = (i % 5 === 0 || weak[w.id]) ? (i % 2 ? -1 : 0) : 1 + (r % 6);
        st.words[w.id] = { s, due: U.addDays(t, dueOff), learned: learnedOn, seen: s + 1 + bad, ok: s + 1, bad, lapses: 0, flag: r % 10 === 3, forgot: s <= 1 && r % 4 === 0, last: U.addDays(t, -((i % 4) + 1)) };
      });
      const dw = DAY_WORDS[d - 1].length;
      st.days[d] = { stage: 4, pace: 17, done: true, doneAt: learnedOn, ok: Math.round(dw * 1.3 * (0.84 + d * 0.02)), bad: Math.round(dw * 1.3 * (0.16 - d * 0.02)), min: 22 + d, xp: 180 };
    }
    st.days[5] = { stage: 0, pace: 17, done: false };
    st.xp = 2840; st.bestStreak = 12;
    st.typeStats = { mc: { ok: 182, bad: 18 }, mcr: { ok: 164, bad: 36 }, type: { ok: 91, bad: 29 }, listen: { ok: 78, bad: 42 }, sent: { ok: 44, bad: 6 } };
    st.firstTry = { ok: 261, total: 300 };
    st.quizResults = [
      { type: "listen", ok: 13, total: 20, at: Date.now() - 86400000 * 1 },
      { type: "type", ok: 12, total: 15, at: Date.now() - 86400000 * 2 },
      { type: "mixed", ok: 20, total: 20, at: Date.now() - 86400000 * 3 },
    ];
    st.reviewSessions = 9;
    st.tutor = { sessions: 3, lastAt: Date.now() - 86400000 * 2, lastMin: 12, current: null };
    st.log = [
      { t: Date.now() - 86400000 * 1, text: "4-kun tugatildi — 33 so'z", kind: "ok" },
      { t: Date.now() - 86400000 * 1 - 3600000, text: "Takrorlash — 28/31 to'g'ri", kind: "p" },
      { t: Date.now() - 86400000 * 2, text: "AI ustoz bilan 12 daqiqa suhbat", kind: "pd" },
    ];
    return st;
  };

  window.S = S;
})();
