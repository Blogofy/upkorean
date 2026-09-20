// The course as JSON: three levels, each a list of days, one book sentence per word, and how each word
// is built.
//
// Read once at startup and serialised once, under one version string. A device downloads a level's parts
// once and afterwards only asks whether the version changed, which is why the payloads must stay
// byte-identical between requests. A level whose words have not been written yet is still announced —
// with `locked: true` and no parts — so the app can show all three and let the learner see what is coming.
import crypto from "node:crypto";
import fs from "node:fs";

import { loadCourse } from "../../packages/shared/course/data.js";
import { levelPayload, examplesPayload, rootsPayload } from "../../packages/shared/course/model.js";

const course = await loadCourse();

// Named for the source files, so a content edit changes the version and every device refetches.
export const VERSION = crypto
  .createHash("sha1")
  .update(course.files.map((file) => fs.readFileSync(file)).join("\n"))
  .digest("hex")
  .slice(0, 12);

const PART_BUILDERS = { vocab: levelPayload, examples: examplesPayload, roots: rootsPayload };
export const partNames = Object.keys(PART_BUILDERS);

// { "b/vocab": "…json…", … } — serialised once; these are 70–200 KB each and never change while the
// process runs.
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
      days: level.dayCount,
      words: level.words.length,
      target: level.target,
      // Nothing to download yet. The app shows the level and what it will hold, and keeps it shut.
      locked,
      parts: locked ? [] : partNames.map((name) => ({
        name,
        url: `/api/content/${level.id}/${name}?v=${VERSION}`,
        bytes: Buffer.byteLength(BODIES[`${level.id}/${name}`]),
      })),
    };
  }),
});

// The first level with words in it — where a learner who has chosen nothing starts.
export const defaultLevel = (course.levels.find((level) => level.words.length) || course.levels[0]).id;
