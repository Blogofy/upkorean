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

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PROD = process.env.NODE_ENV === "production";
// Development conveniences are opt-in (`npm run dev`), so a server started without NODE_ENV is still safe.
const DEV = !PROD && process.argv.includes("--dev");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const TUTOR_COMING_SOON = true;
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
  res.setHeader("Referrer-Policy", "same-origin");
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
// guessing one account's password is stopped by the per-email counters below instead.
const authLimit = rateLimit({ windowMs: 10 * 60000, max: 60, key: (req) => req.ip });
const loginFailures = counter({ windowMs: 15 * 60000, max: 10 });
const resetRequests = counter({ windowMs: 15 * 60000, max: 3 });
const tutorLimit = rateLimit({ windowMs: 10 * 60000, max: 40, key: (req) => `t${req.user.id}` });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === "string" ? v : "");
function validName(name) { name = str(name).trim(); return name.length >= 1 && name.length <= 60 ? name : null; }
function validEmail(email) { email = str(email).trim().toLowerCase(); return EMAIL_RE.test(email) && email.length <= 200 ? email : null; }
function validPassword(pw) { pw = str(pw); return pw.length >= 8 && pw.length <= 200 ? pw : null; }
// A browser on this machine talking to the server directly — not through a reverse proxy.
const isLocalRequest = (req) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) && !req.headers["x-forwarded-for"];
const noDemo = (req, res, next) => (isDemo(req.user) ? res.status(403).json({ error: "Demo hisobda bu amal o'chirilgan" }) : next());

