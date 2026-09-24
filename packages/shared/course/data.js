// Reading the course off disk. Server only: the apps never hold the files, they fetch /api/content.
//
// A level is whatever `course/<id>/` contains. A level with no folder is not an error — it is a level
// whose words have not been translated yet, and it comes back empty so the app can lock it and say so.
// The files are written by scripts/build-course.mjs from vocab/.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { LEVELS } from "./levels.js";
import { buildLevel } from "./model.js";

const HERE = import.meta.dirname;
const PARTS = ["vocab.js", "examples.js"];

// pathToFileURL, not the bare path: on Windows "D:\…" is not a URL the ESM loader accepts.
const importIfPresent = async (file) => (fs.existsSync(file) ? import(pathToFileURL(file).href) : null);

async function readLevel(id) {
  const dir = path.join(HERE, id);
  if (!fs.existsSync(dir)) return buildLevel(id, {});
  const [vocab, examples] = await Promise.all(PARTS.map((name) => importIfPresent(path.join(dir, name))));
  return buildLevel(id, { vocab: vocab?.default || [], examples: examples?.default || [] });
}

export async function loadCourse() {
  const levels = await Promise.all(LEVELS.map((level) => readLevel(level.id)));
  return {
    levels,
    byLevel: Object.fromEntries(levels.map((level) => [level.id, level])),
    // Which files were read, so a content edit can change the version the apps compare against.
    files: LEVELS.flatMap((level) => PARTS.map((name) => path.join(HERE, level.id, name)).filter((file) => fs.existsSync(file))),
  };
}
