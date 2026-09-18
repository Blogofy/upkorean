# UpKorean serverda (upkorean.uz)

Sxema: brauzer → **aaPanel Apache** (80/443, SSL) → **Node** `127.0.0.1:3000` (systemd `upkorean`) → SQLite `/opt/upkorean/data/`.
Server: `109.205.177.244`, Ubuntu 24.04. Unda boshqa saytlar ham bor (apixy.uz, giu, qorovul), shuning uchun Apache va firewall'ga faqat quyidagilar qo'shiladi.

| Fayl | Serverdagi joyi |
|---|---|
| `deploy/upkorean.service` | `/etc/systemd/system/upkorean.service` |
| `deploy/apache-upkorean.uz.conf` | `/www/server/panel/vhost/apache/upkorean.uz.conf` |
| `.env` (repoda yo'q) | `/opt/upkorean/.env` |

`upkorean.uz` ni aaPanel'da sayt sifatida **qo'shmang**: vhost qo'lda yozilgan, panel o'zinikini yaratsa ikkalasi to'qnashadi.

## DNS (ahost → DNS-менеджер)

| Nom | Turi | Qiymat |
|---|---|---|
| `@` | A | `109.205.177.244` |
| `www` | CNAME | `upkorean.uz` |
| `@` | TXT | `v=spf1 -all` |
| `_dmarc` | TXT | `v=DMARC1; p=reject;` |

`mail`, `ftp`, `MX`, `default._domainkey` o'chiriladi: ular ahost hostingi pochtasiniki edi.
Sayt xatlarni Gmail SMTP orqali yuboradi. SPF `-all` va DMARC `reject` esa `@upkorean.uz` nomidan soxta xat yuborishni to'sadi.

## Yangilash (kompyuterdan)

```sh
git archive --format=tar HEAD | ssh root@109.205.177.244 "sh /opt/upkorean/deploy/update.sh"
```

Windows PowerShell'da bu buyruq ishlamaydi: PowerShell `|` orqali o'tgan tar arxivini buzadi (`tar: Malformed extended header`). U yerda quvurni `cmd` ga bering:

```powershell
cmd /c "git archive --format=tar HEAD | ssh root@109.205.177.244 sh /opt/upkorean/deploy/update.sh"
```

Faqat commit qilingan kod ketadi. `.env`, `data/`, `audio/` va `node_modules/` serverda saqlanib qoladi.

## Diktor bo'laklari (`audio/`)

45 MB, 2000 ta `.mp3` — kod bilan birga o'zgarmaydi, shuning uchun git'da kuzatilmaydi va har
yangilashda qayta uzatilmaydi. Ular faqat klip qo'shilganda yoki almashtirilganda alohida ko'chiriladi:

```sh
rsync -az --delete audio/ root@109.205.177.244:/opt/upkorean/audio/
ssh root@109.205.177.244 "chown -R upkorean:upkorean /opt/upkorean/audio && systemctl restart upkorean"
```

Restart kerak: server ishga tushganda bo'laklarni sanaydi (`/api/config` dagi `clips`).
Windows'da `rsync` bo'lmasa `scp -r audio/. root@...:/opt/upkorean/audio/` ham bo'ladi, faqat u
serverdagi ortiqcha fayllarni o'chirmaydi.

**Audio — yagona nusxa.** U git'da ham, `git archive` deploy'ida ham yo'q, ya'ni faqat shu
kompyuterda va serverda turibdi. Ikkalasining birortasi yo'qolsa qayta yozdirish kerak bo'ladi —
uchinchi nusxasini tashqi diskda yoki bulutda saqlang.

## Asset kesh (build id)

Loyihada build step yo'q, shuning uchun fayl nomlarida content-hash ham yo'q. Uning o'rniga server
ishga tushganda `public/` ni bir marta yurib chiqib **build id** hisoblaydi (`publicFingerprint()`,
`server/index.js`) va uni ikki joyga qo'yadi:

- `sw.js` dagi `VERSION` — service worker keshining nomi;
- `index.html` dagi har bir `<script src>` va `<link href>` oxiridagi `?v=…`.

Shu sababli kesh sarlavhalari quyidagicha:

| Nima | `Cache-Control` |
| --- | --- |
| `/` va `/index.html` | `no-cache` — har tashrifda tekshiriladi, aks holda deploy hech kimga yetib bormaydi |
| `/sw.js` | `no-cache` |
| `?v=<build>` bilan so'ralgan `.js` / `.css` / `.woff2` | `public, max-age=31536000, immutable` |
| `?v=` siz (yoki eski `v=`) so'ralgan o'sha fayl | `public, max-age=300` |
| `.png`, `.svg`, `.webmanifest` | `public, max-age=86400` |
| `/media/clip/...` (diktor mp3) | `private, max-age=604800` |

**Muhim:** bir yillik `immutable` faqat URL'da shu deploy'ning build id'si bo'lsa beriladi. Fayl
nomi o'zgarmagani uchun id'siz so'rovga uzoq kesh berish xavfli bo'lardi — eski sahifa yangilanmay
qolardi. `npm run dev` da build id har so'rovda qayta hisoblanadi va uzoq kesh umuman berilmaydi,
shuning uchun `public/` ni tahrirlab, sahifani yangilash kifoya.

Deploy'dan keyin tekshirish:

```sh
curl -sI https://upkorean.uz/ | grep -i cache-control              # no-cache
curl -s  https://upkorean.uz/ | grep -o 'v=[0-9a-f]\{12\}' | head -1
curl -sI "https://upkorean.uz/js/views.js?v=<yuqoridagi id>" | grep -i cache-control   # immutable
```

### Keyingi qadam — fontlarni o'zida hosting qilish

Hozir to'rt oila Google Fonts'dan olinadi va to'rttasi ham ishlatiladi (`Fraunces` → sarlavhalar,
`Plus Jakarta Sans` → asosiy matn, `JetBrains Mono` → raqam/teg, `Noto Sans KR` → koreyscha).
O'lchangan: o'sha bitta stylesheet **394 795 bayt (gzip 93 974)** va 537 ta `@font-face` qoidasi,
shundan **496 tasi Noto Sans KR** (4 ta og'irlik × ~124 unicode-range bo'lagi).

