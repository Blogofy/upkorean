# UpKorean mobil ilova

Expo (React Native). Serverga [docs/api.md](../../docs/api.md) da tasvirlangan API orqali ulanadi.

## Nimalari tayyor

| Fayl | Nima qiladi |
| --- | --- |
| `src/config.js` | Server manzili (`app.json` → `expo.extra.apiUrl`) va `X-UK-Client` sarlavhasi |
| `src/api.js` | Butun API: kirish, hisob, progress, reyting, kontent, audio. Sessiya tokenini `expo-secure-store` da saqlaydi |
| `src/content.js` | Kursni bir marta yuklab, qurilmada saqlaydi; versiya o'zgarmasa qayta yuklamaydi; oflayn ishlaydi |
| `App.js` | Zanjir ishlayotganini ko'rsatadigan eng kichik ekran: kirish → kun tanlash → so'zlar ro'yxati |

Ekranlarni (sessiya, takrorlash, profil, reyting) shular ustiga qurasiz. Web ilovadagi mantiqni
`apps/web/js/store.js` va `apps/web/js/exercise.js` dan olib kelish mumkin — ular brauzerga bog'liq
emas, faqat `window` globallariga tayangan.

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

- **Bildirishnomalar.** Server hozir faqat brauzerning Web Push obunasini qabul qiladi. Mobil eslatma
  uchun avval Expo Push yoki to'g'ridan-to'g'ri FCM tanlanishi, keyin serverga ikkinchi yuborish yo'li
  qo'shilishi kerak — batafsil [docs/api.md](../../docs/api.md) ning oxirida.
- **Ikona va splash.** `app.json` da hozir yo'q; `assets/` papkasi bilan birga qo'shiladi.
- **EAS build.** Do'konga chiqarish uchun `eas.json` va `eas build` sozlanishi kerak.
