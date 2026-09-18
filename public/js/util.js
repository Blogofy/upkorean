// Shared helpers: escaping, dates (Uzbek), numbers, randomness, Hangul romanization, speech, toast & modal.
(function () {
  const U = {};

  U.esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // ---------- Dates (local calendar days as YYYY-MM-DD) ----------
  const pad = (n) => String(n).padStart(2, "0");
  U.dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.today = () => U.dateKey(new Date());
  U.parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  U.addDays = (key, n) => { const d = U.parseKey(key); d.setDate(d.getDate() + n); return U.dateKey(d); };
  U.diffDays = (a, b) => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86400000); // b - a
  function ymd(k) { const [y, m, d] = k.split("-").map(Number); return [y, m - 1, d]; }

  const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
  const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
  U.WEEK_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]; // Monday first
  U.fmtLong = (key) => { const d = U.parseKey(key); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}-${MONTHS[d.getMonth()]}`; };
  U.fmtDayMonth = (key) => { const d = U.parseKey(key); return `${d.getDate()}-${MONTHS[d.getMonth()]}`; };
  U.fmtShort = (key) => { const d = U.parseKey(key); return `${d.getDate()}-${MONTHS_SHORT[d.getMonth()]}`; };
  U.weekStart = (key) => { const d = U.parseKey(key); const wd = (d.getDay() + 6) % 7; return U.addDays(key, -wd); };

  // "bugun", "kecha", "3 kun oldin"
  U.ago = (key) => {
    if (!key) return "—";
    const n = U.diffDays(key, U.today());
    if (n <= 0) return "bugun";
    if (n === 1) return "kecha";
    return `${n} kun oldin`;
  };
  // Due label relative to today: "kechikkan", "bugun", "ertaga", "5 kun"
  U.dueLabel = (key) => {
    const n = U.diffDays(U.today(), key);
    if (n < 0) return "kechikkan";
    if (n === 0) return "bugun";
    if (n === 1) return "ertaga";
    return `${n} kun`;
  };
  U.relTime = (ts) => {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return "hozir";
    if (mins < 60) return `${mins} daq`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} soat`;
    const d = Math.round(h / 24);
    return d === 1 ? "kecha" : `${d} kun`;
  };

  // ---------- Numbers ----------
  U.num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  // minutes -> "2s 14" (hours+min) or "34" (min)
  U.dur = (min) => {
    min = Math.round(min || 0);
    if (min < 60) return { v: String(min), u: "daq" };
    return { v: `${Math.floor(min / 60)}s ${pad(min % 60)}`, u: "" };
  };
  U.durText = (min) => { const d = U.dur(min); return d.u ? `${d.v} ${d.u}` : d.v; };
  U.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  U.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- Random ----------
  U.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.sample = (arr, n) => U.shuffle(arr).slice(0, n);
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.weighted = (weights) => { // {key: weight}
    const entries = Object.entries(weights).filter(([, w]) => w > 0);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
    return entries.length ? entries[entries.length - 1][0] : null;
  };

  // ---------- Hangul romanization (Revised Romanization, simplified) ----------
  const INI = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  const VOW = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  // final index -> [sound before consonant/end, jamo moved to next syllable on liaison (initial index) or null]
  const FIN = [
    ["", null], ["k", 0], ["k", 1], ["k", 9], ["n", 2], ["n", 12], ["n", 18], ["t", 3], ["l", 5], ["k", 0],
    ["m", 6], ["l", 7], ["l", 9], ["l", 16], ["p", 17], ["l", 18], ["m", 6], ["p", 7], ["p", 9], ["t", 9],
    ["t", 10], ["ng", null], ["t", 12], ["t", 14], ["k", 15], ["t", 16], ["p", 17], ["t", 18],
  ];
  // for complex finals, what stays when the second part moves
  const FIN_KEEP = { 3: "k", 5: "n", 6: "n", 9: "l", 10: "l", 11: "l", 12: "l", 13: "l", 14: "l", 15: "l", 18: "p" };
  const K_CLASS = new Set([1, 2, 3, 9, 24]), T_CLASS = new Set([7, 19, 20, 22, 23, 25, 27]), P_CLASS = new Set([17, 18, 26, 14]);
  U.romanize = (text) => {
    const syl = [];
    for (const ch of String(text)) {
      const c = ch.charCodeAt(0);
      if (c >= 0xac00 && c <= 0xd7a3) { const o = c - 0xac00; syl.push({ i: Math.floor(o / 588), v: Math.floor((o % 588) / 28), f: o % 28 }); }
      else syl.push({ raw: ch });
    }
    let out = "";
    for (let k = 0; k < syl.length; k++) {
      const s = syl[k];
      if (s.raw !== undefined) { out += s.raw === "/" ? " / " : s.raw; continue; }
      let ini = s.ini !== undefined ? s.ini : INI[s.i];
      out += ini + VOW[s.v];
      if (!s.f) continue;
      const next = syl[k + 1] && syl[k + 1].raw === undefined ? syl[k + 1] : null;
      const f = s.f;
      if (!next) { out += FIN[f][0]; continue; }
      const ni = next.i;
      if (ni === 11 && FIN[f][1] !== null) { // liaison into ㅇ
        if (f === 27) { next.ini = ""; continue; }           // ㅎ drops
        if (f === 6) { next.ini = "n"; continue; }           // ㄶ: 많아 → mana
        if (f === 15) { next.ini = "r"; continue; }          // ㅀ: 싫어 → sireo
        const mv = FIN[f][1];
        out += FIN_KEEP[f] || "";
        next.ini = mv === 5 ? "r" : INI[mv];
        if (f === 8) next.ini = "r";
        continue;
      }
      if (f === 27 && (ni === 0 || ni === 3 || ni === 12)) { next.ini = ni === 0 ? "k" : ni === 3 ? "t" : "ch"; continue; }
      if (ni === 2 || ni === 6) { // ㄴ ㅁ nasalization
        if (K_CLASS.has(f)) { out += "ng"; continue; }
        if (T_CLASS.has(f)) { out += "n"; continue; }
        if (P_CLASS.has(f)) { out += "m"; continue; }
        if (f === 8 && ni === 2) { out += "l"; next.ini = "l"; continue; }
      }
      if (ni === 5) { // ㄹ
        if (f === 8 || f === 4) { out += "l"; next.ini = "l"; continue; }
        if (f === 16 || f === 21) { out += FIN[f][0]; next.ini = "n"; continue; }
      }
      out += FIN[f][0];
    }
    return out.replace(/\s+/g, " ").trim();
  };

  // ---------- Recorded narrator audio ----------
  // Missing config (for example after a server restart) should not block known, bundled clips.
  U.canListen = () => !(window.S && window.S.config && window.S.config.clips === false);
  let clip = null;
  const stopClip = () => { if (clip) { clip.pause(); clip = null; } };
  // Plays the book narrator's recording from "words" or "sentences".
  U.playClip = (kind, id, rate = 1, onEnd) => {
    stopClip();
    if (!U.canListen()) {
      U.toast("Diktor audiosi mavjud emas");
      if (onEnd) onEnd();
      return false;
    }
    const audio = new Audio(`/media/clip/${kind}/${encodeURIComponent(id)}.mp3`);
    const preferred = Number(window.S && window.S.state && window.S.state.settings.speechRate) || 0.92;
    audio.playbackRate = U.clamp(rate * (preferred / 0.92), 0.5, 1.5);
    audio.preservesPitch = true;
    let settled = false;
    const finish = () => { if (settled) return; settled = true; if (clip === audio) clip = null; if (onEnd) onEnd(); };
    const fail = () => {
      if (settled) return;
      settled = true;
      if (clip !== audio) return; // stopped because another sound started
      clip = null;
      U.toast("Diktor audiosini yuklab bo'lmadi");
      if (onEnd) onEnd();
    };
    audio.onended = finish;
    audio.onerror = fail;
    clip = audio;
    // Autoplay without a tap first (e.g. after a reload) is blocked by the browser: stay quiet, the audio button still works.
    audio.play().catch((error) => (error && error.name === "NotAllowedError" ? finish() : fail()));
    return true;
  };

  // ---------- Live region ----------
  // #app carried aria-live, and every render replaces all of it, so answering one question had assistive tech
  // read the whole page again. The announcements live in #live (index.html) instead, outside the part that is
  // replaced. Two mechanics decide whether a message is heard at all: writing the string that is already there
  // is not a change, and clearing then writing in the same tick collapses into a single mutation. So the region
  // is emptied now and filled a tick later, and an invisible trailing space alternates — two identical verdicts
  // in a row are two different strings, and both are announced. Written as text, so never through U.esc.
  let sayFlip = false, sayTimer = 0;
  U.say = (msg) => {
    const el = document.getElementById("live");
    if (!el || !msg) return;
    el.textContent = "";
    clearTimeout(sayTimer);
    sayFlip = !sayFlip;
    sayTimer = setTimeout(() => { el.textContent = sayFlip ? String(msg) : `${msg}\u00a0`; }, 60);
  };

  // ---------- Toast & modal ----------
  U.toast = (msg, ms = 2600) => {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    wrap.appendChild(t);
    // The wrapper used to be a live region of its own, but it is created together with the very first toast and
    // a region that new is usually missed. One region for everything: keeping both would say each toast twice.
    U.say(msg);
    setTimeout(() => t.remove(), ms);
  };

  // What Tab may reach inside an open dialog, in document order.
  const FOCUSABLE = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
  let modalReturn = null;
  function trapTab(event, bg) {
    const items = [...bg.querySelectorAll(FOCUSABLE)];
    if (!items.length) { event.preventDefault(); return; }
    const here = document.activeElement;
    const gone = !here || !bg.contains(here);
    const edge = event.shiftKey ? items[0] : items[items.length - 1];
    if (!gone && here !== edge) return;
    event.preventDefault();
    (event.shiftKey ? items[items.length - 1] : items[0]).focus();
  }
  U.modal = (title, bodyHtml, { wide = false, width = 0 } = {}) => {
    U.closeModal(); // gives focus back to the opener of the dialog this one replaces, so the chain is unbroken
    const opener = document.activeElement;
    const bg = document.createElement("div");
    bg.className = "modal-bg"; bg.id = "modal";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" tabindex="-1" aria-label="${U.esc(title)}" style="${width ? `max-width:${width}px` : wide ? "max-width:720px" : ""}">
      <div class="modal-h"><div class="modal-title" style="font-size:19px;font-weight:700;letter-spacing:-.01em">${U.esc(title)}</div>
      <button class="iconbtn" data-act="modal-close" aria-label="Yopish">✕</button></div>
      <div class="modal-b">${bodyHtml}</div></div>`;
    bg.addEventListener("mousedown", (e) => { if (e.target === bg) U.closeModal(); });
    // aria-modal="true" promises the page behind is out of reach; without this Tab walked straight out of the
    // dialog into the nav links and the quiz buttons underneath it.
    bg.addEventListener("keydown", (e) => { if (e.key === "Tab") trapTab(e, bg); });
    document.body.appendChild(bg);
    document.body.classList.add("modal-lock"); // and the page behind must not scroll under the dialog either
    modalReturn = opener && opener !== document.body ? opener : null;
    const box = bg.querySelector(".modal");
    (bg.querySelector("[autofocus]") || box.querySelector(FOCUSABLE) || box).focus();
    return bg;
  };
  U.closeModal = () => {
    const m = document.getElementById("modal");
    if (m) m.remove();
    document.body.classList.remove("modal-lock");
    const back = modalReturn;
    modalReturn = null;
    // Escape used to leave focus on <body>, at the very start of the tab order. Hand it back to whatever opened
    // the dialog — but only while that control is still in the page: the dialog's own action often re-renders or
    // navigates away from the view underneath (ex-exit-force, ex-rest-stop, the delete form), and then the
    // render owns where focus goes.
    if (back && back.isConnected) back.focus();
  };

  // ---------- Dropdown (styled replacement for <select>) ----------
  // U.dropdown({ change: "lib-sort", value, options: [[value, label], ...], label: "Saralash", block: true })
  // Picking an option calls Changes[change]({ value }), the same handler a native select's change event would use.
  const CHEVRON = `<svg class="dd-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  U.dropdown = ({ change, value, options, label, block = false }) => {
    const current = options.find(([v]) => String(v) === String(value)) || options[0];
    return `<div class="dd${block ? " block" : ""}" data-dd="${U.esc(change)}">
      <button type="button" class="dd-btn" data-act="dd-toggle" aria-haspopup="listbox" aria-expanded="false" aria-label="${U.esc(label)}"><span class="dd-val">${U.esc(current[1])}</span>${CHEVRON}</button>
      <div class="dd-menu" role="listbox" aria-label="${U.esc(label)}" hidden>${options.map(([v, l]) => {
        const on = v === current[0];
        return `<button type="button" class="dd-opt${on ? " on" : ""}" role="option" aria-selected="${on}" data-act="dd-pick" data-v="${U.esc(v)}"><span>${U.esc(l)}</span>${on ? `<span class="dd-check" aria-hidden="true">✓</span>` : ""}</button>`;
      }).join("")}</div>
    </div>`;
  };
  U.closeDropdowns = (except) => {
    document.querySelectorAll(".dd.open").forEach((dd) => {
      if (dd === except) return;
      dd.classList.remove("open");
      dd.querySelector(".dd-menu").hidden = true;
      dd.querySelector(".dd-btn").setAttribute("aria-expanded", "false");
    });
  };
  U.modalOpen = () => !!document.getElementById("modal");

  U.download = (filename, text, type = "text/plain") => {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  U.sha256 = async (text) => {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return "x" + h; // non-secure-context fallback
  };

  window.U = U;
})();
