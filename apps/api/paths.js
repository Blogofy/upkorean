// Every directory the server reads, resolved from this file rather than the working directory, so the
// server behaves the same started from the repo root, from apps/api, or by systemd.
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const WEB_DIR = path.join(ROOT, "apps", "web");
// sync.js, vocab.js, examples.js and roots.js: served to the browser under /js and to the mobile app as JSON.
export const SHARED_DIR = path.join(ROOT, "packages", "shared");
export const AUDIO_DIR = path.join(ROOT, "audio");
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
