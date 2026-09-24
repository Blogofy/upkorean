// The learning model: what a learner knows, when each word comes back, and what today asks of them.
//
// Everything here is a pure function over a plain progress object. Nothing reads a screen, a clock beyond
// the local date, or the network — which is what lets the same file drive the phone app, the tests and, if
// it is ever wanted again, a second client. The object it works on is the one the server stores and
// sync.js merges, so its top-level shape is fixed: see TOP in sync.js before adding a key.
//
// A word is named "<level>-<nid>" (course/levels.js), so all three levels share one progress object without
// ever colliding, and a word carries its level wherever it travels.
import { addDays, diffDays, today, weekStart, WEEK_SHORT } from "./dates.js";
import { DAILY_STEP, LEVELS, PART_SIZE, levelMeta, parseWordId } from "./course/levels.js";

// The review ladder, in days between repetitions: a new word comes back 1, 3, 7, 14 and 30 days after it was
// met — the intervals below are the gaps, not the totals. A miss anywhere sends it back to the start.
//
// After the thirtieth-day review the word is learnt and leaves the schedule. The ladder stops there on
// purpose: a learner meets the words again in grammar, reading and tests outside the app, which the app
// cannot see, and reviews running on for months would bury the day. The one exception is a word that has
// already gone wrong in a review: it gets a single further check two months later (SAFETY_GAP).
export const INTERVALS = [1, 2, 4, 7, 16];
export const SAFETY_GAP = 60;
// The step a word reaches when it passes the thirtieth-day review: learnt, and counted as mastered.
export const LEARNT = INTERVALS.length;
export const MASTER_STEP = LEARNT;
// XP needed for each level. Past the end, every further level costs another XP_STEP, so a learner who
// finishes the course still has somewhere to go.
export const XP_LEVELS = [0, 300, 800, 1500, 2400, 3500, 4600, 5500, 6800, 8300, 10000, 12000, 14200, 16600, 19200];
export const XP_STEP = 2600;

// The daily standard: new words a day — one lesson. Not a choice: a learner offered one takes the lightest,
// and a course is only as good as the days it is actually kept. It starts at the level's `daily.from` and moves
// by DAILY_STEP with the learner's own results (adjustDaily), inside the level's range (levels.js). Past it
// nothing stops anyone: another ten words are always one tap away.
export { DAILY_STEP };
export const dailyRange = (level) => (levelMeta(level) || LEVELS[0]).daily;
export function dailyWords(state) {
  const range = dailyRange(state.profile.level);
  return clamp(Number.isFinite(state.profile.daily) ? state.profile.daily : range.from, range.from, range.to);
}
// How many days a number of words takes at so many a day — what the plan screens promise.
export const daysFor = (words, perDay) => Math.max(1, Math.ceil(words / Math.max(1, perDay)));
// How many days a whole level takes on its plan: RAISE_EVERY days at each step of its range, then the top of
// it to the end. 초급 is 65. What the plan screens promise, for a learner who keeps it; `start` prices what is
// left of a level from where the standard stands now.
export function levelDays(level, words = (levelMeta(level) || LEVELS[0]).planned, start = dailyRange(level).from) {
  const range = dailyRange(level);
  let days = 0;
  for (let perDay = start; words > 0; perDay = Math.min(range.to, perDay + DAILY_STEP)) {
    const span = perDay < range.to ? RAISE_EVERY : Infinity;
    const take = Math.min(span, Math.ceil(words / perDay));
    days += take;
    words -= take * perDay;
  }
  return days;
}
// A day's review target. Everything over it is spread across the coming days rather than left to pile up: a
// queue that grows every day is read as one's own failure, and is why people stop opening the app.
export const DEFAULT_REVIEW_GOAL = 50;
export const REVIEW_GOAL_CHOICES = [30, 50, 80];
// How far ahead the overflow may land. A word pushed further than a week is a word lost anyway.
export const PUSH_DAYS = 7;
// Minutes per question, the rate every estimate on every screen is priced at.
export const ITEM_MINUTES = 0.3;
// Words per sitting. Ten is about seven minutes: short enough to fit a bus ride, long enough to leave a mark,
// and a day's lesson may be left for a break between two sittings.
export { PART_SIZE };
export const PART_MINUTES = 7;

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
      name: "", email: "", joined: today(), level: "b", goal: "topik",
      reviewGoal: DEFAULT_REVIEW_GOAL, onboarded: false,
      reminders: { on: true, at: "20:00" },
      ...profile,
    },
    settings: { theme: "system", roman: true, autoAudio: true, speechRate: 1 },
    words: {}, act: {}, notes: {}, log: [], xp: 0, bestStreak: 0,
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
  // The pace the learner used to pick; the standard now comes with the level.
  delete state.profile.pace;
  if (!Number.isFinite(state.profile.reviewGoal)) state.profile.reviewGoal = DEFAULT_REVIEW_GOAL;
  for (const type of EX_TYPES) if (!state.typeStats[type]) state.typeStats[type] = { ok: 0, bad: 0 };
  // The course was rebuilt from nothing (NIKL lessons in place of the book's 50 days of "<level>-<day>-<i>"
  // words): progress on words and days that no longer exist only weighs the object down.
  delete state.days;
  // Lessons were numbered records for a while; a day's lesson is now read off the path of words.
  delete state.lessons;
  for (const map of [state.words, state.notes]) for (const id of Object.keys(map)) if (!parseWordId(id)) delete map[id];
  // Steps above the top of a longer ladder that no longer exists.
  for (const word of Object.values(state.words)) if (word.s > LEARNT) word.s = LEARNT;
  return state;
}

