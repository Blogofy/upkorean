// Narrator clips recorded by hand in the ElevenLabs studio, a list at a time, then cut into one file a word.
//
//   npm run voice:lists              writes audio/import/1급-01.txt …: the words of each grade in path order,
//                                    one a line, in lists of at most MAX_CHARS to paste one at a time
//   npm run voice:cut                cuts every audio/import/<list>.mp3 into audio/words/<id>.mp3
//
// Each list has a .json beside it naming the ids of every line, so the cut never depends on the course
// having stayed the same. The studio reads a pasted list as one recording with a pause at every line. `cut`
// finds those pauses (ffmpeg silencedetect) and only writes a list's clips when it finds exactly as many
// words as the list has lines; otherwise it says so and writes nothing, and that list is recorded again.
// A word already recorded is left out of new lists, and words written the same (눈 the eye, 눈 the snow)
// are read once and the clip copied. Restart the server afterwards: it reads the clip list at startup.
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
// Short enough that a missed word costs one list, not the grade, and well under the studio's 5 000. A grade
// is cut into as few lists as that allows, all about the same size.
const MAX_CHARS = 1100;
const lineChars = (text) => [...text].length + 1;

// Every grade's lines in path order: each a text not read before, with every id that shares it — words
// written the same (눈 the eye, 눈 the snow) are read once. Texts whose clips all exist are left out.
function plan() {
  const idsByText = new Map();
  for (const word of course.words) {
    const text = wordText(word.ko);
    if (!idsByText.has(text)) idsByText.set(text, []);
    idsByText.get(text).push(word.id);
  }
  const seen = new Set();
  const grades = new Map();
  for (const word of course.words) {
    const text = wordText(word.ko);
    if (seen.has(text)) continue;
    seen.add(text);
    const ids = idsByText.get(text);
    if (ids.every((id) => fs.existsSync(clip(id)))) continue;
    const grade = course.lessons[word.lesson].grade;
    if (!grades.has(grade)) grades.set(grade, []);
    grades.get(grade).push({ text, ids });
  }
  return grades;
}

if (command === "lists") {
  fs.mkdirSync(IMPORT, { recursive: true });
  for (const name of fs.readdirSync(IMPORT)) if (/\.(txt|json)$/.test(name)) fs.rmSync(path.join(IMPORT, name));
  let total = 0;
  for (const [grade, lines] of plan()) {
    const all = lines.reduce((sum, line) => sum + lineChars(line.text), 0);
    const size = all / Math.ceil(all / MAX_CHARS);
    const lists = [[]];
    let used = 0;
    for (const line of lines) {
      if (lists[lists.length - 1].length && used + lineChars(line.text) / 2 > size * lists.length) lists.push([]);
      lists[lists.length - 1].push(line);
      used += lineChars(line.text);
    }
    lists.forEach((list, i) => {
      const name = `${grade}급-${String(i + 1).padStart(2, "0")}`;
      fs.writeFileSync(path.join(IMPORT, `${name}.txt`), list.map((line) => line.text).join("\n"));
      fs.writeFileSync(path.join(IMPORT, `${name}.json`), JSON.stringify(list));
      const chars = list.reduce((sum, line) => sum + lineChars(line.text), 0) - 1;
      total += chars;
      console.log(`${name}.txt  ${list.length} so'z  ${chars} belgi`);
    });
  }
  console.log(`Jami ~${total} belgi.`);
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
const recordings = fs.existsSync(IMPORT) ? fs.readdirSync(IMPORT).filter((f) => f.endsWith(".mp3")).sort() : [];
if (!recordings.length) {
  console.log("audio/import/ da mp3 topilmadi.");
  process.exit(0);
}

let ok = 0;
let bad = 0;
for (const fileName of recordings) {
  const file = path.join(IMPORT, fileName);
  const sidecar = path.join(IMPORT, fileName.replace(/\.mp3$/, ".json"));
  if (!fs.existsSync(sidecar)) { console.warn(`${fileName}: yonida ${path.basename(sidecar)} yo'q — nomi ro'yxat bilan bir xil bo'lsin`); bad++; continue; }
  const lesson = { lines: JSON.parse(fs.readFileSync(sidecar, "utf8")) };
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
  fs.renameSync(sidecar, `${sidecar}.done`);
  ok++;
}
console.log(`Tayyor: ${ok} ta dars${bad ? `, muammoli: ${bad}` : ""}. Serverni qayta ishga tushiring.`);
