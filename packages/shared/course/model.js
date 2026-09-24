// Turning a level's raw files into the shape every screen reads.
//
// vocab.js is a list of parts, ten words each, { g, t, w: [[nid, ko, uz], …] }, in the order they are taught;
// examples.js is one sentence per word, keyed by nid. Here the parts are grouped into lessons — one day of
// the level's standard each (levels.js) — and the level is added to every name, so a word carries it
// wherever it travels, including into saved progress.
import { levelMeta, lessonId, partsPerLesson, wordId } from "./levels.js";

export function buildLevel(id, { vocab = [], examples = [] } = {}) {
  const meta = levelMeta(id);
  if (!meta) throw new Error(`Noma'lum daraja: ${id}`);
  const size = partsPerLesson(id);

  const words = [];
  // Lesson numbers start at 1, so index 0 stays empty and lessons[3] really is lesson 3.
  const lessons = [null];
  vocab.forEach(({ g, t, w }, pi) => {
    const n = Math.floor(pi / size) + 1;
    const part = pi % size;
    const lesson = lessons[n] || (lessons[n] = { id: lessonId(id, n), n, grade: g, themes: [], parts: [], ids: [] });
    lesson.grade = Math.min(lesson.grade, g);
    if (t && !lesson.themes.includes(t)) lesson.themes.push(t);
    const ids = w.map(([nid, ko, uz], i) => {
      const word = { id: wordId(id, nid), level: id, lesson: n, part, i: lesson.ids.length + i, grade: g, ko, uz };
      words.push(word);
      return word.id;
    });
    lesson.parts.push(ids);
    lesson.ids.push(...ids);
  });

  const byId = {};
  for (const word of words) byId[word.id] = word;
  for (const lesson of lessons.slice(1)) {
    lesson.theme = lesson.themes.slice(0, 2).join(" · ");
    delete lesson.themes;
    lesson.title = lessonTitle(lesson, byId);
  }

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

// A lesson's name: its themes when it has them, otherwise the three shortest one-word meanings it teaches —
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

// What the API sends and the app stores: plain JSON, in the order a screen wants it. A word carries its
// lesson and its part in that lesson, so the app can rebuild both. `clips` says which words have narrator
// audio yet — { words: Set, sentences: Set } of word ids — so the app only offers the buttons and the
// listening questions that will actually make a sound.
export const levelPayload = (level, clips = { words: new Set(), sentences: new Set() }) => ({
  id: level.id,
  ko: level.ko,
  uz: level.uz,
  lessons: level.lessons.slice(1).map(({ id, n, grade, theme, title, parts }) => ({ id, n, grade, theme, title, parts: parts.length })),
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
