import { test } from "node:test";
import assert from "node:assert/strict";
import { tzOf, localTime, leaderboardXp, DAY_XP_CAP, XP_PER_MIN, XP_PER_WORD } from "../server/progress.js";

const TASHKENT = -300; // UTC+5
const SEOUL = -540; // UTC+9

// Words the learner practised on `date`; their due date is far outside the test week on purpose, so only
// `last` puts them in it.
const practised = (n, date) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`1-${i}`, { s: 2, last: date, due: "2026-09-30" }]));

test("tzOf accepts real offsets and falls back to the server zone otherwise", () => {
  assert.equal(tzOf(-300), -300);
  assert.equal(tzOf("-540"), -540);
  const fallback = new Date().getTimezoneOffset();
  for (const bad of [undefined, null, "", "abc", 5000, -900, 1.5]) assert.equal(tzOf(bad), fallback);
});

test("local day and week follow the learner's zone, not the server's", () => {
  // Monday 2026-09-14 00:30 in Tashkent = Sunday 19:30 UTC.
  const now = Date.UTC(2026, 8, 13, 19, 30);
  const t = localTime(now, TASHKENT);
  assert.equal(t.today, "2026-09-14");
  assert.equal(t.hm, "00:30");
  assert.equal(t.week, "2026-09-14");
  assert.equal(t.weekEnd, "2026-09-20");
  assert.equal(t.weekStartMs, Date.UTC(2026, 8, 13, 19, 0));
  // The same instant in UTC is still last week.
  assert.equal(localTime(now, 0).week, "2026-09-07");
  // Seoul is already later that Monday.
  assert.equal(localTime(now, SEOUL).hm, "04:30");
});

test("leaderboard XP ignores other weeks, future dates and bad keys, and caps each day", () => {
  const now = Date.UTC(2026, 8, 16, 7, 0); // Wednesday 12:00 in Tashkent
  const state = { act: {
    "2026-09-13": { xp: 900 }, // last Sunday
    "2026-09-14": { xp: 200 },
    "2026-09-16": { xp: 999999 },
    "2026-09-21": { xp: 700 }, // next Monday
    "2099-01-01": { xp: 5000 },
    "junk": { xp: 1 },
    "2026-09-15": { xp: -50 },
  }, words: practised(300, "2026-09-16") };
  // Budget and practice to spare, so only the per-day cap is left to bite.
  const prev = { week_key: "2026-09-14", week_xp: 10000, updated_at: now - 60000 };
  const r = leaderboardXp(state, prev, now, TASHKENT);
  assert.equal(r.week, "2026-09-14");
  assert.equal(r.xp, 200 + DAY_XP_CAP);
});

test("weekly XP grows no faster than 150 per minute since the last save", () => {
  const now = Date.UTC(2026, 8, 16, 7, 0);
  const state = { act: { "2026-09-16": { xp: 4000 } }, words: practised(200, "2026-09-16") };
  const prev = { week_key: "2026-09-14", week_xp: 1000, updated_at: now - 60000 };
  assert.equal(leaderboardXp(state, prev, now, TASHKENT).xp, 1150);
  // A new week starts from zero, and its budget still runs from the last save, not from Monday.
  const lastWeek = { week_key: "2026-09-07", week_xp: 4000, updated_at: now - 60000 };
  assert.equal(leaderboardXp(state, lastWeek, now, TASHKENT).xp, XP_PER_MIN);
});

// The rate ceiling used to be measured from Monday 00:00 whenever the week had no row yet, so the first save
// of a week arrived with hundreds of thousands of XP of budget and only the per-day cap was left.
test("the first save of a week buys one day of budget, not the days since Monday", () => {
  const now = Date.UTC(2026, 8, 17, 7, 0); // Thursday 12:00 in Tashkent, three days into the week
  const state = {
    act: { "2026-09-16": { xp: 999999 }, "2026-09-17": { xp: 999999 } },
    words: practised(500, "2026-09-17"),
  };
  assert.equal(leaderboardXp(state, null, now, TASHKENT).xp, DAY_XP_CAP);
  // Saving again a minute later adds that minute, not the three days before the first save.
  const prev = { week_key: "2026-09-14", week_xp: DAY_XP_CAP, updated_at: now };
  assert.equal(leaderboardXp(state, prev, now + 60000, TASHKENT).xp, DAY_XP_CAP + XP_PER_MIN);
  // Same for a learner whose last save was late last week: the week start is the floor, never a windfall.
  const lastWeek = { week_key: "2026-09-07", week_xp: 9000, updated_at: Date.UTC(2026, 8, 13, 17, 0) };
  assert.equal(leaderboardXp(state, lastWeek, now, TASHKENT).xp, DAY_XP_CAP);
});

test("weekly XP never runs ahead of the words practised that week", () => {
  const now = Date.UTC(2026, 8, 16, 7, 0); // Wednesday 12:00 in Tashkent
  const act = { "2026-09-14": { xp: 5000 }, "2026-09-15": { xp: 5000 }, "2026-09-16": { xp: 5000 } };
  const rich = { week_key: "2026-09-14", week_xp: 15000, updated_at: now - 60000 }; // budget to spare
  // Forty words practised is all the evidence there is, whatever the activity log claims.
  assert.equal(leaderboardXp({ act, words: practised(40, "2026-09-15") }, rich, now, TASHKENT).xp, 40 * XP_PER_WORD);
  // Words carrying dates from other weeks say nothing about this one.
  assert.equal(leaderboardXp({ act, words: practised(40, "2026-09-07") }, rich, now, TASHKENT).xp, 0);
  assert.equal(leaderboardXp({ act }, rich, now, TASHKENT).xp, 0);
  // A word rescheduled into this week counts too: answering one sets `last` and `due` together.
  const due = { act, words: { "1-0": { s: 0, last: "2026-09-07", due: "2026-09-16" } } };
  assert.equal(leaderboardXp(due, rich, now, TASHKENT).xp, XP_PER_WORD);
});
