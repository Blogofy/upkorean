// Fast structural checks for the course: every level that has words, checked on its own.
//
// The course is published lesson by lesson as it is translated (scripts/build-course.mjs), so a level short
// of its plan is a warning, not an error, and so are words still waiting for an example sentence or a
// recording. Anything malformed is an error, because a broken entry reaches a learner as a broken card.
import fs from "node:fs";
import path from "node:path";

import { AUDIO_DIR } from "../apps/api/paths.js";
import { LEVELS } from "../packages/shared/course/levels.js";
import { loadCourse } from "../packages/shared/course/data.js";
import { LESSON_SIZE } from "../packages/shared/srs.js";

const errors = [];
const warnings = [];

const course = await loadCourse();
const written = course.levels.filter((level) => level.words.length);
if (!written.length) errors.push("Hech bir darajada so'z yo'q");

for (const level of written) {
  const tag = `${level.ko} (${level.id})`;
  if (level.words.length < level.planned) {
    warnings.push(`${tag}: ${level.words.length}/${level.planned} so'z ochiq (${level.lessonCount} dars) — qolgani tarjima qilinmoqda`);
  }

  // Every lesson but the level's last is a full one; a short lesson in the middle means the plan was cut.
  level.lessons.slice(1, -1).forEach((lesson) => {
    if (lesson.ids.length !== LESSON_SIZE) errors.push(`${tag} ${lesson.n}-dars: ${lesson.ids.length} so'z (${LESSON_SIZE} bo'lishi kerak)`);
  });

  const seenIds = new Set();
  for (const word of level.words) {
    if (!word.ko?.trim() || !word.uz?.trim()) errors.push(`${tag} ${word.id}: ko va uz shart`);
    if (seenIds.has(word.id)) errors.push(`${tag} ${word.id}: bir so'z ikki marta`);
    seenIds.add(word.id);
  }

  const examples = Object.values(level.examples);
  for (const example of examples) {
    const label = `${tag} ${example.id} (${example.w || "?"})`;
    const word = level.byId[example.id];
    if (word.ko !== example.w) errors.push(`${label}: w lug'atdagi "${word.ko}" bilan mos emas`);
    if (!example.ko || !example.uz || !example.hl) errors.push(`${label}: ko, hl va uz shart`);
    if (example.hl && example.ko && !example.ko.includes(example.hl)) errors.push(`${label}: hl gapda yo'q`);
    if (example.cloze && example.ko && !example.ko.includes(example.cloze)) errors.push(`${label}: cloze gapda yo'q`);
    if (example.uz && !/\{.+?\}/.test(example.uz)) errors.push(`${label}: o'zbekcha tarjimada {so'z} yo'q`);
  }
  if (examples.length < level.words.length) warnings.push(`${tag}: misol gapi ${examples.length}/${level.words.length} so'zda bor`);

  const clips = (kind) => level.words.filter((word) => fs.existsSync(path.join(AUDIO_DIR, kind, `${word.id}.mp3`))).length;
  const wordClips = clips("words"), sentenceClips = clips("sentences");
  if (wordClips < level.words.length || sentenceClips < examples.length) {
    warnings.push(`${tag}: diktor audiosi — so'z ${wordClips}/${level.words.length}, gap ${sentenceClips}/${examples.length}`);
  }

  const cloze = examples.filter((example) => example.cloze).length;
  console.log(`${tag}: ${level.lessonCount} dars, ${level.words.length} so'z, ${examples.length} misol (cloze ${cloze}), audio ${wordClips}/${sentenceClips}`);
}

for (const level of LEVELS) {
  if (!course.byLevel[level.id].words.length) console.log(`${level.ko} (${level.id}): so'zlar hali tarjima qilinmagan — ilovada qulflangan`);
}

warnings.forEach((warning) => console.warn(`WARN: ${warning}`));
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log("Kontent tekshiruvi o'tdi");
}
