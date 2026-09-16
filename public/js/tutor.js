// AI Tutor: start screen (F2) and chat (F1). Talks to /api/tutor (Claude on the server); falls back to an offline drill.
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const V = (window.V = window.V || {});
  const Actions = (window.Actions = window.Actions || {});
  const T = (window.T = { ui: { mode: "talk", topic: "day", showTr: true, sending: false, error: null } });

  const MODES = {
    talk: { ko: "대화", name: "Erkin suhbat", desc: "O'rgangan so'zlaringiz bilan tabiiy dialog. Xatolar darhol tushuntiriladi." },
    fix: { ko: "교정", name: "Gap tuzatish", desc: "Siz gap yozasiz, AI grammatika va so'z tanlovini tuzatadi." },
    weak: { ko: "약점", name: "Zaif so'zlar mashqi", desc: "Zaif so'zlarni suhbat ichida takrorlash — kontekstda yodlash." },
    quiz: { ko: "시험", name: "AI quiz", desc: "Sizning darajangizga moslangan savollar." },
  };
  const conv = () => S.state.tutor.current;

  function topicWords(topic, mode) {
    const learned = S.learnedIds();
    let ids;
    if (mode === "weak") {
      ids = S.weakIds();
      if (!ids.length) ids = learned.filter((id) => (S.ws(id).bad || 0) > 0);
      if (!ids.length) ids = learned;
    } else if (topic === "day") ids = S.DAY_WORDS[S.currentDay() - 1].map((w) => w.id);
    else if (topic === "all") ids = learned.length ? learned : S.DAY_WORDS[0].map((w) => w.id);
    else ids = [];
    if (ids.length > 60) ids = U.sample(ids, 60);
    return ids.map((id) => ({ id, ko: S.word(id).ko, uz: S.word(id).uz }));
  }
  const topicLabel = (c) => c.mode === "weak" ? "Zaif so'zlar" : c.topic === "day" ? `Day ${c.day} vocabulary` : c.topic === "all" ? "Barcha o'rganilgan so'zlar" : "Erkin mavzu";
  const stemOf = (ko) => {
    const base = ko.split("/")[0].replace(/\(.*?\)\s*/g, "").replace(/^N\s+|\s+N$/g, "").trim();
    if (base.length > 2 && base.endsWith("하다")) return base.slice(0, -2);
    if (base.length > 1 && base.endsWith("다")) return base.slice(0, -1);
    return base;
  };
  const mentions = (text, w) => { const s = stemOf(w.ko); return s.length >= 1 && text.includes(s); };

  // ---------- Start screen (F2) ----------
  V.tutorStart = () => {
    const body = `<div class="page coming-soon-page">
      <div class="coming-soon-card">
        <div class="coming-lock" aria-hidden="true">AI</div>
        <span class="tag">TEZ KUNDA</span>
        <h3 class="page-h">AI Tutor tayyorlanmoqda</h3>
        <p class="page-p">Koreyscha suhbat, grammatika tuzatish va shaxsiy mashqlar keyingi yangilanishlardan birida ochiladi.</p>
        <a class="btn btn-p" href="#/quiz">Hozircha oddiy mashqlarni ishlash</a>
      </div>
    </div>`;
    return V.shell("tutor", V.topbar("AI Tutor", "tez kunda"), body);
  };
  Actions["tutor-mode"] = (el) => { T.ui.mode = el.dataset.k; App.render(); };
  Actions["tutor-topic"] = (el) => { T.ui.topic = el.dataset.k; App.render(); };
  Actions["tutor-start"] = () => startConversation(T.ui.mode, T.ui.topic);
  Actions["tutor-quiz"] = () => startConversation("quiz", "all");

  function startConversation(mode, topic) {
    S.state.tutor.current = {
      mode, topic, day: S.currentDay(), words: topicWords(topic, mode), startedAt: Date.now(), lastAt: Date.now(),
      messages: [], corrections: 0, used: {}, offline: { i: 0 }, counted: false,
    };
    T.ui.error = null;
    S.save();
    App.go("#/tutor/chat");
    request();
  }

  // ---------- Offline drill (no API key) ----------
  const RULES = [
    { re: /([가-힣]+)다\s*(어려워요|어렵다|어려워|어렵습니다|쉬워요|쉽다|쉬워|쉽습니다)/, fix: (m) => `${m[1]}기 ${m[2]}`, why: (m) => `«-기 어렵다/쉽다» konstruksiyasida fe'l 기 shaklida bo'ladi: ${m[1]}다 → ${m[1]}기.` },
    { re: /([가-힣]+)다\s*(싶어요|싶다|싶어|싶습니다)/, fix: (m) => `${m[1]}고 ${m[2]}`, why: (m) => `«-고 싶다» (xohlamoq) konstruksiyasida fe'l -고 shaklida bo'ladi: ${m[1]}다 → ${m[1]}고.` },
    { re: /([가-힣]+)다\s*(있어요|있다|있습니다)/, fix: (m) => `${m[1]}고 ${m[2]}`, why: () => "Davomli harakat «-고 있다» bilan yasaladi: fe'l o'zagiga -고 qo'shiladi." },
  ];
  function offlineReply(c, text) {
    const words = c.words.length ? c.words : topicWords("all", "talk");
    const o = c.offline;
    const cur = words[o.i % Math.max(1, words.length)];
    const next = () => { o.i++; return words[o.i % words.length]; };
    const ask = (w) => c.mode === "quiz"
      ? { ko: `‘${w.ko}’는 무슨 뜻이에요?`, uz: `‘${w.ko}’ so'zi nimani anglatadi? O'zbekcha yozing.` }
      : { ko: `‘${w.ko}’ 단어로 문장을 하나 만들어 보세요.`, uz: `‘${w.ko}’ (${w.uz}) so'zi bilan bitta gap tuzing.` };
    const out = { reply_ko: "", reply_uz: "", correction: { has_error: false, wrong: "", right: "", explanation: "" }, used_words: [], tip: "" };
    if (!cur) { out.reply_ko = "안녕하세요! 먼저 오늘의 단어를 공부해 볼까요?"; out.reply_uz = "Salom! Avval bugungi so'zlarni o'rganib chiqaylik."; return out; }
    if (text == null) {
      const a = ask(cur);
      out.reply_ko = `안녕하세요! 오늘 배운 단어로 연습해 볼까요? ${a.ko}`;
      out.reply_uz = `Salom! Bugungi so'zlar bilan mashq qilamizmi? ${a.uz}`;
      return out;
    }
    for (const r of RULES) {
      const m = text.match(r.re);
      if (m) { out.correction = { has_error: true, wrong: m[0], right: r.fix(m), explanation: r.why(m) }; out.tip = "Fe'l birikmalarini (-기, -고) mashq qilish tavsiya etiladi."; break; }
    }
    for (const w of words) if (mentions(text, w)) out.used_words.push({ word: w.ko, correct: !(out.correction.has_error && mentions(out.correction.wrong, w)) });
    if (c.mode === "quiz") {
      const ok = cur.uz.toLowerCase().split(/[/,]/).map((s) => s.trim()).filter(Boolean).some((p) => text.toLowerCase().includes(p));
      const n = next(), a = ask(n);
      out.reply_ko = ok ? `맞아요! ${a.ko}` : `아쉬워요. ‘${cur.ko}’는 “${cur.uz}”라는 뜻이에요. ${a.ko}`;
      out.reply_uz = ok ? `To'g'ri! ${a.uz}` : `Afsus. ‘${cur.ko}’ — “${cur.uz}” degani. ${a.uz}`;
      out.used_words = [{ word: cur.ko, correct: ok }];
      return out;
    }
    if (!/[가-힣]/.test(text)) { out.reply_ko = "한국어로 써 볼까요? 짧은 문장도 괜찮아요."; out.reply_uz = "Koreys tilida yozib ko'ramizmi? Qisqa gap ham bo'ladi."; return out; }
    if (mentions(text, cur)) {
      const n = next(), a = ask(n);
      out.reply_ko = `${out.correction.has_error ? "거의 맞았어요!" : "좋아요! 잘 썼어요."} 다음 단어예요. ${a.ko}`;
      out.reply_uz = `${out.correction.has_error ? "Deyarli to'g'ri!" : "Zo'r! Yaxshi yozdingiz."} Keyingi so'z. ${a.uz}`;
    } else {
      const ex = S.example(cur.id);
      out.reply_ko = `‘${cur.ko}’ 단어를 넣어서 다시 써 볼까요?${ex ? ` 예: ${ex.ko}` : ""}`;
      out.reply_uz = `‘${cur.ko}’ so'zini qo'shib qayta yozib ko'ramizmi?${ex ? ` Misol: ${ex.uz.replace(/[{}]/g, "")}` : ""}`;
    }
    return out;
  }

  // ---------- Conversation ----------
  async function request(userText) {
    const c = conv();
    if (!c || T.ui.sending) return;
    T.ui.sending = true; T.ui.error = null; App.render();
    let reply;
    try {
      if (!S.config.tutor || c.forceOffline) throw Object.assign(new Error("offline"), { offline: true });
      const history = c.messages.map((m) => ({ role: m.role, text: m.role === "tutor" ? `${m.ko}\n(${m.uz})` : m.text }));
      reply = await S.tutor({ mode: c.mode, level: S.state.profile.level, words: c.words.map(({ ko, uz }) => ({ ko, uz })), history });
    } catch (e) {
      if (e.offline || (e.data && e.data.offline)) { c.forceOffline = true; reply = offlineReply(c, userText == null ? null : userText); }
      else { T.ui.sending = false; T.ui.error = e.message; App.render(); return; }
    }
    T.ui.sending = false;
    const msg = { role: "tutor", ko: reply.reply_ko || "", uz: reply.reply_uz || "", correction: reply.correction && reply.correction.has_error ? reply.correction : null, tip: reply.tip || "", refused: !!reply.refused };
    c.messages.push(msg);
    if (msg.correction) {
      c.corrections++;
      const lastUser = [...c.messages].reverse().find((m) => m.role === "user");
      if (lastUser) lastUser.wrong = msg.correction.wrong;
      for (const w of c.words) if (mentions(msg.correction.wrong, w)) c.used[w.ko] = false;
    }
    for (const u of reply.used_words || []) if (c.used[u.word] !== false) c.used[u.word] = !!u.correct;
    if (c.messages.length > 80) c.messages = c.messages.slice(-80);
    S.save();
    App.render();
    scrollChat();
  }

  function send(text) {
    const c = conv();
    text = String(text || "").trim();
    if (!c || !text || T.ui.sending) return;
    const now = Date.now();
    const delta = Math.min(now - (c.lastAt || now), 3 * 60000) / 60000;
    S.addMinutes("tutor", delta);
    c.lastAt = now;
    const t = S.state.tutor;
    if (!c.counted) { c.counted = true; t.sessions++; S.log(`AI Tutor bilan suhbat — ${MODES[c.mode].name}`, "pd"); }
    t.lastAt = now; t.lastMin = (now - c.startedAt) / 60000;
    c.messages.push({ role: "user", text: text.slice(0, 1000) });
    S.save();
    request(text);
  }
  function scrollChat() { const log = document.getElementById("chat-log"); if (log) log.scrollTop = log.scrollHeight; }

  Actions["chat-send"] = () => { const inp = document.getElementById("chat-input"); if (!inp) return; const v = inp.value; inp.value = ""; send(v); };
  Actions["chat-retry"] = () => request("retry");
  Actions["chat-new"] = () => { S.state.tutor.current = null; S.save(); App.go("#/tutor"); };
  Actions["chat-tr"] = () => { T.ui.showTr = !T.ui.showTr; App.render(); };
  // Generated tutor replies have no synthetic voice. Only exact course examples use narrator audio.
  const plain = (s) => String(s || "").replace(/[\s.,?!…'"‘’“”·~]/g, "");
  function narratorSentenceId(text) {
    const c = conv();
    const hit = c && c.words.find((w) => { const ex = S.example(w.id); return ex && plain(ex.ko) === plain(text); });
    return hit && hit.id;
  }
  function sayTutor(text) {
    const id = narratorSentenceId(text);
    if (id) U.playClip("sentences", id);
  }
  Actions["chat-example"] = () => send("다른 예문을 보여 주세요.");
  Actions["chat-say"] = (el) => { const m = conv().messages[Number(el.dataset.i)]; if (m) sayTutor(m.ko); };
  Actions["chat-mic"] = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { U.toast("Brauzeringiz ovozni tanishni qo'llab-quvvatlamaydi"); return; }
    const rec = new SR(); rec.lang = "ko-KR"; rec.interimResults = false;
    U.toast("Gapiring…");
    rec.onresult = (e) => { const inp = document.getElementById("chat-input"); if (inp) { inp.value = (inp.value + " " + e.results[0][0].transcript).trim(); inp.focus(); } };
    rec.onerror = () => U.toast("Ovozni tanib bo'lmadi");
    rec.start();
  };
  Actions["chat-practice"] = () => {
    const c = conv();
    const bad = c ? c.words.filter((w) => c.used[w.ko] === false).map((w) => w.id).filter((id) => S.isLearned(id)) : [];
    if (bad.length >= 1) X.startQuiz({ type: "mixed", ids: bad.concat(S.weakIds()).slice(0, 20), count: 10, title: "Suhbatdagi xatolar" });
    else X.startQuiz({ type: "mixed", ids: S.weakIds().length >= 4 ? S.weakIds() : S.learnedIds(), count: 10, title: "Zaif so'zlar" });
  };

  T.onKey = (e) => {
    if (e.target && e.target.id === "chat-input" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); Actions["chat-send"](); }
  };
  T.afterRender = () => { scrollChat(); const inp = document.getElementById("chat-input"); if (inp && !T.ui.sending && !U.modalOpen()) inp.focus(); };

  // ---------- Chat view (F1) ----------
  // Course words in a reply are highlighted; clicking one plays the narrator reading that word.
  function highlight(text, c) {
    let html = esc(text);
    const found = c.words.map((w) => ({ w, s: stemOf(w.ko) })).filter((x) => x.s.length >= 2).sort((a, b) => b.s.length - a.s.length).slice(0, 60);
    found.forEach((x, i) => { html = html.split(esc(x.s)).join(`${i}`); }); // placeholders: later stems can't match inside markup
    return html.replace(/(\d+)/g, (_, i) => {
      const { w, s } = found[i];
      return `<span class="hl" role="button" tabindex="0" style="cursor:pointer" data-act="say" data-kind="words" data-id="${esc(w.id)}" data-text="${esc(w.ko)}" title="Diktor talaffuzi">${esc(s)}</span>`;
    });
  }
  function userBubble(m) {
    let html = esc(m.text);
    if (m.wrong && m.text.includes(m.wrong)) html = html.replace(esc(m.wrong), `<span class="err-u">${esc(m.wrong)}</span>`);
    return `<div class="bub me"><div class="kt">${html}</div></div>`;
  }
  function tutorBubble(m, i, c) {
    const say = narratorSentenceId(m.ko) ? `<button class="audio-dot" style="width:28px;height:28px;font-size:11px;margin-left:8px;vertical-align:middle" data-act="chat-say" data-i="${i}" aria-label="Diktor ovozida eshitish">▸</button>` : "";
    const reply = `<div class="kt">${highlight(m.ko, c)}${say}</div>${T.ui.showTr && m.uz ? `<div class="ut">${esc(m.uz)}</div>` : ""}`;
    if (!m.correction) return `<div class="bub">${reply}</div>`;
    const x = m.correction;
    return `<div class="bub fix">
      <div class="row" style="gap:8px;margin-bottom:14px"><span class="upl" style="color:var(--pd)">Tuzatish</span><span class="grow sep"></span></div>
      <div class="row wrap" style="gap:14px;margin-bottom:14px;align-items:stretch">
        <div class="fixbox" style="background:var(--badl)"><div class="h" style="color:var(--bad)">XATO</div><div class="v" style="color:var(--badd)">${esc(x.wrong)}</div></div>
        <div class="fixbox" style="background:var(--okl)"><div class="h" style="color:var(--ok)">TO'G'RI</div><div class="v" style="color:var(--okd)"><strong>${esc(x.right)}</strong></div></div>
      </div>
      <div class="muted" style="font-size:14px;line-height:1.55;margin-bottom:14px">${esc(x.explanation)}</div>
      <div style="padding-top:14px;border-top:1px solid var(--line)">${reply}</div></div>`;
  }

  V.tutorChat = () => {
    const c = conv();
    if (!c) return null;
    const ui = T.ui;
    const inConv = c.words.filter((w) => c.used[w.ko] !== undefined || c.messages.some((m) => (m.role === "tutor" ? mentions(m.ko, w) : mentions(m.text, w))));
    const usedCount = Object.keys(c.used).length;
    const lastTip = [...c.messages].reverse().find((m) => m.role === "tutor" && (m.tip || m.correction));
    const tipText = lastTip ? (lastTip.tip || lastTip.correction.explanation) : "Suhbat davomida xatolarga qarab shaxsiy tavsiya shu yerda chiqadi.";
    const startTime = new Date(c.startedAt);
    const userCount = c.messages.filter((m) => m.role === "user").length;
    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    return `<div class="chat">
      <div class="chat-main">
        <div class="chat-head">
          <a class="iconbtn" href="#/tutor" aria-label="Orqaga">←</a>
          <div class="avatar ko" style="font-size:15px;font-weight:700">선</div>
          <div class="grow"><div style="font-size:15px;font-weight:700">선생님 · AI Tutor${c.forceOffline ? ` <span class="tag" style="margin-left:6px">offline</span>` : ""}</div>
            <div class="muted" style="font-size:12px">${esc(topicLabel(c))} · ${MODES[c.mode].name} · ${S.LEVEL_TAGS[S.state.profile.level]}</div></div>
          <button class="chip" data-act="chat-new">Yangi suhbat</button>
        </div>
        <div class="chat-log" id="chat-log" aria-live="polite">
          <div class="center mono faint" style="font-size:11px">${U.diffDays(U.dateKey(startTime), U.today()) === 0 ? "BUGUN" : U.fmtDayMonth(U.dateKey(startTime)).toUpperCase()} · ${String(startTime.getHours()).padStart(2, "0")}:${String(startTime.getMinutes()).padStart(2, "0")}</div>
          ${c.messages.map((m, i) => (m.role === "user" ? userBubble(m) : tutorBubble(m, i, c))).join("")}
          ${ui.sending ? `<div class="bub" style="width:auto;padding:16px 20px"><span class="typing-dots"><i></i><i></i><i></i></span></div>` : ""}
          ${ui.error ? `<div class="card row" style="gap:12px;padding:14px 18px;border-color:rgba(201,72,60,.3);max-width:520px"><span class="grow badc" style="font-size:14px">${esc(ui.error)}</span><button class="btn btn-sec btn-sm" data-act="chat-retry">Qayta urinish</button></div>` : ""}
        </div>
        <div class="chat-foot">
          <div class="row wrap" style="gap:8px;margin-bottom:14px">
            <button class="chip" data-act="chat-tr">${ui.showTr ? "Tarjimani yashirish" : "Tarjimasini ko'rsat"}</button>
            <button class="chip" data-act="chat-example" ${ui.sending ? "disabled" : ""}>Boshqa misol</button>
          </div>
          <div class="row" style="gap:10px;align-items:flex-end">
            <textarea class="chat-input" id="chat-input" rows="1" placeholder="하루에 30분 정도..." lang="ko" aria-label="Xabar" maxlength="1000"></textarea>
            <button class="send" data-act="chat-send" aria-label="Yuborish" ${ui.sending ? "disabled" : ""}>↑</button>
          </div>
          <div class="row wrap" style="gap:16px;margin-top:12px">
            <span class="mono faint" style="font-size:11px">한 / EN klaviatura</span>
            <span class="mono faint" style="font-size:11px">⏎ · yuborish</span>
            ${hasSR ? `<button class="mono faint" style="font-size:11px" data-act="chat-mic">🎙 ovozli javob</button>` : ""}
          </div>
        </div>
      </div>
      <aside class="chat-side">
        <div><div class="upl" style="margin-bottom:12px">Bu suhbatdagi so'zlar</div>
          <div class="stack" style="gap:8px">${inConv.length ? inConv.slice(0, 10).map((w) => {
            const st = c.used[w.ko];
            return `<div class="row" style="gap:10px;padding:10px 12px;border-radius:10px;background:${st === false ? "var(--badl)" : "var(--sf)"}">
              <button class="audio-dot" style="width:24px;height:24px;font-size:10px;flex:none" data-act="say" data-kind="words" data-id="${esc(w.id)}" data-text="${esc(w.ko)}" aria-label="${esc(w.ko)} — diktor talaffuzi">▸</button>
              <span class="ko" style="font-size:16px;font-weight:700">${esc(w.ko)}</span><span class="grow" style="font-size:13px;color:${st === false ? "var(--badd)" : "var(--ink2)"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.uz)}</span>
              <span style="font-size:12px;color:${st === false ? "var(--bad)" : st ? "var(--ok)" : "var(--ink3)"}">${st === false ? "✕" : st ? "✓" : "·"}</span></div>`; }).join("")
            : `<div class="faint" style="font-size:13px">Suhbatda ishlatilgan so'zlar shu yerda ko'rinadi.</div>`}</div></div>
        <div class="sep"></div>
        <div><div class="upl" style="margin-bottom:12px">Sessiya</div>
          <div class="stack" style="gap:10px">
            <div class="row between"><span class="muted" style="font-size:13px">Xabar</span><span class="mono" style="font-size:13px">${userCount}</span></div>
            <div class="row between"><span class="muted" style="font-size:13px">Tuzatish</span><span class="mono ${c.corrections ? "badc" : ""}" style="font-size:13px">${c.corrections}</span></div>
            <div class="row between"><span class="muted" style="font-size:13px">Ishlatilgan so'z</span><span class="mono" style="font-size:13px">${usedCount} / ${c.words.length || "—"}</span></div>
          </div></div>
        <div class="sep"></div>
        <div><div class="upl" style="margin-bottom:12px">Tavsiya</div>
          <div class="card-pl" style="padding:16px;border-radius:12px">
            <p style="margin:0 0 12px;font-size:13px;line-height:1.55">${esc(tipText)}</p>
            <button class="btn btn-pd btn-sm btn-block" style="padding:10px;box-shadow:none" data-act="chat-practice">Mashqni boshlash</button>
          </div></div>
        <div class="stack" style="margin-top:auto;gap:8px">
          <button class="btn btn-sec btn-sm btn-block" data-act="quiz-weak" ${S.weakIds().length ? "" : "disabled"}>Zaif so'zlar bilan mashq</button>
          <button class="btn btn-sec btn-sm btn-block" data-act="tutor-quiz">AI quiz yaratish</button>
        </div>
      </aside>
    </div>`;
  };
})();
