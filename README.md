# UpKorean

Koreys tili so'z boyligi ilovasi. Uch daraja — 초급, 중급, 고급 — Koreya Milliy til institutining (NIKL)
TOPIK darajalariga mos rasmiy ro'yxatidan 10 635 so'z. Har bir daraja 10 so'zlik darslardan iborat bitta
yo'l: kalendar kunlari yo'q, lekin kunlik reja qat'iy — 초급 da 20, 중급 da 30, 고급 da 40 so'z. Reja bajarilgan
kun seriyaga qo'shiladi, takrorlash o'z vaqtida qaytadi.

```
apps/
  api/        Express server — mobil ilova gaplashadigan JSON API (/api/*)
  mobile/     Expo / React Native ilovasi — asosiy mijoz
packages/
  shared/     Progress sync mantiqi va kurs ma'lumoti (uch darajaning fayllari)
data/         SQLite bazasi va backup'lar (git'ga tushmaydi)
audio/        Diktor audiosi, so'z id'si bo'yicha: audio/words/b-36.mp3 (git'ga tushmaydi)
scripts/      Kontentni tekshirish, backup, so'z rejasi va kursni yig'ish
vocab/        NIKL darajali so'z ro'yxati, tarjimalar, misollar va darslar rejasi (vocab/README.md)
test/         node:test — API, sync, progress, SRS, mashqlar va kontent testlari
deploy/       Apache konfigi, systemd unit'i, deploy skripti va server qo'llanmasi
docs/         API ma'lumotnomasi
```

## Nega shunday

Ilgari bu brauzer ilovasi (PWA) edi. Aksariyat o'rganuvchida kompyuter yo'q, telefon esa bor — shuning
uchun mahsulot endi faqat mobil ilova. Web qismi (brauzer ilovasi, landing sahifa, Web Push, cookie
sessiyasi) koddan ham, serverdan ham butunlay olib tashlandi; kerak bo'lsa keyinchalik noldan quriladi.
Ortda bitta backend qoldi va u faqat API beradi.

Kurs `vocab/` da tayyorlanadi, `packages/shared/course/<daraja>/` ga yig'iladi va API orqali JSON bo'lib
tarqaladi. So'z nomi — daraja va NIKL raqami: `"b-36"` — 것. Raqam o'zgarmaydi, shuning uchun darslar qayta
tartiblansa ham progress va audio joyida qoladi; daraja nomga kirgani uchun uchala darajaning progressi
bitta obyektda to'qnashmaydi.

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
| `npm run build:course` | `vocab/` dan ilova kontentini (`packages/shared/course/`) yig'adi |
| `npm run backup` | SQLite bazasining nusxasini `data/backups/` ga oladi |
| `npm run mobile` | `apps/mobile` dagi Expo dev serverini ochadi |

## Kontent qo'shish

Kontent qo'lda `packages/shared/course/` da yozilmaydi — u `vocab/` dan yig'iladi:

1. `vocab/uz.tsv` ga so'zlarning o'zbekcha ma'nosini, `vocab/examples.tsv` ga misol gaplarni qo'shing
   (ikkalasi ham NIKL kaliti bo'yicha, masalan `가격02`).
2. `npm run build:course` — to'liq tarjima qilingan darslar ilovaga chiqadi, qolgani navbatda turadi.
3. `npm run check:content`.

Tartibni o'zgartirish kerak bo'lsa — `scripts/plan-vocab.py` va `npm run plan:vocab`. Batafsil:
[vocab/README.md](vocab/README.md).

## Hujjatlar

- [docs/api.md](docs/api.md) — API ma'lumotnomasi
- [deploy/README.md](deploy/README.md) — serverga chiqarish, Apache, systemd, backup, sertifikat
- [apps/mobile/README.md](apps/mobile/README.md) — Expo ilovasini yig'ish va chiqarish
