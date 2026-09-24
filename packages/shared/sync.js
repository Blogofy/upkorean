// Progress sync helpers shared by the browser (window.UKSync) and the server (globalThis.UKSync).
// - diffState / applyChanges: send only what changed since the last state the server acknowledged.
// - mergeStates: combine two devices' progress when both changed the same starting point (3-way merge).
(function (root) {
  // Maps whose entries change independently; they are diffed and merged one entry at a time.
  const MAPS = ["words", "lessons", "act", "notes", "achievements", "challengeDone"];
  const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
  // Every top-level key freshState() (srs.js) creates. A delta touching anything else is not something
  // this app produces, so the server refuses the whole batch rather than storing keys it will never read.
  // "days" is the course before lessons: no state has it any more, but the delta that removes it must pass.
  const TOP = new Set([
    "v", "profile", "settings", "words", "lessons", "days", "act", "notes", "log", "xp", "bestStreak",
    "typeStats", "firstTry", "quizResults", "reviewSessions", "tutor", "achievements", "challengeDone", "dueStart",
  ]);

  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
  const keys = (...objs) => [...new Set(objs.flatMap((o) => (isObj(o) ? Object.keys(o) : [])))];

  // ---------- Deltas ----------
  // [{ p: ["words", "1-3"], v: {...} }, { p: ["dueStart"], d: 1 }] — paths are one or two keys deep.
  function diffState(base, cur) {
    const out = [];
    for (const k of keys(base, cur)) {
      if (!has(cur, k)) { if (has(base, k)) out.push({ p: [k], d: 1 }); continue; }
      if (MAPS.includes(k) && isObj(cur[k]) && isObj(base && base[k])) {
        for (const s of keys(base[k], cur[k])) {
          if (!has(cur[k], s)) { if (has(base[k], s)) out.push({ p: [k, s], d: 1 }); }
          else if (!same(base[k][s], cur[k][s])) out.push({ p: [k, s], v: cur[k][s] });
        }
      } else if (!has(base, k) || !same(base[k], cur[k])) out.push({ p: [k], v: cur[k] });
    }
    return out;
  }

  const validPath = (p) => Array.isArray(p) && (p.length === 1 || p.length === 2) && TOP.has(p[0])
    && p.every((k) => typeof k === "string" && k.length > 0 && k.length <= 64 && !FORBIDDEN.has(k));

  // Applies changes in place. Returns false (and applies nothing) if any change is malformed.
  function applyChanges(state, changes) {
    if (!isObj(state) || !Array.isArray(changes)) return false;
    if (!changes.every((c) => isObj(c) && validPath(c.p) && (c.d === 1 || "v" in c))) return false;
    for (const { p, v, d } of changes) {
      let parent = state;
      if (p.length === 2) {
        if (!isObj(state[p[0]])) { if (d) continue; state[p[0]] = {}; }
        parent = state[p[0]];
      }
      const k = p[p.length - 1];
      if (d) delete parent[k]; else parent[k] = v;
    }
    return true;
  }

  // ---------- 3-way merge ----------
  const num = (v) => (Number.isFinite(v) ? v : 0);
  // Counters only grow. With the common starting value both devices' gains add up; without it,
  // the larger value is the safe choice (never counts the same work twice).
  // `b` is the starting value, or undefined when there is no common starting point at all.
  function counter(b, l, r) {
    l = num(l); r = num(r);
    if (!Number.isFinite(b)) return Math.max(l, r);
    return Math.max(l, r, b + (l - b) + (r - b));
  }
  // A plain value changed on at most one side keeps that change; changed on both, this device wins.
  function pick(b, l, r) {
    if (same(l, r)) return l;
    if (b !== undefined && same(l, b)) return r;
    if (b !== undefined && same(r, b)) return l;
    if (isObj(l) && isObj(r)) {
      const o = {};
      for (const k of keys(l, r)) {
        if (!has(l, k)) { if (!(isObj(b) && has(b, k))) o[k] = r[k]; continue; }
        if (!has(r, k)) { if (!(isObj(b) && has(b, k))) o[k] = l[k]; continue; }
        o[k] = pick(isObj(b) ? b[k] : undefined, l[k], r[k]);
      }
      return o;
    }
    return l;
  }
  const earliest = (l, r) => (l && r ? (l < r ? l : r) : l || r || null);
  // Starting value of a counter field. An entry missing from a known base did not exist yet, so it started at 0.
  const from = (b, k) => (b ? num(b[k]) : undefined);

  // known: the merge has a common base. Then an entry both devices created (e.g. today's activity) starts from {}.
  function mergeMap(b, l, r, entry, known) {
    const o = {};
    for (const k of keys(l, r)) {
      if (!has(l, k)) o[k] = r[k];
      else if (!has(r, k)) o[k] = l[k];
      else if (same(l[k], r[k])) o[k] = l[k];
      else o[k] = entry(known ? (isObj(b) && has(b, k) ? b[k] : {}) : undefined, l[k], r[k]);
    }
    return o;
  }

  function mergeWord(b, l, r) {
    // Scheduling (step, due date) comes from the device that practised the word last.
    const newer = (l.last || "") !== (r.last || "") ? ((l.last || "") > (r.last || "") ? l : r) : num(l.seen) >= num(r.seen) ? l : r;
    const o = Object.assign({}, newer);
    for (const k of ["seen", "ok", "bad", "miss", "lapses"]) o[k] = counter(from(b, k), l[k], r[k]);
    o.learned = earliest(l.learned, r.learned);
    o.flag = pick(b && b.flag, l.flag, r.flag);
    return o;
  }

  // A lesson finished on either device is finished; its counters add up like any other.
  function mergeLesson(b, l, r) {
    const o = Object.assign({}, l.done || !r.done ? l : r, { done: !!(l.done || r.done) });
    for (const k of ["ok", "bad", "min", "xp"]) o[k] = counter(from(b, k), l[k], r[k]);
    if (l.doneAt || r.doneAt) o.doneAt = earliest(l.doneAt, r.doneAt);
    return o;
  }

  function mergeAct(b, l, r) {
    const min = {};
    const bmin = b ? b.min || {} : undefined;
    for (const k of keys(l.min, r.min)) min[k] = counter(from(bmin, k), l.min && l.min[k], r.min && r.min[k]);
    const o = { learned: counter(from(b, "learned"), l.learned, r.learned), reviewed: counter(from(b, "reviewed"), l.reviewed, r.reviewed), xp: counter(from(b, "xp"), l.xp, r.xp), min };
    // The day's new-word goal is a setting, not a counter: the smaller one when the devices disagree (one of
    // them saw the level run short of new words), and whichever exists when only one has it.
    const goals = [l.goal, r.goal].filter(Number.isFinite);
    if (goals.length) o.goal = Math.min(...goals);
    return o;
  }

  function unionList(l, r, id, order, cap) {
    const seen = new Map();
    for (const item of [...(Array.isArray(l) ? l : []), ...(Array.isArray(r) ? r : [])]) if (!seen.has(id(item))) seen.set(id(item), item);
    return [...seen.values()].sort(order).slice(0, cap);
  }

  function mergeStates(base, local, remote) {
    // Work on copies: the result must not share objects with the inputs (the remote state becomes the next base).
    const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
    local = clone(local); remote = clone(remote);
    if (!isObj(remote)) return local;
    if (!isObj(local)) return remote;
    const known = isObj(base);
    const b = known ? clone(base) : {};
    const o = {};
    for (const k of keys(local, remote)) {
      const bl = b[k], l = local[k], r = remote[k];
      const bo = known ? (isObj(bl) ? bl : {}) : undefined; // base object for nested counters
      if (!has(local, k)) { o[k] = r; continue; }
      if (!has(remote, k)) { o[k] = l; continue; }
      switch (k) {
        case "words": o[k] = mergeMap(bl, l, r, mergeWord, known); break;
        case "lessons": o[k] = mergeMap(bl, l, r, mergeLesson, known); break;
        case "act": o[k] = mergeMap(bl, l, r, mergeAct, known); break;
        case "achievements": o[k] = mergeMap(bl, l, r, (_, x, y) => earliest(x, y), known); break;
        case "notes": o[k] = mergeMap(bl, l, r, pick, known); break;
        case "challengeDone": o[k] = mergeMap(bl, l, r, (_, x, y) => x || y, known); break;
        case "xp": case "reviewSessions": o[k] = counter(known ? num(bl) : undefined, l, r); break;
        case "bestStreak": o[k] = Math.max(num(l), num(r)); break;
        case "typeStats": o[k] = mergeMap(bl, l, r, (bb, x, y) => ({ ok: counter(from(bb, "ok"), x.ok, y.ok), bad: counter(from(bb, "bad"), x.bad, y.bad) }), known); break;
        case "firstTry": o[k] = { ok: counter(from(bo, "ok"), l.ok, r.ok), total: counter(from(bo, "total"), l.total, r.total) }; break;
        case "log": o[k] = unionList(l, r, (e) => `${e.t}|${e.text}`, (x, y) => y.t - x.t, 30); break;
        case "quizResults": o[k] = unionList(l, r, (e) => `${e.at}|${e.type}`, (x, y) => y.at - x.at, 20); break;
        case "tutor": o[k] = Object.assign(pick(bl, l, r), { sessions: counter(from(bo, "sessions"), l.sessions, r.sessions), lastAt: Math.max(num(l.lastAt), num(r.lastAt)) || null }); break;
        default: o[k] = pick(bl, l, r);
      }
    }
    return o;
  }

  root.UKSync = { diffState, applyChanges, mergeStates };
})(typeof window !== "undefined" ? window : globalThis);
