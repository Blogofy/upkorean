// Fast structural checks for the course vocabulary and example sentences.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.window = {};
await import("../public/js/vocab.js");
await import("../public/js/examples.js");

const days = window.UK_VOCAB;
const examples = window.UK_EXAMPLES || [];
const errors = [];
const warnings = [];
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!Array.isArray(days) || days.length !== 30) errors.push(`Expected 30 days, found ${days.length}`);

const words = [];
days.forEach((day, dayIndex) => {
  if (!Array.isArray(day) || day.length < 33 || day.length > 34) {
    errors.push(`Day ${dayIndex + 1}: expected 33-34 words, found ${day.length}`);
  }
  day.forEach((entry, wordIndex) => {
    if (!Array.isArray(entry) || entry.length !== 2 || entry.some((value) => typeof value !== "string" || !value.trim())) {
      errors.push(`Day ${dayIndex + 1}, word ${wordIndex + 1}: invalid [korean, uzbek] entry`);
      return;
    }
    words.push({ day: dayIndex + 1, position: wordIndex + 1, ko: entry[0], uz: entry[1] });
  });
});

if (words.length !== 1000) errors.push(`Expected 1000 words, found ${words.length}`);

const forbiddenKorean = ["제도로", "청소 년", "희만하다", "겆추다", "남녀노서", "뚜럿하다", "체한하다", "놀리적", "동창성", "얘쓰다", "과정되다"];
for (const bad of forbiddenKorean) {
  const hit = words.find((word) => word.ko === bad);
  if (hit) errors.push(`Known Korean typo remains: ${bad} (Day ${hit.day}, #${hit.position})`);
}

const byKorean = new Map();
for (const word of words) {
  const list = byKorean.get(word.ko) || [];
  list.push(word);
  byKorean.set(word.ko, list);
}
for (const [korean, entries] of byKorean) {
  if (entries.length > 1) warnings.push(`Duplicate kept from source: ${korean} (${entries.map((x) => `Day ${x.day}`).join(", ")})`);
}

// Word ids follow js/store.js: "<day>-<zero-based index>".
const byId = new Map(words.map((word) => [`${word.day}-${word.position - 1}`, word]));
const exampleIds = new Set();
examples.forEach((example, index) => {
  const label = `Example ${index + 1} (${example.id || "no id"} ${example.w || "unknown"})`;
  const word = byId.get(example.id);
  if (!word) errors.push(`${label}: word id does not exist`);
  else if (word.ko !== example.w) errors.push(`${label}: w does not match vocabulary word "${word.ko}"`);
  if (exampleIds.has(example.id)) errors.push(`${label}: duplicate example for this word`);
  exampleIds.add(example.id);
  if (!example.ko || !example.uz || !example.hl) errors.push(`${label}: w, ko, hl and uz are required`);
  if (example.hl && example.ko && !example.ko.includes(example.hl)) errors.push(`${label}: highlight is absent from Korean sentence`);
  if (example.cloze && example.ko && !example.ko.includes(example.cloze)) errors.push(`${label}: cloze is absent from Korean sentence`);
  if (example.uz && !/\{.+?\}/.test(example.uz)) errors.push(`${label}: Uzbek translation has no {target}`);
});
for (const [id, word] of byId) if (!exampleIds.has(id)) errors.push(`Day ${word.day}, #${word.position} ${word.ko}: no example sentence`);

const covered = exampleIds;
const cloze = new Set(examples.filter((example) => example.cloze).map((example) => example.id));
const audioDir = path.join(projectRoot, "audio");
// Every learning item must have recorded narrator audio; the app has no browser-TTS fallback.
const clipCount = (kind) => [...byId.keys()].filter((id) => fs.existsSync(path.join(audioDir, kind, `${id}.mp3`))).length;
const wordClips = clipCount("words"), sentenceClips = clipCount("sentences");
if (wordClips < words.length || sentenceClips < words.length) errors.push(`Narrator clips incomplete — run: node scripts/cut-audio-clips.mjs`);

console.log(`Content: ${days.length} days, ${words.length} words, ${examples.length} examples`);
console.log(`Coverage: examples ${covered.size}/${words.length}, cloze ${cloze.size}/${words.length}`);
console.log(`Audio: narrator clips ${wordClips}/${words.length} words, ${sentenceClips}/${words.length} sentences`);
warnings.forEach((warning) => console.warn(`WARN: ${warning}`));

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exitCode = 1;
} else {
  console.log("Content validation passed");
}
