// UpKorean server: static front-end + JSON API (auth, progress sync, leaderboard, AI tutor).
import "./env.js";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { q } from "./db.js";
import {
  hashPassword, verifyPassword, startSession, endSession, currentUser, requireAuth,
  publicUser, rateLimit, randomToken, sha256,
} from "./auth.js";
import { tutorEnabled } from "./tutor.js";

const PORT = Number(process.env.PORT) || 3000;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const PROD = process.env.NODE_ENV === "production";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const TUTOR_COMING_SOON = true;
const DEMO = process.env.DEMO ? process.env.DEMO === "1" : !PROD;
const AUDIO_DIR = path.resolve("audio");
// Narrator clips: audio/words/<id>.mp3 = word, audio/sentences/<id>.mp3 = example sentence.
const CLIP_DIR = AUDIO_DIR;
const clipCount = (kind) => {
  const dir = path.join(CLIP_DIR, kind);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => /^\d{1,2}-\d{1,2}\.mp3$/.test(name)).length : 0;
};
const WORD_CLIPS = clipCount("words"), SENTENCE_CLIPS = clipCount("sentences");
const HAS_CLIPS = WORD_CLIPS >= 1000 && SENTENCE_CLIPS >= 1000;

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

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

const authLimit = rateLimit({ windowMs: 10 * 60000, max: 30, key: (req) => req.ip });
const tutorLimit = rateLimit({ windowMs: 10 * 60000, max: 40, key: (req) => `t${req.user.id}` });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v) => (typeof v === "string" ? v : "");
function validName(name) { name = str(name).trim(); return name.length >= 1 && name.length <= 60 ? name : null; }
function validEmail(email) { email = str(email).trim().toLowerCase(); return EMAIL_RE.test(email) && email.length <= 200 ? email : null; }
function validPassword(pw) { pw = str(pw); return pw.length >= 8 && pw.length <= 200 ? pw : null; }

// ---------- Config ----------
api.get("/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ google: GOOGLE_CLIENT_ID || null, tutor: false, tutorComingSoon: TUTOR_COMING_SOON, demo: DEMO, clips: HAS_CLIPS });
});

// ---------- Auth ----------
api.post("/auth/register", authLimit, (req, res) => {
  const name = validName(req.body.name), email = validEmail(req.body.email), pw = validPassword(req.body.password);
  if (!name) return res.status(400).json({ error: "Ismingizni kiriting", field: "name" });
  if (!email) return res.status(400).json({ error: "Email manzil noto'g'ri", field: "email" });
  if (!pw) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo'lsin", field: "password" });
  if (q.userByEmail.get(email)) return res.status(409).json({ error: "Bu email bilan hisob allaqachon mavjud", field: "email" });
  const { lastInsertRowid } = q.insertUser.run(email, name, hashPassword(pw), null);
  const user = q.userById.get(lastInsertRowid);
  startSession(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

api.post("/auth/login", authLimit, (req, res) => {
  const email = validEmail(req.body.email);
  const user = email && q.userByEmail.get(email);
  if (!user || !verifyPassword(str(req.body.password), user.pass_hash)) {
    return res.status(401).json({ error: "Email yoki parol noto'g'ri" });
  }
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
  let user = q.userByGoogle.get(info.sub) || q.userByEmail.get(email);
  if (!user) {
    const { lastInsertRowid } = q.insertUser.run(email, (info.given_name || info.name || email.split("@")[0]).slice(0, 60), null, info.sub);
    user = q.userById.get(lastInsertRowid);
  } else if (!user.google_sub) {
    q.setGoogle.run(info.sub, user.id);
  }
  startSession(req, res, user.id);
  res.json({ user: publicUser(q.userById.get(user.id)) });
});

api.post("/auth/forgot", authLimit, (req, res) => {
  const email = validEmail(req.body.email);
  const user = email && q.userByEmail.get(email);
  const out = { ok: true };
  if (user) {
    const token = randomToken();
    q.insertReset.run(sha256(token), user.id, Date.now() + 30 * 60000);
    const link = `${APP_URL}/#/reset/${token}`;
    // Plug an email provider in here for production. Until then the link is printed to the server log.
    console.log(`[password reset] ${email}: ${link}`);
    if (!PROD) out.devLink = link;
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
  startSession(req, res, row.user_id);
  res.json({ user: publicUser(q.userById.get(row.user_id)) });
});

api.post("/auth/demo", authLimit, (req, res) => {
  if (!DEMO) return res.status(404).json({ error: "Demo o'chirilgan" });
  const email = "aziza@mail.uz";
  let user = q.userByEmail.get(email);
  if (!user) {
    const { lastInsertRowid } = q.insertUser.run(email, "Aziza Karimova", hashPassword("demo1234"), null);
    user = q.userById.get(lastInsertRowid);
  }
  startSession(req, res, user.id);
  res.json({ user: publicUser(user), fresh: !q.getProgress.get(user.id) });
});

// ---------- Account ----------
api.patch("/account", requireAuth, (req, res) => {
  const name = validName(req.body.name);
  if (!name) return res.status(400).json({ error: "Ismingizni kiriting", field: "name" });
  q.setName.run(name, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

api.post("/account/password", requireAuth, authLimit, (req, res) => {
  const next = validPassword(req.body.next);
  if (!next) return res.status(400).json({ error: "Yangi parol kamida 8 belgidan iborat bo'lsin", field: "next" });
  if (req.user.pass_hash && !verifyPassword(str(req.body.current), req.user.pass_hash)) {
    return res.status(401).json({ error: "Joriy parol noto'g'ri", field: "current" });
  }
  q.setPassword.run(hashPassword(next), req.user.id);
  q.deleteUserSessions.run(req.user.id);
  startSession(req, res, req.user.id);
  res.json({ ok: true });
});

api.delete("/account", requireAuth, (req, res) => {
  if (req.user.pass_hash && !verifyPassword(str(req.body.password), req.user.pass_hash)) {
    return res.status(401).json({ error: "Parol noto'g'ri", field: "password" });
  }
  q.deleteUser.run(req.user.id);
  endSession(req, res);
  res.json({ ok: true });
});

// ---------- Progress ----------
function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
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
  const wk = weekKey();
  let weekXp = 0;
  for (const [k, a] of Object.entries(state.act || {})) if (k >= wk && a && Number.isFinite(a.xp)) weekXp += a.xp;
  const now = Date.now();
  q.putProgress.run(req.user.id, json, Math.max(0, Math.round(Number(state.xp) || 0)), wk, Math.round(weekXp), now);
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
app.use(express.static(path.resolve("public"), { extensions: ["html"] }));

q.purgeSessions.run(Date.now());
setInterval(() => q.purgeSessions.run(Date.now()), 3600000).unref();

app.listen(PORT, () => {
  console.log(`UpKorean → ${APP_URL}`);
  console.log(`  AI tutor: tez kunda (vaqtincha qulflangan${tutorEnabled() ? ", server tayyor" : ""})`);
  console.log(`  Google:   ${GOOGLE_CLIENT_ID ? "yoqilgan" : "o'chirilgan (GOOGLE_CLIENT_ID yo'q)"}`);
  console.log(`  Audio:    diktor bo'laklari ${WORD_CLIPS}/1000 so'z, ${SENTENCE_CLIPS}/1000 gap`);
  if (DEMO) console.log("  Demo hisob: yoqilgan");
});
