// UpKorean server: the JSON API the mobile app talks to (auth, progress sync, course content, leaderboard).
import "./env.js";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import compression from "compression";
import { q, backupDb, lastBackupAt, BACKUP_DIR } from "./db.js";
import { AUDIO_DIR } from "./paths.js";
import { manifest as contentManifest, partBody, VERSION as CONTENT_VERSION, defaultLevel } from "./content.js";
import {
  hashPassword, verifyPassword, startSession, endSession, currentUser, requireAuth,
  publicUser, rateLimit, counter, randomToken, sha256, DEMO_EMAIL, isDemo,
} from "./auth.js";
import { tutorEnabled } from "./tutor.js";
import { mailEnabled, sendResetEmail } from "./mail.js";
import { tzOf, localTime, leaderboardXp } from "./progress.js";
import "../../packages/shared/sync.js"; // defines globalThis.UKSync, shared with the mobile app

const { UKSync } = globalThis;

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PROD = process.env.NODE_ENV === "production";
// Development conveniences are opt-in (`npm run dev`), so a server started without NODE_ENV is still safe.
const DEV = !PROD && process.argv.includes("--dev");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
// The mobile app signs in with its own OAuth clients, so a token issued to any of them is ours as well.
const GOOGLE_ANDROID_ID = process.env.GOOGLE_CLIENT_ID_ANDROID || "";
const GOOGLE_IOS_ID = process.env.GOOGLE_CLIENT_ID_IOS || "";
const GOOGLE_AUDIENCES = new Set([GOOGLE_CLIENT_ID, GOOGLE_ANDROID_ID, GOOGLE_IOS_ID].filter(Boolean));
const DEMO = process.env.DEMO ? process.env.DEMO === "1" : DEV;
// Narrator clips: audio/words/<id>.mp3 = word, audio/sentences/<id>.mp3 = example sentence,
// where <id> is the word id, level and all: "b-1-0.mp3".
const CLIP_FILE = /^[bma]-\d{1,2}-\d{1,2}\.mp3$/;
const CLIP_DIR = AUDIO_DIR;
const clipCount = (kind) => {
  const dir = path.join(CLIP_DIR, kind);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => CLIP_FILE.test(name)).length : 0;
};
const WORD_CLIPS = clipCount("words"), SENTENCE_CLIPS = clipCount("sentences");
const HAS_CLIPS = WORD_CLIPS >= 1000 && SENTENCE_CLIPS >= 1000;
// The oldest app build this server still serves; /api/config hands it to every app at startup.
const MIN_APP_VERSION = process.env.MIN_APP_VERSION || "1.0.0";
const YEAR = 31536000;
const BACKUP_HOURS = process.env.BACKUP_HOURS === undefined ? 24 : Number(process.env.BACKUP_HOURS) || 0;
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP) || 14;

// There is no website: the only HTML this server writes is the password-reset hand-off page, which has
// inline styles and nothing else.
const CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

