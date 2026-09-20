// SQLite storage (Node's built-in node:sqlite). One file: data/upkorean.db
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

import { DATA_DIR } from "./paths.js";

export { DATA_DIR };
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "upkorean.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    pass_hash   TEXT,
    google_sub  TEXT    UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (date('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    state       TEXT    NOT NULL,
    xp          INTEGER NOT NULL DEFAULT 0,
    week_key    TEXT,
    week_xp     INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS resets (
    token_hash  TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  -- One row per browser that allowed notifications (Web Push subscription).
  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint    TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh      TEXT    NOT NULL,
    auth        TEXT    NOT NULL,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS push_subs_user ON push_subs(user_id);

  -- Reminder times copied from the saved progress ("HH:MM" local time, NULL = off) and the last local
  -- date each kind was handled, so a reminder goes out at most once a day.
  CREATE TABLE IF NOT EXISTS reminders (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tz           INTEGER NOT NULL,
    learn_at     TEXT,
    review_at    TEXT,
    streak_at    TEXT,
    learn_sent   TEXT,
    review_sent  TEXT,
    streak_sent  TEXT
  );
`);

// Columns added after the first release.
const columns = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
// rev: id of the browser write that produced the stored progress, so a device can tell its own
// write apart from another device's when the response got lost.
if (!columns("progress").includes("rev")) db.exec("ALTER TABLE progress ADD COLUMN rev TEXT");

export const q = {
  userByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  userById: db.prepare("SELECT * FROM users WHERE id = ?"),
  userByGoogle: db.prepare("SELECT * FROM users WHERE google_sub = ?"),
  insertUser: db.prepare("INSERT INTO users (email, name, pass_hash, google_sub) VALUES (?, ?, ?, ?)"),
  setGoogle: db.prepare("UPDATE users SET google_sub = ? WHERE id = ?"),
  setName: db.prepare("UPDATE users SET name = ? WHERE id = ?"),
  setPassword: db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?"),
  deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),

  insertSession: db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
  sessionUser: db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  deleteUserSessions: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
  purgeSessions: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),

  getProgress: db.prepare("SELECT state, updated_at, rev, week_key, week_xp FROM progress WHERE user_id = ?"),
  deleteProgress: db.prepare("DELETE FROM progress WHERE user_id = ?"),
  putProgress: db.prepare(`INSERT INTO progress (user_id, state, xp, week_key, week_xp, updated_at, rev) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, xp = excluded.xp, week_key = excluded.week_key,
    week_xp = excluded.week_xp, updated_at = excluded.updated_at, rev = excluded.rev`),
  leaderboard: db.prepare(`SELECT u.id, u.name, p.week_xp FROM progress p JOIN users u ON u.id = p.user_id
    WHERE p.week_key = ? AND p.week_xp > 0 ORDER BY p.week_xp DESC, p.updated_at ASC LIMIT 50`),

  insertReset: db.prepare("INSERT INTO resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
  resetUser: db.prepare("SELECT user_id FROM resets WHERE token_hash = ? AND expires_at > ?"),
  deleteResets: db.prepare("DELETE FROM resets WHERE user_id = ?"),
  purgeResets: db.prepare("DELETE FROM resets WHERE expires_at <= ?"),

  putSub: db.prepare(`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`),
  subsForUser: db.prepare("SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?"),
  deleteSub: db.prepare("DELETE FROM push_subs WHERE endpoint = ?"),
  deleteUserSub: db.prepare("DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?"),

  putReminders: db.prepare(`INSERT INTO reminders (user_id, tz, learn_at, review_at, streak_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET tz = excluded.tz, learn_at = excluded.learn_at, review_at = excluded.review_at, streak_at = excluded.streak_at`),
  activeReminders: db.prepare(`SELECT * FROM reminders r
    WHERE (learn_at IS NOT NULL OR review_at IS NOT NULL OR streak_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM push_subs s WHERE s.user_id = r.user_id)`),
  markSent: {
    learn: db.prepare("UPDATE reminders SET learn_sent = ? WHERE user_id = ?"),
    review: db.prepare("UPDATE reminders SET review_sent = ? WHERE user_id = ?"),
    streak: db.prepare("UPDATE reminders SET streak_sent = ? WHERE user_id = ?"),
  },
};

// ---------- Backups ----------
// data/backups/upkorean-<UTC time>.db — a consistent copy taken while the server keeps running.
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const BACKUP_RE = /^upkorean-[\d-]+\.db$/;
const backupFiles = () => (fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((f) => BACKUP_RE.test(f)).sort() : []);

export function lastBackupAt() {
  const files = backupFiles();
  return files.length ? fs.statSync(path.join(BACKUP_DIR, files[files.length - 1])).mtimeMs : 0;
}

export function backupDb(keep = 14) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const file = path.join(BACKUP_DIR, `upkorean-${stamp}.db`);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  // Push subscriptions only work with the keys they were created with.
  const vapid = path.join(DATA_DIR, "vapid.json");
  if (fs.existsSync(vapid)) fs.copyFileSync(vapid, path.join(BACKUP_DIR, "vapid.json"));
  const files = backupFiles();
  for (const old of files.slice(0, Math.max(0, files.length - keep))) fs.rmSync(path.join(BACKUP_DIR, old));
  return file;
}
