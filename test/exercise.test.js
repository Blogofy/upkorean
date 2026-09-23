// A whole sitting, played from the first question to the summary.
//
// The engine mutates two objects at once — the session and the learner's progress — so the thing worth
// testing is that after N taps both say the same story: the same answers, the same minutes, the same XP.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as ex from "../packages/shared/exercise.js";
import * as srs from "../packages/shared/srs.js";
import { buildLevel } from "../packages/shared/course/model.js";

const vocab = [
  Array.from({ length: 10 }, (_, i) => [`가나${i}`, `birinchi ${i}`]),
  Array.from({ length: 10 }, (_, i) => [`다라${i}`, `ikkinchi ${i}`]),
];
const examples = vocab[0].map(([ko], i) => ({
  id: `1-${i}`, w: ko, ko: `저는 ${ko}를 좋아합니다.`, hl: ko, cloze: ko, uz: `Men {${ko}}ni yaxshi ko'raman.`,
}));
const course = buildLevel("b", { vocab, examples });
const fresh = () => srs.normalize(srs.freshState({}));
const dayIds = (day) => course.days[day].map((word) => word.id);

const answerAll = (state, session, correct) => {
  let guard = 0;
  while (ex.current(session) && guard++ < 200) {
    const item = ex.current(session);
    if (item.type === "intro") { ex.introNext(state, session); }
    else if (item.type === "card") { ex.reveal(session); ex.gradeCard(state, session, correct ? 3 : 1); }
    else if (item.type === "match") {
      for (const id of item.ids) { ex.matchPick(state, session, "ko", id); ex.matchPick(state, session, "uz", id); }
    } else if (item.type === "type") {
      ex.submitTyped(state, session, course, correct ? course.byId[item.id].ko : "틀림");
    } else {
      const right = item.opts.indexOf(item.answer);
      const index = correct ? right : (right + 1) % item.opts.length;
      const outcome = ex.choose(state, session, course, index);
      if (outcome === null) ex.confirm(state, session, course);
    }
    if (!ex.next(session)) break;
  }
  return guard;
};

test("every item a builder makes carries a real answer among its options", () => {
  const state = fresh();
  for (const item of ex.recallItems(course, dayIds(1))) {
    if (item.type === "match") {
      assert.equal(item.ids.length, item.koOrder.length);
      assert.ok(item.koOrder.some((id, i) => id !== item.ids[i]) || item.ids.length < 3, "the columns are not the teaching order");
      assert.ok(item.uzOrder.every((id, i) => id !== item.koOrder[i]), "no word sits in the row of its own meaning");
      continue;
    }
    if (item.type === "type") { assert.equal(item.answer, course.byId[item.id].ko); continue; }
    assert.equal(item.opts.length, 4, `${item.type} offers four options`);
    assert.equal(new Set(item.opts).size, 4, `${item.type} offers four different options`);
    assert.ok(item.opts.includes(item.answer), `${item.type} includes the right one`);
  }
  assert.equal(ex.mixedItems(state, course, dayIds(1), {}, 6).length, 6);
});

test("a listening question is not offered when there is no audio", () => {
  const items = ex.reviewItems(course, dayIds(1), { audio: false });
  assert.ok(items.every((item) => item.type !== "listen"));
  assert.ok(ex.canUse(course, "listen", "b-1-0", { audio: true }));
  assert.ok(!ex.canUse(course, "sent", "b-2-0"), "day two has no example sentences");
});

test("a clean learning stage teaches every word in the block", () => {
  const state = fresh();
  const ids = dayIds(1);
  const session = ex.newSession("learn", ex.introItems(course, ids), { day: 1, stageIdx: 0, stage: { kind: "learn" }, category: "learn", xpStart: state.xp });
  answerAll(state, session, true);
  const outcome = ex.finish(state, session, course);

  assert.ok(ids.every((id) => srs.isLearned(state, id)), "meeting a word is learning it");
  assert.equal(state.days[1].stage, 1, "the day moved on by exactly one stage");
  assert.equal(outcome.dayDone, undefined);
  assert.equal(outcome.nextStage.kind, "mixed", "ten words are one block, so the day's test comes next");
  assert.equal(srs.activity(state).learned, ids.length);
});

test("a wrong answer comes back later in the same learning stage", () => {
  const state = fresh();
  const items = [ex.makeItem(course, "mc", "b-1-0"), ex.makeItem(course, "mc", "b-1-1")];
  const session = ex.newSession("learn", items, { day: 1, stageIdx: 1, stage: { kind: "recall" }, category: "learn", xpStart: state.xp });
  const wrong = (items[0].opts.indexOf(items[0].answer) + 1) % 4;
  ex.choose(state, session, course, wrong);
  assert.equal(session.correct, false);
  assert.equal(session.requeued, true);
  assert.ok(session.items.length > 2, "the word was put back into the queue");
  assert.equal(session.items[session.items.length - 1].id, "b-1-0");
});

