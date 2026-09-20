# UpKorean API

Mobil (yoki boshqa) ilova yozish uchun kerak bo'ladigan hamma narsa. Manba: [apps/api/index.js](../apps/api/index.js).

- **Baza manzil:** `https://upkorean.uz` (dev: `http://localhost:3000`)
- **Format:** hamma javob JSON. Xatolik doim `{ "error": "matn" }`, ba'zan `field` bilan birga —
  qaysi maydon ostida ko'rsatish kerakligini aytadi (`"email"`, `"password"`, `"name"`, `"current"`, `"next"`).
- **O'zgartiruvchi so'rovlar** (`POST`, `PUT`, `PATCH`, `DELETE`) `Content-Type: application/json`
  bo'lishi shart, aks holda `415`.
- **Xabarlar o'zbekcha** — ularni to'g'ridan-to'g'ri ekranga chiqarsa bo'ladi.

## Sessiya: cookie emas, token

Brauzer `HttpOnly` cookie oladi. Ilovada cookie jar yo'q, shuning uchun har bir so'rovga shu sarlavha
qo'yiladi:

```
X-UK-Client: mobile/1.0.0
```

Server shuni ko'rib sessiyani **javob tanasida** qaytaradi (cookie o'rniga):

```json
{ "user": { … }, "token": "…", "expiresAt": 1792508341176 }
```

Keyingi har bir so'rovda:

```
Authorization: Bearer <token>
X-UK-Client: mobile/1.0.0
```

Token — bu butun hisob. Uni qurilma keystore'ida saqlang (`expo-secure-store`), `AsyncStorage` da emas.
Amal qilish muddati 30 kun; `401` kelsa tokenni o'chirib, kirish ekraniga qayting.

Token qaytaradigan endpointlar: `register`, `login`, `google`, `demo`, `reset`, `account/password`.

**CORS:** API har qanday `Origin` ga javob beradi, lekin `Access-Control-Allow-Credentials` hech qachon
yuborilmaydi va cookie `SameSite=Lax`. Ya'ni begona sayt bu yo'llarga yeta oladi, ammo foydalanuvchining
sessiyasisiz — tizimga kirmagan holatda.

## Konfiguratsiya

### `GET /api/config`

Tizimga kirish shart emas. Ilova ishga tushganda birinchi bo'lib shuni so'raydi.

```json
{
  "google": "…apps.googleusercontent.com",
  "googleAndroid": null,
  "googleIos": null,
  "tutor": false,
  "tutorComingSoon": false,
  "demo": true,
  "clips": true,
  "mail": false,
  "push": "BI2DS5Sk…",
  "contentVersion": "f664a8b5012b",
  "minAppVersion": "1.0.0"
}
```

`minAppVersion` — server hali qabul qiladigan eng eski ilova versiyasi. Ilova o'zining versiyasini shu
bilan solishtirib, kerak bo'lsa "yangilang" ekranini ko'rsatadi.

## Kurs ma'lumoti

Kurs — 30 kun, 1000 so'z, har bir so'zga bitta kitob gapi va so'zning qanday tuzilgani (hanja ildizlari).
Tizimga kirish shart emas.

### `GET /api/content`

```json
{
  "version": "f664a8b5012b",
  "days": 30,
  "words": 1000,
  "parts": [
    { "name": "vocab",    "url": "/api/content/vocab?v=f664a8b5012b",    "bytes": 69289 },
    { "name": "examples", "url": "/api/content/examples?v=f664a8b5012b", "bytes": 199540 },
    { "name": "roots",    "url": "/api/content/roots?v=f664a8b5012b",    "bytes": 205294 }
  ]
}
```

### `GET /api/content/:part`

`part` — `vocab`, `examples` yoki `roots`.

```jsonc
// vocab
{ "version": "…", "days": 30, "count": 1000,
  "words": [{ "id": "1-0", "day": 1, "i": 0, "ko": "필요하다", "uz": "kerak" }, …] }

// examples
{ "version": "…", "count": 1000, "examples": [{ "id": "1-0", "ko": "…", "uz": "…" }, …] }

// roots
{ "version": "…", "roots": { "1-0": { "parts": [{ "h": "必", … }], … }, … }, "hanja": { … }, "suffix": { … } }
```

