// UpKorean server: static front-end + JSON API (auth, progress sync, leaderboard, AI tutor).
import "./env.js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import compression from "compression";
import { q, backupDb, lastBackupAt, BACKUP_DIR } from "./db.js";
import {
  hashPassword, verifyPassword, startSession, endSession, currentUser, requireAuth,
  publicUser, rateLimit, counter, randomToken, sha256, DEMO_EMAIL, isDemo,
} from "./auth.js";
import { tutorEnabled } from "./tutor.js";
import { mailEnabled, sendResetEmail } from "./mail.js";
import { tzOf, localTime, leaderboardXp } from "./progress.js";
import { PUSH_PUBLIC_KEY, PUSH_CONTACT, sendToUser, reminderTimes, runReminders } from "./push.js";
import "../public/js/sync.js"; // defines globalThis.UKSync, shared with the browser

const { UKSync } = globalThis;

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PROD = process.env.NODE_ENV === "production";
// Development conveniences are opt-in (`npm run dev`), so a server started without NODE_ENV is still safe.
const DEV = !PROD && process.argv.includes("--dev");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const DEMO = process.env.DEMO ? process.env.DEMO === "1" : DEV;
const AUDIO_DIR = path.resolve("audio");
// Narrator clips: audio/words/<id>.mp3 = word, audio/sentences/<id>.mp3 = example sentence.
const CLIP_DIR = AUDIO_DIR;
const clipCount = (kind) => {
  const dir = path.join(CLIP_DIR, kind);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^\d{1,2}-\d{1,2}\.mp3$/.test(name)).length : 0;
};
const WORD_CLIPS = clipCount("words"), SENTENCE_CLIPS = clipCount("sentences");
const HAS_CLIPS = WORD_CLIPS >= 1000 && SENTENCE_CLIPS >= 1000;
const PUBLIC_DIR = path.resolve("public");
const BACKUP_HOURS = process.env.BACKUP_HOURS === undefined ? 24 : Number(process.env.BACKUP_HOURS) || 0;
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP) || 14;

// Everything the page may load. Google Sign-In needs its script, button iframe and stylesheet.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  // Views set style="" attributes throughout, so inline styles stay allowed; inline scripts do not.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
  // Sign in with Google checks the page's origin from the referrer: "same-origin" hides it and the sign-in hangs.
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", CSP);
  if (PROD && req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});
app.use(compression());

app.get("/media/clip/:kind/:file", requireAuth, (req, res) => {
  const { kind, file } = req.params;
  if (!/^(words|sentences)$/.test(kind) || !/^\d{1,2}-\d{1,2}\.mp3$/.test(file)) return res.status(404).json({ error: "Audio topilmadi" });
  res.setHeader("Cache-Control", "private, max-age=604800");
  res.sendFile(path.join(CLIP_DIR, kind, file), (error) => { if (error && !res.headersSent) res.status(404).json({ error: "Audio topilmadi" }); });
});

const api = express.Router();
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
// A browser on this machine talking to the server directly — not through a reverse proxy.
const isLocalRequest = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) && !req.headers["x-forwarded-for"];
const noDemo = (req, res, next) => (isDemo(req.user) ? res.status(403).json({ error: "Demo hisobda bu amal o'chirilgan" }) : next());

// ---------- Config ----------
// `tutor` and `tutorComingSoon` are both false and stay in the payload on purpose: a browser still running
// a cached copy of the old front-end reads this object, and a missing key is not the same as a false one.
api.get("/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ google: GOOGLE_CLIENT_ID || null, tutor: false, tutorComingSoon: false, demo: DEMO, clips: HAS_CLIPS, mail: mailEnabled(), push: PUSH_PUBLIC_KEY });
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
  startSession(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
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
  startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
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
      if (t.aud !== GOOGLE_CLIENT_ID || t.azp !== GOOGLE_CLIENT_ID || !(Number(t.exp) * 1000 > Date.now())) return null;
      const who = await getJson("https://openidconnect.googleapis.com/v1/userinfo", { Authorization: `Bearer ${accessToken}` }).catch(() => ({}));
      return { sub: t.sub, email: t.email, email_verified: t.email_verified, given_name: who.given_name, name: who.name };
    }
    const info = await getJson(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const issOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
    if (info.aud !== GOOGLE_CLIENT_ID || !issOk || !(Number(info.exp) * 1000 > Date.now())) return null;
    return info;
  } catch {
    return null;
  }
}

api.post("/auth/google", authLimit, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: "Google orqali kirish sozlanmagan" });
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
  startSession(req, res, user.id);
  res.json({ user: publicUser(q.userById.get(user.id)), passwordCleared });
});

