// The learning model, played out on a small made-up level.
//
// These are the rules nobody sees directly: when a word comes back, what a wrong answer costs, what the
// day asks for, where the path of lessons stands. A mistake here is invisible for weeks and then shows up as a learner who mastered nothing.
import { test } from "node:test";
import assert from "node:assert/strict";

import * as srs from "../packages/shared/srs.js";
import { addDays, today } from "../packages/shared/dates.js";
import { buildLevel } from "../packages/shared/course/model.js";

// A path of six parts of ten words: small enough to reason about, shaped exactly like the real thing. Word i of
// part p has the NIKL number (p-1)*10 + i + 1, so part 1 is "b-1" … "b-10".
const parts = (count, size = 10) => Array.from({ length: count }, (_, p) => ({
  g: 1, t: "", w: Array.from({ length: size }, (_, i) => [p * size + i + 1, `단어${p}${i}`, `so'z ${p}-${i}`]),
}));
const course = buildLevel("b", { vocab: parts(6) });
const fresh = () => srs.normalize(srs.freshState({}));
const ids = (n) => course.parts[n].ids;
// Meets every word of a part, the way a sitting does.
const learnPart = (state, n, date = "2026-09-22") => { for (const id of ids(n)) srs.introduce(state, id, date); };

test("a new word walks up the ladder, and a miss puts it back at the bottom", () => {
  const state = fresh();
  const id = "b-1";
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
  const id = "b-2";
  const now = "2026-09-22";
  srs.answer(state, id, true, "mc", "learn", now);
  const due = state.words[id].due;
  srs.answer(state, id, true, "mcr", "learn", now);
  assert.equal(state.words[id].s, 1, "the second answer is not the word's scheduled moment");
  assert.equal(state.words[id].due, due);
});

