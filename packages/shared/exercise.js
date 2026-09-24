// The exercise engine: what a sitting is made of, and what each answer does to it.
//
// Two halves. The builders turn a list of word ids into items — a question carries everything it needs, so
// nothing is decided while the learner is looking at it. The session functions below move one sitting
// along; they mutate both the session and the progress object, exactly like the screen does when it taps,
// so the caller keeps one object and redraws. Pure of any screen, so tests can play a whole sitting.
import * as srs from "./srs.js";
import { today } from "./dates.js";

const shuffle = (list) => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const weighted = (weights) => {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) if ((r -= w) <= 0) return key;
  return entries.length ? entries[entries.length - 1][0] : null;
};

const sameMeaning = (a, b) => String(a.uz).trim().toLowerCase() === String(b.uz).trim().toLowerCase();

// Wrong options come from the word's own part first — met together, so the choice is about the word and
// not about which option looks out of place — then from anywhere in the level.
function distractors(course, word, n, field) {
  const own = (course.parts[word.part]?.ids || []).map((id) => course.byId[id]).filter(Boolean);
  const pool = shuffle(own).concat(shuffle(course.words).slice(0, 80));
  const out = [];
  const seen = new Set([word[field]]);
  for (const other of pool) {
    if (out.length >= n) break;
    if (other.id === word.id || sameMeaning(other, word) || seen.has(other[field])) continue;
    seen.add(other[field]);
    out.push(other[field]);
  }
  return out;
}

const clozeOf = (course, id) => {
  const example = course.examples[id];
  return example && example.cloze ? example : null;
};

// A listening question needs the word's own recording: the narrator reads each word once, and a word not
// recorded yet is asked some other way.
export function canUse(course, type, id, { audio = true } = {}) {
  if (type === "listen") return audio && !!course.byId[id]?.aw;
  if (type === "sent") return !!clozeOf(course, id);
  return true;
}

function chooseType(course, id, weights, opts) {
  const usable = { ...weights };
  for (const type of Object.keys(usable)) if (!canUse(course, type, id, opts)) usable[type] = 0;
  return weighted(usable) || "mc";
}

// One question, with its options already drawn.
export function makeItem(course, type, id) {
  const word = course.byId[id];
  const item = { type, id, ko: word.ko, uz: word.uz, part: word.part };
  // Hearing a word is answered with its meaning. Offering the Korean instead would let anyone pick the
  // shape that sounds like what was just said, without knowing what it means.
  if (type === "mc" || type === "listen") {
    item.answer = word.uz;
    item.opts = shuffle([word.uz, ...distractors(course, word, 3, "uz")]);
  }
  if (type === "mcr") {
    item.answer = word.ko;
    item.opts = shuffle([word.ko, ...distractors(course, word, 3, "ko")]);
  }
  if (type === "sent") {
    const example = clozeOf(course, id);
    item.example = example;
    item.answer = example.cloze;
    const others = [...new Set(Object.values(course.examples).filter((e) => e.cloze && e.cloze !== example.cloze).map((e) => e.cloze))];
    item.opts = shuffle([example.cloze, ...shuffle(others).slice(0, 3)]);
    item.optMeanings = item.opts.map((cloze) => {
      const source = Object.values(course.examples).find((e) => e.cloze === cloze);
      const word2 = source && course.byId[source.id];
      return word2 ? word2.uz : "";
    });
  }
  if (type === "type") {
    item.answer = word.ko;
    item.hint = [...String(word.ko)][0] || "";
    item.syllables = [...String(word.ko).replace(/[^가-힣]/g, "")].length;
  }
  return item;
}

// The matching game: five pairs in two columns, neither in the order they were taught, and no word sitting
// in the row of its own meaning.
const MATCH_SIZE = 5;
function matchItem(course, ids) {
  const koOrder = shuffleUnlike(ids, (order) => order.some((id, i) => id !== ids[i]));
  const uzOrder = shuffleUnlike(ids, (order) => order.every((id, i) => id !== koOrder[i]));
  return { type: "match", id: ids[0], ids, koOrder, uzOrder };
}
function shuffleUnlike(list, ok) {
  let order = shuffle(list);
  for (let tries = 0; tries < 100 && list.length > 1 && !ok(order); tries++) order = shuffle(list);
  return order;
}