api.post("/auth/forgot", authLimit, (req, res) => {
  const email = validEmail(req.body.email);
  const user = email && q.userByEmail.get(email);
  const out = { ok: true };
  // Returning the link skips the mailbox check, so only a developer's own browser may get it.
  const devLink = DEV && isLocalRequest(req);
  // A token is created only when there is somewhere safe to send it. Without SMTP it would have nowhere to go
  // but the server log, and a reset link in a log is a working password for whoever can read the log.
  // The same answer whether or not the account exists, and no more than a few emails per address.
  if (user && !isDemo(user) && (mailEnabled() || devLink) && !resetRequests.blocked(email)) {
    resetRequests.add(email);
    const token = randomToken();
    q.insertReset.run(sha256(token), user.id, Date.now() + 30 * 60000);
    const link = `${APP_URL}/#/reset/${token}`;
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
  startSession(req, res, row.user_id);
  res.json({ user: publicUser(user) });
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
  startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
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
  startSession(req, res, req.user.id);
  res.json({ ok: true, user: publicUser(q.userById.get(req.user.id)) });
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
// server answers 409 with its current progress so the browser can merge both and try again.
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
  if (!isDemo(req.user)) {
    const t = reminderTimes(state);
    q.putReminders.run(req.user.id, tz, t.learn, t.review, t.streak);
  }
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

// ---------- Push reminders ----------
// The server sends requests to the subscription endpoint, so only real browser push services are accepted.
const PUSH_HOSTS = [".googleapis.com", ".push.apple.com", ".mozilla.com", ".notify.windows.com"];
function validSubscription(s) {
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 1000 || !s.keys) return null;
  let url;
  try { url = new URL(s.endpoint); } catch { return null; }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((h) => url.hostname.endsWith(h))) return null;
  const { p256dh, auth } = s.keys;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: s.endpoint, p256dh, auth };
}

api.post("/push/subscribe", requireAuth, noDemo, (req, res) => {
  const sub = validSubscription(req.body.subscription);
  if (!sub) return res.status(400).json({ error: "Bildirishnoma obunasi noto'g'ri" });
  q.putSub.run(sub.endpoint, req.user.id, sub.p256dh, sub.auth, Date.now());
  // Reminder times normally arrive with the progress; store them now too, in case no save follows soon.
  const row = q.getProgress.get(req.user.id);
  const t = reminderTimes(row ? JSON.parse(row.state) : null);
  q.putReminders.run(req.user.id, tzOf(req.body.tz), t.learn, t.review, t.streak);
  res.json({ ok: true });
});

api.post("/push/unsubscribe", requireAuth, (req, res) => {
  q.deleteUserSub.run(str(req.body.endpoint), req.user.id);
  res.json({ ok: true });
});

const pushTestLimit = rateLimit({ windowMs: 10 * 60000, max: 5, key: (req) => `p${req.user.id}` });
api.post("/push/test", requireAuth, noDemo, pushTestLimit, async (req, res) => {
  const delivered = await sendToUser(req.user.id, {
    title: "UpKorean eslatmalari ishlayapti",
    body: "Belgilangan vaqtda shu yerda xabar olasiz.",
    url: "/#/profile",
    tag: "test",
  });
  if (!delivered) return res.status(404).json({ error: "Bu hisobda faol bildirishnoma obunasi topilmadi" });
  res.json({ ok: true, delivered });
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

// The service worker caches the app shell under a version name, and index.html stamps the same id onto every
// script and stylesheet URL. The id is a fingerprint of the files in public/, so every deploy that changes a
// file makes browsers fetch the new shell and the new assets — no manual version bumps, no build step.
function publicFingerprint() {
  const hash = crypto.createHash("sha1");
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else { const st = fs.statSync(full); hash.update(`${full}:${st.size}:${st.mtimeMs};`); }
    }
  };
  walk(PUBLIC_DIR);
  return hash.digest("hex").slice(0, 12);
}
// Walked once, at startup, instead of on every /sw.js request. `npm run dev` edits public/ without
// restarting, so there the walk is repeated per request and nothing is cached for long.
const BUILD = publicFingerprint();
const buildId = () => (DEV ? publicFingerprint() : BUILD);

// index.html and sw.js carry __BUILD__ placeholders, so they are rendered rather than served from disk, and
// they must never be cached hard: they are what tells a browser that everything else has changed.
const stamped = (file, type) => (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.type(type).send(fs.readFileSync(path.join(PUBLIC_DIR, file), "utf8").replaceAll("__BUILD__", buildId()));
};
app.get("/sw.js", stamped("sw.js", "application/javascript"));
app.get(["/", "/index.html"], stamped("index.html", "html"));

const YEAR = 31536000;
app.use(express.static(PUBLIC_DIR, {
  extensions: ["html"],
  index: false, // "/" is rendered above
  setHeaders(res, filePath) {
    // A year of immutable caching is only safe for a URL that changes when the file does — that is, one
    // carrying this build's id. The same file asked for without it (an old cached page, a hand-typed URL)
    // gets a short cache and a revalidation instead.
    const versioned = !DEV && res.req && res.req.query && res.req.query.v === BUILD;
    if (DEV || /\.html$/i.test(filePath)) res.setHeader("Cache-Control", "no-cache");
    else if (/\.(?:js|css|woff2?)$/i.test(filePath)) res.setHeader("Cache-Control", versioned ? `public, max-age=${YEAR}, immutable` : "public, max-age=300");
    else res.setHeader("Cache-Control", "public, max-age=86400"); // icons, manifest — small, and named for their content
  },
}));

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
setInterval(() => runReminders().catch((err) => console.error("[push] reminders failed:", err)), 60000).unref();

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
  console.log(`  Eslatma:  Web Push yoqilgan (aloqa: ${PUSH_CONTACT})`);
  if (PROD && PUSH_CONTACT === "mailto:admin@example.com") console.log("  Eslatma: .env ga VAPID_SUBJECT=mailto:siz@domen.uz qo'ying — Apple push xizmati haqiqiy manzilni talab qiladi.");
  if (DEMO) console.log("  Demo hisob: yoqilgan");
  if (PROD && !process.env.TRUST_PROXY) console.log("  Eslatma: server proksi (nginx, Cloudflare) ortida bo'lsa, TRUST_PROXY=1 qo'ying.");
});
