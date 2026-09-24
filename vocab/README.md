# So'z rejasi (NIKL)

Kursning so'z bazasi: Koreya Milliy til instituti (국립국어원, NIKL) ning rasmiy darajali ro'yxati —
1급 dan 6급 gacha 10 635 so'z, TOPIK darajalari bilan bir xil. Reja 10 so'zlik qismlardan iborat; ilova ularni
kunlik darslarga yig'adi (`packages/shared/course/levels.js` dagi `perDay`). `npm run build:course` tarjimasi
tayyor qismlarni `packages/shared/course/<daraja>/` ga yig'adi.

| Daraja | NIKL | So'z | Qism (10 so'z) | Kunlik dars | Dars soni |
| --- | --- | --- | --- | --- | --- |
| 초급 (`b`) | 1급 + 2급 | 735 + 1 100 | 184 | 20 so'z | 92 |
| 중급 (`m`) | 3급 + 4급 | 1 655 + 2 200 | 386 | 30 so'z | 129 |
| 고급 (`a`) | 5급 + 6급 | 2 365 + 2 580 | 495 | 40 so'z | 124 |

## Fayllar

| Fayl | Nima |
| --- | --- |
| `nikl/grades.xlsx` | Darajali ro'yxat — qaysi so'z qaysi darajada. Asl nomi: «2017년 국제 통용 한국어 표준 교육과정 적용 연구(4단계) 어휘, 문법 등급 목록_20180227_20201117 수정.xlsx» |
| `nikl/info.xlsx` | Har bir so'z haqida ma'lumot: ikki korpus chastotasi (조남호 2002, 강범모 외 2009), mavzu, ma'no guruhi, sinonim va antonimlar. Asl nomi: «한국어 교육 어휘 내용 개발 4단계 어휘 정보.xlsx» |
| `uz.tsv` | O'zbekcha ma'no, NIKL kaliti bo'yicha (`가격02`). Tartibga bog'liq emas, qo'lda yoziladi |
| `examples.tsv` | Misol gaplar, xuddi shu kalit bo'yicha: gap, ajratiladigan qism, yashiriladigan qism, tarjima |
| `plan.tsv` | Natija: har bir so'zning darsi va o'rni, NIKL raqami (`nid`, ilovadagi id). `scripts/plan-vocab.py` yozadi, qo'lda tahrirlanmaydi |
| `plan.xlsx` | Xuddi shu jadval Excel'da o'qish uchun, har bir daraja alohida varaqda (git'ga tushmaydi) |

```powershell
npm run plan:vocab     # tartibni qayta tuzish; Python 3 va openpyxl kerak: pip install openpyxl
npm run build:course   # uz.tsv / examples.tsv dan ilova kontentini yig'ish
```

## Tartib qanday tuziladi

Asl ro'yxatda har bir daraja ichida so'zlar alifbo bo'yicha turadi — bir darsga faqat 가- bilan boshlanadigan
so'zlar tushib qoladi. Skript ularni o'quvchi uchrashishi kerak bo'lgan tartibga keltiradi:

1. **Daraja** — 1급 tugaydi, keyin 2급 boshlanadi.
2. **Chastota** — eng ko'p ishlatiladigan so'z birinchi. Ikki korpus hisobi millionga keltirilib o'rtachalanadi.
   Korpusda yo'q so'z darajasining o'rtasiga qo'yiladi; affiks (`-적`, `-님`) ham o'rtadan yuqoriga chiqmaydi,
   chunki uning hisobi shu affiks bilan yasalgan barcha so'zlarning yig'indisi.
3. **Mavzu** — 10 so'zlik qism (ilovada bitta o'tirish) bitta vaziyat atrofida yig'iladi: xarid, ob-havo,
   oila. Bir sahnadagi so'zlar bir-birini eslatadi.
4. **O'xshashlar birga emas** — sinonim, antonim va bir xil yoziladigan omonimlar kamida 3 qism oraliqda
   turadi; bir qismda bitta ma'no guruhidan (ranglar, sonlar, hafta kunlari) ko'pi bilan 2 ta so'z bo'ladi.
   Bir-biriga yaqin so'zlar birga o'rganilsa, xotirada aralashib ketadi (Tinkham 1993, Waring 1997,
   Nakata & Suzuki 2019).
5. **Turkumlar aralash** — qismda ko'pi bilan 7 ta ot, qolgani fe'l, sifat, ravish: har bir qismdan gap tuzsa bo'ladi.

## Litsenziya

Ikkala NIKL fayli 공공누리 1-tur (출처표시) ostida: tijoratda ham erkin ishlatiladi, faqat manba ko'rsatiladi —
«국립국어원, 2017년 국제 통용 한국어 표준 교육과정 적용 연구(4단계); 한국어 교육 어휘 내용 개발(4단계)».
Manba sahifalari:
[darajali ro'yxat](https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=932),
[so'z ma'lumoti](https://www.korean.go.kr/front/reportData/reportDataView.do?mn_id=207&report_seq=882).
