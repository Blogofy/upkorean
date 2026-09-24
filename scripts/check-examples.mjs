// How well the example sentences review the path. For every sentence it finds which course words it uses
// and when the learner met them: the word it teaches, words from earlier lessons (the review), words from
// later lessons (not met yet — a sentence should not lean on them) and pieces it cannot place at all.
//
//   node scripts/check-examples.mjs [--level b] [--from 1] [--to 61] [--list]
//
// Korean inflects, so a word is looked for by the forms its stem takes: 먹다 as 먹…, 가다 as 가/갔/간/갈…,
// 춥다 as 추워/추운, 모르다 as 몰라, 듣다 as 들어. The longest known form at the start of each word of the
// sentence wins. It is a heuristic, good enough to steer the writing, not a morphological analyser.
import fs from "node:fs";
import path from "node:path";

import { loadCourse } from "../packages/shared/course/data.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const arg = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const levelId = arg("level", "b");
const from = Number(arg("from", 1));
const to = Number(arg("to", 999));
const list = process.argv.includes("--list");

const course = (await loadCourse()).byLevel[levelId];
const plan = fs.readFileSync(path.join(ROOT, "vocab", "plan.tsv"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"));
const head = plan[0];
const posOf = new Map(plan.slice(1).filter((row) => row[0] === levelId).map((row) => [`${levelId}-${row[head.indexOf("nid")]}`, row[head.indexOf("pos")]]));

// ---------- Hangul ----------
const BASE = 0xac00;
const isSyl = (ch) => ch >= "가" && ch <= "힣";
const split = (ch) => { const o = ch.charCodeAt(0) - BASE; return [Math.floor(o / 588), Math.floor((o % 588) / 28), o % 28]; };
const join = (l, v, t) => String.fromCharCode(BASE + l * 588 + v * 28 + t);
const V = { a: 0, ae: 1, ya: 2, yae: 3, eo: 4, e: 5, yeo: 6, o: 8, wa: 9, wae: 10, oe: 11, u: 13, wo: 14, eu: 18, i: 20 };
const T = { none: 0, n: 4, d: 7, l: 8, b: 17, s: 19, ss: 20, h: 27 };
const brightVowel = (v) => v === V.a || v === V.o || v === V.ya;

// Every surface form a stem shows at the start of a word.
function verbForms(stem, adjective) {
  const forms = new Set([stem]);
  const pre = stem.slice(0, -1);
  const last = stem.slice(-1);
  if (!isSyl(last)) return forms;
  const [l, v, t] = split(last);
  const add = (...xs) => xs.forEach((x) => forms.add(x));
  if (last === "하") {
    add(`${pre}해`, `${pre}했`, `${pre}한`, `${pre}할`, `${pre}합`);
    return forms;
  }
  if (t === T.none) {
    add(pre + join(l, v, T.n), pre + join(l, v, T.l), pre + join(l, v, T.b));
    if (last === "시") add(`${pre}세`); // 계시 → 계세요
    let merged = null;
    if ([V.a, V.eo, V.ae, V.e, V.yeo].includes(v)) merged = last;
    else if (v === V.o) merged = join(l, V.wa, 0);
    else if (v === V.u) merged = join(l, V.wo, 0);
    else if (v === V.i) merged = join(l, V.yeo, 0);
    else if (v === V.oe) merged = join(l, V.wae, 0);
    else if (v === V.eu) {
      const prev = pre.slice(-1);
      if (l === 5 && prev && isSyl(prev)) {
        // 르: 모르 → 몰라, 부르 → 불러.
        const [pl, pv] = split(prev);
        const withL = pre.slice(0, -1) + join(pl, pv, T.l);
        const vowel = brightVowel(pv) ? "라" : "러";
        add(withL + vowel, withL + (brightVowel(pv) ? "랐" : "렀"));
      } else {
        const bright = prev && isSyl(prev) && brightVowel(split(prev)[1]);
        merged = join(l, bright ? V.a : V.eo, 0);
      }
    }
    if (merged) {
      const [ml, mv] = split(merged);
      add(pre + merged, pre + join(ml, mv, T.ss));
    }
    return forms;
  }
  if (t === T.b && adjective !== false) {
    // ㅂ: 춥 → 추워/추운, 돕 → 도와.
    const bare = pre + join(l, v, 0);
    add(`${bare}워`, `${bare}와`, `${bare}운`, `${bare}울`, `${bare}웠`, `${bare}왔`, `${bare}우`);
  }
  if (t === T.d) add(pre + join(l, v, T.l)); // ㄷ: 듣 → 들어.
  if (t === T.s) add(pre + join(l, v, 0)); // ㅅ: 낫 → 나아, 짓 → 지어.
  if (t === T.h && stem !== "좋" && stem !== "놓" && stem !== "넣" && stem !== "쌓" && stem !== "낳") {
    // ㅎ: 그렇 → 그래/그런, 하얗 → 하얘/하얀.
    const e = v === V.ya ? V.yae : V.ae;
    add(pre + join(l, v, T.n), pre + join(l, e, 0), pre + join(l, e, T.ss), pre + join(l, v, T.l));
  }
  if (t === T.l) {
    // ㄹ drops before ㄴ, ㅂ, ㅅ: 살 → 사는/산/삽니다/사세요, 만들 → 만든.
    const bare = pre + join(l, v, 0);
    add(pre + join(l, v, T.n), pre + join(l, v, T.b), `${bare}세`, `${bare}시`, `${bare}셨`, `${bare}신`, `${bare}는`, `${bare}니`, `${bare}네`);
  }
  return forms;
}

// What may follow a form inside one word of a sentence: particles after a noun, endings after a verb stem.
// Anything else after 비 or 가 is a different word (비빔밥, 가방) that a longer form should have found.
const PARTICLE = new Set("해했할합이가은는을를에도만의와과하한으로예부까보처마쯤랑께들야이".split(""));
const ENDING = new Set("던질이까져졌으요고서세시셨지면며러려자기게어아았었겠네나니다더든잖죠습십는은을도야라".split(""));
// A few nouns spelled like a common verb form: 가요 (a song) is almost always 가다 + 요.
const RARE = new Set(["가요"]);
// Grammar that is not a word of the list (-고 싶다, -ㄹ 수 있다) and the names the sentences use.
const FREE = /^(않|때문|싶|수$|수가|수도|수는|제$|제가$|마세요|지민|민수|수진|준호|영수|유나)/;

const entries = [];
for (const word of course.words) {
  const pos = posOf.get(word.id) || "";
  const ko = String(word.ko).split("/")[0].replace(/\(.*?\)/g, "").trim();
  if (!ko || ko.startsWith("-")) continue;
  const verb = /동사|형용사/.test(pos) && ko.endsWith("다") && ko.length > 1;
  if (verb) {
    const stem = ko.slice(0, -1);
    const forms = verbForms(stem, /형용사/.test(pos) || undefined);
    // The modifier and future forms (간, 갈, 한) are the weakest guesses; a noun or particle spelled the
    // same (한 "one", 안 "not") comes first.
    for (const form of forms) entries.push({ form, word, verb: true, weak: form !== stem && (/[ㄴㄹ]$/.test(finalJamo(form)) || finalJamo(stem) === "ㄹ") });
  } else {
    entries.push({ form: ko, word, verb: false, weak: RARE.has(ko) });
  }
}
function finalJamo(form) {
  const last = form.slice(-1);
  if (!isSyl(last)) return "";
  return ["", "", "", "", "ㄴ", "", "", "", "ㄹ"][split(last)[2]] || "";
}

// The course word each word of a sentence starts with, or null. `prefer` is the word the sentence teaches:
// when it fits, it is the reading meant.
function wordsOf(sentence, prefer) {
  const found = [];
  for (const raw of sentence.split(/\s+/)) {
    const token = raw.replace(/[^가-힣]/g, "");
    if (!token) continue;
    const fits = entries.filter(({ form, verb }) => {
      if (!token.startsWith(form)) return false;
      const next = token[form.length];
      if (next === undefined) return true;
      if (verb) return ENDING.has(next);
      return form.length > 1 || PARTICLE.has(next);
    });
    fits.sort((a, b) => (b.word.id === prefer) - (a.word.id === prefer)
      || a.weak - b.weak
      || b.form.length - a.form.length
      || a.word.lesson - b.word.lesson);
    found.push({ token, word: fits.length ? fits[0].word : null });
  }
  return found;
}

const lessonOf = (word) => word.lesson;
const uses = new Map(); // word id → lessons whose sentences use it again
const rows = [];
for (const lesson of course.lessons.slice(1)) {
  for (const id of lesson.ids) {
    const example = course.examples[id];
    if (!example) continue;
    const parts = wordsOf(example.ko, id);
    const review = [];
    const later = [];
    const unknown = [];
    for (const { token, word } of parts) {
      if (!word) { if (!FREE.test(token)) unknown.push(token); continue; }
      if (word.id === id) continue;
      if (lessonOf(word) < lesson.n) {
        review.push(word);
        if (!uses.has(word.id)) uses.set(word.id, []);
        uses.get(word.id).push(lesson.n);
      } else if (lessonOf(word) > lesson.n) later.push(word);
    }
    rows.push({ lesson: lesson.n, id, ko: example.ko, words: parts.length, review, later, unknown });
  }
}

const inRange = rows.filter((row) => row.lesson >= from && row.lesson <= to);
if (list) {
  for (const row of inRange) {
    const marks = [
      row.review.length ? `+${row.review.map((w) => `${w.ko}(${w.lesson})`).join(",")}` : "",
      row.later.length ? `!keyin:${row.later.map((w) => `${w.ko}(${w.lesson})`).join(",")}` : "",
      row.unknown.length ? `?${row.unknown.join(",")}` : "",
    ].filter(Boolean).join("  ");
    console.log(`${row.lesson}\t${course.byId[row.id].ko}\t${row.ko}\t${marks}`);
  }
}

// Per band of lessons: length, how much each sentence reviews, what it leans on too early.
const bands = [];
for (let a = from; a <= Math.min(to, course.lessonCount); a += 5) bands.push([a, Math.min(a + 4, to, course.lessonCount)]);
console.log("darslar\tso'z/gap\ttakror/gap\ttakrorsiz\tkeyingi so'z\tnoma'lum");
for (const [a, b] of bands) {
  const band = rows.filter((row) => row.lesson >= a && row.lesson <= b);
  if (!band.length) continue;
  const avg = (f) => (band.reduce((sum, row) => sum + f(row), 0) / band.length).toFixed(1);
  console.log(`${a}-${b}\t${avg((r) => r.words)}\t${avg((r) => r.review.length)}\t${band.filter((r) => !r.review.length).length}\t${band.filter((r) => r.later.length).length}\t${band.filter((r) => r.unknown.length).length}`);
}
// How often each word comes back in the sentences after its lesson.
const words = course.words.filter((w) => w.lesson >= from && w.lesson <= to && w.lesson < course.lessonCount);
const count = (w) => (uses.get(w.id) || []).length;
const never = words.filter((w) => count(w) === 0).length;
const once = words.filter((w) => count(w) === 1).length;
console.log(`Keyingi gaplarda: hech qaytmagan ${never}, bir marta ${once}, 2+ marta ${words.length - never - once} (jami ${words.length} so'z)`);

// --menu N: what lesson N's sentences should bring back. Counted over lessons before N only, since the
// sentences are written in order. First the words of the lesson before (every one of them should come
// back), then words met 3, 7, 14 and 30 lessons earlier that have come back fewer than twice, then any
// older word that has never come back.
const menu = Number(arg("menu", 0));
if (menu) {
  const before = new Map();
  for (const row of rows.filter((r) => r.lesson < menu)) for (const w of row.review) before.set(w.id, (before.get(w.id) || 0) + 1);
  const seen = (w) => before.get(w.id) || 0;
  const show = (ws) => ws.map((w) => `${w.ko}=${String(w.uz).split(/[;,(]/)[0].trim()}[${seen(w)}]`).join("  ");
  const at = (n) => (course.lessons[n]?.ids || []).map((id) => course.byId[id]);
  console.log(`\n== ${menu}-dars uchun takror ro'yxati ([n] — shu paytgacha necha marta qaytgan)`);
  if (menu > 1) console.log(`Kecha (${menu - 1}-dars): ${show(at(menu - 1))}`);
  for (const gap of [3, 7, 14, 30]) {
    const n = menu - gap;
    if (n >= 1) console.log(`${gap} dars oldin (${n}): ${show(at(n).filter((w) => seen(w) < 2))}`);
  }
  const old = course.words.filter((w) => w.lesson < menu - 1 && seen(w) === 0).slice(0, 40);
  if (old.length) console.log(`Hech qaytmagan eski so'zlar: ${show(old)}`);
}
