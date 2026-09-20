// Password hashing (scrypt), sessions (cookie for the browser, bearer token for the apps) and small helpers.
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

// A native app announces itself with `X-UK-Client: mobile/<version>`. It has no cookie jar, and no
// same-site rule to lean on, so it carries the session as a bearer token instead.
const APP_CLIENTS = new Set(["mobile", "app", "desktop"]);
export const isAppClient = (req) =>
  APP_CLIENTS.has(String(req.headers["x-uk-client"] || "").split("/")[0].trim().toLowerCase());

const bearerToken = (req) => {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

// Returns what the response body should carry: nothing for a browser (its token is in an HttpOnly cookie
// that page script must never be able to read), the token itself for an app.
export function startSession(req, res, userId) {
  const token = randomToken();
  const expiresAt = Date.now() + SESSION_DAYS * 86400000;
  q.insertSession.run(sha256(token), userId, expiresAt);
  if (isAppClient(req)) return { token, expiresAt };
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`);
  return {};
}

// Ends whichever session made this request, and clears the cookie in case it was the cookie's.
export function endSession(req, res) {
  const token = bearerToken(req) || parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.deleteSession.run(sha256(token));
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function currentUser(req) {
  const token = bearerToken(req) || parseCookies(req.headers.cookie)[COOKIE];
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