let proxyWarned = false;
app.use((req, res, next) => {
  if (!proxyWarned && !process.env.TRUST_PROXY && req.headers["x-forwarded-for"]) {
    proxyWarned = true;
    console.warn("[ogohlantirish] So'rovlar proksi orqali kelyapti, lekin TRUST_PROXY qo'yilmagan: rate limit barcha foydalanuvchini bitta IP deb hisoblaydi. .env ga TRUST_PROXY=1 qo'shing.");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", CSP);
  if (PROD && req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});
app.use(compression());

// A native app is not a browser and CORS never applies to it, but the Expo dev tools run in one, so the API
// and the audio answer any origin. That is safe because there is no cookie session any more: the session
// travels as `Authorization: Bearer`, which a third-party page has no way to obtain.
function cors(req, res, next) {
  if (req.headers.origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-UK-Client");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

app.options("/media/clip/:kind/:file", cors);
app.get("/media/clip/:kind/:file", cors, requireAuth, (req, res) => {
  const { kind, file } = req.params;
  if (!/^(words|sentences)$/.test(kind) || !CLIP_FILE.test(file)) return res.status(404).json({ error: "Audio topilmadi" });
  res.setHeader("Cache-Control", "private, max-age=604800");
  res.sendFile(path.join(CLIP_DIR, kind, file), (error) => { if (error && !res.headersSent) res.status(404).json({ error: "Audio topilmadi" }); });
});

const api = express.Router();
api.use(cors); // before the JSON check below, so a preflight is answered rather than refused as non-JSON
api.use(express.json({ limit: "3mb" }));
// Mutating requests must be JSON: browsers can't send that cross-site without a CORS preflight.
api.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({ error: "So'rov JSON formatida bo'lishi kerak" });
  }
  next();
});

// Per IP. Kept loose because many learners share one address (mobile carrier NAT, dormitories, classrooms);
// guessing one account's password is slowed down by the counters below instead.
const authLimit = rateLimit({ windowMs: 10 * 60000, max: 60, key: (req) => req.ip });
// Failed logins are counted per (email, IP), never per email alone: a counter keyed on something the caller
// types in is a lockout anyone can trigger for anyone. This way a guesser only ever slows itself down.
const loginFailures = counter({ windowMs: 15 * 60000, max: 10 });
const loginKey = (req, email) => `${email} ${req.ip}`;
const resetRequests = counter({ windowMs: 15 * 60000, max: 3 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === "string" ? v : "");
function validName(name) { name = str(name).trim(); return name.length >= 1 && name.length <= 60 ? name : null; }
function validEmail(email) { email = str(email).trim().toLowerCase(); return EMAIL_RE.test(email) && email.length <= 200 ? email : null; }
function validPassword(pw) { pw = str(pw); return pw.length >= 8 && pw.length <= 200 ? pw : null; }
// A client on this machine talking to the server directly — not through a reverse proxy.
const isLocalRequest = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) && !req.headers["x-forwarded-for"];
const noDemo = (req, res, next) => (isDemo(req.user) ? res.status(403).json({ error: "Demo hisobda bu amal o'chirilgan" }) : next());

// ---------- Config ----------
api.get("/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    google: GOOGLE_CLIENT_ID || null,
    googleAndroid: GOOGLE_ANDROID_ID || null,
    googleIos: GOOGLE_IOS_ID || null,
    demo: DEMO, clips: HAS_CLIPS, mail: mailEnabled(),
    contentVersion: CONTENT_VERSION,
    defaultLevel,
    // The oldest app build this server still answers. Raise it only for a change the app cannot be made to
    // survive; every app checks it at startup and asks the learner to update.
    minAppVersion: MIN_APP_VERSION,
  });
});

// ---------- Course content ----------
// Public: this is the course, not anyone's
// progress. The app asks for the manifest, compares the version with what it has stored, and downloads
// only the parts that moved.
api.get("/content", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.json(contentManifest());
});

api.get("/content/:level/:part", (req, res) => {
  const body = partBody(req.params.level, req.params.part);
  if (!body) return res.status(404).json({ error: "Topilmadi" });
  const tag = `"${CONTENT_VERSION}-${req.params.level}-${req.params.part}"`;
  res.setHeader("ETag", tag);
  // `?v=<version>` can only ever name this content, so it is cached for a year. Asked for without one, the
  // app revalidates instead and an unchanged part comes back as a 304 with no body at all.
  res.setHeader("Cache-Control", req.query.v === CONTENT_VERSION ? `public, max-age=${YEAR}, immutable` : "public, max-age=300");
  if (req.headers["if-none-match"] === tag) return res.status(304).end();
  res.type("application/json").send(body);
});

// ---------- Auth ----------
api.post("/auth/register", authLimit, (req, res) => {
  const name = validName(req.body.name), email = validEmail(req.body.email), pw = validPassword(req.body.password);
  if (!name) return res.status(400).json({ error: "Ismingizni kiriting", field: "name" });
  if (!email) return res.status(400).json({ error: "Email manzil noto'g'ri", field: "email" });
  if (!pw) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo'lsin", field: "password" });
  if (email === DEMO_EMAIL || q.userByEmail.get(email)) return res.status(409).json({ error: "Bu email bilan hisob allaqachon mavjud", field: "email" });
  const { lastInsertRowid } = q.insertUser.run(email, name, hashPassword(pw), null);
  const user = q.userById.get(lastInsertRowid);
  const session = startSession(req, res, user.id);
  res.status(201).json({ user: publicUser(user), ...session });
});

api.post("/auth/login", authLimit, async (req, res) => {
  const email = validEmail(req.body.email);
  // Over-long passwords are refused before hashing: scrypt is deliberately expensive, so it must not run on
  // input nobody could have registered with.
  const pw = validPassword(req.body.password);
  const key = email ? loginKey(req, email) : "";
  // Nothing is consulted before the password itself, so the right password always gets in, no matter how many
  // failures came before it. Only failures are counted, and they cost the guesser a growing wait.
  const user = email && pw && q.userByEmail.get(email);
  if (!user || isDemo(user) || !verifyPassword(pw, user.pass_hash)) {
    if (key) {
      loginFailures.add(key);
      const wait = loginFailures.delay(key);
      if (wait) await new Promise((done) => setTimeout(done, wait));
    }
    // The same answer for a wrong password, an unknown address and a held-back client: none of them says
    // whether the account exists.
    return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
  }
  loginFailures.clear(key);
  const session = startSession(req, res, user.id);
  res.json({ user: publicUser(user), ...session });
});