test("a review sitting banks its answers, its minutes and its XP once", () => {
  const state = fresh();
  const ids = dayIds(1);
  for (const id of ids) srs.answer(state, id, true, "mc", "learn", "2026-09-01");
  const xpBefore = state.xp;

  const session = ex.newSession("review", ex.reviewItems(course, ids, { audio: false }), { category: "review", xpStart: xpBefore });
  session.activeMs = 8 * 60000;
  answerAll(state, session, true);
  const outcome = ex.finish(state, session, course);

  assert.equal(outcome.total, ids.length);
  assert.equal(outcome.ok, ids.length);
  assert.equal(outcome.accuracy, 100);
  assert.equal(state.reviewSessions, 1);
  assert.ok(state.xp > xpBefore);
  assert.equal(outcome.xp, state.xp - xpBefore);
  const minutes = srs.minutesBy(state, "review");
  ex.saveMinutes(state, session);
  assert.equal(srs.minutesBy(state, "review"), minutes, "closing twice does not bank the time twice");
});

test("the summary names the words that went wrong, worst first", () => {
  const state = fresh();
  const ids = dayIds(1).slice(0, 4);
  for (const id of ids) srs.answer(state, id, true, "mc", "learn", "2026-09-01");
  const items = ids.map((id) => ex.makeItem(course, "mc", id));
  const session = ex.newSession("review", items, { category: "review", xpStart: state.xp });
  answerAll(state, session, false);
  const outcome = ex.finish(state, session, course);

  assert.equal(outcome.ok, 0);
  assert.equal(outcome.missed.length, 4);
  assert.ok(outcome.missed.every((miss) => miss.ko && miss.uz), "a miss can be shown as a word, not an id");
  assert.equal(state.firstTry.total, 4);
  assert.equal(state.firstTry.ok, 0);
});

test("finishing the last stage finishes the day, and only once", () => {
  const state = fresh();
  const ids = dayIds(1);
  const plan = srs.dayPlan(course, 1);
  for (let stage = 0; stage < plan.stages.length; stage++) {
    const session = ex.newSession("learn", ex.mixedItems(state, course, ids, { audio: false }, 4), {
      day: 1, stageIdx: stage, stage: plan.stages[stage], category: "learn", xpStart: state.xp,
    });
    answerAll(state, session, true);
    var outcome = ex.finish(state, session, course); // eslint-disable-line no-var
  }
  assert.equal(outcome.dayDone, true);
  assert.equal(state.days[1].done, true);
  assert.equal(state.log.filter((entry) => entry.text.includes("1-kun tugatildi")).length, 1);

  const xp = state.xp;
  const again = ex.newSession("learn", [ex.makeItem(course, "mc", ids[0])], { day: 1, stageIdx: 0, stage: plan.stages[0], category: "learn", xpStart: xp });
  answerAll(state, again, true);
  ex.finish(state, again, course);
  assert.equal(state.log.filter((entry) => entry.text.includes("1-kun tugatildi")).length, 1, "a replay does not log the day again");
});

test("the matching board clears pair by pair and reports its misses", () => {
  const state = fresh();
  const ids = dayIds(1).slice(0, 5);
  const session = ex.newSession("learn", ex.recallItems(course, ids, { audio: false }), { day: 1, stageIdx: 1, stage: { kind: "recall" }, category: "learn", xpStart: state.xp });
  const item = ex.current(session);
  assert.equal(item.type, "match");

  assert.equal(ex.matchPick(state, session, "ko", item.ids[0]), null, "one side selected is not yet a guess");
  assert.equal(ex.matchPick(state, session, "uz", item.ids[1]), "miss");
  assert.equal(session.matched.length, 0);
  assert.ok(session.mistakes[item.ids[0]]);

  for (let i = 0; i < item.ids.length; i++) {
    const outcome = ex.matchPick(state, session, "ko", item.ids[i]) ?? ex.matchPick(state, session, "uz", item.ids[i]);
    if (i === item.ids.length - 1) assert.equal(outcome, "done");
  }
  assert.equal(session.matched.length, item.ids.length);
  assert.equal(session.phase, "a");
});

test("typing forgives spacing and accepts a synonym from the same course", () => {
  const twins = buildLevel("b", { vocab: [[["시험", "imtihon"], ["고사", "imtihon"], ["학교", "maktab"]]] });
  const state = fresh();
  const session = ex.newSession("quiz", [ex.makeItem(twins, "type", "b-1-0")], { quizType: "type", title: "Yozish", category: "quiz", xpStart: state.xp });
  assert.equal(ex.submitTyped(state, session, twins, " 고사 "), true, "another course word with the same meaning is not a mistake");

  const state2 = fresh();
  const session2 = ex.newSession("quiz", [ex.makeItem(twins, "type", "b-1-2")], { quizType: "type", title: "Yozish", category: "quiz", xpStart: state2.xp });
  assert.equal(ex.submitTyped(state2, session2, twins, "학원"), false);
});

