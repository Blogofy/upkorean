// 19 — Takrorlash. Today's goal, the hand-picked lists, and a way into free practice.
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Chip, ListRow, RingStat, Row, Screen, TabHeader, tapped } from "../ui";
import { openReview } from "../model";

export default function Review({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  if (!state || !course) return null;

  const goal = srs.reviewGoal(state, course);
  const weak = srs.weakIds(state, course).length;
  const flagged = srs.flaggedIds(state, course).length;
  const forgot = srs.forgottenIds(state, course).length;
  const learned = srs.learnedIds(state, course).length;
  const extra = goal.left === 0 && goal.due > 0;
  const fresh = learned === 0;

  const lists = [
    { mode: "weak", n: weak, title: "Qiyin", sub: "2+ marta xato qilingan", action: "Mashq", bad: true },
    { mode: "flag", n: flagged, title: "Belgilangan", sub: "o'zingiz belgilagan", action: "Mashq" },
    { mode: "forgot", n: forgot, title: "Unutilgan", sub: "darajasi pasaygan", action: "Qaytarish" },
  ];

  return (
    <Screen>
      <TabHeader title="Takrorlash" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 13 }} showsVerticalScrollIndicator={false}>
        {fresh ? (
          <View style={{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 10 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.ink4 }}>Hali boshlanmagan</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 21, lineHeight: 26, color: c.ink }}>Takrorlash ertadan boshlanadi</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>
              Bugun o'rgangan so'zlaringiz ertaga shu yerga qaytadi — keyin 3, 7 va 16-kunlarda yana.
            </Text>
            <Button title="1-kunni boshlash" size="md" style={{ marginTop: 6 }} onPress={() => navigation.navigate("Day", { day: srs.currentDay(state, course) })} />
          </View>
        ) : (
        <View style={{ backgroundColor: c.green, borderRadius: 26, padding: 22, gap: 16 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: c.greenTint }}>Bugungi maqsad</Text>
          <Row gap={16}>
            <RingStat value={goal.done} total={goal.done + goal.left || 1} size={62} onGreen />
            <View style={{ gap: 2, flex: 1 }}>
              <Row gap={7} align="baseline">
                <Text style={{ fontFamily: FONTS.display, fontSize: 34, lineHeight: 38, color: c.onGreen }}>{goal.left}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: c.greenTint }}>so'z</Text>
              </Row>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.greenTint }}>
                {goal.left
                  ? `~${goal.minutes} daqiqa${goal.late ? ` · ${goal.late} tasi kechikkan` : ""}`
                  : goal.done ? `Bugun ${goal.done} so'z takrorlandi` : "Bugun takrorlanadigan so'z yo'q"}
              </Text>
            </View>
          </Row>
          <Button
            title={goal.left ? "Boshlash" : extra ? `Yana ${Math.min(srs.EXTRA_ROUND, goal.due)} ta` : "Mashq qilish"}
            kind="inverse"
            size="md"
            onPress={() => (goal.left || extra ? openReview(navigation, "due", extra ? { extra: true } : {}) : navigation.navigate("Practice"))}
          />
        </View>
        )}

        {fresh ? null : (
        <View style={{ backgroundColor: c.card, borderRadius: 22, paddingVertical: 6, paddingHorizontal: 18 }}>
          {lists.map((list, i) => (
            <ListRow
              key={list.mode}
              last={i === lists.length - 1}
              left={<Text style={{ minWidth: 32, fontFamily: FONTS.display, fontSize: 22, color: list.bad && list.n ? c.danger : c.ink }}>{list.n}</Text>}
              title={list.title}
              sub={list.sub}
              right={list.n ? <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>{list.action}</Text> : null}
              onPress={list.n ? () => openReview(navigation, list.mode) : undefined}
              chevron={!!list.n}
            />
          ))}
        </View>
        )}

        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
          <Row justify="space-between" align="baseline">
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Mashq turlari</Text>
            <Pressable hitSlop={8} onPress={() => { tapped(); navigation.navigate("Practice"); }}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>Sozlamalar</Text>
            </Pressable>
          </Row>
          {learned ? (
            <Row gap={8} wrap>
              <Chip square tone="soft" label="Aralash · ~7 daq" onPress={() => navigation.navigate("Session", { kind: "quiz", quizType: "mixed", title: "Aralash mashq", count: 20 })} />
              <Chip square tone="tint" label="Flashcard" onPress={() => navigation.navigate("Session", { kind: "quiz", quizType: "card", title: "Flashcard", count: 20 })} />
              {store.audio ? <Chip square tone="tint" label="Eshitib topish" onPress={() => navigation.navigate("Session", { kind: "quiz", quizType: "listen", title: "Eshitib topish", count: 20 })} /> : null}
              <Chip square tone="tint" label="Yozish" onPress={() => navigation.navigate("Session", { kind: "quiz", quizType: "type", title: "Yozish", count: 20 })} />
              <Chip square tone="tint" label="Gap ichida" onPress={() => navigation.navigate("Session", { kind: "quiz", quizType: "sent", title: "Gap ichida", count: 20, ids: srs.learnedIds(state, course).filter((id) => course.examples[id]?.cloze) })} />
            </Row>
          ) : (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>Birinchi kundan keyin mashqlar shu yerda ochiladi.</Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
