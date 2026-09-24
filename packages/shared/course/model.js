// Turning a level's raw files into the shape every screen reads.
//
// vocab.js is a list of lessons, each { g, t, w: [[nid, ko, uz], …] }; examples.js is one sentence per word,
// keyed by nid. The level is added here, so a word carries it in its name wherever it travels — including
// into saved progress.
import { levelMeta, lessonId, wordId } from "./levels.js";

export function buildLevel(id, { vocab = [], examples = [] } = {}) {
  const meta = levelMeta(id);
  if (!meta) throw new Error(`Noma'lum daraja: ${id}`);

  const words = [];
  // Lesson numbers start at 1, so index 0 stays empty and lessons[3] really is lesson 3.
  const lessons = [null];
  vocab.forEach(({ g, t, w }, li) => {
    const n = li + 1;
    const ids = w.map(([nid, ko, uz], i) => {
      const word = { id: wordId(id, nid), level: id, lesson: n, i, grade: g, ko, uz };
      words.push(word);
      return word.id;
    });
    lessons.push({ id: lessonId(id, n), n, grade: g, theme: t || "", ids });
  });

  const byId = {};
  for (const word of words) byId[word.id] = word;
  for (const lesson of lessons.slice(1)) lesson.title = lessonTitle(lesson, byId);

  const exampleById = {};
  for (const example of examples) {
    const key = wordId(id, example.id);
    if (byId[key]) exampleById[key] = { ...example, id: key };
  }

  return {
    ...meta,
    words,
    byId,
    lessons,
    lessonCount: lessons.length - 1,
    examples: exampleById,
  };
}

// A lesson's name: its theme when it has one, otherwise the three shortest one-word meanings it teaches —
// "Narsa, biz, odam" says more about lesson 1 than a number does.
export function lessonTitle(lesson, byId) {
  if (lesson.theme) return lesson.theme;
  const picks = lesson.ids
    .map((id) => String(byId[id]?.uz || "").split(/[,;/(]/)[0].trim())
    .filter((uz) => uz && !/\s/.test(uz))
    .sort((a, b) => a.length - b.length)
    .slice(0, 3);
  const title = picks.join(", ");
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : `${lesson.n}-dars`;
}

// What the API sends and the app stores: plain JSON, in the order a screen wants it. `clips` says which
// words have narrator audio yet — { words: Set, sentences: Set } of word ids — so the app only offers the
// buttons and the listening questions that will actually make a sound.
export const levelPayload = (level, clips = { words: new Set(), sentences: new Set() }) => ({
  id: level.id,
  ko: level.ko,
  uz: level.uz,
  lessons: level.lessons.slice(1).map(({ id, n, grade, theme, title }) => ({ id, n, grade, theme, title })),
  count: level.words.length,
  words: level.words.map((word) => ({
    ...word,
    ...(clips.words.has(word.id) ? { aw: 1 } : {}),
    ...(clips.sentences.has(word.id) ? { as: 1 } : {}),
  })),
});

export const examplesPayload = (level) => ({
  id: level.id,
  count: Object.keys(level.examples).length,
  examples: Object.values(level.examples),
});