test("free practice records the miss but never touches the schedule", () => {
  const state = fresh();
  const id = "b-3";
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

test("every new word comes back the next day, whatever the lesson went like", () => {
  const state = fresh();
  const now = "2026-09-22";
  srs.introduce(state, "b-1", now);
  srs.introduce(state, "b-2", now);
  srs.answer(state, "b-2", false, "mc", "learn", now);
  for (const id of ["b-1", "b-2"]) {
    assert.equal(state.words[id].s, 0);
    assert.equal(state.words[id].due, addDays(now, 1));
  }
  assert.equal(state.words["b-2"].miss, 0, "a slip in the first lesson is not a missed review");
});

test("a word is reviewed on days 1, 3, 7, 14 and 30, and then it is learnt", () => {
  const state = fresh();
  const id = "b-3";
  const start = "2026-01-01";
  srs.introduce(state, id, start);
  const days = [];
  let now = start;
  while (state.words[id].due) {
    now = state.words[id].due;
    days.push(Math.round((Date.parse(now) - Date.parse(start)) / 86400000));
    srs.answer(state, id, true, "mc", "review", now);
  }
  assert.equal(days.length, 5, "five reviews, no more");
  const plan = [1, 3, 7, 14, 30];
  days.forEach((day, i) => assert.ok(Math.abs(day - plan[i]) <= Math.ceil(plan[i] * 0.2), `review ${i + 1} on day ${day}, planned ${plan[i]}`));
  assert.ok(srs.isDone(state, id));
  assert.ok(srs.isMastered(state, id));
  assert.equal(srs.dueIds(state, course, addDays(now, 400)).includes(id), false, "it never comes back on its own");
  assert.equal(srs.previewInterval(state, "b-4", 3), 4, "a first 'Bildim' still promises four days");
});

test("a word that went wrong in a review gets one more check two months after", () => {
  const state = fresh();
  const id = "b-9";
  let now = "2026-01-01";
  srs.introduce(state, id, now);
  now = state.words[id].due;
  srs.answer(state, id, false, "mc", "review", now);
  assert.equal(state.words[id].miss, 1);
  for (let i = 0; i < srs.LEARNT; i++) { now = state.words[id].due; srs.answer(state, id, true, "mc", "review", now); }
  const check = state.words[id];
  assert.equal(check.s, srs.LEARNT);
  assert.ok(check.due, "the extra check is scheduled");
  const gap = (Date.parse(check.due) - Date.parse(now)) / 86400000;
  assert.ok(gap >= 50 && gap <= 70, `about two months, got ${gap}`);
  assert.ok(!srs.isDone(state, id));

  now = check.due;
  srs.answer(state, id, true, "mc", "review", now);
  assert.ok(srs.isDone(state, id), "passing it ends the schedule");

  const again = "b-10";
  srs.introduce(state, again, "2026-01-01");
  srs.answer(state, again, false, "mc", "review", "2026-01-02");
  now = "2026-01-02";
  for (let i = 0; i < srs.LEARNT; i++) { now = state.words[again].due; srs.answer(state, again, true, "mc", "review", now); }
  srs.answer(state, again, false, "mc", "review", state.words[again].due);
  assert.equal(state.words[again].s, 0, "failing the check starts the word over");
  assert.ok(state.words[again].due);
});

test("the three flash-card buttons promise what the schedule really does", () => {
  const state = fresh();
  const id = "b-4";
  for (const g of [1, 2, 3]) {
    const promised = srs.previewInterval(state, id, g);
    assert.ok(srs.INTERVALS.includes(promised), `grade ${g} promises a real interval`);
  }
  const promised = srs.previewInterval(state, id, 3);
  const given = srs.grade(state, id, 3, "2026-09-22");
  assert.equal(given, promised, "the button said what the tap did");
});

test("mastery is the thirty-day review passed, and weakness two misses", () => {
  const state = fresh();
  const id = "b-5";
  let now = "2026-09-22";
  srs.answer(state, id, true, "mc", "learn", now);
  for (let i = 0; i < srs.MASTER_STEP - 1; i++) {
    now = state.words[id].due;
    srs.answer(state, id, true, "mc", "review", now);
  }
  assert.equal(state.words[id].s, srs.MASTER_STEP);
  assert.ok(srs.isMastered(state, id));

  const weak = "b-6";
  srs.answer(state, weak, false, "mc", "learn", "2026-09-22");
  assert.ok(!srs.isWeak(state, weak), "one miss is a bad day, not a weak word");
  srs.answer(state, weak, false, "mc", "review", "2026-09-23");
  assert.ok(srs.isWeak(state, weak));
});

test("a level is one path of parts, and today's lesson is read off it", () => {
  const state = fresh();
  const now = "2026-09-22";
  assert.equal(course.partCount, 6);
  assert.deepEqual(ids(1).slice(0, 3), ["b-1", "b-2", "b-3"]);
  assert.equal(course.byId["b-11"].part, 2);
  assert.equal(srs.currentPart(state, course), 1);
  assert.equal(srs.partStatus(state, course, 1), "current");
  assert.equal(srs.partStatus(state, course, 3), "open", "nothing ahead is locked");

  let lesson = srs.todayLesson(state, course, now);
  assert.equal(lesson.goal, 20);
  assert.deepEqual(lesson.sittings, [ids(1), ids(2)], "twenty words, two sittings of ten");
  assert.equal(lesson.next, 0);

  learnPart(state, 1, now);
  lesson = srs.todayLesson(state, course, now);
  assert.equal(lesson.next, 1, "after a break it carries on with the second sitting");
  assert.equal(lesson.sittingsDone, 1);
  assert.equal(srs.partStatus(state, course, 1), "done");
  assert.equal(srs.currentPart(state, course), 2);

  learnPart(state, 2, now);
  lesson = srs.todayLesson(state, course, now);
  assert.ok(lesson.done);
  assert.deepEqual(lesson.extra, ids(3), "ten more are on offer");
  learnPart(state, 3, now);
  lesson = srs.todayLesson(state, course, now);
  assert.equal(lesson.ids.length, 30, "extra words belong to the day they were learnt");
  assert.ok(lesson.done);

  const tomorrow = srs.todayLesson(state, course, addDays(now, 1));
  assert.deepEqual(tomorrow.sittings, [ids(4), ids(5)], "the next day starts where the path stands");
  for (const n of [4, 5, 6]) learnPart(state, n, addDays(now, 1));
  assert.ok(srs.courseDone(state, course));
});

test("a part is mastered once every word in it is", () => {
  const state = fresh();
  for (const id of ids(1)) state.words[id] = { s: srs.MASTER_STEP, learned: "2026-09-01", due: null };
  assert.equal(srs.partStatus(state, course, 1), "mastered");
  state.words["b-4"].s = 2;
  assert.equal(srs.partStatus(state, course, 1), "done");
});

test("a part without a theme is named after its shortest meanings", () => {
  const named = buildLevel("b", { vocab: [
    { g: 1, t: "Xarid", w: [[1, "가게", "do'kon"]] },
    { g: 1, t: "", w: [[2, "것", "narsa"], [3, "하다", "qilmoq"], [4, "사람", "odam, inson"], [5, "있다", "bor bo'lmoq, bor"]] },
  ] });
  assert.equal(named.parts[1].title, "Xarid");
  assert.equal(named.parts[2].title, "Odam, narsa, qilmoq");
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
  state.profile.level = "m";
  state.profile.reviewGoal = 50;
  ids(1).forEach((id) => {
    state.words[id] = { s: 2, due: now, learned: "2026-09-01", seen: 3, ok: 3, bad: 0, lapses: 0, flag: false, forgot: false, last: null };
  });
  const challenge = srs.challenge(state, course, now);
  assert.equal(challenge.items[0].goal, 35, "the new-word target is the level's standard");
  assert.equal(challenge.items[1].goal, 10, "the review target is what is really due, not the goal");
  assert.equal(challenge.done, false);

  srs.activity(state, now).learned = 35;
  srs.activity(state, now).reviewed = 10;
  const met = srs.challenge(state, course, now);
  assert.equal(met.done, true);
  assert.equal(srs.claimChallenge(state, now), true);
  assert.equal(srs.claimChallenge(state, now), false, "the reward is paid once");
});

test("state from an older version is filled in rather than rejected", () => {
  const old = { v: 1, words: { "b-1-0": { s: 1 }, "b-36": { s: 2 } }, days: { 1: { stage: 2 } }, profile: { name: "Aziz", pace: 30 }, xp: 40 };
  const state = srs.normalize(old);
  assert.equal(state.words["b-1-0"], undefined, "a word of the old book course is gone");
  assert.deepEqual(state.words["b-36"], { s: 2 }, "a word of the NIKL course stays");
  assert.equal(state.days, undefined, "and so are its days");
  assert.equal(state.lessons, undefined);
  assert.equal(state.profile.pace, undefined, "the pace the learner used to pick is gone: the level sets it");
  assert.equal(state.profile.level, "b");
  assert.equal(state.profile.reviewGoal, srs.DEFAULT_REVIEW_GOAL);
  assert.equal(state.xp, 40, "and nothing real is lost");
  assert.ok(state.typeStats.listen);
  assert.deepEqual(state.quizResults, []);
});

test("the daily standard starts at the level's floor and stays inside its range", () => {
  const state = fresh();
  assert.equal(srs.dailyWords(state), 20);
  state.profile.daily = 30;
  assert.equal(srs.dailyWords(state), 30);
  state.profile.daily = 50;
  assert.equal(srs.dailyWords(state), 30, "초급 tops out at 30");
  state.profile.level = "m";
  assert.equal(srs.dailyWords(state), 50);
  state.profile.daily = 20;
  assert.equal(srs.dailyWords(state), 35, "중급 starts at 35 whatever 초급 ended at");
  state.profile.level = "a";
  assert.equal(srs.dailyWords(state), 50);
  assert.equal(srs.daysFor(1835, 20), 92);
  assert.equal(srs.levelDays("b"), 65, "a week at 20, a week at 25, then 30: well inside two and a half months");
  assert.equal(srs.levelDays("b", 60, 30), 2);
});

// Three days behind `now`, each kept with the given review answers.
function lived(state, now, { rok, rbad, kept = true }) {
  for (let i = 1; i <= srs.JUDGE_DAYS; i++) {
    const goal = srs.dailyWords(state);
    state.act[addDays(now, -i)] = { learned: kept ? goal : 5, reviewed: rok + rbad, xp: 50, min: { learn: 10 }, goal, rok, rbad };
  }
}

test("the standard grows by five a week when the words are staying", () => {
  const state = fresh();
  const now = "2026-10-10";
  lived(state, now, { rok: 17, rbad: 3 });
  state.profile.dailyAt = addDays(now, -5);
  assert.equal(srs.adjustDaily(state, course, now), null, "not before a week at the current number");
  state.profile.dailyAt = addDays(now, -7);
  assert.deepEqual(srs.adjustDaily(state, course, now), { from: 20, to: 25 });
  assert.equal(srs.dailyWords(state), 25);
  assert.equal(state.profile.dailyNote.to, 25, "the home screen is told");
  lived(state, addDays(now, 3), { rok: 30, rbad: 1 });
  assert.equal(srs.adjustDaily(state, course, addDays(now, 3)), null, "not again within the week");
  lived(state, addDays(now, 7), { rok: 30, rbad: 1 });
  assert.equal(srs.adjustDaily(state, course, addDays(now, 7)).to, 30);
  lived(state, addDays(now, 14), { rok: 30, rbad: 1 });
  assert.equal(srs.adjustDaily(state, course, addDays(now, 14)), null, "30 is the top of 초급");
});

test("the first raise counts the week from the level's first word", () => {
  const state = fresh();
  const now = "2026-10-10";
  lived(state, now, { rok: 18, rbad: 2 });
  assert.equal(srs.adjustDaily(state, course, now), null, "nothing learned yet: no week to count");
  state.words["b-11"] = { s: 1, due: addDays(now, 2), learned: addDays(now, -7), seen: 2, ok: 2, bad: 0, lapses: 0 };
  assert.equal(srs.adjustDaily(state, course, now).to, 25);
});

test("the standard holds without enough evidence, and falls when words are not staying", () => {
  const state = fresh();
  const now = "2026-10-10";
  lived(state, now, { rok: 3, rbad: 0 });
  assert.equal(srs.adjustDaily(state, course, now), null, "nine reviews in three days prove nothing");
  lived(state, now, { rok: 40, rbad: 2, kept: false });
  assert.equal(srs.adjustDaily(state, course, now), null, "good recall on days the plan was not kept is no reason to ask for more");

  state.profile.daily = 30;
  lived(state, now, { rok: 12, rbad: 8 });
  assert.deepEqual(srs.adjustDaily(state, course, now), { from: 30, to: 25 }, "60% recall lowers it");
  state.profile.dailyAt = null;
  state.profile.daily = 20;
  lived(state, now, { rok: 12, rbad: 8 });
  assert.equal(srs.adjustDaily(state, course, now), null, "never under the level's floor");
});

test("the standard falls when reviews pile up, however well they go", () => {
  const state = fresh();
  const now = "2026-10-10";
  state.profile.daily = 30;
  state.profile.reviewGoal = 5;
  for (const id of [...ids(1), ...ids(2)]) state.words[id] = { s: 2, due: addDays(now, -3), learned: "2026-09-01", seen: 3, ok: 3, bad: 0, lapses: 0 };
  lived(state, now, { rok: 40, rbad: 1 });
  assert.equal(srs.adjustDaily(state, course, now).to, 25);
});

test("a word typed right at two reviews without a miss is learnt: the fast track", () => {
  const state = fresh();
  const id = "b-11";
  let now = "2026-01-01";
  srs.introduce(state, id, now);
  now = state.words[id].due;
  srs.answer(state, id, true, "type", "review", now, { strong: true });
  assert.equal(state.words[id].s, 2, "typing it moves it two steps");
  now = state.words[id].due;
  srs.answer(state, id, true, "type", "review", now, { strong: true });
  assert.ok(srs.isDone(state, id), "a second typed recall ends its reviews");
  assert.equal(srs.activity(state, now).rok, 1, "and it counts as a recalled review");

  const picked = "b-12";
  now = "2026-01-01";
  srs.introduce(state, picked, now);
  now = state.words[picked].due;
  srs.answer(state, picked, true, "mcr", "review", now);
  assert.equal(state.words[picked].s, 1, "picking it among four is one step");

  const slipped = "b-13";
  now = "2026-01-01";
  srs.introduce(state, slipped, now);
  now = state.words[slipped].due;
  srs.answer(state, slipped, false, "mc", "review", now);
  for (let i = 0; i < 2; i++) { now = state.words[slipped].due; srs.answer(state, slipped, true, "type", "review", now, { strong: true }); }
  assert.ok(!srs.isDone(state, slipped), "a word that went wrong once takes the long way");

  const hinted = "b-14";
  now = "2026-01-01";
  srs.introduce(state, hinted, now);
  now = state.words[hinted].due;
  srs.answer(state, hinted, true, "type", "review", now, { strong: false });
  assert.equal(state.words[hinted].s, 1, "typed with the hint is one step, like a pick");
});

test("a day counts toward the streak only when its plan was kept", () => {
  const state = fresh();
  const now = "2026-09-22";
  const yesterday = addDays(now, -1), before = addDays(now, -2), older = addDays(now, -3);
  state.act[older] = { learned: 4, reviewed: 0, xp: 10, min: { learn: 5 } }; // written before goals existed
  state.act[before] = { learned: 20, reviewed: 3, xp: 90, min: { learn: 12 }, goal: 20 };
  state.act[yesterday] = { learned: 12, reviewed: 40, xp: 80, min: { learn: 9, review: 12 }, goal: 20 };
  assert.equal(srs.planMet(state, yesterday), false, "twelve of twenty is not the plan, however long the reviews were");
  assert.equal(srs.streak(state, now), 0);
  assert.ok(srs.missedYesterday(state, course, now), "and the home screen says so");

  state.act[yesterday].learned = 20;
  assert.equal(srs.streak(state, now), 3, "an old day without a goal still counts on any study");

  state.act[now] = { learned: 0, reviewed: 5, xp: 10, min: { review: 3 }, goal: 0 };
  assert.equal(srs.streak(state, now), 4, "with no new words left, studying at all keeps the plan");
});

test("today's goal shrinks when the level has fewer new words left", () => {
  const state = fresh();
  const now = "2026-09-22";
  assert.equal(srs.setDayGoal(state, course, now), 20);
  for (const n of [1, 2, 3, 4]) learnPart(state, n, now);
  for (const id of ids(5).slice(0, 5)) srs.introduce(state, id, now);
  assert.equal(srs.setDayGoal(state, course, now), 20, "forty-five learned today already meet it");
  const next = addDays(now, 1);
  assert.equal(srs.setDayGoal(state, course, next), 15, "the next day only fifteen are left to learn");
  for (const id of [...ids(5).slice(5), ...ids(6)]) srs.introduce(state, id, next);
  assert.ok(srs.planMet(state, next));
  assert.equal(srs.setDayGoal(state, course, addDays(next, 1)), 0, "and after that none");
});

test("the plan says how far behind the learner is, never counting today", () => {
  const state = fresh();
  const now = "2026-09-22";
  assert.equal(srs.planStatus(state, course, now).behind, 0, "nothing started, nothing late");
  learnPart(state, 1, now);
  learnPart(state, 2, now);
  assert.equal(srs.planStatus(state, course, now).behind, 0, "the first day is not over yet");
  assert.equal(srs.planStatus(state, course, addDays(now, 1)).behind, 0, "twenty a day, and twenty are met");
  assert.equal(srs.planStatus(state, course, addDays(now, 2)).behind, 20, "a day skipped is a day's words behind");
  assert.equal(srs.planStatus(state, course, addDays(now, 9)).expected, 60, "never more words than the level has");
});

test("a word marked known skips ahead a week and still counts as met", () => {
  const state = fresh();
  const now = "2026-09-22";
  srs.markKnown(state, "b-7", now);
  const word = state.words["b-7"];
  assert.equal(word.learned, now);
  assert.equal(word.s, srs.KNOWN_STEP);
  assert.ok(word.due >= addDays(now, 5), "the first check comes about a week later");
  assert.equal(srs.activity(state, now).learned, 1, "it counts toward today's words");
  srs.answer(state, "b-7", false, "mc", "review", word.due);
  assert.equal(state.words["b-7"].s, 0, "a miss at that check drops it like any other word");
});

test("today() and the date helpers agree with each other", () => {
  const now = today();
  assert.match(now, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(addDays(now, 0), now);
  assert.equal(addDays(addDays(now, 5), -5), now);
});
