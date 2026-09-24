// Turning a level's raw files into the shape every screen reads.
//
// vocab.js is the level's path as a list of parts, ten words each, { g, t, w: [[nid, ko, uz], …] }, in the
// order they are taught; examples.js is one sentence per word, keyed by nid. The level is added to every
// name here, so a word carries it wherever it travels, including into saved progress. A day's lesson is not
// stored anywhere: it is the next words of this path (srs.todayLesson).
import { LESSON_PARTS, levelMeta, partId, wordId } from "./levels.js";

export function buildLevel(id, { vocab = [], examples = [] } = {}) {
  const meta = levelMeta(id);
  if (!meta) throw new Error(`Noma'lum daraja: ${id}`);

  const words = [];
  // Part numbers start at 1, so index 0 stays empty and parts[3] really is part 3.
  const parts = [null];
  vocab.forEach(({ g, t, w }, pi) => {
    const n = pi + 1;
    const ids = w.map(([nid, ko, uz], i) => {
      const word = { id: wordId(id, nid), level: id, part: n, i, grade: g, ko, uz };
      words.push(word);
      return word.id;
    });
    parts.push({ id: partId(id, n), n, grade: g, theme: t || "", ids });
  });

  const byId = {};
  for (const word of words) byId[word.id] = word;
  for (const part of parts.slice(1)) part.title = partTitle(part, byId);
  const lessons = groupLessons(parts, byId);
  for (const word of words) word.lesson = parts[word.part].lesson;

  const exampleById = {};
  for (const example of examples) {
    const key = wordId(id, example.id);
    if (byId[key]) exampleById[key] = { ...example, id: key };
  }

  return {
    ...meta,
    words,
    byId,
    parts,
    partCount: parts.length - 1,
    lessons,
    lessonCount: lessons.length - 1,
    examples: exampleById,
  };
}

// The parts grouped into lessons, LESSON_PARTS at a time inside each grade; a single part left over at a
// grade's end joins the lesson before it rather than stand as a lesson of ten. Like parts, lessons[n] is
// lesson n. Each part is told its lesson (part.lesson) and its place in it (part.section, from 1).
export function groupLessons(parts, byId) {
  const lessons = [null];
  let group = [];
  const close = () => {
    if (!group.length) return;
    const last = lessons[lessons.length - 1];
    if (group.length === 1 && last && last.grade === group[0].grade && lessons.length > 1) last.parts.push(group[0]);
    else lessons.push({ n: lessons.length, grade: group[0].grade, parts: group });
    group = [];
  };
  for (const part of parts.slice(1)) {
    if (group.length && (group[0].grade !== part.grade || group.length === LESSON_PARTS)) close();
    group.push(part);
  }
  close();
  return lessons.map((lesson) => {
    if (!lesson) return null;
    lesson.parts.forEach((part, i) => { part.lesson = lesson.n; part.section = i + 1; });
    return {
      n: lesson.n,
      grade: lesson.grade,
      parts: lesson.parts.map((part) => part.n),
      ids: lesson.parts.flatMap((part) => part.ids),
      title: lessonTitle(lesson.parts, byId),
      themes: [...new Set(lesson.parts.map((part) => part.theme).filter(Boolean))],
    };
  });
}

// A lesson's name: its first three one-word meanings, the most frequent words it teaches — "Narsa, qilmoq,
// o'sha". Themes repeat across lessons (several teach ordering food), so they go beside the name, not in it.
function lessonTitle(parts, byId) {
  const words = parts.flatMap((part) => part.ids).map((id) => byId[id]?.uz || "");
  const picks = words.map((uz) => String(uz).split(/[,;/(]/)[0].trim()).filter((uz) => uz && !/\s/.test(uz) && !/^[.…]/.test(uz)).slice(0, 3);
  const title = picks.join(", ");
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : "";
}

// A part's name: its theme when it has one, otherwise the three shortest one-word meanings it teaches —
// "Narsa, biz, odam" says more about part 1 than a number does.
export function partTitle(part, byId) {
  if (part.theme) return part.theme;
  const picks = part.ids
    .map((id) => String(byId[id]?.uz || "").split(/[,;/(]/)[0].trim())
    .filter((uz) => uz && !/\s/.test(uz))
    .sort((a, b) => a.length - b.length)
    .slice(0, 3);
  const title = picks.join(", ");
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : `${part.n}-qism`;
}

// What the API sends and the app stores: plain JSON, in the order a screen wants it. `clips` says which
// words have narrator audio yet — { words: Set, sentences: Set } of word ids — so the app only offers the
// buttons and the listening questions that will actually make a sound.
export const levelPayload = (level, clips = { words: new Set(), sentences: new Set() }) => ({
  id: level.id,
  ko: level.ko,
  uz: level.uz,
  parts: level.parts.slice(1).map(({ id, n, grade, theme, title }) => ({ id, n, grade, theme, title })),
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
