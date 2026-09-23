// The keyboard and the reading line.
//
// Typing Korean is not appending letters: three taps become one character and one tap takes a piece of it
// away again. Every case below is one a learner hits inside the first minute of the writing exercise.
import { test } from "node:test";
import assert from "node:assert/strict";

import { compose, backspace, firstJamo, romanize, syllableReading, shiftKey } from "../packages/shared/hangul.js";

const type = (jamos) => jamos.reduce((text, jamo) => compose(text, jamo), "");

test("three taps make one syllable", () => {
  assert.equal(type(["ㅎ"]), "ㅎ");
  assert.equal(type(["ㅎ", "ㅏ"]), "하");
  assert.equal(type(["ㅎ", "ㅏ", "ㄱ"]), "학");
  assert.equal(type(["ㅎ", "ㅏ", "ㄱ", "ㄱ", "ㅛ"]), "학교");
});

test("a consonant that turns out to start the next syllable moves across", () => {
  // 하 + ㄱ reads as 학 until the vowel arrives, and then the ㄱ belongs to 교.
  assert.equal(type(["ㅅ", "ㅓ", "ㄴ", "ㅅ", "ㅐ", "ㅇ"]), "선생");
  assert.equal(type(["ㅅ", "ㅜ", "ㄱ", "ㅈ", "ㅔ"]), "숙제");
});

test("two-tap vowels and two-tap finals join up", () => {
  assert.equal(type(["ㄱ", "ㅗ", "ㅏ"]), "과");
  assert.equal(type(["ㅇ", "ㅜ", "ㅣ"]), "위");
  assert.equal(type(["ㄱ", "ㅏ", "ㅂ", "ㅅ"]), "값");
  assert.equal(type(["ㅇ", "ㅓ", "ㅂ", "ㅅ", "ㅓ"]), "업서", "the second half of a cluster can still move on");
});

test("backspace undoes one tap, not one character", () => {
  assert.equal(backspace("학"), "하");
  assert.equal(backspace("하"), "ㅎ");
  assert.equal(backspace("ㅎ"), "");
  assert.equal(backspace(""), "");
  assert.equal(backspace("값"), "갑");
  assert.equal(backspace("과"), "고");
  assert.equal(backspace("학교"), "학ㄱ");
});

test("typing and deleting the whole word comes back to nothing", () => {
  const taps = ["ㅅ", "ㅓ", "ㄴ", "ㅅ", "ㅐ", "ㅇ", "ㄴ", "ㅣ", "ㅁ"];
  let text = type(taps);
  assert.equal(text, "선생님");
  for (let i = 0; i < taps.length; i++) text = backspace(text);
  assert.equal(text, "");
});

test("the shift key gives the tense consonants and the wide vowels", () => {
  assert.equal(shiftKey("ㄱ", true), "ㄲ");
  assert.equal(shiftKey("ㄱ", false), "ㄱ");
  assert.equal(shiftKey("ㅐ", true), "ㅒ");
  assert.equal(shiftKey("ㅁ", true), "ㅁ", "a key with no shifted form is left alone");
  assert.equal(type(["ㄲ", "ㅗ", "ㅊ"]), "꽃");
});

test("the hint is the first tap of the word", () => {
  assert.equal(firstJamo("선생님"), "ㅅ");
  assert.equal(firstJamo("학교"), "ㅎ");
  assert.equal(firstJamo(""), "");
});

test("the reading line follows the sounds, not the letters", () => {
  assert.equal(syllableReading("학교"), "hak-gyo");
  assert.equal(syllableReading("숙제"), "suk-je");
  assert.equal(syllableReading("성적"), "seong-jeok");
  assert.equal(romanize("좋아요"), "joayo", "ㅎ drops before a vowel");
  assert.equal(romanize("한국"), "hanguk");
  assert.equal(romanize("독립"), "dongnip", "assimilation, not letter by letter");
});

test("the reading line leaves anything that is not Hangul alone", () => {
  assert.equal(romanize("OK"), "OK");
  assert.equal(syllableReading("A학"), "hak", "only syllables are read aloud");
});
