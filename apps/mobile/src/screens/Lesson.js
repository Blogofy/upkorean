// 10 — Dars. One lesson: its ten words, where it stands, and the button that starts it — or, once it is
// done, practises it again. The lessons either side are one tap away.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Kicker, Note, Pill, Row, Screen, Ticks, Title, tapped } from "../ui";
import { gradeName, lessonLine, lessonProgress, openLesson } from "../model";
import WordSheet from "./WordSheet";

const PILL = { done: "bajarildi", mastered: "o'zlashtirildi", current: "hozirgi", open: "ochiq" };

export default function Lesson({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [word, setWord] = useState(null);
  if (!state || !course || !course.lessonCount) return null;

  const n = Math.max(1, Math.min(course.lessonCount, Number(route.params?.lesson) || 1));
  const progress = lessonProgress(state, course, n);
  const words = progress.ids.map((id) => course.byId[id]).filter(Boolean);
  const cta = progress.done ? "Darsni mashq qilish" : progress.learned ? "Davom etish" : "Boshlash";
  const go = (to) => { tapped(); navigation.setParams({ lesson: to }); };

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 10 }}>
        <BackLink label="Kurs" onPress={() => navigation.goBack()} />
        <Row justify="space-between" align="flex-end" gap={12}>
          <View style={{ flex: 1, gap: 2 }}>
            <Kicker c="ink2">{n}-dars / {course.lessonCount} · {gradeName(progress.lesson.grade)}</Kicker>
            <Title size={26}>{progress.title}</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{lessonLine(progress)}</Text>
          </View>
          <Pill label={PILL[progress.status]} tone={progress.status === "open" ? "tint" : "green"} />
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 13 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5 }}>
          {words.map((w) => {
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

        <Note title="Dars qanday o'tadi">
          Avval 5 ta so'z bilan tanishasiz va darhol mashq qilasiz, keyin qolgan 5 tasi, oxirida hammasi aralash.
          So'zlar ertaga, keyin 3, 7 va 16 kundan keyin takrorlashga qaytadi.
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
        <Button
          title={cta}
          disabled={progress.done && !words.some((w) => srs.isLearned(state, w.id))}
          onPress={() => openLesson(navigation, state, course, n)}
        />
      </View>

      <WordSheet id={word} onClose={() => setWord(null)} navigation={navigation} />
    </Screen>
  );
}
