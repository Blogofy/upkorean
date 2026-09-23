// 10 — Kun tafsiloti. One day: its words, its stages, and the button that starts the next one.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Feather, Kicker, Note, Pill, Row, Screen, Ticks, Title, tapped } from "../ui";
import { dayLine, dayProgress, openStage } from "../model";
import WordSheet from "./WordSheet";

export default function Day({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [all, setAll] = useState(false);
  const [word, setWord] = useState(null);
  if (!state || !course) return null;

  const day = Math.max(1, Math.min(course.dayCount, Number(route.params?.day) || 1));
  const progress = dayProgress(state, course, day);
  const status = srs.dayStatus(state, course, day);
  const current = srs.currentDay(state, course);
  const words = course.days[day] || [];
  const shown = all ? words : words.slice(0, 4);
  const locked = status === "locked";

  const pill = progress.done ? "bajarildi" : day === current ? "bugun" : locked ? "yopiq" : "ochiq";
  const cta = locked ? "Avval oldingi kunlar" : progress.done ? "Kunni qayta mashq qilish" : progress.stageIdx ? "Davom etish" : "Boshlash";

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 10 }}>
        <BackLink label={`${course.dayCount} kunlik kurs`} onPress={() => navigation.goBack()} />
        <Row justify="space-between" align="flex-end" gap={12}>
          <View style={{ flex: 1, gap: 2 }}>
            <Kicker c="ink2">{day}-kun / {course.dayCount}</Kicker>
            <Title size={26}>{progress.title}</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{dayLine(progress)}</Text>
          </View>
          <Pill label={pill} tone={locked ? "tint" : "green"} />
        </Row>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 13 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5 }}>
          {shown.map((w) => {
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
        {words.length > 4 ? (
          <Pressable onPress={() => { tapped(); setAll(!all); }} hitSlop={8} style={{ alignSelf: "flex-start", paddingLeft: 4 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 13.5, color: c.green }}>{all ? "Kamroq ko'rsatish" : `Barcha ${words.length} so'zni ko'rish`}</Text>
          </Pressable>
        ) : null}

        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 13 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Kun bosqichlari</Text>
          <View style={{ gap: 10 }}>
            {progress.plan.stages.map((stage, i) => {
              const done = i < progress.stageIdx;
              const now = i === progress.stageIdx && !progress.done;
              return (
                <Row key={i} gap={12}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
                    backgroundColor: done ? c.green : now ? c.greenTint : c.tint2,
                  }}>
                    {done
                      ? <Feather name="check" size={13} color={c.onGreen} />
                      : <Text style={{ fontFamily: now ? FONTS.displayBold : FONTS.bold, fontSize: 12, color: now ? c.greenDeep : c.ink2 }}>{i + 1}</Text>}
                  </View>
                  <Text style={{ flex: 1, fontFamily: now ? FONTS.bold : FONTS.body, fontSize: 14, color: now ? c.ink : c.ink2 }}>{stage.label}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{stage.minutes} daq</Text>
                </Row>
              );
            })}
          </View>
        </View>

        <Note title="Oraliqli takrorlash">
          Bugungi so'zlar 1, 3, 7 va 16-kunlarda avtomatik qaytariladi. Xato qilgan so'z ertaga yana chiqadi.
        </Note>
      </ScrollView>

      <View style={{ paddingHorizontal: 18, paddingBottom: 26, paddingTop: 4 }}>
        <Button
          title={cta}
          disabled={locked || (progress.done && !words.some((w) => srs.isLearned(state, w.id)))}
          onPress={() => openStage(navigation, state, course, day)}
        />
      </View>

      <WordSheet id={word} onClose={() => setWord(null)} navigation={navigation} />
    </Screen>
  );
}