U endi `media="print"` bilan so'raladi va `app.js` uni yuklab bo'lgandan keyin yoqadi, ya'ni
birinchi chizishni bloklamaydi. Qolgan ikki yaxshilanish fayl tayyorlashni talab qiladi, shuning
uchun keyinga qoldirildi:

1. **Kerak bo'lmagan og'irlikni olib tashlash.** Noto Sans KR 900 faqat dekorativ vodiy belgisida
   (`.hero .wm`, `.auth-wm`) ishlatiladi. Uni 700 ga o'tkazib, URL'dan `900` ni olib tashlash
   stylesheet'ni **283 215 baytga (gzip 69 720)** tushiradi — 23 KB gzip tejov.
   (400 — oddiy matn, 500 — `.example .s` / `.cloze .s`, 700 — so'z sarlavhalari; uchalasi kerak.)
2. **O'zida hosting + subset.** Kursda ~1000 so'z va ularning gaplari bor, ya'ni koreyscha glif
   to'plami cheklangan. `pyftsubset` bilan faqat shu gliflarga qisqartirilgan bitta `.woff2`
   (og'irlik boshiga ~30–60 KB) 496 ta `@font-face` ni **4 tasiga** tushiradi va uchinchi tomon
   ulanishini (DNS + TLS) butunlay yo'q qiladi. Buning uchun font fayllarini generatsiya qilish
   kerak — bu repoda build step yo'q, shuning uchun fayllar qo'lda tayyorlanib `public/fonts/` ga
   qo'yiladi, `styles.css` ga `@font-face` (`font-display: swap`) yoziladi va `index.html` dagi
   Google Fonts havolasi bilan CSP'dagi `fonts.googleapis.com` / `fonts.gstatic.com` olib tashlanadi.

## AI ustozni qaytarish

Funksiya **butunlay o'chirilgan**: mijoz tarafi payload'da yo'q, `#/tutor` route'i yo'q, kirish
nuqtalari olib tashlangan (audit M7 va 8.3 — doimiy "tez kunda" tugmasi mahsulot va'dalarini
shartli qilib ko'rsatadi). **Server tarafi saqlangan:** `server/tutor.js` — Claude chaqiruvi,
javob sxemasi va prompt — o'z holicha turibdi va `ANTHROPIC_API_KEY` bilan ishlaydi.

Yoqish uchun:

1. `git show 4a243e9:public/js/tutor.js > public/js/tutor.js` — mijoz ekranlari (start + chat).
2. **Avval `highlight()` ni tuzating** (o'sha fayl, ~202-209-qatorlar). U placeholder sifatida
   yalang'och butun sondan foydalanadi, ya'ni javobdagi **har qanday raqam** placeholder deb
   o'qiladi:
   `highlight("하루에 30분 공부해요", {words:[{id:"1-0",ko:"공부하다"},{id:"1-1",ko:"시간"}]})` →
   `TypeError: Cannot destructure property 'w' of 'found[i]'`. Qo'shni placeholder'lar ham
   birikib ketadi (`"1"+"2"` → `12`). Raqamsiz sentinel kerak (masalan `U+0000 <i> U+0000`).
3. `index.html` ga `<script src="/js/tutor.js?v=__BUILD__">` (views.js dan **oldin**) va
   `public/sw.js` dagi `SHELL` ro'yxatiga `"/js/tutor.js"` qo'shing.
4. `public/js/app.js`: `const T = window.T`, `TITLES.tutor`, `#/tutor` → `V.tutorStart()` tarmog'i,
   `keydown` da `T.onKey`, `MID_TASK` ga `"tutor"`, va `#chat-input` balandligini moslashtiruvchi
   `input` handler'i — hammasi shu commit'da olib tashlangan, `git show` bilan qaytariladi.
5. `public/js/store.js`: `S.tutor = (payload) => api("POST", "/tutor", payload);`.
6. `server/index.js`: `tutorLimit` va `POST /api/tutor` route'i (endi `tutorReply` ni haqiqatdan
   chaqirsin — ilgari u faqat 503 qaytarardi va `tutorReply` import ham qilinmagan edi), hamda
   `/api/config` da `tutor: true`. **`/api/config` kalitlari o'zgarmasin** — eski keshdagi mijoz
   shu obyektni o'qiydi.
7. Kirish nuqtalari: `views.js` da kun tugash ekranidagi tugma va Natijalar sahifasidagi vaqt
   taqsimotida "AI ustoz" qatori.

Holat maydonlari (`state.tutor`, `act[...].min.tutor`) **o'chirilmagan** — `sync.js` ularni hamon
merge qiladi, ya'ni eski qurilmalardagi progress buzilmaydi va qaytarganda joyida turadi.

## Birinchi o'rnatish (bajarilgan, 2026-09-16)

```sh
adduser --system --group --home /opt/upkorean --no-create-home upkorean
mkdir -p /opt/upkorean /www/wwwroot/upkorean.uz/.well-known/acme-challenge
tar -x -C /opt/upkorean -f upkorean.tar          # git archive --format=tar -o upkorean.tar HEAD
# /opt/upkorean/.env — pastda
chown -R upkorean:upkorean /opt/upkorean
cp /opt/upkorean/deploy/upkorean.service /etc/systemd/system/
cd /opt/upkorean && sudo -u upkorean npm ci --omit=dev
systemctl daemon-reload && systemctl enable --now upkorean
cp /opt/upkorean/deploy/apache-upkorean.uz.conf /www/server/panel/vhost/apache/upkorean.uz.conf
/www/server/apache/bin/httpd -t && /etc/init.d/httpd reload
```

`/opt/upkorean/.env` (`chmod 600`, egasi `upkorean`):

```ini
PORT=3000
APP_URL=https://upkorean.uz
NODE_ENV=production
TRUST_PROXY=1
# SMTP majburiy: `NODE_ENV=production` da SMTP_HOST bo'lmasa server ishga tushmaydi (parolni tiklash
# havolasini yuborib bo'lmaydi — u hech qachon logga yozilmaydi).
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<gmail manzil>
SMTP_PASS=<16 harfli ilova paroli>
MAIL_FROM="UpKorean <gmail manzil>"
# Keyin kerak bo'lsa: GOOGLE_CLIENT_ID, ANTHROPIC_API_KEY (.env.example ga qarang).
# O'zgartirgach: systemctl restart upkorean
```

3000-port firewall'da ochilmaydi: ilovaga faqat Apache orqali kiriladi.
Vhost fayli o'zgarsa, uni qayta nusxalab `httpd -t && /etc/init.d/httpd reload` qiling.

## SSL

DNS ishlay boshlagach (`nslookup upkorean.uz 8.8.8.8` → `109.205.177.244`):

```sh
apt install -y certbot
certbot certonly --webroot -w /www/wwwroot/upkorean.uz -d upkorean.uz -d www.upkorean.uz \
  --deploy-hook "/etc/init.d/httpd reload" -m <email> --agree-tos -n
/etc/init.d/httpd reload
```

Sertifikat paydo bo'lishi bilan vhost o'zi HTTPS'ga o'tadi, HTTP va `www` esa `https://upkorean.uz` ga yo'naltiriladi.
Sertifikat avtomatik yangilanadi (`systemctl list-timers | grep certbot`).
HTTPS shart: push-eslatmalar, service worker va `Secure` cookie faqat HTTPS'da ishlaydi.

Google sign-in yoqilsa: Google Cloud Console → OAuth client → **Authorized JavaScript origins** → `https://upkorean.uz`.

## Tekshirish va loglar

```sh
systemctl status upkorean
journalctl -u upkorean -n 50 --no-pager
curl -sI -H "Host: upkorean.uz" http://127.0.0.1/ | head -3
tail /www/wwwlogs/upkorean.uz-error_log
```

## Zaxira

Ilova har 24 soatda `/opt/upkorean/data/backups/` ga nusxa oladi (`VACUUM INTO` — server ishlab
turganda olinadigan butun nusxa) va oxirgi **14** tasini saqlaydi. Ular jonli baza bilan **bitta
diskda** turibdi, ya'ni server yoki disk yo'qolsa zaxiralar ham u bilan ketadi.

`vapid.json` ham o'sha papkada: u yo'qolsa server push uchun **yangi kalit** yaratadi va hamma
brauzer eslatmalarni qaytadan yoqishi kerak bo'ladi (`server/push.js`, `loadKeys`).

### Avtomatik tortish (`deploy/backup-offsite.ps1`)

Skript shu kompyuterda ishlaydi va nusxalarni serverdan **o'zi tortib oladi** ("pull"). Serverda
hech qanday yangi kalit saqlanmaydi: server sindirilsa ham bu nusxalarga undan yetib bo'lmaydi.
Evaziga kompyuter o'chiq bo'lgan kun o'tkazib yuboriladi — bu ataylab qabul qilingan kelishuv.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\UPKOREAN\deploy\backup-offsite.ps1
```

Nusxalar `%USERPROFILE%\UpKorean-zaxira\` ga tushadi; `-Destination` yoki `UPKOREAN_BACKUP_DIR`
bilan boshqa joyga, masalan tashqi diskka yo'naltiriladi. Jurnal — o'sha papkadagi `pull.log`.

- **Serverda rotatsiya qilingan fayllar bu yerda o'chirilmaydi** — serverning 14 talik oynasi
  aynan shunday yengib o'tiladi.
- **Saqlash qoidasi:** oxirgi 180 kunlik hamma nusxa qoladi; undan eskilaridan har oyning
  birinchisi qoladi, qolgani o'chiriladi; eng yangi 14 tasi esa hech qachon o'chirilmaydi.
- **Tekshiruv:** eng yangi zaxira **nomidagi** vaqt 48 soatdan eski bo'lsa yoki serverdagi eng
  yangi fayl yetib kelmagan bo'lsa, skript xato bilan tugaydi. Nomdagi vaqt — serverning nusxa
  olgan payti; fayl sanasiga qarab bo'lmaydi, chunki u faqat qachon ko'chirib olinganini
  bildiradi (server bir oy oldin to'xtagan bo'lsa ham "bugungi" bo'lib ko'rinaveradi).

| Kod | Ma'nosi |
|---|---|
| `0` | hammasi joyida |
| `1` | sozlama xatosi (ssh/scp topilmadi, papka ochilmadi) |
| `2` | serverga ulanib bo'lmadi yoki zaxira papkasi bo'sh |
| `3` | ko'chirish tugallanmadi, fayl yetib kelmadi |
| `4` | tekshiruv yiqildi: zaxira eskirgan yoki bitta ham nusxa yo'q |

**Birinchi marta qo'lda ishga tushiring**: server kaliti `known_hosts` ga tushishi kerak. Skript
`BatchMode=yes` bilan ishlaydi — parol yoki tasdiq so'ralsa u kutib turmay xato qaytaradi, shuning
uchun rejalashtirilgan vazifa hech qachon osilib qolmaydi. Ya'ni ssh'ga kalit bilan kirish
sozlangan bo'lishi shart.

### Kunlik vazifa qilib qo'yish

`cmd` da bir marta:

```bat
schtasks /Create /TN "UpKorean zaxira" /SC DAILY /ST 21:30 /RU "%USERNAME%" /IT /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"D:\UPKOREAN\deploy\backup-offsite.ps1\""
```

`/IT` — vazifa faqat siz tizimga kirgan paytda ishlaydi, parol saqlanmaydi. O'tkazib yuborilgan
kunni keyinroq quvib olish uchun:

```powershell
Set-ScheduledTask -TaskName "UpKorean zaxira" -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable)
```

Tekshirish: Task Scheduler'da **Last Run Result** `0x0` bo'lsin. Boshqa qiymat — yuqoridagi
jadvaldagi kod, batafsili `pull.log` da.

### Tiklash

Kompyuterdan kerakli nusxani serverga yuklang:

```powershell
scp %USERPROFILE%\UpKorean-zaxira\upkorean-2026-09-17-19-04-49.db root@109.205.177.244:/tmp/restore.db
```

Keyin serverda:

```sh
systemctl stop upkorean
cd /opt/upkorean/data
cp upkorean.db upkorean.db.eski-$(date +%F)   # joriy holat ham qolsin
mv /tmp/restore.db upkorean.db
rm -f upkorean.db-wal upkorean.db-shm         # MUHIM, pastga qarang
chown upkorean:upkorean upkorean.db
systemctl start upkorean
systemctl status upkorean
journalctl -u upkorean -n 30 --no-pager
```

`-wal` va `-shm` ni o'chirish shart: baza WAL rejimida ishlaydi (`PRAGMA journal_mode = WAL`),
zaxira esa `VACUUM INTO` bilan olingan mustaqil fayl va uning o'z WAL'i yo'q. Eski WAL joyida
qolsa SQLite uni yangi bazaga qo'llashga urinadi.

Push kalitlarini tiklash (kerak bo'lsa):

```powershell
scp %USERPROFILE%\UpKorean-zaxira\vapid.json root@109.205.177.244:/opt/upkorean/data/vapid.json
ssh root@109.205.177.244 "chown upkorean:upkorean /opt/upkorean/data/vapid.json && systemctl restart upkorean"
```

> **Tiklash qadamlari serverda hali sinalmagan — birinchi marta bajarishdan oldin tekshiring.**
> Fayl egasi va huquqlarini yonidagi mavjud fayllar bilan solishtiring (`ls -l /opt/upkorean/data/`).
> `sqlite3` o'rnatilgan bo'lsa, tiklashdan oldin nusxani sinab ko'ring:
> `sqlite3 upkorean-....db "PRAGMA integrity_check;"` → `ok`.
> Eng yaxshisi — bu yo'lni bir marta jonli bazada emas, sinov nusxasida o'tkazib ko'rish.
