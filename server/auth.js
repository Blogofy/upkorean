// Password hashing (scrypt), cookie sessions and small helpers.
import crypto from "node:crypto";
import { q } from "./db.js";

const COOKIE = "uk_sid";
const SESSION_DAYS = 30;

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith("scrypt$")) return false;
  const [, saltB64, hashB64] = stored.split("$");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, "base64"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function startSession(req, res, userId) {
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 86400000;
  q.insertSession.run(sha256(token), userId, expires);
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`);
}

export function endSession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.deleteSession.run(sha256(token));
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function currentUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  return q.sessionUser.get(sha256(token), Date.now()) || null;
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Tizimga kiring" });
  req.user = user;
  next();
}

// Shared showcase account: entered only through the demo button, never with a password.
export const DEMO_EMAIL = "aziza@mail.uz";
export const isDemo = (u) => !!u && u.email === DEMO_EMAIL;

export const publicUser = (u) => ({
  id: u.id, email: u.email, name: u.name, createdAt: u.created_at,
  hasPassword: !!u.pass_hash, google: !!u.google_sub, demo: isDemo(u),
});

// Fixed-window rate limiter kept in memory (per key).
export function rateLimit({ windowMs, max, key }) {
  const hits = new Map();
  return (req, res, next) => {
    const k = key(req);
    const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(k, h); }
    if (++h.n > max) {
      res.setHeader("Retry-After", Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ error: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring." });
    }
    if (hits.size > 5000) for (const [kk, v] of hits) if (v.reset < now) hits.delete(kk);
    next();
  };
}
