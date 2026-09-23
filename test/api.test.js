// Starts the real server on a throwaway database and exercises the HTTP API.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localTime } from "../apps/api/progress.js";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "upkorean-api-"));
const port = 20000 + Math.floor(Math.random() * 20000);
const BASE = `http://127.0.0.1:${port}`;
let server;

before(async () => {
  server = spawn(process.execPath, ["--no-warnings", "apps/api/index.js", "--dev"], {
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

// The app: no cookie jar, the session travels as a bearer token.
function client() {
  let token = "";
  const call = async (method, url, body, headers = {}) => {
    const res = await fetch(BASE + url, {
      method,
      headers: {
        "X-UK-Client": "mobile/1.0.0",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    if (data && data.token) token = data.token;
    return { status: res.status, data, headers: res.headers };
  };
  call.token = () => token;
  return call;
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
  // The guesser is a separate client (own session) but the same IP — the harness cannot vary that, and it
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

test("there is no website: the root and the old browser app's files answer 404", async () => {
  for (const gone of ["/", "/index.html", "/privacy.html", "/icon.svg", "/sw.js", "/js/app.js", "/manifest.webmanifest"]) {
    assert.equal((await fetch(BASE + gone)).status, 404, gone);
  }
});

// ---------- The mobile app's side of the API ----------

test("an app signs in with a bearer token, never a cookie", async () => {
  const app = client();
  const email = `app1-${port}@mail.uz`;
  const up = await app("POST", "/api/auth/register", { name: "App User", email, password: "password1" });
  assert.equal(up.status, 201);
  // The token is in the body, and no cookie was set: an app has nowhere to keep one.
  assert.match(up.data.token, /^[\w-]{20,}$/);
  assert.ok(up.data.expiresAt > Date.now());
  assert.equal(up.headers.get("set-cookie"), null);

  // That token really is a session.
  assert.equal((await app("GET", "/api/auth/me")).data.user.email, email);
  assert.equal((await app("PUT", "/api/progress", { state: { xp: 7 }, baseAt: null, rev: "m1" })).status, 200);
  assert.deepEqual((await app("GET", "/api/progress")).data.state, { xp: 7 });
  // Audio is behind the same session.
  assert.equal((await fetch(`${BASE}/media/clip/words/b-1-0.mp3`)).status, 401);
  assert.equal((await fetch(`${BASE}/media/clip/words/b-1-0.mp3`, { headers: { Authorization: `Bearer ${app.token()}` } })).status, 200);

  // A second device has its own session, and logging out ends only the one that asked.
  const tablet = client();
  assert.equal((await tablet("POST", "/api/auth/login", { email, password: "password1" })).status, 200);
  assert.equal((await app("POST", "/api/auth/logout", {})).status, 200);
  const dead = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${app.token()}` } });
  assert.equal(dead.status, 401);
  assert.equal((await tablet("GET", "/api/auth/me")).status, 200);
});

test("changing the password hands the app a new token and drops the old one", async () => {
  const app = client();
  const email = `app2-${port}@mail.uz`;
  await app("POST", "/api/auth/register", { name: "App User", email, password: "password1" });
  const before = app.token();
  const changed = await app("POST", "/api/account/password", { current: "password1", next: "password2" });
  assert.equal(changed.status, 200);
  assert.notEqual(changed.data.token, before);
  assert.equal((await app("GET", "/api/auth/me")).status, 200); // the new token works
  const old = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${before}` } });
  assert.equal(old.status, 401); // the old one does not
});

test("course content is served per level, versioned and revalidatable", async () => {
  const manifest = await (await fetch(`${BASE}/api/content`)).json();
  assert.match(manifest.version, /^[0-9a-f]{12}$/);
  assert.deepEqual(manifest.levels.map((l) => l.id), ["b", "m", "a"]);

  const [beginner, ...rest] = manifest.levels;
  assert.equal(beginner.locked, false);
  assert.ok(beginner.words > 0);
  assert.deepEqual(beginner.parts.map((p) => p.name), ["vocab", "examples", "roots"]);
  // A level whose words are not written yet is announced and shut, not hidden.
  for (const level of rest) {
    assert.equal(level.locked, true);
    assert.equal(level.words, 0);
    assert.deepEqual(level.parts, []);
  }

  const config = await (await fetch(`${BASE}/api/config`)).json();
  assert.equal(config.contentVersion, manifest.version);
  assert.equal(config.defaultLevel, "b");

  // No sign-in: the course is public, as it has always been.
  const vocab = await fetch(`${BASE}/api/content/b/vocab?v=${manifest.version}`);
  assert.equal(vocab.status, 200);
  assert.match(vocab.headers.get("cache-control"), /immutable/);
  const data = await vocab.json();
  assert.equal(data.words.length, beginner.words);
  assert.deepEqual(Object.keys(data.words[0]).sort(), ["day", "i", "id", "ko", "level", "uz"]);
  // A word carries its level in its name, so progress from two levels can never collide.
  assert.equal(data.words[0].id, "b-1-0");

  // Asked for without the version, an unchanged part comes back as a 304 with no body.
  const etag = vocab.headers.get("etag");
  const again = await fetch(`${BASE}/api/content/b/vocab`, { headers: { "If-None-Match": etag } });
  assert.equal(again.status, 304);

  assert.equal((await fetch(`${BASE}/api/content/b/passwords`)).status, 404);
  assert.equal((await fetch(`${BASE}/api/content/m/vocab`)).status, 404); // locked level, nothing to send
});

// A page on another site may reach the API, but only signed out: no Allow-Credentials, and there is no
// cookie to attach — the session is a bearer token only the app holds.
test("the API answers other origins, but never with credentials", async () => {
  const preflight = await fetch(`${BASE}/api/progress`, {
    method: "OPTIONS",
    headers: { Origin: "http://evil.example", "Access-Control-Request-Method": "PUT" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
  assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
  assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/);

  const plain = await fetch(`${BASE}/api/config`);
  assert.equal(plain.headers.get("access-control-allow-origin"), null); // same-origin requests are untouched
});
