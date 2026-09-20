// Turning a level's three raw files into the shape every screen reads.
//
// The data files know nothing about levels: a day list, a sentence per word, a breakdown per word, all
// keyed "<day>-<index>". The level is added here, so the same file could be any level and a word carries
// its level in its name wherever it travels — including into saved progress.
import { levelMeta, wordId } from "./levels.js";

const reKey = (level, localId) => `${level}-${localId}`;

// { vocab: [[ [ko, uz], … ] per day ], examples: [{ id, ko, uz, cloze?, note? }], roots: { "<day>-<i>": {…} } }
export function buildLevel(id, { vocab = [], examples = [], roots = {} } = {}) {
  const meta = levelMeta(id);
  if (!meta) throw new Error(`Noma'lum daraja: ${id}`);

  const words = [];
  vocab.forEach((day, di) => day.forEach(([ko, uz], i) => {
    words.push({ id: wordId(id, di + 1, i), level: id, day: di + 1, i, ko, uz });
  }));

  const byId = {};
  for (const word of words) byId[word.id] = word;

  // Day numbers start at 1, so index 0 stays empty and days[3] really is day 3.
  const days = [];
  for (const word of words) (days[word.day] ||= []).push(word);

  const exampleById = {};
  for (const example of examples) exampleById[reKey(id, example.id)] = { ...example, id: reKey(id, example.id) };

  const rootsById = {};
  for (const [localId, entry] of Object.entries(roots)) rootsById[reKey(id, localId)] = entry;

  // Every word that contains a given hanja, so a card can show where else the piece turns up.
  const hanjaWords = new Map();
  for (const [wid, entry] of Object.entries(rootsById)) {
    for (const part of entry.parts || []) {
      if (part.h) hanjaWords.set(part.h, [...(hanjaWords.get(part.h) || []), wid]);
    }
  }

  return {
    ...meta,
    words,
    byId,
    days,
    dayCount: Math.max(0, days.length - 1),
    examples: exampleById,
    roots: rootsById,
    hanjaWords,
  };
}

// What the API sends and the app stores: plain JSON, no Maps, in the order a screen wants it.
export const levelPayload = (level) => ({
  id: level.id,
  ko: level.ko,
  uz: level.uz,
  days: level.dayCount,
  count: level.words.length,
  words: level.words,
});

export const examplesPayload = (level) => ({
  id: level.id,
  count: Object.keys(level.examples).length,
  examples: Object.values(level.examples),
});

export const rootsPayload = (level) => ({
  id: level.id,
  roots: level.roots,
});
