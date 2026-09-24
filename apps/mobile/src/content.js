// The course on the device: three levels, each downloaded once and then read from storage.
//
// A level is a path of words in parts of ten, grouped into lessons of thirty (packages/shared/course/model.js
// builds the same shape on the server); `parts[n]` is part n and `lessons[n]` lesson n, so index 0 stays empty. A day's lesson is read off this path (srs.todayLesson).
//
// On every start the app asks for the manifest and compares versions. Same version, nothing is
// downloaded; new version, only the parts that actually changed. Offline, the stored copy is used and no
// request is made at all — which is the point, because a learner on the bus already has the whole level.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { groupLessons } from "@upkorean/shared/course/model.js";

import { api } from "./api";

const PARTS = ["vocab", "examples"];
const partKey = (level, part) => `uk_content_${level}_${part}`;
const VERSION_KEY = (level) => `uk_content_version_${level}`;
const MANIFEST_KEY = "uk_content_manifest";

const cache = new Map();

const readJson = async (key) => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

// What levels exist, how big each one is, and which are still locked. Kept on the device so the level
// picker and the home screen have something to show before the network answers.
export async function loadManifest({ force = false } = {}) {
  const stored = force ? null : await readJson(MANIFEST_KEY);
  try {
    const fresh = await api.contentManifest();
    await AsyncStorage.setItem(MANIFEST_KEY, JSON.stringify(fresh));
    return { ...fresh, offline: false };
  } catch (error) {
    if (stored) return { ...stored, offline: true };
    throw error;
  }
}

async function downloadPart(level, part, version) {
  const data = await api.contentPart(level, part, version);
  await AsyncStorage.setItem(partKey(level, part), JSON.stringify(data));
  return data;
}

function assemble(levelId, stored, offline) {
  const words = stored.vocab.words || [];
  const byId = Object.fromEntries(words.map((word) => [word.id, word]));
  const examples = Object.fromEntries((stored.examples.examples || []).map((example) => [example.id, example]));
  const parts = [null];
  for (const part of stored.vocab.parts || []) parts[part.n] = { ...part, ids: [] };
  for (const word of words) parts[word.part]?.ids.push(word.id);
  // Parts come in order from the server, so the gaps a sparse array could leave never happen.
  const lessons = groupLessons(parts, byId);
  for (const word of words) word.lesson = parts[word.part]?.lesson || 1;
  return {
    level: levelId,
    version: stored.vocab.version,
    offline,
    partCount: parts.length - 1,
    words,
    byId,
    examples,
    parts,
    lessons,
    lessonCount: lessons.length - 1,
    word: (id) => byId[id] || null,
    example: (id) => examples[id] || null,
    partWords: (n) => (parts[n]?.ids || []).map((id) => byId[id]),
  };
}

// Returns the level ready to be read from, or throws when it is neither downloadable nor stored.
export async function loadLevel(levelId, { force = false } = {}) {
  if (!force && cache.has(levelId)) return cache.get(levelId);

  const storedVersion = await AsyncStorage.getItem(VERSION_KEY(levelId));
  const parts = await Promise.all(PARTS.map((part) => readJson(partKey(levelId, part))));
  let stored = parts.every(Boolean) ? Object.fromEntries(PARTS.map((part, i) => [part, parts[i]])) : null;

  let manifest = null;
  try {
    manifest = await api.contentManifest();
  } catch (error) {
    // No network. A stored level is a complete one, so use it; with nothing stored there is nothing to
    // do but say so.
    if (!stored) throw error;
  }

  if (manifest) {
    const level = manifest.levels.find((l) => l.id === levelId);
    if (!level) throw new Error(`Bunday daraja yo'q: ${levelId}`);
    if (level.locked) throw new Error(`${level.ko} darajasi hali tayyor emas`);
    if (level.version !== storedVersion && manifest.version !== storedVersion) {
      const fresh = {};
      for (const part of PARTS) {
        // A part whose payload already carries the new version was downloaded by an interrupted update.
        fresh[part] = stored?.[part]?.version === manifest.version
          ? stored[part]
          : await downloadPart(levelId, part, manifest.version);
      }
      await AsyncStorage.setItem(VERSION_KEY(levelId), manifest.version);
      stored = fresh;
    }
  }

  const built = assemble(levelId, stored, !manifest);
  cache.set(levelId, built);
  return built;
}

export async function clearContent() {
  cache.clear();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith("uk_content")));
}