// ---------- One word's memory ----------
// miss — times the word went wrong in a review (not in its first lesson, not in free practice); it is what
// earns a word the extra check once it is learnt. typed — scheduled reviews it was typed right at.
const blank = () => ({ s: 0, due: null, learned: null, seen: 0, ok: 0, bad: 0, miss: 0, lapses: 0, flag: false, forgot: false, last: null });
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
// Learnt and off the schedule — no review will ever ask for it again.
export const isDone = (state, id) => {
  const w = state.words[id];
  return !!(w && w.learned && w.s >= LEARNT && !w.due);
};

// ±15% on every interval, so the words met on one day stop coming back as one wave on exactly the same
// later days. Never sooner than tomorrow.
const fuzz = (days) => Math.max(1, Math.round(days * (0.85 + Math.random() * 0.3)));

// The gap a step asks for, or null when the word is learnt. `word` decides whether the top step is the extra
// check (a word that has gone wrong in a review, not checked yet) or the end.
function gapFor(word, step, before) {
  if (step < LEARNT) return INTERVALS[step];
  const needsCheck = ((word && (word.miss || 0) + (word.lapses || 0)) || 0) > 0 && !(word && word.check) && before < LEARNT;
  return needsCheck ? SAFETY_GAP : null;
}

function setStep(word, step, now) {
  const before = word.s;
  word.s = clamp(step, 0, LEARNT);
  if (before >= 3 && word.s <= 1 && word.learned) { word.forgot = true; word.lapses++; }
  if (word.s >= 3) word.forgot = false;
  const gap = gapFor(word, word.s, before);
  if (word.s < LEARNT) word.check = false;
  else if (gap) word.check = true;
  word.due = gap ? addDays(now, fuzz(gap)) : null;
}

// Flash-card self assessment: 1 Bilmadim · 2 Qiyin · 3 Bildim.
const gradeStep = (word, grade) => {
  const first = !word || !word.learned;
  const step = word ? word.s : 0;
  if (grade === 1) return 0;
  if (grade === 2) return first ? 0 : Math.max(0, step);
  return first ? 2 : step + 1;
};
// What the three buttons promise, in days — computed, so the labels can never drift from the schedule. null
// means the answer would make the word learnt.
export const previewInterval = (state, id, grade) => {
  const word = wordState(state, id);
  return gapFor(word, clamp(gradeStep(word, grade), 0, LEARNT), word ? word.s : 0);
};

export function grade(state, id, g, now = today()) {
  const word = touch(state, id);
  const first = !word.learned;
  const step = gradeStep(word, g);
  if (first) { word.learned = now; activity(state, now).learned++; }
  word.seen++;
  word.last = now;
  if (g === 1) { word.bad++; if (!first) word.miss = (word.miss || 0) + 1; } else word.ok++;
  if (!first) recall(state, g >= 3, now);
  setStep(word, step, now);
  addXP(state, first ? 4 : 2, now);
  // The interval before fuzz, so the button's promise and what the tap did read the same.
  return word.s < LEARNT ? INTERVALS[word.s] : word.due ? SAFETY_GAP : null;
}

