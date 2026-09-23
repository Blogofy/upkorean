// The importable face of this package. sync.js still assigns its functions to a global — that shape
// outlived the browser app it was written for — so it is imported for the side effect and re-exported
// here, and everything else can `import { mergeStates } from "@upkorean/shared"` without reaching into
// a global. The course data is not exported: it is megabytes the apps never hold, and they fetch what
// they need from /api/content.
import "./sync.js";

export const { diffState, applyChanges, mergeStates } = globalThis.UKSync;
export { LEVELS, LEVEL_IDS, levelMeta, wordId, levelOfWord, parseWordId } from "./course/levels.js";
export * as dates from "./dates.js";
export * as srs from "./srs.js";
export * as exercise from "./exercise.js";
export * as hangul from "./hangul.js";
