// Password hashing (scrypt), bearer-token sessions for the app, and small helpers.
import crypto from "node:crypto";
import { q } from "./db.js";

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

const bearerToken = (req) => {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

// The app has no cookie jar, so the session token travels in the response body and comes back on every
// request as `Authorization: Bearer`. The app keeps it in the device keystore.
export function startSession(req, res, userId) {
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  q.insertSession.run(sha256(token), userId, expiresAt);
  return { token, expiresAt };
}

export function endSession(req) {
  const token = bearerToken(req);
  if (token) q.deleteSession.run(sha256(token));
}

export function currentUser(req) {
  const token = bearerToken(req);
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

// Counts events per key (e.g. reset requests for one email) and turns the count into a block or a delay.
export function counter({ windowMs, max }) {
  const hits = new Map();
  const live = (k, now) => { const h = hits.get(k); return h && h.reset > now ? h : null; };
  return {
    // Seconds until the key may try again, or 0 when it is under the limit.
    blocked(k) { const now = Date.now(), h = live(k, now); return h && h.n >= max ? Math.ceil((h.reset - now) / 1000) : 0; },
    // Milliseconds this key should be held back: nothing for the first `max` events, then half a second more
    // each time, up to 5s. Slowing a client down throttles guessing without ever locking an account out.
    delay(k) { const h = live(k, Date.now()); return h && h.n > max ? Math.min(5000, (h.n - max) * 500) : 0; },
    add(k) {
      const now = Date.now();
      const h = live(k, now) || { n: 0, reset: now + windowMs };
      h.n++; hits.set(k, h);
      if (hits.size > 5000) for (const [kk, v] of hits) if (v.reset <= now) hits.delete(kk);
    },
    clear(k) { hits.delete(k); },
  };
}
