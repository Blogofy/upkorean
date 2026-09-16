// Application bootstrap, hash router and delegated UI events.
(function () {
  "use strict";

  const U = window.U;
  const S = window.S;
  const V = window.V;
  const X = window.X;
  const T = window.T;
  const Actions = (window.Actions = window.Actions || {});
  const Forms = (window.Forms = window.Forms || {});
  const Changes = (window.Changes = window.Changes || {});
  const Inputs = (window.Inputs = window.Inputs || {});
  const root = document.getElementById("app");

  const TITLES = {
    dashboard: "Dashboard", course: "Kurs", review: "Takrorlash",
    quiz: "Mashqlar", progress: "Progress", library: "Lug‘at",
    achievements: "Yutuqlar", profile: "Profil", tutor: "AI Tutor",
    login: "Kirish", register: "Ro‘yxatdan o‘tish",
  };

  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || "", args: parts.slice(1) };
  }

  function home() {
    if (!S.user) return "#/login";
    return S.state.profile.onboarded ? "#/dashboard" : "#/onboarding/1";
  }

  const App = (window.App = {
    go(hash) {
      if (location.hash === hash) App.render();
      else location.hash = hash;
    },

    // Turns on push reminders for this browser and tells the learner if that is not possible here.
    async enableReminders() {
      if (S.user && S.user.demo) { U.toast("Demo hisobda eslatmalar yuborilmaydi"); return; }
      try {
        const result = await window.Push.enable();
        if (result === "on") U.toast("Eslatmalar yoqildi");
        else U.toast(window.Push.explain(result), 7000);
      } catch (error) {
        U.toast(`Eslatmalarni yoqib bo'lmadi: ${error.message}`, 6000);
      }
    },

    render() {
      if (!root) return;
      let r = route();
      const isPublic = r.name === "login" || r.name === "register" || r.name === "reset";

      if (!S.user && !isPublic) {
        App.go("#/login");
        return;
      }
      if (S.user && isPublic) {
        App.go(home());
        return;
      }
      if (S.user && !S.state.profile.onboarded && r.name !== "onboarding" && r.name !== "session") {
        App.go("#/onboarding/1");
        return;
      }

      let html = null;
      if (r.name === "login") html = V.login();
      else if (r.name === "register") html = V.register();
      else if (r.name === "reset" && r.args[0]) html = V.reset(r.args[0]);
      else if (r.name === "onboarding") {
        const step = Math.max(1, Math.min(V.OB_STEPS, Number(r.args[0]) || 1));
        html = V.onboarding(step);
      } else if (r.name === "dashboard") html = V.dashboard();
      else if (r.name === "course") html = V.course();
      else if (r.name === "day") {
        const day = Number(r.args[0]);
        html = Number.isInteger(day) && day >= 1 && day <= S.DAYS ? V.day(day) : V.notFound();
      } else if (r.name === "complete") {
        const day = Number(r.args[0]);
        html = Number.isInteger(day) && day >= 1 && day <= S.DAYS ? V.complete(day) : V.notFound();
      } else if (r.name === "review") html = V.review();
      else if (r.name === "quiz") html = V.quiz();
      else if (r.name === "progress") html = V.progress();
      else if (r.name === "library") html = V.library();
      else if (r.name === "achievements") html = V.achievements();
      else if (r.name === "profile") html = V.profile();
      else if (r.name === "tutor") html = V.tutorStart();
      else if (r.name === "session") {
        if (!X.session) {
          App.go(S.state.profile.onboarded ? "#/dashboard" : "#/onboarding/1");
          return;
        }
        html = X.render();
      } else html = V.notFound();

      root.innerHTML = html;
      document.title = `${TITLES[r.name] || "UpKorean"} · UpKorean`;
      document.documentElement.lang = "uz";
      window.scrollTo({ top: 0, behavior: "instant" });

      if (r.name === "login" || r.name === "register") V.mountGoogle();
      if (r.name === "session") X.afterRender();
    },
  });

  // Actions shared by several screens or owned by the exercise engine.
  Actions.go = (el) => App.go(el.dataset.href);
  Actions["modal-close"] = () => U.closeModal();
  Actions.reload = () => location.reload();
  Actions["ex-exit"] = () => X.exit();
  Actions["ex-exit-force"] = () => { U.closeModal(); X.exit(true); };
  Actions["ex-reveal"] = () => X.reveal();
  Actions["ex-play"] = () => X.play(1);
  Actions["ex-play-slow"] = () => X.play(0.7);
  Actions["ex-play-sent"] = () => X.playSentence();
  Actions["ex-grade"] = (el) => X.gradeCard(Number(el.dataset.g));
  Actions["ex-choose"] = (el) => X.choose(Number(el.dataset.i));
  Actions["ex-check"] = () => X.checkSentence();
  Actions["ex-skip"] = () => X.skip();
  Actions["ex-next"] = () => X.next();
  Actions["ex-hint"] = () => { if (X.session) { X.session.hint = true; App.render(); } };
  Actions["ex-flag"] = () => {
    const s = X.session;
    const item = s && s.items[s.idx];
    if (item) { S.flag(item.id); App.render(); }
  };
  Forms["ex-type"] = (form) => X.submitTyping(form.elements.v.value);

  // Dropdowns (U.dropdown)
  Actions["dd-toggle"] = (el) => {
    const dd = el.closest(".dd");
    const open = !dd.classList.contains("open");
    U.closeDropdowns(dd);
    dd.classList.toggle("open", open);
    dd.querySelector(".dd-menu").hidden = !open;
    el.setAttribute("aria-expanded", String(open));
    if (open) (dd.querySelector(".dd-opt.on") || dd.querySelector(".dd-opt")).focus();
  };
  Actions["dd-pick"] = (el) => {
    const dd = el.closest(".dd");
    U.closeDropdowns();
    // Some handlers redraw only part of the page, so the dropdown shows the new choice itself.
    dd.querySelector(".dd-val").textContent = el.firstElementChild.textContent;
    dd.querySelectorAll(".dd-opt").forEach((o) => {
      const on = o === el;
      o.classList.toggle("on", on);
      o.setAttribute("aria-selected", String(on));
      const check = o.querySelector(".dd-check");
      if (on && !check) o.insertAdjacentHTML("beforeend", `<span class="dd-check" aria-hidden="true">✓</span>`);
      if (!on && check) check.remove();
    });
    dd.querySelector(".dd-btn").focus();
    const fn = Changes[dd.dataset.dd];
    if (fn) fn({ value: el.dataset.v, dataset: {} });
  };
  function dropdownKey(event, dd) {
    const opts = [...dd.querySelectorAll(".dd-opt")];
    const i = opts.indexOf(document.activeElement);
    if (event.key === "Escape") { U.closeDropdowns(); dd.querySelector(".dd-btn").focus(); }
    else if (event.key === "ArrowDown") opts[Math.min(opts.length - 1, i + 1)].focus();
    else if (event.key === "ArrowUp") opts[Math.max(0, i - 1)].focus();
    else if (event.key === "Home") opts[0].focus();
    else if (event.key === "End") opts[opts.length - 1].focus();
    else if (event.key === "Tab") { U.closeDropdowns(); return; }
    else return;
    event.preventDefault();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".dd")) U.closeDropdowns();
    const el = event.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = Actions[el.dataset.act];
    if (!fn) return;
    event.preventDefault();
    Promise.resolve(fn(el, event)).catch((error) => U.toast(error.message || "Xatolik yuz berdi"));
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const fn = Forms[form.dataset.form];
    if (!fn) return;
    Promise.resolve(fn(form, event)).catch((error) => U.toast(error.message || "Xatolik yuz berdi"));
  });

  document.addEventListener("change", (event) => {
    const el = event.target.closest("[data-change]");
    if (el && Changes[el.dataset.change]) Changes[el.dataset.change](el, event);
  });

  document.addEventListener("input", (event) => {
    const el = event.target.closest("[data-input]");
    if (el && Inputs[el.dataset.input]) Inputs[el.dataset.input](el, event);
    const input = event.target;
    if (input.id === "chat-input") {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    }
  });

  document.addEventListener("keydown", (event) => {
    const dd = event.target.closest && event.target.closest(".dd.open");
    if (dd) { dropdownKey(event, dd); return; }
    if (event.key === "Escape" && U.modalOpen()) { U.closeModal(); return; }
    const r = route();
    if (r.name === "session") X.onKey(event);
    else if (r.name === "tutor" && r.args[0] === "chat") T.onKey(event);
    else if (r.name === "onboarding") V.onboardingKey(event, Math.max(1, Math.min(V.OB_STEPS, Number(r.args[0]) || 1)));
  });

  // A new deploy activates its service worker while this page still runs the old scripts. Switch to the new
  // version on the next navigation — never in the middle of an exercise, onboarding or tutor chat.
  let updateReady = false;
  const MID_TASK = ["session", "complete", "onboarding", "tutor"];
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener("controllerchange", () => { updateReady = true; });
  }
  // A reminder was clicked while the app is open: go to its page unless the learner is mid-task.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (!event.data || event.data.type !== "open") return;
      const hash = new URL(event.data.url, location.origin).hash;
      if (hash && S.user && !MID_TASK.includes(route().name)) App.go(hash);
    });
  }

  window.addEventListener("hashchange", () => {
    if (updateReady && !MID_TASK.includes(route().name)) {
      updateReady = false;
      const reload = () => location.reload();
      if (S.user) S.flush().then(reload, reload); else reload();
      return;
    }
    U.closeModal(); App.render();
  });
  document.addEventListener("ukvoiceschanged", () => {
    if (route().name === "profile" && S.state) App.render();
  });
  window.addEventListener("online", () => {
    S.offline = false;
    S.flush().then(() => { if (S.user) U.toast("Internet qaytdi — progress sinxronlandi"); App.render(); });
  });
  window.addEventListener("offline", () => { S.offline = true; if (S.user) { U.toast("Offline rejim"); App.render(); } });

  S.applyTheme(localStorage.getItem("uk:theme") || "light");
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  S.boot()
    .then(() => {
      if (!location.hash || location.hash === "#/") App.go(home());
      else App.render();
      window.Push.refresh();
    })
    .catch((error) => {
      root.innerHTML = `<div class="boot boot-error"><div class="brand"><span class="mark"></span><span class="name">UpKorean</span></div><p>${U.esc(error.message || "Ilovani yuklab bo‘lmadi")}</p><button class="btn btn-p" data-act="reload">Qayta urinish</button></div>`;
    });
})();
