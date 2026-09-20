// The three levels a learner moves through, in order.
//
// `target` is the plan — 50 days of 30 words — not a claim about what is loaded. A level whose word list
// is still being written reports the days it actually has, and the app shows it locked rather than
// pretending to hold it. That way the shape of the course never has to wait on the content.
export const LEVELS = [
  { id: "b", ko: "초급", uz: "Boshlang'ich", target: { days: 50, perDay: 30 } },
  { id: "m", ko: "중급", uz: "O'rta", target: { days: 50, perDay: 30 } },
  { id: "a", ko: "고급", uz: "Yuqori", target: { days: 50, perDay: 30 } },
];

export const LEVEL_IDS = LEVELS.map((level) => level.id);
export const levelMeta = (id) => LEVELS.find((level) => level.id === id) || null;

// A word is named by where it sits: "<level>-<day>-<index>", e.g. "b-1-0". The level is part of the name
// because progress is one object for the whole account, and the same day number exists in all three.
export const wordId = (level, day, index) => `${level}-${day}-${index}`;
export const levelOfWord = (id) => String(id).split("-")[0];

export function parseWordId(id) {
  const [level, day, index] = String(id).split("-");
  const d = Number(day), i = Number(index);
  if (!LEVEL_IDS.includes(level) || !Number.isInteger(d) || !Number.isInteger(i)) return null;
  return { level, day: d, i };
}
