// Narrator clips recorded by hand in the ElevenLabs studio, a lesson at a time, then cut into one file a word.
//
//   npm run voice:lists              writes audio/import/01-dars.txt … one lesson's words a line, to paste
//   npm run voice:cut                cuts every audio/import/NN-dars.mp3 into audio/words/<id>.mp3
//
// The studio reads a pasted list as one recording with a pause at every line. `cut` finds those pauses
// (ffmpeg silencedetect) and only writes a lesson's clips when it finds exactly as many words as the list
// has lines; otherwise it says so and writes nothing, and that lesson is recorded again. A word already
// recorded is left out of later lists, and words written the same (눈 the eye, 눈 the snow) are read once
// and the clip copied. Restart the server afterwards: it reads the clip list at startup.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { loadCourse } from "../packages/shared/course/data.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMPORT = path.join(ROOT, "audio", "import");
const WORDS = path.join(ROOT, "audio", "words");
const levelId = process.argv.includes("--level") ? process.argv[process.argv.indexOf("--level") + 1] : "b";
const command = process.argv[2];

const course = (await loadCourse()).byLevel[levelId];
if (!course?.words.length) {
  console.error(`${levelId} darajasida so'z yo'q`);
  process.exit(1);
}

// What the narrator reads: the word and a full stop, so it is said as a calm statement and followed by a
// pause. An ending listed as "-하다" is read without its dash; of "A/B" only A is read.
const wordText = (ko) => String(ko).split("/")[0].replace(/\(.*?\)/g, "").replace(/^[-…~]+/, "").trim() + ".";
const clip = (id) => path.join(WORDS, `${id}.mp3`);
const name = (n) => `${String(n).padStart(2, "0")}-dars`;

// Every lesson's lines: each a text not recorded yet and not read in an earlier lesson, with the ids that
// share it. The same function serves both commands, so the lists and the cutting always agree.
function plan() {
  const idsByText = new Map();
  for (const word of course.words) {
    const text = wordText(word.ko);
    if (!idsByText.has(text)) idsByText.set(text, []);
    idsByText.get(text).push(word.id);
  }
  const seen = new Set();
  return course.lessons.slice(1).map((lesson) => {
    const lines = [];
    for (const id of lesson.ids) {
      const text = wordText(course.byId[id].ko);
      if (seen.has(text)) continue;
      seen.add(text);
      lines.push({ text, ids: idsByText.get(text) });
    }
    return { n: lesson.n, lines };
  });
}

if (command === "lists") {
  fs.mkdirSync(IMPORT, { recursive: true });
  let written = 0;
  let chars = 0;
  for (const lesson of plan()) {
    const file = path.join(IMPORT, `${name(lesson.n)}.txt`);
    const missing = lesson.lines.filter((line) => line.ids.some((id) => !fs.existsSync(clip(id))));
    if (!missing.length) { if (fs.existsSync(file)) fs.rmSync(file); continue; }
    // The whole lesson is listed even if a few of its words have clips: a list is cut as a whole.
    fs.writeFileSync(file, lesson.lines.map((line) => line.text).join("\n") + "\n");
    written++;
    chars += lesson.lines.reduce((sum, line) => sum + [...line.text].length + 1, 0);
  }
  console.log(`${written} ta ro'yxat audio/import/ da, jami ~${chars} belgi.`);
  process.exit(0);
}

if (command !== "cut") {
  console.error("npm run voice:lists  yoki  npm run voice:cut");
  process.exit(1);
}

const FFMPEG = "ffmpeg";
// Speech between the pauses of a recording, as [start, end] in seconds, for one pair of settings.
function detect(file, noise, gap) {
  const result = spawnLog(file, noise, gap);
  const starts = [...result.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...result.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const duration = Number((result.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0));
  const parts = [];
  let from = 0;
  starts.forEach((start, i) => {
    if (start - from > 0.08) parts.push([from, start]);
    from = ends[i] ?? duration;
  });
  if (duration - from > 0.08) parts.push([from, duration]);
  return parts;
}
// ffmpeg writes its analysis to stderr, which execFileSync only hands back on failure; spawnSync always does.
function spawnLog(file, noise, gap) {
  const run = spawnSync(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-af", `silencedetect=noise=${noise}dB:d=${gap}`, "-f", "null", "-"], { encoding: "utf8" });
  if (run.error) throw new Error(`ffmpeg topilmadi: ${run.error.message}`);
  return run.stderr || "";
}

fs.mkdirSync(WORDS, { recursive: true });
const lessons = new Map(plan().map((lesson) => [name(lesson.n), lesson]));
const recordings = fs.existsSync(IMPORT) ? fs.readdirSync(IMPORT).filter((f) => /^\d+-dars\.mp3$/.test(f)).sort() : [];
if (!recordings.length) {
  console.log("audio/import/ da NN-dars.mp3 topilmadi.");
  process.exit(0);
}

let ok = 0;
let bad = 0;
for (const fileName of recordings) {
  const lesson = lessons.get(fileName.replace(".mp3", ""));
  const file = path.join(IMPORT, fileName);
  if (!lesson) { console.warn(`${fileName}: bunday dars yo'q`); bad++; continue; }
  const want = lesson.lines.length;
  // The loudest pauses first; the first setting that finds exactly the list's words wins.
  let found = null;
  let closest = null;
  for (const gap of [0.5, 0.4, 0.35, 0.3, 0.25, 0.2]) {
    for (const noise of [-40, -45, -35, -50, -30]) {
      const parts = detect(file, noise, gap);
      if (parts.length === want) { found = parts; break; }
      if (!closest || Math.abs(parts.length - want) < Math.abs(closest.length - want)) closest = parts;
    }
    if (found) break;
  }
  if (!found) {
    console.warn(`${fileName}: ${want} ta so'z kutilgandi, ${closest?.length ?? 0} ta topildi — shu darsni qayta yarating`);
    bad++;
    continue;
  }
  found.forEach(([start, end], i) => {
    const line = lesson.lines[i];
    const from = Math.max(0, start - 0.06);
    const to = end + 0.1;
    const out = clip(line.ids[0]);
    execFileSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-ss", from.toFixed(3), "-to", to.toFixed(3), "-i", file,
      "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse", "-c:a", "libmp3lame", "-b:a", "128k", out]);
    for (const id of line.ids.slice(1)) fs.copyFileSync(out, clip(id));
  });
  console.log(`${fileName}: ${want} ta so'z kesildi`);
  fs.renameSync(file, path.join(IMPORT, `${fileName}.done`));
  ok++;
}
console.log(`Tayyor: ${ok} ta dars${bad ? `, muammoli: ${bad}` : ""}. Serverni qayta ishga tushiring.`);
