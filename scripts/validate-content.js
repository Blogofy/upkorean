// Fast structural checks for the course: every level that has words, checked on its own.
//
// A level short of its 50 × 30 target is a warning, not an error — the content is written level by level
// and the app locks what is not there yet. Anything malformed is an error, because a broken entry reaches
// a learner as a broken card.
import fs from "node:fs";
import path from "node:path";

import { AUDIO_DIR } from "../apps/api/paths.js";
import { LEVELS } from "../packages/shared/course/levels.js";
import { loadCourse } from "../packages/shared/course/data.js";

const errors = [];
const warnings = [];

const course = await loadCourse();
const written = course.levels.filter((level) => level.words.length);
if (!written.length) errors.push("Hech bir darajada so'z yo'q");

const forbiddenKorean = ["제도로", "청소 년", "희만하다", "겆추다", "남녀노서", "뚜럿하다", "체한하다", "놀리적", "동창성", "얘쓰다", "과정되다"];

for (const level of written) {
  const tag = `${level.ko} (${level.id})`;
  const { days: targetDays, perDay } = level.target;
  const target = targetDays * perDay;

  // A level still being written may be any shape; one that claims to be finished may not.
  const finished = level.words.length === target;
  if (!finished) warnings.push(`${tag}: ${level.words.length}/${target} so'z (${level.dayCount}/${targetDays} kun) — hali to'liq emas`);

  const offSize = [];
  for (let day = 1; day <= level.dayCount; day++) {
    const count = (level.days[day] || []).length;
    if (count !== perDay) offSize.push(`${day}-kun: ${count}`);
  }
  if (offSize.length) {
    const summary = `${tag}: ${offSize.length} kunda ${perDay} so'zdan boshqacha (${offSize.slice(0, 4).join(", ")}${offSize.length > 4 ? ", …" : ""})`;
    (finished ? errors : warnings).push(summary);
  }

  for (const word of level.words) {
    if (!word.ko?.trim() || !word.uz?.trim()) errors.push(`${tag} ${word.id}: [korean, uzbek] noto'g'ri`);
  }

  for (const bad of forbiddenKorean) {
    const hit = level.words.find((word) => word.ko === bad);
    if (hit) errors.push(`${tag}: ma'lum xato qolgan: ${bad} (${hit.day}-kun, #${hit.i + 1})`);
  }

  const byKorean = new Map();
  for (const word of level.words) byKorean.set(word.ko, [...(byKorean.get(word.ko) || []), word]);
  for (const [korean, entries] of byKorean) {
    if (entries.length > 1) warnings.push(`${tag}: manbadan kelgan takror: ${korean} (${entries.map((w) => `${w.day}-kun`).join(", ")})`);
  }

  const examples = Object.values(level.examples);
  const seen = new Set();
  for (const example of examples) {
    const label = `${tag} ${example.id} (${example.w || "?"})`;
    const word = level.byId[example.id];
    if (!word) { errors.push(`${label}: bunday so'z yo'q`); continue; }
    if (word.ko !== example.w) errors.push(`${label}: w lug'atdagi "${word.ko}" bilan mos emas`);
    if (seen.has(example.id)) errors.push(`${label}: bu so'zga misol ikki marta`);
    seen.add(example.id);
    if (!example.ko || !example.uz || !example.hl) errors.push(`${label}: w, ko, hl va uz shart`);
    if (example.hl && example.ko && !example.ko.includes(example.hl)) errors.push(`${label}: hl gapda yo'q`);
    if (example.cloze && example.ko && !example.ko.includes(example.cloze)) errors.push(`${label}: cloze gapda yo'q`);
    if (example.uz && !/\{.+?\}/.test(example.uz)) errors.push(`${label}: o'zbekcha tarjimada {target} yo'q`);
  }
  for (const word of level.words) if (!seen.has(word.id)) errors.push(`${tag} ${word.day}-kun #${word.i + 1} ${word.ko}: misol gapi yo'q`);

  // Every learning item must have recorded narrator audio; the app has no device-TTS fallback.
  const clips = (kind) => level.words.filter((word) => fs.existsSync(path.join(AUDIO_DIR, kind, `${word.id}.mp3`))).length;
  const wordClips = clips("words"), sentenceClips = clips("sentences");
  if (wordClips < level.words.length || sentenceClips < level.words.length) {
    warnings.push(`${tag}: diktor audiosi to'liq emas — so'z ${wordClips}/${level.words.length}, gap ${sentenceClips}/${level.words.length}`);
  }

  const cloze = examples.filter((example) => example.cloze).length;
  console.log(`${tag}: ${level.dayCount} kun, ${level.words.length} so'z, ${examples.length} misol (cloze ${cloze}), audio ${wordClips}/${sentenceClips}`);
}

for (const level of LEVELS) {
  if (!course.byLevel[level.id].words.length) console.log(`${level.ko} (${level.id}): so'zlar hali yozilmagan — ilovada qulflangan`);
}

warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log("Kontent tekshiruvi o'tdi");
}
