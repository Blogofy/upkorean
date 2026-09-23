// Every directory the server reads, resolved from this file rather than the working directory, so the
// server behaves the same started from the repo root, from apps/api, or by systemd.
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const AUDIO_DIR = path.join(ROOT, "audio");
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
