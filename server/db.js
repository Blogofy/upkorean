// SQLite storage (Node's built-in node:sqlite). One file: data/upkorean.db
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.env.DATA_DIR || "data");
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
`);

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

  getProgress: db.prepare("SELECT state, updated_at FROM progress WHERE user_id = ?"),
  deleteProgress: db.prepare("DELETE FROM progress WHERE user_id = ?"),
  putProgress: db.prepare(`INSERT INTO progress (user_id, state, xp, week_key, week_xp, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, xp = excluded.xp, week_key = excluded.week_key,
    week_xp = excluded.week_xp, updated_at = excluded.updated_at`),
  leaderboard: db.prepare(`SELECT u.id, u.name, p.week_xp FROM progress p JOIN users u ON u.id = p.user_id
    WHERE p.week_key = ? AND p.week_xp > 0 ORDER BY p.week_xp DESC, p.updated_at ASC LIMIT 50`),

  insertReset: db.prepare("INSERT INTO resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
  resetUser: db.prepare("SELECT user_id FROM resets WHERE token_hash = ? AND expires_at > ?"),
  deleteResets: db.prepare("DELETE FROM resets WHERE user_id = ?"),
};
