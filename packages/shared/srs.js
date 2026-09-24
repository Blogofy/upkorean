// The learning model: what a learner knows, when each word comes back, and what today asks of them.
//
// Everything here is a pure function over a plain progress object. Nothing reads a screen, a clock beyond
// the local date, or the network — which is what lets the same file drive the phone app, the tests and, if
// it is ever wanted again, a second client. The object it works on is the one the server stores and
// sync.js merges, so its top-level shape is fixed: see TOP in sync.js before adding a key.
//
// A word is named "<level>-<nid>" and a lesson "<level>-<n>" (course/levels.js), so all three levels share
// one progress object without ever colliding, and a word carries its level wherever it travels.
import { addDays, diffDays, today, weekStart, WEEK_SHORT } from "./dates.js";
import { parseWordId } from "./course/levels.js";

// The review ladder, in days between repetitions. A new word is seen again after 1, then 3, 7, 16, 35 and
// 75 days from when it was met — the intervals below are the gaps, not the totals.
export const INTERVALS = [1, 2, 4, 9, 19, 40];
// From this step on a word counts as mastered: four correct recalls at growing distances.
export const MASTER_STEP = 4;
// XP needed for each level. Past the end, every further level costs another XP_STEP, so a learner who
// finishes the course still has somewhere to go.
export const XP_LEVELS = [0, 300, 800, 1500, 2400, 3500, 4600, 5500, 6800, 8300, 10000, 12000, 14200, 16600, 19200];
export const XP_STEP = 2600;

// How many new words a day asks for: one, two or three lessons. The course is one long path with no
// calendar in it, so the pace alone decides how long a level takes. Past the goal nothing stops anyone —
// the next lesson is always one tap away — but the goal is what a learner can keep up for months.
export const PACES = {
  10: { id: 10, name: "Yengil", words: 10, minutes: 10, desc: "1 dars · ~10 daqiqa" },
  20: { id: 20, name: "Muvozanatli", words: 20, minutes: 18, desc: "2 dars · ~18 daqiqa", recommended: true },
  30: { id: 30, name: "Jadal", words: 30, minutes: 27, desc: "3 dars · ~27 daqiqa" },
};
export const PACE_IDS = [10, 20, 30];
export const DEFAULT_PACE = 20;
// How many days the words left take at a pace — what the pace pickers promise.
export const daysAtPace = (words, pace) => Math.max(1, Math.ceil(words / (PACES[pace] || PACES[DEFAULT_PACE]).words));
// A day's review target, by pace. Everything over it is spread across the coming days rather than left to
// pile up: a queue that grows every day is read as one's own failure, and is why people stop opening the app.
export const REVIEW_GOALS = { 10: 30, 20: 50, 30: 80 };
export const REVIEW_GOAL_CHOICES = [30, 50, 80];
// How far ahead the overflow may land. A word pushed further than a week is a word lost anyway.
export const PUSH_DAYS = 7;
// Minutes per question, the rate every estimate on every screen is priced at.
export const ITEM_MINUTES = 0.3;
// Words per lesson. Ten is one sitting of about seven minutes: short enough to fit a bus ride, long enough to
// leave a mark. vocab/plan.tsv is cut to the same size.
export const LESSON_SIZE = 10;
export const LESSON_MINUTES = 7;

export const EX_TYPES = ["mc", "mcr", "type", "listen", "sent", "match"];
export const TYPE_NAMES = {
  mc: "Tarjimasini tanlash",
  mcr: "Koreyschasini tanlash",
  type: "Yozish",
  listen: "Eshitib topish",
  sent: "Gap ichida",
  match: "Juftlash",
};

