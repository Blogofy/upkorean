// 28 — Daraja tugadi. The last lesson of a level is done: what it took, and the level after it. A level
// still being translated has only finished what is published so far, and says so instead.
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import * as srs from "@upkorean/shared/srs.js";
import { diffDays, today } from "@upkorean/shared/dates.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Col, Row, Screen, Stat, Title } from "../ui";
import { LEVEL_BLURB, levelInfo, nextLevel } from "../model";

export default function LevelDone({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [busy, setBusy] = useState(false);
  if (!state || !course) return null;

  const level = levelInfo(store.levels, course.level);
  const next = nextLevel(store.levels, course.level);
  const learned = srs.learnedIds(state, course).length;
  const firstDay = course.lessons.slice(1).map((lesson) => srs.lessonState(state, lesson.id).doneAt).filter(Boolean).sort()[0];
  const spent = firstDay ? diffDays(firstDay, today()) + 1 : 1;
  const home = () => navigation.navigate("Tabs", { screen: "Today" });

  const start = async () => {
    if (!next || next.locked) return;
    setBusy(true);
    try {
      await store.switchLevel(next.id);
      home();
    } catch (problem) {
      store.say(problem.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top", "bottom"]} style={{ backgroundColor: c.green }}>
      {/* White clock and battery on the green; the shell's own bar takes over again when this screen goes. */}
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingBottom: 26, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 40, alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 48, fontWeight: "900", letterSpacing: 2, color: "rgba(255,255,255,0.34)" }}>수료</Text>
          <Title size={31} c="#FFFFFF" style={{ textAlign: "center" }}>{level.ready ? `${level.ko} darajasi tugadi` : "Barcha ochiq darslar tugadi"}</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, lineHeight: 21, color: c.greenTint, textAlign: "center" }}>
            {learned} so'z, {course.lessonCount} dars.{!level.ready
              ? ` ${level.ko}ning qolgan ${Math.max(0, level.planned - course.words.length)} so'zi tayyorlanmoqda.`
              : next ? (next.locked ? ` ${next.ko} tez orada ochiladi.` : ` Endi ${next.ko} ochildi.`) : ""}
          </Text>
        </View>
        <View style={{ gap: 10, marginTop: 6 }}>
          <Row gap={10}>
            <Stat value={String(learned)} label="so'z o'rganildi" size={27} />
            <Stat value={`${spent} kun`} label="sarflandi" size={27} />
          </Row>
          <Row gap={10}>
            <Stat value={`${srs.accuracy(state) ?? 0}%`} label="o'rtacha aniqlik" size={27} />
            <Stat value={String(state.bestStreak || 0)} label="eng uzun seriya" size={27} />
          </Row>
        </View>
        {next ? (
          <Row gap={16} style={{ backgroundColor: c.card, borderRadius: 22, padding: 20 }}>
            <View style={{ width: 52, height: 52, borderRadius: 17, backgroundColor: c.greenTint, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.greenDeep }}>{next.ko}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 15.5, color: c.ink }}>Keyingi daraja — {next.uz}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>
                {next.locked ? "Tayyorlanmoqda · " : ""}{next.planned} yangi so'z · {LEVEL_BLURB[next.id].topic}
              </Text>
            </View>
          </Row>
        ) : null}
        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 5 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.ink }}>{level.ko} so'zlari yo'qolmaydi</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: c.ink2 }}>
            Ular takrorlash navbatida qoladi{next ? `, ${next.ko} bilan aralash keladi` : ""}.
          </Text>
        </View>
        <View style={{ flex: 1, minHeight: 12 }} />
        <Col gap={10}>
          {next && !next.locked ? <Button title={`${next.ko}ni boshlash`} kind="inverse" loading={busy} onPress={start} /> : null}
          <Button
            title={next && !next.locked ? `${level.ko}ni takrorlashda qoldirish` : "Bosh sahifa"}
            kind={next && !next.locked ? "clear" : "inverse"}
            textStyle={next && !next.locked ? { color: c.greenTint } : null}
            onPress={home}
          />
        </Col>
      </ScrollView>
    </Screen>
  );
}
