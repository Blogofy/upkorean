// Starts the real server on a throwaway database and exercises the HTTP API.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localTime } from "../server/progress.js";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "upkorean-api-"));
const port = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["--no-warnings", "server/index.js", "--dev"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, BACKUP_HOURS: "0", DEMO: "1", NODE_ENV: "test", SMTP_HOST: "", GOOGLE_CLIENT_ID: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${log}`)), 15000);
    const onData = (chunk) => { log += chunk; if (log.includes("UpKorean →")) { clearTimeout(timer); resolve(); } };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (code) => reject(new Error(`server exited (${code}):\n${log}`)));
  });
});
after(async () => {
  server.kill();
  await new Promise((r) => server.once("exit", r));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// A browser-like client with its own session cookie.
function client() {
  let cookie = "";
  return async (method, url, body, headers = {}) => {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  };
}
let n = 0;
async function signedUp(name = "Test User") {
  const c = client();
  const r = await c("POST", "/api/auth/register", { name, email: `user${++n}-${port}@mail.uz`, password: "password1" });
  assert.equal(r.status, 201);
  return c;
}

test("progress: versions, deltas and conflicts between two devices", async () => {
  const phone = await signedUp();
  const laptop = client();
  // Same account on a second device.
  const email = (await phone("GET", "/api/auth/me")).data.user.email;
  assert.equal((await laptop("POST", "/api/auth/login", { email, password: "password1" })).status, 200);

  assert.deepEqual((await phone("GET", "/api/progress")).data, { state: null, updatedAt: null, rev: null });
  const first = await phone("PUT", "/api/progress", { state: { xp: 10, words: {} }, baseAt: null, rev: "r1", tz: -300 });
  assert.equal(first.status, 200);
  const v1 = first.data.updatedAt;

  // Creating again from "nothing" collides with the saved progress.
  const again = await laptop("PUT", "/api/progress", { state: { xp: 1 }, baseAt: null, rev: "x" });
  assert.equal(again.status, 409);
  assert.deepEqual(again.data.state, { xp: 10, words: {} });
  assert.equal(again.data.rev, "r1");

  const patch = await phone("PATCH", "/api/progress", { baseAt: v1, rev: "r2", changes: [{ p: ["xp"], v: 25 }, { p: ["words", "1-0"], v: { s: 1 } }] });
  assert.equal(patch.status, 200);
  assert.ok(patch.data.updatedAt > v1);

  // The laptop still thinks the server is at v1.
  const stale = await laptop("PATCH", "/api/progress", { baseAt: v1, rev: "r3", changes: [{ p: ["xp"], v: 99 }] });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.data.state, { xp: 25, words: { "1-0": { s: 1 } } });
  assert.equal(stale.data.updatedAt, patch.data.updatedAt);
  assert.equal(stale.data.rev, "r2");

  const got = (await laptop("GET", "/api/progress")).data;
  assert.equal(got.state.xp, 25);
  assert.equal(got.rev, "r2");

  // Malformed or malicious changes are refused and change nothing.
  const evil = await laptop("PATCH", "/api/progress", { baseAt: got.updatedAt, changes: [{ p: ["__proto__", "x"], v: 1 }] });
  assert.equal(evil.status, 400);
  assert.equal((await laptop("GET", "/api/progress")).data.updatedAt, got.updatedAt);

  // Old app versions (no baseAt) still overwrite.
  assert.equal((await laptop("PUT", "/api/progress", { state: { xp: 3 } })).status, 200);
});

// The weekly ceiling used to be 7 × DAY_XP_CAP, reachable from a standing start: the rate budget was counted
// from Monday 00:00 whenever the week had no row yet, so one PUT claiming every day of the week scored 35000.
test("leaderboard: capped XP in the learner's own week, and only for practice that happened", async () => {
  const TZ = -300; // Tashkent
  const { week, today } = localTime(Date.now(), TZ);
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(week) + i * 86400000).toISOString().slice(0, 10));

  const cheat = await signedUp("Firibgar Bekov");
  const act = Object.fromEntries(days.map((d) => [d, { xp: 999999 }]));
  assert.equal((await cheat("PUT", "/api/progress", { state: { xp: 999999, act, words: {} }, baseAt: null, tz: TZ })).status, 200);
  // Not one word practised, so the week is worth nothing at all.
  assert.equal((await cheat("GET", `/api/leaderboard?tz=${TZ}`)).data.rows.find((r) => r.me), undefined);

  // An honest day still counts for exactly what it earned.
  const c = await signedUp("Lola Karimova");
  const words = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`1-${i}`, { s: 1, last: today, due: today }]));
  await c("PUT", "/api/progress", { state: { xp: 300, act: { [today]: { xp: 300 }, "2099-01-01": { xp: 5000 } }, words }, baseAt: null, tz: TZ });
  const me = (await c("GET", `/api/leaderboard?tz=${TZ}`)).data.rows.find((r) => r.me);
  assert.equal(me.name, "Lola K.");
  // 300 claimed, 60 words (1500 XP of practice) behind it, and the future day never counts. A save made in
  // the first minutes of the learner's Monday is still held back by the budget, hence the range.
  assert.ok(me.xp > 0 && me.xp <= 300, `xp ${me.xp}`);
});

// One account could fire unlimited saves at a synchronous SQLite write, park 2.5 MB of junk in its row and
// invent top-level keys that nothing ever reads.
test("progress: saves are rate limited, bounded in size and limited to the keys the app uses", async () => {
  const TZ = -300;
  const flood = await signedUp();
  const codes = {};
  for (let i = 0; i < 125; i++) {
    const r = await flood("PUT", "/api/progress", { state: { xp: i }, tz: TZ });
    codes[r.status] = (codes[r.status] || 0) + 1;
  }
  // 120 get through: record() saves on every answer, so the fastest honest session — an answer a second for
  // a whole minute — must never meet the limit, let alone the "saqlanmadi" badge that follows it.
  assert.deepEqual(codes, { 200: 120, 429: 5 });

  const c = await signedUp();
  // More than a finished course with a note on every word, three years of activity and a tutor chat can be.
  const huge = { xp: 1, notes: { "1-0": "x".repeat(1_100_000) } };
  assert.equal((await c("PUT", "/api/progress", { state: huge, baseAt: null, tz: TZ })).status, 413);
  const saved = await c("PUT", "/api/progress", { state: { xp: 1 }, baseAt: null, tz: TZ });
  assert.equal(saved.status, 200);
  // A top-level key freshState() never creates is refused, and the rest of that batch is not stored either.
  const junk = await c("PATCH", "/api/progress", { baseAt: saved.data.updatedAt, tz: TZ, changes: [{ p: ["xp"], v: 9 }, { p: ["junk"], v: "x" }] });
  assert.equal(junk.status, 400);
  const after = (await c("GET", "/api/progress")).data;
  assert.deepEqual(after.state, { xp: 1 });
  assert.equal(after.updatedAt, saved.data.updatedAt);
});

test("push: only real push services are accepted; demo cannot subscribe", async () => {
  const c = await signedUp();
  const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
  for (const endpoint of ["http://127.0.0.1:9/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.uz/x", "not a url"]) {
    const r = await c("POST", "/api/push/subscribe", { subscription: { endpoint, keys }, tz: -300 });
    assert.equal(r.status, 400, endpoint);
  }
  const ok = await c("POST", "/api/push/subscribe", { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys }, tz: -300 });
  assert.equal(ok.status, 200);
  assert.equal((await c("POST", "/api/push/unsubscribe", { endpoint: "https://fcm.googleapis.com/fcm/send/abc123" })).status, 200);
  // No subscription left: the test button says so instead of pretending.
  assert.equal((await c("POST", "/api/push/test", {})).status, 404);

  const demo = client();
  assert.equal((await demo("POST", "/api/auth/demo", {})).status, 200);
  assert.equal((await demo("POST", "/api/push/subscribe", { subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/demo", keys } })).status, 403);

  const config = (await c("GET", "/api/config")).data;
  assert.match(config.push, /^[A-Za-z0-9_-]{80,}$/);
});

test("accounts: demo restrictions, one answer for every failed login, local-only reset links", async () => {
  const demo = client();
  await demo("POST", "/api/auth/demo", {});
  assert.equal((await demo("PATCH", "/api/account", { name: "x" })).status, 403);
  assert.equal((await demo("DELETE", "/api/account", {})).status, 403);

  const c = await signedUp();
  const email = (await c("GET", "/api/auth/me")).data.user.email;
  const other = client();
  // A wrong password, an address nobody registered and a password too long to hash all answer the same:
  // none of them tells the caller which accounts exist.
  const wrong = await other("POST", "/api/auth/login", { email, password: "wrong-one" });
  const unknown = await other("POST", "/api/auth/login", { email: `nobody${port}@mail.uz`, password: "wrong-one" });
  const huge = await other("POST", "/api/auth/login", { email, password: "x".repeat(5000) });
  for (const r of [wrong, unknown, huge]) {
    assert.equal(r.status, 401);
    assert.equal(r.data.error, "Email yoki parol noto'g'ri");
  }

  assert.ok((await other("POST", "/api/auth/forgot", { email })).data.devLink);
  assert.equal((await other("POST", "/api/auth/forgot", { email }, { "X-Forwarded-For": "1.2.3.4" })).data.devLink, undefined);
});

// Failures used to be counted per email and checked before the password, so ten guesses from any stranger
// locked the owner out for fifteen minutes.
test("login: guesses against an account never keep its owner out", async () => {
  const victim = await signedUp();
  const email = (await victim("GET", "/api/auth/me")).data.user.email;
  // The guesser is a separate client (own cookie jar) but the same IP — the harness cannot vary that, and it
  // makes the case harder: attacker and owner share every key the server could rate limit on.
  const attacker = client();
  for (let i = 0; i < 10; i++) {
    assert.equal((await attacker("POST", "/api/auth/login", { email, password: `guess-${i}` })).status, 401);
  }
  const owner = client();
  const signedIn = await owner("POST", "/api/auth/login", { email, password: "password1" });
  assert.equal(signedIn.status, 200);
  // A working session, not just a 200.
  assert.equal((await owner("GET", "/api/auth/me")).data.user.email, email);
});

test("responses carry security headers; the service worker gets a build fingerprint", async () => {
  const r = await fetch(`${BASE}/sw.js`);
  const body = await r.text();
  assert.match(body, /const VERSION = "upkorean-[0-9a-f]{12}"/);
  assert.equal(r.headers.get("cache-control"), "no-cache");
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  const js = await fetch(`${BASE}/js/examples.js`, { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(js.headers.get("content-encoding"), "gzip");
});
