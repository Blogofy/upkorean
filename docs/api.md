# UpKorean API

Mobil (yoki boshqa) ilova yozish uchun kerak bo'ladigan hamma narsa. Manba: [apps/api/index.js](../apps/api/index.js).

- **Baza manzil:** `https://upkorean.uz` (dev: `http://localhost:3000`)
- **Format:** hamma javob JSON. Xatolik doim `{ "error": "matn" }`, ba'zan `field` bilan birga —
  qaysi maydon ostida ko'rsatish kerakligini aytadi (`"email"`, `"password"`, `"name"`, `"current"`, `"next"`).
- **O'zgartiruvchi so'rovlar** (`POST`, `PUT`, `PATCH`, `DELETE`) `Content-Type: application/json`
  bo'lishi shart, aks holda `415`.
- **Xabarlar o'zbekcha** — ularni to'g'ridan-to'g'ri ekranga chiqarsa bo'ladi.

## Sessiya: token

Cookie yo'q. Kirish, ro'yxatdan o'tish va parolni tiklash sessiyani **javob tanasida** qaytaradi:

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

`X-UK-Client` ixtiyoriy — server uni faqat loglar uchun o'qiydi.

**CORS:** API har qanday `Origin` ga javob beradi, lekin `Access-Control-Allow-Credentials` hech qachon
yuborilmaydi va cookie umuman yo'q. Ya'ni begona sayt bu yo'llarga yeta oladi, ammo foydalanuvchining
sessiyasisiz — tizimga kirmagan holatda.

## Konfiguratsiya

### `GET /api/config`

Tizimga kirish shart emas. Ilova ishga tushganda birinchi bo'lib shuni so'raydi.

```json
{
  "google": "…apps.googleusercontent.com",
  "googleAndroid": null,
  "googleIos": null,
  "demo": true,
  "clips": true,
  "mail": false,
  "contentVersion": "f664a8b5012b",
  "defaultLevel": "b",
  "minAppVersion": "1.0.0"
}
```

`minAppVersion` — server hali qabul qiladigan eng eski ilova versiyasi. Ilova o'zining versiyasini shu
bilan solishtirib, kerak bo'lsa "yangilang" ekranini ko'rsatadi.

## Kurs ma'lumoti

Kurs uch darajaga bo'lingan: `b` (초급 = NIKL 1급+2급), `m` (중급 = 3급+4급), `a` (고급 = 5급+6급). Har bir
daraja — darslardan iborat bitta yo'l, har bir dars bir kunlik reja (초급 20, 중급 30, 고급 40 so'z) va
10 so'zlik qismlarga bo'lingan. Daraja tarjimasi tayyor bo'lgan
darslar bilan bosqichma-bosqich ochiladi (`scripts/build-course.mjs`). Tizimga kirish shart emas.

So'z id'si — daraja va NIKL ro'yxatidagi raqami: `"b-36"` — 것. Raqam hech qachon o'zgarmaydi, shuning
uchun darslar qayta tartiblansa ham so'zning progressi va audiosi joyida qoladi
(`/media/clip/words/b-36.mp3`). Dars id'si xuddi shunday: `"b-12"` — 초급 ning 12-darsi.

### `GET /api/content`

```json
{
  "version": "91cdce023148",
  "levels": [
    { "id": "b", "ko": "초급", "uz": "Boshlang'ich", "lessons": 36, "words": 710, "planned": 1835, "locked": false,
      "parts": [
        { "name": "vocab",    "url": "/api/content/b/vocab?v=91cdce023148",    "bytes": 67288 },
        { "name": "examples", "url": "/api/content/b/examples?v=91cdce023148", "bytes": 59 }
      ] },
    { "id": "m", "ko": "중급", "uz": "O'rta", "lessons": 0, "words": 0, "planned": 3855, "locked": true, "parts": [] },
    { "id": "a", "ko": "고급", "uz": "Yuqori", "lessons": 0, "words": 0, "planned": 4945, "locked": true, "parts": [] }
  ]
}
```

`planned` — darajaning barcha so'zlari, `lessons`/`words` — hozir ochiq bo'lgani. Hali bitta darsi ham
tayyor bo'lmagan daraja `locked: true` bilan keladi va `parts` bo'sh: ilova uni ko'rsatadi, lekin ochmaydi.

