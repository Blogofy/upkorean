# UpKorean serverda (upkorean.uz)

Sxema: mobil ilova → **aaPanel Apache** (80/443, SSL) → **Node** `127.0.0.1:3000` (systemd `upkorean`) → SQLite `/opt/upkorean/data/`.
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

### Bir martalik: monorepo va web ilovaning olib tashlanishi

Ikki narsa bir vaqtda o'zgardi va ikkalasi ham serverda qo'lda qadam talab qiladi.

**1. Kirish nuqtasi.** Repo `apps/api`, `apps/mobile` va `packages/shared` ga
bo'lindi, ya'ni server endi `apps/api/index.js` dan ishga tushadi. `deploy/upkorean.service` shunga
moslandi, lekin systemd unit'i `update.sh` bilan ko'chmaydi — uni o'zingiz qo'yasiz, aks holda
`systemctl restart upkorean` endi yo'q faylni (`server/index.js`) ishga tushirmoqchi bo'ladi:

```sh
ssh root@109.205.177.244
cp /opt/upkorean/deploy/upkorean.service /etc/systemd/system/upkorean.service
systemctl daemon-reload
systemctl restart upkorean
systemctl is-active upkorean
```

**2. Diktor audiosi nomlari.** So'z id'lari darajani oladi (`1-0` → `b-1-0`), audio esa so'z id'si
bo'yicha beriladi. `audio/` git'da yo'q, shuning uchun serverdagi 2000 ta fayl o'z nomi bilan
qolgan va ularni bir marta qayta nomlash kerak:

```sh
cd /opt/upkorean
sudo -u upkorean node scripts/rename-audio.js          # nima o'zgarishini aytadi
sudo -u upkorean node scripts/rename-audio.js --write  # o'zgartiradi
systemctl restart upkorean                             # klip sanog'i qaytadan o'qiladi
```

Qayta ishga tushirsa ham xavfsiz: darajali nomga ega fayllarga tegilmaydi.

### Bir martalik: web qismini serverdan tozalash

Brauzer ilovasi, landing sahifa (`apps/landing`), Web Push (`apps/api/push.js`, `web-push`) va
cookie sessiyasi koddan olib tashlandi. Keyingi deploy'dagi `rsync --delete` fayllarni o'zi
o'chiradi, server esa ishga tushganda bazadagi `push_subs` va `reminders` jadvallarini tashlaydi
(ular faqat brauzerga yetgan). Qo'lda qoladigani — Web Push kalitlari va `.env` dagi yozuvlar:

```sh
ssh root@109.205.177.244
rm -f /opt/upkorean/data/vapid.json /opt/upkorean/data/backups/vapid.json
sed -i '/^VAPID_/d' /opt/upkorean/.env
ls -la /opt/upkorean/apps                      # faqat api va mobile qolishi kerak
ls -la /www/wwwroot/upkorean.uz                # faqat .well-known (sertifikat uchun) qolishi kerak
systemctl restart upkorean
curl -so /dev/null -w '%{http_code}\n' -H "Host: upkorean.uz" http://127.0.0.1/   # 404
```

Eslatmalar endi telefonning o'zida rejalashtiriladi (`expo-notifications`), server ishtirok etmaydi.
Hisoblar va progress bazada o'z joyida.

## Diktor bo'laklari (`audio/`)

45 MB, 2000 ta `.mp3` — kod bilan birga o'zgarmaydi, shuning uchun git'da kuzatilmaydi va har
yangilashda qayta uzatilmaydi. Ular faqat klip qo'shilganda yoki almashtirilganda alohida ko'chiriladi:

Bu kompyuterda `rsync` yo'q (faqat `ssh` va `scp`), shuning uchun tar quvuri ishlatiladi — 2000 ta
kichik fayl uchun `scp -r` dan ancha tez, chunki ulanish bitta:

```powershell
cd D:\UPKOREAN
cmd /c "tar -cf - audio | ssh root@109.205.177.244 tar -xf - -C /opt/upkorean"
ssh root@109.205.177.244 "chown -R upkorean:upkorean /opt/upkorean/audio && systemctl restart upkorean"
```

`cmd /c` shart: PowerShell quvur orqali o'tgan tar arxivini buzadi (deploy buyrug'idagi bilan bir xil sabab).

Restart kerak: server bo'laklarni **faqat ishga tushganda** sanaydi (`/api/config` dagi `clips`). Fayllar
joyida bo'lsa ham, restart bo'lmasa ilova "Diktor audiosi mavjud emas" deydi va tinglash mashqlarini
umuman ko'rsatmaydi. Tekshirish:

```powershell
ssh root@109.205.177.244 "journalctl -u upkorean -n 8 --no-pager | grep Audio"
```

Tar quvuri serverdagi ortiqcha fayllarni o'chirmaydi — faqat ustiga yozadi.

