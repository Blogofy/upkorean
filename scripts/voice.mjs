// Records the narrator clips with ElevenLabs: audio/words/<id>.mp3 reads a word, audio/sentences/<id>.mp3 its
// example sentence — the files apps/api/content.js looks for.
//
//   npm run voice -- words                  every word of 초급 that has no clip yet
//   npm run voice -- words --limit 10       only the first ten of those, to hear the voice before paying for all
//   npm run voice -- words --only b-36,b-709 --force   record these again, over the old clips
//   npm run voice -- sentences --level b    the example sentences
//   npm run voice -- words --dry            say how many characters it would cost, record nothing
//
// A clip that exists is never asked for again, so a run that stops — no credit left, no network — carries on
// where it stopped the next time. Words written the same (눈 the eye and 눈 the snow) are recorded once and
// the file copied. Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in .env; restart the server afterwards,
// it reads the clip list at startup.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { loadCourse } from "../packages/shared/course/data.js";

try { process.loadEnvFile(); } catch { /* no .env — use the real environment */ }

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1] : fallback;
};

const kind = args[0] === "sentences" ? "sentences" : args[0] === "words" ? "words" : null;
if (!kind) {
  console.error("Qaysi kliplar? npm run voice -- words | sentences  [--level b] [--limit N] [--only id,id] [--force] [--dry]");
  process.exit(1);
}
const levelId = option("level", "b");
const limit = Number(option("limit", 0)) || Infinity;
const only = option("only", "") ? new Set(option("only", "").split(",").map((id) => id.trim())) : null;
const force = flag("force");
const dry = flag("dry");

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE_ID;
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
// Calm and a little slow: the listener is a beginner. The same seed keeps the thousands of clips alike.
const SETTINGS = {
  stability: Number(process.env.ELEVENLABS_STABILITY || 0.5),
  similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY || 0.75),
  style: Number(process.env.ELEVENLABS_STYLE || 0), // above 0 the sentences are read with more feeling
  use_speaker_boost: true,
  speed: Number(process.env.ELEVENLABS_SPEED || 0.9),
};
const SEED = 7;
const PARALLEL = 2;

// What the narrator reads. A word gets a full stop, which makes it a statement said calmly rather than a
// fragment trailing off; an ending listed as "-하다" is read without its dash; of "A/B" only A is read.
const wordText = (ko) => String(ko).split("/")[0].replace(/\(.*?\)/g, "").replace(/^[-…~]+/, "").trim() + ".";

const course = (await loadCourse()).byLevel[levelId];
if (!course?.words.length) {
  console.error(`${levelId} darajasida so'z yo'q`);
  process.exit(1);
}
const jobs = course.words
  .map((word) => ({
    id: word.id,
    text: kind === "words" ? wordText(word.ko) : course.examples[word.id]?.ko?.trim(),
  }))
  .filter((job) => job.text && (!only || only.has(job.id)));

const dir = path.join(ROOT, "audio", kind);
fs.mkdirSync(dir, { recursive: true });
const fileOf = (id) => path.join(dir, `${id}.mp3`);
const todo = jobs.filter((job) => force || !fs.existsSync(fileOf(job.id)));

// One request per distinct text; the other words that read the same get a copy of its file.
const byText = new Map();
for (const job of todo) {
  if (!byText.has(job.text)) byText.set(job.text, []);
  byText.get(job.text).push(job.id);
}
// A text already recorded under another id is copied, not paid for again.
const recorded = new Map(jobs.filter((job) => fs.existsSync(fileOf(job.id))).map((job) => [job.text, job.id]));
const copies = [...byText].filter(([text]) => !force && recorded.has(text));
const requests = [...byText].filter(([text]) => force || !recorded.has(text)).slice(0, limit);
const chars = requests.reduce((sum, [text]) => sum + [...text].length, 0);

