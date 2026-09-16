// Cuts the original day tracks (audio/<day>일.mp3) into one clip per word and per example sentence:
//   audio/words/<id>.mp3 — the narrator reading the word
//   audio/sentences/<id>.mp3 — the narrator reading the example sentence
// Timings come from scripts/audio-clips.json (aligned once against a speech transcript of each track).
// Usage: node scripts/cut-audio-clips.mjs [--force]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audioDir = path.join(root, "audio");
const outDir = audioDir;
const { gain, clips } = JSON.parse(fs.readFileSync(path.join(root, "scripts", "audio-clips.json"), "utf8"));
const force = process.argv.includes("--force");

const tracks = new Map();
for (const name of fs.readdirSync(audioDir)) {
  const m = name.match(/^(\d+)일\s*\.mp3$/u);
  if (m) tracks.set(Number(m[1]), path.join(audioDir, name));
}

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `ffmpeg exited ${code}`))));
  });
}

const jobs = [];
for (const [id, c] of Object.entries(clips)) {
  const src = tracks.get(c.d);
  if (!src) { console.warn(`Day ${c.d} track missing, skipping ${id}`); continue; }
  // a little air around each cut; word cuts made inside a single breath group get no lead-in
  jobs.push({ kind: "words", id, src, day: c.d, a: c.w[0] - (c.m ? 0 : 0.06), b: c.w[1] + 0.1 });
  jobs.push({ kind: "sentences", id, src, day: c.d, a: c.s[0] - 0.08, b: c.s[1] + 0.22 });
}
for (const k of ["words", "sentences"]) fs.mkdirSync(path.join(outDir, k), { recursive: true });

let done = 0, skipped = 0;
async function run(job) {
  const out = path.join(outDir, job.kind, `${job.id}.mp3`);
  if (!force && fs.existsSync(out)) { skipped++; return; }
  const a = Math.max(0, job.a), dur = job.b - a;
  const fadeOut = Math.max(0, dur - 0.04).toFixed(3);
  await ffmpeg(["-ss", a.toFixed(3), "-t", dur.toFixed(3), "-i", job.src,
    "-af", `volume=${gain[job.day] || 0}dB,afade=t=in:d=0.015,afade=t=out:st=${fadeOut}:d=0.04`,
    "-ac", "1", "-ar", "24000", "-b:a", "64k", out]);
  done++;
}
const queue = [...jobs];
const workers = Array.from({ length: Math.max(2, Math.min(8, os.cpus().length)) }, async () => {
  while (queue.length) await run(queue.shift());
});
await Promise.all(workers);
console.log(`Clips: ${done} written, ${skipped} already present, ${jobs.length} total → ${path.relative(root, outDir)}`);