**Audio — yagona nusxa.** U git'da ham, `git archive` deploy'ida ham yo'q, ya'ni faqat shu
kompyuterda va serverda turibdi. Ikkalasining birortasi yo'qolsa qayta yozdirish kerak bo'ladi —
uchinchi nusxasini tashqi diskda yoki bulutda saqlang.

## Kesh sarlavhalari

Serverda web qismi qolmagan: sahifa ham, build id ham, service worker ham yo'q. Server faqat API
beradi: kurs JSON'i, progress va diktor audiosi. Yagona HTML — parolni tiklash xatidagi havola ochadigan
`/reset/<kod>` sahifasi (u ilovani `upkorean://reset/<kod>` bilan ochadi).

| Nima | `Cache-Control` |
| --- | --- |
| `/api/content/<daraja>/<qism>?v=<version>` | `public, max-age=31536000, immutable` |
| o'sha qism `?v=` siz | `public, max-age=300` + `ETag` (o'zgarmagan bo'lsa `304`) |
| `/api/config`, `/api/content` | `no-store` / `no-cache` |
| `/media/clip/...` (diktor mp3) | `private, max-age=604800` |

Kurs versiyasi — `packages/shared/course/` dagi fayllarning fingerprint'i. Kontent o'zgarsa versiya
o'zgaradi va har bir qurilma qayta yuklab oladi; o'zgarmasa hech kim hech nima yuklamaydi.

Deploy'dan keyin tekshirish:

```sh
curl -so /dev/null -w '%{http_code}\n' https://upkorean.uz/                # 404 — sayt yo'q
curl -s  https://upkorean.uz/api/content | head -c 120                    # version + darajalar
curl -sI https://upkorean.uz/api/content/b/vocab | grep -i etag           # ETag bor
```

## AI ustoz

Funksiya o'chirilgan. **Server tarafi saqlangan:** `apps/api/tutor.js` — Claude chaqiruvi, javob
sxemasi va prompt — o'z holicha turibdi va `ANTHROPIC_API_KEY` bilan ishlaydi.

Mijoz tarafi endi brauzerda emas, mobil ilovada yoziladi, shuning uchun eski web ekranlarini
qaytarishning ma'nosi yo'q (ular `git show 4a243e9:public/js/tutor.js` da qolgan — `highlight()`
dagi placeholder xatosi bilan birga: u yalang'och butun sondan foydalangani uchun javobdagi har
qanday raqamni placeholder deb o'qiydi va qo'shni placeholder'lar birikib ketadi. Qayta yozilsa,
raqamsiz sentinel kerak).

Yoqish uchun serverda: `apps/api/index.js` ga `tutorLimit` va `POST /api/tutor` route'ini qo'shing
(`tutorReply` ni haqiqatdan chaqirsin), `/api/config` da `tutor: true` qiling. **`/api/config`
kalitlari o'zgarmasin** — eski ilovalar shu obyektni o'qiydi.

Holat maydonlari (`state.tutor`, `act[...].min.tutor`) **o'chirilmagan** — `sync.js` ularni hamon
merge qiladi, ya'ni eski progress buzilmaydi.

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
HTTPS shart: ilova sessiya tokenini har so'rovda yuboradi, u faqat shifrlangan ulanishda yurishi kerak.

Google sign-in yoqilsa: Android va iOS OAuth client id'lari `.env` dagi `GOOGLE_CLIENT_ID_ANDROID` / `GOOGLE_CLIENT_ID_IOS` ga yoziladi.

## Tekshirish va loglar

```sh
systemctl status upkorean
journalctl -u upkorean -n 50 --no-pager
curl -s  -H "Host: upkorean.uz" http://127.0.0.1/api/config | head -c 200
tail /www/wwwlogs/upkorean.uz-error_log
```

## Zaxira

Ilova har 24 soatda `/opt/upkorean/data/backups/` ga nusxa oladi (`VACUUM INTO` — server ishlab
turganda olinadigan butun nusxa) va oxirgi **14** tasini saqlaydi. Ular jonli baza bilan **bitta
diskda** turibdi, ya'ni server yoki disk yo'qolsa zaxiralar ham u bilan ketadi.

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

> **Tiklash qadamlari serverda hali sinalmagan — birinchi marta bajarishdan oldin tekshiring.**
> Fayl egasi va huquqlarini yonidagi mavjud fayllar bilan solishtiring (`ls -l /opt/upkorean/data/`).
> `sqlite3` o'rnatilgan bo'lsa, tiklashdan oldin nusxani sinab ko'ring:
> `sqlite3 upkorean-....db "PRAGMA integrity_check;"` → `ok`.
> Eng yaxshisi — bu yo'lni bir marta jonli bazada emas, sinov nusxasida o'tkazib ko'rish.
