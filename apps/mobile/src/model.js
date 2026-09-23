// What the screens say about the course, worked out once.
//
// srs.js knows the schedule and exercise.js the questions; this is the thin layer between them and the
// screens — a level's name and size, a day's current stage, an example sentence split for highlighting —
// so that the home screen and the course screen can never describe the same day in two different ways.
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
export function levelInfo(levels, id) {
  const meta = levelMeta(id) || LEVELS[0];
  const live = (levels || []).find((level) => level.id === meta.id) || {};
  const plannedWords = meta.target.days * meta.target.perDay;
  return {
    ...meta,
    locked: live.locked ?? meta.id !== "b",
    // A level still being written reports what it has; the plan is what the learner is promised.
    words: live.words || plannedWords,
    days: live.days || meta.target.days,
    plannedWords,
    plannedDays: meta.target.days,
  };
}

export const allLevels = (levels) => LEVELS.map((level) => levelInfo(levels, level.id));

export function nextLevel(levels, id) {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index >= 0 && index < LEVELS.length - 1 ? levelInfo(levels, LEVELS[index + 1].id) : null;
}

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "do'stim";
export const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();

// The three phases a day is made of, as the course card names them.
export const PHASE_OF = { learn: "tanishish", recall: "faol eslash", mixed: "kun testi" };

// Where a day stands: its plan, how many stages are behind it, and the one to do next.
export function dayProgress(state, course, day) {
  const plan = srs.dayPlan(course, day);
  const ds = srs.dayState(state, day);
  const stageIdx = Math.min(ds.stage || 0, Math.max(0, plan.stages.length - 1));
  return {
    plan,
    done: !!ds.done,
    stageIdx: ds.done ? plan.stages.length : stageIdx,
    stage: ds.done ? null : plan.stages[stageIdx],
    title: srs.dayTitle(course, day),
    words: plan.words.length,
    blocks: plan.blocks.length,
  };
}

export const dayLine = (progress) => `${progress.words} so'z · ${progress.blocks} blok · ~${progress.plan.minutes} daqiqa`;

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

// "必 (albatta) + 要 (talab) — 필수, 중요하다 so'zlarida ham uchraydi."
export function rootLine(root) {
  if (!root) return "";
  const parts = (root.parts || []).filter((part) => part.h).map((part) => `${part.h} (${part.uz})`);
  const family = (root.family || []).map(([ko]) => ko);
  if (!parts.length) return root.idea ? `${root.idea}.` : "";
  return `${parts.join(" + ")}${family.length ? ` — ${family.join(", ")} so'zlarida ham uchraydi.` : "."}`;
}

// When a word comes back, as the word card says it.
export function nextReviewText(word, now = today()) {
  if (!word || !word.learned) return "Hali o'rganilmagan";
  if (!word.due) return "Rejalashtirilmagan";
  const n = diffDays(now, word.due);
  if (n <= 0) return "Keyingi takrorlash: bugun";
  if (n === 1) return "Keyingi takrorlash: ertaga";
  return `Keyingi takrorlash: ${n} kundan keyin`;
}

// How a day's words are spread over the coming reviews, for the "day finished" screen.
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

// Every screen that starts a sitting goes through here, so a stage is always opened the same way.
export function openStage(navigation, state, course, day) {
  const progress = dayProgress(state, course, day);
  if (progress.done) {
    navigation.navigate("Session", {
      kind: "quiz", quizType: "mixed", title: `${day}-kun mashqi`,
      ids: progress.plan.words.filter((id) => srs.isLearned(state, id)), count: 20,
    });
    return;
  }
  navigation.navigate("Session", { kind: "learn", day, stageIdx: progress.stageIdx });
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
