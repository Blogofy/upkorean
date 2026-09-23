// The learning model, played out on a small made-up level.
//
// These are the rules nobody sees directly: when a word comes back, what a wrong answer costs, what the
// day asks for. A mistake here is invisible for weeks and then shows up as a learner who mastered nothing.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as srs from "../packages/shared/srs.js";
import { addDays, today } from "../packages/shared/dates.js";
import { buildLevel } from "../packages/shared/course/model.js";

// Three days of ten words: small enough to reason about, shaped exactly like the real thing.
const vocab = Array.from({ length: 3 }, (_, day) => Array.from({ length: 10 }, (_, i) => [`단어${day}${i}`, `so'z ${day}-${i}`]));
const course = buildLevel("b", { vocab });
const fresh = () => srs.normalize(srs.freshState({}));
const ids = (day) => course.days[day].map((word) => word.id);

test("a new word walks up the ladder, and a miss puts it back at the bottom", () => {
  const state = fresh();
  const id = "b-1-0";
  const now = "2026-09-22";

  srs.answer(state, id, true, "mc", "learn", now);
  const first = state.words[id];
  assert.equal(first.learned, now, "answering a word for the first time is meeting it");
  assert.equal(first.s, 1);
  assert.ok(first.due > now, "never due again the same day");

  srs.answer(state, id, true, "mc", "review", first.due);
  assert.equal(state.words[id].s, 2);

  srs.answer(state, id, false, "mc", "review", state.words[id].due);
  assert.equal(state.words[id].s, 0, "a miss drops the word to the bottom");
  assert.equal(state.words[id].due, addDays(state.words[id].last, 1), "and brings it back tomorrow");
});

test("answering the same word twice in one sitting only advances it once", () => {
  const state = fresh();
  const id = "b-1-1";
  const now = "2026-09-22";
  srs.answer(state, id, true, "mc", "learn", now);
  const due = state.words[id].due;
  srs.answer(state, id, true, "mcr", "learn", now);
  assert.equal(state.words[id].s, 1, "the second answer is not the word's scheduled moment");
  assert.equal(state.words[id].due, due);
});

test("free practice records the miss but never touches the schedule", () => {
  const state = fresh();
  const id = "b-1-2";
  const now = "2026-09-22";
  srs.answer(state, id, true, "mc", "learn", now);
  srs.answer(state, id, true, "mc", "review", state.words[id].due);
  const before = { ...state.words[id] };

  srs.answer(state, id, false, "type", "quiz", before.due);
  const after = state.words[id];
  assert.equal(after.s, before.s, "drilling a hard word at night must not cost weeks of consolidation");
  assert.equal(after.due, before.due);
  assert.equal(after.bad, before.bad + 1, "the miss is still recorded");
  assert.equal(after.lapses, before.lapses, "and it is not a lapse");
});

test("a word introduced without a mistake settles one step higher", () => {
  const state = fresh();
  const now = "2026-09-22";
  srs.introduce(state, "b-1-0", now);
  srs.introduce(state, "b-1-1", now);
  srs.settleIntroduced(state, ["b-1-0", "b-1-1"], { "b-1-1": true }, now);
  assert.equal(state.words["b-1-0"].s, 1, "clean practice earns the longer first interval");
  assert.equal(state.words["b-1-1"].s, 0, "a word that went wrong comes back tomorrow");
});

test("the three flash-card buttons promise what the schedule really does", () => {
  const state = fresh();
  const id = "b-1-3";
  for (const g of [1, 2, 3]) {
    const promised = srs.previewInterval(state, id, g);
    assert.ok(srs.INTERVALS.includes(promised), `grade ${g} promises a real interval`);
  }
  const promised = srs.previewInterval(state, id, 3);
  const given = srs.grade(state, id, 3, "2026-09-22");
  assert.equal(given, promised, "the button said what the tap did");
});

test("mastery needs four steps and weakness two misses", () => {
  const state = fresh();
  const id = "b-1-4";
  let now = "2026-09-22";
  srs.answer(state, id, true, "mc", "learn", now);
  for (let i = 0; i < 3; i++) {
    now = state.words[id].due;
    srs.answer(state, id, true, "mc", "review", now);
  }
  assert.equal(state.words[id].s, srs.MASTER_STEP);
  assert.ok(srs.isMastered(state, id));

  const weak = "b-1-5";
  srs.answer(state, weak, false, "mc", "learn", "2026-09-22");
  assert.ok(!srs.isWeak(state, weak), "one miss is a bad day, not a weak word");
  srs.answer(state, weak, false, "mc", "review", "2026-09-23");
  assert.ok(srs.isWeak(state, weak));
});

test("a day is three blocks and six stages", () => {
  const plan = srs.dayPlan(course, 1);
  assert.equal(plan.blocks.length, 1, "ten words is one block");

  const bigVocab = [Array.from({ length: 30 }, (_, i) => [`말${i}`, `so'z ${i}`])];
  const big = buildLevel("b", { vocab: bigVocab });
  const bigPlan = srs.dayPlan(big, 1);
  assert.equal(bigPlan.blocks.length, 3);
  assert.equal(bigPlan.stages.length, 6, "learn/recall per block, and the last recall is the day's test");
  assert.deepEqual(bigPlan.stages.map((stage) => stage.kind), ["learn", "recall", "learn", "recall", "learn", "mixed"]);
});

test("days ahead stay reachable, and days far ahead do not", () => {
  const state = fresh();
  assert.equal(srs.dayStatus(state, course, 1), "progress");
  assert.equal(srs.dayStatus(state, course, 3), "available");
  const long = buildLevel("b", { vocab: Array.from({ length: 10 }, () => [["말", "so'z"]]) });
  assert.equal(srs.dayStatus(state, long, 6), "locked");
});