const ORDER = { intro: 0, card: 1, match: 2, mc: 3, mcr: 4, type: 5, listen: 6, sent: 7 };

// ---------- Builders, one per kind of sitting ----------

// Meeting new words: one card each, in the lesson's own order.
export const introItems = (course, ids) => ids.map((id) => ({
  type: "intro", id, ko: course.byId[id].ko, uz: course.byId[id].uz, example: course.examples[id] || null,
}));

// Putting the block to work: two rounds of matching, then a question on every word, hardest form last.
export function recallItems(course, ids, opts) {
  const items = [];
  const groups = [];
  for (let at = 0; at < ids.length; at += MATCH_SIZE) groups.push(ids.slice(at, at + MATCH_SIZE));
  for (const group of groups) if (group.length >= 3) items.push(matchItem(course, shuffle(group)));
  const weights = { mcr: 3, mc: 2, listen: 2, type: 1 };
  const questions = shuffle(ids).map((id) => makeItem(course, chooseType(course, id, weights, opts), id));
  return items.concat(questions.sort((a, b) => ORDER[a.type] - ORDER[b.type]));
}

// One sitting of a lesson: meet five words and put them to work at once, then the other five, then a short
// mixed round over all ten. Each word is recalled minutes after it was first seen and again a little later,
// before the schedule takes over — the first retrievals are the ones that make a word stick.
export const LESSON_HALF = 5;
export function lessonItems(state, course, ids, opts) {
  const items = [];
  for (let at = 0; at < ids.length; at += LESSON_HALF) {
    const half = ids.slice(at, at + LESSON_HALF);
    items.push(...introItems(course, half), ...recallItems(course, half, opts));
  }
  if (ids.length > LESSON_HALF) items.push(...mixedItems(state, course, ids, opts, 6));
  return items;
}

// A closing round: the words it went worst with, in every form the app knows.
export function mixedItems(state, course, ids, opts, count = 12) {
  const weights = { mc: 3, mcr: 3, type: 2, listen: 2, sent: 2 };
  const ordered = ids.slice().sort((a, b) => ((state.words[b] || {}).bad || 0) - ((state.words[a] || {}).bad || 0) || Math.random() - 0.5);
  return shuffle(ordered.slice(0, Math.min(count, ordered.length))).map((id) => makeItem(course, chooseType(course, id, weights, opts), id));
}

// A review sitting. Mostly typing, because a word typed from its meaning is the evidence the fast track runs
// on (srs.answer): the better the evidence, the sooner a known word leaves the schedule. The other forms stay
// in the mix so a sitting is not twenty rounds of the same thing.
export function reviewItems(course, ids, opts) {
  const weights = { type: 4, mcr: 2, mc: 2, listen: 2, card: 1, sent: 1 };
  return ids.map((id) => {
    const type = chooseType(course, id, weights, opts);
    if (type === "card") return cardItem(course, id);
    return makeItem(course, type, id);
  });
}

const cardItem = (course, id) => ({
  type: "card", id, ko: course.byId[id].ko, uz: course.byId[id].uz,
  example: course.examples[id] || null,
});

// Free practice. The learner picked the form, or asked for a mix. "card" is flash cards on their own.
export function quizItems(state, course, ids, quizType, opts, count = 20) {
  const weights = { mc: 3, mcr: 3, type: 2, listen: 2, sent: 2 };
  const weakFirst = ids.slice().sort((a, b) => ((state.words[b] || {}).bad || 0) - ((state.words[a] || {}).bad || 0));
  const chosen = shuffle(shuffle(weakFirst.slice(0, count * 2)).slice(0, Math.min(count, ids.length)));
  const fixed = { mixed: null, mc: null, listen: "listen", type: "type", sent: "sent" }[quizType];
  return chosen.map((id) => {
    if (quizType === "card") return cardItem(course, id);
    if (quizType === "mc") return makeItem(course, pick(["mc", "mcr"]), id);
    // A word the round's own form cannot ask (not recorded yet, no sentence) is asked some other way.
    const type = fixed && canUse(course, fixed, id, opts) ? fixed : chooseType(course, id, weights, opts);
    return makeItem(course, type, id);
  });
}

