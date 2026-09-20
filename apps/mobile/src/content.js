// The course — 1000 words, their sentences and how each word is built — downloaded once and then read
// from the device.
//
// The web app gets this as three <script> files the service worker caches. Here the same three parts come
// from /api/content as JSON and are kept in AsyncStorage under the version the server reported. On every
// start the app asks for the manifest: same version, nothing is downloaded; new version, only the parts
// that actually changed. Offline, the stored copy is used and no request is made at all — which is the
// point, because a learner on the bus has the whole course already.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "./api";

const KEY = (part) => `uk_content_${part}`;
const VERSION_KEY = "uk_content_version";
const PARTS = ["vocab", "examples", "roots"];

let cache = null;

const read = async (part) => {
  const raw = await AsyncStorage.getItem(KEY(part));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

async function readAll() {
  const [vocab, examples, roots] = await Promise.all(PARTS.map(read));
  return vocab && examples && roots ? { vocab, examples, roots } : null;
}

async function download(part, version) {
  const data = await api.contentPart(part, version);
  await AsyncStorage.setItem(KEY(part), JSON.stringify(data));
  return data;
}

// Returns { version, words, byId, examples, roots, hanja, days, offline }.
export async function loadContent({ force = false } = {}) {
  if (cache && !force) return cache;

  const storedVersion = await AsyncStorage.getItem(VERSION_KEY);
  let stored = await readAll();

  let manifest = null;
  try {
    manifest = await api.contentManifest();
  } catch (error) {
    // No network. A stored course is a complete one, so use it; with nothing stored there is nothing to do
    // but say so.
    if (!stored) throw error;
  }

  if (manifest && manifest.version !== storedVersion) {
    const fresh = {};
    for (const part of PARTS) {
      // A part whose own payload already carries the new version was downloaded by an interrupted update.
      fresh[part] = stored && stored[part] && stored[part].version === manifest.version
        ? stored[part]
        : await download(part, manifest.version);
    }
    await AsyncStorage.setItem(VERSION_KEY, manifest.version);
    stored = fresh;
  }

  const words = stored.vocab.words || [];
  const byId = Object.fromEntries(words.map((w) => [w.id, w]));
  const examples = Object.fromEntries((stored.examples.examples || []).map((e) => [e.id, e]));

  cache = {
    version: stored.vocab.version,
    offline: !manifest,
    days: stored.vocab.days || 0,
    words,
    byId,
    examples,
    roots: stored.roots.roots || {},
    hanja: stored.roots.hanja || {},
    // Day numbers start at 1, so index 0 stays empty and dayWords[3] really is day 3.
    dayWords: words.reduce((days, w) => { (days[w.day] ||= []).push(w); return days; }, []),
  };
  return cache;
}

export async function clearContent() {
  cache = null;
  await AsyncStorage.multiRemove([VERSION_KEY, ...PARTS.map(KEY)]);
}