// First meeting in a lesson. The word counts as learned and comes back tomorrow, whatever happens in the
// practice straight after: the first review after a night's sleep is the one that makes a word stick.
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

// "Bilaman": a word the learner already knows from somewhere else — a grammar class, a drama. It skips the
// lesson's practice and goes straight to a week's interval; the first review after that checks the claim,
// and a miss there drops it to the bottom like any other.
export const KNOWN_STEP = 3;
export function markKnown(state, id, now = today()) {
  const word = touch(state, id);
  if (!word.learned) {
    word.learned = now;
    activity(state, now).learned++;
    addXP(state, 2, now);
  }
  word.seen++;
  word.ok++;
  word.last = now;
  word.known = true;
  setStep(word, Math.max(word.s, KNOWN_STEP), now);
}

// How the day's reviews went, for adjustDaily: recalled or not, at the moment the schedule chose.
function recall(state, ok, now) {
  const act = activity(state, now);
  if (ok) act.rok = (act.rok || 0) + 1; else act.rbad = (act.rbad || 0) + 1;
}

// An exercise answer. mode: "learn" (a lesson), "review" (the schedule), "quiz" (free practice). `strong` is
// an answer produced rather than picked — the word typed from its meaning, with no hint — which is the best
// evidence the app can get that a word is known: at a scheduled review it moves the word two steps, and a word
// typed right at two scheduled reviews without ever going wrong is learnt there and then (the "tez yo'l").
export function answer(state, id, correct, type, mode, now = today(), { strong = false } = {}) {
  const word = touch(state, id);
  // Is this the word's scheduled moment? Read first: it is what stops a word answered several times inside
  // one session from walking up the ladder once per question.
  const scheduled = !word.due || word.due <= now;
  const fresh = !word.learned || word.learned === now;
  // A due word cleared inside a lesson is a review too; without this the day's review target is unreachable.
  const review = mode === "review" || (mode === "learn" && scheduled && !fresh);
  if (!word.learned) { word.learned = now; activity(state, now).learned++; }
  word.seen++;
  word.last = now;
  if (state.typeStats[type]) state.typeStats[type][correct ? "ok" : "bad"]++;
  if (review) recall(state, correct, now);
  if (correct) {
    word.ok++;
    if (mode !== "quiz" && scheduled) {
      if (review && strong) {
        word.typed = (word.typed || 0) + 1;
        const proven = word.typed >= 2 && !word.miss && !word.lapses;
        setStep(word, proven ? LEARNT : word.s + 2, now);
      } else setStep(word, word.s + 1, now);
    }
    addXP(state, 3, now);
  } else {
    word.bad++;
    if (review) word.miss = (word.miss || 0) + 1;
    // Free practice records the miss but leaves the ladder alone: drilling hard words late at night must not
    // cost a month of consolidation. lapses and forgot stay untouched for the same reason — both mean
    // "recall failed at the moment the schedule chose", and this is no such moment.
    if (mode !== "quiz") { setStep(word, 0, now); word.due = addDays(now, 1); }
  }
  if (review) activity(state, now).reviewed++;
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
// A day's record. It is born with the level's standard as its goal; setDayGoal trims that when the level has
// fewer new words left.
export function activity(state, date = today()) {
  const key = date;
  return (state.act[key] = state.act[key] || { learned: 0, reviewed: 0, xp: 0, min: { learn: 0, review: 0, quiz: 0 }, goal: dailyWords(state) });
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

// A day's new-word goal is written into the day itself (setDayGoal), so a later change of level cannot
// rewrite what an old day asked for. A day kept its plan when that many words were learned; a day with
// nothing new left to learn (goal 0) counts on any study, and so does a day from before goals were written.
export const dayGoal = (state, date = today()) => {
  const act = state.act[date];
  return act && Number.isFinite(act.goal) ? act.goal : dailyWords(state);
};
const dayMet = (act) => !!act && (Number.isFinite(act.goal) && act.goal > 0 ? act.learned >= act.goal : isActive(act));
export const planMet = (state, date = today()) => dayMet(state.act[date]);

// Records what today asks for: the level's standard, or fewer when fewer new words are left in the level.
export function setDayGoal(state, course, now = today()) {
  const left = course.words.filter((word) => !isLearned(state, word.id)).length;
  const act = activity(state, now);
  const goal = Math.min(dailyWords(state), act.learned + left);
  if (act.goal !== goal) act.goal = goal;
  return goal;
}

// Days in a row the plan was kept. Today not kept yet does not break it — the day is not over.
export function streak(state, now = today()) {
  let day = now;
  if (!dayMet(state.act[day])) day = addDays(day, -1);
  let n = 0;
  while (dayMet(state.act[day])) { n++; day = addDays(day, -1); }
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
      active: dayMet(state.act[key]),
      today: key === now,
      future: key > now,
    };
  });
}

