// What the screens say about the course, worked out once.
//
// srs.js knows the schedule and exercise.js the questions; this is the thin layer between them and the
// screens — a level's name and size, where today's lesson and each part stand, an example sentence split for
// highlighting — so that the home screen and the course screen can never describe the same thing two ways.
import * as srs from "@upkorean/shared/srs.js";
import { LEVELS, levelMeta } from "@upkorean/shared/course/levels.js";
import { syllableReading } from "@upkorean/shared/hangul.js";
import { today, diffDays, addDays } from "@upkorean/shared/dates.js";

// How the design describes each level on the onboarding screen and in the level switcher.
export const LEVEL_BLURB = {
  b: { desc: "Hangulni o'qiy olaman, so'z boyligim kam. Kundalik muloqot so'zlari.", topic: "kundalik muloqot lug'ati" },
  m: { desc: "Oddiy suhbatni tushunaman. Ish va o'qish lug'ati.", topic: "ish va o'qish lug'ati" },
  a: { desc: "Yangilik va maqola o'qiyman. Akademik va rasmiy lug'at.", topic: "akademik va rasmiy lug'at" },
};

// A level as the screens need it: its names from the course, its size and lock from the server's manifest.
// `words` and `parts` are what is published; `planned` is every word the level will hold, and `ready` says
// whether the two are the same yet.
export function levelInfo(levels, id) {
  const meta = levelMeta(id) || LEVELS[0];
  const live = (levels || []).find((level) => level.id === meta.id) || {};
  const words = live.words || 0;
  return {
    ...meta,
    locked: live.locked ?? meta.id !== "b",
    words,
    parts: live.parts || 0,
    planned: live.planned || meta.planned,
    ready: words >= (live.planned || meta.planned),
  };
}

export const allLevels = (levels) => LEVELS.map((level) => levelInfo(levels, level.id));

export function nextLevel(levels, id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index >= 0 && index < LEVELS.length - 1 ? levelInfo(levels, LEVELS[index + 1].id) : null;
}

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "do'stim";
export const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

// Today's lesson as the screens show it: srs.todayLesson, plus the words of the sitting to do now (or of the
// ten on top once it is done) and the lines the cards print.
export function todayProgress(state, course, now = today()) {
  const lesson = srs.todayLesson(state, course, now);
  const nextIds = lesson.done ? lesson.extra : lesson.sittings[lesson.next] || [];
  return {
    ...lesson,
    nextIds,
    words: lesson.ids.length,
    minutes: Math.max(1, lesson.sittings.length - lesson.sittingsDone) * srs.PART_MINUTES,
  };
}

export const todayLine = (progress) => (progress.sittings.length > 1
  ? `${progress.words} so'z · ${progress.sittings.length} qism · ~${progress.sittings.length * srs.PART_MINUTES} daqiqa`
  : `${progress.words} so'z · ~${srs.PART_MINUTES} daqiqa`);
// What the button that opens today's lesson says: where it starts, not just that it starts.
export const todayAction = (progress) => (progress.done ? (progress.extra.length ? "Yana 10 so'z" : "Yangi so'z qolmadi")
  : progress.sittingsDone ? `${progress.sittingsDone + 1}-qismni boshlash` : "Boshlash");

// One part of the path as the course list and the part screen show it.
export function partProgress(state, course, n) {
  const part = srs.partAt(course, n);
  const ids = part ? part.ids : [];
  return {
    n,
    part,
    title: part ? part.title : `${n}-qism`,
    ids,
    words: ids.length,
    status: srs.partStatus(state, course, n),
    learned: ids.filter((id) => srs.isLearned(state, id)).length,
    mastered: ids.filter((id) => srs.isMastered(state, id)).length,
  };
}

// The level's NIKL grade a part belongs to, as the course list heads its sections: "1급".
export const gradeName = (grade) => `${grade}급`;

// Today's plan in words — what was learned today against the level's standard — for the home screen's ring.
// `goal` is 0 once the level has no new words left, and then the day is kept by any study at all.
export function todayGoal(state, now = today()) {
  const goal = srs.dayGoal(state, now);
  const learned = (state.act[now] || {}).learned || 0;
  return { goal, learned, left: Math.max(0, goal - learned), done: srs.planMet(state, now) || (goal > 0 && learned >= goal) };
}

// "kuniga 20 so'z" — a daily standard as the plan screens say it; with a range, where it can grow to.
export const standardLine = (words) => `kuniga ${words} so'z`;
export const rangeLine = (range) => (range.from === range.to ? `kuniga ${range.from} so'z` : `kuniga ${range.from} → ${range.to} so'z`);
// A rough price for a day at that standard: its parts, and about ten minutes of review on top.
export const dailyMinutes = (words) => Math.round(words / srs.PART_SIZE) * srs.PART_MINUTES + 10;

