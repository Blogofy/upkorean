// Main app screens: shell, dashboard (B1), course (C1, C2), day complete (D7), review & quiz hubs (E1, E2),
// progress (G1), library (G2), achievements (G3) and profile (G4).
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const V = (window.V = window.V || {});
  const Actions = (window.Actions = window.Actions || {});
  const Changes = (window.Changes = window.Changes || {});
  const Inputs = (window.Inputs = window.Inputs || {});
  const Forms = (window.Forms = window.Forms || {});

  // ---------- Small pieces ----------
  V.mbar = (id, sm) => {
    const s = S.mastery(id), weak = S.isWeak(id), m = S.isMastered(id);
    return `<span class="mbar ${weak ? "weak" : ""} ${sm ? "sm" : ""}" title="Mastery ${s}/5">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= s ? (m ? "on m" : "on") : ""}"></i>`).join("")}</span>`;
  };
  const dot = (kind) => `<span style="width:7px;height:7px;border-radius:99px;flex:none;background:${kind === "ok" ? "var(--ok)" : kind === "pd" ? "var(--pd)" : "var(--p)"}"></span>`;
  const toggle = (on, act, k, label) => `<button class="toggle ${on ? "on" : ""}" data-act="${act}" data-k="${k}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}"></button>`;
  const initial = () => esc((S.state.profile.name || "?").trim().charAt(0).toUpperCase());
  const firstName = () => esc((S.state.profile.name || "").split(" ")[0]);

  // ---------- Shell ----------
  const NAV = [
    ["dashboard", "Dashboard"], ["course", "30 kunlik kurs"], ["review", "Takrorlash"], ["quiz", "Mashqlar"],
    ["tutor", "AI Tutor"], ["library", "So'zlar bazasi"], null, ["progress", "Progress"], ["achievements", "Yutuqlar"],
  ];
  V.shell = (active, top, body) => {
    const lv = S.levelInfo();
    const due = S.dueIds().length;
    const nav = NAV.map((n) => {
      if (!n) return `<div class="div"></div>`;
      const [k, label] = n;
      let extra = "";
      if (k === "course") extra = `<span class="cnt">${S.daysDone()}/${S.DAYS}</span>`;
      if (k === "review" && due) extra = `<span class="badge">${due}</span>`;
      if (k === "tutor") extra = `<span class="cnt">tez kunda</span>`;
      return `<a href="#/${k}" class="${active === k ? "on" : ""}">${label}${extra}</a>`;
    }).join("");
    return `<div class="shell">
      <aside class="side" id="side">
        <a href="#/dashboard" class="brand" style="color:inherit"><div class="mark"></div><span class="name">UpKorean</span></a>
        <nav class="nav" aria-label="Asosiy">${nav}</nav>
        <div class="side-foot">
          <a href="#/achievements" class="lvl" style="color:inherit">
            <div class="row between" style="align-items:baseline"><span style="font-size:12px;font-weight:700">Level ${lv.level}</span>
              <span class="mono muted" style="font-size:11px">${U.num(lv.xp)} / ${U.num(lv.next)}</span></div>
            <div class="prog"><div style="width:${lv.pct}%"></div></div>
          </a>
          <div class="row" style="gap:6px">
            <a href="#/profile" class="me grow" style="color:inherit">
              <div class="avatar">${initial()}</div>
              <div class="grow"><div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${firstName()}</div>
                <div class="faint" style="font-size:11px">TOPIK II</div></div>
            </a>
            <button class="iconbtn" data-act="theme-toggle" title="Tema" aria-label="Temani almashtirish">◐</button>
          </div>
        </div>
      </aside>
      <div class="main">${top}${body}</div>
    </div>`;
  };
  V.topbar = (title, sub, right = "") => `<header class="topbar">
      <button class="iconbtn menu-btn" data-act="menu" aria-label="Menyu">☰</button>
      <span class="title">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ""}
      <div class="right">${right}
        <div class="pill streak" title="Kunlik streak"><span>streak</span><b>${S.streak()}</b></div>
        <div class="pill xp hide-sm"><span>XP</span><b>${U.num(S.state.xp)}</b></div>
        ${S.offline ? `<span class="offline-pill" title="Progress qurilmada saqlanadi va internet qaytganda sinxronlanadi">offline</span>` : ""}
        ${S.syncError && !S.offline ? `<span class="badge-bad" title="Progress serverga saqlanmadi — qayta urinilmoqda">sync</span>` : ""}
      </div></header>`;

  Actions.menu = () => document.getElementById("side").classList.toggle("open");
  Actions["theme-toggle"] = () => { S.setTheme(S.state.settings.theme === "dark" ? "light" : "dark"); App.render(); };

  // ---------- Dashboard (B1) ----------
  function nextStage(d) {
    const ds = S.dayState(d), plan = S.dayPlan(d);
    return { ds, plan, stage: ds.done ? null : plan.stages[ds.stage] };
  }
  const ORD = ["Birinchi", "Ikkinchi", "Uchinchi"];

  V.dashboard = () => {
    const cd = S.currentDay(), done = S.courseDone();
    const { ds, plan, stage } = nextStage(cd);
    const due = S.dueIds().length, weak = S.weakIds();
    const learned = S.learnedIds().length, mastered = S.masteredIds().length, acc = S.accuracy();
    const remaining = plan.words.filter((id) => !S.isLearned(id)).length;
    const wk = U.dur(S.totalMinutes(U.weekStart(U.today())));
    const ch = S.challenge();

    let hero;
    if (done) {
      hero = `<div class="hero" style="margin-bottom:16px"><div>
        <div class="eyebrow">${S.DAYS} / ${S.DAYS} · KURS TUGADI</div>
        <div class="row" style="align-items:baseline;gap:10px;margin-bottom:5px"><span class="big">${S.TOTAL}</span><span class="bigsub">so'z o'rganildi</span></div>
        <p>Endi asosiy ish — takrorlash. Mastery'ga yetmagan so'zlarni har kuni mustahkamlang.</p>
        <div class="row wrap"><button class="btn btn-pd" data-act="review-start" data-mode="due" ${due ? "" : "disabled"}>Takrorlash · ${due}</button>
        <a class="btn btn-glass" href="#/quiz">Mashqlar</a></div></div><div class="wm">졸업</div></div>`;
    } else {
      const block = stage.block >= 0 ? plan.blocks[stage.block] : plan.words;
      const sample = block.slice(0, 3).map((id) => S.word(id).ko).join(", ");
      let big, bigsub, text;
      if (stage.kind === "learn") { big = block.length; bigsub = "yangi so'z"; text = `${ORD[stage.block] || `${stage.block + 1}-`} blok: ${esc(sample)}${block.length > 3 ? ` va yana ${block.length - 3} so'z.` : "."}`; }
      else if (stage.kind === "recall") { big = block.length; bigsub = "so'z · active recall"; text = `${ORD[stage.block] || ""} blok so'zlarini mashq bilan mustahkamlash — ~${stage.min} daqiqa.`; }
      else { big = Math.min(12, plan.words.length); bigsub = "savol · mixed quiz"; text = `Kunning oxirgi bosqichi — barcha ${plan.words.length} so'z bo'yicha aralash test.`; }
      hero = `<div class="hero" style="margin-bottom:16px"><div style="min-width:0">
        <div class="eyebrow">DAY ${cd} / ${S.DAYS} · BUGUNGI DARS</div>
        <div class="row" style="align-items:baseline;gap:10px;margin-bottom:5px"><span class="big">${big}</span><span class="bigsub">${bigsub}</span></div>
        <p>${text}</p>
        <div class="bar"><div style="width:${U.pct(ds.stage, plan.stages.length)}%"></div></div>
        <div class="row wrap">
          <button class="btn btn-pd" data-act="learn" data-day="${cd}">${ds.stage ? "Davom etish" : "Darsni boshlash"}</button>
          <button class="btn btn-glass" data-act="review-start" data-mode="due" ${due ? "" : "disabled"}>Takrorlash · ${due}</button>
        </div></div><div class="wm">오늘</div></div>`;
    }

    const squares = Array.from({ length: S.DAYS }, (_, i) => { const d = i + 1, st = S.dayStatus(d); return `<a class="dsq ${st}" ${st === "locked" ? `aria-disabled="true" title="Day ${d} — yopiq"` : `href="#/day/${d}" title="Day ${d}"`}>${d}</a>`; }).join("");
    const weakList = weak.slice(0, 3);
    const logs = S.state.log.slice(0, 3);
    const week = S.weekRhythm();
    const maxMin = Math.max(20, ...week.map((w) => w.min));
    const goalMin = (S.PACES[S.state.profile.pace] || S.PACES[17]).min;

    const body = `<div class="page">
      <div style="margin-bottom:16px">
        <h3 class="page-h">Salom, ${firstName()}</h3>
        <p class="page-p">${done ? `Kurs tugadi — bugun ${due} ta takrorlash kutmoqda.` : `Day ${cd} — ${remaining} so'z bugun${due ? `, kechqurun ${due} ta takrorlash` : ""}.`}</p>
      </div>
      ${hero}
      <div class="strip" style="margin-bottom:16px">
        <div><div class="upl s">O'rganilgan</div><div class="v"><b>${learned}</b><span>/ ${S.TOTAL}</span></div></div>
        <div><div class="upl s">Mastered</div><div class="v"><b>${mastered}</b><span>so'z</span></div></div>
        <div><div class="upl s">Aniqlik</div><div class="v"><b>${acc ?? "—"}</b><span>${acc === null ? "" : "%"}</span></div></div>
        <div><div class="upl s">Bu hafta</div><div class="v"><b>${wk.v}</b><span>${wk.u}</span></div></div>
        <div><div class="upl s">Zaif so'zlar</div><div class="v"><b class="${weak.length ? "badc" : ""}">${weak.length}</b><span>ta</span></div></div>
      </div>
      <div class="collapse-md" style="display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:22px">
        <div style="min-width:0">
          <div class="row between" style="margin-bottom:11px"><span class="card-title">${S.DAYS} kunlik yo'l</span><a class="link" href="#/course">Butun kursni ko'rish</a></div>
          <div class="days" style="margin-bottom:16px">${squares}</div>
          <div class="row between" style="margin-bottom:11px"><span class="card-title">Zaif so'zlar</span>
            ${weak.length ? `<button class="link" data-act="quiz-weak">${weak.length} tasini mashq qilish</button>` : ""}</div>
          <div class="list">${weakList.length ? weakList.map((id) => { const w = S.word(id), st = S.ws(id); return `<button class="li" data-act="word" data-id="${id}">
              <span class="kw" style="min-width:88px">${esc(w.ko)}</span><span class="mean">${esc(w.uz)}</span>${V.mbar(id)}
              <span class="meta" style="min-width:52px">${st.bad} xato</span></button>`; }).join("")
            : `<div class="empty">Hozircha zaif so'zlar yo'q — 2+ marta xato qilingan so'zlar shu yerda chiqadi.</div>`}</div>
        </div>
        <div style="min-width:0">
          <div class="card-title" style="margin-bottom:11px">So'nggi faollik</div>
          <div class="card" style="padding:4px 18px;margin-bottom:16px">
            ${logs.length ? logs.map((l, i) => `<div class="row" style="gap:12px;padding:12px 0;${i < logs.length - 1 ? "border-bottom:1px solid var(--line)" : ""}">${dot(l.kind)}
              <span class="grow" style="font-size:13px">${esc(l.text)}</span><span class="mono faint" style="font-size:11px">${U.relTime(l.t)}</span></div>`).join("")
            : `<div class="empty" style="padding:18px 0">Birinchi darsdan keyin faollik shu yerda ko'rinadi.</div>`}
          </div>
          <div class="card pad" style="padding:18px;margin-bottom:16px">
            <div class="row between" style="margin-bottom:14px"><span class="card-title">Haftalik ritm</span>
              <span class="mono faint" style="font-size:11px">${week.filter((w) => w.min >= 1 || w.words).length} / 7 kun</span></div>
            <div class="bars" style="height:72px">${week.map((w) => {
              const h = w.min >= 1 ? Math.max(8, Math.round((w.min / maxMin) * 56)) : 6;
              const cls = w.min < 1 ? "zero" : w.today && w.min < goalMin ? "cur" : "";
              return `<div class="col" title="${w.lbl}: ${Math.round(w.min)} daq"><div class="${cls}" style="height:${h}px"></div><span class="${w.today ? "cur" : ""}">${w.lbl}</span></div>`; }).join("")}</div>
          </div>
          <div class="card pad" style="padding:18px">
            <div class="row between" style="margin-bottom:12px"><span class="card-title">Kunlik challenge</span>
              <span class="mono ${ch.done ? "okc" : "accent"}" style="font-size:12px">${ch.done ? "bajarildi" : `+${ch.reward} XP`}</span></div>
            <div class="stack" style="gap:10px">${ch.items.map((i) => `<div><div class="row between" style="margin-bottom:5px"><span style="font-size:13px">${esc(i.label)}</span>
              <span class="mono ${i.cur >= i.goal ? "okc" : "faint"}" style="font-size:11px">${i.cur >= i.goal ? "✓" : `${i.cur}/${i.goal}`}</span></div>
              <div class="prog" style="height:5px"><div style="width:${U.pct(i.cur, i.goal)}%;${i.cur >= i.goal ? "background:var(--ok)" : ""}"></div></div></div>`).join("")}</div>
          </div>
        </div>
      </div></div>`;
    return V.shell("dashboard", V.topbar("Dashboard", U.fmtLong(U.today())), body);
  };

  // ---------- Course roadmap (C1) ----------
  let courseAll = false;
  V.course = () => {
    const cur = S.currentDay();
    const shown = courseAll ? S.DAYS : Math.min(S.DAYS, Math.max(12, Math.ceil((cur + 2) / 6) * 6));
    const tile = (d) => {
      const st = S.dayStatus(d), ds = S.dayState(d), words = S.DAY_WORDS[d - 1], n = words.length;
      const head = S.DAY_WORDS[d - 1][0].ko;
      if (st === "locked") return `<div class="dtile locked" aria-disabled="true"><div class="dn">DAY ${d}</div><div class="dw">${esc(head)}</div><div class="ds">yopiq</div></div>`;
      let sub = "", right = "";
      if (st === "mastered") { sub = `${n} so'z · mastered`; right = "✓"; }
      else if (st === "completed") { sub = `${n} so'z · ${U.pct(ds.ok || 0, (ds.ok || 0) + (ds.bad || 0)) || 100}%`; right = "✓"; }
      else if (st === "progress") { sub = `${S.dayLearned(d)} / ${n} so'z`; right = d === cur ? `<span style="font-size:11px;font-weight:700;color:var(--pd)">bugun</span>` : ""; }
      else sub = `${n} so'z · ochiq`;
      const plan = st === "progress" ? S.dayPlan(d) : null;
      return `<a href="#/day/${d}" class="dtile ${st}" style="color:inherit"><div class="dn"><span>DAY ${d}</span><span>${right}</span></div>
        <div class="dw">${esc(head)}</div><div class="ds">${sub}</div>
        ${plan ? `<div class="mini"><div style="width:${U.pct(ds.stage || 0, plan.stages.length)}%"></div></div>` : ""}</a>`;
    };
    const body = `<div class="page" style="padding:32px">
      <div class="row wrap between" style="align-items:flex-end;margin-bottom:22px;gap:16px">
        <div><h3 class="page-h" style="font-size:26px">TOPIK II vocabulary · ${S.DAYS} kun</h3>
          <p class="page-p">Har kunda ~33 so'z. Kun tugallanishi uchun learn + recall bosqichlari kerak.</p></div>
        <div class="legend">
          <span><i style="background:var(--pdb)"></i>Mastered</span><span><i style="background:var(--p)"></i>Completed</span>
          <span><i style="background:var(--pl);border:1.5px solid var(--p)"></i>In progress</span>
          <span><i style="background:var(--sf);border:1px solid var(--line)"></i>Available</span><span><i style="background:var(--sf2);border:1px solid var(--line)"></i>Locked</span>
        </div>
      </div>
      <div class="dgrid">${Array.from({ length: shown }, (_, i) => tile(i + 1)).join("")}</div>
      ${shown < S.DAYS ? `<div class="card row wrap" style="gap:14px;margin-top:20px;padding:18px 22px">
        <span class="mono faint" style="font-size:12px">DAY ${shown + 1} — ${S.DAYS}</span>
        <span class="grow muted" style="font-size:14px">Qolgan ${S.DAYS - shown} kun ketma-ket ochiladi: joriy kundan 2 kun oldinga o'tish mumkin.</span>
        <button class="link" data-act="course-all">Hammasini ko'rish</button></div>` : ""}
    </div>`;
    return V.shell("course", V.topbar("30 kunlik kurs", `${S.learnedIds().length} / ${S.TOTAL} so'z`), body);
  };
  Actions["course-all"] = () => { courseAll = true; App.render(); };

  // ---------- Day detail (C2) ----------
  let dayAllWords = false;
  V.day = (d) => {
    if (!(d >= 1 && d <= S.DAYS)) return V.notFound();
    const st = S.dayStatus(d), { ds, plan, stage } = nextStage(d);
    const locked = st === "locked";
    const words = plan.words;
    const shownWords = dayAllWords ? words : words.slice(0, 14);
    const started = !!S.state.days[d];
    const cta = locked ? `<button class="btn btn-p" disabled>Yopiq</button>`
      : ds.done ? `<button class="btn btn-p" data-act="learn" data-day="${d}">Kunni qayta mashq qilish</button>`
      : `<button class="btn btn-p" data-act="learn" data-day="${d}">${stage.kind === "learn" ? `${ORD[stage.block] || ""} blokni boshlash` : `${stage.label}ni boshlash`}</button>`;
    const pill = ds.done ? "tugallangan" : d === S.currentDay() ? "bugungi kun" : locked ? "yopiq" : "ochiq";
    const body = `<div class="page collapse-md" style="padding:36px 48px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:44px">
      <div style="min-width:0">
        <div class="row wrap between" style="align-items:flex-end;margin-bottom:24px;gap:16px">
          <div><div class="eyebrow" style="margin-bottom:10px">DAY ${d} / ${S.DAYS}</div>
            <h3 class="page-h" style="font-size:30px;margin-bottom:6px">${esc(S.dayTitle(d))}</h3>
            <p class="page-p">${words.length} so'z · ${plan.blocks.length} blok · ~${plan.minutes} daqiqa</p></div>
          ${cta}
        </div>
        ${locked ? `<div class="card pad" style="margin-bottom:16px;background:var(--sf2)"><span class="muted">Bu kun Day ${d - 2} tugagandan keyin ochiladi. Hozirgi kun: <a href="#/day/${S.currentDay()}">Day ${S.currentDay()}</a>.</span></div>` : ""}
        <div class="wgrid">${shownWords.map((id) => { const w = S.word(id); return `<button class="wtile" data-act="word" data-id="${id}">
            <div class="k">${esc(w.ko)}</div><div class="row between" style="gap:8px"><span class="u">${esc(w.uz)}</span>${S.isLearned(id) ? V.mbar(id, true) : ""}</div></button>`; }).join("")}
          ${!dayAllWords && words.length > 14 ? `<button class="wtile" style="display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--pd)" data-act="day-all">+${words.length - 14} so'z</button>` : ""}
        </div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card pad">
          <div class="card-title" style="margin-bottom:16px">Kun bosqichlari</div>
          <div class="stack" style="gap:14px">${plan.stages.map((sg, i) => {
            const isDone = ds.done || i < ds.stage, isCur = !ds.done && i === ds.stage;
            return `<div class="row" style="gap:12px"><span style="width:24px;height:24px;border-radius:99px;flex:none;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;
              background:${isDone ? "var(--p)" : isCur ? "var(--pl)" : "var(--bg)"};color:${isDone ? "#fff" : isCur ? "var(--pd)" : "var(--ink3)"}">${isDone ? "✓" : i + 1}</span>
              <span class="grow" style="font-size:14px;${isCur ? "font-weight:600" : "color:var(--ink2)"}">${esc(sg.label)}</span>
              <span class="mono faint" style="font-size:11px">${sg.min} daq</span></div>`; }).join("")}</div>
        </div>
        <div class="card-pl" style="padding:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px">Spaced repetition</div>
          <p style="margin:0;font-size:13px;line-height:1.55">Bugungi so'zlar 1, 3, 7 va 16-kunlarda avtomatik qaytariladi. Xato qilgan so'z ertaga yana chiqadi.</p>
        </div>
        <div class="card pad">
          <div style="font-size:13px;font-weight:700;margin-bottom:10px">Blok o'lchami</div>
          <div class="picks">${[11, 17, 33].map((n) => `<button class="${plan.pace === n ? "on" : ""}" data-act="day-pace" data-day="${d}" data-v="${n}" ${started && (ds.stage > 0 || ds.done) ? "disabled" : ""}>${n}</button>`).join("")}</div>
          ${started && (ds.stage > 0 || ds.done) ? `<div class="faint" style="font-size:12px;margin-top:8px">Kun boshlangan — o'lcham keyingi kunlarga Profil'dan o'zgartiriladi.</div>` : ""}
        </div>
      </div></div>`;
    const top = `<header class="topbar"><a class="back" href="#/course">← 30 kunlik kurs</a><span class="sub" style="display:inline">DAY ${d}</span>
      <div class="right"><div class="pill streak">${pill}</div></div></header>`;
    return `<div class="main" style="min-height:100vh">${top}${body}</div>`;
  };
  Actions["day-all"] = () => { dayAllWords = true; App.render(); };
  Actions["day-pace"] = (el) => {
    const d = Number(el.dataset.day), v = Number(el.dataset.v);
    S.state.days[d] = Object.assign(S.state.days[d] || { stage: 0, done: false, ok: 0, bad: 0, min: 0, xp: 0 }, { pace: v });
    S.state.profile.pace = v;
    S.save(); App.render();
  };
  Actions.learn = (el) => X.startLearn(Number(el.dataset.day));
  Actions["learn-continue"] = (el) => X.startLearn(Number(el.dataset.day));

  // ---------- Day complete (D7) ----------
  V.complete = (d) => {
    const ds = S.dayState(d);
    if (!ds.done) return V.day(d);
    const words = S.DAY_WORDS[d - 1];
    const acc = U.pct(ds.ok || 0, (ds.ok || 0) + (ds.bad || 0));
    const t = U.dur(Math.max(1, ds.min || 0));
    const weak = words.filter((w) => { const st = S.ws(w.id); return st && st.bad > 0 && st.s <= 1; }).sort((a, b) => S.ws(b.id).bad - S.ws(a.id).bad);
    const buckets = [["ertaga", 1, 1], ["3 kun", 2, 3], ["7 kun", 4, 7], ["keyinroq", 8, 999]].map(([lbl, a, b]) => {
      const n = words.filter((w) => { const st = S.ws(w.id); if (!st || !st.due) return false; const k = U.diffDays(U.today(), st.due); return k >= a && k <= b; }).length;
      return [lbl, n];
    }).filter(([, n]) => n > 0);
    return `<div class="ex"><div class="ex-body"><div style="width:100%;max-width:960px">
      <div class="center" style="margin-bottom:34px">
        <div class="done-glyph">완료</div>
        <h3 style="margin:0 0 8px;font-size:36px;font-weight:800;letter-spacing:-.035em">Day ${d} tugadi</h3>
        <p class="muted" style="margin:0;font-size:16px">${words.length} so'z o'rganildi. Streak ${S.streak()} kunga yetdi.</p>
      </div>
      <div class="strip lg" style="margin-bottom:20px">
        <div><div class="upl s">Aniqlik</div><div class="v"><b>${acc}</b><span>%</span></div></div>
        <div><div class="upl s">Vaqt</div><div class="v"><b>${t.v}</b><span>${t.u}</span></div></div>
        <div><div class="upl s">XP</div><div class="v"><b class="accent">+${ds.xp || 0}</b></div></div>
        <div><div class="upl s">Zaif so'z</div><div class="v"><b class="${weak.length ? "badc" : ""}">${weak.length}</b><span>ta</span></div></div>
      </div>
      <div class="collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;margin-bottom:28px">
        <div class="card" style="padding:22px 24px;border-radius:16px">
          <div class="card-title" style="margin-bottom:14px">Qayta ko'rish kerak</div>
          <div class="stack" style="gap:11px">${weak.length ? weak.slice(0, 4).map((w) => `<div class="row" style="gap:14px"><span class="ko" style="font-size:18px;font-weight:700;min-width:84px">${esc(w.ko)}</span>
            <span class="grow muted" style="font-size:14px">${esc(w.uz)}</span><span class="mono badc" style="font-size:11px">${S.ws(w.id).bad} xato</span></div>`).join("")
            : `<div class="muted" style="font-size:14px">Barcha so'zlar yaxshi o'zlashtirildi.</div>`}</div>
        </div>
        <div class="card-pl" style="padding:22px 24px;border-radius:16px">
          <div style="font-size:14px;font-weight:700;color:var(--on-pl);margin-bottom:14px">Keyingi takrorlash rejasi</div>
          <div class="stack" style="gap:11px">${buckets.map(([lbl, n]) => `<div class="row" style="gap:12px"><span class="mono accent" style="font-size:12px;min-width:70px">${lbl}</span><span class="grow" style="font-size:14px">${n} so'z</span></div>`).join("")}</div>
        </div>
      </div>
      <div class="row wrap" style="justify-content:center;gap:12px">
        ${weak.length ? `<button class="btn btn-p" data-act="quiz-ids" data-ids="${weak.map((w) => w.id).join(",")}">${weak.length} zaif so'zni mashq qilish</button>`
          : d < S.DAYS ? `<a class="btn btn-p" href="#/day/${d + 1}">Day ${d + 1} ga o'tish</a>` : ""}
        <a class="btn btn-sec" href="#/tutor">AI Tutor · tez kunda</a>
        <a class="btn btn-ghost" href="#/dashboard">Dashboard</a>
      </div></div></div></div>`;
  };

  // ---------- Review hub (E1) ----------
  let reviewTab = "due", reviewAll = false;
  V.review = () => {
    const lists = { due: S.dueIds(), weak: S.weakIds(), flag: S.flaggedIds(), forgot: S.forgottenIds() };
    const due = lists.due;
    const weakDue = due.filter(S.isWeak).length;
    const days = [...new Set(due.map((id) => S.word(id).day))].sort((a, b) => a - b);
    const range = days.length ? (days.length === 1 ? `Day ${days[0]}` : `Day ${days[0]}–${days[days.length - 1]}`) : "";
    const cards = [
      ["due", "Due today", "interval kelgan so'zlar"], ["weak", "Weak", "2+ marta xato"],
      ["flag", "Difficult", "o'zim belgilaganlar"], ["forgot", "Forgotten", "mastery tushgan"],
    ];
    const rows = lists[reviewTab];
    const shown = reviewAll ? rows : rows.slice(0, 8);
    const body = `<div class="page">
      <div class="hero" style="grid-template-columns:minmax(0,1fr) 240px;padding:26px 34px;margin-bottom:18px"><div>
        <div class="eyebrow">KUNLIK TAKRORLASH SESSIYASI</div>
        <div class="row" style="align-items:baseline;gap:10px;margin-bottom:6px"><span class="big" style="font-size:50px">${due.length}</span><span class="bigsub" style="font-size:20px">so'z kutilmoqda</span></div>
        <p style="margin-bottom:20px">${due.length ? `${range} dan ${due.length - weakDue} so'z${weakDue ? `, ${weakDue} zaif so'z` : ""}. Taxminan ${Math.max(1, Math.round(due.length * 0.37))} daqiqa.` : "Bugungi takrorlash tugagan. Ertaga yangi so'zlar keladi."}</p>
        <div class="row wrap">
          <button class="btn btn-pd" data-act="review-start" data-mode="due" ${due.length ? "" : "disabled"}>Sessiyani boshlash</button>
          <button class="btn btn-glass" data-act="review-start" data-mode="weak" ${lists.weak.length ? "" : "disabled"}>Faqat zaiflarini</button>
        </div></div><div class="wm" style="font-size:80px;line-height:.9">복습</div></div>
      <div class="two-sm" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px">
        ${cards.map(([k, t, d]) => `<button class="card" style="padding:18px 22px;text-align:left;${reviewTab === k ? "border:1.5px solid var(--p)" : ""}" data-act="review-tab" data-k="${k}">
          <div class="upl s" style="${reviewTab === k ? "color:var(--pd)" : ""};margin-bottom:10px">${t}</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-.035em;margin-bottom:5px;${k === "weak" && lists.weak.length ? "color:var(--bad)" : ""}">${lists[k].length}</div>
          <div class="muted" style="font-size:13px">${d}</div></button>`).join("")}
      </div>
      <div class="row between" style="margin-bottom:12px">
        <span class="card-title">${{ due: "Bugun kutilayotgan so'zlar", weak: "Zaif so'zlar", flag: "Belgilangan so'zlar", forgot: "Esdan chiqqan so'zlar" }[reviewTab]}</span>
        ${reviewTab !== "due" && rows.length ? `<button class="link" data-act="review-start" data-mode="${reviewTab}">Shularni mashq qilish</button>` : `<span class="mono faint hide-sm" style="font-size:12px">mastery · oxirgi ko'rish · keyingi</span>`}
      </div>
      <div class="list">${shown.length ? shown.map((id) => {
        const w = S.word(id), st = S.ws(id), late = st.due < U.today();
        return `<button class="li ${late ? "bad" : ""}" style="gap:18px;padding:13px 20px" data-act="word" data-id="${id}">
          <span class="mono ${late ? "badc" : "faint"}" style="font-size:11px;min-width:44px">D${w.day}</span>
          <span class="kw">${esc(w.ko)}</span><span class="mean" style="${late ? "color:var(--badd)" : ""}">${esc(w.uz)}</span>
          ${V.mbar(id)}
          <span class="meta hide-sm" style="min-width:70px">${U.ago(st.last)}</span>
          <span class="meta" style="min-width:64px;color:${late ? "var(--bad)" : st.due <= U.today() ? "var(--pd)" : "var(--ink3)"}">${U.dueLabel(st.due)}</span></button>`; }).join("")
        : `<div class="empty">Bu ro'yxat hozircha bo'sh.</div>`}</div>
      ${rows.length > shown.length ? `<div class="center" style="margin-top:12px"><button class="mono faint" style="font-size:12px" data-act="review-all">+${rows.length - shown.length} so'z</button></div>` : ""}
    </div>`;
    return V.shell("review", V.topbar("Takrorlash", `${due.length} so'z bugun kutilmoqda`), body);
  };
  Actions["review-tab"] = (el) => { reviewTab = el.dataset.k; reviewAll = false; App.render(); };
  Actions["review-all"] = () => { reviewAll = true; App.render(); };
  Actions["review-start"] = (el) => X.startReview(el.dataset.mode || "due");

  // ---------- Quiz hub (E2) ----------
  const quizCfg = { type: "mixed", source: "all", days: [], count: 20, timer: false, instant: true };
  function quizPool() {
    if (quizCfg.source === "weak") return S.weakIds();
    if (quizCfg.source === "days") return S.learnedIds().filter((id) => quizCfg.days.includes(S.word(id).day));
    return S.learnedIds();
  }
  function checkpointInfo() {
    const done = S.daysDone();
    const block = Math.floor(done / 6);
    if (!block) return { open: false, text: "Day 6 dan keyin ochiladi — 6 kunlik material." };
    const a = (block - 1) * 6 + 1, b = block * 6;
    return { open: true, a, b, text: `Day ${a}–${b} bo'yicha nazorat — 6 kunlik material.` };
  }
  V.quiz = () => {
    const learned = S.learnedIds();
    const pool = quizPool();
    const cp = checkpointInfo();
    const sentCount = pool.filter((id) => S.clozeExample(id)).length;
    const types = Object.entries(X.QUIZ_TYPES);
    const minsFor = (k) => Math.max(1, Math.round(quizCfg.count * X.QUIZ_TYPES[k].mins));
    const card = ([k, t]) => {
      const on = quizCfg.type === k;
      if (k === "checkpoint" && !cp.open) return `<div class="ocard dim"><div class="t" style="margin:0 0 10px">${t.name}</div><p class="d" style="margin:0 0 12px">${cp.text}</p><div class="mono faint" style="font-size:12px">yopiq</div></div>`;
      const n = k === "sent" ? Math.min(quizCfg.count, sentCount) : k === "checkpoint" ? 30 : Math.min(quizCfg.count, pool.length);
      return `<button class="ocard ${on ? "on" : ""}" data-act="quiz-type" data-k="${k}" style="padding:22px 24px">
        <div class="row between" style="margin-bottom:10px"><span style="font-size:16px;font-weight:700">${t.name}${t.ko ? ` <span class="ko faint" style="font-size:14px;font-weight:400;margin-left:6px">${t.ko}</span>` : ""}</span>
          ${k === "mixed" ? `<span class="tag">tavsiya</span>` : ""}</div>
        <p class="d" style="margin:0 0 12px">${k === "checkpoint" ? cp.text : t.desc}</p>
        <div class="mono faint" style="font-size:12px">${k === "sent" && !sentCount ? "misol gaplar yo'q" : `${n} savol · ~${minsFor(k)} daq`}</div></button>`;
    };
    const recent = S.state.quizResults.slice(0, 3);
    const body = learned.length < 4 ? `<div class="page"><div class="card pad center" style="max-width:560px;margin:40px auto;padding:40px">
        <div class="done-glyph" style="font-size:44px">연습</div><h3 style="margin:0 0 8px;font-size:22px">Mashq uchun so'z yo'q</h3>
        <p class="muted" style="margin:0 0 20px">Avval kunlik darsda kamida 4 ta so'z o'rganing.</p>
        <button class="btn btn-p" data-act="learn" data-day="${S.currentDay()}">Day ${S.currentDay()} ni boshlash</button></div></div>`
      : `<div class="page collapse-md" style="padding:36px 48px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:44px">
      <div style="min-width:0">
        <h3 class="page-h">Mashq turini tanlang</h3>
        <p class="page-p" style="margin-bottom:26px">Har bir mashq natijasi so'z mastery'siga yoziladi.</p>
        <div class="two-sm" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${types.map(card).join("")}</div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:16px">Sozlamalar</div>
          <div style="font-size:12px;font-weight:600;color:var(--ink3);margin-bottom:8px">So'z manbasi</div>
          <div class="stack" style="gap:6px;margin-bottom:${quizCfg.source === "days" ? 10 : 20}px">
            ${[["all", `Hamma o'rganilgan (${learned.length})`], ["weak", `Faqat zaif so'zlar (${S.weakIds().length})`], ["days", "Tanlangan kunlar"]].map(([k, l]) =>
              `<button class="chip ${quizCfg.source === k ? "on" : ""}" style="border-radius:10px;padding:11px 14px;font-size:14px;justify-content:flex-start" data-act="quiz-src" data-k="${k}">${l}</button>`).join("")}
          </div>
          ${quizCfg.source === "days" ? `<div class="days" style="margin-bottom:20px">${[...new Set(learned.map((id) => S.word(id).day))].sort((a, b) => a - b).map((d) =>
            `<button class="dsq ${quizCfg.days.includes(d) ? "completed" : "available"}" data-act="quiz-day" data-d="${d}">${d}</button>`).join("")}</div>` : ""}
          <div style="font-size:12px;font-weight:600;color:var(--ink3);margin-bottom:8px">Savol soni</div>
          <div class="picks" style="margin-bottom:20px">${[10, 20, 40].map((n) => `<button class="${quizCfg.count === n ? "on" : ""}" data-act="quiz-count" data-n="${n}">${n}</button>`).join("")}</div>
          <div class="row between" style="padding:12px 0;border-top:1px solid var(--line)"><span>Vaqt chegarasi <span class="faint" style="font-size:12px">· 20s</span></span>${toggle(quizCfg.timer, "quiz-opt", "timer", "Vaqt chegarasi")}</div>
          <div class="row between" style="padding:12px 0;border-top:1px solid var(--line)"><span>Darhol javob ko'rsatish</span>${toggle(quizCfg.instant, "quiz-opt", "instant", "Darhol javob")}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:14px">Oxirgi natijalar</div>
          <div class="stack" style="gap:12px">${recent.length ? recent.map((r) => { const p = U.pct(r.ok, r.total); return `<div class="row" style="gap:12px">
            <span class="grow muted" style="font-size:13px">${esc((X.QUIZ_TYPES[r.type] || { name: r.type }).name)}</span>
            <span class="mono" style="font-size:13px;font-weight:500;color:${p >= 85 ? "var(--ok)" : p < 70 ? "var(--bad)" : "var(--ink)"}">${r.ok}/${r.total}</span></div>`; }).join("")
            : `<div class="faint" style="font-size:13px">Hali mashq qilinmagan.</div>`}</div>
        </div>
        <button class="btn btn-p" style="padding:16px 22px" data-act="quiz-start" ${quizCfg.type === "checkpoint" || pool.length >= 4 || (quizCfg.type === "sent" && sentCount) ? "" : "disabled"}>${esc(X.QUIZ_TYPES[quizCfg.type].name)}'ni boshlash</button>
        ${pool.length < 4 && quizCfg.type !== "checkpoint" ? `<div class="faint center" style="font-size:12px;margin-top:-6px">Tanlangan manbada so'z yetarli emas</div>` : ""}
      </div></div>`;
    return V.shell("quiz", V.topbar("Mashqlar", `${learned.length} o'rganilgan so'z bazasidan`), body);
  };
  Actions["quiz-type"] = (el) => { quizCfg.type = el.dataset.k; App.render(); };
  Actions["quiz-src"] = (el) => { quizCfg.source = el.dataset.k; App.render(); };
  Actions["quiz-day"] = (el) => { const d = Number(el.dataset.d); const i = quizCfg.days.indexOf(d); if (i >= 0) quizCfg.days.splice(i, 1); else quizCfg.days.push(d); App.render(); };
  Actions["quiz-count"] = (el) => { quizCfg.count = Number(el.dataset.n); App.render(); };
  Actions["quiz-opt"] = (el) => { quizCfg[el.dataset.k] = !quizCfg[el.dataset.k]; App.render(); };
  Actions["quiz-start"] = () => {
    if (quizCfg.type === "checkpoint") {
      const cp = checkpointInfo();
      const ids = S.WORDS.filter((w) => w.day >= cp.a && w.day <= cp.b).map((w) => w.id);
      X.startQuiz({ type: "checkpoint", ids, count: 30, timer: quizCfg.timer, instant: quizCfg.instant, title: `Checkpoint · Day ${cp.a}–${cp.b}` });
      return;
    }
    X.startQuiz({ type: quizCfg.type, ids: quizPool(), count: quizCfg.count, timer: quizCfg.timer, instant: quizCfg.instant });
  };
  Actions["quiz-weak"] = () => X.startQuiz({ type: "mixed", ids: S.weakIds(), count: 20, title: "Zaif so'zlar" });
  Actions["quiz-ids"] = (el) => X.startQuiz({ type: "mixed", ids: el.dataset.ids.split(","), count: 40, title: "Xatolar ustida ishlash" });

  // ---------- Progress (G1) ----------
  let progRange = 30;
  V.progress = () => {
    const learned = S.learnedIds().length, mastered = S.masteredIds().length;
    const learning = learned - mastered;
    const today = U.today();
    const start = progRange === 0 ? (Object.keys(S.state.act).sort()[0] || today) : U.addDays(today, -(progRange - 1));
    const n = Math.min(60, Math.max(1, U.diffDays(start, today) + 1));
    const from = U.addDays(today, -(n - 1));
    const series = Array.from({ length: n }, (_, i) => { const k = U.addDays(from, i); const a = S.state.act[k] || { learned: 0, reviewed: 0 }; return { k, v: a.learned + a.reviewed, learned: a.learned }; });
    const max = Math.max(10, ...series.map((x) => x.v));
    const types = S.EX_TYPES.map((t) => ({ t, acc: S.typeAccuracy(t) })).filter((x) => x.acc !== null).sort((a, b) => b.acc - a.acc);
    const ft = S.state.firstTry;
    const masteredIds = S.masteredIds();
    const avgSeen = masteredIds.length ? (masteredIds.reduce((s, id) => s + S.ws(id).seen, 0) / masteredIds.length).toFixed(1) : "—";
    const learnedIds = S.learnedIds();
    const avgInt = learnedIds.length ? (learnedIds.reduce((s, id) => s + S.INTERVALS[S.ws(id).s], 0) / learnedIds.length).toFixed(1) : "—";
    const streak = S.streak();
    const wkStart = U.weekStart(today);
    const weekDays = Array.from({ length: 7 }, (_, i) => U.addDays(wkStart, i));
    const total = S.totalMinutes(), days = S.activeDays();
    const worst = types.length ? types[types.length - 1] : null;
    const tip = worst && worst.acc < 85
      ? `${S.TYPE_NAMES[worst.t]} aniqligi ${worst.acc}% — eng past ko'rsatkich. Kuniga 5 daqiqa ${S.TYPE_NAMES[worst.t].toLowerCase()} mashqi qo'shish tavsiya etiladi.`
      : learned ? "Barcha mashq turlarida natija yaxshi. Temp'ni saqlang va har kuni takrorlashni o'tkazib yubormang." : "Birinchi darsdan keyin shaxsiy tavsiyalar shu yerda chiqadi.";
    const body = `<div class="page wide collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:32px">
      <div style="min-width:0">
        <div class="row wrap" style="align-items:flex-end;gap:36px;margin-bottom:26px">
          <div><div class="upl s" style="margin-bottom:8px">Kurs bajarilishi</div>
            <div class="row" style="align-items:baseline;gap:6px"><span style="font-size:46px;font-weight:800;letter-spacing:-.04em;line-height:1">${U.pct(learned, S.TOTAL)}</span><span class="muted" style="font-size:20px">%</span></div>
            <div class="muted" style="font-size:13px;margin-top:4px">${learned} / ${S.TOTAL} so'z</div></div>
          <div class="grow" style="min-width:220px">
            <div style="height:14px;border-radius:8px;background:var(--line);overflow:hidden;display:flex">
              <div style="width:${(mastered / S.TOTAL) * 100}%;background:var(--pdb)"></div><div style="width:${(learning / S.TOTAL) * 100}%;background:var(--p)"></div></div>
            <div class="legend" style="margin-top:12px;gap:20px">
              <span style="font-size:13px"><i style="background:var(--pdb)"></i>Mastered ${mastered}</span>
              <span style="font-size:13px"><i style="background:var(--p)"></i>Learning ${learning}</span>
              <span style="font-size:13px"><i style="background:var(--line)"></i>Qolgan ${S.TOTAL - learned}</span></div>
          </div>
        </div>
        <div class="card" style="padding:22px 24px;margin-bottom:16px">
          <div class="row between" style="margin-bottom:20px"><span class="card-title">Kunlik faollik</span><span class="mono faint" style="font-size:12px">o'rganilgan + takrorlangan so'z / kun</span></div>
          <div style="overflow-x:auto"><div class="bars" style="height:150px;gap:${n > 20 ? 4 : 7}px;min-width:${n > 30 ? n * 14 : 0}px">${series.map((x) => {
            const h = x.v ? Math.max(8, Math.round((x.v / max) * 124)) : 5;
            return `<div class="col" title="${U.fmtDayMonth(x.k)}: ${x.learned} yangi, ${x.v - x.learned} takror"><div class="${x.v ? (x.k === today ? "cur" : "") : "zero"}" style="height:${h}px"></div>
              <span class="mono ${x.k === today ? "cur" : ""}" style="font-size:10px">${U.parseKey(x.k).getDate()}</span></div>`; }).join("")}</div></div>
        </div>
        <div class="collapse-md" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="card" style="padding:20px 22px">
            <div class="card-title" style="margin-bottom:16px">Mashq turi bo'yicha aniqlik</div>
            <div class="stack" style="gap:13px">${types.length ? types.map(({ t, acc }) => `<div><div class="row between" style="margin-bottom:5px"><span class="muted" style="font-size:13px">${S.TYPE_NAMES[t]}</span><span class="mono" style="font-size:12px">${acc}%</span></div>
              <div class="prog"><div style="width:${acc}%;background:${acc >= 88 ? "var(--ok)" : acc < 70 ? "var(--bad)" : "var(--p)"}"></div></div></div>`).join("")
              : `<div class="faint" style="font-size:13px">Hali javoblar yo'q.</div>`}</div>
          </div>
          <div class="card" style="padding:20px 22px">
            <div class="card-title" style="margin-bottom:16px">Takrorlash samarasi</div>
            <div class="stack" style="gap:14px">
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">Birinchi urinishda to'g'ri</span><span style="font-size:20px;font-weight:800">${ft.total ? U.pct(ft.ok, ft.total) + "%" : "—"}</span></div><div class="sep"></div>
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">Interval o'rtacha</span><span style="font-size:20px;font-weight:800">${avgInt} kun</span></div><div class="sep"></div>
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">Mastery'ga yetish</span><span style="font-size:20px;font-weight:800">${avgSeen} ko'rish</span></div><div class="sep"></div>
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">Esdan chiqqan</span><span style="font-size:20px;font-weight:800;color:var(--bad)">${S.forgottenIds().length} so'z</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card-pl" style="padding:22px">
          <div class="upl" style="font-size:12px;color:var(--on-pl3);margin-bottom:14px">Streak</div>
          <div style="font-size:44px;font-weight:800;letter-spacing:-.04em;color:var(--pd);line-height:1;margin-bottom:6px">${streak}</div>
          <div style="font-size:14px;margin-bottom:18px">kun ketma-ket · eng uzun ${S.state.bestStreak}</div>
          <div class="row" style="gap:4px">${weekDays.map((k) => `<div class="grow" title="${U.fmtDayMonth(k)}" style="height:26px;border-radius:5px;background:${S.dayMinutes(k) >= 1 || (S.state.act[k] || {}).learned ? "var(--pdb)" : "rgba(124,63,11,.25)"}"></div>`).join("")}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="upl" style="font-size:12px;margin-bottom:14px">O'qish vaqti</div>
          <div style="font-size:32px;font-weight:800;letter-spacing:-.035em;line-height:1;margin-bottom:5px">${U.durText(total)}</div>
          <div class="muted" style="font-size:13px;margin-bottom:18px">jami · kuniga o'rtacha ${days ? Math.round(total / days) : 0} daq</div>
          <div class="sep" style="margin-bottom:16px"></div>
          <div class="stack" style="gap:9px">${[["Learn", "learn"], ["Review", "review"], ["Quiz", "quiz"], ["AI Tutor", "tutor"]].map(([l, k]) => `<div class="row between"><span class="muted" style="font-size:13px">${l}</span><span class="mono" style="font-size:13px">${U.durText(S.minutesBy(k))}</span></div>`).join("")}</div>
        </div>
        <div class="card" style="padding:20px 22px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Tavsiya</div><p class="muted" style="margin:0;font-size:13px;line-height:1.55">${esc(tip)}</p></div>
      </div></div>`;
    const tabs = `<div class="seg">${[[30, "30 kun"], [7, "7 kun"], [0, "Hammasi"]].map(([v, l]) => `<button class="${progRange === v ? "on" : ""}" data-act="prog-range" data-v="${v}">${l}</button>`).join("")}</div>`;
    return V.shell("progress", V.topbar("Progress", progRange ? `oxirgi ${progRange} kun` : "butun davr", tabs), body);
  };
  Actions["prog-range"] = (el) => { progRange = Number(el.dataset.v); App.render(); };

  // ---------- Library (G2) ----------
  const lib = { status: "all", days: [], sort: "mastery-asc", q: "", page: 1 };
  const PER = 10;
  function libRows() {
    const learned = S.learnedIds();
    const recentDay = learned.length ? Math.max(...learned.map((id) => S.word(id).day)) : 0;
    const sets = {
      all: learned, mastered: learned.filter(S.isMastered), learning: learned.filter((id) => !S.isMastered(id)),
      weak: S.weakIds(), recent: learned.filter((id) => S.word(id).day === recentDay), flag: S.flaggedIds(),
      unlearned: S.WORDS.filter((w) => !S.isLearned(w.id)).map((w) => w.id),
    };
    let rows = sets[lib.status] || learned;
    if (lib.days.length) rows = rows.filter((id) => lib.days.includes(S.word(id).day));
    const q = lib.q.trim().toLowerCase();
    if (q) rows = rows.filter((id) => { const w = S.word(id); return w.ko.includes(q) || w.uz.toLowerCase().includes(q) || U.romanize(w.ko).includes(q); });
    const cmp = {
      "mastery-asc": (a, b) => S.mastery(a) - S.mastery(b) || (S.ws(b) || {}).bad - (S.ws(a) || {}).bad,
      "mastery-desc": (a, b) => S.mastery(b) - S.mastery(a),
      alpha: (a, b) => S.word(a).ko.localeCompare(S.word(b).ko, "ko"),
      day: (a, b) => S.word(a).day - S.word(b).day || S.word(a).i - S.word(b).i,
      due: (a, b) => ((S.ws(a) || {}).due || "9").localeCompare((S.ws(b) || {}).due || "9"),
    }[lib.sort];
    return { rows: rows.slice().sort(cmp), sets };
  }
  function libTable() {
    const { rows } = libRows();
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    lib.page = Math.min(lib.page, pages);
    const slice = rows.slice((lib.page - 1) * PER, lib.page * PER);
    const pg = [];
    for (let p = Math.max(1, lib.page - 2); p <= Math.min(pages, lib.page + 2); p++) pg.push(p);
    return `<div class="list"><div class="li head" style="gap:18px">
        <span style="min-width:100px">So'z</span><span class="grow">Ma'nosi</span><span style="min-width:44px">Kun</span>
        <span style="min-width:88px" class="hide-sm">Mastery</span><span style="min-width:72px" class="hide-sm">Ko'rishlar</span><span style="min-width:72px;text-align:right">Keyingi</span></div>
      ${slice.length ? slice.map((id) => {
        const w = S.word(id), st = S.ws(id), weak = S.isWeak(id), late = st && st.learned && st.due < U.today();
        return `<button class="li ${weak ? "bad" : ""}" style="gap:18px;padding:12px 20px" data-act="word" data-id="${id}">
          <span class="kw" style="min-width:100px">${esc(w.ko)}</span><span class="mean" style="${weak ? "color:var(--badd)" : ""}">${esc(w.uz)}</span>
          <span class="mono faint" style="font-size:12px;min-width:44px">D${w.day}</span>
          <span class="hide-sm" style="min-width:88px">${st && st.learned ? V.mbar(id, true) : `<span class="faint" style="font-size:12px">—</span>`}</span>
          <span class="mono muted hide-sm" style="font-size:12px;min-width:72px">${st ? `${st.seen} · ${st.ok}✓` : "0"}</span>
          <span class="mono" style="font-size:12px;min-width:72px;text-align:right;color:${!st || !st.learned ? "var(--ink3)" : late ? "var(--bad)" : st.due <= U.today() ? "var(--pd)" : "var(--ink3)"}">${st && st.learned ? U.dueLabel(st.due) : "yangi"}</span></button>`; }).join("")
      : `<div class="empty">Hech narsa topilmadi.</div>`}</div>
      <div class="row between" style="margin-top:16px">
        <span class="mono faint" style="font-size:12px">${rows.length ? `${(lib.page - 1) * PER + 1}–${Math.min(lib.page * PER, rows.length)} / ${rows.length}` : "0"}</span>
        <div class="row" style="gap:6px">${pg.map((p) => `<button class="dsq ${p === lib.page ? "completed" : "available"}" style="width:30px;height:30px;font-size:12px" data-act="lib-page" data-p="${p}">${p}</button>`).join("")}
          ${lib.page < pages ? `<button class="dsq available" style="width:30px;height:30px;font-size:12px" data-act="lib-page" data-p="${lib.page + 1}" aria-label="Keyingi sahifa">›</button>` : ""}</div>
      </div>`;
  }
  V.library = () => {
    const { sets } = libRows();
    const learnedDays = [...new Set(S.learnedIds().map((id) => S.word(id).day))].sort((a, b) => a - b);
    const st = [["all", "Hammasi"], ["mastered", "Mastered"], ["learning", "Learning"], ["weak", "Weak"], ["recent", "Yaqinda o'rganilgan"], ["flag", "Belgilanganlar"], ["unlearned", "Hali o'rganilmagan"]];
    const body = `<div class="page collapse-md" style="padding:28px 40px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px">
      <div class="stack" style="gap:22px">
        <div><div class="upl" style="margin-bottom:10px">Holat</div>
          <div class="nav" style="gap:4px">${st.map(([k, l]) => `<a href="javascript:void 0" class="${lib.status === k ? "on" : ""}" data-act="lib-status" data-k="${k}" style="padding:9px 12px">${l}<span class="cnt" style="${k === "weak" && sets.weak.length ? "color:var(--bad)" : ""}">${sets[k].length}</span></a>`).join("")}</div></div>
        <div><div class="upl" style="margin-bottom:10px">Kun</div>
          <div class="days">${(lib.status === "unlearned" ? Array.from({ length: S.DAYS }, (_, i) => i + 1) : learnedDays).map((d) => `<button class="dsq ${lib.days.includes(d) ? "completed" : "available"}" style="width:28px;height:28px" data-act="lib-day" data-d="${d}">${d}</button>`).join("") || `<span class="faint" style="font-size:12px">—</span>`}</div></div>
        <div><div class="upl" style="margin-bottom:10px">Saralash</div>
          ${U.dropdown({ change: "lib-sort", value: lib.sort, label: "Saralash", block: true, options: [["mastery-asc", "Mastery: pastdan"], ["mastery-desc", "Mastery: yuqoridan"], ["due", "Keyingi takrorlash"], ["day", "Kun bo'yicha"], ["alpha", "Alifbo (가나다)"]] })}</div>
      </div>
      <div style="min-width:0">
        <div class="row wrap" style="gap:10px;margin-bottom:18px">
          <input class="input grow" style="padding:13px 16px;font-size:14px;background:var(--sf);min-width:200px" placeholder="한국어 yoki o'zbekcha izlash…" value="${esc(lib.q)}" data-input="lib-search" aria-label="Qidirish">
          <button class="btn btn-sec btn-sm" style="padding:13px 20px;font-size:14px" data-act="lib-export">Eksport</button>
          <button class="btn btn-p btn-sm" style="padding:13px 20px;font-size:14px" data-act="lib-practice">Tanlanganni mashq qilish</button>
        </div>
        <div id="lib-table">${libTable()}</div>
      </div></div>`;
    return V.shell("library", V.topbar("So'zlar bazasi", `${S.learnedIds().length} so'z o'rganilgan · ${S.TOTAL} jami`), body);
  };
  const refreshLib = () => { const el = document.getElementById("lib-table"); if (el) el.innerHTML = libTable(); };
  Actions["lib-status"] = (el) => { lib.status = el.dataset.k; lib.page = 1; App.render(); };
  Actions["lib-day"] = (el) => { const d = Number(el.dataset.d); const i = lib.days.indexOf(d); if (i >= 0) lib.days.splice(i, 1); else lib.days.push(d); lib.page = 1; App.render(); };
  Actions["lib-page"] = (el) => { lib.page = Number(el.dataset.p); refreshLib(); };
  Changes["lib-sort"] = (el) => { lib.sort = el.value; lib.page = 1; refreshLib(); };
  Inputs["lib-search"] = (el) => { lib.q = el.value; lib.page = 1; refreshLib(); };
  Actions["lib-export"] = () => {
    const { rows } = libRows();
    const csv = ["korean,romanization,uzbek,day,mastery,seen,correct,wrong,next_review"].concat(rows.map((id) => {
      const w = S.word(id), st = S.ws(id) || {};
      return [w.ko, U.romanize(w.ko), w.uz, w.day, S.mastery(id), st.seen || 0, st.ok || 0, st.bad || 0, st.due || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    })).join("\n");
    U.download(`upkorean-sozlar-${U.today()}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  };
  Actions["lib-practice"] = () => {
    const { rows } = libRows();
    const ids = rows.filter((id) => S.isLearned(id) || lib.status === "unlearned");
    if (lib.status === "unlearned") { U.toast("Yangi so'zlarni kunlik darsda o'rganing"); return; }
    X.startQuiz({ type: "mixed", ids, count: 20, title: "So'zlar bazasidan" });
  };

  // ---------- Word modal ----------
  Actions.word = (el) => V.wordModal(el.dataset.id);
  V.wordModal = (id) => {
    const w = S.word(id), st = S.ws(id), ex = S.example(id);
    U.modal(`Day ${w.day} · so'z`, `
      <div class="row" style="align-items:baseline;gap:14px;margin-bottom:4px"><span class="ko" style="font-size:44px;font-weight:700;letter-spacing:-.03em">${esc(w.ko)}</span>
        <button class="audio-dot" data-act="say" data-kind="words" data-id="${esc(id)}" data-text="${esc(w.ko)}" aria-label="Talaffuz">▸</button></div>
      <div class="mono faint" style="font-size:14px;margin-bottom:18px">[ ${esc(U.romanize(w.ko))} ]</div>
      <div class="upl" style="margin-bottom:6px">Ma'nosi</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:18px">${esc(w.uz)}</div>
      ${ex ? `<div class="example"><div class="s" style="font-size:18px">${esc(ex.ko).replace(esc(ex.hl), `<b>${esc(ex.hl)}</b>`)} <button class="audio-dot" style="width:28px;height:28px;font-size:11px;vertical-align:middle" data-act="say" data-kind="sentences" data-id="${esc(id)}" data-text="${esc(ex.ko)}" aria-label="Gapni eshitish">▸</button></div><div class="muted" style="font-size:14px">${esc(ex.uz.replace(/[{}]/g, ""))}</div></div>` : ""}
      ${st && st.learned ? `<div class="strip" style="margin:16px 0"><div><div class="upl s">Mastery</div><div class="v" style="margin-top:10px">${V.mbar(id)}</div></div>
        <div><div class="upl s">Ko'rish</div><div class="v"><b>${st.seen}</b><span>${st.ok}✓ ${st.bad}✕</span></div></div>
        <div><div class="upl s">Keyingi</div><div class="v"><b style="font-size:17px">${U.dueLabel(st.due)}</b></div></div></div>`
        : `<p class="faint" style="font-size:13px">Bu so'z hali o'rganilmagan.</p>`}
      <div class="row wrap" style="gap:10px">
        ${st && st.learned ? `<button class="btn btn-sec btn-sm" data-act="flag" data-id="${id}">${st.flag ? "Belgilangan ✓" : "Qiyin deb belgilash"}</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="modal-close">Yopish</button>
      </div>`);
  };
  Actions.say = (el) => U.playClip(el.dataset.kind || "words", el.dataset.id);
  Actions.flag = (el) => { S.flag(el.dataset.id); V.wordModal(el.dataset.id); App.render(); };

  // ---------- Achievements (G3) ----------
  let board = null, boardLoading = false;
  const peersFallback = () => [{ rank: 1, name: firstName(), xp: (S.act().xp || 0), me: true }];
  function loadBoard() {
    if (boardLoading) return;
    boardLoading = true;
    S.flush().then(() => S.leaderboard()).then((b) => { board = b; }).catch(() => { board = { rows: peersFallback(), total: 1, offline: true }; })
      .finally(() => { boardLoading = false; if (location.hash.startsWith("#/achievements")) App.render(); });
  }
  V.achievements = () => {
    const lv = S.levelInfo(), list = S.achievements();
    const open = list.filter((a) => a.done), closed = list.filter((a) => !a.done);
    const ch = S.challenge();
    if (!board && !boardLoading) loadBoard();
    const ach = (a) => `<div class="ach ${a.done ? "" : "locked"}"><div class="g">${a.g}</div><div class="t">${esc(a.t)}</div><div class="d">${a.done ? (a.when ? U.ago(a.when) : esc(a.d)) : esc(a.prog)}</div></div>`;
    const body = `<div class="page wide collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:36px">
      <div style="min-width:0">
        <div class="card-pl row wrap" style="gap:26px;padding:24px 28px;border-radius:16px;margin-bottom:26px">
          <div><div class="upl" style="font-size:12px;color:var(--on-pl3);margin-bottom:8px">Level ${lv.level}</div>
            <div style="font-size:34px;font-weight:800;letter-spacing:-.035em;color:var(--on-pl);line-height:1">${U.num(lv.xp)} XP</div></div>
          <div class="grow" style="min-width:200px"><div style="height:10px;border-radius:6px;background:rgba(124,63,11,.16);overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${lv.pct}%;border-radius:6px;background:var(--pdb)"></div></div>
            <div class="row between" style="font-size:13px"><span>Level ${lv.level + 1} gacha ${U.num(lv.toNext)} XP</span><span>${U.num(lv.next)}</span></div></div>
        </div>
        <div class="card-title" style="margin-bottom:14px">Ochilgan yutuqlar <span class="faint mono" style="font-size:12px;font-weight:400">${open.length}</span></div>
        <div class="two-sm" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px">${open.length ? open.map(ach).join("") : `<div class="faint" style="grid-column:1/-1;font-size:14px">Birinchi yutuq Day 1 tugagach ochiladi.</div>`}</div>
        <div class="card-title" style="margin-bottom:14px">Yopiq yutuqlar</div>
        <div class="two-sm" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${closed.map(ach).join("")}</div>
      </div>
      <div class="stack" style="gap:16px">
        <div class="card" style="padding:22px">
          <div class="row between" style="margin-bottom:16px"><span class="card-title">Leaderboard</span><span class="mono faint" style="font-size:11px">bu hafta${board && board.total ? ` · ${board.total} ishtirokchi` : ""}</span></div>
          <div class="stack" style="gap:11px">${!board ? `<div class="faint" style="font-size:13px">Yuklanmoqda…</div>` : board.rows.length ? board.rows.map((r) => r.me
            ? `<div class="row" style="gap:12px;padding:9px 11px;margin:0 -11px;border-radius:10px;background:var(--pl)"><span class="mono accent" style="font-size:12px;min-width:18px">${r.rank}</span>
                <span class="avatar" style="width:26px;height:26px;border-radius:8px;background:var(--pdb);color:#fff;font-size:11px">${initial()}</span><span class="grow" style="font-size:13px;font-weight:700;color:var(--on-pl)">Siz</span><span class="mono accent" style="font-size:12px;font-weight:500">${U.num(r.xp)}</span></div>`
            : `<div class="row" style="gap:12px"><span class="mono faint" style="font-size:12px;min-width:18px">${r.rank}</span>
                <span class="avatar" style="width:26px;height:26px;border-radius:8px;background:var(--bg);color:var(--ink2);font-size:11px">${esc(r.name.charAt(0))}</span><span class="grow" style="font-size:13px">${esc(r.name)}</span><span class="mono" style="font-size:12px">${U.num(r.xp)}</span></div>`).join("")
            : `<div class="faint" style="font-size:13px">Bu hafta hali hech kim XP to'plamadi.</div>`}
            ${board && board.offline ? `<div class="faint" style="font-size:12px">Serverga ulanib bo'lmadi.</div>` : ""}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:16px">Kunlik challenge</div>
          <div class="stack" style="gap:14px">${ch.items.map((i) => `<div><div class="row between" style="margin-bottom:6px"><span style="font-size:13px">${esc(i.label)}</span>
            <span class="mono ${i.cur >= i.goal ? "okc" : "faint"}" style="font-size:11px">${i.cur >= i.goal ? "bajarildi" : `${i.cur}/${i.goal}`}</span></div>
            <div class="prog" style="height:5px"><div style="width:${U.pct(i.cur, i.goal)}%;${i.cur >= i.goal ? "background:var(--ok)" : ""}"></div></div></div>`).join("")}</div>
          <div class="row between" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)"><span class="muted" style="font-size:13px">Mukofot</span><span class="mono ${ch.done ? "okc" : "accent"}" style="font-size:13px">${ch.done ? "olindi ✓" : `+${ch.reward} XP`}</span></div>
        </div>
      </div></div>`;
    return V.shell("achievements", V.topbar("Yutuqlar", `${open.length} / ${list.length} ochilgan`), body);
  };
  V.resetBoard = () => { board = null; };

  // ---------- Profile & settings (G4) ----------
  V.profile = () => {
    const p = S.state.profile, set = S.state.settings, r = p.reminders, lv = S.levelInfo();
    const startKey = Object.values(S.state.days).length ? (Object.values(S.state.days).map((d) => d.doneAt).filter(Boolean).sort()[0] || p.joined) : p.joined;
    const endKey = U.addDays(startKey, S.DAYS);
    const row = (label, right) => `<div class="set-row"><div class="set-l">${label}</div><div class="set-r">${right}</div></div>`;
    const hint = (text) => ` <span class="faint" style="font-size:12px">· ${text}</span>`;
    const perm = Push.permission();
    const body = `<div class="page prof">
      <div class="prof-head">
        <div class="avatar prof-av">${initial()}</div>
        <div class="prof-id">
          <h3 class="page-h">${esc(p.name)}</h3>
          <p class="page-p">${esc(S.user.email)}</p>
          <p class="prof-meta">${U.fmtDayMonth(S.user.createdAt || p.joined)}dan a'zo · Level ${lv.level}</p>
        </div>
        ${S.user.demo ? `<span class="tag">demo hisob</span>` : `<button class="btn btn-sec btn-sm prof-edit" data-act="edit-name">Tahrirlash</button>`}
      </div>
      <div class="collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px">
        <div class="stack" style="gap:16px">
          <div class="card set-card">
            <div class="card-title">O'qish rejasi</div>
            ${row("Kurs", `<span class="set-v">TOPIK II · ${S.TOTAL} so'z</span>`)}
            ${row("Kunlik temp", U.dropdown({ change: "set-pace", value: p.pace, label: "Kunlik temp", options: [11, 17, 33].map((n) => [n, `${n} so'z · ~${S.PACES[n].min} daq`]) }))}
            ${row("Tugash sanasi", `<span class="set-v">${U.fmtDayMonth(endKey)}</span>`)}
          </div>
          <div class="card set-card">
            <div class="card-title">Bildirishnomalar</div>
            ${S.user.demo ? `<p class="muted set-note">Demo hisobda eslatmalar yuborilmaydi.</p>` : ""}
            ${row(`Eslatmalar${hint({ granted: "ruxsat berilgan", denied: "brauzerda bloklangan", default: "ruxsat so'raladi", install: "bosh ekranga qo'shing", unsupported: "brauzer qo'llamaydi" }[perm])}`, toggle(r.on, "rem-toggle", "on", "Eslatmalar"))}
            ${row(`Bugungi dars <input type="time" class="time-input sm" value="${esc(r.learn)}" data-change="rem-time" data-k="learn" aria-label="Dars vaqti">`, toggle(r.on && r.learnOn !== false, "rem-toggle", "learnOn", "Dars eslatmasi"))}
            ${row(`Takrorlash <input type="time" class="time-input sm" value="${esc(r.review)}" data-change="rem-time" data-k="review" aria-label="Takrorlash vaqti">`, toggle(r.on && r.reviewOn !== false, "rem-toggle", "reviewOn", "Takrorlash eslatmasi"))}
            ${row(`Streak eslatmasi${hint("21:30")}`, toggle(r.on && r.streak, "rem-toggle", "streak", "Streak eslatmasi"))}
            ${r.on && !S.user.demo && perm === "granted" ? row("Sinov bildirishnomasi", `<button class="link" data-act="push-test">yuborish</button>`) : ""}
            ${r.on && ["denied", "install", "unsupported"].includes(perm) ? `<p class="muted set-note" style="margin:10px 0 0">${esc(Push.explain(perm))}</p>` : ""}
          </div>
          <div class="card set-card">
            <div class="card-title">Hisob</div>
            ${row(`AI Tutor${hint("tez kunda")}`, `<span class="tag">qulflangan</span>`)}
            ${S.user.demo ? "" : row("Parol", `<button class="link" data-act="change-pass">${S.user.hasPassword ? "o'zgartirish" : "o'rnatish"}</button>`)}
            ${row("Progressni yuklab olish", `<button class="link" data-act="export-json">JSON</button>`)}
            ${S.user.demo ? "" : row("Hisobni o'chirish", `<button class="link" style="color:var(--bad)" data-act="delete-account">o'chirish</button>`)}
          </div>
        </div>
        <div class="stack" style="gap:16px">
          <div class="card" style="padding:24px">
            <div class="card-title" style="margin-bottom:18px">Statistika</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
              <div><div class="stat-n">${S.learnedIds().length}</div><div class="muted" style="font-size:13px">o'rganilgan so'z</div></div>
              <div><div class="stat-n">${S.masteredIds().length}</div><div class="muted" style="font-size:13px">mastered</div></div>
              <div><div class="stat-n">${S.streak()}</div><div class="muted" style="font-size:13px">kunlik streak</div></div>
              <div><div class="stat-n">${U.durText(S.totalMinutes())}</div><div class="muted" style="font-size:13px">o'qish vaqti</div></div>
            </div>
          </div>
          <div class="card set-card">
            <div class="card-title">Interfeys</div>
            ${row("Tema", `<div class="seg" style="padding:3px"><button class="${set.theme !== "dark" ? "on" : ""}" data-act="set-theme" data-v="light">Yorug'</button><button class="${set.theme === "dark" ? "on" : ""}" data-act="set-theme" data-v="dark">Tungi</button></div>`)}
            ${row("Romanizatsiya ko'rsatish", toggle(set.roman, "set-flag", "roman", "Romanizatsiya"))}
            ${row("Avtomatik audio", toggle(set.autoAudio, "set-flag", "autoAudio", "Avtomatik audio"))}
            ${row("Talaffuz tezligi", `<div class="seg" style="padding:3px">${[[0.82, "Sekin"], [0.92, "Tabiiy"], [1.02, "Tez"]].map(([v, t]) => `<button class="${Math.abs((set.speechRate || 0.92) - v) < 0.01 ? "on" : ""}" data-act="set-speech-rate" data-v="${v}">${t}</button>`).join("")}</div>`)}
            <div class="hide-sm">${row("Klaviatura yorliqlari", `<button class="link mono" data-act="shortcuts">ko'rish</button>`)}</div>
          </div>
          <div class="card set-card">
            ${row(`<span class="muted">Hisobdan chiqish — progress serverda saqlanib qoladi</span>`, `<button class="link" style="color:var(--bad);font-size:14px" data-act="logout">Chiqish</button>`)}
          </div>
        </div>
      </div></div>`;
    return V.shell("profile", V.topbar("Profil", ""), body);
  };

  Actions["set-theme"] = (el) => { S.setTheme(el.dataset.v); App.render(); };
  Actions["set-flag"] = (el) => { const k = el.dataset.k; S.state.settings[k] = !S.state.settings[k]; S.save(); App.render(); };
  Changes["set-pace"] = (el) => { S.state.profile.pace = Number(el.value); S.save(); App.render(); U.toast("Yangi temp hali boshlanmagan kunlarga qo'llanadi"); };
  Changes["rem-time"] = (el) => { S.state.profile.reminders[el.dataset.k] = el.value; S.save(); };
  Actions["set-speech-rate"] = (el) => { S.state.settings.speechRate = Number(el.dataset.v); S.save(); App.render(); U.playClip("sentences", "1-0"); };
  Actions["rem-toggle"] = async (el) => {
    const r = S.state.profile.reminders, k = el.dataset.k;
    if (k === "on") r.on = !r.on;
    else if (!r.on) { r.on = true; r[k] = true; }
    else r[k] = r[k] === false ? true : !r[k];
    S.save();
    if (r.on) await App.enableReminders();
    App.render();
  };
  Actions["push-test"] = async () => {
    try { await Push.test(); U.toast("Yuborildi — bir necha soniyada bildirishnoma keladi"); }
    catch (e) { U.toast(e.message); }
  };
  Actions["edit-name"] = () => {
    U.modal("Profilni tahrirlash", `<form data-form="edit-name" novalidate>
      <label class="field-label" for="e-name">Ism</label>
      <input class="input" id="e-name" name="name" maxlength="60" value="${esc(S.user.name)}" style="margin-bottom:18px" autofocus>
      <div class="form-err" id="edit-err" hidden></div>
      <button class="btn btn-p" type="submit">Saqlash</button></form>`);
  };
  Forms["edit-name"] = async (form) => {
    try { await S.updateName(form.elements.name.value); U.closeModal(); App.render(); U.toast("Saqlandi"); }
    catch (e) { const b = document.getElementById("edit-err"); b.textContent = e.message; b.hidden = false; }
  };
  Actions["change-pass"] = () => {
    const has = S.user.hasPassword;
    U.modal(has ? "Parolni o'zgartirish" : "Parol o'rnatish", `<form data-form="change-pass" novalidate>
      ${has ? `<label class="field-label" for="c-cur">Joriy parol</label>
      <input class="input" id="c-cur" name="current" type="password" autocomplete="current-password" style="margin-bottom:18px" autofocus>` : ""}
      <label class="field-label" for="c-new">Yangi parol</label>
      <input class="input" id="c-new" name="next" type="password" autocomplete="new-password" placeholder="Kamida 8 belgi" style="margin-bottom:18px"${has ? "" : " autofocus"}>
      <div class="form-err" id="cp-err" hidden></div>
      <button class="btn btn-p" type="submit">Saqlash</button></form>`);
  };
  Forms["change-pass"] = async (form) => {
    try { await S.changePassword(form.elements.current ? form.elements.current.value : "", form.elements.next.value); U.closeModal(); App.render(); U.toast("Parol yangilandi"); }
    catch (e) { const b = document.getElementById("cp-err"); b.textContent = e.message; b.hidden = false; }
  };
  Actions["export-json"] = () => U.download(`upkorean-progress-${U.today()}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), user: S.user, state: S.state }, null, 2), "application/json");
  Actions["delete-account"] = () => {
    U.modal("Hisobni o'chirish", `<form data-form="delete-account" novalidate>
      <p class="muted" style="margin:0 0 16px;line-height:1.55">Hisob va barcha progress serverdan butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.</p>
      ${S.user.hasPassword ? `<label class="field-label" for="d-pass">Tasdiqlash uchun parol</label><input class="input" id="d-pass" name="password" type="password" style="margin-bottom:18px" autofocus>` : ""}
      <div class="form-err" id="del-err" hidden></div>
      <div class="row"><button class="btn" style="background:var(--bad);color:#fff" type="submit">O'chirish</button><button class="btn btn-ghost" type="button" data-act="modal-close">Bekor qilish</button></div></form>`);
  };
  Forms["delete-account"] = async (form) => {
    try { await S.deleteAccount(form.elements.password ? form.elements.password.value : ""); U.closeModal(); App.go("#/login"); U.toast("Hisob o'chirildi"); }
    catch (e) { const b = document.getElementById("del-err"); b.textContent = e.message; b.hidden = false; }
  };
  Actions.logout = async () => { await S.logout(); V.resetBoard(); App.go("#/login"); };
  Actions.shortcuts = () => U.modal("Klaviatura yorliqlari", `<div class="stack" style="gap:10px;font-size:14px">
    ${[["Flash card", "Space — ochish · 1–4 — baholash · → — keyingi · S — audio"], ["Test savollari", "1–4 — javob · ⏎ — keyingi"], ["Listening", "Space — qayta eshitish · 1–4 — javob"],
      ["Typing", "⏎ — tekshirish"], ["Onboarding", "1–4 — tanlash · ⏎ — davom"], ["AI Tutor", "⏎ — yuborish · Shift+⏎ — yangi qator"], ["Istalgan sessiya", "Esc — chiqish"]]
      .map(([a, b]) => `<div class="row" style="gap:16px;align-items:flex-start"><span style="font-weight:700;min-width:120px">${a}</span><span class="mono muted" style="font-size:12px;line-height:1.6">${b}</span></div>`).join("")}</div>`);

  V.notFound = () => V.shell("", V.topbar("Topilmadi", ""), `<div class="page"><div class="empty" style="padding:60px">Sahifa topilmadi. <a href="#/dashboard">Dashboard</a></div></div>`);
})();
