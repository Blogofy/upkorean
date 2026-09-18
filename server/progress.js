// Calendar and leaderboard rules for saved progress. Dates are the learner's local calendar days,
// so the browser sends its UTC offset (Date#getTimezoneOffset, in minutes) with each request.

// Offsets range from UTC+14 (-840) to UTC-12 (720). Without one, the server's own zone is used.
export function tzOf(value) {
  const n = Number(value);
  return value !== undefined && value !== null && value !== "" && Number.isInteger(n) && n >= -840 && n <= 720
    ? n : new Date().getTimezoneOffset();
}

const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// The learner's local clock at `now`: today's date, "HH:MM", and the local week (Monday..Sunday).
export function localTime(now, tz) {
  const local = now - tz * 60000; // UTC fields of this instant read as the learner's wall clock
  const d = new Date(local);
  const dayStartUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const mondayUtc = dayStartUtc - ((d.getUTCDay() + 6) % 7) * DAY;
  return {
    today: iso(dayStartUtc),
    hm: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    week: iso(mondayUtc),
    weekEnd: iso(mondayUtc + 6 * DAY),
    weekStartMs: mondayUtc + tz * 60000, // back to a real instant
  };
}

// Progress is computed in the browser, so the server cannot prove the XP is real. It can make faking it
// pointless for the leaderboard: no day counts for more than a very busy day of study, the weekly total
// grows no faster than a fast learner earns it (it catches up within a minute or two after a bonus), and it
// never runs ahead of the practice the saved words can show for it.
export const DAY_XP_CAP = 5000;
export const XP_PER_MIN = 150;
// Every practice path in the browser (grade / introduce / answer, js/store.js) stamps the word with today's
// date and reschedules it, so the words carrying a date from this week are the work behind the claim. Still
// the client's own word, but bounded by the 1000-word course instead of a free-form counter, and a busy day
// touches ~60 words for ~400 XP, so 25 XP a word leaves honest study far below the line.
export const XP_PER_WORD = 25;

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function leaderboardXp(state, prev, now, tz) {
  const { week, weekEnd, weekStartMs } = localTime(now, tz);
  const inWeek = (d) => isDate(d) && d >= week && d <= weekEnd;
  let claimed = 0;
  for (const [k, a] of Object.entries((state && state.act) || {})) {
    if (!inWeek(k) || !a || !Number.isFinite(a.xp)) continue;
    claimed += Math.min(Math.max(a.xp, 0), DAY_XP_CAP);
  }
  // The evidence behind the claim: how many words were practised this week. A word only drops out of the
  // count when the week itself ends, so this never takes back XP already awarded earlier in the same week.
  let practised = 0;
  for (const w of Object.values((state && state.words) || {})) {
    if (w && typeof w === "object" && (inWeek(w.last) || inWeek(w.due))) practised++;
  }
  const sameWeek = prev && prev.week_key === week;
  const base = sameWeek ? prev.week_xp : 0;
  // The budget runs from the previous save; the week start is only the floor for the first save of a week.
  // One save never unlocks more than a single very busy day, so a first save on Thursday collects no
  // back-pay for Monday to Wednesday.
  const since = prev ? Math.max(weekStartMs, prev.updated_at) : weekStartMs;
  const allowed = base + Math.min(DAY_XP_CAP, (XP_PER_MIN * Math.max(0, now - since)) / 60000);
  return { week, xp: Math.round(Math.min(claimed, allowed, practised * XP_PER_WORD)) };
}
