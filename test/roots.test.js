import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../packages/shared/vocab.js");
await import("../packages/shared/roots.js");

const WORDS = {};
globalThis.UK_VOCAB.forEach((list, d) => list.forEach(([ko, uz], i) => { WORDS[`${d + 1}-${i}`] = { ko, uz, day: d + 1 }; }));
const ROOTS = Object.entries(globalThis.UK_ROOTS);
const HANJA = globalThis.UK_HANJA;
const SYLLABLE = /^[가-힣]$/;
const CJK = /^[一-鿿]$/;

// Hanja whose reading legitimately differs between words (e.g. 樂 락/악, 不 불/부).
const POLYPHONES = new Set(["樂", "說", "行", "便", "不", "率", "度", "復", "更", "省", "殺", "識", "切", "北", "畫", "惡", "易", "參", "金", "車", "宅", "茶", "拓", "暴", "否", "索", "數", "降", "見", "狀", "則", "合", "塞", "糖"]);

// The initial-sound rule: 리/이, 력/역, 로/노, 락/낙 are the same reading.
function readingKey(syllable) {
  const code = syllable.charCodeAt(0) - 0xac00;
  let initial = Math.floor(code / 588);
  const vowel = Math.floor((code % 588) / 28), final = code % 28;
  const Y_I = new Set([2, 3, 6, 7, 12, 17, 20]); // ㅑ ㅒ ㅕ ㅖ ㅛ ㅠ ㅣ
  if (initial === 5) initial = 2; // ㄹ → ㄴ
  if (initial === 2 && Y_I.has(vowel)) initial = 11; // ㄴ + i/y → ㅇ
  return `${initial}.${vowel}.${final}`;
}

test("every entry belongs to a course word", () => {
  for (const [id] of ROOTS) assert.ok(WORDS[id], `${id} is not a word id`);
});

test("parts spell the word exactly", () => {
  for (const [id, r] of ROOTS) {
    if (!r.parts) continue;
    assert.equal(r.parts.map((p) => p.k).join(""), WORDS[id].ko, `${id}: parts do not spell ${WORDS[id].ko}`);
  }
});

test("every piece has a meaning; hanja pieces are one syllable with one hanja from the glossary", () => {
  for (const [id, r] of ROOTS) {
    for (const p of r.parts || []) {
      if (p.space) continue;
      assert.ok(p.k, `${id}: empty piece`);
      if (p.h !== undefined) {
        assert.match(p.k, SYLLABLE, `${id}: ${p.k} should be one syllable`);
        assert.match(p.h, CJK, `${id}: ${p.h} should be one hanja`);
      }
      assert.ok(p.uz, `${id}: ${p.k}${p.h || ""} has no meaning (missing from HANJA or SUFFIX?)`);
    }
  }
});

test("the same hanja is read the same way everywhere", () => {
  const seen = new Map();
  for (const [id, r] of ROOTS) {
    for (const p of r.parts || []) {
      if (!p.h || POLYPHONES.has(p.h)) continue;
      const first = seen.get(p.h);
      if (first) assert.equal(readingKey(p.k), readingKey(first.k), `${p.h}: ${p.k} in ${id} but ${first.k} in ${first.id}`);
      else seen.set(p.h, { k: p.k, id });
    }
  }
});

test("the glossary has no unused hanja", () => {
  const used = new Set(ROOTS.flatMap(([, r]) => (r.parts || []).map((p) => p.h).filter(Boolean)));
  for (const h of Object.keys(HANJA)) assert.ok(used.has(h), `${h} is in HANJA but no word uses it`);
});

test("every entry explains something and uses the expected fields", () => {
  const FIELDS = new Set(["parts", "idea", "family", "hint", "note", "origin"]);
  for (const [id, r] of ROOTS) {
    assert.ok(r.idea, `${id}: idea is missing`);
    for (const k of Object.keys(r)) assert.ok(FIELDS.has(k), `${id}: unknown field ${k}`);
    for (const f of r.family || []) assert.ok(Array.isArray(f) && f.length === 2 && f[0] && f[1], `${id}: family entries are [korean, uzbek]`);
    const pieces = (r.parts || []).filter((p) => !p.space);
    if (r.parts) assert.ok(pieces.length > 1 || pieces[0].h, `${id}: a single native piece explains nothing — leave parts out`);
  }
});

test("every word has an origin that agrees with its parts", () => {
  const counts = { sino: 0, native: 0, loan: 0 };
  for (const [id, r] of ROOTS) {
    assert.ok(r.origin in counts, `${id}: origin ${r.origin}`);
    counts[r.origin]++;
    const hasHanja = (r.parts || []).some((p) => p.h);
    if (r.origin === "sino") continue;
    assert.ok(!hasHanja, `${id}: ${r.origin} word with hanja parts`);
  }
  for (const [id, o] of Object.entries(globalThis.UK_ORIGIN_OVERRIDES)) {
    assert.ok(WORDS[id], `origin override for unknown word ${id}`);
    if (o === "sino") assert.ok(!(globalThis.UK_ROOTS[id].parts || []).some((p) => p.h), `${id}: has hanja parts, no override needed`);
  }
  assert.ok(counts.sino > 600 && counts.native > 250 && counts.loan >= 10, JSON.stringify(counts));
});

test("every course word has an entry", () => {
  for (const id of Object.keys(WORDS)) assert.ok(globalThis.UK_ROOTS[id], `${id} ${WORDS[id].ko} has no entry`);
});
