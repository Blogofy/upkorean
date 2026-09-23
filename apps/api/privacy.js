// The privacy policy — the one document the stores require a URL for. It is not a website: one page,
// no script, no links out but the contact address, served at /privacy and opened from the app.
export const privacyPage = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maxfiylik siyosati — UpKorean</title>
<style>
:root{--bg:#E8E9E6;--card:#FFF;--ink:#102221;--ink2:#48605C;--ink3:#7A8078;--green:#1B6F65}
@media (prefers-color-scheme:dark){:root{--bg:#101613;--card:#19211D;--ink:#E7EDEA;--ink2:#9FADA8;--ink3:#8A9993;--green:#7FD9C2;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 16px 56px}
main{max-width:680px;margin:0 auto;background:var(--card);border-radius:24px;padding:30px 24px}
h1{font-size:30px;line-height:1.15;margin:0 0 6px;letter-spacing:-.02em}
h2{font-size:19px;margin:28px 0 8px}
p,ul{margin:0 0 12px;color:var(--ink2)}
ul{padding-left:20px}
li{margin-bottom:6px}
b{color:var(--ink)}
.date{color:var(--ink3);font-size:13px;margin-bottom:22px}
</style></head><body><main>
<h1>Maxfiylik siyosati</h1>
<p class="date">Oxirgi yangilanish: 2026-yil 23-sentabr</p>
<p>UpKorean — koreys tili lug'atini o'rgatadigan mobil ilova. Bu sahifada hisobingiz uchun qanday ma'lumot saqlanishi, nima uchun kerakligi va uni qanday o'chirishingiz mumkinligi yozilgan.</p>

<h2>Qanday ma'lumot saqlanadi</h2>
<ul>
<li><b>Hisob:</b> ismingiz va email manzilingiz. Parolning o'zi emas, faqat uning shifrlangan izi (scrypt) saqlanadi.</li>
<li><b>Google orqali kirish:</b> Google'dan faqat ismingiz, email manzilingiz va hisob identifikatori olinadi. Kontaktlar, fayllar yoki boshqa Google ma'lumotlariga kirilmaydi.</li>
<li><b>O'qish jarayoni:</b> o'rgangan so'zlaringiz, mashqlar natijasi, XP, sozlamalar va vaqt mintaqangiz — boshqa qurilmada ham davom ettirishingiz uchun.</li>
<li><b>Kirish sessiyasi:</b> tizimda qolishingiz uchun telefonning himoyalangan xotirasida (Keychain / Keystore) bitta kirish kaliti saqlanadi.</li>
</ul>
<p>Kunlik eslatma telefonning o'zida rejalashtiriladi va serverga hech narsa yubormaydi. Ilovada reklama, kuzatuv yoki analitika xizmatlari yo'q.</p>

<h2>Ma'lumot nima uchun ishlatiladi</h2>
<ul>
<li>Hisobingizga kirish va o'qish jarayonini saqlash.</li>
<li>Parolni tiklash havolasini emailingizga yuborish.</li>
<li>Haftalik reytingda ismingiz (familiyaning birinchi harfi bilan) va shu haftadagi XP'ingizni boshqa o'quvchilarga ko'rsatish.</li>
<li>Xizmatni suiiste'moldan himoya qilish: IP manzil so'rovlar sonini cheklash uchun vaqtincha, faqat xotirada ishlatiladi.</li>
</ul>
<p>Ma'lumotlaringiz sotilmaydi, reklama uchun ishlatilmaydi va uchinchi tomonga berilmaydi.</p>

<h2>Uchinchi tomon xizmatlari</h2>
<ul>
<li><b>Google</b> — Google orqali kirish va parolni tiklash xatlarini yuborish (Gmail).</li>
</ul>

<h2>Saqlash muddati va o'chirish</h2>
<p>Ma'lumotlar hisobingiz mavjud ekan saqlanadi. Hisobni istalgan vaqtda o'zingiz o'chirishingiz mumkin: <b>Ko'proq → Profil → Hisobni o'chirish</b>. Shunda ismingiz, emailingiz va o'qish jarayoni darhol o'chiriladi. Serverdagi zaxira nusxalardan ular 14 kun ichida yo'qoladi.</p>

<h2>Aloqa</h2>
<p>Savol yoki so'rovlar uchun: <b>abrordev888@gmail.com</b></p>
</main></body></html>`;
