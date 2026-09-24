// The three levels a learner moves through, in order, and the NIKL grades each one is made of.
//
// `planned` is every word of those grades — the plan, not a claim about what is loaded. A level is published
// part by part as its translations are finished; the app shows what is there and says the rest is coming.
// That way the shape of the course never has to wait on the content.
//
// `daily` is the level's daily standard as a range. A learner starts a level at `from` new words a day, and
// the app raises it by DAILY_STEP while their reviews show the words are staying, up to `to` (srs.adjustDaily).
// A beginner's words are all new; higher up most of them lean on words already known, so the day can carry
// more.
//
// The words themselves come in parts of PART_SIZE (vocab/plan.tsv cuts them so): one sitting, one theme. A
// day's lesson is the next so many words of that path, taken a part at a time with a break allowed between.
export const PART_SIZE = 10;
export const DAILY_STEP = 5;
export const LEVELS = [
  { id: "b", ko: "초급", uz: "Boshlang'ich", grades: [1, 2], planned: 1835, daily: { from: 20, to: 35 } },
  { id: "m", ko: "중급", uz: "O'rta", grades: [3, 4], planned: 3855, daily: { from: 35, to: 50 } },
  { id: "a", ko: "고급", uz: "Yuqori", grades: [5, 6], planned: 4945, daily: { from: 50, to: 50 } },
];

export const LEVEL_IDS = LEVELS.map((level) => level.id);
export const levelMeta = (id) => LEVELS.find((level) => level.id === id) || null;

// A word is named by its level and its number in the NIKL graded list: "b-36" is 것. The number never
// changes, so a word keeps its progress and its audio however the parts are rearranged. The level is part of
// the name because progress is one object for the whole account.
export const wordId = (level, nid) => `${level}-${nid}`;
export const levelOfWord = (id) => String(id).split("-")[0];

export function parseWordId(id) {
  const [level, nid, extra] = String(id).split("-");
  const n = Number(nid);
  if (extra !== undefined || !LEVEL_IDS.includes(level) || !Number.isInteger(n) || n < 1) return null;
  return { level, nid: n };
}

// A part is named the same way — "b-12" is the twelfth part of 초급.
export const partId = (level, n) => `${level}-${n}`;
