# UpKorean

30 kunlik TOPIK II so'z boyligi platformasi. Bitta backend, uchta mijoz: web (PWA), mobil (Expo) va
kelajakda qo'shiladigani.

```
apps/
  api/        Express server — JSON API (/api/*) + web ilovaning statik hosting'i
  web/        Brauzer ilovasi (PWA). Build step yo'q: oddiy HTML, CSS, JS
  mobile/     Expo / React Native ilovasi — API bilan bearer token orqali gaplashadi
packages/
  shared/     Ikkala ilova ham, server ham o'qiydigan kod va kurs ma'lumoti
data/         SQLite bazasi va backup'lar (git'ga tushmaydi)
audio/        1000 so'z + 1000 gap diktor audiosi (git'ga tushmaydi, rsync bilan yuklanadi)
scripts/      Kontentni tekshirish, backup, OCR yordamchilari
test/         node:test — API, sync, progress, push va kontent testlari
deploy/       Apache konfigi, systemd unit'i, deploy skripti va server qo'llanmasi
docs/         API ma'lumotnomasi
```

## Nega shunday

Ilgari `server/` va `public/` bo'lgan. Mobil ilova paydo bo'lishi bilan ikkita narsa kerak bo'ldi:
API'ning brauzerdan mustaqil bo'lishi (cookie emas, token) va kurs ma'lumotining `<script>` tegidan
mustaqil bo'lishi (JSON). `packages/shared` — aynan shu ikkisining umumiy qismi: progress sync mantiqi
va kursning o'zi. Server uni brauzerga `/js/*.js` sifatida beradi, mobilga esa `/api/content` orqali
JSON qilib beradi — ya'ni ma'lumot bitta joyda turadi, ikki nusxa emas.

## Ishga tushirish

```sh
npm install              # apps/api, apps/web, packages/shared — npm workspaces
cp .env.example .env     # kamida PORT va APP_URL
npm run dev              # http://localhost:3000 — API ham, web ilova ham shu yerda
```

Mobil ilova alohida turadi (Metro bundler npm workspaces bilan yaxshi chiqishmaydi):

```sh
cd apps/mobile
npm install
npx expo install --fix   # versiyalarni o'rnatilgan Expo SDK'siga moslaydi
npx expo start
```

Telefondagi ilova uchun `localhost` — telefonning o'zi. Kompyuteringizdagi serverga ulanish uchun
`apps/mobile/app.json` dagi `expo.extra.apiUrl` ni kompyuteringizning tarmoqdagi manziliga qo'ying,
masalan `http://192.168.1.5:3000`.

## Buyruqlar

| Buyruq | Nima qiladi |
| --- | --- |
| `npm run dev` | Serverni `--watch` bilan, demo hisob va parol tiklash havolasi yoqilgan holda |
| `npm start` | Serverni prod rejimida |
| `npm test` | Butun test to'plami (40 ta test) |
| `npm run check:content` | Kurs ma'lumotining tuzilishini tekshiradi |
| `npm run backup` | SQLite bazasining nusxasini `data/backups/` ga oladi |
| `npm run mobile` | `apps/mobile` dagi Expo dev serverini ochadi |

## Hujjatlar

- [docs/api.md](docs/api.md) — API ma'lumotnomasi (mobil ilova yozish uchun shu kerak)
- [deploy/README.md](deploy/README.md) — serverga chiqarish, Apache, systemd, backup, sertifikat
- [apps/mobile/README.md](apps/mobile/README.md) — Expo ilovasini yig'ish va chiqarish
