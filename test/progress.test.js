import { test } from "node:test";
import assert from "node:assert/strict";
import { tzOf, localTime, leaderboardXp, DAY_XP_CAP } from "../server/progress.js";

const TASHKENT = -300; // UTC+5
const SEOUL = -540; // UTC+9

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
  } };
  const r = leaderboardXp(state, null, now, TASHKENT);
  assert.equal(r.week, "2026-09-14");
  assert.equal(r.xp, 200 + DAY_XP_CAP);
});

test("weekly XP grows no faster than 150 per minute since the last save", () => {
  const now = Date.UTC(2026, 8, 16, 7, 0);
  const prev = { week_key: "2026-09-14", week_xp: 1000, updated_at: now - 60000 };
  const state = { act: { "2026-09-16": { xp: 4000 } } };
  assert.equal(leaderboardXp(state, prev, now, TASHKENT).xp, 1150);
  // A new week starts from zero, with allowance counted from Monday.
  const lastWeek = { week_key: "2026-09-07", week_xp: 4000, updated_at: now - 60000 };
  assert.equal(leaderboardXp(state, lastWeek, now, TASHKENT).xp, 4000);
});