// ---------- Course structure ----------
// `course` is a loaded level: { parts, partCount, byId, words, … } — the shape content.js assembles. The words
// are one path in parts of ten. A day's lesson is not stored anywhere but read off the path (todayLesson).

export const partAt = (course, n) => course.parts[n] || null;
export const partLearned = (state, course, n) => (partAt(course, n)?.ids || []).filter((id) => isLearned(state, id)).length;
export const partDone = (state, course, n) => {
  const part = partAt(course, n);
  return !!part && part.ids.every((id) => isLearned(state, id));
};
// The part holding the first word not met yet — where the path stands. Past the end, the last part.
export function currentPart(state, course) {
  const word = course.words.find((w) => !isLearned(state, w.id));
  return word ? word.part : course.partCount;
}
export const wordsLeft = (state, course) => course.words.filter((w) => !isLearned(state, w.id)).length;
export const courseDone = (state, course) => course.words.length > 0 && wordsLeft(state, course) === 0;

// "done" · "mastered" · "current" · "open". Nothing is locked: the order is advice, not a gate.
export function partStatus(state, course, n) {
  const part = partAt(course, n);
  if (!part) return "open";
  if (partDone(state, course, n)) return part.ids.every((id) => isMastered(state, id)) ? "mastered" : "done";
  return n === currentPart(state, course) ? "current" : "open";
}

// Today's lesson: the words met today, in path order, then the next ones not met yet, up to the day's goal —
// cut into sittings of PART_SIZE with a break allowed between them. `next` is the sitting to do now (-1 once
// the lesson is done), and `extra` the ten words a learner who has done it may take on top.
export function todayLesson(state, course, now = today()) {
  const goal = dayGoal(state, now);
  const metToday = course.words.filter((w) => state.words[w.id]?.learned === now).map((w) => w.id);
  const fresh = course.words.filter((w) => !isLearned(state, w.id)).map((w) => w.id);
  const ids = [...metToday, ...fresh.slice(0, Math.max(0, goal - metToday.length))];
  const sittings = [];
  for (let at = 0; at < ids.length; at += PART_SIZE) sittings.push(ids.slice(at, at + PART_SIZE));
  const next = sittings.findIndex((sitting) => sitting.some((id) => !isLearned(state, id)));
  return {
    goal,
    ids,
    sittings,
    next,
    done: next < 0,
    sittingsDone: next < 0 ? sittings.length : next,
    learned: metToday.length,
    extra: next < 0 ? fresh.slice(0, PART_SIZE) : [],
  };
}

// Where the learner stands against the plan, in words: the goals of every day from the one this level's
// first word was met up to the end of yesterday, against the words met before today. Today is left out — the
// day is not over — so `behind` is only ever work that is really late.
export function planStatus(state, course, now = today()) {
  const dates = course.words.map((w) => state.words[w.id]?.learned).filter(Boolean);
  if (!dates.length) return { started: null, expected: 0, done: 0, behind: 0 };
  const started = dates.reduce((a, b) => (a < b ? a : b));
  const done = dates.filter((date) => date < now).length;
  let expected = 0;
  for (let day = started; day < now; day = addDays(day, 1)) expected += dayGoal(state, day);
  expected = Math.min(expected, course.words.length);
  return { started, expected, done, behind: Math.max(0, expected - done) };
}

