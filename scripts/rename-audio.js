// One-time: give every narrator clip the level it belongs to.
//
// Clips were named after a word id of "<day>-<index>", from the days when there was one course. Word ids
// carry their level now ("b-1-0"), and the server serves clips by word id, so the files have to say the
// same thing. Run once here and once on the server; running it twice is harmless, because a file that
// already has a level in its name is left alone.
//
//   node scripts/rename-audio.js          # say what would change
//   node scripts/rename-audio.js --write  # change it
import fs from "node:fs";
import path from "node:path";

import { AUDIO_DIR } from "../apps/api/paths.js";

const LEVEL = process.env.LEVEL || "b";
const WRITE = process.argv.includes("--write");
const OLD = /^(\d{1,2}-\d{1,2})\.mp3$/;
const DONE = /^[bma]-\d{1,2}-\d{1,2}\.mp3$/;

let renamed = 0, already = 0, skipped = 0, clashed = 0;

for (const kind of ["words", "sentences"]) {
  const dir = path.join(AUDIO_DIR, kind);
  if (!fs.existsSync(dir)) {
    console.log(`${kind}: papka yo'q (${dir})`);
    continue;
  }
  for (const name of fs.readdirSync(dir)) {
    if (DONE.test(name)) { already++; continue; }
    const match = OLD.exec(name);
    if (!match) { skipped++; continue; }
    const to = `${LEVEL}-${match[1]}.mp3`;
    if (fs.existsSync(path.join(dir, to))) { clashed++; continue; }
    if (WRITE) fs.renameSync(path.join(dir, name), path.join(dir, to));
    renamed++;
  }
}

console.log(`${WRITE ? "Nomlandi" : "Nomlanadi"}: ${renamed}`);
if (already) console.log(`Allaqachon darajali: ${already}`);
if (skipped) console.log(`Tegilmadi (boshqa nom): ${skipped}`);
if (clashed) console.log(`O'tkazib yuborildi (nom band): ${clashed}`);
if (!WRITE && renamed) console.log("\nHaqiqatdan o'zgartirish uchun: node scripts/rename-audio.js --write");
