// Exercise engine: learning stages (flash cards + recall), review sessions, practice quizzes and the placement test.
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const X = { session: null };

  const TYPE_LABEL = { mc: "ACTIVE RECALL", mcr: "ACTIVE RECALL", type: "TYPING RECALL", listen: "LISTENING", sent: "SENTENCE COMPLETION" };
  X.QUIZ_TYPES = {
    mixed: { name: "Mixed quiz", desc: "Barcha turlardan aralash — eng samarali test.", mins: 0.3 },
    mc: { name: "Multiple choice", desc: "4 variantdan to'g'ri ma'noni tanlash.", mins: 0.2 },
    ko2uz: { name: "Korean → Uzbek", ko: "한 → 우", desc: "Tanish yo'nalish — passiv bilimni tekshiradi.", mins: 0.2 },
    uz2ko: { name: "Uzbek → Korean", ko: "우 → 한", desc: "Qiyinroq — aktiv recall'ni mustahkamlaydi.", mins: 0.3 },
    type: { name: "Typing", desc: "Hangul klaviaturada yozish — imloni tekshiradi.", mins: 0.45 },
    listen: { name: "Listening", desc: "Audio eshitib so'zni aniqlash.", mins: 0.25 },
    sent: { name: "Sentence completion", desc: "Gapda bo'sh joyni to'ldirish — kontekst.", mins: 0.4 },
    checkpoint: { name: "Checkpoint test", desc: "6 kunlik material bo'yicha nazorat.", mins: 0.3 },
  };

  // ---------- Item building ----------
  function typeWeights() {
    const p = S.state.profile;
    const w = {
      exam: { mc: 3, mcr: 2, type: 3, listen: 1, sent: 3 },
      talk: { mc: 3, mcr: 2, type: 1, listen: 4, sent: 1 },
      abroad: { mc: 3, mcr: 2, type: 2, listen: 2, sent: 2 },
      hobby: { mc: 4, mcr: 2, type: 1, listen: 2, sent: 1 },
    }[p.goal] || { mc: 3, mcr: 2, type: 2, listen: 2, sent: 2 };
    const r = { ...w };
    if (p.level === "beg") r.type = r.type / 2;
    if (p.level === "adv") { r.mc = r.mc / 2; r.type += 1; }
    return r;
  }
  const canUse = (type, id) => {
    if (type === "listen") return U.canListen();
    if (type === "sent") return !!S.clozeExample(id);
    return true;
  };
  function chooseType(id, weights) {
    const w = { ...weights };
    for (const t of Object.keys(w)) if (!canUse(t, id)) w[t] = 0;
    return U.weighted(w) || "mc";
  }
  const sameMeaning = (a, b) => a.uz.trim().toLowerCase() === b.uz.trim().toLowerCase();
  function distractors(word, n, field) {
    const sameDay = S.DAY_WORDS[word.day - 1];
    const pool = U.shuffle(sameDay).concat(U.shuffle(S.WORDS).slice(0, 60));
    const out = [], seen = new Set([word[field]]);
    for (const w of pool) {
      if (out.length >= n) break;
      if (w.id === word.id || sameMeaning(w, word) || seen.has(w[field])) continue;
      seen.add(w[field]); out.push(w[field]);
    }
    return out;
  }
  function makeItem(type, id) {
    const w = S.word(id);
    const it = { type, id };
    if (type === "mc") { it.answer = w.uz; it.opts = U.shuffle([w.uz, ...distractors(w, 3, "uz")]); }
    if (type === "mcr" || type === "listen") { it.answer = w.ko; it.opts = U.shuffle([w.ko, ...distractors(w, 3, "ko")]); }
    if (type === "sent") {
      const ex = S.clozeExample(id);
      it.ex = ex; it.answer = ex.cloze;
      const others = U.shuffle(window.UK_EXAMPLES.filter((e) => e.cloze && e.cloze !== ex.cloze).map((e) => e.cloze));
      it.opts = U.shuffle([ex.cloze, ...[...new Set(others)].slice(0, 3)]);
    }
    return it;
  }
  const ORDER = { card: 0, mc: 1, mcr: 2, type: 3, listen: 4, sent: 5 };

  function newSession(kind, items, extra) {
    return Object.assign({
      kind, items, idx: 0, ok: 0, bad: 0, results: [], phase: items[0] && items[0].type === "card" ? "front" : "q",
      chosen: null, typed: "", correct: null, hint: false, startedAt: Date.now(), itemStart: Date.now(), activeMs: 0,
      xpStart: S.state.xp, instant: true, timer: 0, finished: false, spokenKey: null,
    }, extra);
  }

  // ---------- Starters ----------
  X.startLearn = (day) => {
    const st = S.state;
    if (!st.days[day]) st.days[day] = { stage: 0, pace: st.profile.pace, done: false, ok: 0, bad: 0, min: 0, xp: 0 };
    const ds = st.days[day];
    if (ds.done) { X.startQuiz({ type: "mixed", ids: S.DAY_WORDS[day - 1].map((w) => w.id), count: 20, title: `Day ${day} takrori` }); return; }
    const plan = S.dayPlan(day);
    const stage = plan.stages[ds.stage];
    let items;
    if (stage.kind === "learn") {
      items = plan.blocks[stage.block].map((id) => ({ type: "card", id }));
    } else if (stage.kind === "recall") {
      const wts = typeWeights();
      items = plan.blocks[stage.block].map((id) => makeItem(chooseType(id, wts), id)).sort((a, b) => ORDER[a.type] - ORDER[b.type]);
    } else {
      const wts = typeWeights();
      const ids = plan.words.slice().sort((a, b) => ((S.ws(b) || {}).bad || 0) - ((S.ws(a) || {}).bad || 0) || Math.random() - 0.5).slice(0, Math.min(12, plan.words.length));
      items = U.shuffle(ids).map((id) => makeItem(chooseType(id, wts), id));
    }
    S.save();
    X.session = newSession("learn", items, { day, stageIdx: ds.stage, stage, plan, cat: "learn" });
    App.go("#/session");
  };

  X.startReview = (mode = "due") => {
    const src = { due: S.dueIds(), weak: S.weakIds(), flag: S.flaggedIds(), forgot: S.forgottenIds() }[mode] || [];
    const ids = src.slice(0, 40);
    if (!ids.length) { U.toast("Hozircha takrorlash uchun so'z yo'q"); return; }
    const wts = { mc: 3, mcr: 3, type: 2, listen: U.canListen() ? 2 : 0, sent: 1 };
    const items = ids.map((id) => makeItem(chooseType(id, wts), id));
    X.session = newSession("review", items, { mode, cat: "review" });
    App.go("#/session");
  };

  // opts: {type, ids, count, timer, instant, title}
  X.startQuiz = (opts) => {
    let pool = (opts.ids || S.learnedIds()).filter((id) => S.word(id));
    const qt = opts.type || "mixed";
    if (qt === "sent") pool = pool.filter((id) => S.clozeExample(id));
    if (qt === "listen" && !U.canListen()) { U.toast("Listening uchun audio mavjud emas"); return; }
    if (pool.length < 4 && qt !== "sent") { U.toast("Mashq uchun kamida 4 ta o'rganilgan so'z kerak"); return; }
    if (!pool.length) { U.toast("Bu mashq uchun misol gaplar hali yo'q"); return; }
    const count = Math.min(opts.count || 20, pool.length);
    const weakFirst = pool.slice().sort((a, b) => ((S.ws(b) || {}).bad || 0) - ((S.ws(a) || {}).bad || 0));
    const ids = U.shuffle(U.shuffle(weakFirst.slice(0, count * 2)).slice(0, count));
    const wts = typeWeights();
    const items = ids.map((id) => {
      const t = { mixed: null, checkpoint: null, mc: U.pick(["mc", "mcr"]), ko2uz: "mc", uz2ko: "mcr", type: "type", listen: "listen", sent: "sent" }[qt];
      return makeItem(t || chooseType(id, wts), id);
    });
    X.session = newSession("quiz", items, { quizType: qt, title: opts.title || X.QUIZ_TYPES[qt].name, cat: "quiz", instant: opts.instant !== false, timer: opts.timer ? 20 : 0 });
    App.go("#/session");
  };

  X.startPlacement = () => {
    const ids = [];
    [[1, 10, 3], [11, 20, 4], [21, S.DAYS, 3]].forEach(([a, b, n]) => {
      const pool = S.WORDS.filter((w) => w.day >= a && w.day <= b).map((w) => w.id);
      ids.push(...U.sample(pool, n));
    });
    X.session = newSession("placement", ids.map((id) => makeItem("mc", id)), { cat: null });
    App.go("#/session");
  };

  // ---------- Flow ----------
  const cur = () => X.session && X.session.items[X.session.idx];
  const modeOf = (s) => (s.kind === "review" ? "review" : s.kind === "quiz" ? "quiz" : "learn");
  function trackTime() {
    const s = X.session;
    s.activeMs += Math.min(Date.now() - s.itemStart, 60000);
    s.itemStart = Date.now();
  }
  function record(correct) {
    const s = X.session, it = cur();
    trackTime();
    stopTimer();
    s.correct = correct;
    s[correct ? "ok" : "bad"]++;
    s.results.push({ id: it.id, type: it.type, correct });
    if (s.kind !== "placement") S.answer(it.id, correct, it.type, modeOf(s));
    if (s.kind === "review") { S.state.firstTry.total++; if (correct) S.state.firstTry.ok++; }
    S.save();
    if (!s.instant) { X.next(); return; }
    s.phase = "a";
    App.render();
  }

  X.next = () => {
    const s = X.session;
    if (!s) return;
    s.idx++;
    s.chosen = null; s.typed = ""; s.correct = null; s.hint = false; s.itemStart = Date.now();
    if (s.idx >= s.items.length) { finish(); return; }
    s.phase = cur().type === "card" ? "front" : "q";
    App.render();
  };

  X.reveal = () => { const s = X.session; if (s && s.phase === "front") { s.phase = "back"; App.render(); } };
  X.gradeCard = (g) => {
    const s = X.session, it = cur();
    if (!s || !it || it.type !== "card" || s.phase !== "back") return;
    trackTime();
    S.grade(it.id, g);
    s.results.push({ id: it.id, type: "card", grade: g });
    S.save();
    X.next();
  };
  X.choose = (i) => {
    const s = X.session, it = cur();
    if (!s || !it || s.phase !== "q" || !it.opts || i >= it.opts.length) return;
    if (it.type === "sent") { s.chosen = i; App.render(); return; }
    s.chosen = i;
    record(it.opts[i] === it.answer);
  };
  X.checkSentence = () => {
    const s = X.session, it = cur();
    if (!s || !it || it.type !== "sent" || s.phase !== "q" || s.chosen === null) return;
    record(it.opts[s.chosen] === it.answer);
  };
  X.skip = () => { const s = X.session; if (s && s.phase === "q") { s.chosen = null; record(false); } };

  const norm = (t) => String(t).replace(/[\s.,!?·'"’`()~\-]/g, "").replace(/N/g, "").toLowerCase();
  function variants(word) {
    const out = new Set();
    for (const part of word.ko.split("/")) {
      out.add(norm(part));
      out.add(norm(part.replace(/\(.*?\)/g, "")));
    }
    // accept any word from the course with exactly the same meaning (e.g. several words mean "holat")
    for (const w of S.WORDS) if (w.id !== word.id && sameMeaning(w, word)) w.ko.split("/").forEach((p) => out.add(norm(p)));
    out.delete("");
    return out;
  }
  X.submitTyping = (value) => {
    const s = X.session, it = cur();
    if (!s || !it || it.type !== "type" || s.phase !== "q") return;
    const v = String(value || "").trim();
    if (!v) return;
    s.typed = v;
    record(variants(S.word(it.id)).has(norm(v)));
  };

  X.play = (rate = 1) => {
    const it = cur();
    if (!it) return;
    const w = S.word(it.id);
    const sentence = it.type === "sent" && X.session.phase === "a";
    const wave = document.querySelector(".wave");
    if (wave) wave.classList.add("playing");
    U.playClip(sentence ? "sentences" : "words", it.id, rate, () => { const wv = document.querySelector(".wave"); if (wv) wv.classList.remove("playing"); });
  };
  X.playSentence = () => {
    const it = cur();
    const ex = it && S.example(it.id);
    if (ex) U.playClip("sentences", it.id);
  };

  X.exit = (force) => {
    const s = X.session;
    if (!s) { App.go("#/dashboard"); return; }
    if (!force && s.idx > 0 && !s.finished && s.kind !== "placement") {
      U.modal("Sessiyadan chiqasizmi?", `<p class="muted" style="margin:0 0 20px;line-height:1.55">${s.kind === "learn" ? "Bu bosqich keyingi safar boshidan boshlanadi. Baholangan so'zlar va javoblar saqlanadi." : "Berilgan javoblar saqlanadi, qolgan savollar bekor qilinadi."}</p>
        <div class="row"><button class="btn btn-p" data-act="modal-close">Davom etish</button><button class="btn btn-ghost" data-act="ex-exit-force">Chiqish</button></div>`);
      return;
    }
    stopTimer();
    if (!s.finished) { trackTime(); saveMinutes(s); }
    const back = s.kind === "learn" ? `#/day/${s.day}` : s.kind === "review" ? "#/review" : s.kind === "placement" ? "#/onboarding/1" : "#/quiz";
    X.session = null;
    App.go(back);
  };

  function saveMinutes(s) {
    if (s.cat && !s.minutesSaved) { S.addMinutes(s.cat, s.activeMs / 60000); s.minutesSaved = true; S.save(); }
  }

  function finish() {
    const s = X.session;
    s.finished = true;
    stopTimer();
    saveMinutes(s);
    const gained = () => S.state.xp - s.xpStart;
    if (s.kind === "learn") {
      const ds = S.state.days[s.day];
      ds.stage++;
      ds.ok = (ds.ok || 0) + s.ok; ds.bad = (ds.bad || 0) + s.bad; ds.min = (ds.min || 0) + s.activeMs / 60000;
      if (ds.stage >= s.plan.stages.length) {
        ds.done = true; ds.doneAt = U.today();
        S.addXP(50);
        ds.xp = (ds.xp || 0) + gained();
        S.log(`Day ${s.day} tugatildi — ${s.plan.words.length} so'z`, "ok");
        S.save();
        X.session = null;
        App.go(`#/complete/${s.day}`);
        return;
      }
      ds.xp = (ds.xp || 0) + gained();
      s.nextStage = s.plan.stages[ds.stage];
    } else if (s.kind === "review") {
      S.state.reviewSessions++;
      S.addXP(20);
      S.log(`Takrorlash — ${s.ok}/${s.items.length} to'g'ri`, "p");
    } else if (s.kind === "quiz") {
      const total = s.items.length;
      S.state.quizResults.unshift({ type: s.quizType, ok: s.ok, total, at: Date.now() });
      S.state.quizResults = S.state.quizResults.slice(0, 20);
      S.addXP(10 + (s.ok === total && total >= 10 ? 20 : 0));
      S.log(`${s.title} — ${s.ok}/${total}`, "p");
    }
    s.xpGained = gained();
    S.save();
    App.render();
  }

  // ---------- Timer (quiz option) ----------
  let timerHandle = null;
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }
  X.afterRender = () => {
    const s = X.session;
    if (!s) return;
    const it = cur();
    const key = s.idx + ":" + s.phase;
    // auto audio for new cards and listening questions
    if (it && s.spokenKey !== key) {
      s.spokenKey = key;
      if (it.type === "listen" && s.phase === "q") setTimeout(() => X.play(1), 250);
      else if (it.type === "card" && s.phase === "front" && S.state.settings.autoAudio) setTimeout(() => X.play(1), 250);
      // question timer
      stopTimer();
      if (s.timer && s.phase === "q" && !s.finished) {
        let left = s.timer;
        const el = () => document.getElementById("ex-timer");
        if (el()) el().textContent = `${left}s`;
        timerHandle = setInterval(() => {
          left--;
          if (el()) el().textContent = `${left}s`;
          if (left <= 0) { stopTimer(); if (X.session === s && s.phase === "q") { s.chosen = null; record(false); } }
        }, 1000);
      }
    }
    const inp = document.getElementById("type-in");
    if (inp && s.phase === "q") inp.focus();
  };

  // ---------- Keyboard ----------
  X.onKey = (e) => {
    const s = X.session;
    if (!s || U.modalOpen()) return;
    const it = cur();
    const inInput = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (e.key === "Escape") { X.exit(); return; }
    if (inInput) return;
    if (s.finished) { if (e.key === "Enter") { const b = document.querySelector("[data-primary]"); if (b) b.click(); } return; }
    if (!it) return;
    const n = parseInt(e.key, 10);
    if (it.type === "card") {
      if (s.phase === "front" && (e.key === " " || e.key === "ArrowRight" || e.key === "Enter")) { e.preventDefault(); X.reveal(); }
      else if (s.phase === "back" && n >= 1 && n <= 4) X.gradeCard(n);
      else if (s.phase === "back" && (e.key === "ArrowRight" || e.key === "Enter")) X.gradeCard(3);
      if (e.key === "s" || e.key === "S") X.play(1);
      return;
    }
    if (s.phase === "q") {
      if (n >= 1 && n <= 4 && it.opts) { X.choose(n - 1); return; }
      if (it.type === "listen" && e.key === " ") { e.preventDefault(); X.play(1); }
      if (it.type === "sent" && e.key === "Enter") X.checkSentence();
    } else if (s.phase === "a" && (e.key === "Enter" || e.key === "ArrowRight" || e.key === " ")) { e.preventDefault(); X.next(); }
  };

  // ---------- Rendering ----------
  const rom = (ko) => (S.state.settings.roman ? `[ ${esc(U.romanize(ko))} ]` : "");
  const hlSentence = (ex) => esc(ex.ko).replace(esc(ex.hl), `<b>${esc(ex.hl)}</b>`);
  const uzPlain = (ex) => esc(ex.uz.replace(/[{}]/g, ""));
  const uzBlank = (ex) => esc(ex.uz.replace(/\{.*?\}/, "______"));
  const sentBtn = `<button class="audio-dot" style="width:28px;height:28px;font-size:11px" data-act="ex-play-sent" aria-label="Gapni eshitish">▸</button>`;

  function header(s) {
    const it = cur();
    const total = s.items.length;
    const done = s.finished ? total : s.idx;
    let lbl;
    if (s.kind === "learn") lbl = it && it.type === "card" ? `DAY ${s.day} · LEARN · BLOK ${s.stage.block + 1}` : `DAY ${s.day} · ${s.stage.kind === "mixed" ? "MIXED QUIZ" : it ? TYPE_LABEL[it.type] : "ACTIVE RECALL"}`;
    else if (s.kind === "review") lbl = `TAKRORLASH · ${it ? TYPE_LABEL[it.type] : ""}`;
    else if (s.kind === "placement") lbl = "DARAJA TESTI";
    else lbl = `MASHQ · ${esc(s.title).toUpperCase()}`;
    const badges = it && it.type !== "card" && s.kind !== "placement"
      ? `${s.ok ? `<span class="badge-ok">${s.ok} ✓</span>` : ""}${s.bad ? `<span class="badge-bad">${s.bad} ✕</span>` : ""}` : "";
    return `<div class="ex-top">
      <button class="exit" data-act="ex-exit">✕ Chiqish</button>
      <span class="lbl">${lbl}</span>
      <div class="prog" role="progressbar" aria-valuenow="${done}" aria-valuemax="${total}"><div style="width:${U.pct(done, total)}%"></div></div>
      <span class="cnt">${Math.min(s.idx + 1, total)} / ${total}</span>
      ${s.timer && !s.finished ? `<span class="badge-bad" style="background:var(--pl);color:var(--pd)" id="ex-timer">${s.timer}s</span>` : ""}
      ${badges}
    </div>`;
  }

  function cardFront(it) {
    const w = S.word(it.id);
    const learned = S.isLearned(it.id);
    return `<div style="width:100%;max-width:720px;text-align:center">
      <div class="ex-cap" style="margin-bottom:34px">${learned ? "TAKRORIY SO'Z" : "YANGI SO'Z"}</div>
      <div class="fc fc-front">
        <div class="word" style="font-size:${w.ko.length > 6 ? 64 : 88}px;margin-bottom:18px">${esc(w.ko)}</div>
        <div class="rom" style="font-size:17px;margin-bottom:34px">${rom(w.ko)}</div>
        <button class="audio-pill" data-act="ex-play"><span style="font-size:15px">▸</span> Talaffuzni eshitish</button>
      </div>
      <button class="btn btn-soft" style="margin-top:34px;padding:16px 26px;font-size:16px" data-act="ex-reveal">Ma'nosini ko'rsatish</button>
      <div class="kbd-hint" style="margin-top:22px">Space · ochish &nbsp;·&nbsp; → keyingi &nbsp;·&nbsp; S · audio</div>
    </div>`;
  }

  function cardBack(it) {
    const w = S.word(it.id);
    const ex = S.example(it.id);
    const days = S.previewInterval(it.id, 3);
    const grades = [[1, "Bilmadim"], [2, "Qiyin"], [3, "Bildim"], [4, "Oson"]];
    return `<div style="width:100%;max-width:880px"><div class="fc fc-back">
      <div class="l">
        <div class="row" style="align-items:baseline;gap:18px;margin-bottom:6px">
          <span class="word" style="font-size:${w.ko.length > 6 ? 46 : 60}px">${esc(w.ko)}</span>
          <button class="audio-dot" data-act="ex-play" aria-label="Talaffuz">▸</button>
        </div>
        <div class="rom" style="font-size:15px;margin-bottom:26px">${rom(w.ko)}</div>
        <div class="sep" style="margin-bottom:26px"></div>
        <div class="upl" style="margin-bottom:8px">Ma'nosi</div>
        <div style="font-size:28px;font-weight:700;letter-spacing:-.02em;margin-bottom:28px">${esc(w.uz)}</div>
        ${ex ? `<div class="row" style="gap:10px;align-items:center;margin-bottom:10px"><span class="upl">Misol</span>${sentBtn}</div>
        <div class="example">
          <div class="s">${hlSentence(ex)}</div>
          <div style="font-size:15px;color:var(--ink2);line-height:1.5">${uzPlain(ex)}</div>
          ${S.state.settings.roman ? `<div class="mono faint" style="font-size:12px;margin-top:12px">[ ${esc(U.romanize(ex.ko.replace(/[.?!]$/, "")))} ]</div>` : ""}
        </div>` : ""}
        ${ex && ex.note ? `<div style="font-size:13px;color:var(--ink3);line-height:1.5">${esc(ex.note)}</div>` : `<div style="font-size:13px;color:var(--ink3);line-height:1.5">Day ${w.day} · TOPIK II lug'ati</div>`}
      </div>
      <div class="r">
        <div>
          <div class="upl" style="margin-bottom:10px">Qanchalik bildingiz?</div>
          <div class="stack" style="gap:8px">
            ${grades.map(([g, t]) => `<button class="grade g${g}" data-act="ex-grade" data-g="${g}">${t}<span class="k">${g}</span></button>`).join("")}
          </div>
        </div>
        <div class="sep"></div>
        <div>
          <div class="upl" style="margin-bottom:10px">Keyingi takrorlash</div>
          <div style="font-size:15px;font-weight:700;margin-bottom:4px">${days === 1 ? "Ertaga" : `${days} kundan keyin`}</div>
          <div style="font-size:13px;color:var(--ink2);line-height:1.45">«Bildim» uchun. Javobingizga qarab interval o'zgaradi</div>
        </div>
        <div class="kbd-hint" style="margin-top:auto;font-size:11px;line-height:1.6">1–4 · baholash<br>→ keyingi so'z</div>
      </div>
    </div></div>`;
  }

  function choiceClass(s, it, i) {
    if (s.phase !== "a") return "";
    if (it.opts[i] === it.answer) return "right";
    if (i === s.chosen) return "wrong";
    return "fade";
  }

  function feedbackRow(it, s) {
    const w = S.word(it.id);
    const ex = S.example(it.id);
    const body = ex
      ? `<div class="ko" style="font-size:19px;font-weight:500;line-height:1.5;margin-bottom:6px">${hlSentence(ex)} ${sentBtn}</div><div style="font-size:14px;color:var(--ink2)">${uzPlain(ex)}</div>`
      : `<div class="row" style="gap:12px;align-items:baseline;margin-bottom:4px"><span class="ko" style="font-size:20px;font-weight:700">${esc(w.ko)}</span><span class="mono faint" style="font-size:13px">${rom(w.ko)}</span></div><div style="font-size:14px;color:var(--ink2)">${esc(w.uz)}</div>`;
    return `<div class="feedback" style="${s.correct ? "" : "border-color:rgba(201,72,60,.3)"}">
      <div class="grow">${body}</div>
      <button class="btn btn-p btn-sm" style="padding:13px 24px;font-size:15px" data-act="ex-next" data-primary>Keyingi</button>
    </div>`;
  }

  function mcView(s, it) {
    const w = S.word(it.id);
    const ko2uz = it.type === "mc";
    return `<div style="width:100%;max-width:760px">
      <div class="center" style="margin-bottom:40px">
        <div class="ex-cap" style="margin-bottom:22px">${ko2uz ? "BU SO'ZNING MA'NOSI?" : "KOREYSCHASI QAYSI?"}</div>
        ${ko2uz ? `<div class="ko" style="font-size:${w.ko.length > 6 ? 56 : 76}px;font-weight:700;letter-spacing:-.03em;line-height:1.1">${esc(w.ko)}</div>`
          : `<div style="font-size:40px;font-weight:800;letter-spacing:-.035em;line-height:1.15">${esc(w.uz)}</div>`}
      </div>
      <div class="choices" style="margin-bottom:26px">
        ${it.opts.map((o, i) => `<button class="choice ${ko2uz ? "" : "ko"} ${choiceClass(s, it, i)}" data-act="ex-choose" data-i="${i}" ${s.phase === "a" ? "disabled" : ""}>
          <span class="n">${i + 1}</span><span class="txt">${esc(o)}</span>${s.phase === "a" && o === it.answer ? `<span style="font-size:15px;color:var(--ok)">✓</span>` : ""}</button>`).join("")}
      </div>
      ${s.phase === "a" ? feedbackRow(it, s) : ""}
      <div class="kbd-hint center" style="margin-top:20px">1–4 · javob &nbsp;·&nbsp; ⏎ · keyingi</div>
    </div>`;
  }

  function typeView(s, it) {
    const w = S.word(it.id);
    const ex = S.example(it.id);
    let body;
    if (s.phase === "q") {
      body = `<form data-form="ex-type" autocomplete="off">
        <div class="typebox" style="margin-bottom:14px">
          <input id="type-in" name="v" placeholder="한국어로 yozing…" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ko" aria-label="Koreyscha javob">
        </div>
        <div class="row">
          <button class="btn btn-p" type="submit">Tekshirish</button>
          <button class="btn btn-ghost" type="button" data-act="ex-skip">Bilmayman</button>
          <span class="kbd-hint" style="margin-left:auto">⏎ · tekshirish</span>
        </div></form>`;
    } else {
      const okPanel = `<div class="answer-ok" style="margin-bottom:24px">
          <div class="upl" style="color:var(--ok);margin-bottom:10px">${s.correct ? "To'g'ri!" : "To'g'ri javob"}</div>
          <div class="row" style="align-items:baseline;gap:16px;margin-bottom:${s.correct && !ex ? 0 : 14}px">
            <span class="ko" style="font-size:40px;font-weight:700;color:var(--okd)">${esc(w.ko)}</span>
            <span class="mono" style="font-size:14px;color:var(--okm)">${rom(w.ko)}</span>
            <button class="audio-dot" style="background:transparent;color:var(--ok)" data-act="ex-play" aria-label="Talaffuz">▸</button>
          </div>
          ${ex && ex.note && !s.correct ? `<div style="font-size:14px;color:var(--okm);line-height:1.55">${esc(ex.note)}</div>`
            : ex ? `<div class="ko" style="font-size:15px;color:var(--okm);line-height:1.55">${hlSentence(ex)} <span style="font-family:inherit">— ${uzPlain(ex)}</span></div>` : ""}
        </div>`;
      const flagged = (S.ws(it.id) || {}).flag;
      body = `${s.correct ? "" : `<div class="typebox wrong" style="margin-bottom:14px"><span class="val">${esc(s.typed)}</span><span style="font-size:20px;color:var(--bad)">✕</span></div>`}
        ${okPanel}
        <div class="row wrap" style="gap:12px">
          <button class="btn btn-p" data-act="ex-next" data-primary>Keyingi so'z</button>
          <button class="btn btn-sec" data-act="ex-flag">${flagged ? "Belgilangan ✓" : "Bu so'zni belgilash"}</button>
          ${s.correct ? "" : `<span class="kbd-hint" style="margin-left:auto">Bu so'z ertaga yana chiqadi</span>`}
        </div>`;
    }
    return `<div style="width:100%;max-width:700px">
      <div class="center" style="margin-bottom:36px">
        <div class="ex-cap" style="margin-bottom:20px">KOREYSCHA YOZING</div>
        <div style="font-size:44px;font-weight:800;letter-spacing:-.035em;line-height:1.15">${esc(w.uz)}</div>
      </div>${body}</div>`;
  }

  function listenView(s, it) {
    const w = S.word(it.id);
    const bars = [10, 20, 32, 24, 14, 28, 18, 8];
    return `<div style="width:100%;max-width:680px;text-align:center">
      <div class="ex-cap" style="margin-bottom:34px">ESHITING VA TANLANG</div>
      <button class="play-big" data-act="ex-play" aria-label="Eshitish">▸</button>
      <div class="wave">${bars.map((h, i) => `<i class="${i % 3 === 2 || i === 3 ? "on" : ""}" style="height:${h}px"></i>`).join("")}</div>
      <div class="row" style="justify-content:center;margin-bottom:38px">
        <button class="chip" style="background:var(--sf);border:1px solid var(--line)" data-act="ex-play-slow">Sekin 0.7×</button>
        <button class="chip" style="background:var(--sf);border:1px solid var(--line)" data-act="ex-play">Qayta eshitish</button>
      </div>
      <div class="choices" style="margin-bottom:24px">
        ${it.opts.map((o, i) => `<button class="choice ko ${choiceClass(s, it, i)}" data-act="ex-choose" data-i="${i}" ${s.phase === "a" ? "disabled" : ""}><span class="txt">${esc(o)}</span></button>`).join("")}
      </div>
      ${s.phase === "a" ? `<div style="text-align:left">${feedbackRow(it, s)}</div>`
        : `${s.hint ? `<div style="font-size:15px;font-weight:700;margin-bottom:8px">Ma'nosi: ${esc(w.uz)}</div>` : `<button class="link" style="font-size:14px;color:var(--ink3);margin-bottom:8px" data-act="ex-hint">Tushunmadim — ma'nosini ko'rsat</button>`}
      <div class="kbd-hint">Space · takrorlash &nbsp;·&nbsp; 1–4 · javob</div>`}
    </div>`;
  }

  function sentView(s, it) {
    const ex = it.ex;
    const [before, after] = [ex.ko.slice(0, ex.ko.indexOf(ex.cloze)), ex.ko.slice(ex.ko.indexOf(ex.cloze) + ex.cloze.length)];
    let blank;
    if (s.phase === "a") {
      const chosen = s.chosen !== null ? it.opts[s.chosen] : null;
      blank = s.correct ? `<span class="blank right">${esc(ex.cloze)}</span>`
        : `<span class="blank wrong">${chosen ? `<s style="opacity:.6">${esc(chosen)}</s> ` : ""}${esc(ex.cloze)}</span>`;
    } else blank = `<span class="blank">${s.chosen !== null ? esc(it.opts[s.chosen]) : "&nbsp;"}</span>`;
    return `<div style="width:100%;max-width:800px">
      <div class="ex-cap center" style="margin-bottom:26px">BO'SH JOYNI TO'LDIRING</div>
      <div class="cloze" style="margin-bottom:26px">
        <div class="s">${esc(before)}${blank}${esc(after)}</div>
        <div style="font-size:16px;color:var(--ink2);text-align:center;line-height:1.5">${s.phase === "a" ? uzPlain(ex) : uzBlank(ex)}</div>
      </div>
      ${s.phase === "q" ? `<div class="opts" style="margin-bottom:32px">
        ${it.opts.map((o, i) => `<button class="optk ${s.chosen === i ? "on" : ""}" data-act="ex-choose" data-i="${i}">${esc(o)}</button>`).join("")}
      </div>
      <div class="row" style="justify-content:center;gap:12px">
        <button class="btn ${s.chosen === null ? "btn-soft" : "btn-p"}" style="padding:14px 30px" data-act="ex-check" ${s.chosen === null ? "disabled" : ""}>Tekshirish</button>
        <button class="btn btn-ghost" data-act="ex-skip">O'tkazib yuborish</button>
      </div>` : feedbackRow(it, s)}
    </div>`;
  }

  function stageDoneView(s) {
    const learnedStage = s.stage.kind === "learn";
    const acc = s.ok + s.bad ? U.pct(s.ok, s.ok + s.bad) : null;
    return `<div style="width:100%;max-width:620px;text-align:center">
      <div class="done-glyph">${learnedStage ? "좋아요" : "잘했어요"}</div>
      <h3 style="margin:0 0 8px;font-size:32px;font-weight:800;letter-spacing:-.035em">${esc(s.stage.label)} tugadi</h3>
      <p class="muted" style="margin:0 0 30px;font-size:16px;line-height:1.5">${learnedStage ? `${s.items.length} so'z ko'rib chiqildi.` : `${s.ok} / ${s.items.length} to'g'ri${acc !== null ? ` · ${acc}% aniqlik` : ""}.`}
        Keyingi bosqich: <b style="color:var(--ink)">${esc(s.nextStage.label)}</b> · ~${s.nextStage.min} daq</p>
      <div class="row" style="justify-content:center;gap:12px">
        <button class="btn btn-p" data-act="learn-continue" data-day="${s.day}" data-primary>Davom etish</button>
        <button class="btn btn-sec" data-act="ex-exit">Keyinroq</button>
      </div>
      <div class="kbd-hint" style="margin-top:22px">⏎ · davom etish</div>
    </div>`;
  }

  function summaryView(s) {
    if (s.kind === "placement") {
      const lvl = s.ok >= 8 ? "adv" : s.ok >= 4 ? "mid" : "beg";
      return `<div style="width:100%;max-width:620px;text-align:center">
        <div class="done-glyph">결과</div>
        <h3 style="margin:0 0 8px;font-size:32px;font-weight:800;letter-spacing:-.035em">${s.ok} / ${s.items.length} to'g'ri</h3>
        <p class="muted" style="margin:0 0 28px;font-size:16px;line-height:1.5">Tavsiya etilgan daraja: <b style="color:var(--ink)">${S.LEVEL_NAMES[lvl]}</b> (${S.LEVEL_TAGS[lvl]})</p>
        <div class="row" style="justify-content:center;gap:12px">
          <button class="btn btn-p" data-act="placement-apply" data-level="${lvl}" data-primary>Shu darajani tanlash</button>
          <button class="btn btn-ghost" data-act="ex-exit">Orqaga</button>
        </div></div>`;
    }
    const total = s.items.length;
    const wrong = [...new Set(s.results.filter((r) => r.correct === false).map((r) => r.id))];
    const t = U.dur(s.activeMs / 60000 < 1 ? 1 : s.activeMs / 60000);
    const title = s.kind === "review" ? "Takrorlash tugadi" : `${esc(s.title)} tugadi`;
    return `<div style="width:100%;max-width:820px">
      <div class="center" style="margin-bottom:30px">
        <div class="done-glyph">${s.ok === total ? "완벽" : "완료"}</div>
        <h3 style="margin:0 0 8px;font-size:34px;font-weight:800;letter-spacing:-.035em">${title}</h3>
        <p class="muted" style="margin:0;font-size:16px">${s.ok} / ${total} to'g'ri javob${s.kind === "review" ? " · noto'g'rilar ertaga yana chiqadi" : ""}</p>
      </div>
      <div class="strip lg" style="margin-bottom:20px">
        <div><div class="upl s">Aniqlik</div><div class="v"><b>${U.pct(s.ok, total)}</b><span>%</span></div></div>
        <div><div class="upl s">Vaqt</div><div class="v"><b>${t.v}</b><span>${t.u}</span></div></div>
        <div><div class="upl s">XP</div><div class="v"><b class="accent">+${s.xpGained || 0}</b></div></div>
        <div><div class="upl s">Xato</div><div class="v"><b class="${wrong.length ? "badc" : ""}">${wrong.length}</b><span>ta</span></div></div>
      </div>
      ${wrong.length ? `<div class="card pad" style="margin-bottom:24px"><div class="card-title" style="margin-bottom:14px">Qayta ko'rish kerak</div>
        <div class="stack" style="gap:11px">${wrong.slice(0, 6).map((id) => { const w = S.word(id); return `<div class="row" style="gap:14px"><span class="ko" style="font-size:18px;font-weight:700;min-width:96px">${esc(w.ko)}</span><span class="grow muted">${esc(w.uz)}</span><span class="mono badc" style="font-size:11px">${U.dueLabel((S.ws(id) || {}).due || U.today())}</span></div>`; }).join("")}</div></div>` : ""}
      <div class="row wrap" style="justify-content:center;gap:12px">
        ${wrong.length ? `<button class="btn btn-p" data-act="quiz-ids" data-ids="${wrong.join(",")}" data-primary>${wrong.length} ta xatoni mashq qilish</button>` : `<button class="btn btn-p" data-act="go" data-href="#/dashboard" data-primary>Dashboard</button>`}
        <button class="btn btn-sec" data-act="go" data-href="${s.kind === "review" ? "#/review" : "#/quiz"}">${s.kind === "review" ? "Takrorlash markazi" : "Boshqa mashq"}</button>
        ${wrong.length ? `<button class="btn btn-ghost" data-act="go" data-href="#/dashboard">Dashboard</button>` : ""}
      </div></div>`;
  }

  X.render = () => {
    const s = X.session;
    const it = cur();
    let body;
    if (s.finished) body = s.kind === "learn" ? stageDoneView(s) : summaryView(s);
    else if (it.type === "card") body = s.phase === "front" ? cardFront(it) : cardBack(it);
    else if (it.type === "mc" || it.type === "mcr") body = mcView(s, it);
    else if (it.type === "type") body = typeView(s, it);
    else if (it.type === "listen") body = listenView(s, it);
    else body = sentView(s, it);
    return `<div class="ex">${header(s)}<div class="ex-body">${body}</div></div>`;
  };

  window.X = X;
})();