test("the overflow above the day's goal is spread over the coming days", () => {
  const state = fresh();
  const now = "2026-09-22";
  state.profile.reviewGoal = 5;
  // Fifteen words, all overdue by different amounts.
  const all = [...ids(1), ...ids(2)].slice(0, 15);
  all.forEach((id, i) => {
    state.words[id] = { s: 2, due: addDays(now, -(i % 5)), learned: "2026-09-01", seen: 3, ok: 3, bad: 0, lapses: 0, flag: false, forgot: false, last: null };
  });
  assert.equal(srs.dueIds(state, course, now).length, 15);

  assert.equal(srs.newDay(state, course, now), true);
  assert.equal(srs.dueIds(state, course, now).length, 5, "today is cut to the goal");
  assert.equal(state.dueStart.n, 5);

  const pushed = all.filter((id) => state.words[id].due > now);
  assert.equal(pushed.length, 10);
  const loads = {};
  for (const id of pushed) loads[state.words[id].due] = (loads[state.words[id].due] || 0) + 1;
  const counts = Object.values(loads);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "spread evenly, not dumped on tomorrow");
  assert.ok(Object.keys(loads).every((day) => day <= addDays(now, srs.PUSH_DAYS)));

  assert.equal(srs.newDay(state, course, now), false, "the day only turns over once");
});

test("the review goal counts what today already cleared", () => {
  const state = fresh();
  const now = "2026-09-22";
  state.profile.reviewGoal = 10;
  ids(1).forEach((id) => {
    state.words[id] = { s: 2, due: addDays(now, -1), learned: "2026-09-01", seen: 3, ok: 3, bad: 0, lapses: 0, flag: false, forgot: false, last: null };
  });
  let goal = srs.reviewGoal(state, course, now);
  assert.equal(goal.due, 10);
  assert.equal(goal.late, 10, "overdue, not due today");
  assert.equal(goal.left, 10);

  srs.activity(state, now).reviewed = 4;
  goal = srs.reviewGoal(state, course, now);
  assert.equal(goal.done, 4);
  assert.equal(goal.left, 6);

  srs.activity(state, now).reviewed = 30;
  assert.equal(srs.reviewGoal(state, course, now).left, 0, "never below zero");
});

test("the streak survives yesterday but not the day before", () => {
  const state = fresh();
  const now = "2026-09-22";
  for (const day of [addDays(now, -1), addDays(now, -2), addDays(now, -3)]) {
    state.act[day] = { learned: 5, reviewed: 0, xp: 10, min: { learn: 5 } };
  }
  assert.equal(srs.streak(state, now), 3, "a day not yet worked does not break the run");
  state.act[now] = { learned: 1, reviewed: 0, xp: 1, min: { learn: 1 } };
  assert.equal(srs.streak(state, now), 4);
  delete state.act[addDays(now, -2)];
  assert.equal(srs.streak(state, now), 2);
});

test("XP levels climb and never run out", () => {
  const state = fresh();
  assert.equal(srs.levelInfo(state).level, 1);
  state.xp = 4820;
  const info = srs.levelInfo(state);
  assert.equal(info.level, 7);
  assert.equal(info.next, 5500);
  assert.equal(info.toNext, 680);
  state.xp = 999999;
  assert.ok(srs.levelInfo(state).next > state.xp, "the last level is not a wall");
});

test("an achievement is only ever earned once", () => {
  const state = fresh();
  state.bestStreak = 12;
  const first = srs.achievements(state, course, "2026-09-22");
  const streakOnes = first.earned.filter((item) => item.id === "s3" || item.id === "s10");
  assert.equal(streakOnes.length, 2);
  assert.equal(state.achievements.s10, "2026-09-22");

  const again = srs.achievements(state, course, "2026-09-23");
  assert.equal(again.earned.length, 0, "nothing is earned twice");
  assert.equal(state.achievements.s10, "2026-09-22", "and the date does not move");
});

test("today's two targets are ones a learner can finish", () => {
  const state = fresh();
  const now = "2026-09-22";
  state.profile.pace = 30;
  state.profile.reviewGoal = 50;
  ids(1).forEach((id) => {
    state.words[id] = { s: 2, due: now, learned: "2026-09-01", seen: 3, ok: 3, bad: 0, lapses: 0, flag: false, forgot: false, last: null };
  });
  const challenge = srs.challenge(state, course, now);
  assert.equal(challenge.items[0].goal, 30, "the new-word target is the pace");
  assert.equal(challenge.items[1].goal, 10, "the review target is what is really due, not the goal");
  assert.equal(challenge.done, false);

  srs.activity(state, now).learned = 30;
  srs.activity(state, now).reviewed = 10;
  const met = srs.challenge(state, course, now);
  assert.equal(met.done, true);
  assert.equal(srs.claimChallenge(state, now), true);
  assert.equal(srs.claimChallenge(state, now), false, "the reward is paid once");
});

test("state from an older version is filled in rather than rejected", () => {
  const old = { v: 1, words: { "b-1-0": { s: 1 } }, profile: { name: "Aziz", pace: 17 }, xp: 40 };
  const state = srs.normalize(old);
  assert.equal(state.profile.pace, srs.DEFAULT_PACE, "a pace that no longer exists falls back");
  assert.equal(state.profile.level, "b");
  assert.equal(state.profile.reviewGoal, srs.REVIEW_GOALS[srs.DEFAULT_PACE]);
  assert.equal(state.xp, 40, "and nothing real is lost");
  assert.ok(state.typeStats.listen);
  assert.deepEqual(state.quizResults, []);
});

test("today() and the date helpers agree with each other", () => {
  const now = today();
  assert.match(now, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(addDays(now, 0), now);
  assert.equal(addDays(addDays(now, 5), -5), now);
});
