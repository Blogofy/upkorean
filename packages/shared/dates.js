// Calendar days as "YYYY-MM-DD" in the learner's own timezone, and the Uzbek words for them.
//
// Everything the schedule does is counted in local calendar days, never in hours: a word due "tomorrow" is
// due when the learner's date changes, whatever time zone they woke up in. Storing the key rather than a
// timestamp is what makes that true, and it is why a progress file survives a flight.
const pad = (n) => String(n).padStart(2, "0");

export const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const today = () => dateKey(new Date());
export const parseKey = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const date = parseKey(key);
  date.setDate(date.getDate() + n);
  return dateKey(date);
};
// b - a, in whole days. Done in UTC so an hour lost to daylight saving cannot round a day away.
export function diffDays(a, b) {
  const [ay, am, ad] = String(a).split("-").map(Number);
  const [by, bm, bd] = String(b).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
export const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
export const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
export const WEEK_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]; // Monday first, as the week grid is drawn

export const fmtLong = (key) => {
  const date = parseKey(key);
  return `${date.getDate()}-${MONTHS[date.getMonth()]}, ${WEEKDAYS[date.getDay()]}`;
};
export const fmtDayMonth = (key) => {
  const date = parseKey(key);
  return `${date.getDate()}-${MONTHS[date.getMonth()]}`;
};
export const fmtShort = (key) => {
  const date = parseKey(key);
  return `${date.getDate()}-${MONTHS_SHORT[date.getMonth()]}`;
};
// Monday of the week the key falls in.
export const weekStart = (key) => addDays(key, (parseKey(key).getDay() + 6) % 7 * -1);

export function ago(key, now = today()) {
  if (!key) return "—";
  const n = diffDays(key, now);
  if (n <= 0) return "bugun";
  if (n === 1) return "kecha";
  return `${n} kun oldin`;
}

export function dueLabel(key, now = today()) {
  const n = diffDays(now, key);
  if (n < 0) return "kechikkan";
  if (n === 0) return "bugun";
  if (n === 1) return "ertaga";
  return `${n} kun`;
}

// "3 kundan keyin", the phrase the word card uses for the next review.
export const inDays = (n) => (n <= 0 ? "bugun" : n === 1 ? "ertaga" : `${n} kundan keyin`);
