// 10 — Dars. One lesson of the path: its thirty words in three sections of ten, where it stands, and the button
// that learns the next section's words not met yet — or, once all are met, practises them. The lessons either
// side are one tap away.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Kicker, Note, Pill, Row, Screen, Ticks, Title, tapped } from "../ui";
import { gradeName, lessonAction, lessonProgress, openLesson } from "../model";
import WordSheet from "./WordSheet";

const PILL = { done: "o'rganilgan", mastered: "o'zlashtirilgan", current: "hozirgi", open: "ochiq" };

export default function Lesson({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [word, setWord] = useState(null);
  if (!state || !course || !course.lessonCount) return null;

  const n = Math.max(1, Math.min(course.lessonCount, Number(route.params?.lesson) || 1));
  const progress = lessonProgress(state, course, n);
  const go = (to) => { tapped(); navigation.setParams({ lesson: to }); };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 10 }}>
        <BackLink label="Kurs" onPress={() => navigation.goBack()} />
        <Row justify="space-between" align="flex-end" gap={12}>
          <View style={{ flex: 1, gap: 2 }}>
            <Kicker c="ink2">{n}-dars / {course.lessonCount} · {gradeName(progress.lesson.grade)}</Kicker>
            <Title size={26}>{progress.title}</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>
              {progress.learned} / {progress.words} so'z o'rganilgan{progress.themes.length ? ` · ${progress.themes.join(" · ")}` : ""}
            </Text>
          </View>
          <Pill label={PILL[progress.status]} tone={progress.status === "open" ? "tint" : "green"} />
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 13 }} showsVerticalScrollIndicator={false}>
        {progress.sections.map((section) => (
          <View key={section.n} style={{ gap: 8 }}>
            <Row justify="space-between" style={{ paddingHorizontal: 4, paddingTop: section.n > 1 ? 6 : 0 }}>
              <Text style={{ fontSize: 15.5, fontWeight: "800", color: c.ink }}>
                {section.n}-bo'lim{section.title ? <Text style={{ fontFamily: FONTS.body, fontWeight: "400", color: c.ink2 }}> · {section.title}</Text> : null}
              </Text>
              <Text style={{ fontFamily: FONTS.semi, fontSize: 12, color: section.learned === section.ids.length ? c.green : c.ink2 }}>
                {section.learned}/{section.ids.length}
              </Text>
            </Row>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5 }}>
              {section.ids.map((id) => course.byId[id]).filter(Boolean).map((w) => {
                const weak = srs.isWeak(state, w.id);
                return (
                  <View key={w.id} style={{ width: "50%", padding: 4.5 }}>
                    <Pressable
                      onPress={() => { tapped(); setWord(w.id); }}
                      style={({ pressed }) => [{ backgroundColor: c.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 15, gap: 5, opacity: pressed ? 0.85 : 1 }]}
                    >
                      <Text style={{ fontSize: 21, fontWeight: "700", color: c.ink }} numberOfLines={1}>{w.ko}</Text>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: weak ? c.danger : c.ink2 }} numberOfLines={1}>{w.uz}</Text>
                      <View style={{ marginTop: 2 }}><Ticks level={srs.mastery(state, w.id)} weak={weak} /></View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Note title="Qanday o'rganiladi">
          Dars 3 bo'limdan iborat, har birida 10 so'z — bo'limlar orasida tanaffus qilsa bo'ladi. Bo'lim ichida avval
          5 ta so'z bilan tanishib darhol mashq qilasiz, keyin qolgan 5 tasi, oxirida aralash test. So'zlar 1, 3, 7, 14
          va 30 kundan keyin takrorlashga qaytadi. Takrorlashda so'zni ikki marta yozib to'g'ri topsangiz, u muddatidan
          oldin o'zlashtirilgan hisoblanadi.
        </Note>

        <Row justify="space-between" style={{ paddingHorizontal: 4 }}>
          {n > 1 ? (
            <Pressable hitSlop={8} onPress={() => go(n - 1)}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 13.5, color: c.green }}>‹ {n - 1}-dars</Text>
            </Pressable>
          ) : <View />}
          {n < course.lessonCount ? (
            <Pressable hitSlop={8} onPress={() => go(n + 1)}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 13.5, color: c.green }}>{n + 1}-dars ›</Text>
            </Pressable>
          ) : null}
        </Row>
      </ScrollView>

      <View style={{ paddingHorizontal: 18, paddingBottom: 26, paddingTop: 4 }}>
        <Button title={lessonAction(progress)} onPress={() => openLesson(navigation, state, course, n)} />
      </View>

      <WordSheet id={word} onClose={() => setWord(null)} navigation={navigation} />
    </Screen>
  );
}
