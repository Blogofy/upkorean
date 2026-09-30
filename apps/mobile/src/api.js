// The personal "Kitob" build: the book's thousand words for one learner, with no server of its own.
//
// Every screen still talks to `api` exactly as it talks to the real server, and gets the same answers:
// the course comes from kitob/content.json (scripts/kitob-content.mjs), the account is this phone, and
// progress is kept in AsyncStorage. Only the narrator clips come over the network, from the book's
// recordings on upkorean.uz (AUDIO_URL).
import AsyncStorage from "@react-native-async-storage/async-storage";

import { applyChanges } from "@upkorean/shared";

import { CLIENT } from "./config";
import CONTENT from "./kitob/content.json";

export const AUDIO_URL = "https://upkorean.uz/kitob-audio";

const USER_KEY = "kitob_user";
const PROGRESS_KEY = "kitob_progress";

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field || null;
  }
}

const DEFAULT_USER = { id: 1, email: "men@kitob.uz", name: "Abrorbek", createdAt: 0, hasPassword: false, google: false, demo: false };

async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
const writeJson = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value));

async function user() {
  const saved = await readJson(USER_KEY);
  if (saved) return saved;
  const fresh = { ...DEFAULT_USER, createdAt: Date.now() };
  await writeJson(USER_KEY, fresh);
  return fresh;
}

// There is always a session: the phone is the account.
export async function restoreSession() { return true; }
export const hasSession = () => true;
export const authHeaders = () => ({ "X-UK-Client": CLIENT });

const signedIn = async () => ({ user: await user() });

async function store(state, rev) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new ApiError("Noto'g'ri ma'lumot", 400);
  const row = await readJson(PROGRESS_KEY);
  const updatedAt = Math.max(Date.now(), row ? row.updatedAt + 1 : 0);
  await writeJson(PROGRESS_KEY, { state, updatedAt, rev: rev || null });
  return { ok: true, updatedAt, rev: rev || null };
}

const partKey = (level, name) => `${level}/${name}`;

export const api = {
  config: async () => ({
    google: null, googleAndroid: null, googleIos: null,
    demo: false, clips: true, mail: false,
    contentVersion: CONTENT.version,
    defaultLevel: CONTENT.defaultLevel,
    minAppVersion: "1.0.0",
  }),

  register: async (name) => {
    const u = { ...(await user()), name: String(name || "").trim() || DEFAULT_USER.name };
    await writeJson(USER_KEY, u);
    return { user: u };
  },
  login: signedIn,
  google: signedIn,
  demo: signedIn,
  me: signedIn,
  logout: async () => {},
  forgotPassword: async () => ({ ok: true }),
  resetPassword: signedIn,

  rename: async (name) => {
    const u = { ...(await user()), name: String(name || "").trim() || DEFAULT_USER.name };
    await writeJson(USER_KEY, u);
    return { user: u };
  },
  changePassword: async () => ({ ok: true, user: await user() }),
  deleteAccount: async () => {
    await AsyncStorage.multiRemove([USER_KEY, PROGRESS_KEY]);
    return { ok: true };
  },

  getProgress: async () => {
    const row = await readJson(PROGRESS_KEY);
    return { state: row ? row.state : null, updatedAt: row ? row.updatedAt : null, rev: row ? row.rev : null };
  },
  putProgress: (state, { rev } = {}) => store(state, rev),
  patchProgress: async (changes, { rev } = {}) => {
    const row = await readJson(PROGRESS_KEY);
    const state = row && row.state ? row.state : {};
    if (!applyChanges(state, changes)) throw new ApiError("Noto'g'ri ma'lumot", 400);
    return store(state, rev);
  },

  // One learner: the week's board is this phone alone.
  leaderboard: async () => {
    const row = await readJson(PROGRESS_KEY);
    const u = await user();
    return { rows: [{ rank: 1, name: u.name, xp: Math.round(Number(row?.state?.weekXp ?? row?.state?.xp) || 0), me: true }], total: 1 };
  },

  contentManifest: async () => CONTENT.manifest,
  contentPart: async (level, name) => {
    const part = CONTENT.parts[partKey(level, name)];
    if (!part) throw new ApiError("Topilmadi", 404);
    return part;
  },

  clipUrl: (kind, wordId) => `${AUDIO_URL}/${kind}/${wordId}.mp3`,
};
