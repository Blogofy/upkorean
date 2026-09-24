# UpKorean mobil ilova

Expo (React Native). Serverga [docs/api.md](../../docs/api.md) da tasvirlangan API orqali ulanadi.

## Tuzilishi

Ekranlar claude.ai/design dagi "UpKorean Redesign" dizayniga (34 ekran, A–L guruhlar) bir xil qilib
qurilgan. Har bir ekran faylining birinchi qatori dizayndagi raqamini aytadi (`// 08 — Bugun`).

| Fayl | Nima qiladi |
| --- | --- |
| `App.js` | Shriftlar, store, tema, qaysi oqim (kirish yoki ilova) ko'rinishi, kunlik eslatma |
| `src/nav.js` | 5 ta tab (dizayndagi pastki panel bilan) va ularning ustidagi stek |
| `src/store.js` | Kim kirgan, progress, daraja; progressni serverga farqi bilan yuboradi, oflayn ishlaydi |
| `src/theme.js` | Kunduzgi va tungi palitra, shriftlar, o'lchamlar — ranglar faqat shu yerda |
| `src/ui.js` | Dizayndagi takrorlanadigan bo'laklar: tugma, karta, tanlov, halqa, sheet, dialog… |
| `src/model.js` | Ekranlar kurs haqida gapiradigan narsalar: dars holati, daraja nomi, misol gapni bo'lish |
| `src/notify.js` | Kunlik eslatma — telefonda rejalashtiriladigan lokal bildirishnoma |
| `src/api.js`, `src/content.js`, `src/audio.js` | API, kursni qurilmada saqlash, diktor ovozi |
| `src/screens/` | Ekranlar |

O'rganish mantiqi (SRS, mashqlar, Hangul klaviaturasi) `packages/shared` da — testlari `test/` da.

## Birinchi ishga tushirish

Har bir buyruq alohida qatorda — Windows PowerShell 5.1 da `&&` ishlamaydi:

```powershell
cd apps\mobile
npm install
npx expo start
```

Telefonda **Expo Go** ilovasini ochib QR kodni skanerlang.

Versiyalar Expo SDK 57 ga moslab qotirilgan va tekshirilgan: `npx expo-doctor` — 21/21, `npx expo export
--platform android` — bundle yig'iladi. Keyinchalik SDK'ni yangilaganingizda versiyalarni
`npx expo install --fix` qayta moslaydi.

`babel.config.js` bu yerda yo'q va kerak ham emas: SDK 57 `babel-preset-expo` ni o'zi qo'llaydi. Qo'lda
qo'shilgan konfig aksincha buzadi — `babel-preset-expo` `expo/node_modules` ichida yotadi va loyiha
ildizidan topilmaydi.

## Server manzili

**Dev rejimida hech nima yozish shart emas.** Ilova bundle'ni qaysi kompyuterdan yuklagan bo'lsa,
API'ni ham o'shanda deb hisoblaydi (`Constants.expoConfig.hostUri` dan olinadi) va `http://<shu IP>:3000`
ga murojaat qiladi. Ya'ni kompyuterda `npm run dev` ishlab tursa, kifoya.

`localhost` hech qachon yaramaydi — telefon uchun u telefonning o'zi.

`app.json` dagi `extra` kalitlari:

| Kalit | Qachon ishlaydi | Nima uchun |
| --- | --- | --- |
| `apiUrl` | release build | Do'kondagi ilova qaysi serverga boradi |
| `devApiUrl` | dev, hammasidan ustun | Dev ilovani jonli serverga qaratish kerak bo'lsa |
| `devApiPort` | dev | Server 3000 dan boshqa portda bo'lsa |

**Telefon va kompyuter bitta Wi-Fi'da bo'lishi shart.** Telefon mobil internetda bo'lsa, Metro'ning
`192.168.x.x` manziliga yetolmaydi va Expo Go "Something went wrong" deb to'xtaydi — bu ilovaning emas,
Expo Go'ning xatosi: u loyihani umuman yuklay olmagan. Telefon ham serverga yetolmasa, keyingi gumondor
**Windows Firewall** (3000-portga kiruvchi ulanishga ruxsat).

`--tunnel` rejimi faqat bundle'ni tashqariga chiqaradi, API'ni emas. Shuning uchun tunnel'da ilova
`extra.apiUrl` ga qaytadi — serverni ham tashqariga chiqarib, `extra.devApiUrl` ga o'sha manzilni
yozmasangiz, dev server bilan ishlamaydi. Bitta Wi-Fi ancha osonroq.

> `upkorean.uz` da hozir **eski kod** turibdi — u yerda `/api/content` yo'q va token bilan kirish
> ishlamaydi. Ilova bunday serverda "Bu server ilovani hali qo'llab-quvvatlamaydi" deb aytadi.
> Yangi backend chiqarilgunga qadar faqat dev server bilan sinang.

## Nega bu papka npm workspace emas

Repo ildizidagi `package.json` `apps/api`, `apps/web` va `packages/shared` ni workspace qiladi, lekin
bu papkani qilmaydi. Sababi Metro bundler: workspace hoisting paketlarni ildizdagi `node_modules` ga
ko'chiradi va Metro ularni topolmay qoladi. Shuning uchun bu yerda o'z `node_modules` i bo'ladi,
`packages/shared` esa `metro.config.js` dagi `watchFolders` va `extraNodeModules` orqali ko'rinadi:

```js
import { diffState, mergeStates } from "@upkorean/shared";
```

## Google orqali kirish

Google Cloud Console'da Android va iOS uchun alohida OAuth mijoz yarating va ularning id'larini
serverning `.env` fayliga qo'shing:

```
GOOGLE_CLIENT_ID_ANDROID=…apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=…apps.googleusercontent.com
```

Ularsiz ilovadan kelgan Google tokenini server rad etadi. Olingan `idToken` ni
`api.google({ credential: idToken })` ga bering.

## Hali qilinmagan

- **Google bilan kirish.** Dizayndagi tugma hali qo'shilmagan: Android/iOS OAuth client id'lari kerak
  (pastda). Ular `.env` ga qo'shilgach, `expo-auth-session` bilan ulanadi.
- **To'lov.** Premium sahifasi bor, lekin to'lov ulanmagan — hozircha hamma imkoniyat bepul ochiq va
  "Bepul limit tugadi" oynasi chiqarilmaydi.
- **Ikona va splash.** `app.json` da hozir yo'q; `assets/` papkasi bilan birga qo'shiladi.
- **EAS build.** Do'konga chiqarish uchun `eas.json` va `eas build` sozlanishi kerak.