export const GOALS = {
  topik: { id: "topik", name: "TOPIK imtihoni", desc: "imtihon darajasiga mos lug'at" },
  work: { id: "work", name: "Koreyada ish", desc: "ish joyi va kundalik muloqot" },
  study: { id: "study", name: "Universitet", desc: "akademik matn va ma'ruza" },
  self: { id: "self", name: "O'zim uchun", desc: "drama, musiqa, sayohat" },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function freshState(profile = {}) {
  return {
    v: 2,
    profile: {
      name: "", email: "", joined: today(), level: "b", pace: DEFAULT_PACE, goal: "topik",
      reviewGoal: REVIEW_GOALS[DEFAULT_PACE], onboarded: false,
      reminders: { on: true, at: "20:00" },
      ...profile,
    },
    settings: { theme: "system", roman: true, autoAudio: true, speechRate: 1 },
    words: {}, lessons: {}, act: {}, notes: {}, log: [], xp: 0, bestStreak: 0,
    typeStats: Object.fromEntries(EX_TYPES.map((t) => [t, { ok: 0, bad: 0 }])),
    firstTry: { ok: 0, total: 0 },
    quizResults: [], reviewSessions: 0,
    achievements: {}, challengeDone: {}, dueStart: null,
  };
}

// Fills in whatever an older or partial state is missing, in place. Every read below may then assume the
// shape is whole, which keeps the selectors free of defensive checks.
export function normalize(state) {
  const fresh = freshState({});
  for (const key of Object.keys(fresh)) if (state[key] === undefined) state[key] = fresh[key];
  state.settings = { ...fresh.settings, ...state.settings };
  state.profile = { ...fresh.profile, ...state.profile };
  state.profile.reminders = { ...fresh.profile.reminders, ...state.profile.reminders };
  if (!PACES[state.profile.pace]) state.profile.pace = DEFAULT_PACE;
  if (!Number.isFinite(state.profile.reviewGoal)) state.profile.reviewGoal = REVIEW_GOALS[state.profile.pace];
  for (const type of EX_TYPES) if (!state.typeStats[type]) state.typeStats[type] = { ok: 0, bad: 0 };
  // The course was rebuilt from nothing (NIKL lessons in place of the book's 50 days of "<level>-<day>-<i>"
  // words): progress on words and days that no longer exist only weighs the object down.
  delete state.days;
  for (const map of [state.words, state.notes]) for (const id of Object.keys(map)) if (!parseWordId(id)) delete map[id];
  return state;
}

// ---------- One word's memory ----------
const blank = () => ({ s: 0, due: null, learned: null, seen: 0, ok: 0, bad: 0, lapses: 0, flag: false, forgot: false, last: null });
export const wordState = (state, id) => state.words[id] || null;
const touch = (state, id) => (state.words[id] = state.words[id] || blank());

export const isLearned = (state, id) => !!(state.words[id] && state.words[id].learned);
export const isMastered = (state, id) => {
  const w = state.words[id];
  return !!(w && w.learned && w.s >= MASTER_STEP);
};
export const isWeak = (state, id) => {
  const w = state.words[id];
  return !!(w && w.learned && w.bad >= 2 && w.s < 3);
};
export const mastery = (state, id) => {
  const w = state.words[id];
  return w && w.learned ? Math.min(5, w.s) : 0;
};

// ±15% on every interval, so the words met on one day stop coming back as one wave on exactly the same
// later days. Never sooner than tomorrow.
const fuzz = (days) => Math.max(1, Math.round(days * (0.85 + Math.random() * 0.3)));

function setStep(word, step, now) {
  const before = word.s;
  word.s = clamp(step, 0, INTERVALS.length - 1);
  if (before >= 3 && word.s <= 1 && word.learned) { word.forgot = true; word.lapses++; }
  if (word.s >= 3) word.forgot = false;
  word.due = addDays(now, fuzz(INTERVALS[word.s]));
}

// Flash-card self assessment: 1 Bilmadim · 2 Qiyin · 3 Bildim.
const gradeStep = (word, grade) => {
  const first = !word || !word.learned;
  const step = word ? word.s : 0;
  if (grade === 1) return 0;
  if (grade === 2) return first ? 0 : Math.max(0, step);
  return first ? 2 : step + 1;
};
// What the three buttons promise, in days — computed, so the labels can never drift from the schedule.
export const previewInterval = (state, id, grade) => INTERVALS[clamp(gradeStep(wordState(state, id), grade), 0, INTERVALS.length - 1)];

export function grade(state, id, g, now = today()) {
  const word = touch(state, id);
  const first = !word.learned;
  const step = gradeStep(word, g);
  if (first) { word.learned = now; activity(state, now).learned++; }
  word.seen++;
  word.last = now;
  if (g === 1) word.bad++; else word.ok++;
  setStep(word, step, now);
  addXP(state, first ? 4 : 2, now);
  return INTERVALS[word.s];
}

// First meeting on the guided flow. The word counts as learned and comes back tomorrow unless the practice
// straight after goes without a mistake, which settleIntroduced decides once the block is over.
export function introduce(state, id, now = today()) {
  const word = touch(state, id);
  if (!word.learned) {
    word.learned = now;
    activity(state, now).learned++;
    setStep(word, 0, now);
    addXP(state, 4, now);
  }
  word.seen++;
  word.last = now;
}

export function settleIntroduced(state, ids, mistakes, now = today()) {
  for (const id of ids) {
    const word = state.words[id];
    if (word && word.learned === now && word.s === 0 && !mistakes[id]) setStep(word, 1, now);
  }
}

// An exercise answer. mode: "learn" (a lesson), "review" (the schedule), "quiz" (free practice).
export function answer(state, id, correct, type, mode, now = today()) {
  const word = touch(state, id);
  // Is this the word's scheduled moment? Read first: it is what stops a word answered several times inside
  // one session from walking up the ladder once per question.
  const scheduled = !word.due || word.due <= now;
  const fresh = !word.learned || word.learned === now;
  if (!word.learned) { word.learned = now; activity(state, now).learned++; }
  word.seen++;
  word.last = now;
  if (state.typeStats[type]) state.typeStats[type][correct ? "ok" : "bad"]++;
  if (correct) {
    word.ok++;
    if (mode !== "quiz" && scheduled) setStep(word, word.s + 1, now);
    addXP(state, 3, now);
  } else {
    word.bad++;
    // Free practice records the miss but leaves the ladder alone: drilling hard words late at night must not
    // cost a month of consolidation. lapses and forgot stay untouched for the same reason — both mean
    // "recall failed at the moment the schedule chose", and this is no such moment.
    if (mode !== "quiz") { setStep(word, 0, now); word.due = addDays(now, 1); }
  }
  // A due word cleared inside a lesson is a review; without this the day's review target is unreachable.
  if (mode === "review" || (mode === "learn" && scheduled && !fresh)) activity(state, now).reviewed++;
}

export function flag(state, id, on) {
  const word = touch(state, id);
  word.flag = on === undefined ? !word.flag : !!on;
  return word.flag;
}

export const note = (state, id) => (state.notes && state.notes[id]) || "";
export function setNote(state, id, text) {
  const trimmed = String(text || "").slice(0, 140);
  if (trimmed.trim()) state.notes[id] = trimmed; else delete state.notes[id];
}

// ---------- Activity, XP, log ----------
export function activity(state, date = today()) {
  const key = date;
  return (state.act[key] = state.act[key] || { learned: 0, reviewed: 0, xp: 0, min: { learn: 0, review: 0, quiz: 0 } });
}
export function addXP(state, n, now = today()) {
  state.xp += n;
  activity(state, now).xp += n;
}
export function addMinutes(state, category, minutes, now = today()) {
  if (minutes > 0) {
    const act = activity(state, now);
    act.min[category] = (act.min[category] || 0) + minutes;
  }
}
export function log(state, text, kind = "p") {
  state.log.unshift({ t: Date.now(), text, kind });
  state.log = state.log.slice(0, 30);
}

const actMinutes = (act) => (act ? Object.values(act.min || {}).reduce((sum, v) => sum + v, 0) : 0);
const isActive = (act) => !!act && (act.learned > 0 || act.reviewed > 0 || actMinutes(act) >= 1);

export function streak(state, now = today()) {
  let day = now;
  if (!isActive(state.act[day])) day = addDays(day, -1);
  let n = 0;
  while (isActive(state.act[day])) { n++; day = addDays(day, -1); }
  if (n > (state.bestStreak || 0)) state.bestStreak = n;
  return n;
}

export function levelInfo(state) {
  const xp = Math.max(0, state.xp || 0);
  const last = XP_LEVELS[XP_LEVELS.length - 1];
  let level, next;
  if (xp < last) {
    level = 1;
    while (XP_LEVELS[level] <= xp) level++;
    next = XP_LEVELS[level];
  } else {
    // Past the written table every further level costs the same again, so the top of the ladder is a step
    // and not a wall: someone who finishes all three levels still has a number that moves.
    const beyond = Math.floor((xp - last) / XP_STEP);
    level = XP_LEVELS.length + beyond;
    next = last + XP_STEP * (beyond + 1);
  }
  return { level, xp, next, toNext: Math.max(0, next - xp), pct: clamp(pct(xp, next), 0, 100) };
}

export const dayMinutes = (state, key) => actMinutes(state.act[key]);
export const totalMinutes = (state, from) => Object.entries(state.act)
  .filter(([key]) => !from || key >= from)
  .reduce((sum, [, act]) => sum + actMinutes(act), 0);
export const minutesBy = (state, category) => Object.values(state.act).reduce((sum, act) => sum + ((act.min || {})[category] || 0), 0);
export const activeDays = (state) => Object.keys(state.act).filter((key) => isActive(state.act[key])).length;

export function weekRhythm(state, now = today()) {
  const start = weekStart(now);
  return WEEK_SHORT.map((label, i) => {
    const key = addDays(start, i);
    return {
      label, key,
      minutes: dayMinutes(state, key),
      words: (state.act[key] || {}).learned || 0,
      active: isActive(state.act[key]),
      today: key === now,
      future: key > now,
    };
  });
}

// ---------- Course structure ----------
// `course` is a loaded level: { lessons, lessonCount, byId, words, … } — the shape content.js assembles.
// There are no days in it: the lessons are one path, taken at whatever pace the learner keeps.

export const lessonAt = (course, n) => course.lessons[n] || null;
export const lessonState = (state, id) => state.lessons[id] || { done: false };
export const lessonDone = (state, course, n) => !!(lessonAt(course, n) && lessonState(state, lessonAt(course, n).id).done);

// The first lesson not done yet — the one the home screen offers. Past the end, the last one.
export function currentLesson(state, course) {
  for (let n = 1; n <= course.lessonCount; n++) if (!lessonDone(state, course, n)) return n;
  return course.lessonCount;
}
export const lessonsDone = (state, course) => {
  let n = 0;
  for (let i = 1; i <= course.lessonCount; i++) if (lessonDone(state, course, i)) n++;
  return n;
};
export const courseDone = (state, course) => course.lessonCount > 0 && lessonsDone(state, course) === course.lessonCount;
export const lessonLearned = (state, course, n) => (lessonAt(course, n)?.ids || []).filter((id) => isLearned(state, id)).length;

// "done" · "mastered" · "current" · "open". Nothing is locked: someone who already knows lesson 12 may
// take lesson 13, and the order is advice, not a gate.
export function lessonStatus(state, course, n) {
  const lesson = lessonAt(course, n);
  if (!lesson) return "open";
  if (lessonState(state, lesson.id).done) return lesson.ids.every((id) => isMastered(state, id)) ? "mastered" : "done";
  return n === currentLesson(state, course) ? "current" : "open";
}

// Lessons finished today, for the home screen: the daily goal is counted in words, and a lesson is ten.
export const lessonsToday = (state, now = today()) => Object.values(state.lessons).filter((record) => record.doneAt === now).length;

// ---------- Selectors over what has been learned ----------
export const learnedIds = (state, course) => Object.keys(state.words).filter((id) => isLearned(state, id) && course.byId[id]);
// Most overdue first, and inside one due date the least consolidated first. newDay and reviewQueue cut this
// one order from opposite ends: the overflow comes off the front, today's queue off the back.
export const dueIds = (state, course, now = today()) => learnedIds(state, course)
  .filter((id) => state.words[id].due && state.words[id].due <= now)
  .sort((a, b) => String(state.words[a].due).localeCompare(String(state.words[b].due)) || state.words[a].s - state.words[b].s);
export const weakIds = (state, course) => learnedIds(state, course).filter((id) => isWeak(state, id)).sort((a, b) => state.words[b].bad - state.words[a].bad);
export const flaggedIds = (state, course) => learnedIds(state, course).filter((id) => state.words[id].flag);
export const forgottenIds = (state, course) => learnedIds(state, course).filter((id) => state.words[id].forgot);
export const masteredIds = (state, course) => learnedIds(state, course).filter((id) => isMastered(state, id));

export function accuracy(state) {
  let ok = 0, all = 0;
  for (const type of EX_TYPES) {
    ok += state.typeStats[type].ok;
    all += state.typeStats[type].ok + state.typeStats[type].bad;
  }
  return all ? pct(ok, all) : null;
}
export function typeAccuracy(state, type) {
  const stats = state.typeStats[type];
  const all = stats.ok + stats.bad;
  return all ? pct(stats.ok, all) : null;
}

// How the whole learned vocabulary sits on the ladder, for the results screen.
export function masteryBreakdown(state, course) {
  const learned = learnedIds(state, course);
  const out = { mastered: 0, solid: 0, fresh: 0, weak: 0, total: learned.length };
  for (const id of learned) {
    if (isWeak(state, id)) out.weak++;
    else if (state.words[id].s >= MASTER_STEP) out.mastered++;
    else if (state.words[id].s >= 2) out.solid++;
    else out.fresh++;
  }
  return out;
}

// ---------- The daily review goal ----------
const paceGoal = (state) => state.profile.reviewGoal || REVIEW_GOALS[state.profile.pace] || REVIEW_GOALS[DEFAULT_PACE];

// Today's target: goal — what this learner asked for, due — what is really due, done — what today already
// cleared, left — what remains, minutes — a rough price. A pure read: it is called from render paths and
// must not write state or hand out XP.
export function reviewGoal(state, course, now = today()) {
  const goal = paceGoal(state);
  const all = dueIds(state, course, now);
  const late = all.filter((id) => state.words[id].due < now).length;
  const done = (state.act[now] || {}).reviewed || 0;
  const left = Math.min(all.length, Math.max(0, goal - done));
  return { goal, due: all.length, late, done, left, minutes: left ? Math.max(1, Math.round(left * ITEM_MINUTES)) : 0 };
}

// The ids a review session should run. "due" is today's queue already cut to the goal; the hand-picked
// lists are whatever the learner marked, so they keep a cap of their own.
export const PICKED_CAP = 40;
export const EXTRA_ROUND = 20;
export function reviewQueue(state, course, mode = "due", n, now = today()) {
  if (mode === "due") return dueIds(state, course, now).slice(0, n === undefined ? reviewGoal(state, course, now).left : n);
  const pick = { weak: weakIds, flag: flaggedIds, forgot: forgottenIds }[mode];
  if (!pick) return [];
  const ids = pick(state, course);
  return n === undefined ? ids : ids.slice(0, n);
}

// The day transition. Runs once per local day and never from a render. Today's queue is cut to the goal and
// the overflow moved into the coming days, so a learner doing their part meets a number they can finish.
// Returns true when it really rolled the day over.
export function newDay(state, course, now = today()) {
  if (!state) return false;
  if (state.dueStart && state.dueStart.date === now) return false;
  const goal = paceGoal(state);
  const ids = dueIds(state, course, now); // most overdue first
  if (ids.length > goal) pushForward(state, course, ids.slice(0, ids.length - goal), now);
  state.dueStart = { date: now, n: Math.min(goal, ids.length) };
  return true;
}

// What did not fit today goes to the emptiest of the coming days, so each of those also lands near the goal
// instead of inheriting the whole pile.
//
// What moves is the *most* overdue, which was measured rather than assumed. Keeping the oldest and pushing
// the freshly due ones looks kinder, but a pushed word gets a later due date, which puts it behind the
// backlog the next day and then for ever. It also reads the forgetting curve honestly: a repetition buys
// most at the word's scheduled moment, and a word already ten days late has decayed anyway.
function pushForward(state, course, ids, now) {
  const days = Array.from({ length: PUSH_DAYS }, (_, i) => addDays(now, i + 1));
  const load = Object.fromEntries(days.map((day) => [day, 0]));
  for (const id of learnedIds(state, course)) {
    const due = state.words[id].due;
    if (due && due in load) load[due]++;
  }
  for (const id of ids) {
    const to = days.reduce((a, b) => (load[b] < load[a] ? b : a)); // emptiest, earliest on a tie
    load[to]++;
    state.words[id].due = to;
  }
}

// Was yesterday missed? The skipped-day screen asks, and the streak card needs the same answer.
export function missedYesterday(state, course, now = today()) {
  const yesterday = addDays(now, -1);
  if (!state.act[yesterday] && !isActive(state.act[yesterday])) {
    const started = Object.keys(state.act).some((key) => key < yesterday && isActive(state.act[key]));
    if (started) return { date: yesterday, lesson: currentLesson(state, course) };
  }
  return null;
}

// ---------- Today's two targets ----------
// Reads only; the caller banks the reward when `done` first turns true, so a render cannot hand out XP.
export function challenge(state, course, now = today()) {
  const { goal, due } = reviewGoal(state, course, now);
  const act = state.act[now] || { learned: 0, reviewed: 0 };
  const target = state.dueStart && state.dueStart.date === now ? Math.min(state.dueStart.n, goal) : Math.min(goal, due);
  const newWords = PACES[state.profile.pace].words;
  const items = [
    { label: `${newWords} so'z o'rganish`, cur: Math.min(act.learned, newWords), goal: newWords },
    target > 0
      ? { label: `${target} so'zni takrorlash`, cur: Math.min(act.reviewed, target), goal: target }
      : { label: "Bugun takrorlash yo'q", cur: 1, goal: 1 },
  ];
  return { items, done: items.every((item) => item.cur >= item.goal), reward: 120, claimed: !!state.challengeDone[now] };
}
export function claimChallenge(state, now = today()) {
  if (state.challengeDone[now]) return false;
  state.challengeDone[now] = true;
  addXP(state, 120, now);
  log(state, "Kunlik vazifa bajarildi — +120 XP", "ok");
  return true;
}

// ---------- Achievements ----------
// Built against a loaded level, because two of the titles spell out the course size.
export function achievementList(state, course) {
  const learned = learnedIds(state, course).length;
  const total = course.words.length;
  const done = lessonsDone(state, course);
  const all = course.lessonCount;
  const half = Math.max(1, Math.ceil(all / 2));
  const first = lessonAt(course, 1);
  return [
    { id: "first", ko: "첫", title: "Birinchi qadam", desc: "Birinchi dars tugatildi", ok: () => lessonDone(state, course, 1), progress: () => `${lessonLearned(state, course, 1)} / ${first ? first.ids.length : 0}` },
    { id: "s3", ko: "삼", title: "3 kunlik seriya", desc: "3 kun ketma-ket", ok: () => state.bestStreak >= 3, progress: () => `${state.bestStreak || 0} / 3` },
    { id: "s10", ko: "십", title: "10 kunlik seriya", desc: "10 kun ketma-ket", ok: () => state.bestStreak >= 10, progress: () => `${state.bestStreak || 0} / 10` },
    { id: "s30", ko: "삼십", title: "30 kunlik seriya", desc: "30 kun ketma-ket", ok: () => state.bestStreak >= 30, progress: () => `${state.bestStreak || 0} / 30` },
    { id: "w100", ko: "백", title: "100 so'z", desc: "100 ta so'z o'rganildi", ok: () => learned >= 100, progress: () => `${learned} / 100` },
    { id: "w300", ko: "삼백", title: "300 so'z", desc: "300 ta so'z o'rganildi", ok: () => learned >= 300, progress: () => `${learned} / 300` },
    { id: "w500", ko: "오백", title: "500 so'z", desc: "500 ta so'z o'rganildi", ok: () => learned >= 500, progress: () => `${learned} / 500` },
    { id: "wall", ko: "천", title: `${total} so'z`, desc: "Darajaning barcha so'zlari", ok: () => total > 0 && learned >= total, progress: () => `${learned} / ${total}` },
    { id: "m50", ko: "숙달", title: "50 ta o'zlashtirilgan", desc: "50 so'z to'liq o'zlashtirildi", ok: () => masteredIds(state, course).length >= 50, progress: () => `${masteredIds(state, course).length} / 50` },
    { id: "m200", ko: "정복", title: "200 ta o'zlashtirilgan", desc: "200 so'z to'liq o'zlashtirildi", ok: () => masteredIds(state, course).length >= 200, progress: () => `${masteredIds(state, course).length} / 200` },
    { id: "perfect", ko: "완벽", title: "Mukammal mashq", desc: "10+ savolda 100%", ok: () => state.quizResults.some((r) => r.total >= 10 && r.ok === r.total), progress: () => "0 / 1" },
    { id: "rev10", ko: "복습", title: "Takrorlash ustasi", desc: "10 ta takrorlash sessiyasi", ok: () => state.reviewSessions >= 10, progress: () => `${state.reviewSessions} / 10` },
    { id: "l10", ko: "열", title: "10 dars", desc: "10 ta dars tugatildi", ok: () => done >= 10, progress: () => `${done} / 10 dars` },
    { id: "l50", ko: "오십", title: "50 dars", desc: "50 ta dars tugatildi", ok: () => done >= 50, progress: () => `${done} / 50 dars` },
    { id: "half", ko: "반", title: "Yarim yo'l", desc: `${half} ta dars tugatildi`, ok: () => all > 0 && done >= half, progress: () => `${done} / ${half} dars` },
    { id: "ear", ko: "귀", title: "Yaxshi quloq", desc: "Eshitib topish 90%+ (20+ javob)", ok: () => { const s = state.typeStats.listen; return s.ok + s.bad >= 20 && typeAccuracy(state, "listen") >= 90; }, progress: () => `${typeAccuracy(state, "listen") ?? 0}%` },
    { id: "hand", ko: "손", title: "Hangul yozuvchi", desc: "Yozishda 50 to'g'ri", ok: () => state.typeStats.type.ok >= 50, progress: () => `${state.typeStats.type.ok} / 50` },
    { id: "perfectLesson", ko: "百", title: "Xatosiz dars", desc: "Bir darsni xatosiz tugatish", ok: () => Object.values(state.lessons).some((d) => d.done && d.ok > 0 && !d.bad), progress: () => "0 / 1" },
    { id: "grad", ko: "졸업", title: "Daraja tamom", desc: `${all} ta dars tugatildi`, ok: () => all > 0 && done >= all, progress: () => `${done} / ${all} dars` },
  ];
}

// Marks anything newly earned, in place, and returns the list ready to render. The caller saves when
// `earned` comes back non-empty.
export function achievements(state, course, now = today()) {
  const earned = [];
  const list = achievementList(state, course).map((item) => {
    const done = !!state.achievements[item.id] || item.ok();
    if (done && !state.achievements[item.id]) {
      state.achievements[item.id] = now;
      earned.push(item);
      log(state, `Yutuq ochildi — ${item.title}`, "pd");
    }
    return { ...item, done, when: state.achievements[item.id], progress: done ? null : item.progress() };
  });
  return { list, earned, unlocked: list.filter((item) => item.done).length, total: list.length };
}
