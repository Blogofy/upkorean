import { test } from "node:test";
import assert from "node:assert/strict";
import "../packages/shared/sync.js";

const { diffState, applyChanges, mergeStates } = globalThis.UKSync;
const clone = (v) => JSON.parse(JSON.stringify(v));

const baseState = () => ({
  v: 1,
  xp: 100,
  reviewSessions: 2,
  bestStreak: 3,
  profile: { name: "Aziza", pace: 17, reminders: { on: true, learn: "09:00" } },
  words: {
    "1-0": { s: 2, due: "2026-09-18", learned: "2026-09-10", seen: 5, ok: 4, bad: 1, lapses: 0, flag: false, last: "2026-09-14" },
    "1-1": { s: 1, due: "2026-09-17", learned: "2026-09-10", seen: 3, ok: 2, bad: 1, lapses: 0, flag: false, last: "2026-09-14" },
  },
  lessons: { "b-1": { done: false, ok: 4, bad: 1, min: 3, xp: 20 } },
  act: { "2026-09-15": { learned: 10, reviewed: 5, xp: 60, min: { learn: 5, review: 3 } } },
  typeStats: { mc: { ok: 10, bad: 2 } },
  firstTry: { ok: 8, total: 10 },
  log: [{ t: 1000, text: "a", kind: "p" }],
  quizResults: [{ type: "mc", ok: 3, total: 4, at: 500 }],
  achievements: { first: "2026-09-12" },
  tutor: { sessions: 1, lastAt: 10, lastMin: 5, current: null },
});

test("diff + apply reproduces the new state exactly", () => {
  const base = baseState();
  const cur = clone(base);
  cur.xp = 130;
  cur.words["1-0"].seen = 6;
  cur.words["2-0"] = { s: 0, seen: 1 };
  delete cur.words["1-1"];
  cur.act["2026-09-16"] = { learned: 3, reviewed: 0, xp: 30, min: {} };
  cur.profile.pace = 33;
  delete cur.tutor;
  const changes = diffState(base, cur);
  // Map entries travel one by one, not the whole map.
  assert.ok(changes.some((c) => c.p.join("/") === "words/1-0"));
  assert.ok(!changes.some((c) => c.p.join("/") === "words"));
  const server = clone(base);
  assert.equal(applyChanges(server, clone(changes)), true);
  assert.deepEqual(server, cur);
});

test("no changes produce an empty diff", () => {
  assert.deepEqual(diffState(baseState(), baseState()), []);
});

test("applyChanges rejects prototype pollution and malformed paths without applying anything", () => {
  const s = baseState();
  for (const bad of [
    [{ p: ["__proto__", "polluted"], v: true }],
    [{ p: ["words", "constructor"], v: 1 }],
    [{ p: ["a", "b", "c"], v: 1 }],
    [{ p: [], v: 1 }],
    [{ p: ["xp"] }],
    [{ p: ["xp"], v: 5 }, { p: [42], v: 1 }],
  ]) {
    assert.equal(applyChanges(s, bad), false);
  }
  assert.equal(s.xp, 100);
  assert.equal({}.polluted, undefined);
});

test("merge adds both devices' counters on top of the common base", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  phone.xp += 40; laptop.xp += 25;
  phone.act["2026-09-15"].xp += 40; laptop.act["2026-09-15"].xp += 25;
  phone.act["2026-09-15"].min.review += 2; laptop.act["2026-09-15"].min.quiz = 4;
  phone.typeStats.mc.ok += 3; laptop.typeStats.mc.bad += 1;
  phone.reviewSessions += 1; laptop.reviewSessions += 1;
  const m = mergeStates(base, phone, laptop);
  assert.equal(m.xp, 165);
  assert.equal(m.act["2026-09-15"].xp, 125);
  assert.deepEqual(m.act["2026-09-15"].min, { learn: 5, review: 5, quiz: 4 });
  assert.deepEqual(m.typeStats.mc, { ok: 13, bad: 3 });
  assert.equal(m.reviewSessions, 4);
});

test("an entry both devices created after the base (today's activity, a new word) adds both counts", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  phone.act["2026-09-16"] = { learned: 3, reviewed: 0, xp: 12, min: { learn: 2 } };
  laptop.act["2026-09-16"] = { learned: 2, reviewed: 1, xp: 8, min: { learn: 1, quiz: 3 } };
  phone.words["5-0"] = { s: 1, seen: 1, ok: 1, bad: 0, last: "2026-09-16", learned: "2026-09-16" };
  laptop.words["5-0"] = { s: 0, seen: 2, ok: 0, bad: 2, last: "2026-09-16", learned: "2026-09-16" };
  laptop.typeStats.listen = { ok: 2, bad: 0 };
  phone.typeStats.listen = { ok: 1, bad: 1 };
  const m = mergeStates(base, phone, laptop);
  assert.deepEqual(m.act["2026-09-16"], { learned: 5, reviewed: 1, xp: 20, min: { learn: 3, quiz: 3 } });
  assert.equal(m.words["5-0"].seen, 3);
  assert.equal(m.words["5-0"].bad, 2);
  assert.deepEqual(m.typeStats.listen, { ok: 3, bad: 1 });
});

