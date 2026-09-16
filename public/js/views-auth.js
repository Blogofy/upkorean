// Auth (A1 Login, A2 Register, password reset) and onboarding (A3 level, A4 pace, A5 goal).
(function () {
  const U = window.U, S = window.S, esc = U.esc;
  const V = (window.V = window.V || {});
  const Actions = (window.Actions = window.Actions || {});
  const Forms = (window.Forms = window.Forms || {});
  const Inputs = (window.Inputs = window.Inputs || {});

  // ---------- Shared auth layout ----------
  function artLogin() {
    return `<div class="auth-art">
      <div class="brand"><div class="mark"></div><span class="name">UpKorean</span></div>
      <div>
        <div class="hangul" style="font-size:104px">한국어<br>단어</div>
        <div style="height:1px;background:rgba(124,63,11,.18);margin:36px 0 26px;max-width:420px"></div>
        <p>${S.DAYS} kunlik TOPIK II vocabulary kursi. Har kuni 33 so'z — o'rganish, active recall va spaced repetition bilan mustahkamlanadi.</p>
        <div class="auth-stats">
          <div><b>${S.TOTAL}</b><span>so'z</span></div>
          <div><b>${S.DAYS}</b><span>kun</span></div>
          <div><b>6</b><span>mashq turi</span></div>
        </div>
      </div>
      <div class="foot">TOPIK II · o'rta daraja</div>
    </div>`;
  }
  function artRegister() {
    return `<div class="auth-art">
      <div class="brand"><div class="mark"></div><span class="name">UpKorean</span></div>
      <div class="stack" style="gap:18px">
        <div class="hangul" style="font-size:80px">${S.DAYS}일</div>
        <p>Bir oyda ${S.TOTAL} so'z. Har kuni 20–35 daqiqa, kechqurun takrorlash bilan.</p>
        <div class="auth-steps">
          <div><i>1</i>Kunlik dars — 33 yangi so'z</div>
          <div><i>2</i>Active recall — 5 xil mashq</div>
          <div><i>3</i>Spaced repetition — avtomatik takrorlash</div>
        </div>
      </div>
      <div class="foot">TOPIK TEAM · online maktab</div>
    </div>`;
  }
  const tabs = (active) => `<div class="tabs" role="tablist">
      <a href="#/login" class="${active === "login" ? "on" : ""}" role="tab">Kirish</a>
      <a href="#/register" class="${active === "register" ? "on" : ""}" role="tab">Ro'yxatdan o'tish</a>
    </div>`;
  const googleBlock = () => `<div class="or">yoki</div>
      ${S.config.google ? `<div id="gsi-btn" style="display:flex;justify-content:center;min-height:44px"></div>`
        : `<button type="button" class="btn btn-sec btn-block" data-act="google-off">Google bilan davom etish</button>`}`;
  const errBox = (id) => `<div class="form-err" id="${id}" hidden></div>`;

  V.login = () => {
    const prev = S.lastUserPreview();
    const lead = prev && prev.name ? `Day ${prev.day} sizni kutib turibdi${prev.streak ? ` — streak ${prev.streak} kun` : ""}.` : "Kursni davom ettirish uchun hisobingizga kiring.";
    return `<div class="auth">${artLogin()}
      <div class="auth-form"><form data-form="login" novalidate>
        ${tabs("login")}
        <h2>${prev && prev.name ? "Qaytganingizdan xursandmiz" : "Xush kelibsiz"}</h2>
        <p class="lead">${esc(lead)}</p>
        <label class="field-label" for="l-email">Email</label>
        <input class="input" id="l-email" name="email" type="email" autocomplete="email" required style="margin-bottom:18px" autofocus>
        <div class="row between" style="align-items:baseline;margin-bottom:7px">
          <label class="field-label" for="l-pass" style="margin:0">Parol</label>
          <button type="button" class="link" data-act="forgot">Esdan chiqdimi?</button>
        </div>
        <input class="input" id="l-pass" name="password" type="password" autocomplete="current-password" required style="margin-bottom:26px">
        ${errBox("login-err")}
        <button class="btn btn-p btn-block" type="submit" style="padding:15px;font-size:16px">Kirish</button>
        ${googleBlock()}
        <p style="margin:26px 0 0;text-align:center;font-size:13px;color:var(--ink3)">Hisobingiz yo'qmi? <a href="#/register" style="font-weight:600">Ro'yxatdan o'ting</a></p>
        ${S.config.demo ? `<p style="margin:10px 0 0;text-align:center;font-size:13px;color:var(--ink3)">yoki <button type="button" class="link" data-act="demo">demo hisob bilan ko'ring</button></p>` : ""}
      </form></div></div>`;
  };

  V.register = () => `<div class="auth">${artRegister()}
      <div class="auth-form"><form data-form="register" novalidate>
        ${tabs("register")}
        <h2>Hisob yaratish</h2>
        <p class="lead">Keyingi qadamda darajangizni aniqlaymiz.</p>
        <label class="field-label" for="r-name">Ism</label>
        <input class="input" id="r-name" name="name" autocomplete="given-name" required maxlength="60" style="margin-bottom:18px" autofocus>
        <label class="field-label" for="r-email">Email</label>
        <input class="input" id="r-email" name="email" type="email" autocomplete="email" required style="margin-bottom:18px">
        <label class="field-label" for="r-pass">Parol</label>
        <input class="input" id="r-pass" name="password" type="password" autocomplete="new-password" required placeholder="Kamida 8 belgi" data-input="pw-strength">
        <div class="strength" id="pw-strength" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        ${errBox("reg-err")}
        <button class="btn btn-p btn-block" type="submit" style="padding:15px;font-size:16px">Davom etish</button>
        ${googleBlock()}
        <p style="margin:22px 0 0;font-size:12px;color:var(--ink3);line-height:1.55">Ro'yxatdan o'tish orqali foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.</p>
      </form></div></div>`;

  V.reset = (token) => `<div class="auth">${artLogin()}
      <div class="auth-form"><form data-form="reset" data-token="${esc(token)}" novalidate>
        <h2>Yangi parol</h2>
        <p class="lead">Hisobingiz uchun yangi parol o'rnating.</p>
        <label class="field-label" for="n-pass">Yangi parol</label>
        <input class="input" id="n-pass" name="password" type="password" autocomplete="new-password" placeholder="Kamida 8 belgi" data-input="pw-strength" autofocus>
        <div class="strength" id="pw-strength"><i></i><i></i><i></i><i></i></div>
        <label class="field-label" for="n-pass2">Parolni takrorlang</label>
        <input class="input" id="n-pass2" name="password2" type="password" autocomplete="new-password" style="margin-bottom:26px">
        ${errBox("reset-err")}
        <button class="btn btn-p btn-block" type="submit">Parolni saqlash</button>
        <p style="margin:22px 0 0;text-align:center;font-size:13px"><a href="#/login">Kirish sahifasiga qaytish</a></p>
      </form></div></div>`;

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
      form.innerHTML = `<p style="margin:0 0 16px;line-height:1.55">Agar <b>${esc(email)}</b> bilan hisob mavjud bo'lsa, parolni tiklash havolasi yuborildi. Havola 30 daqiqa amal qiladi.</p>
        ${r.devLink ? `<p class="muted" style="font-size:13px;line-height:1.5;margin:0 0 16px">Ishlab chiqish rejimi: email xizmati ulanmagan, havola server logida ham chiqadi.<br><a href="${esc(r.devLink)}" data-act="modal-close">Parolni tiklash sahifasini ochish →</a></p>` : ""}
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
    try { await S.demo(); App.go("#/dashboard"); U.toast("Demo hisob: Aziza — Day 5"); } catch (e) { U.toast(e.message); }
  };

  // Google Identity Services button (only when the server has GOOGLE_CLIENT_ID)
  let gsiLoading = null;
  V.mountGoogle = () => {
    const box = document.getElementById("gsi-btn");
    if (!box || !S.config.google) return;
    const render = () => {
      window.google.accounts.id.initialize({
        client_id: S.config.google,
        callback: async (resp) => {
          try { await S.googleLogin(resp.credential); afterSignIn(); } catch (e) { U.toast(e.message); }
        },
      });
      window.google.accounts.id.renderButton(box, { theme: "outline", size: "large", text: "continue_with", shape: "rectangular", width: Math.min(400, box.clientWidth || 400) });
    };
    if (window.google && window.google.accounts) return render();
    gsiLoading = gsiLoading || new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    gsiLoading.then(() => { if (document.body.contains(box)) render(); }).catch(() => { box.innerHTML = `<button type="button" class="btn btn-sec btn-block" data-act="google-off">Google bilan davom etish</button>`; });
  };

  // ---------- Onboarding ----------
  const obTop = (step) => `<div class="ob-top">
      <div class="brand"><div class="mark"></div><span class="name">UpKorean</span></div>
      <div class="ob-steps">${[1, 2, 3].map((i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}<span class="mono faint" style="font-size:11px;margin-left:8px">${step} / 3</span></div>
      <button class="link" style="color:var(--ink3)" data-act="ob-skip">Keyinroq</button>
    </div>`;

  V.onboarding = (step) => {
    const p = S.state.profile;
    let body;
    if (step === 1) {
      const opts = [["beg", "가나", "Boshlovchi", "Hangul o'qiyman, so'z boyligim kam", "TOPIK I"], ["mid", "중급", "O'rta daraja", "Kundalik suhbat tushunarli, TOPIK II ga tayyorlanaman", "TOPIK II"], ["adv", "고급", "Yuqori daraja", "Gazeta va akademik matnlarni o'qiyman", "TOPIK 5–6"]];
      body = `<div style="width:100%;max-width:760px">
        <div class="eyebrow">QADAM 1 · DARAJA</div>
        <h2>Koreys tilini qanchalik bilasiz?</h2>
        <p class="lead">Bu birinchi kun qaysi so'zlardan boshlanishini va mashqlar qiyinligini belgilaydi.</p>
        <div class="stack" style="gap:10px;margin-bottom:38px" role="radiogroup">
          ${opts.map(([v, g, t, d, tag]) => `<button class="opt ${p.level === v ? "on" : ""}" role="radio" aria-checked="${p.level === v}" data-act="ob-set" data-k="level" data-v="${v}">
            <span class="glyph">${g}</span><span class="grow"><span class="t">${t}</span><span class="d">${d}</span></span>
            <span class="end">${tag}${p.level === v ? `<span class="check">✓</span>` : ""}</span></button>`).join("")}
        </div>
        <div class="row wrap" style="gap:16px">
          <button class="btn btn-p" style="padding:15px 30px" data-act="ob-go" data-step="2">Davom etish</button>
          <button class="link" style="font-size:14px;color:var(--ink2)" data-act="placement">2 daqiqalik test topshiraman</button>
          <span class="kbd-hint hide-sm" style="margin-left:auto;font-size:11px">1 2 3 · tanlash &nbsp; ⏎ · davom</span>
        </div></div>`;
    } else if (step === 2) {
      const pace = S.PACES[p.pace] || S.PACES[17];
      const end = U.addDays(U.today(), S.DAYS);
      body = `<div class="collapse-md" style="width:100%;max-width:880px;display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:56px;align-items:center">
        <div>
          <div class="eyebrow">QADAM 2 · KUNLIK TEMP</div>
          <h2>Kuniga qancha so'z?</h2>
          <p class="lead" style="max-width:520px">Bir kunning 33 so'zini bo'lib o'rganish mumkin. Keyin istalgan vaqtda o'zgartirasiz.</p>
          <div class="stack" style="gap:10px" role="radiogroup">
            ${[11, 17, 33].map((n) => { const x = S.PACES[n]; const on = p.pace === n; return `<button class="opt ${on ? "on" : ""}" style="padding:18px 22px;gap:18px" role="radio" aria-checked="${on}" data-act="ob-set" data-k="pace" data-v="${n}">
              <span style="font-size:26px;font-weight:800;letter-spacing:-.03em;min-width:44px;color:${on ? "var(--pd)" : "var(--ink3)"}">${n}</span>
              <span class="grow"><span class="t" style="font-size:15px">${x.name} · ${x.blocks} blok</span><span class="d" style="font-size:13px">${x.desc}</span></span>
              ${on ? `<span class="check">✓</span>` : ""}</button>`; }).join("")}
          </div>
          <div class="row" style="gap:16px;margin-top:30px">
            <button class="btn btn-p" style="padding:15px 30px" data-act="ob-go" data-step="3">Davom etish</button>
            <button class="btn btn-ghost" data-act="ob-go" data-step="1">Orqaga</button>
          </div>
        </div>
        <div class="plan">
          <div class="upl" style="font-size:12px;color:var(--on-pl3)">Reja</div>
          <div><div class="n xl">${S.DAYS}</div><div class="l">kunda tugatasiz</div></div>
          <div class="sep"></div>
          <div><div class="n">${pace.min} daq</div><div class="l">kunlik o'rtacha vaqt</div></div>
          <div class="sep"></div>
          <div><div class="n">${U.fmtShort(end)}</div><div class="l">tugash sanasi</div></div>
          <div class="mono" style="font-size:11px;color:var(--on-pl3);line-height:1.5">Kechqurun takrorlash sessiyasi bu vaqtga kirmagan</div>
        </div></div>`;
    } else {
      const r = p.reminders;
      body = `<div style="width:100%;max-width:820px">
        <div class="eyebrow">QADAM 3 · MAQSAD</div>
        <h2>Nima uchun o'rganasiz?</h2>
        <p class="lead">Maqsad mashqlar tanloviga ta'sir qiladi — imtihon uchun yozma recall, suhbat uchun listening ko'proq bo'ladi.</p>
        <div class="two-sm" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:32px" role="radiogroup">
          ${Object.entries(S.GOALS).map(([k, g]) => { const on = p.goal === k; return `<button class="ocard ${on ? "on" : ""}" role="radio" aria-checked="${on}" data-act="ob-set" data-k="goal" data-v="${k}">
            <div class="row between"><span class="glyph">${g.ko}</span>${on ? `<span class="check">✓</span>` : ""}</div>
            <div class="t">${g.name}</div><div class="d">${g.desc}</div></button>`; }).join("")}
        </div>
        <div class="card row wrap" style="gap:20px;padding:18px 22px;margin-bottom:30px">
          <div class="grow"><div style="font-size:15px;font-weight:700;margin-bottom:2px">Kunlik eslatma</div>
            <div class="muted" style="font-size:13px">Dars va takrorlash vaqtida bildirishnoma yuboramiz (sahifa ochiq bo'lganda)</div></div>
          <input type="time" class="time-input" value="${esc(r.learn)}" data-change="rem-time" data-k="learn" aria-label="Dars vaqti">
          <input type="time" class="time-input" value="${esc(r.review)}" data-change="rem-time" data-k="review" aria-label="Takrorlash vaqti">
          <button class="toggle lg ${r.on ? "on" : ""}" data-act="rem-toggle" data-k="on" role="switch" aria-checked="${r.on}" aria-label="Eslatmalar"></button>
        </div>
        <div class="row" style="gap:16px">
          <button class="btn btn-p" style="padding:15px 30px" data-act="ob-finish">Day 1 ni boshlash</button>
          <button class="btn btn-ghost" data-act="ob-go" data-step="2">Orqaga</button>
        </div></div>`;
    }
    return `<div class="ob">${obTop(step)}<div class="ob-body">${body}</div></div>`;
  };

  Actions["ob-set"] = (el) => {
    const p = S.state.profile;
    p[el.dataset.k] = el.dataset.k === "pace" ? Number(el.dataset.v) : el.dataset.v;
    S.save(); App.render();
  };
  Actions["ob-go"] = (el) => App.go(`#/onboarding/${el.dataset.step}`);
  Actions["ob-skip"] = () => { S.state.profile.onboarded = true; S.save(); App.go("#/dashboard"); };
  Actions["ob-finish"] = async () => {
    S.state.profile.onboarded = true; S.save();
    if (S.state.profile.reminders.on) await App.askNotify();
    X.startLearn(1);
  };
  Actions.placement = () => X.startPlacement();
  Actions["placement-apply"] = (el) => { S.state.profile.level = el.dataset.level; S.save(); X.session = null; App.go("#/onboarding/1"); };

  V.onboardingKey = (e, step) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const n = parseInt(e.key, 10);
    const p = S.state.profile;
    if (step === 1 && n >= 1 && n <= 3) { p.level = ["beg", "mid", "adv"][n - 1]; S.save(); App.render(); }
    if (step === 2 && n >= 1 && n <= 3) { p.pace = [11, 17, 33][n - 1]; S.save(); App.render(); }
    if (step === 3 && n >= 1 && n <= 4) { p.goal = Object.keys(S.GOALS)[n - 1]; S.save(); App.render(); }
    if (e.key === "Enter") { if (step < 3) App.go(`#/onboarding/${step + 1}`); else Actions["ob-finish"](); }
  };
})();