So'z `id` si — `"<kun>-<indeks>"`, web ilovadagi bilan bir xil. Progress ham shu id'lar bilan saqlanadi.

**Tartib:** ishga tushganda `/api/content` ni so'rang, `version` ni saqlab qo'yganingiz bilan solishtiring.
Bir xil bo'lsa hech nima yuklamang. O'zgargan bo'lsa uchala qismni `?v=<version>` bilan yuklab, qurilmaga
yozing. `?v=` li manzil bir yilga keshlanadi; usiz `ETag` bo'yicha `304` qaytadi. Internet bo'lmasa
saqlangan nusxa to'liq kurs — hech qanday so'rovsiz ishlaydi.

Namuna: [apps/mobile/src/content.js](../apps/mobile/src/content.js).

## Tizimga kirish

| Endpoint | Tana | Javob |
| --- | --- | --- |
| `POST /api/auth/register` | `{ name, email, password }` | `201` + `{ user, token, expiresAt }` |
| `POST /api/auth/login` | `{ email, password }` | `{ user, token, expiresAt }` |
| `POST /api/auth/google` | `{ credential }` yoki `{ accessToken }` | `{ user, passwordCleared, token, expiresAt }` |
| `POST /api/auth/demo` | `{}` | `{ user, token, expiresAt }` — faqat `config.demo` rost bo'lsa |
| `GET /api/auth/me` | — | `{ user }`, kirilmagan bo'lsa `401` |
| `POST /api/auth/logout` | `{}` | `{ ok: true }` |
| `POST /api/auth/forgot` | `{ email }` | `{ ok: true }` — hisob bor-yo'qligini hech qachon aytmaydi |
| `POST /api/auth/reset` | `{ token, password }` | `{ user, token, expiresAt }` |

`user` obyekti:

```json
{ "id": 1, "email": "aziza@mail.uz", "name": "Aziza", "createdAt": "2026-09-20",
  "hasPassword": true, "google": false, "demo": false }
```