// ---------- Config ----------
api.get("/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ google: GOOGLE_CLIENT_ID || null, tutor: false, tutorComingSoon: TUTOR_COMING_SOON, demo: DEMO, clips: HAS_CLIPS, mail: mailEnabled() });
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

api.post("/auth/login", authLimit, (req, res) => {
  const email = validEmail(req.body.email);
  const wait = email ? loginFailures.blocked(email) : 0;
  if (wait) {
    res.setHeader("Retry-After", wait);
    return res.status(429).json({ error: `Bu hisobga juda ko'p noto'g'ri urinish bo'ldi. ${Math.ceil(wait / 60)} daqiqadan keyin qayta urinib ko'ring yoki parolni tiklang.` });
  }
  const user = email && q.userByEmail.get(email);
  if (!user || isDemo(user) || !verifyPassword(str(req.body.password), user.pass_hash)) {
    if (email) loginFailures.add(email);
    return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
  }
  loginFailures.clear(email);
  startSession(req, res, user.id);
  res.json({ user: publicUser(user) });
});

api.post("/auth/logout", (req, res) => { endSession(req, res); res.json({ ok: true }); });

api.get("/auth/me", (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Tizimga kirilmagan" });
  res.json({ user: publicUser(user) });
});

api.post("/auth/google", authLimit, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(400).json({ error: "Google orqali kirish sozlanmagan" });
  const credential = str(req.body.credential);
  if (!credential) return res.status(400).json({ error: "Google tokeni yo'q" });
  let info;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    info = await r.json();
    if (!r.ok) throw new Error(info.error_description || "invalid token");
  } catch {
    return res.status(401).json({ error: "Google tokeni tasdiqlanmadi" });
  }
  const issOk = info.iss === "accounts.google.com" || info.iss === "https://accounts.google.com";
  const notExpired = Number(info.exp) * 1000 > Date.now();
  if (info.aud !== GOOGLE_CLIENT_ID || !issOk || !notExpired || String(info.email_verified) !== "true" || !validEmail(info.email)) {
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
  // The same answer whether or not the account exists, and no more than a few emails per address.
  if (user && !isDemo(user) && !resetRequests.blocked(email)) {
    resetRequests.add(email);
    const token = randomToken();
    q.insertReset.run(sha256(token), user.id, Date.now() + 30 * 60000);
    const link = `${APP_URL}/#/reset/${token}`;
    if (mailEnabled()) {
      // Not awaited: waiting for SMTP would make "account exists" answers measurably slower.
      sendResetEmail(email, user.name, link).catch((err) => console.error(`[password reset] email to ${email} failed:`, err.message));
    } else {
      // No email provider yet: the link goes to the server log so an administrator can pass it on.
      console.log(`[password reset] ${email}: ${link}`);
    }
    // Returning the link skips the mailbox check, so only a developer's own browser may get it.
    if (DEV && isLocalRequest(req)) out.devLink = link;
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
  loginFailures.clear(user.email);
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
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const mondayOf = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const weekKey = (d) => dayKey(mondayOf(d));

// Progress is computed in the browser, so the server cannot prove the XP is real. It can make faking it
// pointless for the leaderboard: no day counts for more than a very busy day of study, and the weekly
// total grows no faster than a fast learner earns it (it catches up within a minute or two after a bonus).
const DAY_XP_CAP = 5000;
const XP_PER_MIN = 150;

function leaderboardXp(state, prev, now) {
  const monday = mondayOf(new Date(now));
  const wk = dayKey(monday);
  const sunday = dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
  let claimed = 0;
  for (const [k, a] of Object.entries(state.act || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < wk || k > sunday || !a || !Number.isFinite(a.xp)) continue;
    claimed += Math.min(Math.max(a.xp, 0), DAY_XP_CAP);
  }
  const sameWeek = prev && prev.week_key === wk;
  const base = sameWeek ? prev.week_xp : 0;
  const since = sameWeek ? prev.updated_at : monday.getTime();
  const allowed = base + (XP_PER_MIN * Math.max(0, now - since)) / 60000;
  return { wk, xp: Math.round(Math.min(claimed, allowed)) };
}

api.get("/progress", requireAuth, (req, res) => {
  const row = q.getProgress.get(req.user.id);
  res.json({ state: row ? JSON.parse(row.state) : null, updatedAt: row ? row.updated_at : null });
});

api.put("/progress", requireAuth, (req, res) => {
  const state = req.body && req.body.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return res.status(400).json({ error: "Noto'g'ri ma'lumot" });
  const json = JSON.stringify(state);
  if (json.length > 2_500_000) return res.status(413).json({ error: "Ma'lumot hajmi juda katta" });
  const now = Date.now();
  const week = leaderboardXp(state, q.getWeek.get(req.user.id), now);
  // The demo account's sample XP is not a real learner's, so it never enters the leaderboard.
  if (isDemo(req.user)) week.xp = 0;
  q.putProgress.run(req.user.id, json, Math.max(0, Math.round(Number(state.xp) || 0)), week.wk, week.xp, now);
  res.json({ ok: true, updatedAt: now });
});

// ---------- Leaderboard (this week's XP) ----------
api.get("/leaderboard", requireAuth, (req, res) => {
  const rows = q.leaderboard.all(weekKey());
  const shortName = (n) => { const [a, b] = String(n).trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; };
  const list = rows.map((r, i) => ({ rank: i + 1, name: shortName(r.name), xp: r.week_xp, me: r.id === req.user.id }));
  const top = list.slice(0, 5);
  const mine = list.find((r) => r.me);
  if (mine && mine.rank > 5) top.push(mine);
  res.json({ rows: top, total: list.length });
});

// ---------- AI tutor ----------
api.post("/tutor", requireAuth, tutorLimit, async (req, res, next) => {
  res.status(503).json({ error: "AI Tutor tez kunda ishga tushadi", comingSoon: true });
});

api.use((req, res) => res.status(404).json({ error: "Topilmadi" }));
api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Ma'lumot hajmi juda katta" });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON noto'g'ri" });
  console.error(err);
  res.status(500).json({ error: "Serverda xatolik" });
});

app.use("/api", api);

// The service worker caches the app shell under a version name. The name is a fingerprint of the files in
// public/, so every deploy that changes a file makes browsers fetch the new shell — no manual version bumps.
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
app.get("/sw.js", (req, res) => {
  const src = fs.readFileSync(path.join(PUBLIC_DIR, "sw.js"), "utf8").replaceAll("__BUILD__", publicFingerprint());
  res.setHeader("Cache-Control", "no-cache");
  res.type("application/javascript").send(src);
});
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

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

app.listen(PORT, () => {
  console.log(`UpKorean → ${APP_URL}`);
  console.log(`  AI tutor: tez kunda (vaqtincha qulflangan${tutorEnabled() ? ", server tayyor" : ""})`);
  console.log(`  Google:   ${GOOGLE_CLIENT_ID ? "yoqilgan" : "o'chirilgan (GOOGLE_CLIENT_ID yo'q)"}`);
  console.log(`  Email:    ${mailEnabled() ? "yoqilgan (SMTP)" : "o'chirilgan — parol tiklash havolalari server logiga yoziladi (SMTP_HOST yo'q)"}`);
  console.log(`  Audio:    diktor bo'laklari ${WORD_CLIPS}/1000 so'z, ${SENTENCE_CLIPS}/1000 gap`);
  console.log(`  Backup:   ${BACKUP_HOURS ? `har ${BACKUP_HOURS} soatda, oxirgi ${BACKUP_KEEP} tasi → ${BACKUP_DIR}` : "o'chirilgan (BACKUP_HOURS=0)"}`);
  if (DEMO) console.log("  Demo hisob: yoqilgan");
  if (PROD && !process.env.TRUST_PROXY) console.log("  Eslatma: server proksi (nginx, Cloudflare) ortida bo'lsa, TRUST_PROXY=1 qo'ying.");
});
