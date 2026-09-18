// Auth (A1 Login, A2 Register, password reset) and onboarding (A3 level, A4 pace, A5 goal).
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const V = (window.V = window.V || {});
  const Actions = (window.Actions = window.Actions || {});
  const Forms = (window.Forms = window.Forms || {});
  const Inputs = (window.Inputs = window.Inputs || {});

  // ---------- Shared auth layout ----------
  // One quiet column on the page background: the brand, the form, and a faint 한 behind them. Fields carry
  // placeholders; their labels stay for screen readers only.
  const authPage = (title, form) => `<div class="auth">
      <div class="auth-wm" aria-hidden="true">한</div>
      <a class="brand" href="#/login"><span class="mark" aria-hidden="true"></span><span class="name">UpKorean</span></a>
      <h1 class="sr-only">${title}</h1>
      ${form}
      <p class="auth-legal"><a href="/privacy" target="_blank" rel="noopener">Maxfiylik siyosati</a></p>
    </div>`;
  const field = (id, label, attrs) => `<label class="sr-only" for="${id}">${label}</label><input class="input" id="${id}" placeholder="${label}" ${attrs}>`;
  const gLogo = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
  const googleBlock = () => `<button type="button" class="btn-google" data-act="${S.config.google ? "google" : "google-off"}">${gLogo}Google bilan kirish</button>
      <div class="or">yoki</div>`;
  const errBox = (id) => `<div class="form-err" id="${id}" hidden></div>`;

  V.login = () => authPage("Kirish", `<form class="auth-box" data-form="login" novalidate>
        ${googleBlock()}
        ${field("l-email", "Email", `name="email" type="email" autocomplete="email" required autofocus`)}
        ${field("l-pass", "Parol", `name="password" type="password" autocomplete="current-password" required`)}
        ${errBox("login-err")}
        <button class="btn btn-p btn-block auth-submit" type="submit">Kirish</button>
        <div class="auth-links">
          <button type="button" class="link auth-quiet" data-act="forgot">Parolni unutdingizmi?</button>
          <a href="#/register">Ro'yxatdan o'tish</a>
        </div>
        ${S.config.demo ? `<p class="auth-switch"><button type="button" class="link" data-act="demo">Demo hisob bilan ko'rish</button></p>` : ""}
      </form>`);

  V.register = () => authPage("Ro'yxatdan o'tish", `<form class="auth-box" data-form="register" novalidate>
        ${googleBlock()}
        ${field("r-name", "Ism", `name="name" autocomplete="given-name" required maxlength="60" autofocus`)}
        ${field("r-email", "Email", `name="email" type="email" autocomplete="email" required`)}
        <div>
          ${field("r-pass", "Parol (kamida 8 belgi)", `name="password" type="password" autocomplete="new-password" required data-input="pw-strength"`)}
          <div class="strength" id="pw-strength" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        ${errBox("reg-err")}
        <button class="btn btn-p btn-block auth-submit" type="submit">Hisob yaratish</button>
        <p class="auth-switch">Hisobingiz bormi? <a href="#/login">Kirish</a></p>
        <p class="auth-note">Ro'yxatdan o'tish orqali <a href="/privacy" target="_blank" rel="noopener">maxfiylik siyosatiga</a> rozilik bildirasiz.</p>
      </form>`);

  V.reset = (token) => authPage("Yangi parol", `<form class="auth-box" data-form="reset" data-token="${esc(token)}" novalidate>
        <h2>Yangi parol</h2>
        <div>
          ${field("n-pass", "Yangi parol (kamida 8 belgi)", `name="password" type="password" autocomplete="new-password" data-input="pw-strength" autofocus`)}
          <div class="strength" id="pw-strength" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        </div>
        ${field("n-pass2", "Parolni takrorlang", `name="password2" type="password" autocomplete="new-password"`)}
        ${errBox("reset-err")}
        <button class="btn btn-p btn-block auth-submit" type="submit">Parolni saqlash</button>
        <p class="auth-switch"><a href="#/login">Kirish sahifasiga qaytish</a></p>
      </form>`);

  const strength = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
    return pw.length < 8 ? Math.min(s, 1) : s;
  };
  Inputs["pw-strength"] = (el) => {
    const n = strength(el.value);
    document.querySelectorAll("#pw-strength i").forEach((i, k) => i.classList.toggle("on", k < n));
  };

  function showErr(form, id, e) {
    const box = document.getElementById(id);
    if (box) { box.textContent = e.message; box.hidden = false; }
    form.querySelectorAll(".input").forEach((i) => i.classList.remove("err"));
    if (e.field && form.elements[e.field]) { form.elements[e.field].classList.add("err"); form.elements[e.field].focus(); }
  }
  async function busy(form, fn) {
    const btn = form.querySelector("[type=submit]");
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Kuting…"; }
    try { await fn(); } finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.textContent = btn.dataset.label; } }
  }
  const afterSignIn = () => App.go(S.state.profile.onboarded ? "#/dashboard" : "#/onboarding/1");

  Forms.login = (form) => busy(form, async () => {
    const email = form.elements.email.value, password = form.elements.password.value;
    if (!email || !password) return showErr(form, "login-err", { message: "Email va parolni kiriting", field: !email ? "email" : "password" });
    try { await S.login(email, password); afterSignIn(); } catch (e) { showErr(form, "login-err", e); }
  });
  Forms.register = (form) => busy(form, async () => {
    const { name, email, password } = form.elements;
    if (!name.value.trim()) return showErr(form, "reg-err", { message: "Ismingizni kiriting", field: "name" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) return showErr(form, "reg-err", { message: "Email manzil noto'g'ri", field: "email" });
    if (password.value.length < 8) return showErr(form, "reg-err", { message: "Parol kamida 8 belgidan iborat bo'lsin", field: "password" });
    try { await S.register(name.value, email.value, password.value); App.go("#/onboarding/1"); } catch (e) { showErr(form, "reg-err", e); }
  });
  Forms.reset = (form) => busy(form, async () => {
    const p1 = form.elements.password.value, p2 = form.elements.password2.value;
    if (p1.length < 8) return showErr(form, "reset-err", { message: "Parol kamida 8 belgidan iborat bo'lsin", field: "password" });
    if (p1 !== p2) return showErr(form, "reset-err", { message: "Parollar mos kelmadi", field: "password2" });
    try { await S.resetPassword(form.dataset.token, p1); U.toast("Parol yangilandi"); afterSignIn(); } catch (e) { showErr(form, "reset-err", e); }
  });
  Forms.forgot = (form) => busy(form, async () => {
    const email = form.elements.email.value;
    try {
      const r = await S.forgot(email);
      form.innerHTML = `${S.config.mail
        ? `<p style="margin:0 0 16px;line-height:1.55">Agar <b>${esc(email)}</b> bilan hisob mavjud bo'lsa, parolni tiklash havolasi emailingizga yuborildi. Havola 30 daqiqa amal qiladi. Xat kelmasa, "Spam" papkasini tekshiring.</p>`
        : `<p style="margin:0 0 16px;line-height:1.55">Email xizmati hali ulanmagan, shuning uchun parolni tiklash havolasi yuborilmaydi. Hisobingizga kira olmayotgan bo'lsangiz, administratorga murojaat qiling — parolni u yangilab beradi.</p>`}
        ${r.devLink ? `<p class="muted" style="font-size:13px;line-height:1.5;margin:0 0 16px">Ishlab chiqish rejimi (faqat shu kompyuterda ko'rinadi):<br><a href="${esc(r.devLink)}" data-act="modal-close">Parolni tiklash sahifasini ochish →</a></p>` : ""}
        <button type="button" class="btn btn-p" data-act="modal-close">Yopish</button>`;
    } catch (e) { showErr(form, "forgot-err", e); }
  });

  Actions.forgot = () => {
    const email = (document.getElementById("l-email") || {}).value || "";
    U.modal("Parolni tiklash", `<form data-form="forgot" novalidate>
      <p class="muted" style="margin:0 0 16px;line-height:1.55">Hisobingiz emailini kiriting — parolni tiklash havolasini yuboramiz.</p>
      <label class="field-label" for="f-email">Email</label>
      <input class="input" id="f-email" name="email" type="email" value="${esc(email)}" style="margin-bottom:18px" autofocus>
      <div class="form-err" id="forgot-err" hidden></div>
      <button class="btn btn-p" type="submit">Havola yuborish</button></form>`);
  };
  Actions["google-off"] = () => U.toast("Google orqali kirish serverda sozlanmagan (GOOGLE_CLIENT_ID)");
  Actions.demo = async () => {
    try { await S.demo(); App.go("#/dashboard"); U.toast("Demo hisob: Aziza — 5-kun"); } catch (e) { U.toast(e.message); }
  };

  // Sign in with Google (only when the server has GOOGLE_CLIENT_ID). Our own button opens Google's account
  // picker in a popup; the script loads with the page because a popup must open inside the click itself.
  let gsiLoading = null, tokenClient = null;
  V.mountGoogle = () => {
    if (!S.config.google || tokenClient) return;
    gsiLoading = gsiLoading || new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    gsiLoading.then(() => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: S.config.google,
        scope: "openid email profile",
        callback: async (resp) => {
          if (resp.error || !resp.access_token) return;
          try {
            const r = await S.googleLogin(resp.access_token);
            afterSignIn();
            if (r.passwordCleared) U.toast("Xavfsizlik uchun eski parol o'chirildi — profilda yangisini o'rnating", 7000);
          } catch (e) { U.toast(e.message); }
        },
      });
    }).catch(() => { gsiLoading = null; });
  };
  Actions.google = () => {
    if (!tokenClient) { V.mountGoogle(); U.toast("Google yuklanmoqda — bir soniyadan keyin qayta bosing"); return; }
    tokenClient.requestAccessToken();
  };

  // ---------- Onboarding ----------
  const OB_STEPS = 2;
  const obTop = (step) => `<div class="ob-top">
      <div class="brand"><div class="mark"></div><span class="name">UpKorean</span></div>
      <div class="ob-steps">${Array.from({ length: OB_STEPS }, (_, i) => `<i class="${i < step ? "on" : ""}"></i>`).join("")}<span class="mono faint" style="font-size:12px;margin-left:8px">${step} / ${OB_STEPS}</span></div>
      <button class="link" style="color:var(--ink3)" data-act="ob-skip">Keyinroq</button>
    </div>`;

  V.onboarding = (step) => {
    const p = S.state.profile;
    let body;
    if (step === 1) {
      const pace = S.PACES[p.pace] || S.PACES[17];
      const end = U.addDays(U.today(), S.DAYS);
      body = `<div class="collapse-md" style="width:100%;max-width:880px;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;align-items:center">
        <div>
          <div class="eyebrow">QADAM 1 · KUNLIK TEMP</div>
          <h2>Kuniga qancha so'z?</h2>
          <p class="lead" style="max-width:520px">${S.DAYS} kunda ${S.TOTAL} ta TOPIK II so'zi. Bir kunning so'zlarini bo'lib o'rganish mumkin — keyin profilda istalgan vaqtda o'zgartirasiz.</p>
          <div class="stack" style="gap:10px" role="radiogroup">
            ${[11, 17, 33].map((n) => { const x = S.PACES[n]; const on = p.pace === n; return `<button class="opt ${on ? "on" : ""}" style="padding:18px 22px;gap:18px" role="radio" aria-checked="${on}" data-act="ob-set" data-k="pace" data-v="${n}">
              <span style="font-size:26px;font-weight:800;letter-spacing:-.03em;min-width:44px;color:${on ? "var(--pd)" : "var(--ink3)"}">${n}</span>
              <span class="grow"><span class="t" style="font-size:15px">${x.name} · ${x.blocks} blok</span><span class="d" style="font-size:13px">${x.desc}</span></span>
              ${on ? `<span class="check">✓</span>` : ""}</button>`; }).join("")}
          </div>
          <div class="row wrap" style="gap:16px;margin-top:30px">
            <button class="btn btn-p" style="padding:15px 30px" data-act="ob-go" data-step="2">Davom etish</button>
            <span class="kbd-hint hide-sm" style="margin-left:auto;font-size:12px">1 2 3 · tanlash &nbsp; ⏎ · davom</span>
          </div>
        </div>
        <div class="plan">
          <div class="upl" style="font-size:12px;color:var(--on-pl3)">Reja</div>
          <div><div class="n xl">${S.DAYS}</div><div class="l">kunda tugatasiz</div></div>
          <div class="sep"></div>
          <div><div class="n">${pace.min} daq</div><div class="l">kunlik o'rtacha vaqt</div></div>
          <div class="sep"></div>
          <div><div class="n">${U.fmtShort(end)}</div><div class="l">tugash sanasi</div></div>
          <div class="mono" style="font-size:12px;color:var(--on-pl3);line-height:1.5">Kechqurun takrorlash sessiyasi bu vaqtga kirmagan</div>
        </div></div>`;
    } else {
      const r = p.reminders;
      const timeRow = (k, title, desc) => `<div class="ob-rem-row ${r.on ? "" : "off"}">
          <div class="grow"><div class="t">${title}</div><div class="d">${desc}</div></div>
          <input type="time" class="time-input" value="${esc(r[k])}" data-change="rem-time" data-k="${k}" aria-label="${title} vaqti" ${r.on ? "" : "disabled"}>
        </div>`;
      body = `<div style="width:100%;max-width:640px">
        <div class="eyebrow">QADAM 2 · ESLATMA</div>
        <h2>Qachon eslatib turaylik?</h2>
        <p class="lead">Har kuni shu vaqtda telefon yoki kompyuteringizga bildirishnoma keladi — sayt yopiq bo'lsa ham. Profilda istalgan vaqtda o'zgartirasiz.</p>
        <div class="card ob-rem">
          <div class="ob-rem-row">
            <div class="grow"><div class="t">Kunlik eslatmalar</div><div class="d">Dars, takrorlash va seriya haqida</div></div>
            <button class="toggle lg ${r.on ? "on" : ""}" data-act="rem-toggle" data-k="on" role="switch" aria-checked="${r.on}" aria-label="Eslatmalar"></button>
          </div>
          ${timeRow("learn", "Bugungi dars", "Yangi so'zlarni o'rganish vaqti")}
          ${timeRow("review", "Takrorlash", "Kechki takrorlash vaqti")}
        </div>
        <div class="row wrap" style="gap:16px;margin-top:30px">
          <button class="btn btn-p" style="padding:15px 30px" data-act="ob-finish">1-kunni boshlash</button>
          <button class="btn btn-ghost" data-act="ob-go" data-step="1">Orqaga</button>
        </div></div>`;
    }
    return `<div class="ob">${obTop(step)}<div class="ob-body">${body}</div></div>`;
  };

  Actions["ob-set"] = (el) => {
    S.state.profile[el.dataset.k] = el.dataset.k === "pace" ? Number(el.dataset.v) : el.dataset.v;
    S.save(); App.render();
  };
  Actions["ob-go"] = (el) => App.go(`#/onboarding/${el.dataset.step}`);
  Actions["ob-skip"] = () => { S.state.profile.onboarded = true; S.save(); App.go("#/dashboard"); };
  Actions["ob-finish"] = async () => {
    S.state.profile.onboarded = true; S.save();
    if (S.state.profile.reminders.on) await App.enableReminders();
    X.startLearn(1);
  };

  V.OB_STEPS = OB_STEPS;
  V.onboardingKey = (e, step) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const n = parseInt(e.key, 10);
    if (step === 1 && n >= 1 && n <= 3) { S.state.profile.pace = [11, 17, 33][n - 1]; S.save(); App.render(); }
    if (e.key === "Enter") { if (step < OB_STEPS) App.go(`#/onboarding/${step + 1}`); else Actions["ob-finish"](); }
  };
})();
