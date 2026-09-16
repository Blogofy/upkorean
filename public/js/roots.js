// Memory aids for the "Tanishish" (first meeting) card — word id → how the word is built and how to remember it.
// Most TOPIK II words are Sino-Korean: each syllable carries a meaning (a hanja) that returns in other words,
// so a learner who knows 관 = "bog'lanish" from 관심 already half-knows 관계.
// A day whose words all have an entry here uses the guided learning flow (js/exercise.js).
//
// parts  — the word split into meaningful pieces, in order; together the `k`s spell the word exactly
//   k    — the Korean piece (one syllable when it has a hanja)
//   h    — the hanja (omitted for native Korean pieces and endings such as 하다)
//   uz   — the piece's meaning; the same hanja always gets the same meaning (checked by test/roots.test.js)
// idea   — the literal sense of the parts, which leads to the meaning
// family — related words outside this entry: same root, derived forms or opposites ([korean, uzbek])
// hint   — an optional sound-alike memory hook, only where it comes naturally
// note   — an optional warning (homonyms, look-alikes)
window.UK_ROOTS = {
  // ---------- Day 1 ----------
  "1-0": {
    parts: [{ k: "필", h: "必", uz: "albatta" }, { k: "요", h: "要", uz: "talab" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "albatta talab qilinadi",
    family: [["필수", "majburiy"], ["중요하다", "muhim"]],
  },
  "1-1": {
    parts: [{ k: "방", h: "方", uz: "tomon, yo'nalish" }, { k: "법", h: "法", uz: "qoida" }],
    idea: "ishni qilishning yo'nalishi va qoidasi",
    family: [["법", "qonun"], ["문법", "grammatika"]],
  },
  "1-2": {
    parts: [{ k: "이", h: "利", uz: "foyda" }, { k: "용", h: "用", uz: "ishlatmoq" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "foyda olish uchun ishlatmoq",
    family: [["사용하다", "ishlatmoq"], ["편리하다", "qulay"]],
    note: "利 so'z boshida 이, boshqa joyda 리 o'qiladi: 편리 [pyeolli].",
  },
  "1-3": {
    parts: [{ k: "생각", uz: "fikr" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "fikr qilmoq",
    family: [["생각나다", "esga tushmoq"]],
  },
  "1-4": {
    parts: [{ k: "관", h: "關", uz: "bog'lanish" }, { k: "심", h: "心", uz: "yurak" }],
    idea: "yurak bog'lanib qolgan narsa",
    family: [["중심", "markaz"], ["안심", "xotirjamlik"]],
  },
  "1-5": {
    parts: [{ k: "가", h: "可", uz: "mumkin" }, { k: "능", h: "能", uz: "qodir bo'lmoq" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "qila olish mumkin",
    family: [["불가능하다", "imkonsiz"], ["능력", "qobiliyat"]],
  },
  "1-6": {
    parts: [{ k: "결", h: "結", uz: "bog'lamoq, tugun" }, { k: "과", h: "果", uz: "meva" }],
    idea: "ish tugab, bergan mevasi",
    family: [["결혼", "nikoh"], ["과일", "meva"]],
  },
  "1-7": {
    parts: [{ k: "늘다", uz: "ko'paymoq" }],
    idea: "soni yoki hajmi oshmoq",
    family: [["늘리다", "ko'paytirmoq"], ["줄다", "kamaymoq (teskarisi)"]],
  },
  "1-8": {
    parts: [{ k: "바꾸다", uz: "almashtirmoq" }],
    idea: "bir narsani boshqasiga almashtirmoq",
    family: [["바뀌다", "o'zgarmoq"]],
    hint: "바꾸다 ≈ \"bankda\" — bankda pul almashtiriladi.",
  },
  "1-9": {
    parts: [{ k: "노", h: "努", uz: "tirishmoq" }, { k: "력", h: "力", uz: "kuch" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "kuch sarflab tirishmoq",
    family: [["능력", "qobiliyat"], ["체력", "jismoniy kuch"]],
  },
  "1-10": {
    parts: [{ k: "느끼다", uz: "his qilmoq" }],
    idea: "ichdan sezmoq",
    family: [["느낌", "tuyg'u, taassurot"]],
  },
  "1-11": {
    parts: [{ k: "경", h: "境", uz: "hudud, chegara" }, { k: "우", h: "遇", uz: "duch kelmoq" }],
    idea: "duch kelingan holat",
    note: "경험dagi 경 boshqa ieroglif (經) — ma'nosi ham boshqa.",
  },
  "1-12": {
    parts: [{ k: "상", h: "商", uz: "savdo" }, { k: "품", h: "品", uz: "buyum" }],
    idea: "savdo qilinadigan buyum",
    family: [["상점", "do'kon"], ["제품", "mahsulot"]],
  },
  "1-13": {
    parts: [{ k: "생기다", uz: "paydo bo'lmoq" }],
    idea: "yo'q narsa bor bo'lmoq",
    family: [["잘생기다", "kelishgan (yaxshi \"paydo bo'lgan\")"]],
  },
  "1-14": {
    idea: "돕다 (yordam bermoq) fe'lidan yasalgan ot",
    family: [["돕다", "yordam bermoq"], ["도와주다", "yordam berib yubormoq"]],
  },
  "1-15": {
    parts: [{ k: "환", h: "環", uz: "halqa" }, { k: "경", h: "境", uz: "hudud, chegara" }],
    idea: "atrofni halqadek o'rab turgan hudud",
  },
  "1-16": {
    parts: [{ k: "내", h: "內", uz: "ich" }, { k: "용", h: "容", uz: "sig'dirmoq" }],
    idea: "ichiga sig'dirilgan narsa",
    family: [["실내", "xona ichi"]],
    note: "이용dagi 용 boshqa ieroglif (用).",
  },
  "1-17": {
    parts: [{ k: "상", h: "狀", uz: "ko'rinish" }, { k: "황", h: "況", uz: "ahvol" }],
    idea: "ahvolning ko'rinishi",
    note: "상품dagi 상 (商, savdo) boshqa ieroglif.",
  },
  "1-18": {
    parts: [{ k: "바로", uz: "to'g'ri" }, { k: "잡다", uz: "ushlamoq" }],
    idea: "to'g'ri holatda ushlab qo'ymoq",
  },
  "1-19": {
    parts: [{ k: "사", h: "社", uz: "jamoa" }, { k: "회", h: "會", uz: "yig'ilmoq" }],
    idea: "odamlar yig'ilgan jamoa",
    family: [["회사", "kompaniya — shu ikki bo'lak teskari tartibda"], ["회의", "yig'ilish"]],
  },
  "1-20": {
    parts: [{ k: "생", h: "生", uz: "hayot, tirik" }, { k: "활", h: "活", uz: "faol" }],
    idea: "faol yashash",
    family: [["학생", "talaba"], ["활동", "faoliyat"]],
  },
  "1-21": {
    parts: [{ k: "이", h: "異", uz: "boshqacha" }, { k: "상", h: "常", uz: "odatiy" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "odatiydan boshqacha",
    family: [["정상", "normal holat"]],
    note: "이상 (以上) — \"...dan ortiq\" ham shunday yoziladi.",
  },
  "1-22": {
    parts: [{ k: "경", h: "經", uz: "boshdan o'tkazmoq" }, { k: "험", h: "驗", uz: "sinamoq" }],
    idea: "boshdan o'tkazib sinalgan narsa",
    family: [["시험", "imtihon"]],
  },
  "1-23": {
    parts: [{ k: "다", h: "多", uz: "ko'p" }, { k: "양", h: "樣", uz: "xil, shakl" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "ko'p xil",
    family: [["다수", "ko'pchilik"]],
  },
  "1-24": {
    parts: [{ k: "최", h: "最", uz: "eng" }, { k: "근", h: "近", uz: "yaqin" }],
    idea: "eng yaqin vaqt",
    family: [["최고", "eng zo'r"], ["근처", "yaqin atrof"]],
  },
  "1-25": {
    parts: [{ k: "선", h: "選", uz: "tanlamoq" }, { k: "택", h: "擇", uz: "saralamoq" }, { k: "하다", uz: "fe'l qo'shimchasi" }],
    idea: "tanlab saralamoq",
    family: [["선거", "saylov"]],
  },
  "1-26": {
    parts: [{ k: "효", h: "效", uz: "samara" }, { k: "과", h: "果", uz: "meva" }],
    idea: "harakatning bergan mevasi",
  },
  "1-27": {
    parts: [{ k: "문", h: "問", uz: "so'ramoq" }, { k: "제", h: "題", uz: "mavzu" }],
    idea: "so'raladigan mavzu",
    family: [["질문", "savol"], ["숙제", "uy vazifasi"]],
  },
  "1-28": {
    parts: [{ k: "자", h: "自", uz: "o'z" }, { k: "신", h: "身", uz: "tana" }],
    idea: "o'z tanasi",
    family: [["자기", "o'zi"]],
    note: "자신 (自信) — \"o'ziga ishonch\" ham shunday yoziladi: 信 = ishonch.",
  },
  "1-29": {
    parts: [{ k: "찾다", uz: "qidirmoq" }],
    idea: "qidirib topmoq",
    family: [["찾아가다", "izlab bormoq"]],
    hint: "찾다 ≈ \"chatda\" — chatda qidirasiz, topasiz.",
  },
  "1-30": {
    parts: [{ k: "관", h: "關", uz: "bog'lanish" }, { k: "계", h: "係", uz: "bog'liqlik" }],
    idea: "bir-biriga bog'liq bo'lish",
  },
  "1-31": {
    parts: [{ k: "기", h: "期", uz: "muddat" }, { k: "간", h: "間", uz: "oraliq" }],
    idea: "boshi va oxiri orasidagi vaqt",
    family: [["시간", "vaqt"], ["기대", "umid, kutish"]],
  },
  "1-32": {
    parts: [{ k: "전", h: "專", uz: "faqat bitta" }, { k: "문", h: "門", uz: "eshik, soha" }, { k: "가", h: "家", uz: "odam, uy" }],
    idea: "bitta sohaning odami",
    family: [["작가", "yozuvchi"], ["화가", "rassom"]],
  },
};
