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

Faqat commit qilingan kod ketadi. `.env`, `data/` va `node_modules/` serverda saqlanib qoladi.

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

Ilova har 24 soatda `/opt/upkorean/data/backups/` ga nusxa oladi. Uni boshqa diskka ham ko'chirib turing:

```sh
scp -r root@109.205.177.244:/opt/upkorean/data/backups ./server-backups
```