api.post("/auth/logout", (req, res) => { endSession(req, res); res.json({ ok: true }); });

api.get("/auth/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Tizimga kirilmagan" });
  res.json({ user: publicUser(user) });
});

// Who a Google token belongs to, or null. The sign-in button sends an OAuth access token; an ID token
// ("credential") is still accepted from pages loaded before the switch.
async function googleIdentity({ credential, accessToken }) {
  const getJson = async (url, headers) => {
    const r = await fetch(url, { headers });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || "invalid token");
    return data;
  };
  try {
    if (accessToken) {
      const t = await getJson(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
      // The token must have been issued to this app, or any site's Google token could sign in here.
      if (!GOOGLE_AUDIENCES.has(t.aud) || !GOOGLE_AUDIENCES.has(t.azp) || !(Number(t.exp) * 1000 > Date.now())) return null;
      const who = await getJson("https://openidconnect.googleapis.com/v1/userinfo", { Authorization: `Bearer ${accessToken}` }).catch(() => ({}));
      return { sub: t.sub, email: t.email, email_verified: t.email_verified, given_name: who.given_name, name: who.name };
    }
    const info = await getJson(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const issOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
    if (!GOOGLE_AUDIENCES.has(info.aud) || !issOk || !(Number(info.exp) * 1000 > Date.now())) return null;
    return info;
  } catch {
    return null;
  }
}

api.post("/auth/google", authLimit, async (req, res) => {
  if (!GOOGLE_AUDIENCES.size) return res.status(400).json({ error: "Google orqali kirish sozlanmagan" });
  const credential = str(req.body.credential), accessToken = str(req.body.accessToken);
  if (!credential && !accessToken) return res.status(400).json({ error: "Google tokeni yo'q" });
  const info = await googleIdentity({ credential, accessToken });
  if (!info || !info.sub || String(info.email_verified) !== "true" || !validEmail(info.email)) {
    return res.status(401).json({ error: "Google tokeni tasdiqlanmadi" });
  }
  const email = info.email.toLowerCase();
  if (email === DEMO_EMAIL) return res.status(401).json({ error: "Google tokeni tasdiqlanmadi" });
  let user = q.userByGoogle.get(info.sub);
  let passwordCleared = false;
  if (!user) {
    user = q.userByEmail.get(email);
    if (user && user.google_sub) {
      return res.status(409).json({ error: "Bu email boshqa Google hisobiga ulangan" });
    }
    if (user) {
      // Google has verified this address; our sign-up never did. Whoever registered it with a password may not
      // own the mailbox, so the verified owner takes over: the old password, sessions and reset links stop working.
      if (user.pass_hash) {
        q.setPassword.run(null, user.id);
        q.deleteUserSessions.run(user.id);
        q.deleteResets.run(user.id);
        passwordCleared = true;
      }
      q.setGoogle.run(info.sub, user.id);
    } else {
      const { lastInsertRowid } = q.insertUser.run(email, (info.given_name || info.name || email.split("@")[0]).slice(0, 60), null, info.sub);
      user = q.userById.get(lastInsertRowid);
    }
  }
  const session = startSession(req, res, user.id);
  res.json({ user: publicUser(q.userById.get(user.id)), passwordCleared, ...session });
});

api.post("/auth/forgot", authLimit, (req, res) => {
  const email = validEmail(req.body.email);
  const user = email && q.userByEmail.get(email);
  const out = { ok: true };
  // Returning the link skips the mailbox check, so only a request from the developer's own machine may get it.
  const devLink = DEV && isLocalRequest(req);
  // A token is created only when there is somewhere safe to send it. Without SMTP it would have nowhere to go
  // but the server log, and a reset link in a log is a working password for whoever can read the log.
  // The same answer whether or not the account exists, and no more than a few emails per address.
  if (user && !isDemo(user) && (mailEnabled() || devLink) && !resetRequests.blocked(email)) {
    resetRequests.add(email);
    const token = randomToken();
    q.insertReset.run(sha256(token), user.id, Date.now() + 30 * 60000);
    const link = `${APP_URL}/reset/${token}`;
    // Not awaited: waiting for SMTP would make "account exists" answers measurably slower.
    if (mailEnabled()) sendResetEmail(email, user.name, link).catch((err) => console.error(`[password reset] email to ${email} failed:`, err.message));
    if (devLink) out.devLink = link;
  }
  res.json(out);
});

api.post("/auth/reset", authLimit, (req, res) => {
  const pw = validPassword(req.body.password);
  if (!pw) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo'lsin", field: "password" });
  const row = q.resetUser.get(sha256(str(req.body.token)), Date.now());
  if (!row) return res.status(400).json({ error: "Havola eskirgan yoki noto'g'ri. Qaytadan so'rang." });
  q.setPassword.run(hashPassword(pw), row.user_id);
  q.deleteResets.run(row.user_id);
  q.deleteUserSessions.run(row.user_id);
  const user = q.userById.get(row.user_id);
  loginFailures.clear(loginKey(req, user.email));
  const session = startSession(req, res, row.user_id);
  res.json({ user: publicUser(user), ...session });
});

api.post("/auth/demo", authLimit, (req, res) => {
  if (!DEMO) return res.status(404).json({ error: "Demo o'chirilgan" });
  let user = q.userByEmail.get(DEMO_EMAIL);
  if (!user) {
    const { lastInsertRowid } = q.insertUser.run(DEMO_EMAIL, "Aziza Karimova", null, null);
    user = q.userById.get(lastInsertRowid);
  }
  // Every visitor starts from the sample progress instead of whatever the previous visitor left behind.
  q.deleteProgress.run(user.id);
  const session = startSession(req, res, user.id);
  res.json({ user: publicUser(user), ...session });
});

// ---------- Account ----------
api.patch("/account", requireAuth, noDemo, (req, res) => {
  const name = validName(req.body.name);
  if (!name) return res.status(400).json({ error: "Ismingizni kiriting", field: "name" });
  q.setName.run(name, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

api.post("/account/password", requireAuth, noDemo, authLimit, (req, res) => {
  const next = validPassword(req.body.next);
  if (!next) return res.status(400).json({ error: "Yangi parol kamida 8 belgidan iborat bo'lsin", field: "next" });
  if (req.user.pass_hash && !verifyPassword(str(req.body.current), req.user.pass_hash)) {
    return res.status(401).json({ error: "Joriy parol noto'g'ri", field: "current" });
  }
  q.setPassword.run(hashPassword(next), req.user.id);
  q.deleteUserSessions.run(req.user.id);
  const session = startSession(req, res, req.user.id);
  res.json({ ok: true, user: publicUser(q.userById.get(req.user.id)), ...session });
});

api.delete("/account", requireAuth, noDemo, (req, res) => {
  if (req.user.pass_hash && !verifyPassword(str(req.body.password), req.user.pass_hash)) {
    return res.status(401).json({ error: "Parol noto'g'ri", field: "password" });
  }
  q.deleteUser.run(req.user.id);
  endSession(req, res);
  res.json({ ok: true });
});

// ---------- Progress ----------
// Each save names the server version it started from (baseAt). If another device saved in between, the
// server answers 409 with its current progress so the app can merge both and try again.
const progressConflict = (res, row) => res.status(409).json({
  error: "Progress boshqa qurilmada o'zgargan",
  conflict: true,
  state: row ? JSON.parse(row.state) : null,
  updatedAt: row ? row.updated_at : null,
  rev: row ? row.rev : null,
});

function storeProgress(req, res, state, row) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return res.status(400).json({ error: "Noto'g'ri ma'lumot" });
  const json = JSON.stringify(state);
  // The largest progress a learner can reach is ~575 KB: all 1000 course words scheduled (~150 KB), a
  // 140-character note on each (~150 KB), an activity entry and a finished challenge for every day of three
  // years (~170 KB) and one full 80-message tutor conversation (~95 KB). Anything past 1 MB is not progress.
  if (json.length > 1_000_000) return res.status(413).json({ error: "Ma'lumot hajmi juda katta" });
  // Strictly increasing, so two saves within one millisecond still get different versions.
  const now = Math.max(Date.now(), row ? row.updated_at + 1 : 0);
  const tz = tzOf(req.body.tz);
  const week = leaderboardXp(state, row, now, tz);
  // The demo account's sample XP is not a real learner's, so it never enters the leaderboard.
  if (isDemo(req.user)) week.xp = 0;
  const rev = typeof req.body.rev === "string" ? req.body.rev.slice(0, 40) : null;
  q.putProgress.run(req.user.id, json, Math.max(0, Math.round(Number(state.xp) || 0)), week.week, week.xp, now, rev);
  res.json({ ok: true, updatedAt: now, rev });
}

api.get("/progress", requireAuth, (req, res) => {
  const row = q.getProgress.get(req.user.id);
  res.json({ state: row ? JSON.parse(row.state) : null, updatedAt: row ? row.updated_at : null, rev: row ? row.rev : null });
});

// Every save parses the stored state and writes SQLite synchronously on the one event loop, so no account
// gets to hammer it. The ceiling is set off the fastest honest session: record() saves on every answer and
// the 700 ms debounce turns that into one request per answer, so a learner answering once a second reaches
// 60 a minute. Double that leaves room for conflict retries without letting a loop through.
const progressLimit = rateLimit({ windowMs: 60000, max: 120, key: (req) => `pg${req.user.id}` });

// Whole progress. Without baseAt (older app versions) it simply overwrites.
api.put("/progress", requireAuth, progressLimit, (req, res) => {
  const row = q.getProgress.get(req.user.id);
  if ("baseAt" in req.body && (row ? row.updated_at : null) !== req.body.baseAt) return progressConflict(res, row);
  storeProgress(req, res, req.body.state, row);
});

// Only what changed since baseAt: { baseAt, changes: [{ p: ["words", "1-3"], v: {...} }, ...] }.
api.patch("/progress", requireAuth, progressLimit, (req, res) => {
  const row = q.getProgress.get(req.user.id);
  if (!row || row.updated_at !== req.body.baseAt) return progressConflict(res, row);
  const state = JSON.parse(row.state);
  if (!UKSync.applyChanges(state, req.body.changes)) return res.status(400).json({ error: "Noto'g'ri ma'lumot" });
  storeProgress(req, res, state, row);
});

// ---------- Leaderboard (this week's XP) ----------
api.get("/leaderboard", requireAuth, (req, res) => {
  const rows = q.leaderboard.all(localTime(Date.now(), tzOf(req.query.tz)).week);
  const shortName = (n) => { const [a, b] = String(n).trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; };
  const list = rows.map((r, i) => ({ rank: i + 1, name: shortName(r.name), xp: r.week_xp, me: r.id === req.user.id }));
  const top = list.slice(0, 5);
  const mine = list.find((r) => r.me);
  if (mine && mine.rank > 5) top.push(mine);
  res.json({ rows: top, total: list.length });
});

// ---------- AI tutor ----------
// Switched off end to end. There used to be a POST /tutor here that only ever answered 503, a client module
// (public/js/tutor.js) nothing routed to, and a "tez kunda" button on the day-done screen — a flagship
// feature that had been about to ship for long enough to read as abandonment.
// server/tutor.js — the Claude call, its response schema and the prompt — is kept and is the part worth
// keeping; deploy/README.md ("AI ustozni qaytarish") lists what to restore to turn the feature on.

api.use((req, res) => res.status(404).json({ error: "Topilmadi" }));
api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Ma'lumot hajmi juda katta" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON noto'g'ri" });
  console.error(err);
  res.status(500).json({ error: "Serverda xatolik" });
});

app.use("/api", api);

// The one page this server generates, and it is generated because the token is in the path. The token
// matches [A-Za-z0-9_-] before it gets here, so it cannot carry markup; it is still only ever written into
// text and an href, never into a script.
const resetPage = (token) => `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Parolni tiklash — UpKorean</title>
<style>
:root{--bg:#E8E9E6;--card:#FFF;--ink:#102221;--ink2:#48605C;--green:#1B6F65;--line:#DCDEDA}
@media (prefers-color-scheme:dark){:root{--bg:#101613;--card:#19211D;--ink:#E7EDEA;--ink2:#9FADA8;--green:#2A9384;--line:#242D28}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{width:100%;max-width:440px;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:30px 26px}
h1{margin:0 0 10px;font-size:25px;letter-spacing:-.02em}
p{margin:0 0 18px;color:var(--ink2);font-size:15px}
a.btn{display:block;background:var(--green);color:#fff;text-align:center;text-decoration:none;font-weight:700;padding:16px;border-radius:16px}
code{display:block;margin-top:18px;padding:14px;border-radius:12px;background:var(--bg);border:1px solid var(--line);font:13px/1.5 ui-monospace,monospace;word-break:break-all;color:var(--ink2)}
small{display:block;margin-top:14px;color:var(--ink2);font-size:13px}
</style></head><body><main>
${token ? `<h1>Yangi parol o'rnatish</h1>
<p>Quyidagi tugma UpKorean ilovasini ochadi va yangi parol sahifasiga olib boradi. Havola 30 daqiqa amal qiladi.</p>
<a class="btn" href="upkorean://reset/${token}">Ilovada ochish</a>
<small>Tugma ishlamasa, ilovani oching → Kirish → <b>Parolni unutdingizmi?</b> → <b>Kodim bor</b>, va quyidagi kodni kiriting:</small>
<code>${token}</code>`
  : `<h1>Havola ishlamadi</h1>
<p>Havola eskirgan yoki to'liq nusxalanmagan. Ilovadan yangi havola so'rang: Kirish → Parolni unutdingizmi?</p>`}
</main></body></html>`;

// ---------- Password reset hand-off ----------
// The reset link is opened in a mail app, on a phone or on a desktop, and what it has to reach is the app.
// A custom scheme alone cannot be clicked from every mail client, so the link is an ordinary https one and
// this page is the doorway: it opens `upkorean://reset/<token>` and, for the cases where that fails, shows
// the code to type in by hand. The token is never rendered into a script or a query string — only into the
// text of the page and the scheme link — and the page is told not to be cached or indexed.
app.get("/reset/:token", (req, res) => {
  const token = String(req.params.token || "");
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return res.status(404).type("html").send(resetPage(null));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.type("html").send(resetPage(token));
});

q.purgeSessions.run(Date.now());
q.purgeResets.run(Date.now());
const demoUser = q.userByEmail.get(DEMO_EMAIL);
if (demoUser) {
  // Older versions gave the demo account a published password; it is entered only through the demo button now.
  if (demoUser.pass_hash) q.setPassword.run(null, demoUser.id);
  if (!DEMO) q.deleteUserSessions.run(demoUser.id);
}
// Checked hourly and at startup, so a backup is still taken on schedule when the server restarts often.
function backupIfDue() {
  if (!BACKUP_HOURS || Date.now() - lastBackupAt() < BACKUP_HOURS * 3600000) return;
  try { console.log(`[backup] ${backupDb(BACKUP_KEEP)}`); } catch (err) { console.error("[backup] failed:", err.message); }
}
backupIfDue();
setInterval(() => {
  q.purgeSessions.run(Date.now());
  q.purgeResets.run(Date.now());
  backupIfDue();
}, 3600000).unref();

// Without SMTP nobody can reset a password on a live site, and the old fallback (the link in the server log)
// handed an account to anyone who can read the log. So a production server says so and stops instead.
if (PROD && !mailEnabled()) {
  console.error("Xatolik: NODE_ENV=production uchun SMTP sozlanishi shart. .env ga SMTP_HOST (va SMTP_USER, SMTP_PASS, MAIL_FROM) qo'shing — ularsiz parolni tiklash havolasini yuborib bo'lmaydi. Namuna: .env.example");
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`UpKorean → ${APP_URL}`);
  console.log(`  AI ustoz: o'chirilgan — ilovada kirish nuqtasi yo'q${tutorEnabled() ? " (server tarafi tayyor: ANTHROPIC_API_KEY topildi)" : ""}`);
  console.log(`  Google:   ${GOOGLE_CLIENT_ID ? "yoqilgan" : "o'chirilgan (GOOGLE_CLIENT_ID yo'q)"}`);
  console.log(`  Email:    ${mailEnabled() ? "yoqilgan (SMTP)" : `o'chirilgan — parolni tiklash havolasi yuborilmaydi${DEV ? ", faqat shu kompyuterdagi brauzerga ko'rsatiladi" : ""} (SMTP_HOST yo'q)`}`);
  console.log(`  Audio:    diktor bo'laklari ${WORD_CLIPS}/1000 so'z, ${SENTENCE_CLIPS}/1000 gap`);
  console.log(`  Backup:   ${BACKUP_HOURS ? `har ${BACKUP_HOURS} soatda, oxirgi ${BACKUP_KEEP} tasi → ${BACKUP_DIR}` : "o'chirilgan (BACKUP_HOURS=0)"}`);
  if (DEMO) console.log("  Demo hisob: yoqilgan");
  if (PROD && !process.env.TRUST_PROXY) console.log("  Eslatma: server proksi (nginx, Cloudflare) ortida bo'lsa, TRUST_PROXY=1 qo'ying.");
});