test("without a common base, counters never double count", () => {
  const phone = baseState(), laptop = baseState();
  phone.xp = 300; laptop.xp = 250;
  const m = mergeStates(null, phone, laptop);
  assert.equal(m.xp, 300);
  assert.equal(m.act["2026-09-15"].xp, 60);
});

test("a word takes scheduling from the device that practised it last and adds its answer counts", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  Object.assign(phone.words["1-0"], { s: 3, due: "2026-09-26", seen: 6, ok: 5, last: "2026-09-16" });
  Object.assign(laptop.words["1-0"], { s: 0, due: "2026-09-16", seen: 6, bad: 2, last: "2026-09-15" });
  const m = mergeStates(base, phone, laptop).words["1-0"];
  assert.equal(m.s, 3);
  assert.equal(m.due, "2026-09-26");
  assert.equal(m.seen, 7);
  assert.equal(m.ok, 5);
  assert.equal(m.bad, 2);
});

test("new entries from either side survive; a finished lesson stays finished", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  phone.words["3-1"] = { s: 1, seen: 1, learned: "2026-09-16", last: "2026-09-16" };
  laptop.words["4-2"] = { s: 1, seen: 1, learned: "2026-09-16", last: "2026-09-16" };
  phone.lessons["b-1"] = { done: true, doneAt: "2026-09-16", ok: 14, bad: 1, min: 8, xp: 70 };
  laptop.lessons["b-1"] = { done: false, ok: 6, bad: 3, min: 5, xp: 30 };
  laptop.lessons["b-2"] = { done: false, ok: 2, bad: 0, min: 1, xp: 6 };
  const m = mergeStates(base, phone, laptop);
  assert.ok(m.words["3-1"] && m.words["4-2"] && m.words["1-0"]);
  assert.equal(m.lessons["b-1"].done, true);
  assert.equal(m.lessons["b-1"].doneAt, "2026-09-16");
  assert.equal(m.lessons["b-1"].ok, 4 + 10 + 2, "both devices' answers add up");
  assert.deepEqual(m.lessons["b-2"], { done: false, ok: 2, bad: 0, min: 1, xp: 6 });
});

test("a day's goal is kept through a merge, the smaller one when the devices disagree", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  phone.act["2026-09-16"] = { learned: 20, reviewed: 0, xp: 60, min: { learn: 8 }, goal: 20 };
  laptop.act["2026-09-16"] = { learned: 5, reviewed: 10, xp: 30, min: { review: 4 }, goal: 5 };
  const m = mergeStates(base, phone, laptop);
  assert.equal(m.act["2026-09-16"].goal, 5);
  assert.equal(m.act["2026-09-16"].learned, 25);
  const old = mergeStates(base, base, clone(base));
  assert.equal(old.act["2026-09-15"].goal, undefined, "a day written before goals stays without one");
});

test("the removal of the old course's days syncs like any other change", () => {
  const base = { ...baseState(), days: { 1: { stage: 2, done: false } } };
  const cur = clone(base);
  delete cur.days;
  const changes = diffState(base, cur);
  assert.deepEqual(changes, [{ p: ["days"], d: 1 }]);
  const server = clone(base);
  assert.equal(applyChanges(server, changes), true, "the server takes it");
  assert.equal(server.days, undefined);
});

test("settings changed on one side keep that change; logs and quiz results are united", () => {
  const base = baseState();
  const phone = clone(base), laptop = clone(base);
  phone.profile.pace = 33;
  laptop.profile.reminders.learn = "07:30";
  phone.log.unshift({ t: 3000, text: "phone", kind: "p" });
  laptop.log.unshift({ t: 2000, text: "laptop", kind: "p" });
  laptop.quizResults.unshift({ type: "listen", ok: 5, total: 5, at: 900 });
  const m = mergeStates(base, phone, laptop);
  assert.equal(m.profile.pace, 33);
  assert.equal(m.profile.reminders.learn, "07:30");
  assert.deepEqual(m.log.map((e) => e.text), ["phone", "laptop", "a"]);
  assert.equal(m.quizResults.length, 2);
});

test("merge does not modify its inputs", () => {
  const base = baseState(), phone = baseState(), laptop = baseState();
  phone.tutor.sessions = 3; laptop.tutor.sessions = 2;
  const before = [clone(base), clone(phone), clone(laptop)];
  mergeStates(base, phone, laptop);
  assert.deepEqual([base, phone, laptop], before);
});

test("merge with a missing side returns a copy of the other", () => {
  const s = baseState();
  const m = mergeStates(null, s, null);
  assert.deepEqual(m, s);
  assert.notEqual(m, s);
});

test("personal word notes sync one word at a time", () => {
  const base = { ...baseState(), notes: { "1-4": "관 — bog'lanish" } };
  const phone = clone(base), laptop = clone(base);
  phone.notes["1-0"] = "필요 — pul kerak";
  laptop.notes["1-4"] = "관심 — yurak bog'landi";
  assert.deepEqual(diffState(base, phone), [{ p: ["notes", "1-0"], v: "필요 — pul kerak" }]);
  const m = mergeStates(base, phone, laptop);
  assert.deepEqual(m.notes, { "1-4": "관심 — yurak bog'landi", "1-0": "필요 — pul kerak" });
});
