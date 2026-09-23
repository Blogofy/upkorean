// Hangul: reading it out loud in Latin letters, and typing it on the app's own keyboard.
//
// The keyboard has to live here rather than in a screen because a syllable is not a letter. 학 is built
// from three taps and comes apart again in one, so the text field cannot simply append and trim: every tap
// re-forms the last syllable. That automaton is what compose() and backspace() are.

// ---------- Jamo tables ----------
const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const JUNG = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

const BASE = 0xac00;
const LAST = 0xd7a3;

const isSyllable = (ch) => { const c = ch.charCodeAt(0); return c >= BASE && c <= LAST; };
const isVowel = (jamo) => JUNG.includes(jamo);
const isConsonant = (jamo) => CHO.includes(jamo) || JONG.includes(jamo);

function split(ch) {
  const offset = ch.charCodeAt(0) - BASE;
  return { cho: Math.floor(offset / 588), jung: Math.floor((offset % 588) / 28), jong: offset % 28 };
}
const join = ({ cho, jung, jong }) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong);

// Vowels that are two taps, and the final clusters that are two.
const VOWEL_PAIRS = { "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅡㅣ": "ㅢ" };
const JONG_PAIRS = { "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ", "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ", "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ" };
// Undoing one of those with backspace, and splitting one when the second half turns out to start a syllable.
const SPLIT_JONG = Object.fromEntries(Object.entries(JONG_PAIRS).map(([pair, one]) => [one, [pair[0], pair[1]]]));
const SPLIT_VOWEL = Object.fromEntries(Object.entries(VOWEL_PAIRS).map(([pair, one]) => [one, [pair[0], pair[1]]]));

// The two-set layout the keyboard draws, in rows, plus what the shift key turns each key into.
export const KEYS = [
  ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
  ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
  ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
];
export const SHIFTED = { "ㅂ": "ㅃ", "ㅈ": "ㅉ", "ㄷ": "ㄸ", "ㄱ": "ㄲ", "ㅅ": "ㅆ", "ㅐ": "ㅒ", "ㅔ": "ㅖ" };
export const shiftKey = (key, on) => (on && SHIFTED[key] ? SHIFTED[key] : key);

// ---------- The typing automaton ----------
// Adds one jamo to the end of `text`, re-forming the last syllable rather than appending a letter.
export function compose(text, jamo) {
  const chars = [...String(text)];
  const last = chars[chars.length - 1];
  const head = chars.slice(0, -1).join("");

  if (last === undefined) return isVowel(jamo) ? jamo : jamo;

  if (isSyllable(last)) {
    const { cho, jung, jong } = split(last);
    if (isVowel(jamo)) {
      if (jong === 0) {
        // 가 + ㅏ cannot merge, so the vowel starts a syllable of its own.
        const pair = VOWEL_PAIRS[JUNG[jung] + jamo];
        if (pair) return head + join({ cho, jung: JUNG.indexOf(pair), jong: 0 });
        return text + jamo;
      }
      // 학 + ㅐ → 하 + 캐: the final consonant moves across to start the new syllable.
      const cluster = SPLIT_JONG[JONG[jong]];
      const moved = cluster ? cluster[1] : JONG[jong];
      const kept = cluster ? JONG.indexOf(cluster[0]) : 0;
      return head + join({ cho, jung, jong: kept }) + join({ cho: CHO.indexOf(moved), jung: JUNG.indexOf(jamo), jong: 0 });
    }
    if (jong === 0) {
      const index = JONG.indexOf(jamo);
      return index > 0 ? head + join({ cho, jung, jong: index }) : text + jamo;
    }
    const pair = JONG_PAIRS[JONG[jong] + jamo];
    if (pair) return head + join({ cho, jung, jong: JONG.indexOf(pair) });
    return text + jamo;
  }

  // The last character is a bare jamo: a consonant then a vowel makes the first syllable.
  if (isConsonant(last) && isVowel(jamo) && CHO.includes(last)) {
    return head + join({ cho: CHO.indexOf(last), jung: JUNG.indexOf(jamo), jong: 0 });
  }
  if (isVowel(last) && isVowel(jamo)) {
    const pair = VOWEL_PAIRS[last + jamo];
    if (pair) return head + pair;
  }
  return text + jamo;
}

// Removes one tap, not one character: 학 goes back to 하, and 하 to ㅎ.
export function backspace(text) {
  const chars = [...String(text)];
  const last = chars[chars.length - 1];
  if (last === undefined) return "";
  const head = chars.slice(0, -1).join("");
  if (!isSyllable(last)) {
    const vowel = SPLIT_VOWEL[last];
    if (vowel) return head + vowel[0];
    return head;
  }
  const { cho, jung, jong } = split(last);
  if (jong) {
    const cluster = SPLIT_JONG[JONG[jong]];
    return head + join({ cho, jung, jong: cluster ? JONG.indexOf(cluster[0]) : 0 });
  }
  const vowel = SPLIT_VOWEL[JUNG[jung]];
  if (vowel) return head + join({ cho, jung: JUNG.indexOf(vowel[0]), jong: 0 });
  return head + CHO[cho];
}

