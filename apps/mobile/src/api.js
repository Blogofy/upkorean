// Everything this app knows about the server. One module, so no screen ever builds a URL or remembers
// where the session token is kept.
//
// The web app signs in with an HttpOnly cookie; there is no cookie jar here, so the server hands this
// client the session token itself (it recognises us by the X-UK-Client header) and every later request
// carries it as `Authorization: Bearer`. The token is the whole account, so it lives in the device
// keystore — SecureStore — and never in AsyncStorage next to the cached course.
import * as SecureStore from "expo-secure-store";

import { API_URL, CLIENT } from "./config";

const TOKEN_KEY = "uk_session_token";

let token = null;
let restored = false;

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    // Which form field the message belongs under ("email", "password", …), when the server says.
    this.field = field || null;
  }
}

// Reads the saved session once at startup. Returns true when there is one to try.
export async function restoreSession() {
  if (!restored) {
    try { token = await SecureStore.getItemAsync(TOKEN_KEY); } catch { token = null; }
    restored = true;
  }
  return !!token;
}

async function keepSession(value) {
  token = value || null;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch { /* a device that refuses the keystore still gets this run's in-memory session */ }
}

export const hasSession = () => !!token;
// For anything fetch() cannot do for us — an audio player that takes its own headers.
export const authHeaders = () => (token ? { Authorization: `Bearer ${token}`, "X-UK-Client": CLIENT } : { "X-UK-Client": CLIENT });

// A phone loses the network mid-request more often than it refuses one outright, and a fetch that is
// never answered never rejects either. Without a deadline the app sits on a spinner forever, which is
// the one failure a learner cannot act on.
const TIMEOUT_MS = 20000;

async function request(method, path, body, { auth = true, signal, timeout = TIMEOUT_MS } = {}) {
  const headers = { Accept: "application/json", "X-UK-Client": CLIENT };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), timeout);
  if (signal) signal.addEventListener("abort", () => deadline.abort(), { once: true });

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, signal: deadline.signal, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (cause) {
    const timedOut = deadline.signal.aborted && !(signal && signal.aborted);
    const offline = new ApiError(
      timedOut
        ? `Server javob bermadi (${API_URL}). Manzil to'g'rimi va internet bormi?`
        : `Serverga ulanib bo'lmadi (${API_URL}). Internetni tekshiring.`,
      0,
      null,
    );
    offline.cause = cause;
    throw offline;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* an error page, not our JSON */ }

  if (res.status === 401 && auth) await keepSession(null); // the session is gone; stop pretending it is not
  if (!res.ok) {
    const error = new ApiError((data && data.error) || `Xatolik (${res.status})`, res.status, data && data.field);
    // Two devices changed the same progress: the caller merges `state` and saves again.
    if (res.status === 409 && data) { error.conflict = true; error.state = data.state; error.updatedAt = data.updatedAt; error.rev = data.rev; }
    throw error;
  }
  return data;
}

// Auth responses carry { user, token, expiresAt }; the token is kept here and never returned to a screen.
async function signIn(path, body) {
  const data = await request("POST", path, body, { auth: false });
  // A server old enough to ignore X-UK-Client answers with a cookie instead, which this client has
  // nowhere to keep. Signing in would look like it worked and every later request would be signed out.
  if (!data || !data.token) {
    throw new ApiError(`Bu server ilovani hali qo'llab-quvvatlamaydi (${API_URL}). Serverni yangilang.`, 0, null);
  }
  await keepSession(data.token);
  return data;
}

const tz = () => -new Date().getTimezoneOffset(); // minutes east of UTC, the same number the web app sends

export const api = {
  // What this server offers: Google client ids, whether the demo account and narrator audio exist,
  // the current course version and the oldest app build still accepted.
  config: () => request("GET", "/api/config", undefined, { auth: false }),

  register: (name, email, password) => signIn("/api/auth/register", { name, email, password }),
  login: (email, password) => signIn("/api/auth/login", { email, password }),
  // `idToken` from Google Sign-In, or `accessToken` from an OAuth flow.
  google: ({ credential, accessToken }) => signIn("/api/auth/google", { credential, accessToken }),
  demo: () => signIn("/api/auth/demo", {}),
  me: () => request("GET", "/api/auth/me"),
  async logout() {
    try { await request("POST", "/api/auth/logout", {}); } finally { await keepSession(null); }
  },
  forgotPassword: (email) => request("POST", "/api/auth/forgot", { email }, { auth: false }),
  // A finished reset signs the learner straight in, on this device, with a fresh session.
  resetPassword: (resetToken, password) => signIn("/api/auth/reset", { token: resetToken, password }),

  rename: (name) => request("PATCH", "/api/account", { name }),
  // Changing the password signs every other device out, so the server issues a new session here too.
  async changePassword(current, next) {
    const data = await request("POST", "/api/account/password", { current, next });
    if (data && data.token) await keepSession(data.token);
    return data;
  },
  async deleteAccount(password) {
    const data = await request("DELETE", "/api/account", { password }); // a wrong password throws, and the session stays
    await keepSession(null);
    return data;
  },

  getProgress: () => request("GET", "/api/progress"),
  // Whole state. `baseAt` is the updatedAt this device started from; leaving it out overwrites blindly.
  putProgress: (state, { baseAt, rev } = {}) => request("PUT", "/api/progress", { state, baseAt, rev, tz: tz() }),
  // Only what changed: [{ p: ["words", "1-3"], v: {...} }, …] — see packages/shared/sync.js diffState().
  patchProgress: (changes, { baseAt, rev } = {}) => request("PATCH", "/api/progress", { changes, baseAt, rev, tz: tz() }),

  leaderboard: () => request("GET", `/api/leaderboard?tz=${tz()}`),

  // What levels exist, how big each is, and which are still locked.
  contentManifest: () => request("GET", "/api/content", undefined, { auth: false }),
  contentPart: (level, name, version) =>
    request("GET", `/api/content/${level}/${name}${version ? `?v=${version}` : ""}`, undefined, { auth: false, timeout: 60000 }),

  // Narrator audio, named by word id ("b-1-0"). Signed-in only, so the player has to send authHeaders().
  clipUrl: (kind, wordId) => `${API_URL}/media/clip/${kind}/${wordId}.mp3`,
};
