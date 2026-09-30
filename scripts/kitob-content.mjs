// The book course, packed into the app itself: the personal "Kitob" build has no server of its own, so
// the manifest and every part the API would send are written to apps/mobile/src/kitob/content.json, byte
// for byte what apps/api/content.js serves.
//
//   node scripts/kitob-content.mjs
import fs from "node:fs";
import path from "node:path";

import { manifest, partNames, partBody, defaultLevel, VERSION } from "../apps/api/content.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "apps", "mobile", "src", "kitob", "content.json");

const man = manifest();
const parts = {};
for (const level of man.levels) {
  if (level.locked) continue;
  for (const name of partNames) parts[`${level.id}/${name}`] = JSON.parse(partBody(level.id, name));
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ version: VERSION, defaultLevel, manifest: man, parts }));
console.log(`${path.relative(ROOT, OUT)}: ${Object.keys(parts).join(", ")} · ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