console.log(`${course.ko} · ${kind}: ${jobs.length} ta, tayyori ${jobs.length - todo.length}, qolgani ${todo.length}`);
console.log(`So'rov: ${requests.length} ta, ~${chars} belgi${copies.length ? ` · nusxa: ${copies.length}` : ""} · model ${MODEL}`);

for (const [text, ids] of copies) {
  for (const id of ids) fs.copyFileSync(fileOf(recorded.get(text)), fileOf(id));
}
if (dry || !requests.length) process.exit(0);

if (!KEY || !VOICE) {
  console.error(".env da ELEVENLABS_API_KEY va ELEVENLABS_VOICE_ID bo'lishi kerak");
  process.exit(1);
}

await showBalance();

class Stop extends Error {}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function speak(text) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS, seed: SEED }),
    }).catch((error) => ({ ok: false, status: 0, text: async () => error.message }));
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const body = await res.text();
    // Out of credit, a wrong key or voice: every further request would fail the same way.
    if ([400, 401, 402, 403, 404, 422].includes(res.status) || /quota|credit|limit_exceeded/i.test(body)) {
      throw new Stop(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
    }
    if (attempt >= 5) throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
    await sleep(1500 * 2 ** attempt);
  }
}

let done = 0;
let failed = 0;
let stopped = null;
const queue = [...requests];
const started = Date.now();

async function worker() {
  while (queue.length && !stopped) {
    const [text, ids] = queue.shift();
    try {
      const audio = await speak(text);
      // Written aside and renamed, so a clip cut off halfway is never mistaken for a finished one.
      const tmp = `${fileOf(ids[0])}.part`;
      fs.writeFileSync(tmp, audio);
      trim(tmp);
      fs.renameSync(tmp, fileOf(ids[0]));
      for (const id of ids.slice(1)) fs.copyFileSync(fileOf(ids[0]), fileOf(id));
      done++;
      if (done % 25 === 0 || done === requests.length) {
        console.log(`  ${done} / ${requests.length}  (${Math.round((Date.now() - started) / 1000)} s)`);
      }
    } catch (error) {
      if (error instanceof Stop) stopped = error.message;
      else { failed++; console.warn(`  ${ids[0]} "${text}": ${error.message}`); }
    }
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));

console.log(`Tayyor: ${done} ta klip${failed ? `, xato: ${failed}` : ""}.`);
if (stopped) {
  console.error(`To'xtadi — ${stopped}`);
  console.error("Qolganini keyin shu buyruq bilan davom ettiring: yozilganlari qayta so'ralmaydi.");
}
await showBalance();
console.log("Serverni qayta ishga tushiring — kliplar ro'yxati startda o'qiladi.");
process.exit(stopped || failed ? 1 : 0);

// ElevenLabs starts a clip with up to a third of a second of silence, which makes a tap on ▶ seem to lag.
// The quiet ends are cut to a few hundredths, as voice-cut does for the studio recordings. Without ffmpeg
// the clip is kept as it came.
function trim(file) {
  const out = `${file}.trim.mp3`;
  const run = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-af", [
    // A soft breath before the first word sits around -45 dB, so the start is cut at -40.
    "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-40dB",
    "areverse",
    "silenceremove=start_periods=1:start_silence=0.08:start_threshold=-50dB",
    "afade=t=in:d=0.04",
    "areverse",
    "afade=t=in:d=0.02",
  ].join(","), "-c:a", "libmp3lame", "-b:a", "128k", out]);
  if (run.status === 0 && fs.existsSync(out)) fs.renameSync(out, file);
  else fs.rmSync(out, { force: true });
}

// Characters left, when the key may read them; a key allowed only text to speech simply skips this.
async function showBalance() {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": KEY } });
    if (!res.ok) return;
    const sub = await res.json();
    if (Number.isFinite(sub.character_limit)) {
      console.log(`Balans: ${sub.character_count} / ${sub.character_limit} belgi ishlatilgan (${sub.tier})`);
    }
  } catch { /* not worth failing over */ }
}