Xatoliklar: `400` (ma'lumot noto'g'ri), `401` (email yoki parol noto'g'ri), `409` (email band),
`429` (juda ko'p urinish — `Retry-After` sarlavhasi bilan).

**Google:** server tokenning `aud` maydonini `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID_ANDROID` va
`GOOGLE_CLIENT_ID_IOS` bilan solishtiradi. Mobil uchun Google Cloud Console'da Android va iOS OAuth
mijozlarini yarating va ularning id'sini `.env` ga qo'shing — aks holda ilovadan kelgan token rad etiladi.
`passwordCleared: true` — Google shu emailni tasdiqladi va eski parol o'chirildi (foydalanuvchiga ayting).

**Parolni tiklash** email orqali `https://upkorean.uz/#/reset/<token>` havolasini yuboradi. Ilovada shu
havolani `upkorean://` deep link bilan ushlash yoki foydalanuvchini brauzerga yuborish kerak.

## Hisob

| Endpoint | Tana | Izoh |
| --- | --- | --- |
| `PATCH /api/account` | `{ name }` | `{ user }` |
| `POST /api/account/password` | `{ current, next }` | `{ ok, user, token, expiresAt }` — **boshqa hamma qurilma chiqariladi**, shuning uchun yangi token keladi |
| `DELETE /api/account` | `{ password }` | `{ ok: true }` — hisob butunlay o'chadi |

Demo hisobda bu uchchalasi ham `403`.

## Progress

Progress — bitta JSON obyekt: o'rganilgan so'zlar, takrorlash jadvali, XP, kunlik faollik, sozlamalar.
Tuzilishi [apps/web/js/store.js](../apps/web/js/store.js) dagi `freshState()` da.

### `GET /api/progress`

```json
{ "state": { … } | null, "updatedAt": 1789916348882, "rev": "r1" }
```

### `PUT /api/progress` — butun holatni saqlash

```json
{ "state": { … }, "baseAt": 1789916348882, "rev": "abc123", "tz": 300 }
```

- `baseAt` — shu qurilma boshlagan serverdagi versiya (`updatedAt`). Orada boshqa qurilma saqlagan bo'lsa
  `409` keladi.
- `rev` — shu yozuvning id'si (ixtiyoriy, 40 belgigacha). Javob yo'qolib qolsa, qurilma keyingi `GET` da
  `rev` ni ko'rib, yozuv o'ziniki ekanini taniydi.
- `tz` — UTC'dan minutlardagi farq (`-new Date().getTimezoneOffset()`). Kunlik/haftalik hisob shunga qarab.

Javob: `{ ok: true, updatedAt, rev }`.

### `PATCH /api/progress` — faqat o'zgarganini saqlash

```json
{ "baseAt": 1789916348882, "changes": [{ "p": ["words", "1-3"], "v": { … } }], "rev": "abc124", "tz": 300 }
```

`changes` ni `diffState()` yasaydi — [packages/shared/sync.js](../packages/shared/sync.js). O'sha fayl
ilovada ham ishlatiladi: `import { diffState, mergeStates } from "@upkorean/shared"`.

### Konflikt (`409`)

```json
{ "error": "Progress boshqa qurilmada o'zgargan", "conflict": true,
  "state": { … }, "updatedAt": 1789916500000, "rev": "xyz" }
```

Qurilma `mergeStates(base, mine, theirs)` bilan ikkalasini birlashtirib, yangi `baseAt` (javobdagi
`updatedAt`) bilan qayta yuboradi. Bu uch tomonlama merge sinovdan o'tgan —
[test/sync.test.js](../test/sync.test.js).

Cheklovlar: bir daqiqada 120 ta saqlash, holat hajmi 1 MB gacha (`413`), so'rov tanasi 3 MB gacha.

## Reyting

### `GET /api/leaderboard?tz=300`

```json
{ "rows": [{ "rank": 1, "name": "Aziza K.", "xp": 1240, "me": false }, …], "total": 37 }
```

Shu haftaning XP'si. Eng yaxshi 5 ta, o'zingiz beshtalikka kirmasangiz oxiriga qo'shib beriladi.

## Diktor audiosi

### `GET /media/clip/:kind/:file`

`kind` — `words` yoki `sentences`; `file` — `<so'z id>.mp3`, masalan `1-0.mp3`.

Tizimga kirish shart: `Authorization: Bearer` sarlavhasi bilan so'ralishi kerak. `expo-audio` manba
sifatida `{ uri, headers }` qabul qiladi — `apps/mobile/src/api.js` dagi `authHeaders()` shu uchun bor.
Javob `audio/mpeg`, `Cache-Control: private, max-age=604800`.

`config.clips` yolg'on bo'lsa, serverda hali audio to'liq emas — ilova audio tugmalarini ko'rsatmasin.

## Hali yo'q narsalar

- **Mobil bildirishnoma.** Hozirgi `POST /api/push/subscribe` faqat Web Push obunasini qabul qiladi
  (brauzer endpoint'i + `p256dh`/`auth` kalitlari) va `web-push` orqali yuboradi — mobil ilovadagi
  Expo yoki FCM tokeni bu yerga sig'maydi. Eslatmalarni mobilga olib chiqish uchun `push_subs` jadvaliga
  tur (`web` / `expo`) ustuni va `apps/api/push.js` ga ikkinchi yuborish yo'li kerak bo'ladi. Qaysi
  provayder (Expo Push yoki to'g'ridan-to'g'ri FCM) tanlanishi hal bo'lmagani uchun qo'shilmadi.
- **AI ustoz** (`POST /api/tutor`) o'chirilgan. Server tarafi saqlangan — `apps/api/tutor.js`,
  qaytarish tartibi [deploy/README.md](../deploy/README.md) da.