### `GET /api/content/:level/:part`

`level` — `b`, `m` yoki `a`; `part` — `vocab` yoki `examples`. Qulflangan daraja `404`.

```jsonc
// vocab
{ "version": "…", "id": "b", "ko": "초급", "uz": "Boshlang'ich", "count": 710,
  "lessons": [{ "id": "b-1", "n": 1, "grade": 1, "theme": "", "title": "Bu, men, biz", "parts": 2 }, …],
  "words": [{ "id": "b-36", "level": "b", "lesson": 1, "part": 0, "i": 0, "grade": 1, "ko": "것", "uz": "narsa", "aw": 1 }, …] }

// examples
{ "version": "…", "id": "b", "count": 710,
  "examples": [{ "id": "b-36", "w": "것", "ko": "…", "hl": "…", "cloze": "…", "uz": "…" }, …] }
```

`aw: 1` — so'zning diktor audiosi bor, `as: 1` — misol gapiniki. Belgisi yo'q so'zda ilova eshitish
tugmasini ham, eshitib topish savolini ham ko'rsatmaydi.

**Tartib:** ishga tushganda `/api/content` ni so'rang va `version` ni saqlab qo'yganingiz bilan
solishtiring. Bir xil bo'lsa hech nima yuklamang. O'zgargan bo'lsa kerakli darajaning ikkala qismini
`?v=<version>` bilan yuklab, qurilmaga yozing. `?v=` li manzil bir yilga keshlanadi; usiz `ETag`
bo'yicha `304` qaytadi. Internet bo'lmasa saqlangan nusxa to'liq daraja — hech qanday so'rovsiz
ishlaydi.

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

**Parolni tiklash** email orqali `https://upkorean.uz/reset/<token>` havolasini yuboradi. U ochadigan
sahifa ilovani `upkorean://reset/<token>` bilan ochadi; ochilmasa, kodni ko'rsatadi — ilovada
"Parolni unutdingizmi? → Kodim bor" orqali kiritiladi.

## Hisob

| Endpoint | Tana | Izoh |
| --- | --- | --- |
| `PATCH /api/account` | `{ name }` | `{ user }` |
| `POST /api/account/password` | `{ current, next }` | `{ ok, user, token, expiresAt }` — **boshqa hamma qurilma chiqariladi**, shuning uchun yangi token keladi |
| `DELETE /api/account` | `{ password }` | `{ ok: true }` — hisob butunlay o'chadi |

Demo hisobda bu uchchalasi ham `403`.

## Progress

Progress — bitta JSON obyekt: o'rganilgan so'zlar, takrorlash jadvali, XP, kunlik faollik, sozlamalar.
So'zlar (`"b-36"`) va darslar (`"b-12"`) darajali id bilan kalitlanadi, shuning uchun uchala
darajaning progressi bitta obyektda yonma-yon turadi.

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

`kind` — `words` yoki `sentences`; `file` — `<so'z id>.mp3`, masalan `b-36.mp3`.

Tizimga kirish shart: `Authorization: Bearer` sarlavhasi bilan so'ralishi kerak. `expo-audio` manba
sifatida `{ uri, headers }` qabul qiladi — `apps/mobile/src/api.js` dagi `authHeaders()` shu uchun bor.
Javob `audio/mpeg`, `Cache-Control: private, max-age=604800`.

`config.clips` yolg'on bo'lsa, serverda hali bitta ham audio yo'q. Audio kurs bilan birga bosqichma-bosqich
yoziladi, shuning uchun qaysi so'zda bor ekanini `vocab` dagi `aw`/`as` belgilari aytadi.

## Hali yo'q narsalar

- **Server push.** Web Push olib tashlandi. Kunlik eslatma telefonning o'zida rejalashtiriladi
  (`expo-notifications`, lokal bildirishnoma) va serverga ehtiyoj yo'q. Serverdan yuboriladigan xabar
  (masalan "seriyangiz xavf ostida") kerak bo'lsa, Expo Push tokenlari uchun yangi endpoint qo'shiladi.
- **AI ustoz** (`POST /api/tutor`) o'chirilgan. Server tarafi saqlangan — `apps/api/tutor.js`,
  qaytarish tartibi [deploy/README.md](../deploy/README.md) da.