test("stopping at a resting point keeps the work and shortens the sitting", () => {
  const state = fresh();
  const ids = [...dayIds(1), ...dayIds(2)];
  for (const id of ids) srs.answer(state, id, true, "mc", "learn", "2026-09-01");
  const session = ex.newSession("review", ids.map((id) => ex.makeItem(course, "mc", id)), { category: "review", xpStart: state.xp });
  assert.equal(session.items.length, 20);

  for (let i = 0; i < 5; i++) {
    const item = ex.current(session);
    ex.choose(state, session, course, item.opts.indexOf(item.answer));
    ex.next(session);
  }
  ex.stopHere(session);
  const outcome = ex.finish(state, session, course);
  assert.equal(outcome.total, 6, "the sitting is as long as it really was");
  assert.equal(outcome.ok, 5);
});

test("a sitting left early still banks its time and loses no answers", () => {
  const state = fresh();
  const ids = dayIds(1);
  for (const id of ids) srs.answer(state, id, true, "mc", "learn", "2026-09-01");
  const session = ex.newSession("review", ids.map((id) => ex.makeItem(course, "mc", id)), { category: "review", xpStart: state.xp });
  const item = ex.current(session);
  ex.choose(state, session, course, item.opts.indexOf(item.answer));
  const ok = state.words[item.id].ok;

  session.activeMs = 3 * 60000;
  ex.abandon(state, session);
  assert.ok(srs.minutesBy(state, "review") >= 3);
  assert.equal(state.words[item.id].ok, ok, "the answer was already written when it was given");
  assert.equal(state.reviewSessions, 0, "an abandoned sitting is not a completed one");
});

test("a listening question is answered with the meaning, not with the word that was heard", () => {
  const item = ex.makeItem(course, "listen", "b-1-3");
  assert.equal(item.answer, "birinchi 3");
  assert.equal(item.opts.length, 4);
  assert.ok(item.opts.includes("birinchi 3"));
  assert.ok(item.opts.every((option) => !/[가-힣]/.test(option)), "no Korean among the options");
});

test("practice flash cards are all cards, and rating them never moves the schedule", () => {
  const state = fresh();
  const ids = dayIds(1);
  for (const id of ids) srs.grade(state, id, 3);
  const before = JSON.stringify(ids.map((id) => [state.words[id].s, state.words[id].due]));
  const session = ex.newSession("quiz", ex.quizItems(state, course, ids, "card", {}, 5), { quizType: "card", title: "Flashcard", xpStart: state.xp });
  assert.equal(session.items.length, 5);
  assert.ok(session.items.every((item) => item.type === "card"));
  while (ex.current(session)) {
    ex.reveal(session);
    ex.gradeCard(state, session, 1);
    if (!ex.next(session)) break;
  }
  assert.equal(JSON.stringify(ids.map((id) => [state.words[id].s, state.words[id].due])), before);
  assert.equal(session.bad, 5);
});

test("skipping the matching game counts the unfound pairs as missed", () => {
  const state = fresh();
  const ids = dayIds(1).slice(0, 5);
  for (const id of ids) srs.introduce(state, id);
  const session = ex.newSession("learn", ex.recallItems(course, ids, { audio: false }), { day: 1, stageIdx: 1, xpStart: 0 });
  const match = ex.current(session);
  assert.equal(match.type, "match");
  ex.matchPick(state, session, "ko", match.ids[0]);
  ex.matchPick(state, session, "uz", match.ids[0]);
  assert.ok(ex.matchSkip(state, session));
  assert.equal(session.phase, "a");
  const results = session.results.filter((r) => r.type === "match");
  assert.equal(results.length, 5);
  assert.equal(results.filter((r) => r.correct).length, 1);
  for (const id of match.ids.slice(1)) assert.ok(session.mistakes[id]);
});

test("a finished sitting reports how each kind of question went", () => {
  const state = fresh();
  const ids = dayIds(1);
  for (const id of ids) srs.grade(state, id, 3);
  const session = ex.newSession("quiz", ex.quizItems(state, course, ids, "type", {}, 4), { quizType: "type", title: "Yozish", xpStart: state.xp });
  while (ex.current(session)) {
    ex.submitTyped(state, session, course, "틀림");
    if (!ex.next(session)) break;
  }
  const outcome = ex.finish(state, session, course);
  assert.deepEqual(outcome.byType, { type: { ok: 0, bad: 4 } });
});
