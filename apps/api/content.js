// The course itself as JSON: 30 days of vocabulary, one book sentence per word, and how each word is built.
//
// The browser loads packages/shared/*.js as plain <script>s and reads the window.UK_* globals they set. A
// native app has no <script> tag, so the same three files are read here — once, at startup — and served as
// JSON under one version string. A device downloads each part once and afterwards only asks whether the
// version changed, which is why the payloads must stay byte-identical between requests.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SHARED_DIR } from "./paths.js";

// The shared files assign to `window`, so on the server that name is pointed at this realm's global
// object for the length of the three imports and then taken away again: a lasting `window` would make
// every library that feature-detects one believe it is running in a browser.
const FILES = ["vocab.js", "examples.js", "roots.js"];
const hadWindow = "window" in globalThis;
if (!hadWindow) globalThis.window = globalThis;
// pathToFileURL, not the bare path: on Windows "D:\..." is not a URL the ESM loader accepts.
for (const file of FILES) await import(pathToFileURL(path.join(SHARED_DIR, file)).href);
if (!hadWindow) delete globalThis.window;

// Named for the source files, so a content edit changes the version and every device refetches.
export const VERSION = crypto
  .createHash("sha1")
  .update(FILES.map((f) => fs.readFileSync(path.join(SHARED_DIR, f))).join("\n"))
  .digest("hex")
  .slice(0, 12);

const vocab = globalThis.UK_VOCAB || [];
const examples = globalThis.UK_EXAMPLES || [];

// Flat and already keyed, because that is what every screen needs: the app never has to rebuild ids the
// way store.js does in the browser, and a word's id is the same string on both platforms ("<day>-<index>").
const words = vocab.flatMap((day, di) => day.map(([ko, uz], i) => ({ id: `${di + 1}-${i}`, day: di + 1, i, ko, uz })));

const PARTS = {
  vocab: { days: vocab.length, count: words.length, words },
  examples: { count: examples.length, examples },
  roots: { roots: globalThis.UK_ROOTS || {}, hanja: globalThis.UK_HANJA || {}, suffix: globalThis.UK_SUFFIX || {} },
};

// Serialised once. These are 100–400 KB each and never change while the process runs.
const BODIES = Object.fromEntries(
  Object.entries(PARTS).map(([name, data]) => [name, JSON.stringify({ version: VERSION, ...data })]),
);

export const partNames = Object.keys(PARTS);
export const partBody = (name) => BODIES[name] || null;

export const manifest = () => ({
  version: VERSION,
  days: vocab.length,
  words: words.length,
  parts: partNames.map((name) => ({
    name,
    url: `/api/content/${name}?v=${VERSION}`,
    bytes: Buffer.byteLength(BODIES[name]),
  })),
});