// ---------- A sitting in progress ----------
const firstPhase = (item) => (!item ? "q" : item.type === "card" ? "front" : item.type === "intro" ? "intro" : "q");

export function newSession(kind, items, extra = {}) {
  return {
    kind, items, idx: 0, ok: 0, bad: 0, results: [], phase: firstPhase(items[0]),
    mistakes: {}, tries: {}, chosen: null, typed: "", correct: null, revealed: false,
    matched: [], sel: {}, flash: null, wrongPairs: 0,
    startedAt: Date.now(), itemStart: Date.now(), activeMs: 0,
    xpStart: 0, finished: false, minutesSaved: false,
    ...extra,
  };
}

export const current = (session) => session && session.items[session.idx];
export const progressPct = (session) => srs.pct(session.idx, session.items.length);
const modeOf = (session) => (session.kind === "review" ? "review" : session.kind === "quiz" ? "quiz" : "learn");

function trackTime(session) {
  // A question left open for an hour was not an hour of study; a minute is as much as one can cost.
  session.activeMs += Math.min(Date.now() - session.itemStart, 60000);
  session.itemStart = Date.now();
}

// Records an answer and moves to the verdict phase. Wrong answers in a lesson come back a few
// questions later, at most twice, with fresh options.
export function record(state, session, course, correct, now = today()) {
  const item = current(session);
  trackTime(session);
  session.correct = correct;
  session[correct ? "ok" : "bad"]++;
  session.results.push({ id: item.id, type: item.type, correct });
  // A word typed from its meaning without the hint is the evidence the fast track runs on.
  srs.answer(state, item.id, correct, item.type, modeOf(session), now, { strong: item.type === "type" && !session.hinted });
  session.requeued = false;
  if (!correct) {
    session.mistakes[item.id] = true;
    session.tries[item.id] = (session.tries[item.id] || 0) + 1;
    if (session.kind === "learn" && session.tries[item.id] < 3) {
      session.items.splice(Math.min(session.idx + 3, session.items.length), 0, makeItem(course, item.type, item.id));
      session.requeued = true;
    }
  }
  if (session.kind === "review") {
    state.firstTry.total++;
    if (correct) state.firstTry.ok++;
  }
  session.phase = "a";
  return correct;
}

export function choose(state, session, course, index, now = today()) {
  const item = current(session);
  if (!item || session.phase !== "q" || !item.opts || index >= item.opts.length) return false;
  session.chosen = index;
  // The cloze question asks for a deliberate answer: pick, read it back in the sentence, then confirm.
  if (item.type === "sent") return null;
  return record(state, session, course, item.opts[index] === item.answer, now);
}

export function confirm(state, session, course, now = today()) {
  const item = current(session);
  if (!item || session.phase !== "q" || session.chosen === null) return false;
  return record(state, session, course, item.opts[session.chosen] === item.answer, now);
}