// Whether a word's recording exists yet. The narrator reads the course as it grows, and a play button that
// makes no sound reads as a broken app, so a word without one simply has no button.
export const hasClip = (store, kind, id) => !!store.audio && !!store.course?.byId[id]?.[kind === "sentences" ? "as" : "aw"];
export const anyClips = (store) => !!store.audio && !!store.course?.words.some((word) => word.aw);

// "hak-gyo" under a word. Only the first form of a word written with alternatives is read out.
export const reading = (ko) => {
  const first = String(ko).split("/")[0].replace(/\(.*?\)/g, "").trim();
  const out = syllableReading(first);
  return out ? `[${out}]` : "";
};

// An example sentence cut around the word it teaches, so the word can be set in green.
export function highlight(text, part) {
  const source = String(text || "");
  const at = part ? source.indexOf(part) : -1;
  if (at < 0) return [{ text: source, hl: false }];
  return [
    { text: source.slice(0, at), hl: false },
    { text: part, hl: true },
    { text: source.slice(at + part.length), hl: false },
  ].filter((piece) => piece.text);
}

// The Uzbek translation marks its own highlight with braces: "… biror narsa {kerak} bo'lsa …".
export function uzPieces(text) {
  return String(text || "").split(/(\{[^}]*\})/).filter(Boolean).map((piece) => (
    piece.startsWith("{") ? { text: piece.slice(1, -1), hl: true } : { text: piece, hl: false }
  ));
}
export const plainUz = (text) => String(text || "").replace(/[{}]/g, "");

// The sentence with the cloze answer replaced by a blank.
export function clozePieces(example) {
  const ko = String(example?.ko || "");
  const cloze = example?.cloze || "";
  const at = cloze ? ko.indexOf(cloze) : -1;
  if (at < 0) return { before: ko, after: "" };
  return { before: ko.slice(0, at), after: ko.slice(at + cloze.length) };
}

// When a word comes back, as the word card says it.
export function nextReviewText(word, now = today()) {
  if (!word || !word.learned) return "Hali o'rganilmagan";
  if (!word.due) return "O'zlashtirildi — takrorlash tugagan";
  const n = diffDays(now, word.due);
  if (n <= 0) return "Keyingi takrorlash: bugun";
  if (n === 1) return "Keyingi takrorlash: ertaga";
  return `Keyingi takrorlash: ${n} kundan keyin`;
}

// How a lesson's words are spread over the coming reviews, for the "lesson finished" screen.
export function reviewBuckets(state, ids, now = today()) {
  const buckets = [
    { label: "ertaga", n: 0 },
    { label: "3 kun", n: 0 },
    { label: "7 kun", n: 0 },
  ];
  for (const id of ids) {
    const due = state.words[id]?.due;
    if (!due) continue;
    const d = diffDays(now, due);
    if (d <= 1) buckets[0].n++;
    else if (d <= 4) buckets[1].n++;
    else buckets[2].n++;
  }
  return buckets;
}

// Minutes studied on each of the last `days` days, oldest first.
export function lastDays(state, days = 14, now = today()) {
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(now, i - days + 1);
    return { key, minutes: srs.dayMinutes(state, key), today: key === now };
  });
}

// Every screen that starts today's lesson goes through here: the sitting it carries on from, or ten words on
// top once it is done.
export function openToday(navigation, state, course) {
  const lesson = srs.todayLesson(state, course);
  if (!lesson.done) navigation.navigate("Session", { kind: "learn" });
  else if (lesson.extra.length) navigation.navigate("Session", { kind: "learn", extra: true });
}

// A part opened from the course list: its words not met yet as a sitting, or practice once all are met.
export function openPart(navigation, state, course, n) {
  const progress = partProgress(state, course, n);
  if (!progress.part) return;
  const fresh = progress.ids.filter((id) => !srs.isLearned(state, id));
  if (fresh.length) navigation.navigate("Session", { kind: "learn", ids: fresh });
  else navigation.navigate("Session", { kind: "quiz", quizType: "mixed", title: `${n}-qism mashqi`, ids: progress.ids, count: 15 });
}

export function openReview(navigation, mode = "due", extra = {}) {
  navigation.navigate("Session", { kind: "review", mode, ...extra });
}

// The badges as they stand, without marking anything earned: safe to call while drawing. Marking (and the
// log line that goes with it) is srs.achievements(), which only runs after a sitting or from an effect.
export function badgeView(state, course) {
  const list = srs.achievementList(state, course).map((item) => {
    const done = !!state.achievements[item.id] || item.ok();
    return { ...item, done, progress: done ? null : item.progress() };
  });
  return { list, unlocked: list.filter((item) => item.done).length, total: list.length };
}
