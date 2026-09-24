# UpKorean

Koreys tili so'z boyligi ilovasi. Uch daraja — 초급, 중급, 고급 — har biri 50 kun, kuniga 30 so'z.

```
apps/
  api/        Express server — mobil ilova gaplashadigan JSON API (/api/*)
  mobile/     Expo / React Native ilovasi — asosiy mijoz
packages/
  shared/     Progress sync mantiqi va kurs ma'lumoti (uch darajaning fayllari)
data/         SQLite bazasi va backup'lar (git'ga tushmaydi)
audio/        Diktor audiosi, so'z id'si bo'yicha: audio/words/b-1-0.mp3 (git'ga tushmaydi)
scripts/      Kontentni tekshirish, backup, audio nomlash, OCR yordamchilari, so'z rejasi
vocab/        NIKL darajali so'z ro'yxati va undan tuzilgan kunlik reja (vocab/README.md)
test/         node:test — API, sync, progress, SRS, mashqlar va kontent testlari
deploy/       Apache konfigi, systemd unit'i, deploy skripti va server qo'llanmasi
docs/         API ma'lumotnomasi
```

## Nega shunday

Ilgari bu brauzer ilovasi (PWA) edi. Aksariyat o'rganuvchida kompyuter yo'q, telefon esa bor — shuning
uchun mahsulot endi faqat mobil ilova. Web qismi (brauzer ilovasi, landing sahifa, Web Push, cookie
sessiyasi) koddan ham, serverdan ham butunlay olib tashlandi; kerak bo'lsa keyinchalik noldan quriladi.
Ortda bitta backend qoldi va u faqat API beradi.

Kurs `packages/shared/course/<daraja>/` da yashaydi va API orqali JSON bo'lib tarqaladi. So'z nomi
o'zining joyini aytadi: `"b-1-0"` — 초급, 1-kun, birinchi so'z. Daraja nomga kirgani uchun uchala
darajaning progressi bitta obyektda hech qachon to'qnashmaydi.

## Ishga tushirish

```powershell
npm install              # apps/api, packages/shared — npm workspaces
copy .env.example .env   # kamida PORT va APP_URL
npm run dev              # http://localhost:3000/api — API
```

Mobil ilova alohida turadi (Metro bundler npm workspaces bilan yaxshi chiqishmaydi). Windows
PowerShell 5.1 da `&&` yo'q, shuning uchun har bir buyruq alohida qatorda:

```powershell
cd apps\mobile
npm install
npx expo start
```

Dev rejimida ilova API manzilini o'zi topadi: bundle'ni qaysi kompyuterdan yuklagan bo'lsa,
`http://<shu IP>:3000` ga boradi. Telefon va kompyuter bitta Wi-Fi'da bo'lsin.

## Buyruqlar

| Buyruq | Nima qiladi |
| --- | --- |
| `npm run dev` | Serverni `--watch` bilan, demo hisob yoqilgan holda |
| `npm start` | Serverni prod rejimida |
| `npm test` | Butun test to'plami |
| `npm run check:content` | Har bir darajaning tuzilishini tekshiradi |
| `npm run plan:vocab` | NIKL ro'yxatidan `vocab/plan.tsv` ni qayta tuzadi (Python 3 + openpyxl) |
| `npm run backup` | SQLite bazasining nusxasini `data/backups/` ga oladi |
| `npm run mobile` | `apps/mobile` dagi Expo dev serverini ochadi |

## Kontent qo'shish

Har bir daraja o'z papkasida, uchta fayl bilan: `packages/shared/course/<b|m|a>/`

| Fayl | Shakli |
| --- | --- |
| `vocab.js` | `export default [[["필요하다","kerak"], …], …]` — tashqi massiv kunlar, ichkarisi `[koreyscha, o'zbekcha]` |
| `examples.js` | `export default [{ id:"1-0", w, ko, hl, cloze?, uz, note? }, …]` — id kun ichidagi o'rin (`"<kun>-<indeks>"`), darajasiz |
| `roots.js` | `export default { "1-0": { parts:[…], idea, origin }, … }` — so'z qanday tuzilgani (ixtiyoriy) |

Papkasi yo'q daraja xato emas — u ilovada qulflangan ko'rinadi. Qo'shgandan keyin:
`npm run check:content`.

## Hujjatlar

- [docs/api.md](docs/api.md) — API ma'lumotnomasi
- [deploy/README.md](deploy/README.md) — serverga chiqarish, Apache, systemd, backup, sertifikat
- [apps/mobile/README.md](apps/mobile/README.md) — Expo ilovasini yig'ish va chiqarish