// ---------- The daily standard, moved by results ----------
// Once a day, as the day turns, the standard may move by DAILY_STEP. Up, a week after it last moved (or after
// the level's first word), when the last JUDGE_DAYS days all kept their plan, their reviews recalled at least
// RAISE_AT and nothing is left overdue: the words are staying, so the day can carry more. That makes the
// raise the rule and not the prize — a learner doing the work reaches the top of the range in a few weeks,
// and the level ends on time (levelDays). Down, when recall fell under LOWER_AT or the overdue pile outgrew a
// day's reviews: the words are not staying, and more of them would only bury the learner. Never twice within
// JUDGE_DAYS, so every change is judged on days lived with it, and never with fewer than MIN_ANSWERS reviews.
export const RAISE_AT = 0.8;
export const LOWER_AT = 0.7;
export const JUDGE_DAYS = 3;
export const RAISE_EVERY = 7;
export const MIN_ANSWERS = 15;
export function adjustDaily(state, course, now = today()) {
  const range = dailyRange(state.profile.level);
  const current = dailyWords(state);
  if (state.profile.dailyAt && diffDays(state.profile.dailyAt, now) < JUDGE_DAYS) return null;
  const acts = Array.from({ length: JUDGE_DAYS }, (_, i) => state.act[addDays(now, -(i + 1))]);
  const ok = acts.reduce((sum, act) => sum + ((act && act.rok) || 0), 0);
  const bad = acts.reduce((sum, act) => sum + ((act && act.rbad) || 0), 0);
  const rate = ok + bad >= MIN_ANSWERS ? ok / (ok + bad) : null;
  const late = dueIds(state, course, now).filter((id) => state.words[id].due < now).length;
  const since = state.profile.dailyAt || planStatus(state, course, now).started;
  const settled = since && diffDays(since, now) >= RAISE_EVERY;
  let next = current;
  if ((rate !== null && rate < LOWER_AT) || late > paceGoal(state)) next = current - DAILY_STEP;
  else if (settled && rate !== null && rate >= RAISE_AT && late === 0 && acts.every((act) => dayMet(act) && act.goal > 0)) next = current + DAILY_STEP;
  next = clamp(next, range.from, range.to);
  if (next === current) return null;
  state.profile.daily = next;
  state.profile.dailyAt = now;
  state.profile.dailyNote = { at: now, from: current, to: next };
  log(state, next > current ? `Kunlik dars ${next} so'zga oshirildi` : `Kunlik dars ${next} so'zga kamaytirildi`, next > current ? "ok" : "p");
  return { from: current, to: next };
}

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
const paceGoal = (state) => state.profile.reviewGoal || DEFAULT_REVIEW_GOAL;

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
// Returns true when it changed anything worth saving.
export function newDay(state, course, now = today()) {
  if (!state) return false;
  const rolled = !(state.dueStart && state.dueStart.date === now);
  // The standard is judged before today's goal is written, so the change reaches today.
  if (rolled) adjustDaily(state, course, now);
  const before = state.act[now] && state.act[now].goal;
  setDayGoal(state, course, now);
  // Today's goal can move without the day turning over: a switched level, a level run short of new words.
  if (!rolled) return state.act[now].goal !== before;
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

// Was yesterday's plan missed? The missed-day card asks, and the streak needs the same answer.
export function missedYesterday(state, course, now = today()) {
  const yesterday = addDays(now, -1);
  if (!dayMet(state.act[yesterday])) {
    const started = Object.keys(state.act).some((key) => key < yesterday && isActive(state.act[key]));
    if (started) return { date: yesterday };
  }
  return null;
}

// ---------- Today's two targets ----------
// Reads only; the caller banks the reward when `done` first turns true, so a render cannot hand out XP.
export function challenge(state, course, now = today()) {
  const { goal, due } = reviewGoal(state, course, now);
  const act = state.act[now] || { learned: 0, reviewed: 0 };
  const target = state.dueStart && state.dueStart.date === now ? Math.min(state.dueStart.n, goal) : Math.min(goal, due);
  const newWords = dayGoal(state, now);
  const items = [
    newWords > 0
      ? { label: `${newWords} so'z o'rganish`, cur: Math.min(act.learned, newWords), goal: newWords }
      : { label: "Yangi so'z qolmadi", cur: 1, goal: 1 },
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
  const mastered = masteredIds(state, course).length;
  const total = course.words.length;
  const half = Math.max(1, Math.ceil(total / 2));
  const keptDays = Object.values(state.act).filter((act) => dayMet(act) && act.goal > 0).length;
  return [
    { id: "first", ko: "첫", title: "Birinchi qadam", desc: "Birinchi 10 so'z o'rganildi", ok: () => learned >= 10, progress: () => `${Math.min(learned, 10)} / 10` },
    { id: "s3", ko: "삼", title: "3 kunlik seriya", desc: "3 kun ketma-ket reja bajarildi", ok: () => state.bestStreak >= 3, progress: () => `${state.bestStreak || 0} / 3` },
    { id: "s10", ko: "십", title: "10 kunlik seriya", desc: "10 kun ketma-ket reja bajarildi", ok: () => state.bestStreak >= 10, progress: () => `${state.bestStreak || 0} / 10` },
    { id: "s30", ko: "삼십", title: "30 kunlik seriya", desc: "30 kun ketma-ket reja bajarildi", ok: () => state.bestStreak >= 30, progress: () => `${state.bestStreak || 0} / 30` },
    { id: "w100", ko: "백", title: "100 so'z", desc: "100 ta so'z o'rganildi", ok: () => learned >= 100, progress: () => `${learned} / 100` },
    { id: "w300", ko: "삼백", title: "300 so'z", desc: "300 ta so'z o'rganildi", ok: () => learned >= 300, progress: () => `${learned} / 300` },
    { id: "w500", ko: "오백", title: "500 so'z", desc: "500 ta so'z o'rganildi", ok: () => learned >= 500, progress: () => `${learned} / 500` },
    { id: "wall", ko: "천", title: `${total} so'z`, desc: "Darajaning barcha so'zlari", ok: () => total > 0 && learned >= total, progress: () => `${learned} / ${total}` },
    { id: "m50", ko: "숙달", title: "50 ta o'zlashtirilgan", desc: "50 so'z to'liq o'zlashtirildi", ok: () => mastered >= 50, progress: () => `${mastered} / 50` },
    { id: "m200", ko: "정복", title: "200 ta o'zlashtirilgan", desc: "200 so'z to'liq o'zlashtirildi", ok: () => mastered >= 200, progress: () => `${mastered} / 200` },
    { id: "perfect", ko: "완벽", title: "Mukammal mashq", desc: "10+ savolda 100%", ok: () => state.quizResults.some((r) => r.total >= 10 && r.ok === r.total), progress: () => "0 / 1" },
    { id: "rev10", ko: "복습", title: "Takrorlash ustasi", desc: "10 ta takrorlash sessiyasi", ok: () => state.reviewSessions >= 10, progress: () => `${state.reviewSessions} / 10` },
    { id: "d10", ko: "열", title: "10 kunlik reja", desc: "10 kun reja bajarildi", ok: () => keptDays >= 10, progress: () => `${keptDays} / 10 kun` },
    { id: "d50", ko: "오십", title: "50 kunlik reja", desc: "50 kun reja bajarildi", ok: () => keptDays >= 50, progress: () => `${keptDays} / 50 kun` },
    { id: "half", ko: "반", title: "Yarim yo'l", desc: `Darajaning yarmi — ${half} so'z`, ok: () => total > 0 && learned >= half, progress: () => `${learned} / ${half}` },
    { id: "ear", ko: "귀", title: "Yaxshi quloq", desc: "Eshitib topish 90%+ (20+ javob)", ok: () => { const s = state.typeStats.listen; return s.ok + s.bad >= 20 && typeAccuracy(state, "listen") >= 90; }, progress: () => `${typeAccuracy(state, "listen") ?? 0}%` },
    { id: "hand", ko: "손", title: "Hangul yozuvchi", desc: "Yozishda 50 to'g'ri", ok: () => state.typeStats.type.ok >= 50, progress: () => `${state.typeStats.type.ok} / 50` },
    { id: "flawless", ko: "百", title: "Xatosiz o'tirish", desc: "10 so'zlik qismni xatosiz o'tish", ok: () => Object.values(state.act).some((act) => act.flawless > 0), progress: () => "0 / 1" },
    { id: "grad", ko: "졸업", title: "Daraja tamom", desc: "Darajaning barcha so'zlari o'zlashtirildi", ok: () => total > 0 && mastered >= total, progress: () => `${mastered} / ${total}` },
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