// Typing is forgiving about spacing and punctuation, and accepts any course word with the very same
// meaning — several words mean "holat", and marking one of them wrong teaches nothing.
const norm = (text) => String(text).replace(/[\s.,!?·'"’`()~\-]/g, "").toLowerCase();
function variants(course, word) {
  const out = new Set();
  for (const part of String(word.ko).split("/")) {
    out.add(norm(part));
    out.add(norm(part.replace(/\(.*?\)/g, "")));
  }
  for (const other of course.words) {
    if (other.id !== word.id && sameMeaning(other, word)) String(other.ko).split("/").forEach((part) => out.add(norm(part)));
  }
  out.delete("");
  return out;
}

export function submitTyped(state, session, course, value, now = today()) {
  const item = current(session);
  if (!item || item.type !== "type" || session.phase !== "q") return false;
  const typed = String(value || "").trim();
  if (!typed) return false;
  session.typed = typed;
  return record(state, session, course, variants(course, course.byId[item.id]).has(norm(typed)), now);
}

export function skip(state, session, course, now = today()) {
  if (!session || session.phase !== "q") return false;
  session.chosen = null;
  return record(state, session, course, false, now);
}

export function reveal(session) {
  if (session.phase === "front") session.phase = "back";
}

export function gradeCard(state, session, g, now = today()) {
  const item = current(session);
  if (!item || item.type !== "card" || session.phase !== "back") return null;
  trackTime(session);
  // In free practice the three buttons only count: rating a card at midnight for fun must not move it on
  // the review ladder, exactly as a wrong answer in practice does not.
  let days = null;
  if (session.kind === "quiz") {
    const word = state.words[item.id];
    if (word) { word.seen++; word.last = now; if (g === 1) word.bad++; else word.ok++; }
    srs.addXP(state, g >= 3 ? 2 : 1, now);
  } else {
    days = srs.grade(state, item.id, g, now);
  }
  session.results.push({ id: item.id, type: "card", grade: g, correct: g >= 3 });
  if (g >= 3) session.ok++; else { session.bad++; session.mistakes[item.id] = true; }
  return days;
}

// "Bilaman" on a new word's card: the word is marked known (srs.markKnown) and everything the sitting still
// had to ask about it is taken out — its questions, its place in a matching board, its closing round.
export function introKnown(state, session, now = today()) {
  const item = current(session);
  if (!item || item.type !== "intro") return false;
  trackTime(session);
  srs.markKnown(state, item.id, now);
  const kept = session.items.slice(0, session.idx + 1);
  for (const later of session.items.slice(session.idx + 1)) {
    if (later.type === "match" && later.ids.includes(item.id)) {
      const ids = later.ids.filter((id) => id !== item.id);
      if (ids.length >= 2) kept.push({ ...later, ids, koOrder: later.koOrder.filter((id) => id !== item.id), uzOrder: later.uzOrder.filter((id) => id !== item.id) });
    } else if (later.id !== item.id) kept.push(later);
  }
  session.items.length = 0;
  session.items.push(...kept);
  return true;
}

export function introNext(state, session, now = today()) {
  const item = current(session);
  if (!item || item.type !== "intro") return false;
  trackTime(session);
  srs.introduce(state, item.id, now);
  return true;
}

// Giving up on the matching game. Every pair not found yet counts as a word not known — the same as a
// wrong answer in the sitting's mode — so skipping is never a cheaper way through than trying.
export function matchSkip(state, session, now = today()) {
  const item = current(session);
  if (!item || item.type !== "match" || session.phase !== "q") return false;
  trackTime(session);
  for (const id of item.ids) {
    const found = session.matched.includes(id);
    if (!found) {
      session.mistakes[id] = true;
      srs.answer(state, id, false, "match", modeOf(session), now);
    }
    session.results.push({ id, type: "match", correct: found && !session.mistakes[id] });
  }
  session.phase = "a";
  return true;
}

// Tapping one side of the matching game. Returns "pair" when a pair landed, "miss" when it did not,
// "done" when the board is clear, or null when the tap only moved the selection.
export function matchPick(state, session, side, id) {
  const item = current(session);
  if (!item || item.type !== "match" || session.phase !== "q" || !item.ids.includes(id)) return null;
  if (session.matched.includes(id)) return null;
  session.sel = session.sel || {};
  session.sel[side] = session.sel[side] === id ? null : id;
  session.flash = null;
  const { ko, uz } = session.sel;
  if (!ko || !uz) return null;
  session.sel = {};
  if (ko === uz) {
    session.matched = [...session.matched, ko];
    srs.addXP(state, 1);
    if (session.matched.length === item.ids.length) {
      trackTime(session);
      for (const id2 of item.ids) session.results.push({ id: id2, type: "match", correct: !session.mistakes[id2] });
      session.phase = "a";
      return "done";
    }
    return "pair";
  }
  session.mistakes[ko] = true;
  session.wrongPairs++;
  session.flash = { ko, uz };
  return "miss";
}

// Moves to the next item. Returns false when the sitting has run out and should be finished.
export function next(session) {
  session.idx++;
  session.chosen = null;
  session.typed = "";
  session.correct = null;
  session.revealed = false;
  session.requeued = false;
  session.hinted = false;
  session.matched = [];
  session.sel = {};
  session.flash = null;
  session.itemStart = Date.now();
  if (session.idx >= session.items.length) return false;
  session.phase = firstPhase(current(session));
  return true;
}

// A long review sitting needs a visible end. Every twenty answers it says how far along the learner is and
// offers a way out that keeps the work, instead of an exit that reads as giving up.
export const REST_EVERY = 20;
export function restDue(session) {
  return session.kind === "review"
    && (session.idx + 1) % REST_EVERY === 0
    && session.idx + 1 < session.items.length
    && session.restAt !== session.idx;
}
export function markRest(session) { session.restAt = session.idx; }

// Ends the sitting where it stands: the answered items become the whole sitting, so the summary and the XP
// read its real length. Nothing is lost — every answer was written as it happened.
export function stopHere(session) {
  session.items.length = session.idx + 1;
  session.idx = session.items.length;
}

export function saveMinutes(state, session, now = today()) {
  if (session.category && !session.minutesSaved) {
    srs.addMinutes(state, session.category, session.activeMs / 60000, now);
    session.minutesSaved = true;
  }
}

// Closes the sitting and writes what it earned. Returns what the screen after it needs to know.
export function finish(state, session, course, now = today()) {
  session.finished = true;
  trackTime(session);
  saveMinutes(state, session, now);
  const outcome = { kind: session.kind, ok: session.ok, bad: session.bad, total: session.items.length };

  if (session.kind === "learn") {
    // One sitting of today's lesson, or ten words on top of it. The lesson is read off the path of words, so
    // all this writes is the day's goal, a sitting without a mistake, and the lesson's bonus the first time
    // it is found done.
    srs.setDayGoal(state, course, now);
    const act = srs.activity(state, now);
    if (session.ok > 0 && !session.bad) act.flawless = (act.flawless || 0) + 1;
    const lesson = srs.todayLesson(state, course, now);
    outcome.extra = !!session.extra;
    outcome.lessonDone = lesson.done;
    outcome.sittings = lesson.sittings.length;
    outcome.sittingsDone = lesson.sittingsDone;
    outcome.goal = lesson.goal;
    outcome.learnedToday = lesson.learned;
    outcome.firstTime = lesson.done && !act.lessonDone;
    if (outcome.firstTime) {
      act.lessonDone = true;
      srs.addXP(state, 50, now);
      srs.log(state, `Bugungi dars tugatildi — ${lesson.learned} so'z`, "ok");
    }
  } else if (session.kind === "review") {
    state.reviewSessions++;
    srs.addXP(state, 20, now);
    srs.log(state, `Takrorlash — ${session.ok}/${session.items.length} to'g'ri`, "p");
  } else if (session.kind === "quiz") {
    const total = session.items.length;
    state.quizResults.unshift({ type: session.quizType, ok: session.ok, total, at: Date.now() });
    state.quizResults = state.quizResults.slice(0, 20);
    srs.addXP(state, 10 + (session.ok === total && total >= 10 ? 20 : 0), now);
    srs.log(state, `${session.title} — ${session.ok}/${total}`, "p");
  }

  outcome.xp = state.xp - session.xpStart;
  outcome.minutes = Math.max(1, Math.round(session.activeMs / 60000));
  outcome.accuracy = outcome.total ? srs.pct(session.ok, session.ok + session.bad) : 0;
  // The words this sitting went wrong on, worst first — the summary screen offers to fix them now.
  const missed = {};
  for (const result of session.results) {
    if (result.correct === false) missed[result.id] = (missed[result.id] || 0) + 1;
  }
  outcome.missed = Object.entries(missed)
    .sort((a, b) => b[1] - a[1])
    .map(([id, times]) => ({ id, times, ko: course.byId[id]?.ko, uz: course.byId[id]?.uz }));
  // How each kind of question went, so the summary can say where the mistakes were.
  const byType = {};
  for (const result of session.results) {
    const row = (byType[result.type] = byType[result.type] || { ok: 0, bad: 0 });
    if (result.correct) row.ok++; else row.bad++;
  }
  outcome.byType = byType;
  return outcome;
}

// Leaving early. Every answer was already written, so all this owes is the time and an honest length.
export function abandon(state, session, now = today()) {
  if (!session || session.finished) return;
  trackTime(session);
  saveMinutes(state, session, now);
}
