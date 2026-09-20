// The importable face of this package. sync.js is written for a plain <script> tag, because the web app
// loads it that way; here it is imported for its side effect and its three functions are re-exported, so
// the mobile app and Node tests can `import { mergeStates } from "@upkorean/shared"` instead of reaching
// into a global. The course data (vocab, examples, roots) is not exported: it is 383 KB that only the
// server reads, and the apps fetch it from /api/content.
import "./sync.js";

export const { diffState, applyChanges, mergeStates } = globalThis.UKSync;