// The first tap of a word, which is what the typing question offers as a hint.
export function firstJamo(text) {
  const first = [...String(text)][0];
  if (!first) return "";
  return isSyllable(first) ? CHO[split(first).cho] : first;
}

// ---------- Reading it out loud ----------
// Revised Romanization, simplified: enough to read a card, not a transliteration standard. The liaison and
// assimilation rules below are why 학교 reads "hak-gyo" and 좋아 reads "joa" rather than letter by letter.
const INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOW = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
// final index -> [sound before a consonant or at the end, the jamo that moves on liaison (initial index) or null]
const FIN = [
  ["", null], ["k", 0], ["k", 1], ["k", 9], ["n", 2], ["n", 12], ["n", 18], ["t", 3], ["l", 5], ["k", 0],
  ["m", 6], ["l", 7], ["l", 9], ["l", 16], ["p", 17], ["l", 18], ["m", 6], ["p", 7], ["p", 9], ["t", 9],
  ["t", 10], ["ng", null], ["t", 12], ["t", 14], ["k", 15], ["t", 16], ["p", 17], ["t", 18],
];
// For a cluster final, what stays behind when its second half moves on.
const FIN_KEEP = { 3: "k", 5: "n", 6: "n", 9: "l", 10: "l", 11: "l", 12: "l", 13: "l", 14: "l", 15: "l", 18: "p" };
const K_CLASS = new Set([1, 2, 3, 9, 24]);
const T_CLASS = new Set([7, 19, 20, 22, 23, 25, 27]);
const P_CLASS = new Set([17, 18, 26, 14]);

// The work is done one syllable at a time and the pieces kept apart, because both readings the app shows
// are built from them: run together for a sentence, hyphenated for a card. A consonant carried across by
// liaison lands in the next piece, which is also where a reader expects to see it — 좋아 is "jo-a".
function pieces(text) {
  const syl = [];
  for (const ch of String(text)) syl.push(isSyllable(ch) ? split(ch) : { raw: ch });
  const out = [];
  for (let k = 0; k < syl.length; k++) {
    const s = syl[k];
    if (s.raw !== undefined) { out.push({ raw: true, text: s.raw === "/" ? " / " : s.raw }); continue; }
    let piece = (s.ini !== undefined ? s.ini : INI[s.cho]) + VOW[s.jung];
    const f = s.jong;
    const next = syl[k + 1] && syl[k + 1].raw === undefined ? syl[k + 1] : null;
    if (f) {
      if (!next) piece += FIN[f][0];
      else {
        const ni = next.cho;
        let handled = false;
        if (ni === 11 && FIN[f][1] !== null) { // liaison into ㅇ
          handled = true;
          if (f === 27) next.ini = "";          // ㅎ drops: 좋아 → joa
          else if (f === 6) next.ini = "n";     // ㄶ: 많아 → mana
          else if (f === 15) next.ini = "r";    // ㅀ: 싫어 → sireo
          else {
            const moved = FIN[f][1];
            piece += FIN_KEEP[f] || "";
            next.ini = f === 8 ? "r" : moved === 5 ? "r" : INI[moved];
          }
        } else if (f === 27 && (ni === 0 || ni === 3 || ni === 12)) {
          handled = true;
          next.ini = ni === 0 ? "k" : ni === 3 ? "t" : "ch";
        } else if (ni === 2 || ni === 6) { // nasalization before ㄴ ㅁ
          if (K_CLASS.has(f)) { piece += "ng"; handled = true; }
          else if (T_CLASS.has(f)) { piece += "n"; handled = true; }
          else if (P_CLASS.has(f)) { piece += "m"; handled = true; }
          else if (f === 8 && ni === 2) { piece += "l"; next.ini = "l"; handled = true; }
        } else if (ni === 5) { // before ㄹ
          if (f === 8 || f === 4) { piece += "l"; next.ini = "l"; handled = true; }
          else if (f === 16 || f === 21) { piece += FIN[f][0]; next.ini = "n"; handled = true; }
          // A stop before ㄹ turns nasal and takes the ㄹ with it: 독립 is read "dongnip".
          else if (K_CLASS.has(f)) { piece += "ng"; next.ini = "n"; handled = true; }
          else if (T_CLASS.has(f)) { piece += "n"; next.ini = "n"; handled = true; }
          else if (P_CLASS.has(f)) { piece += "m"; next.ini = "n"; handled = true; }
        }
        if (!handled) piece += FIN[f][0];
      }
    }
    out.push({ raw: false, text: piece });
  }
  return out;
}

export function romanize(text) {
  return pieces(text).map((piece) => piece.text).join("").replace(/\s+/g, " ").trim();
}

// "hak-gyo" — one group per syllable, which is how a card shows a reading.
export function syllableReading(text) {
  return pieces(text).filter((piece) => !piece.raw && piece.text).map((piece) => piece.text).join("-");
}
