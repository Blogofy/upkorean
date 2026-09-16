import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.window = globalThis;
await import("../public/js/vocab.js");
await import("../public/js/roots.js");

const WORDS = {};
globalThis.UK_VOCAB.forEach((list, d) => list.forEach(([ko, uz], i) => { WORDS[`${d + 1}-${i}`] = { ko, uz }; }));
const ROOTS = Object.entries(globalThis.UK_ROOTS);
const HANGUL_SYLLABLE = /^[가-힣]$/;
const HANJA = /^[一-鿿]$/;

test("every entry belongs to a course word", () => {
  for (const [id] of ROOTS) assert.ok(WORDS[id], `${id} is not a word id`);
});

test("parts spell the word exactly", () => {
  for (const [id, r] of ROOTS) {
    if (!r.parts) continue;
    assert.equal(r.parts.map((p) => p.k).join(""), WORDS[id].ko, `${id}: parts do not spell ${WORDS[id].ko}`);
  }
});

test("a hanja piece is one syllable with one character and a meaning", () => {
  for (const [id, r] of ROOTS) {
    for (const p of r.parts || []) {
      assert.ok(p.k && p.uz, `${id}: piece without text or meaning`);
      if (p.h === undefined) continue;
      assert.match(p.k, HANGUL_SYLLABLE, `${id}: ${p.k} should be one syllable`);
      assert.match(p.h, HANJA, `${id}: ${p.h} should be one hanja`);
    }
  }
});

test("the same hanja has the same meaning everywhere", () => {
  const seen = new Map();
  for (const [id, r] of ROOTS) {
    for (const p of r.parts || []) {
      if (!p.h) continue;
      const first = seen.get(p.h);
      if (first) assert.equal(p.uz, first.uz, `${p.h}: "${p.uz}" in ${id} but "${first.uz}" in ${first.id}`);
      else seen.set(p.h, { uz: p.uz, id });
    }
  }
});

test("every entry explains something and uses the expected fields", () => {
  const FIELDS = new Set(["parts", "idea", "family", "hint", "note"]);
  for (const [id, r] of ROOTS) {
    assert.ok(r.idea, `${id}: idea is missing`);
    for (const k of Object.keys(r)) assert.ok(FIELDS.has(k), `${id}: unknown field ${k}`);
    for (const f of r.family || []) assert.ok(Array.isArray(f) && f.length === 2 && f[0] && f[1], `${id}: family entries are [korean, uzbek]`);
  }
});

test("day 1 is complete", () => {
  for (let i = 0; i < globalThis.UK_VOCAB[0].length; i++) assert.ok(globalThis.UK_ROOTS[`1-${i}`], `1-${i} has no entry`);
});
