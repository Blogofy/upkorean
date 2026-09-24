// Replaces rows of vocab/examples.tsv from a batch file of rewritten sentences.
//
//   node scripts/apply-examples.mjs batch.tsv [--dry]
//
// A batch line is `key<TAB>ko<TAB>hl<TAB>cloze<TAB>uz`, keyed like examples.tsv. Every line is checked before
// anything is written: the highlight and the cloze must be found in the sentence, and found there first — a
// cloze of 국 inside 한국 would blank the wrong word — and the translation must mark its word in {braces}.
// One bad line stops the whole batch, so a half-applied batch never happens.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FILE = path.join(ROOT, "vocab", "examples.tsv");
const [batchFile] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const dry = process.argv.includes("--dry");
if (!batchFile) {
  console.error("node scripts/apply-examples.mjs batch.tsv [--dry]");
  process.exit(1);
}

const lines = fs.readFileSync(FILE, "utf8").split(/\r?\n/);
const header = lines[0];
const rows = lines.slice(1).filter(Boolean).map((line) => line.split("\t"));
const at = new Map(rows.map((row, i) => [row[0], i]));

const problems = [];
const batch = fs.readFileSync(batchFile, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
const seen = new Set();
for (const line of batch) {
  const [key, ko, hl, cloze, uz] = line.split("\t").map((cell) => (cell || "").trim());
  const where = `${key}: ${ko}`;
  if (!at.has(key)) { problems.push(`${where} — examples.tsv da bunday kalit yo'q`); continue; }
  if (seen.has(key)) problems.push(`${where} — batch ichida ikki marta`);
  seen.add(key);
  if (!ko || !hl || !uz) { problems.push(`${where} — ko, hl va uz shart`); continue; }
  if (!ko.includes(hl)) problems.push(`${where} — hl "${hl}" gapda yo'q`);
  if (cloze && !ko.includes(cloze)) problems.push(`${where} — cloze "${cloze}" gapda yo'q`);
  if (cloze && hl.includes(cloze) && ko.indexOf(cloze) !== ko.indexOf(hl) + hl.indexOf(cloze)) {
    problems.push(`${where} — cloze "${cloze}" gapda so'zdan oldin ham uchraydi`);
  }
  if (!/\{[^}]+\}/.test(uz)) problems.push(`${where} — tarjimada {so'z} belgilanmagan`);
  const old = rows[at.get(key)];
  rows[at.get(key)] = [key, ko, hl, cloze, uz, ...(old[5] ? [old[5]] : [])];
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`${problems.length} ta muammo — hech narsa yozilmadi.`);
  process.exit(1);
}
if (!dry) fs.writeFileSync(FILE, [header, ...rows.map((row) => row.join("\t"))].join("\n") + "\n");
console.log(`${batch.length} ta gap ${dry ? "tekshirildi" : "yangilandi"}.`);
