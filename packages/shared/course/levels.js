// The three levels a learner moves through, in order, and the NIKL grades each one is made of.
//
// `planned` is every word of those grades — the plan, not a claim about what is loaded. A level is published
// lesson by lesson as its translations are finished; the app shows what is there and says the rest is
// coming. That way the shape of the course never has to wait on the content.
export const LEVELS = [
  { id: "b", ko: "초급", uz: "Boshlang'ich", grades: [1, 2], planned: 1835 },
  { id: "m", ko: "중급", uz: "O'rta", grades: [3, 4], planned: 3855 },
  { id: "a", ko: "고급", uz: "Yuqori", grades: [5, 6], planned: 4945 },
];

export const LEVEL_IDS = LEVELS.map((level) => level.id);
export const levelMeta = (id) => LEVELS.find((level) => level.id === id) || null;

// A word is named by its level and its number in the NIKL graded list: "b-36" is 것. The number never
// changes, so a word keeps its progress and its audio however the lessons are rearranged. The level is part
// of the name because progress is one object for the whole account.
export const wordId = (level, nid) => `${level}-${nid}`;
export const levelOfWord = (id) => String(id).split("-")[0];

export function parseWordId(id) {
  const [level, nid, extra] = String(id).split("-");
  const n = Number(nid);
  if (extra !== undefined || !LEVEL_IDS.includes(level) || !Number.isInteger(n) || n < 1) return null;
  return { level, nid: n };
}

// A lesson is named the same way — "b-12" is the twelfth lesson of 초급 — so the lessons of all three levels
// share one map in the progress object.
export const lessonId = (level, n) => `${level}-${n}`;
