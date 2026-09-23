// 21 — Mashqlar. Free practice: the kind of question, where the words come from, how many, how fast.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Empty, Row, Screen, Segmented, Title, Toggle, tapped } from "../ui";

const TYPES = [
  { id: "mixed", title: "Aralash", desc: "Barcha turlar aralash keladi", perItem: 0.35, badge: "tavsiya" },
  { id: "card", title: "Flashcard", desc: "Kartani ochib, o'zingizni baholaysiz", perItem: 0.15 },
  { id: "listen", title: "Eshitib topish", desc: "Talaffuzdan so'zni tanish", perItem: 0.3, audio: true },
  { id: "type", title: "Yozish", desc: "Hangul bilan yozib javob berish", perItem: 0.45 },
  { id: "sent", title: "Gap ichida", desc: "Misol gapdagi bo'sh joy", perItem: 0.45 },
];

export default function Practice({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [type, setType] = useState(route.params?.type || "mixed");
  const [source, setSource] = useState("all");
  const [pickedDays, setPickedDays] = useState([]);
  const [count, setCount] = useState(20);
  const [timed, setTimed] = useState(false);

  const learned = useMemo(() => (state && course ? srs.learnedIds(state, course) : []), [state, course, store.state?.xp]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state || !course) return null;

  const weak = srs.weakIds(state, course);
  const doneDays = Array.from({ length: course.dayCount }, (_, i) => i + 1).filter((day) => srs.dayLearned(state, course, day) > 0);
  let ids = source === "weak" ? weak : source === "days" ? learned.filter((id) => pickedDays.includes(course.byId[id].day)) : learned;
  if (type === "sent") ids = ids.filter((id) => course.examples[id]?.cloze);
  const questions = Math.min(count, ids.length);
  const typeInfo = TYPES.find((t) => t.id === type);

  const start = () => navigation.navigate("Session", {
    kind: "quiz", quizType: type, title: typeInfo.title, ids, count, timeLimit: timed,
  });

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 8 }}>
        <BackLink label="Orqaga" onPress={() => navigation.goBack()} />
        <Title>Mashqlar</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>o'rganilgan so'zlaringiz bazasidan</Text>
      </View>

      {!learned.length ? (
        <Empty ko="시작" title="Hali so'z o'rganilmagan" body="Birinchi kunni tugatganingizdan keyin shu yerda mashq qilasiz." action="Kursga o'tish" onAction={() => navigation.navigate("Tabs", { screen: "Course" })} />
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 12 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5 }}>
              {TYPES.filter((t) => !t.audio || store.audio).map((t, index) => {
                const on = t.id === type;
                const n = Math.min(count, t.id === "sent" ? ids.filter((id) => course.examples[id]?.cloze).length : ids.length);
                return (
                  <View key={t.id} style={{ width: index === 0 ? "100%" : "50%", padding: 4.5 }}>
                    <Pressable
                      onPress={() => { tapped(); setType(t.id); }}
                      style={({ pressed }) => [{ backgroundColor: on ? c.green : c.card, borderRadius: 20, padding: 16, gap: 5, minHeight: index === 0 ? 0 : 116, opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Row justify="space-between">
                        <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: on ? c.onGreen : c.ink }}>{t.title}</Text>
                        {t.badge ? (
                          <View style={{ paddingVertical: 4, paddingHorizontal: 9, borderRadius: 99, backgroundColor: on ? "#FFFFFF" : c.greenTint }}>
                            <Text style={{ fontFamily: FONTS.displayBold, fontSize: 10.5, color: c.dark ? c.green : c.greenDeep }}>{t.badge}</Text>
                          </View>
                        ) : null}
                      </Row>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: on ? c.greenTint : c.ink2 }}>{t.desc}</Text>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 12, marginTop: 2, color: on ? c.greenTint : c.ink2 }}>
                        {n} savol · ~{Math.max(1, Math.round(n * t.perItem))} daq
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
              <Text style={eyebrow(c)}>So'z manbasi</Text>
              <View style={{ gap: 7 }}>
                <Source label={`Hamma o'rganilgan · ${learned.length}`} on={source === "all"} onPress={() => setSource("all")} />
                <Source label={`Faqat qiyin so'zlar · ${weak.length}`} on={source === "weak"} disabled={!weak.length} onPress={() => setSource("weak")} />
                <Source label="Tanlangan kunlar" on={source === "days"} onPress={() => setSource("days")} />
              </View>
              {source === "days" ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  {doneDays.map((day) => {
                    const on = pickedDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => { tapped(); setPickedDays(on ? pickedDays.filter((d) => d !== day) : [...pickedDays, day]); }}
                        style={{ width: 44, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.green : c.tint }}
                      >
                        <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: on ? c.onGreen : c.ink2 }}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Text style={eyebrow(c)}>Savol soni</Text>
              <Segmented options={[10, 20, 40].map((n) => ({ value: n, label: String(n) }))} value={count} onChange={setCount} />
              <Row gap={14} style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: c.tint2 }}>
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: c.ink }}>Vaqt chegarasi · 20s</Text>
                <Toggle value={timed} onChange={setTimed} />
              </Row>
            </View>
          </ScrollView>
          <View style={{ paddingHorizontal: 18, paddingBottom: 26, paddingTop: 4 }}>
            <Button title={questions ? "Mashqni boshlash" : "Bu tanlovda so'z yo'q"} disabled={!questions} onPress={start} />
          </View>
        </>
      )}
    </Screen>
  );
}

function Source({ label, on, onPress, disabled }) {
  const c = useColors();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tapped(); onPress(); }}
      style={{ paddingVertical: 12, paddingHorizontal: 15, borderRadius: 13, backgroundColor: on ? c.green : c.tint, opacity: disabled ? 0.5 : 1 }}
    >
      <Text style={{ fontFamily: on ? FONTS.bold : FONTS.semi, fontSize: 14, color: on ? c.onGreen : c.ink }}>{label}</Text>
    </Pressable>
  );
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
