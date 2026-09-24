// 04–07 — Onboarding: why, the daily plan, which level, and the plan that follows from them.
//
// One screen with four steps rather than four routes: the answers belong together until the last button,
// and "Orqaga" should step back through them, not out of the app. Nothing is saved until "Birinchi darsni boshlash".
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";
import { addDays, fmtDayMonth, today } from "@upkorean/shared/dates.js";
import { LESSON_PARTS } from "@upkorean/shared/course/levels.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Choice, Col, FadeIn, Row, Screen, Segmented, Title, Toggle, Txt } from "../ui";
import { allLevels, dailyMinutes, LEVEL_BLURB, rangeLine } from "../model";
import { syncReminder } from "../notify";

const TIMES = ["08:00", "13:00", "20:00"];
const GOAL_IDS = ["topik", "work", "study", "self"];

export default function Onboarding({ navigation }) {
  const c = useColors();
  const store = useStore();
  const profile = store.state.profile;
  const levels = useMemo(() => allLevels(store.levels), [store.levels]);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(profile.goal || "topik");
  const [remind, setRemind] = useState(profile.reminders?.on ?? true);
  const [at, setAt] = useState(TIMES.includes(profile.reminders?.at) ? profile.reminders.at : "20:00");
  const [levelId, setLevelId] = useState(() => {
    const open = levels.find((level) => level.id === profile.level && !level.locked) || levels.find((level) => !level.locked);
    return open ? open.id : "b";
  });
  const [busy, setBusy] = useState(false);

  const level = levels.find((l) => l.id === levelId) || levels[0];
  const range = srs.dailyRange(level.id);
  const perDay = range.from;
  // The standard grows a step a week while the words stay, so the level takes about this long.
  const levelDays = srs.levelDays(level.id, level.planned);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    const state = store.state;
    state.profile.goal = goal;
    state.profile.reminders = { on: remind, at };
    try {
      if (state.profile.level !== levelId) await store.switchLevel(levelId);
    } catch (problem) {
      store.say(problem.message, "bad");
    }
    if (remind) {
      const allowed = await syncReminder({ on: true, at }, { ask: true, words: srs.dailyRange(levelId).from });
      if (!allowed) store.say("Eslatma uchun bildirishnomalarga ruxsat bering");
    }
    state.profile.onboarded = true;
    store.save();
    setBusy(false);
    // The onboarding route disappears with the flag; the first lesson is one tap away on the home screen.
    navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
  };

  const Progress = () => (
    <Row gap={8} style={{ paddingHorizontal: 26, paddingTop: 4, paddingBottom: 24 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: i <= step ? c.green : c.lineStrong }} />
      ))}
      <Text style={{ fontFamily: FONTS.bold, fontSize: 12.5, color: c.ink2, marginLeft: 6 }}>{step + 1} / 3</Text>
    </Row>
  );

  const Footer = ({ label, onNext }) => (
    <Row gap={12} style={{ paddingHorizontal: 26, paddingTop: 12, paddingBottom: 30 }}>
      {step > 0 ? <Button title="Orqaga" kind="white" onPress={() => setStep(step - 1)} style={{ paddingHorizontal: 22 }} /> : null}
      <Button title={label} onPress={onNext} style={{ flex: 1 }} />
    </Row>
  );

  if (step === 3) {
    const rows = [
      ["Jami so'z", String(level.planned)],
      ["Darslar", `${Math.floor(level.planned / (srs.PART_SIZE * LESSON_PARTS))} ta, har birida ${srs.PART_SIZE * LESSON_PARTS} so'z`],
      ["Kunlik reja", rangeLine(range)],
      ["Kunlik vaqt", `~${dailyMinutes(perDay)} daq`],
      ["Daraja davomiyligi", `~${levelDays} kun`],
    ];
    return (
      <Screen edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingBottom: 30, gap: 16 }}>
          <View style={{ paddingTop: 44, alignItems: "center", gap: 10 }}>
            <View style={{ width: 76, height: 76, borderRadius: 26, backgroundColor: c.green, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26, fontWeight: "700", color: c.onGreen }}>{level.ko}</Text>
            </View>
            <Title size={29} style={{ marginTop: 6 }}>Rejangiz tayyor</Title>
            <Txt c="ink2" style={{ textAlign: "center" }}>{level.uz} daraja · kuniga {perDay} so'z</Txt>
          </View>
          <View style={{ backgroundColor: c.card, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 22, marginTop: 8 }}>
            {rows.map(([label, value], i) => (
              <Row key={label} gap={14} style={{ paddingVertical: 16, borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: c.tint2 }}>
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14.5, color: c.ink2 }}>{label}</Text>
                <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: c.ink }}>{value}</Text>
              </Row>
            ))}
          </View>
          <View style={{ backgroundColor: c.greenTint, borderRadius: 20, padding: 18, gap: 5 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.greenDeep }}>
              Tugatish sanasi: {fmtDayMonth(addDays(today(), levelDays - 1))}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: c.greenDeep }}>
              Har kuni rejani bajarsangiz. So'zlarni yaxshi eslab qolsangiz, kunlik dars o'sib boradi va daraja ertaroq tugaydi.
            </Text>
          </View>
          <View style={{ flex: 1, minHeight: 12 }} />
          <Col gap={10}>
            <Button title="Birinchi darsni boshlash" onPress={finish} loading={busy} />
            <Button title="Darajani o'zgartirish" kind="clear" onPress={() => setStep(2)} />
          </Col>
        </ScrollView>
      </Screen>
    );
  }

  const content = {
    0: {
      title: "Nima uchun koreyscha o'rganyapsiz?",
      lead: "Javobingizga qarab so'zlar tartibi va misollar tanlanadi.",
      body: (
        <Col gap={11}>
          {GOAL_IDS.map((id) => (
            <Choice key={id} title={srs.GOALS[id].name} desc={srs.GOALS[id].desc} selected={goal === id} onPress={() => setGoal(id)} />
          ))}
        </Col>
      ),
      next: "Davom etish",
    },
    1: {
      title: "Kunlik reja",
      lead: "Har kuni yangi so'zlar, 10 tadan bo'limlarda — orasida tanaffus qilsa bo'ladi. So'zlarni yaxshi eslab qolsangiz, reja har hafta 5 so'zga oshib boradi.",
      body: (
        <Col gap={11}>
          <View style={{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 20 }}>
            {levels.map((l, i) => (
              <Row key={l.id} gap={14} style={{ paddingVertical: 14, borderBottomWidth: i < levels.length - 1 ? 1 : 0, borderBottomColor: c.tint2 }}>
                <Text style={{ width: 46, fontSize: 16, fontWeight: "700", color: c.ink }}>{l.ko}</Text>
                <Text style={{ flex: 1, fontFamily: FONTS.bold, fontSize: 15, color: c.ink }}>{rangeLine(srs.dailyRange(l.id))}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>~{dailyMinutes(srs.dailyRange(l.id).from)} daq</Text>
              </Row>
            ))}
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: c.ink2, paddingHorizontal: 4 }}>
            Takrorlashda so'zlarni 85% dan yaxshi eslab qolsangiz va takrorlash to'planib qolmasa, kunlik dars 5 so'zga
            oshadi. Qiyin bo'lsa, 5 so'zga kamayadi. Reja bajarilgan kun seriyaga qo'shiladi.
          </Text>
          <View style={{ marginTop: 11, backgroundColor: c.card, borderRadius: 20, padding: 20, gap: 14 }}>
            <Row gap={14}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.ink }}>Kunlik eslatma</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>reja bajarilmagan kuni bitta bildirishnoma</Text>
              </View>
              <Toggle value={remind} onChange={setRemind} />
            </Row>
            {remind ? <Segmented options={TIMES.map((t) => ({ value: t, label: t }))} value={at} onChange={setAt} /> : null}
          </View>
        </Col>
      ),
      next: "Davom etish",
    },
    2: {
      title: "Darajangizni tanlang",
      lead: "So'zlar TOPIK darajalariga mos rasmiy ro'yxatdan olingan. Keyinroq Profildan o'zgartirish mumkin.",
      body: (
        <Col gap={11}>
          {levels.map((l) => (
            <Choice
              key={l.id}
              titleKo={l.ko}
              title={l.uz}
              desc={LEVEL_BLURB[l.id].desc}
              note={l.locked ? "Tez kunda · tayyorlanmoqda" : `${l.planned} so'z · ${rangeLine(srs.dailyRange(l.id))}`}
              selected={levelId === l.id}
              disabled={l.locked}
              align="flex-start"
              onPress={() => setLevelId(l.id)}
            />
          ))}
        </Col>
      ),
      next: "Tayyor",
    },
  }[step];

  return (
    <Screen edges={["top", "bottom"]}>
      <Progress />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 12 }}>
        <FadeIn key={step} from="right" distance={24}>
          <Col gap={7}>
            <Title size={29}>{content.title}</Title>
            <Txt c="ink2">{content.lead}</Txt>
          </Col>
          <View style={{ marginTop: 26 }}>{content.body}</View>
        </FadeIn>
      </ScrollView>
      <Footer label={content.next} onNext={() => setStep(step + 1)} />
    </Screen>
  );
}
