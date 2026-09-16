// Starts the real server on a throwaway database and exercises the HTTP API.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

test("leaderboard: capped XP in the learner's own week", async () => {
  const c = await signedUp("Lola Karimova");
  const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10); // Tashkent date
  await c("PUT", "/api/progress", { state: { xp: 1, act: { [today]: { xp: 999999 }, "2099-01-01": { xp: 5000 } } }, baseAt: null, tz: -300 });
  const board = await c("GET", "/api/leaderboard?tz=-300");
  const me = board.data.rows.find((r) => r.me);
  assert.equal(me.name, "Lola K.");
  assert.ok(me.xp <= 5000 && me.xp > 0, `xp ${me.xp}`);
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

test("accounts: demo restrictions, login lockout, local-only reset links", async () => {
  const demo = client();
  await demo("POST", "/api/auth/demo", {});
  assert.equal((await demo("PATCH", "/api/account", { name: "x" })).status, 403);
  assert.equal((await demo("DELETE", "/api/account", {})).status, 403);

  const c = await signedUp();
  const email = (await c("GET", "/api/auth/me")).data.user.email;
  const other = client();
  for (let i = 0; i < 10; i++) assert.equal((await other("POST", "/api/auth/login", { email, password: "wrong-one" })).status, 401);
  assert.equal((await other("POST", "/api/auth/login", { email, password: "password1" })).status, 429);

  assert.ok((await other("POST", "/api/auth/forgot", { email })).data.devLink);
  assert.equal((await other("POST", "/api/auth/forgot", { email }, { "X-Forwarded-For": "1.2.3.4" })).data.devLink, undefined);
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
