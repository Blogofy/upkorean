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
  V.mbar = (id, sm, withCount) => {
    const s = S.mastery(id), weak = S.isWeak(id), m = S.isMastered(id);
    const label = `O'zlashtirish ${s}/5${weak ? ", zaif" : m ? ", o'zlashtirilgan" : ""}`;
    return `<span class="mbar-wrap"><span class="mbar ${weak ? "weak" : ""} ${sm ? "sm" : ""}" role="img" aria-label="${label}" title="${label}">${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= s ? (m ? "on m" : "on") : ""}"></i>`).join("")}</span>${withCount ? `<span class="mbar-n" aria-hidden="true">${s}/5</span>` : ""}</span>`;
  };
  // A closing ring. pathLength="100" makes the dash offset the percentage itself, so one piece of markup works
  // at any size, and the value is clamped here so no caller can ever draw past a full circle.
  V.ring = (pct, label, size = 64) => {
    const v = Math.max(0, Math.min(100, Math.round(pct) || 0));
    return `<span class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(label)}" title="${esc(label)}">
      <svg viewBox="0 0 40 40" aria-hidden="true"><circle class="ring-t" cx="20" cy="20" r="17" pathLength="100"/><circle class="ring-v" cx="20" cy="20" r="17" pathLength="100" style="stroke-dashoffset:${100 - v}"/></svg>
      <span class="ring-c" aria-hidden="true">${v >= 100 ? V.icon("check", Math.round(size * 0.36)) : `${v}%`}</span></span>`;
  };
  // Today's share of the day's own size — done out of done + left, which is the only denominator that behaves:
  // it stays at the day's target while the queue drains, and it shrinks with the queue when the queue is the
  // smaller of the two. A finished day is exactly 100; an unfinished one is never rounded up into it.
  const goalPct = (g) => {
    const total = g.done + g.left;
    if (!total) return 0;
    return g.left ? Math.min(99, Math.floor((g.done / total) * 100)) : 100;
  };
  // The day's ring, labelled for screen readers. V.ring escapes the label, so it is passed raw.
  const goalRing = (g, size) => V.ring(goalPct(g), `Bugungi takrorlash: ${g.done + g.left} tadan ${g.done} tasi bajarildi`, size);

  // Days 1–30 as one grid, each square a link to its day.
  V.dayWeeks = () => {
    const days = Array.from({ length: S.DAYS }, (_, i) => i + 1).map((d) => {
      const st = S.dayStatus(d);
      const name = { mastered: "o'zlashtirilgan", completed: "tugatilgan", progress: "davom etmoqda", available: "ochiq", locked: "yopiq" }[st];
      return st === "locked"
        ? `<span class="dsq locked" role="img" aria-label="${d}-kun — ${name}" title="${d}-kun — ${name}">${d}</span>`
        : `<a class="dsq ${st}" href="#/day/${d}" aria-label="${d}-kun — ${name}" title="${d}-kun — ${name}">${d}</a>`;
    }).join("");
    return `<div class="days">${days}</div>`;
  };
  function lostStreakNote() {
    const today = U.today(), yesterday = U.addDays(today, -1);
    const a = S.state.act;
    const active = (k) => !!a[k] && (a[k].learned > 0 || a[k].reviewed > 0 || Object.values(a[k].min || {}).reduce((x, y) => x + y, 0) >= 1);
    if (S.streak() > 0 || !S.state.bestStreak || active(today) || active(yesterday)) return "";
    return `<span class="streak-lost">Seriya uzildi (eng uzuni ${S.state.bestStreak} kun) — bugungi bitta mashq yangisini boshlaydi.</span> `;
  }
  const toggle = (on, act, k, label) => `<button class="toggle ${on ? "on" : ""}" data-act="${act}" data-k="${k}" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}"></button>`;
  const initial = () => esc((S.state.profile.name || "?").trim().charAt(0).toUpperCase());
  const firstName = () => esc((S.state.profile.name || "").split(" ")[0]);

  // ---------- Shell ----------
  // Seven places, each a line icon. Only a screen without an entry of its own lights up the place it belongs to.
  const ICONS = {
    dashboard: `<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
    course: `<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>`,
    review: `<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>`,
    quiz: `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>`,
    library: `<path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8"/>`,
    progress: `<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`,
    achievements: `<path d="M12 3.6 14.1 9.3 20.2 9.5 15.4 13.3 17.1 19.2 12 15.8 6.9 19.2 8.6 13.3 3.8 9.5 9.9 9.3z"/>`,
    more: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
    profile: `<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>`,
    flame: `<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 1.5 1.5 2.5 2.5 2.5C12 8 11 6 12 3z"/>`,
    check: `<path d="m5 12 5 5 9-10"/>`,
    lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`,
  };
  V.icon = (k, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
  // Reading order: the day, then the material, then the two ways to practise it, then the dictionary, then the
  // two ways to look back. Mashqlar and Yutuqlar sit directly under the screen each used to hide inside, so a
  // learner who knew the old place finds the new one in the same spot, one level up.
  const NAV = [["dashboard", "Bugun"], ["course", "Kurs"], ["review", "Takrorlash"], ["quiz", "Mashqlar"], ["library", "So'zlar"], ["progress", "Natijalar"], ["achievements", "Yutuqlar"]];
  // Only the day is still a sub-route: quiz and achievements light up themselves now.
  const NAV_OF = { day: "course" };
  // Seven tabs at 393px give each 53px, which "Takrorlash" cannot spell at 11px. Four keep a tab — the plan, the
  // lesson, the due queue and the dictionary, the four a learner opens every single day — and the fifth slot is
  // a door to the rest. Profil is not among them: the topbar already carries it on every phone screen.
  const TABS = ["dashboard", "course", "review", "library"];
  const SHEET = NAV.filter(([k]) => !TABS.includes(k));
  // What the shell drew last: which place is current, and what today still asks for. The sheet is built from a
  // tap, long after the render, and has to draw its rows exactly as the bar behind it drew them — so both are
  // taken once per render and kept here. Ephemeral either way, and never a key in S.state.
  let navPlace = "", navLeft = 0;
  const navExtra = (k) => {
    if (k === "course") return `<span class="cnt">${S.daysDone()}/${S.DAYS}</span>`;
    return k === "review" && navLeft ? `<span class="badge">${esc(navLeft)}</span>` : "";
  };
  // One row, drawn the same in the rail, on the phone bar and in the sheet, so the counter and the badge follow
  // the place rather than the place they are drawn in.
  const navLink = ([k, label], attrs = "") => `<a href="#/${k}" class="${navPlace === k ? "on" : ""}"${navPlace === k ? ` aria-current="page"` : ""}${attrs}>${V.icon(k)}<span>${label}</span>${navExtra(k)}</a>`;
  V.shell = (active, top, body) => {
    const lv = S.levelInfo();
    navPlace = NAV_OF[active] || active;
    // What today still asks for, not the whole queue: this badge sits on every screen, so the raw due count is
    // the one number a learner would read as a debt they are losing to. When the day is done the badge is gone.
    navLeft = S.reviewGoal().left;
    // The fifth slot is a door, not a place, so it carries the current page whenever the page is behind it —
    // without this a learner reading Mashqlar would stand on a bar with nothing selected at all.
    const inSheet = SHEET.some(([k]) => k === navPlace);
    const tabs = NAV.filter(([k]) => TABS.includes(k)).map((e) => navLink(e)).join("")
      + `<button class="${inSheet ? "on" : ""}" data-act="nav-more" aria-haspopup="dialog"${inSheet ? ` aria-current="true"` : ""}>${V.icon("more")}<span>Ko'proq</span></button>`;
    return `<div class="shell">
      <aside class="side">
        <a href="#/dashboard" class="brand"><span class="mark" aria-hidden="true"></span><span class="name">UpKorean</span></a>
        <nav class="nav" aria-label="Asosiy">${NAV.map((e) => navLink(e)).join("")}</nav>
        <a href="#/profile" class="me ${navPlace === "profile" ? "on" : ""}">
          <span class="avatar">${V.icon("profile", 18)}</span>
          <span class="grow"><b>Profil</b><span>${lv.level}-daraja · ${U.num(lv.xp)} XP</span></span>
        </a>
      </aside>
      <div class="main">${top}${body}</div>
      <nav class="tabbar" aria-label="Asosiy">${tabs}</nav>
    </div>`;
  };
  // The sheet is a U.modal with one class added, so the backdrop, the Tab trap, Escape, the scroll lock and the
  // hand-back of focus are the dialog's own; a second implementation would be a second trap to keep correct.
  // Focus lands on the first row, not on ✕: the sheet was opened to pick something.
  Actions["nav-more"] = () => U.modal("Ko'proq", `<nav class="nav" aria-label="Ko'proq">${SHEET.map((e, i) => navLink(e, ` data-act="nav-go" data-href="#/${e[0]}"${i ? "" : " autofocus"}`)).join("")}</nav>`, { sheet: true });
  // Closed by hand rather than left to the hash change: tapping the page you are already on fires no hashchange,
  // and the sheet would stay sitting over the page the learner just asked for.
  Actions["nav-go"] = (el) => { U.closeModal(); App.go(el.dataset.href); };
  const streakChip = () => {
    const n = S.streak();
    return n ? `<span class="pill streak" title="Kunlik seriya">${V.icon("flame", 16)}<span class="hide-sm">${n} kunlik seriya</span><b class="show-sm">${n}</b></span>` : "";
  };
  V.topbar = (title, sub, right = "") => `<header class="topbar">
      <a href="#/dashboard" class="brand show-sm" aria-label="UpKorean"><span class="mark" aria-hidden="true"></span></a>
      <div class="tb-title">${title ? `<h1 class="title">${title}</h1>` : ""}${sub ? `<span class="sub">${sub}</span>` : ""}</div>
      <div class="right">${right}
        ${S.offline ? `<span class="offline-pill" title="Natijalar qurilmada saqlanadi va internet qaytganda sinxronlanadi">oflayn</span>` : ""}
        ${S.syncError && !S.offline ? `<span class="badge-bad" title="Natijalar serverga saqlanmadi — qayta urinilmoqda">saqlanmadi</span>` : ""}
        ${streakChip()}
        <a href="#/profile" class="iconbtn show-sm" aria-label="Profil">${V.icon("profile", 18)}</a>
      </div></header>`;

  Actions["theme-toggle"] = () => { S.setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"); App.render(); };

  // ---------- Dashboard (B1) ----------
  function nextStage(d) {
    const ds = S.dayState(d), plan = S.dayPlan(d);
    // A day record saved without a pace follows the profile pace, so its stage can point past the end of the
    // plan (33 words per block gives 2 stages where 11 gives 6) — clamped, the page shows the last stage.
    return { ds, plan, stage: ds.done ? null : plan.stages[Math.min(ds.stage, plan.stages.length - 1)] };
  }
  const ORD = ["Birinchi", "Ikkinchi", "Uchinchi"];
  const stageName = (plan, sg) => {
    const what = sg.kind === "learn" ? "tanishish" : sg.kind === "recall" ? "faol eslash" : "kun testi";
    return plan.blocks.length > 1 && sg.block >= 0 ? `${sg.block + 1}-blok · ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
  };

  // Today is one list of the day's stages: what is done, the one to do now, and what comes after.
  V.dashboard = () => {
    const cd = S.currentDay(), done = S.courseDone();
    const { ds, plan } = nextStage(cd);
    const g = S.reviewGoal(), weak = S.weakIds().length;
    const learned = S.learnedIds().length;
    const rem = S.state.profile.reminders;
    const check = `<span class="st-dot done">${V.icon("check", 15)}</span>`;

    let today;
    if (done) {
      today = `<section class="card today">
        <div class="today-head"><div><h2 class="today-h">Kurs tugadi</h2><div class="muted">${S.TOTAL} so'z · ${S.DAYS} kun</div></div></div>
        <p class="muted" style="margin:0;line-height:1.55">Endi asosiy ish — takrorlash. To'liq o'zlashtirilmagan so'zlarni har kuni mustahkamlang.</p>
        <div class="row wrap">${g.left ? `<button class="btn btn-p" data-act="review-start" data-mode="due">Takrorlash · ${esc(g.left)}</button>` : ""}<a class="btn btn-sec" href="#/quiz">Mashqlar</a></div>
      </section>`;
    } else {
      const steps = plan.stages.map((sg, i) => {
        const name = stageName(plan, sg);
        if (i < ds.stage) return `<li class="st past">${check}<span class="grow">${name}</span><span class="st-meta">bajarildi</span></li>`;
        if (i > ds.stage) return `<li class="st">${`<span class="st-dot">${i + 1}</span>`}<span class="grow">${name}</span><span class="st-meta">~${sg.min} daq</span></li>`;
        const ids = sg.block >= 0 ? plan.blocks[sg.block] : plan.words;
        const sample = ids.slice(0, 3).map((id) => S.word(id).ko).join(", ");
        const detail = sg.kind === "learn" ? `<span class="ko">${esc(sample)}</span>${ids.length > 3 ? ` va yana ${ids.length - 3} so'z` : ""}`
          : sg.kind === "recall" ? `${ids.length} so'zni mashq bilan eslash` : `${Math.min(12, plan.words.length)} savol · barcha ${plan.words.length} so'z`;
        return `<li class="st now"><span class="st-dot cur">${i + 1}</span>
          <span class="grow st-body"><b>${name}</b><span>${detail} · ~${sg.min} daq</span></span>
          <button class="btn btn-p" data-act="learn" data-day="${cd}">${ds.stage ? "Davom etish" : "Boshlash"}</button></li>`;
      }).join("");
      today = `<section class="card today">
        <div class="today-head">
          <div><h2 class="today-h">${cd}-kun</h2><div class="muted">${plan.words.length} so'z · ${plan.blocks.length} blok · ~${plan.minutes} daqiqa</div></div>
          <div class="today-prog"><span>${ds.stage} / ${plan.stages.length} bosqich</span><div class="prog"><div style="width:${U.pct(ds.stage, plan.stages.length)}%"></div></div></div>
        </div>
        <ol class="steps">${steps}</ol>
      </section>`;
    }

    // The queue has three states and they must not be told apart by a number alone. "Bajarildi" is the one the
    // whole change rests on: the words beyond today's goal are not owed, they are moved into the coming days at
    // the next rollover (store.js pushForward), so the card says the day is finished and names no leftover count.
    const goalDone = `<div class="goal">${goalRing(g, 64)}
        <div class="goal-txt"><b class="goal-done">Bugun bajarildi</b><span class="goal-sub">${esc(g.done)} so'z takrorlandi</span></div></div>`;
    let reviewBody;
    if (g.left) {
      reviewBody = `<div class="goal">${goalRing(g, 64)}
          <div class="goal-txt"><div class="big-n"><b>${esc(g.left)}</b><span>so'z</span></div>
            <span class="goal-sub">Bugungi maqsad · ~${esc(g.minutes)} daqiqa</span></div></div>
        <p class="side-note">${rem.on && rem.reviewOn !== false ? `Kechqurun ${esc(rem.review)} da eslatamiz.` : "Unutilishidan oldin qaytarib oling."}</p>
        <button class="btn btn-sec btn-block" data-act="review-start" data-mode="due">Hozir takrorlash</button>`;
    } else if (g.due) {
      // An offer, never a demand: the day is finished above it, so this stays a quiet link rather than a button.
      // Without it the extra round has no way in at all, because every "Takrorlash" button is gone in this state.
      reviewBody = `${goalDone}
        <p class="side-note">Qolgan so'zlar keyingi kunlarga taqsimlanadi — bugun ularni qilish shart emas.</p>
        <button class="link" data-act="ex-review-extra" style="align-self:flex-start">Xohlasangiz — yana ${esc(X.EXTRA_ROUND)} ta so'z</button>`;
    } else if (g.done) {
      reviewBody = `${goalDone}
        <p class="side-note">Bugunga takrorlash qolmadi. Ertaga yangilari keladi.</p>`;
    } else {
      reviewBody = `<p class="side-note">Hozircha takrorlash yo'q. O'rgangan so'zlaringiz unutilishidan oldin shu yerda chiqadi.</p>`;
    }
    const reviewCard = `<section class="card side-card">
        <div class="card-title">Takrorlash</div>
        ${reviewBody}
        ${weak ? `<button class="link" data-act="quiz-weak" style="align-self:flex-start">${weak} ta qiyin so'zni mashq qilish</button>` : ""}
      </section>`;
    const week = S.weekRhythm();
    const weekCard = `<section class="card side-card">
        <div class="row between" style="align-items:baseline"><span class="card-title">Bu hafta</span>${S.state.bestStreak ? `<span class="side-note">eng uzun seriya: ${S.state.bestStreak} kun</span>` : ""}</div>
        <div class="week">${week.map((w) => `<div class="${w.today ? "is-today" : ""}" title="${w.lbl}: ${Math.round(w.min)} daq"><i class="${w.min >= 1 || w.words ? "on" : ""}"></i>${w.lbl}</div>`).join("")}</div>
      </section>`;
    const courseCard = `<a class="card course-strip" href="#/course">
        <div class="cs-t"><b>Kurs</b><span><b>${learned}</b> / ${S.TOTAL} so'z</span></div>
        <div class="cs-days" aria-hidden="true">${Array.from({ length: S.DAYS }, (_, i) => `<i class="${S.dayStatus(i + 1)}"></i>`).join("")}</div>
        <span class="cs-link">Kursni ochish</span>
      </a>`;

    const lost = lostStreakNote();
    const body = `<div class="page">
      ${lost ? `<p class="page-p" style="margin-bottom:16px">${lost}</p>` : ""}
      <div class="dash">
        ${today}
        <div class="dash-side">${reviewCard}${weekCard}</div>
      </div>
      ${courseCard}
    </div>`;
    const date = U.fmtLong(U.today());
    return V.shell("dashboard", V.topbar("", date.charAt(0).toUpperCase() + date.slice(1)), body);
  };

  // ---------- Course (C1) ----------
  // Every day in one list; the chosen day (today unless another is picked) opens beside it.
  let courseSel = null;
  V.course = () => {
    const cur = S.currentDay();
    const d = courseSel >= 1 && courseSel <= S.DAYS ? courseSel : cur;
    const row = (n) => {
      const st = S.dayStatus(n), ds = S.dayState(n), total = S.DAY_WORDS[n - 1].length;
      let lead, right;
      if (st === "mastered" || st === "completed") { lead = `<span class="dr-n done">${V.icon("check", 16)}</span>`; right = `<span class="mono dr-meta">${U.pct(ds.ok || 0, (ds.ok || 0) + (ds.bad || 0)) || 100}%</span>`; }
      else if (st === "progress") { lead = `<span class="dr-n cur">${n}</span>`; right = `<span class="mono dr-meta">${S.dayLearned(n)}/${total}</span>${n === cur ? `<span class="dr-tag">bugun</span>` : ""}`; }
      else if (st === "available") { lead = `<span class="dr-n">${n}</span>`; right = `<span class="dr-meta">ochiq</span>`; }
      else { lead = `<span class="dr-n locked">${n}</span>`; right = `<span class="dr-meta" aria-label="yopiq">${V.icon("lock", 14)}</span>`; }
      return `<button class="dayrow ${n === d ? "on" : ""}" data-act="course-pick" data-d="${n}"${n === d ? ` aria-current="true"` : ""}>${lead}<span class="grow"><b>${n}-kun</b><span class="ko">${esc(S.DAY_WORDS[n - 1][0].ko)}</span></span>${right}</button>`;
    };

    const locked = S.dayStatus(d) === "locked";
    const { ds, plan } = nextStage(d);
    const words = plan.words;
    const origins = { sino: 0, native: 0, loan: 0 };
    words.forEach((id) => { origins[S.origin(id)]++; });
    const originText = Object.entries(origins).filter(([, n]) => n).map(([k, n]) => ` · <span class="ko">${S.ORIGINS[k].ko}</span> ${n}`).join("");
    const eyebrow = `${d}-KUN${ds.done ? " · TUGAGAN" : d === cur ? " · BUGUN" : locked ? " · YOPIQ" : ""}`;
    const cta = locked ? ""
      : ds.done ? `<button class="btn btn-sec" data-act="learn" data-day="${d}">Qayta mashq qilish</button>`
      : `<button class="btn btn-p" data-act="learn" data-day="${d}">${ds.stage ? "Davom etish" : "Boshlash"}</button>`;
    const stages = plan.stages.map((sg, i) => {
      const isDone = ds.done || i < ds.stage, isCur = !ds.done && !locked && i === ds.stage;
      const ids = sg.block >= 0 ? plan.blocks[sg.block] : words;
      const meta = sg.kind === "mixed" ? `${Math.min(12, words.length)} savol · ~${sg.min} daq` : sg.kind === "learn" ? `${ids.length} so'z · ~${sg.min} daq` : `~${sg.min} daq`;
      return `<div class="stg ${isDone ? "done" : isCur ? "cur" : ""}">${isDone ? V.icon("check", 18) : `<span class="mono">${isCur ? "HOZIR" : "KEYIN"}</span>`}<b>${stageName(plan, sg)}</b><span>${isDone ? "bajarildi" : meta}</span></div>`;
    }).join("");
    const detail = `<section class="card day-detail">
        <div class="dd-head">
          <div><div class="eyebrow">${eyebrow}</div><h2 class="dd-h">${esc(S.dayTitle(d))}</h2>
            <div class="muted">${words.length} so'z · ${plan.blocks.length} blok · ~${plan.minutes} daqiqa${originText}</div></div>
          ${cta}
        </div>
        ${locked ? `<p class="dd-lock">${V.icon("lock", 16)}Bu kun ${d - 2}-kun tugagandan keyin ochiladi.</p>` : ""}
        <div class="stgs">${stages}</div>
        <div class="row between"><span class="card-title">Kun so'zlari</span><a class="link" href="#/day/${d}">Hammasi · ${words.length}</a></div>
        <div class="dd-words">${words.slice(0, 12).map((id) => { const w = S.word(id); return `<button class="dd-word" data-act="word" data-id="${id}"><b class="ko">${esc(w.ko)}</b><span>${esc(w.uz)}</span></button>`; }).join("")}</div>
      </section>`;
    const body = `<div class="page"><div class="course-grid">
        <section class="card day-list" aria-label="Kunlar">${Array.from({ length: S.DAYS }, (_, i) => row(i + 1)).join("")}</section>
        ${detail}
      </div></div>`;
    return V.shell("course", V.topbar("Kurs", `${S.daysDone()} / ${S.DAYS} kun · ${S.learnedIds().length} / ${S.TOTAL} so'z`), body);
  };
  Actions["course-pick"] = (el) => { courseSel = Number(el.dataset.d); App.render(); };

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
    const body = `<div class="page collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:44px">
      <div style="min-width:0">
        <div class="row wrap between" style="align-items:flex-end;margin-bottom:24px;gap:16px">
          <div><div class="eyebrow" style="margin-bottom:10px">${d}-KUN / ${S.DAYS}</div>
            <h3 class="page-h" style="font-size:30px;margin-bottom:6px">${esc(S.dayTitle(d))}</h3>
            <p class="page-p">${words.length} so'z · ${plan.blocks.length} blok · ~${plan.minutes} daqiqa</p></div>
          ${cta}
        </div>
        ${locked ? `<div class="card pad" style="margin-bottom:16px;background:var(--sf2)"><span class="muted">Bu kun ${d - 2}-kun tugagandan keyin ochiladi. Hozirgi kun: <a href="#/day/${S.currentDay()}">${S.currentDay()}-kun</a>.</span></div>` : ""}
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
            return `<div class="row" style="gap:12px"><span style="width:24px;height:24px;border-radius:99px;flex:none;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;
              background:${isDone ? "var(--p)" : isCur ? "var(--pl)" : "var(--bg)"};color:${isDone ? "#fff" : isCur ? "var(--pd)" : "var(--ink3)"}">${isDone ? "✓" : i + 1}</span>
              <span class="grow" style="font-size:14px;${isCur ? "font-weight:600" : "color:var(--ink2)"}">${esc(sg.label)}</span>
              <span class="mono faint" style="font-size:12px">${sg.min} daq</span></div>`; }).join("")}</div>
        </div>
        <div class="card-pl" style="padding:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:8px">Oraliqli takrorlash</div>
          <p style="margin:0;font-size:13px;line-height:1.55">Bugungi so'zlar 1, 3, 7 va 16-kunlarda avtomatik qaytariladi. Xato qilgan so'z ertaga yana chiqadi.</p>
        </div>
        <div class="card pad">
          <div style="font-size:13px;font-weight:700;margin-bottom:10px">Blok o'lchami</div>
          <div class="picks">${[11, 17, 33].map((n) => `<button class="${plan.pace === n ? "on" : ""}" data-act="day-pace" data-day="${d}" data-v="${n}" ${started && (ds.stage > 0 || ds.done) ? "disabled" : ""}>${n}</button>`).join("")}</div>
          ${started && (ds.stage > 0 || ds.done) ? `<div class="faint" style="font-size:13px;margin-top:8px">Kun boshlangan — o'lcham keyingi kunlarga Profil'dan o'zgartiriladi.</div>` : ""}
        </div>
      </div></div>`;
    return V.shell("day", V.topbar("", `<a class="back" href="#/course">← 30 kunlik kurs</a>`, `<span class="tag">${pill}</span>`), body);
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
        <div class="done-glyph" aria-hidden="true">완료</div>
        <h3 style="margin:0 0 8px;font-size:36px;font-weight:700;letter-spacing:-.02em">${d}-kun tugadi</h3>
        <p class="muted" style="margin:0;font-size:16px">${words.length} so'z o'rganildi. Seriya ${S.streak()} kunga yetdi.</p>
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
            <span class="grow muted" style="font-size:14px">${esc(w.uz)}</span><span class="mono badc" style="font-size:12px">${S.ws(w.id).bad} xato</span></div>`).join("")
            : `<div class="muted" style="font-size:14px">Barcha so'zlar yaxshi o'zlashtirildi.</div>`}</div>
        </div>
        <div class="card-pl" style="padding:22px 24px;border-radius:16px">
          <div style="font-size:14px;font-weight:700;color:var(--on-pl);margin-bottom:14px">Keyingi takrorlash rejasi</div>
          <div class="stack" style="gap:11px">${buckets.map(([lbl, n]) => `<div class="row" style="gap:12px"><span class="mono accent" style="font-size:12px;min-width:70px">${lbl}</span><span class="grow" style="font-size:14px">${n} so'z</span></div>`).join("")}</div>
        </div>
      </div>
      <div class="row wrap" style="justify-content:center;gap:12px">
        ${weak.length ? `<button class="btn btn-p" data-act="quiz-ids" data-ids="${weak.map((w) => w.id).join(",")}">${weak.length} zaif so'zni mashq qilish</button>`
          : d < S.DAYS ? `<a class="btn btn-p" href="#/day/${d + 1}">${d + 1}-kunga o'tish</a>` : ""}
        <a class="btn btn-ghost" href="#/dashboard">Bosh sahifa</a>
      </div></div></div></div>`;
  };

  // ---------- Review hub (E1) ----------
  // Today's queue first, then the other lists to practise, the coming week and the exercise types.
  V.review = () => {
    const today = U.today();
    const g = S.reviewGoal(), learned = S.learnedIds();
    // The queue the session will actually run, already cut to the goal by the store. Everything on this screen
    // that describes "today" counts from it. The forecast below is the one place that still reads the raw
    // schedule — each word's own due date — because there the untouched plan is genuinely what is meant.
    const queue = S.reviewQueue("due");
    const late = queue.filter((id) => S.ws(id).due < today).length;
    const week = Array.from({ length: 7 }, (_, i) => {
      const k = U.addDays(today, i);
      // Today's column is the day's goal. The overflow is not counted here: it is moved into the days to its
      // right at the next rollover, so adding it to today would show the same words twice.
      const n = i ? learned.filter((id) => S.ws(id).due === k).length : g.left;
      return { n, today: !i, lbl: i === 0 ? "Bugun" : i === 1 ? "Ertaga" : U.WEEK_SHORT[(U.parseKey(k).getDay() + 6) % 7] };
    });
    // Three states. The middle one — the goal met while words are still due — is the whole point of the change:
    // what did not fit is scheduled into the coming days, not owed, so the hero reports a finished day and never
    // names the leftover as a number to catch up on.
    let hero;
    if (g.left) {
      hero = `<section class="rv-today">
        <span class="mono rv-eyebrow">BUGUNGI MAQSAD</span>
        <div class="rv-goal">${goalRing(g, 64)}<div class="rv-big"><b>${esc(g.left)}</b><span>so'z · ~${esc(g.minutes)} daq</span></div></div>
        <span class="rv-note">${late ? `${esc(late)} tasi kechikkan — avval ular chiqadi.` : "Unutilishidan oldin qaytarib oling."}</span>
        <button class="btn rv-go" data-act="review-start" data-mode="due">Boshlash</button>
      </section>`;
    } else if (g.due) {
      hero = `<section class="rv-today">
        <span class="mono rv-eyebrow">BUGUN BAJARILDI</span>
        <div class="rv-goal">${goalRing(g, 64)}<div class="rv-big"><b>${esc(g.done)}</b><span>so'z takrorlandi</span></div></div>
        <span class="rv-note">Qolgan so'zlar keyingi kunlarga taqsimlanadi — bugun yetarli ish qildingiz.</span>
        <button class="btn rv-more" data-act="ex-review-extra">Yana ${esc(X.EXTRA_ROUND)} ta so'z</button>
      </section>`;
    } else {
      hero = `<section class="rv-today">
        <span class="mono rv-eyebrow">${g.done ? "BUGUN BAJARILDI" : "BUGUN TAKRORLASH YO'Q"}</span>
        ${g.done ? `<div class="rv-goal">${goalRing(g, 64)}<div class="rv-big"><b>${esc(g.done)}</b><span>so'z takrorlandi</span></div></div>
        <span class="rv-note">Bugunga takrorlash qolmadi. Ertaga yangilari keladi.</span>`
        : `<span class="rv-note">${learned.length ? "O'rgangan so'zlaringiz muddati kelganda shu yerda chiqadi." : "Birinchi kunni boshlang — o'rgangan so'zlaringiz takrorlash uchun shu yerda chiqadi."}</span>`}
      </section>`;
    }
    const mode = (title, ids, desc, m, cta, bad) => `<section class="card rv-mode">
        <span class="card-title">${title}</span><b class="rv-n ${bad && ids.length ? "badc" : ""}">${ids.length}</b><span class="side-note">${desc}</span>
        ${ids.length ? `<button class="link" data-act="review-start" data-mode="${m}">${cta}</button>` : `<span class="side-note rv-none">Hozircha yo'q</span>`}
      </section>`;
    const quizzes = ["mixed", "listen", "type", "sent"].map((k) => {
      const t = X.QUIZ_TYPES[k];
      return `<button class="card rv-quiz" data-act="quiz-go" data-k="${k}"><b>${t.name}</b><span class="side-note">${t.desc}</span><span class="mono accent">20 savol · ~${Math.max(1, Math.round(20 * t.mins))} daq</span></button>`;
    }).join("");
    const shown = queue.slice(0, 8);
    const list = shown.map((id) => {
      const w = S.word(id), st = S.ws(id), isLate = st.due < today;
      return `<button class="li ${isLate ? "bad" : ""}" style="gap:18px;padding:13px 20px" data-act="word" data-id="${id}">
          <span class="mono ${isLate ? "badc" : "faint"}" style="font-size:12px;min-width:44px">D${w.day}</span>
          <span class="kw">${esc(w.ko)}</span><span class="mean" style="${isLate ? "color:var(--badd)" : ""}">${esc(w.uz)}</span>
          ${V.mbar(id)}
          <span class="meta" style="min-width:64px;color:${isLate ? "var(--bad)" : "var(--pd)"}">${U.dueLabel(st.due)}</span></button>`;
    }).join("");
    const body = `<div class="page">
      <div class="rv-top">${hero}
        ${mode("Qiyin", S.weakIds(), "2 va undan ko'p marta xato qilingan so'zlar", "weak", "Mashq qilish", true)}
        ${mode("Belgilangan", S.flaggedIds(), "O'zingiz qiyin deb belgilagan so'zlar", "flag", "Mashq qilish")}
        ${mode("Unutilgan", S.forgottenIds(), "Darajasi pasaygan so'zlar", "forgot", "Qaytarish")}
      </div>
      <section class="card rv-cal">
        <div class="row between"><span class="card-title">Takrorlash taqvimi</span><span class="side-note">keyingi 7 kunda ${week.reduce((s, x) => s + x.n, 0)} so'z</span></div>
        <div class="rv-days">${week.map((x) => `<div class="${x.today ? "on" : ""}"><span>${x.lbl}</span><b>${x.n}</b><span>so'z</span></div>`).join("")}</div>
      </section>
      <div class="row between rv-h"><span class="card-title">Mashq turlari</span><a class="link" href="#/quiz">Barcha sozlamalar</a></div>
      <div class="rv-quizzes">${quizzes}</div>
      ${shown.length ? `<div class="row between rv-h"><span class="card-title">Bugungi so'zlar</span>${queue.length > shown.length ? `<span class="side-note">yana ${esc(queue.length - shown.length)} so'z</span>` : ""}</div>
      <div class="list">${list}</div>` : ""}
    </div>`;
    return V.shell("review", V.topbar("Takrorlash", ""), body);
  };
  Actions["review-start"] = (el) => X.startReview(el.dataset.mode || "due");
  Actions["quiz-go"] = (el) => { quizCfg.type = el.dataset.k; App.go("#/quiz"); };

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
    if (!block) return { open: false, text: "6-kundan keyin ochiladi — 6 kunlik material." };
    const a = (block - 1) * 6 + 1, b = block * 6;
    return { open: true, a, b, text: `${a}–${b}-kunlar bo'yicha nazorat — 6 kunlik material.` };
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
        <div class="done-glyph" aria-hidden="true" style="font-size:44px">연습</div><h3 style="margin:0 0 8px;font-size:22px">Mashq uchun so'z yo'q</h3>
        <p class="muted" style="margin:0 0 20px">Avval kunlik darsda kamida 4 ta so'z o'rganing.</p>
        <button class="btn btn-p" data-act="learn" data-day="${S.currentDay()}">${S.currentDay()}-kunni boshlash</button></div></div>`
      : `<div class="page collapse-md" style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:44px">
      <div style="min-width:0">
        <h3 class="page-h">Mashq turini tanlang</h3>
        <p class="page-p" style="margin-bottom:26px">Har bir mashq natijasi so'z mastery'siga yoziladi.</p>
        <div class="two-sm" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${types.map(card).join("")}</div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:16px">Sozlamalar</div>
          <div style="font-size:13px;font-weight:600;color:var(--ink3);margin-bottom:8px">So'z manbasi</div>
          <div class="stack" style="gap:6px;margin-bottom:${quizCfg.source === "days" ? 10 : 20}px">
            ${[["all", `Hamma o'rganilgan (${learned.length})`], ["weak", `Faqat zaif so'zlar (${S.weakIds().length})`], ["days", "Tanlangan kunlar"]].map(([k, l]) =>
              `<button class="chip ${quizCfg.source === k ? "on" : ""}" style="border-radius:10px;padding:11px 14px;font-size:14px;justify-content:flex-start" data-act="quiz-src" data-k="${k}">${l}</button>`).join("")}
          </div>
          ${quizCfg.source === "days" ? `<div class="days" style="margin-bottom:20px">${[...new Set(learned.map((id) => S.word(id).day))].sort((a, b) => a - b).map((d) =>
            `<button class="dsq ${quizCfg.days.includes(d) ? "completed" : "available"}" data-act="quiz-day" data-d="${d}">${d}</button>`).join("")}</div>` : ""}
          <div style="font-size:13px;font-weight:600;color:var(--ink3);margin-bottom:8px">Savol soni</div>
          <div class="picks" style="margin-bottom:20px">${[10, 20, 40].map((n) => `<button class="${quizCfg.count === n ? "on" : ""}" data-act="quiz-count" data-n="${n}">${n}</button>`).join("")}</div>
          <div class="row between" style="padding:12px 0;border-top:1px solid var(--line)"><span>Vaqt chegarasi <span class="faint" style="font-size:13px">· 20s</span></span>${toggle(quizCfg.timer, "quiz-opt", "timer", "Vaqt chegarasi")}</div>
          <div class="row between" style="padding:12px 0;border-top:1px solid var(--line)"><span>Darhol javob ko'rsatish</span>${toggle(quizCfg.instant, "quiz-opt", "instant", "Darhol javob")}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:14px">Oxirgi natijalar</div>
          <div class="stack" style="gap:12px">${recent.length ? recent.map((r) => { const p = U.pct(r.ok, r.total); return `<div class="row" style="gap:12px">
            <span class="grow muted" style="font-size:13px">${esc((X.QUIZ_TYPES[r.type] || { name: r.type }).name)}</span>
            <span class="mono" style="font-size:13px;font-weight:500;color:${p >= 85 ? "var(--ok)" : p < 70 ? "var(--bad)" : "var(--ink)"}">${r.ok}/${r.total}</span></div>`; }).join("")
            : `<div class="faint" style="font-size:13px">Hali mashq qilinmagan.</div>`}</div>
        </div>
        <button class="btn btn-p" style="padding:16px 22px" data-act="quiz-start" ${quizCfg.type === "checkpoint" || pool.length >= 4 || (quizCfg.type === "sent" && sentCount) ? "" : "disabled"}>Mashqni boshlash</button>
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
      X.startQuiz({ type: "checkpoint", ids, count: 30, timer: quizCfg.timer, instant: quizCfg.instant, title: `Nazorat testi · ${cp.a}–${cp.b}-kunlar` });
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
              <span style="font-size:13px"><i style="background:var(--pdb)"></i>O'zlashtirilgan ${mastered}</span>
              <span style="font-size:13px"><i style="background:var(--p)"></i>O'rganilmoqda ${learning}</span>
              <span style="font-size:13px"><i style="background:var(--line)"></i>Qolgan ${S.TOTAL - learned}</span></div>
          </div>
        </div>
        <div class="card" style="padding:22px 24px;margin-bottom:16px">
          <div class="row between" style="margin-bottom:20px"><span class="card-title">Kunlik faollik</span><span class="mono faint" style="font-size:12px">o'rganilgan + takrorlangan so'z / kun</span></div>
          <div style="overflow-x:auto"><div class="bars" style="height:150px;gap:${n > 20 ? 4 : 7}px;min-width:${n > 30 ? n * 14 : 0}px">${series.map((x) => {
            const h = x.v ? Math.max(8, Math.round((x.v / max) * 124)) : 5;
            return `<div class="col" title="${U.fmtDayMonth(x.k)}: ${x.learned} yangi, ${x.v - x.learned} takror"><div class="${x.v ? (x.k === today ? "cur" : "") : "zero"}" style="height:${h}px"></div>
              <span class="mono ${x.k === today ? "cur" : ""}" style="font-size:12px">${U.parseKey(x.k).getDate()}</span></div>`; }).join("")}</div></div>
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
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">O'rtacha oraliq</span><span style="font-size:20px;font-weight:800">${avgInt} kun</span></div><div class="sep"></div>
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">O'zlashtirishgacha</span><span style="font-size:20px;font-weight:800">${avgSeen} ko'rish</span></div><div class="sep"></div>
              <div class="row between" style="align-items:baseline"><span class="muted" style="font-size:13px">Esdan chiqqan</span><span style="font-size:20px;font-weight:800;color:var(--bad)">${S.forgottenIds().length} so'z</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="stack" style="gap:14px">
        <div class="card-pl" style="padding:22px">
          <div class="upl" style="font-size:12px;color:var(--on-pl3);margin-bottom:14px">Seriya</div>
          <div style="font-size:44px;font-weight:800;letter-spacing:-.04em;color:var(--pd);line-height:1;margin-bottom:6px">${streak}</div>
          <div style="font-size:14px;margin-bottom:18px">kun ketma-ket · eng uzun ${S.state.bestStreak}</div>
          <div class="row" style="gap:4px">${weekDays.map((k) => `<div class="grow" title="${U.fmtDayMonth(k)}" style="height:26px;border-radius:5px;background:${S.dayMinutes(k) >= 1 || (S.state.act[k] || {}).learned ? "var(--pdb)" : "var(--tint)"}"></div>`).join("")}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="upl" style="font-size:12px;margin-bottom:14px">O'qish vaqti</div>
          <div style="font-size:32px;font-weight:800;letter-spacing:-.035em;line-height:1;margin-bottom:5px">${U.durText(total)}</div>
          <div class="muted" style="font-size:13px;margin-bottom:18px">jami · kuniga o'rtacha ${days ? Math.round(total / days) : 0} daq</div>
          <div class="sep" style="margin-bottom:16px"></div>
          <div class="stack" style="gap:9px">${[["O'rganish", "learn"], ["Takrorlash", "review"], ["Mashqlar", "quiz"]].map(([l, k]) => `<div class="row between"><span class="muted" style="font-size:13px">${l}</span><span class="mono" style="font-size:13px">${U.durText(S.minutesBy(k))}</span></div>`).join("")}</div>
        </div>
        <div class="card" style="padding:20px 22px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">Tavsiya</div><p class="muted" style="margin:0;font-size:13px;line-height:1.55">${esc(tip)}</p></div>
      </div></div>`;
    const tabs = `<div class="seg">${[[30, "30 kun"], [7, "7 kun"], [0, "Hammasi"]].map(([v, l]) => `<button class="${progRange === v ? "on" : ""}" data-act="prog-range" data-v="${v}">${l}</button>`).join("")}</div>`;
    return V.shell("progress", V.topbar("Natijalar", progRange ? `oxirgi ${progRange} kun` : "butun davr", `<a class="btn btn-sec btn-sm" href="#/achievements">Yutuqlar</a>${tabs}`), body);
  };
  Actions["prog-range"] = (el) => { progRange = Number(el.dataset.v); App.render(); };

  // ---------- Library (G2) ----------
  const lib = { status: "all", origin: "all", days: [], sort: "mastery-asc", q: "", page: 1 };
  const ORIGIN_ORDER = { sino: 0, native: 1, loan: 2 };
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
    // Counts per origin for the current status and days, before the origin filter itself.
    const origins = { all: rows.length, sino: 0, native: 0, loan: 0 };
    for (const id of rows) origins[S.origin(id)]++;
    if (lib.origin !== "all") rows = rows.filter((id) => S.origin(id) === lib.origin);
    const q = lib.q.trim().toLowerCase();
    if (q) rows = rows.filter((id) => { const w = S.word(id); return w.ko.includes(q) || w.uz.toLowerCase().includes(q) || U.romanize(w.ko).includes(q); });
    const cmp = {
      "mastery-asc": (a, b) => S.mastery(a) - S.mastery(b) || (S.ws(b) || {}).bad - (S.ws(a) || {}).bad,
      "mastery-desc": (a, b) => S.mastery(b) - S.mastery(a),
      alpha: (a, b) => S.word(a).ko.localeCompare(S.word(b).ko, "ko"),
      day: (a, b) => S.word(a).day - S.word(b).day || S.word(a).i - S.word(b).i,
      due: (a, b) => ((S.ws(a) || {}).due || "9").localeCompare((S.ws(b) || {}).due || "9"),
      origin: (a, b) => ORIGIN_ORDER[S.origin(a)] - ORIGIN_ORDER[S.origin(b)] || S.word(a).day - S.word(b).day || S.word(a).i - S.word(b).i,
    }[lib.sort];
    return { rows: rows.slice().sort(cmp), sets, origins };
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
        <span style="min-width:124px" class="hide-sm">O'zlashtirish</span><span style="min-width:72px" class="hide-sm hide-lg">Ko'rishlar</span><span style="min-width:72px;text-align:right">Keyingi</span></div>
      ${slice.length ? slice.map((id) => {
        const w = S.word(id), st = S.ws(id), weak = S.isWeak(id), late = st && st.learned && st.due < U.today();
        return `<button class="li ${weak ? "bad" : ""}" style="gap:18px;padding:12px 20px" data-act="word" data-id="${id}">
          <span class="kw" style="min-width:100px">${esc(w.ko)} <span class="otag o-${S.origin(id)}" title="${esc(S.ORIGINS[S.origin(id)].uz)}">${S.ORIGINS[S.origin(id)].ko}</span></span><span class="mean" style="${weak ? "color:var(--badd)" : ""}">${esc(w.uz)}</span>
          <span class="mono faint" style="font-size:12px;min-width:44px">D${w.day}</span>
          <span class="hide-sm" style="min-width:124px">${st && st.learned ? V.mbar(id, true, true) : `<span class="faint" style="font-size:12px">—</span>`}</span>
          <span class="mono muted hide-sm hide-lg" style="font-size:12px;min-width:72px">${st ? `${st.seen} · ${st.ok}✓` : "0"}</span>
          <span class="mono" style="font-size:12px;min-width:72px;text-align:right;color:${!st || !st.learned ? "var(--ink3)" : late ? "var(--bad)" : st.due <= U.today() ? "var(--pd)" : "var(--ink3)"}">${st && st.learned ? U.dueLabel(st.due) : "yangi"}</span></button>`; }).join("")
      : `<div class="empty">Hech narsa topilmadi.</div>`}</div>
      <div class="row between" style="margin-top:16px">
        <span class="mono faint" style="font-size:12px">${rows.length ? `${(lib.page - 1) * PER + 1}–${Math.min(lib.page * PER, rows.length)} / ${rows.length}` : "0"}</span>
        <div class="row" style="gap:6px">${pg.map((p) => `<button class="dsq ${p === lib.page ? "completed" : "available"}" style="width:30px;height:30px;font-size:12px" data-act="lib-page" data-p="${p}">${p}</button>`).join("")}
          ${lib.page < pages ? `<button class="dsq available" style="width:30px;height:30px;font-size:12px" data-act="lib-page" data-p="${lib.page + 1}" aria-label="Keyingi sahifa">›</button>` : ""}</div>
      </div>`;
  }
  V.library = () => {
    const { sets, origins } = libRows();
    const og = [["all", "Hammasi", ""], ...Object.entries(S.ORIGINS).map(([k, o]) => [k, o.uz, o.ko])];
    const learnedDays = [...new Set(S.learnedIds().map((id) => S.word(id).day))].sort((a, b) => a - b);
    const st = [["all", "Hammasi"], ["mastered", "O'zlashtirilgan"], ["learning", "O'rganilmoqda"], ["weak", "Zaif"], ["recent", "Yaqinda o'rganilgan"], ["flag", "Belgilanganlar"], ["unlearned", "Hali o'rganilmagan"]];
    const body = `<div class="page collapse-md" style="display:grid;grid-template-columns:220px minmax(0,1fr);gap:32px">
      <div class="stack" style="gap:22px">
        <div><div class="upl" style="margin-bottom:10px">Holat</div>
          <div class="nav filt">${st.map(([k, l]) => `<a href="javascript:void 0" class="${lib.status === k ? "on" : ""}" data-act="lib-status" data-k="${k}" style="padding:9px 12px">${l}<span class="cnt" style="${k === "weak" && sets.weak.length ? "color:var(--bad)" : ""}">${sets[k].length}</span></a>`).join("")}</div></div>
        <div><div class="upl" style="margin-bottom:10px">Kelib chiqishi</div>
          <div class="nav filt">${og.map(([k, l, ko]) => `<a href="javascript:void 0" class="${lib.origin === k ? "on" : ""}" data-act="lib-origin" data-k="${k}" style="padding:9px 12px" title="${k === "all" ? "" : esc(S.ORIGINS[k].desc)}">${ko ? `<span class="ko" style="font-weight:700">${ko}</span>` : ""}${l}<span class="cnt">${origins[k]}</span></a>`).join("")}</div></div>
        <div><div class="upl" style="margin-bottom:10px">Kun</div>
          <div class="days">${(lib.status === "unlearned" ? Array.from({ length: S.DAYS }, (_, i) => i + 1) : learnedDays).map((d) => `<button class="dsq ${lib.days.includes(d) ? "completed" : "available"}" style="width:28px;height:28px" data-act="lib-day" data-d="${d}">${d}</button>`).join("") || `<span class="faint" style="font-size:12px">—</span>`}</div></div>
        <div><div class="upl" style="margin-bottom:10px">Saralash</div>
          ${U.dropdown({ change: "lib-sort", value: lib.sort, label: "Saralash", block: true, options: [["mastery-asc", "O'zlashtirish: kamidan"], ["mastery-desc", "O'zlashtirish: ko'pidan"], ["due", "Keyingi takrorlash"], ["day", "Kun bo'yicha"], ["origin", "Kelib chiqishi (한자어 → 고유어 → 외래어)"], ["alpha", "Alifbo (가나다)"]] })}</div>
      </div>
      <div style="min-width:0">
        <div class="row wrap" style="gap:10px;margin-bottom:18px">
          <input class="input grow" style="padding:13px 16px;font-size:14px;background:var(--sf);min-width:200px" placeholder="한국어 yoki o'zbekcha izlash…" value="${esc(lib.q)}" data-input="lib-search" aria-label="Qidirish">
          <button class="btn btn-sec btn-sm" style="padding:13px 20px;font-size:14px" data-act="lib-export">Eksport</button>
          <button class="btn btn-p btn-sm" style="padding:13px 20px;font-size:14px" data-act="lib-practice">Shu ro'yxatni mashq qilish</button>
        </div>
        <div id="lib-table">${libTable()}</div>
      </div></div>`;
    return V.shell("library", V.topbar("So'zlar", `${S.learnedIds().length} so'z o'rganilgan · ${S.TOTAL} jami`), body);
  };
  const refreshLib = () => { const el = document.getElementById("lib-table"); if (el) el.innerHTML = libTable(); };
  Actions["lib-status"] = (el) => { lib.status = el.dataset.k; lib.page = 1; App.render(); };
  Actions["lib-origin"] = (el) => { lib.origin = el.dataset.k; lib.page = 1; App.render(); };
  Actions["lib-day"] = (el) => { const d = Number(el.dataset.d); const i = lib.days.indexOf(d); if (i >= 0) lib.days.splice(i, 1); else lib.days.push(d); lib.page = 1; App.render(); };
  Actions["lib-page"] = (el) => { lib.page = Number(el.dataset.p); refreshLib(); };
  Changes["lib-sort"] = (el) => { lib.sort = el.value; lib.page = 1; refreshLib(); };
  Inputs["lib-search"] = (el) => { lib.q = el.value; lib.page = 1; refreshLib(); };
  Actions["lib-export"] = () => {
    const { rows } = libRows();
    const csv = ["korean,romanization,uzbek,origin,hanja,day,mastery,seen,correct,wrong,next_review"].concat(rows.map((id) => {
      const w = S.word(id), st = S.ws(id) || {};
      const hanja = ((S.roots(id) || {}).parts || []).map((p) => p.h || "").join("");
      return [w.ko, U.romanize(w.ko), w.uz, S.ORIGINS[S.origin(id)].ko, hanja, w.day, S.mastery(id), st.seen || 0, st.ok || 0, st.bad || 0, st.due || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
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
    const rs = X.rootsSections(id, { linkWords: true });
    const note = S.note(id) ? `<div class="isec"><div class="upl">O'z eslatmangiz</div><div style="font-size:15px">${esc(S.note(id))}</div></div>` : "";
    const left = rs.build + rs.hint + rs.note, right = rs.related + note;
    U.modal(`${w.day}-kun so'zi`, `
      <div class="wm-head">
        <div>
          <div class="row" style="align-items:center;gap:14px"><span class="ko" style="font-size:44px;font-weight:700;letter-spacing:-.03em;line-height:1.15">${esc(w.ko)}</span>
            <button class="audio-dot" data-act="say" data-kind="words" data-id="${esc(id)}" data-text="${esc(w.ko)}" aria-label="Talaffuz">▸</button></div>
          <div class="row wrap" style="gap:12px;align-items:center;margin-top:6px"><span class="mono faint" style="font-size:14px">[ ${esc(U.romanize(w.ko))} ]</span>${X.originBadge(id)}</div>
        </div>
        <div class="wm-mean"><div class="upl" style="margin-bottom:6px">Ma'nosi</div><div style="font-size:22px;font-weight:700;line-height:1.3">${esc(w.uz)}</div></div>
      </div>
      ${left || right ? `<div class="wm-grid modal-roots"><div>${left}</div><div>${right}</div></div>` : ""}
      ${ex ? `<div class="example"><div class="s" style="font-size:18px">${esc(ex.ko).replace(esc(ex.hl), `<b>${esc(ex.hl)}</b>`)} <button class="audio-dot" style="width:28px;height:28px;font-size:12px;vertical-align:middle" data-act="say" data-kind="sentences" data-id="${esc(id)}" data-text="${esc(ex.ko)}" aria-label="Gapni eshitish">▸</button></div><div class="muted" style="font-size:14px">${esc(ex.uz.replace(/[{}]/g, ""))}</div></div>` : ""}
      ${st && st.learned ? `<div class="strip" style="margin:16px 0"><div><div class="upl s">O'zlashtirish</div><div class="v" style="margin-top:10px">${V.mbar(id)}</div></div>
        <div><div class="upl s">Ko'rish</div><div class="v"><b>${st.seen}</b><span>${st.ok}✓ ${st.bad}✕</span></div></div>
        <div><div class="upl s">Keyingi</div><div class="v"><b style="font-size:17px">${U.dueLabel(st.due)}</b></div></div></div>`
        : `<p class="faint" style="font-size:13px">Bu so'z hali o'rganilmagan.</p>`}
      <div class="row wrap" style="gap:10px">
        ${st && st.learned ? `<button class="btn btn-sec btn-sm" data-act="flag" data-id="${id}">${st.flag ? "Belgilangan ✓" : "Qiyin deb belgilash"}</button>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="modal-close">Yopish</button>
      </div>`, { width: 900 });
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
          <div><div class="upl" style="font-size:12px;color:var(--on-pl3);margin-bottom:8px">${lv.level}-daraja</div>
            <div style="font-size:34px;font-weight:800;letter-spacing:-.035em;color:var(--on-pl);line-height:1">${U.num(lv.xp)} XP</div></div>
          <div class="grow" style="min-width:200px"><div style="height:10px;border-radius:6px;background:var(--tint);overflow:hidden;margin-bottom:8px"><div style="height:100%;width:${lv.pct}%;border-radius:6px;background:var(--pdb)"></div></div>
            <div class="row between" style="font-size:13px"><span>${lv.level + 1}-darajagacha ${U.num(lv.toNext)} XP</span><span>${U.num(lv.next)}</span></div></div>
        </div>
        <div class="card-title" style="margin-bottom:14px">Ochilgan yutuqlar <span class="faint mono" style="font-size:12px;font-weight:400">${open.length}</span></div>
        <div class="two-sm" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:26px">${open.length ? open.map(ach).join("") : `<div class="faint" style="grid-column:1/-1;font-size:14px">Birinchi yutuq 1-kun tugagach ochiladi.</div>`}</div>
        <div class="card-title" style="margin-bottom:14px">Yopiq yutuqlar</div>
        <div class="two-sm" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${closed.map(ach).join("")}</div>
      </div>
      <div class="stack" style="gap:16px">
        <div class="card" style="padding:22px">
          <div class="row between" style="margin-bottom:16px"><span class="card-title">Reyting</span><span class="mono faint" style="font-size:12px">bu hafta${board && board.total ? ` · ${board.total} ishtirokchi` : ""}</span></div>
          <div class="stack" style="gap:11px">${!board ? `<div class="faint" style="font-size:13px">Yuklanmoqda…</div>` : board.rows.length ? board.rows.map((r) => r.me
            ? `<div class="row" style="gap:12px;padding:9px 11px;margin:0 -11px;border-radius:10px;background:var(--pl)"><span class="mono accent" style="font-size:12px;min-width:18px">${r.rank}</span>
                <span class="avatar" style="width:26px;height:26px;border-radius:8px;background:var(--pdb);color:#fff;font-size:12px">${initial()}</span><span class="grow" style="font-size:13px;font-weight:700;color:var(--on-pl)">Siz</span><span class="mono accent" style="font-size:12px;font-weight:500">${U.num(r.xp)}</span></div>`
            : `<div class="row" style="gap:12px"><span class="mono faint" style="font-size:12px;min-width:18px">${r.rank}</span>
                <span class="avatar" style="width:26px;height:26px;border-radius:8px;background:var(--bg);color:var(--ink2);font-size:12px">${esc(r.name.charAt(0))}</span><span class="grow" style="font-size:13px">${esc(r.name)}</span><span class="mono" style="font-size:12px">${U.num(r.xp)}</span></div>`).join("")
            : `<div class="faint" style="font-size:13px">Bu hafta hali hech kim XP to'plamadi.</div>`}
            ${board && board.offline ? `<div class="faint" style="font-size:12px">Serverga ulanib bo'lmadi.</div>` : ""}</div>
        </div>
        <div class="card" style="padding:22px">
          <div class="card-title" style="margin-bottom:16px">Kunlik vazifa</div>
          <div class="stack" style="gap:14px">${ch.items.map((i) => `<div><div class="row between" style="margin-bottom:6px"><span style="font-size:13px">${esc(i.label)}</span>
            <span class="mono ${i.cur >= i.goal ? "okc" : "faint"}" style="font-size:12px">${i.cur >= i.goal ? "bajarildi" : `${i.cur}/${i.goal}`}</span></div>
            <div class="prog" style="height:5px"><div style="width:${U.pct(i.cur, i.goal)}%;${i.cur >= i.goal ? "background:var(--ok)" : ""}"></div></div></div>`).join("")}</div>
          <div class="row between" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)"><span class="muted" style="font-size:13px">Mukofot</span><span class="mono ${ch.done ? "okc" : "accent"}" style="font-size:13px">${ch.done ? "olindi ✓" : `+${ch.reward} XP`}</span></div>
        </div>
      </div></div>`;
    return V.shell("achievements", V.topbar("Yutuqlar", `${open.length} / ${list.length} ochilgan`), body);
  };
  V.resetBoard = () => { board = null; };

  // ---------- Profile & settings (G4) ----------
  // The account on top; below it one settings section at a time, picked from the list beside it.
  let profTab = "plan";
  const PROF_TABS = [["plan", "O'qish rejasi"], ["reminders", "Eslatmalar"], ["ui", "Interfeys"], ["account", "Hisob va xavfsizlik"]];
  V.profile = () => {
    const p = S.state.profile, set = S.state.settings, r = p.reminders, lv = S.levelInfo();
    const startKey = Object.values(S.state.days).length ? (Object.values(S.state.days).map((d) => d.doneAt).filter(Boolean).sort()[0] || p.joined) : p.joined;
    const endKey = U.addDays(startKey, S.DAYS);
    const row = (label, right) => `<div class="set-row"><div class="set-l">${label}</div><div class="set-r">${right}</div></div>`;
    const hint = (text) => ` <span class="faint" style="font-size:13px">· ${text}</span>`;
    const perm = Push.permission();

    let section;
    if (profTab === "reminders") {
      section = `<h2 class="ps-h">Eslatmalar</h2>
        <p class="ps-p">Har kuni shu vaqtda telefon yoki kompyuteringizga bildirishnoma keladi — sayt yopiq bo'lsa ham.</p>
        ${S.user.demo ? `<p class="muted set-note">Demo hisobda eslatmalar yuborilmaydi.</p>` : ""}
        ${row(`Eslatmalar${hint({ granted: "ruxsat berilgan", denied: "brauzerda bloklangan", default: "ruxsat so'raladi", install: "bosh ekranga qo'shing", unsupported: "brauzer qo'llamaydi" }[perm])}`, toggle(r.on, "rem-toggle", "on", "Eslatmalar"))}
        ${row(`Bugungi dars <input type="time" class="time-input sm" value="${esc(r.learn)}" data-change="rem-time" data-k="learn" aria-label="Dars vaqti">`, toggle(r.on && r.learnOn !== false, "rem-toggle", "learnOn", "Dars eslatmasi"))}
        ${row(`Takrorlash <input type="time" class="time-input sm" value="${esc(r.review)}" data-change="rem-time" data-k="review" aria-label="Takrorlash vaqti">`, toggle(r.on && r.reviewOn !== false, "rem-toggle", "reviewOn", "Takrorlash eslatmasi"))}
        ${row(`Seriya eslatmasi${hint("21:30")}`, toggle(r.on && r.streak, "rem-toggle", "streak", "Seriya eslatmasi"))}
        ${r.on && !S.user.demo && perm === "granted" ? row("Sinov bildirishnomasi", `<button class="link" data-act="push-test">yuborish</button>`) : ""}
        ${r.on && ["denied", "install", "unsupported"].includes(perm) ? `<p class="muted set-note" style="margin:10px 0 0">${esc(Push.explain(perm))}</p>` : ""}`;
    } else if (profTab === "ui") {
      section = `<h2 class="ps-h">Interfeys</h2>
        <p class="ps-p">Ko'rinish va talaffuz. O'zgarishlar darhol qo'llanadi.</p>
        ${row("Mavzu", `<div class="seg" style="padding:3px">${[["system", "Tizim"], ["light", "Yorug'"], ["dark", "Tungi"]].map(([v, l]) => `<button class="${S.themePref() === v ? "on" : ""}" data-act="set-theme" data-v="${v}">${l}</button>`).join("")}</div>`)}
        ${row("Romanizatsiya ko'rsatish", toggle(set.roman, "set-flag", "roman", "Romanizatsiya"))}
        ${row("Avtomatik audio", toggle(set.autoAudio, "set-flag", "autoAudio", "Avtomatik audio"))}
        ${row("Talaffuz tezligi", `<div class="seg" style="padding:3px">${[[0.82, "Sekin"], [0.92, "Tabiiy"], [1.02, "Tez"]].map(([v, t]) => `<button class="${Math.abs((set.speechRate || 0.92) - v) < 0.01 ? "on" : ""}" data-act="set-speech-rate" data-v="${v}">${t}</button>`).join("")}</div>`)}
        <div class="hide-sm">${row("Klaviatura yorliqlari", `<button class="link mono" data-act="shortcuts">ko'rish</button>`)}</div>`;
    } else if (profTab === "account") {
      section = `<h2 class="ps-h">Hisob va xavfsizlik</h2>
        <p class="ps-p">Natijalaringiz serverda saqlanadi va har bir qurilmada bir xil ko'rinadi.</p>
        ${S.user.demo ? "" : row("Parol", `<button class="link" data-act="change-pass">${S.user.hasPassword ? "o'zgartirish" : "o'rnatish"}</button>`)}
        ${row("Natijalarni yuklab olish", `<button class="link" data-act="export-json">JSON</button>`)}
        ${row(`Hisobdan chiqish${hint("natijalar saqlanib qoladi")}`, `<button class="link" data-act="logout">Chiqish</button>`)}
        ${S.user.demo ? "" : row("Hisobni o'chirish", `<button class="link" style="color:var(--bad)" data-act="delete-account">o'chirish</button>`)}`;
    } else {
      section = `<h2 class="ps-h">O'qish rejasi</h2>
        <p class="ps-p">Kunlik temp hali boshlanmagan kunlarga qo'llanadi.</p>
        <div class="paces">${[11, 17, 33].map((n) => { const x = S.PACES[n], on = p.pace === n; return `<button class="pace ${on ? "on" : ""}" data-act="set-pace" data-v="${n}" aria-pressed="${on}">
          <span class="pace-top"><b>${n}</b>${on ? `<span class="check">✓</span>` : ""}</span><span class="t">${x.name} · ${x.blocks} blok</span><span class="d">${x.desc}</span></button>`; }).join("")}</div>
        ${row("Kurs", `<span class="set-v">TOPIK II · ${S.TOTAL} so'z</span>`)}
        ${row(`Tugash sanasi${hint(`${p.pace} so'z tempida`)}`, `<span class="set-v">${U.fmtDayMonth(endKey)}</span>`)}`;
    }

    const body = `<div class="page">
      <section class="card prof-card">
        <div class="avatar prof-av">${initial()}</div>
        <div class="prof-id">
          <h2 class="page-h">${esc(p.name)}</h2>
          <p class="page-p">${esc(S.user.email)} · ${U.fmtDayMonth([S.user.createdAt, p.joined].filter(Boolean).sort()[0])}dan a'zo</p>
        </div>
        <div class="prof-stats">
          <div><b>${S.learnedIds().length}</b><span>so'z</span></div>
          <div><b>${S.streak()}</b><span>kun seriya</span></div>
          <div><b>${lv.level}</b><span>daraja</span></div>
        </div>
        ${S.user.demo ? `<span class="tag">demo hisob</span>` : `<button class="btn btn-sec btn-sm prof-edit" data-act="edit-name">Tahrirlash</button>`}
      </section>
      <div class="prof-grid">
        <nav class="prof-nav" aria-label="Sozlamalar">${PROF_TABS.map(([k, l]) => `<button class="${profTab === k ? "on" : ""}" data-act="prof-tab" data-k="${k}"${profTab === k ? ` aria-current="true"` : ""}>${l}</button>`).join("")}</nav>
        <section class="card prof-sec">${section}</section>
      </div>
    </div>`;
    return V.shell("profile", V.topbar("Profil", ""), body);
  };
  Actions["prof-tab"] = (el) => { profTab = el.dataset.k; App.render(); };
  Actions["set-pace"] = (el) => { S.state.profile.pace = Number(el.dataset.v); S.save(); App.render(); U.toast("Yangi temp hali boshlanmagan kunlarga qo'llanadi"); };

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
    ${[["Kartochka", "Space — ochish · 1–4 — baholash · → — keyingi · S — audio"], ["Test savollari", "1–4 — javob · ⏎ — keyingi"], ["Tinglash", "Space — qayta eshitish · 1–4 — javob"],
      ["Yozish", "⏎ — tekshirish"], ["Boshlang'ich sozlash", "1–3 — tanlash · ⏎ — davom"], ["AI ustoz", "⏎ — yuborish · Shift+⏎ — yangi qator"], ["Istalgan sessiya", "Esc — chiqish"]]
      .map(([a, b]) => `<div class="row" style="gap:16px;align-items:flex-start"><span style="font-weight:700;min-width:120px">${a}</span><span class="mono muted" style="font-size:12px;line-height:1.6">${b}</span></div>`).join("")}</div>`);

  V.notFound = () => V.shell("", V.topbar("Topilmadi", ""), `<div class="page"><div class="empty" style="padding:60px">Sahifa topilmadi. <a href="#/dashboard">Bosh sahifa</a></div></div>`);
})();
