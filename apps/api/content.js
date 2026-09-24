// The course as JSON: three levels, each a list of lessons and their words, and one sentence per word.
//
// Read once at startup and serialised once, under one version string. A device downloads a level's parts
// once and afterwards only asks whether the version changed, which is why the payloads must stay
// byte-identical between requests. A level whose words have not been translated yet is still announced —
// with `locked: true` and no parts — so the app can show all three and let the learner see what is coming.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AUDIO_DIR } from "./paths.js";
import { loadCourse } from "../../packages/shared/course/data.js";
import { levelPayload, examplesPayload } from "../../packages/shared/course/model.js";

const course = await loadCourse();

// Narrator clips: audio/words/<id>.mp3 reads the word, audio/sentences/<id>.mp3 its example sentence, where
// <id> is the word id, level and all: "b-36.mp3". They are recorded as the content grows, so each word says
// whether it has one yet.
export const CLIP_FILE = /^[bma]-\d{1,5}\.mp3$/;
const clipIds = (kind) => {
  const dir = path.join(AUDIO_DIR, kind);
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((name) => CLIP_FILE.test(name)).map((name) => name.slice(0, -4)));
};
const clips = { words: clipIds("words"), sentences: clipIds("sentences") };
export const hasClips = clips.words.size > 0 || clips.sentences.size > 0;
export const clipCounts = { words: clips.words.size, sentences: clips.sentences.size };

// Named for the source files and the recordings, so a content edit or a new clip changes the version and
// every device refetches.
export const VERSION = crypto
  .createHash("sha1")
  .update(course.files.map((file) => fs.readFileSync(file)).join("\n"))
  .update([...clips.words].sort().join(",") + "|" + [...clips.sentences].sort().join(","))
  .digest("hex")
  .slice(0, 12);

const PART_BUILDERS = { vocab: (level) => levelPayload(level, clips), examples: examplesPayload };
export const partNames = Object.keys(PART_BUILDERS);

// { "b/vocab": "…json…", … } — serialised once; they never change while the process runs.
const BODIES = {};
for (const level of course.levels) {
  if (!level.words.length) continue;
  for (const [name, build] of Object.entries(PART_BUILDERS)) {
    BODIES[`${level.id}/${name}`] = JSON.stringify({ version: VERSION, ...build(level) });
  }
}

export const partBody = (level, name) => BODIES[`${level}/${name}`] || null;

export const manifest = () => ({
  version: VERSION,
  levels: course.levels.map((level) => {
    const locked = !level.words.length;
    return {
      id: level.id,
      ko: level.ko,
      uz: level.uz,
      parts: level.partCount,
      words: level.words.length,
      // Every word of the level's grades — what it will hold once all of it is translated.
      planned: level.planned,
      // Nothing to download yet. The app shows the level and what it will hold, and keeps it shut.
      locked,
      files: locked ? [] : partNames.map((name) => ({
        name,
        url: `/api/content/${level.id}/${name}?v=${VERSION}`,
        bytes: Buffer.byteLength(BODIES[`${level.id}/${name}`]),
      })),
    };
  }),
});

// The first level with words in it — where a learner who has chosen nothing starts.
export const defaultLevel = (course.levels.find((level) => level.words.length) || course.levels[0]).id;
