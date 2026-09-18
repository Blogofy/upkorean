// Exercise engine: learning stages (flash cards or the guided meet → match → recall flow), review sessions and quizzes.
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const Actions = (window.Actions = window.Actions || {});
  const X = { session: null };

  const TYPE_LABEL = { mc: "FAOL ESLASH", mcr: "FAOL ESLASH", type: "YOZIB ESLASH", listen: "TINGLASH", sent: "GAPNI TO'LDIRISH" };
  X.QUIZ_TYPES = {
    mixed: { name: "Aralash test", desc: "Barcha turlardan aralash — eng samarali test.", mins: 0.3 },
    mc: { name: "Variantli test", desc: "4 variantdan to'g'ri ma'noni tanlash.", mins: 0.2 },
    ko2uz: { name: "Koreyscha → o'zbekcha", ko: "한 → 우", desc: "Tanish yo'nalish — passiv bilimni tekshiradi.", mins: 0.2 },
    uz2ko: { name: "O'zbekcha → koreyscha", ko: "우 → 한", desc: "Qiyinroq — faol eslashni mustahkamlaydi.", mins: 0.3 },
    type: { name: "Yozish", desc: "Hangul klaviaturada yozish — imloni tekshiradi.", mins: 0.45 },
    listen: { name: "Tinglash", desc: "Audio eshitib so'zni aniqlash.", mins: 0.25 },
    sent: { name: "Gapni to'ldirish", desc: "Gapda bo'sh joyni to'ldirish — kontekst.", mins: 0.4 },
    checkpoint: { name: "Nazorat testi", desc: "6 kunlik material bo'yicha nazorat.", mins: 0.3 },
  };

  // ---------- Item building ----------
  // How often each exercise type is picked in mixed practice.
  const typeWeights = () => ({ mc: 3, mcr: 2, type: 2, listen: 2, sent: 2 });
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
  const firstPhase = (it) => (!it ? "q" : it.type === "card" ? "front" : it.type === "intro" ? "intro" : "q");

  // Guided flow for one learning block: words in groups of about five. Each group is met on intro cards, matched
  // with their meanings, then recalled from Uzbek (or by ear). Wrong answers come back a few questions later.
  const GROUP = 5;
  // Column orders for the matching game: no word sits in the row of its own meaning, and the Korean column is not
  // simply the order the cards were shown in.
  function matchOrders(group) {
    const koOrder = group.length > 2 ? shuffleUnlike(group, (o) => o.some((id, i) => id !== group[i])) : U.shuffle(group);
    const uzOrder = shuffleUnlike(group, (o) => o.every((id, i) => id !== koOrder[i]));
    return { koOrder, uzOrder };
  }
  function shuffleUnlike(list, ok) {
    let order = U.shuffle(list);
    for (let tries = 0; tries < 100 && list.length > 1 && !ok(order); tries++) order = U.shuffle(list);
    return order;
  }
  function guidedItems(ids) {
    const n = Math.ceil(ids.length / GROUP);
    const items = [];
    let at = 0;
    for (let g = 0; g < n; g++) {
      const size = Math.floor(ids.length / n) + (g < ids.length % n ? 1 : 0);
      const group = ids.slice(at, at + size);
      at += size;
      group.forEach((id, i) => items.push({ type: "intro", id, group: g, pos: i, size }));
      const { koOrder, uzOrder } = matchOrders(group);
      items.push({ type: "match", id: group[0], ids: group, group: g, koOrder, uzOrder });
      const wts = { mcr: 3, listen: U.canListen() ? 2 : 0 };
      U.shuffle(group).forEach((id) => items.push(makeItem(U.weighted(wts) || "mcr", id)));
    }
    return items;
  }

  function newSession(kind, items, extra) {
    return Object.assign({
      kind, items, idx: 0, ok: 0, bad: 0, results: [], phase: firstPhase(items[0]), mistakes: {}, tries: {},
      chosen: null, typed: "", correct: null, hint: false, startedAt: Date.now(), itemStart: Date.now(), activeMs: 0,
      xpStart: S.state.xp, instant: true, timer: 0, finished: false, spokenKey: null,
    }, extra);
  }

  // ---------- Starters ----------
  X.startLearn = (day) => {
    const st = S.state;
    if (!st.days[day]) st.days[day] = { stage: 0, pace: st.profile.pace, done: false, ok: 0, bad: 0, min: 0, xp: 0 };
    const ds = st.days[day];
    if (ds.done) { X.startQuiz({ type: "mixed", ids: S.DAY_WORDS[day - 1].map((w) => w.id), count: 20, title: `${day}-kun takrori` }); return; }
    const plan = S.dayPlan(day);
    // A day record saved without a pace follows the profile pace, so its stage can point past the end of the
    // plan (33 words per block gives 2 stages where 11 gives 6). Run the last stage instead of crashing.
    const stage = plan.stages[Math.min(ds.stage, plan.stages.length - 1)];
    let items;
    const guided = S.guidedDay(day);
    if (stage.kind === "learn") {
      items = guided ? guidedItems(plan.blocks[stage.block]) : plan.blocks[stage.block].map((id) => ({ type: "card", id }));
    } else if (stage.kind === "recall") {
      const wts = typeWeights();
      items = plan.blocks[stage.block].map((id) => makeItem(chooseType(id, wts), id)).sort((a, b) => ORDER[a.type] - ORDER[b.type]);
    } else {
      const wts = typeWeights();
      const ids = plan.words.slice().sort((a, b) => ((S.ws(b) || {}).bad || 0) - ((S.ws(a) || {}).bad || 0) || Math.random() - 0.5).slice(0, Math.min(12, plan.words.length));
      items = U.shuffle(ids).map((id) => makeItem(chooseType(id, wts), id));
    }
    S.save();
    X.session = newSession("learn", items, { day, stageIdx: ds.stage, stage, plan, cat: "learn", guided });
    App.go("#/session");
  };

  // The "due" queue is cut to the day's goal by S.reviewQueue, so this no longer decides a length. The
  // hand-picked lists are not goal-bounded — they are whatever the learner marked — so they keep a cap of
  // their own, and the extra round offered once the goal is met is one short sitting, not a second session.
  const PICKED_CAP = 40;
  const EXTRA_ROUND = 20;

  // Today's goal is met and words are still due. A modal, not a toast: this is a question with two answers,
  // and a toast can only tell. It is the same shape as the exit confirmation in X.exit.
  function offerExtraRound(g) {
    U.modal("Bugungi maqsad bajarildi", `<p class="muted" style="margin:0 0 20px;line-height:1.55">Bugun ${g.done} ta so'z takrorlandi — kunlik maqsad bajarildi. Navbatdagi ${g.due} ta so'z keyingi kunlarga taqsimlanadi, shuning uchun bugun to'xtasangiz ham hech narsa yo'qolmaydi.</p>
      <div class="row"><button class="btn btn-p" data-act="ex-review-extra" autofocus>Yana ${EXTRA_ROUND} ta so'z</button><button class="btn btn-ghost" data-act="modal-close">Bugunga yetarli</button></div>`);
  }

  X.startReview = (mode = "due", extra) => {
    if (mode === "due" && !extra) {
      const g = S.reviewGoal();
      // Two empty queues that mean opposite things: nothing is due at all, or the day's goal is already met.
      // One message for both would read as "you have nothing" on the very day the learner did the work.
      if (!g.due) { U.toast("Hozircha takrorlash uchun so'z yo'q"); return; }
      if (!g.left) { offerExtraRound(g); return; }
    }
    const ids = mode === "due" ? S.reviewQueue("due", extra ? EXTRA_ROUND : undefined) : S.reviewQueue(mode, PICKED_CAP);
    if (!ids.length) { U.toast("Hozircha takrorlash uchun so'z yo'q"); return; }
    const wts = { mc: 3, mcr: 3, type: 2, listen: U.canListen() ? 2 : 0, sent: 1 };
    const items = ids.map((id) => makeItem(chooseType(id, wts), id));
    X.session = newSession("review", items, { mode, cat: "review" });
    App.go("#/session");
  };
  Actions["ex-review-extra"] = () => { U.closeModal(); X.startReview("due", true); };

  // opts: {type, ids, count, timer, instant, title}
  X.startQuiz = (opts) => {
    let pool = (opts.ids || S.learnedIds()).filter((id) => S.word(id));
    const qt = opts.type || "mixed";
    if (qt === "sent") pool = pool.filter((id) => S.clozeExample(id));
    if (qt === "listen" && !U.canListen()) { U.toast("Tinglash uchun audio mavjud emas"); return; }
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
    S.answer(it.id, correct, it.type, modeOf(s));
    s.requeued = false;
    if (!correct) {
      s.mistakes[it.id] = true;
      s.tries[it.id] = (s.tries[it.id] || 0) + 1;
      // Guided days: the word returns three questions later (at most twice), with fresh options.
      if (s.guided && s.tries[it.id] < 3) {
        s.items.splice(Math.min(s.idx + 3, s.items.length), 0, makeItem(it.type, it.id));
        s.requeued = true;
      }
    }
    if (s.kind === "review") { S.state.firstTry.total++; if (correct) S.state.firstTry.ok++; }
    S.save();
    if (!s.instant) { X.next(); return; }
    s.phase = "a";
    App.render();
  }

  X.next = () => {
    const s = X.session;
    if (!s) return;
    if (restDue(s)) { showRest(s); return; }
    s.idx++;
    s.chosen = null; s.typed = ""; s.correct = null; s.hint = false; s.requeued = false; s.matched = []; s.sel = {}; s.flash = null; s.itemStart = Date.now();
    if (s.idx >= s.items.length) { finish(); return; }
    s.phase = firstPhase(cur());
    App.render();
  };

  // Redraws the session in place, keeping the scroll position (App.render jumps to the top).
  function redraw() {
    const el = document.querySelector(".ex");
    if (el && X.session) el.outerHTML = X.render(); else App.render();
  }

  // ---------- Resting point ----------
  // A review session runs to the day's goal now — 90 items at pace 17, 140 at pace 33 — where it used to hand
  // back 40. A wall that size with no visible end is its own reason to quit, so every REST_EVERY answers it
  // says how far along the learner is and offers a way out that keeps the work, instead of an exit that
  // reads as giving up. Only review: a learning stage or a quiz is short and already has its own end.
  const REST_EVERY = 20;
  // Read before s.idx moves, so dismissing the modal (Escape, the backdrop, the Back button) leaves the
  // session exactly where it stood and the ordinary "Keyingi" carries on; restAt offers each stop once.
  function restDue(s) { return s.kind === "review" && (s.idx + 1) % REST_EVERY === 0 && s.idx + 1 < s.items.length && s.restAt !== s.idx; }
  function showRest(s) {
    s.restAt = s.idx;
    const done = s.idx + 1, left = s.items.length - done;
    U.modal("Nafas rostlang", `<p class="muted" style="margin:0 0 20px;line-height:1.55">${done} / ${s.items.length} so'z takrorlandi — ${s.ok} ta to'g'ri. Yana ${left} ta qoldi, taxminan ${Math.max(1, Math.round(left * 0.3))} daqiqa.<br>Hozir to'xtasangiz, javob berilgan ${done} ta so'z saqlanib qoladi.</p>
      <div class="row"><button class="btn btn-p" data-act="ex-rest-go" autofocus>Davom etish</button><button class="btn btn-ghost" data-act="ex-rest-stop">Shu yerda to'xtash</button></div>`);
  }
  // Stopping ends the session where it stands: the answered items become the whole session, so the summary,
  // the log line and the XP all read its real length. Nothing is lost — record() wrote every answer as it
  // happened and trackTime closed the last one — and nothing is counted twice: finish() banks the minutes
  // through saveMinutes, whose minutesSaved flag and s.finished are exactly what X.leave checks afterwards.
  X.restStop = () => {
    const s = X.session;
    if (!s || s.finished) return;
    s.items.length = s.idx + 1;
    s.idx = s.items.length; // as a session that simply ran out: cur() is empty and the header reads 20 / 20
    finish();
  };
  // These two buttons live in a modal this file opens, so this file registers them (app.js owns the rest).
  Actions["ex-rest-go"] = () => { U.closeModal(); X.next(); };
  Actions["ex-rest-stop"] = () => { U.closeModal(); X.restStop(); };

  X.introNext = () => {
    const s = X.session, it = cur();
    if (!s || !it || it.type !== "intro") return;
    trackTime();
    S.introduce(it.id);
    S.save();
    X.next();
  };

  X.matchPick = (side, id) => {
    const s = X.session, it = cur();
    if (!s || !it || it.type !== "match" || s.phase !== "q" || !it.ids.includes(id)) return;
    s.matched = s.matched || [];
    if (s.matched.includes(id)) return;
    s.sel = s.sel || {};
    s.sel[side] = s.sel[side] === id ? null : id;
    s.flash = null;
    const { ko, uz } = s.sel;
    if (ko && uz) {
      s.sel = {};
      if (ko === uz) {
        s.matched.push(ko);
        S.addXP(1);
      } else {
        s.mistakes[ko] = true;
        s.flash = { ko, uz };
        setTimeout(() => { if (X.session === s && s.flash && s.flash.ko === ko && s.flash.uz === uz) { s.flash = null; redraw(); } }, 600);
      }
    }
    if (s.matched.length === it.ids.length) {
      trackTime();
      it.ids.forEach((mid) => s.results.push({ id: mid, type: "match", correct: !s.mistakes[mid] }));
      s.phase = "a";
      S.save();
      setTimeout(() => { if (X.session === s && cur() === it && s.phase === "a") X.next(); }, 800);
    }
    redraw();
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
    if (!force && s.idx > 0 && !s.finished) {
      U.modal("Sessiyadan chiqasizmi?", `<p class="muted" style="margin:0 0 20px;line-height:1.55">${s.kind === "learn" ? "Bu bosqich keyingi safar boshidan boshlanadi. Baholangan so'zlar va javoblar saqlanadi." : "Berilgan javoblar saqlanadi, qolgan savollar bekor qilinadi."}</p>
        <div class="row"><button class="btn btn-p" data-act="modal-close">Davom etish</button><button class="btn btn-ghost" data-act="ex-exit-force">Chiqish</button></div>`);
      return;
    }
    const back = s.kind === "learn" ? `#/day/${s.day}` : s.kind === "review" ? "#/review" : "#/quiz";
    X.leave();
    App.go(back);
  };

  // Ends the session wherever the learner left it. App.render calls this for every page that is not the
  // session: the browser Back button and a reminder tap leave no other way out, and a session left running
  // keeps writing into the page the learner is now on — the question timer answers "wrong" on its own, and
  // the matching timeouts redraw. Dropping X.session also disarms those timeouts (they check X.session === s).
  X.leave = () => {
    const s = X.session;
    stopTimer();
    if (!s) return;
    if (!s.finished) { trackTime(); saveMinutes(s); }
    X.session = null;
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
      // A merge from another device can land mid-session and keeps the higher stage, so the day may already be
      // past the stage we ran: move to the one after ours instead of incrementing whatever is there now (that
      // would skip a stage). The plan is re-read because the merge can bring another pace with it.
      const plan = S.dayPlan(s.day);
      // That merge took the whole day record from the device that was ahead, so this same stage's ok/bad/min/xp
      // are already counted in it and ours would count the work twice.
      const already = ds.stage > s.stageIdx;
      if (s.guided && s.stage.kind === "learn") S.settleIntroduced(s.items.filter((i) => i.type === "intro").map((i) => i.id), s.mistakes);
      ds.stage = Math.max(ds.stage, s.stageIdx + 1);
      if (!already) { ds.ok = (ds.ok || 0) + s.ok; ds.bad = (ds.bad || 0) + s.bad; ds.min = (ds.min || 0) + s.activeMs / 60000; }
      if (ds.stage >= plan.stages.length) {
        // The other device may have finished the day already: its bonus and log line stay, ours would double them.
        if (!ds.done) {
          ds.done = true; ds.doneAt = U.today();
          S.addXP(50);
          S.log(`${s.day}-kun tugatildi — ${plan.words.length} so'z`, "ok");
        }
        if (!already) ds.xp = (ds.xp || 0) + gained();
        S.save();
        X.session = null;
        App.go(`#/complete/${s.day}`);
        return;
      }
      if (!already) ds.xp = (ds.xp || 0) + gained();
      s.nextStage = plan.stages[Math.min(ds.stage, plan.stages.length - 1)];
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
      else if (((it.type === "card" && s.phase === "front") || it.type === "intro") && S.state.settings.autoAudio) setTimeout(() => X.play(1), 250);
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
    if (it.type === "intro") {
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); X.introNext(); }
      else if (e.key === "s" || e.key === "S") X.play(1);
      return;
    }
    if (it.type === "match") return;
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
  const sentBtn = `<button class="audio-dot" style="width:28px;height:28px;font-size:12px" data-act="ex-play-sent" aria-label="Gapni eshitish">▸</button>`;

  function header(s) {
    const it = cur();
    const total = s.items.length;
    const done = s.finished ? total : s.idx;
    let lbl;
    if (s.kind === "learn" && it && it.type === "intro") lbl = `${s.day}-KUN · TANISHISH · ${it.group + 1}-GURUH`;
    else if (s.kind === "learn" && it && it.type === "match") lbl = `${s.day}-KUN · JUFTLASH · ${it.group + 1}-GURUH`;
    else if (s.kind === "learn") lbl = it && it.type === "card" ? `${s.day}-KUN · O'RGANISH · ${s.stage.block + 1}-BLOK` : `${s.day}-KUN · ${s.stage.kind === "mixed" ? "ARALASH TEST" : it ? TYPE_LABEL[it.type] : "FAOL ESLASH"}`;
    else if (s.kind === "review") lbl = `TAKRORLASH · ${it ? TYPE_LABEL[it.type] : ""}`;
    else lbl = `MASHQ · ${esc(s.title).toUpperCase()}`;
    const badges = it && it.type !== "card"
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
        ${ex && ex.note ? `<div style="font-size:13px;color:var(--ink3);line-height:1.5">${esc(ex.note)}</div>` : `<div style="font-size:13px;color:var(--ink3);line-height:1.5">${w.day}-kun · TOPIK II lug'ati</div>`}
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
          <div style="font-size:13px;color:var(--ink2);line-height:1.45">«Bildim» uchun. Javobingizga qarab keyingi takrorlash vaqti o'zgaradi</div>
        </div>
        <div class="kbd-hint" style="margin-top:auto;font-size:12px;line-height:1.6">1–4 · baholash<br>→ keyingi so'z</div>
      </div>
    </div></div>`;
  }

  // ---------- Guided flow: first meeting and matching ----------
  // Origin badge: 한자어 / 고유어 / 외래어.
  X.originBadge = (id) => {
    const o = S.origin(id), info = S.ORIGINS[o];
    return `<span class="origin o-${o}" title="${esc(info.desc)}"><span class="ko">${info.ko}</span> ${esc(info.uz)}</span>`;
  };

  // How the word is built and what to remember: parts and idea, memory hook, warning, related words.
  // linkWords: related course words open their own word card (in the word modal).
  X.rootsHtml = (wordId, opts) => { const s = X.rootsSections(wordId, opts); return s.build + s.hint + s.note + s.related; };
  X.rootsSections = (wordId, { linkWords = false } = {}) => {
    const r = S.roots(wordId) || {};
    const pieces = (r.parts || []).filter((p) => !p.space);
    const parts = pieces.length > 1 || (pieces[0] && pieces[0].h)
      ? `<div class="parts">${pieces.map((p, i) => `${i ? `<span class="plus" aria-hidden="true">+</span>` : ""}<div class="part${p.h ? "" : " plain"}">
          <div class="pk"><span class="ko">${esc(p.k)}</span>${p.h ? `<span class="ph">${esc(p.h)}</span>` : ""}</div>
          <div class="pu">${esc(p.uz)}</div></div>`).join("")}</div>`
      : "";
    const idea = r.idea ? `<div class="idea">${parts ? "→ " : ""}${esc(r.idea)}</div>` : "";
    const known = (id) => S.isLearned(id) ? ` <span class="okc">✓</span>` : "";
    // Course words sharing a hanja — already learned ones first, at most two per hanja — then the entry's own family.
    const shown = new Set([S.word(wordId).ko]);
    const links = [];
    for (const l of S.rootLinks(wordId)) {
      const ids = l.ids.slice().sort((a, b) => Number(S.isLearned(b)) - Number(S.isLearned(a)));
      let fromThis = 0;
      for (const id of ids) {
        const o = S.word(id);
        if (links.length >= 3 || fromThis >= 2) break;
        if (shown.has(o.ko)) continue;
        shown.add(o.ko);
        fromThis++;
        const word = linkWords ? `<button class="link ko b" data-act="word" data-id="${esc(id)}">${esc(o.ko)}</button>` : `<span class="ko b">${esc(o.ko)}</span>`;
        links.push(`<li>${word} — ${esc(o.uz)}${known(id)}<span class="via">${esc(l.k)} ${esc(l.h)}</span></li>`);
      }
    }
    const family = (r.family || []).filter(([ko]) => !shown.has(ko)).map(([ko, uz]) => `<li><span class="ko b">${esc(ko)}</span> — ${esc(uz)}</li>`);
    const related = links.length + family.length
      ? `<div class="isec"><div class="upl">Bog'liq so'zlar</div><ul class="rel">${links.concat(family).slice(0, 5).join("")}</ul></div>` : "";
    return {
      build: parts || idea ? `<div class="isec"><div class="upl">${parts ? "Tarkibi" : "Ma'nosi"}</div>${parts}${idea}</div>` : "",
      hint: r.hint ? `<div class="isec tip"><div class="upl">Eslab qolish</div><div>${esc(r.hint)}</div></div>` : "",
      note: r.note ? `<div class="isec warn"><div class="upl">Diqqat</div><div>${esc(r.note)}</div></div>` : "",
      related,
    };
  };

  function introView(it) {
    const w = S.word(it.id);
    const ex = S.example(it.id);
    return `<div class="intro">
      <div class="ex-cap center" style="margin-bottom:18px">YANGI SO'Z · ${it.pos + 1} / ${it.size}</div>
      <div class="fc intro-card">
        <div class="intro-top">
          <div class="row" style="justify-content:center;align-items:center;gap:14px">
            <span class="word">${esc(w.ko)}</span>
            <button class="audio-dot" data-act="ex-play" aria-label="Talaffuz">▸</button>
          </div>
          <div class="rom">${rom(w.ko)}</div>
          <div class="mean">${esc(w.uz)}</div>
          <div style="margin-top:12px">${X.originBadge(it.id)}</div>
        </div>
        <div class="intro-grid">
          <div>${X.rootsHtml(it.id)}</div>
          <div>
            ${ex ? `<div class="isec"><div class="row" style="gap:10px;align-items:center"><span class="upl">Misol</span>${sentBtn}</div>
              <div class="example" style="margin:10px 0 0">
                <div class="s">${hlSentence(ex)}</div>
                <div style="font-size:15px;color:var(--ink2);line-height:1.5">${uzPlain(ex)}</div>
              </div></div>` : ""}
            <div class="isec"><label class="upl" for="note-in">O'z eslatmangiz</label>
              <input class="input note-in" id="note-in" data-input="word-note" data-id="${esc(it.id)}" maxlength="140" autocomplete="off"
                placeholder="O'zingizga tushunarli bog'lanish yozing…" value="${esc(S.note(it.id))}"></div>
          </div>
        </div>
      </div>
      <div class="center" style="margin-top:24px">
        <button class="btn btn-p" style="padding:16px 34px;font-size:16px" data-act="ex-intro-next" data-primary>Tushundim →</button>
        <div class="kbd-hint" style="margin-top:14px">⏎ · keyingi &nbsp;·&nbsp; S · audio</div>
      </div>
    </div>`;
  }

  function matchView(s, it) {
    const sel = s.sel || {}, done = s.matched || [], flash = s.flash || {};
    const col = (side, order) => order.map((id) => {
      const w = S.word(id);
      const cls = done.includes(id) ? "right" : flash[side] === id ? "wrong" : sel[side] === id ? "on" : "";
      return `<button class="mt${side === "ko" ? " ko" : ""} ${cls}" data-act="ex-match" data-side="${side}" data-id="${esc(id)}" ${done.includes(id) ? "disabled" : ""}>${esc(side === "ko" ? w.ko : w.uz)}</button>`;
    }).join("");
    return `<div style="width:100%;max-width:760px">
      <div class="center" style="margin-bottom:28px">
        <div class="ex-cap" style="margin-bottom:12px">JUFTINI TOPING</div>
        <div class="muted" style="font-size:15px">${s.phase === "a" ? `<b style="color:var(--ok)">Barakalla! Hammasi to'g'ri.</b>` : "Koreyscha so'zni, keyin uning ma'nosini bosing"}</div>
      </div>
      <div class="match"><div class="mcol">${col("ko", it.koOrder)}</div><div class="mcol">${col("uz", it.uzOrder)}</div></div>
    </div>`;
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
    const again = s.requeued ? `<div class="upl" style="color:var(--bad);margin-top:10px">Bu so'z birozdan keyin yana chiqadi</div>` : "";
    return `<div class="feedback" style="${s.correct ? "" : "border-color:rgba(201,72,60,.3)"}">
      <div class="grow">${body}${again}</div>
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
          ${s.correct ? "" : `<span class="kbd-hint" style="margin-left:auto">${s.requeued ? "Bu so'z birozdan keyin yana chiqadi" : "Bu so'z ertaga yana chiqadi"}</span>`}
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
      <div class="done-glyph" aria-hidden="true">${learnedStage ? "좋아요" : "잘했어요"}</div>
      <h3 style="margin:0 0 8px;font-size:32px;font-weight:700;letter-spacing:-.02em">${esc(s.stage.label)} tugadi</h3>
      <p class="muted" style="margin:0 0 30px;font-size:16px;line-height:1.5">${learnedStage ? `${s.guided ? s.items.filter((i) => i.type === "intro").length : s.items.length} so'z ko'rib chiqildi${s.guided && acc !== null ? ` · ${acc}% aniqlik` : ""}.` : `${s.ok} / ${s.items.length} to'g'ri${acc !== null ? ` · ${acc}% aniqlik` : ""}.`}
        Keyingi bosqich: <b style="color:var(--ink)">${esc(s.nextStage.label)}</b> · ~${s.nextStage.min} daq</p>
      <div class="row" style="justify-content:center;gap:12px">
        <button class="btn btn-p" data-act="learn-continue" data-day="${s.day}" data-primary>Davom etish</button>
        <button class="btn btn-sec" data-act="ex-exit">Keyinroq</button>
      </div>
      <div class="kbd-hint" style="margin-top:22px">⏎ · davom etish</div>
    </div>`;
  }

  function summaryView(s) {
    const total = s.items.length;
    const wrong = [...new Set(s.results.filter((r) => r.correct === false).map((r) => r.id))];
    const t = U.dur(s.activeMs / 60000 < 1 ? 1 : s.activeMs / 60000);
    const title = s.kind === "review" ? "Takrorlash tugadi" : `${esc(s.title)} tugadi`;
    return `<div style="width:100%;max-width:820px">
      <div class="center" style="margin-bottom:30px">
        <div class="done-glyph" aria-hidden="true">${s.ok === total ? "완벽" : "완료"}</div>
        <h3 style="margin:0 0 8px;font-size:34px;font-weight:700;letter-spacing:-.02em">${title}</h3>
        <p class="muted" style="margin:0;font-size:16px">${s.ok} / ${total} to'g'ri javob${s.kind === "review" ? " · noto'g'rilar ertaga yana chiqadi" : ""}</p>
      </div>
      <div class="strip lg" style="margin-bottom:20px">
        <div><div class="upl s">Aniqlik</div><div class="v"><b>${U.pct(s.ok, total)}</b><span>%</span></div></div>
        <div><div class="upl s">Vaqt</div><div class="v"><b>${t.v}</b><span>${t.u}</span></div></div>
        <div><div class="upl s">XP</div><div class="v"><b class="accent">+${s.xpGained || 0}</b></div></div>
        <div><div class="upl s">Xato</div><div class="v"><b class="${wrong.length ? "badc" : ""}">${wrong.length}</b><span>ta</span></div></div>
      </div>
      ${wrong.length ? `<div class="card pad" style="margin-bottom:24px"><div class="card-title" style="margin-bottom:14px">Qayta ko'rish kerak</div>
        <div class="stack" style="gap:11px">${wrong.slice(0, 6).map((id) => { const w = S.word(id); return `<div class="row" style="gap:14px"><span class="ko" style="font-size:18px;font-weight:700;min-width:96px">${esc(w.ko)}</span><span class="grow muted">${esc(w.uz)}</span><span class="mono badc" style="font-size:12px">${U.dueLabel((S.ws(id) || {}).due || U.today())}</span></div>`; }).join("")}</div></div>` : ""}
      <div class="row wrap" style="justify-content:center;gap:12px">
        ${wrong.length ? `<button class="btn btn-p" data-act="quiz-ids" data-ids="${wrong.join(",")}" data-primary>${wrong.length} ta xatoni mashq qilish</button>` : `<button class="btn btn-p" data-act="go" data-href="#/dashboard" data-primary>Bosh sahifa</button>`}
        <button class="btn btn-sec" data-act="go" data-href="${s.kind === "review" ? "#/review" : "#/quiz"}">${s.kind === "review" ? "Takrorlash markazi" : "Boshqa mashq"}</button>
        ${wrong.length ? `<button class="btn btn-ghost" data-act="go" data-href="#/dashboard">Bosh sahifa</button>` : ""}
      </div></div>`;
  }

  X.render = () => {
    const s = X.session;
    const it = cur();
    let body;
    if (s.finished) body = s.kind === "learn" ? stageDoneView(s) : summaryView(s);
    else if (it.type === "intro") body = introView(it);
    else if (it.type === "match") body = matchView(s, it);
    else if (it.type === "card") body = s.phase === "front" ? cardFront(it) : cardBack(it);
    else if (it.type === "mc" || it.type === "mcr") body = mcView(s, it);
    else if (it.type === "type") body = typeView(s, it);
    else if (it.type === "listen") body = listenView(s, it);
    else body = sentView(s, it);
    return `<div class="ex">${header(s)}<div class="ex-body">${body}</div></div>`;
  };

  window.X = X;
})();
