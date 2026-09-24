// 18 — Dars tugadi. A green screen after a sitting. Mid-lesson it says which part is done and offers the next
// one or a break — the lesson carries on from there whenever the learner comes back. Once today's lesson is
// done it says what the day took and when its words come back, and offers ten more words straight away: the
// moment someone is most willing to do more is right now.
import { ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Bar, Button, Col, Row, Screen, Stat, Title } from "../ui";
import { reviewBuckets, todayGoal } from "../model";

export default function LessonDone({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const outcome = route.params?.outcome || {};
  if (!state || !course) return null;

  const lesson = srs.todayLesson(state, course);
  const partOnly = !lesson.done;
  const streak = srs.streak(state);
  const daily = todayGoal(state);
  const buckets = reviewBuckets(state, lesson.ids);
  const most = Math.max(1, ...buckets.map((b) => b.n));
  const missed = (outcome.missed || []).slice(0, 4);
  const levelDone = srs.courseDone(state, course);
  const home = () => navigation.navigate("Tabs", { screen: "Today" });
  const goalLine = daily.done
    ? `Bugungi reja bajarildi: ${daily.learned} so'z.`
    : `Bugun ${daily.learned} / ${daily.goal} so'z — rejagacha ${daily.left} ta.`;
  const title = partOnly ? `${lesson.sittingsDone}-qism tugadi` : outcome.extra ? "Yana 10 so'z o'rganildi" : "Bugungi dars tugadi";

  return (
    <Screen edges={["top", "bottom"]} style={{ backgroundColor: c.green }}>
      {/* White clock and battery on the green; the shell's own bar takes over again when this screen goes. */}
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingBottom: 26, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 36, alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 44, fontWeight: "900", letterSpacing: 2, color: "rgba(255,255,255,0.34)" }}>완료</Text>
          <Title size={32} c="#FFFFFF" style={{ textAlign: "center" }}>{title}</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, lineHeight: 21, color: c.greenTint, textAlign: "center" }}>
            {partOnly
              ? `Bugungi dars · ${lesson.sittingsDone}/${lesson.sittings.length} qism. Tanaffus qilsangiz ham bo'ladi — dars shu joydan davom etadi.`
              : `${goalLine}${streak > 1 ? ` Seriya: ${streak} kun.` : ""}`}
          </Text>
        </View>

        <View style={{ gap: 10, marginTop: 6 }}>
          <Row gap={10}>
            <Stat value={`${outcome.accuracy || 0}%`} label="aniqlik" />
            <Stat value={`${outcome.minutes || 1} daq`} label="vaqt" />
          </Row>
          <Row gap={10}>
            <Stat value={`+${outcome.xp || 0}`} label="XP" />
            <Stat value={String(outcome.missed?.length || 0)} label="zaif so'z" tone={outcome.missed?.length ? "bad" : null} />
          </Row>
        </View>

        {partOnly ? null : (
        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
          <Text style={eyebrow(c)}>Keyingi takrorlash rejasi</Text>
          <Col gap={9}>
            {buckets.map((bucket) => (
              <Row key={bucket.label} gap={12}>
                <Text style={{ width: 76, fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>{bucket.label}</Text>
                <Bar value={bucket.n} total={most} height={8} track={c.tint2} style={{ flex: 1 }} />
                <Text style={{ minWidth: 26, textAlign: "right", fontFamily: FONTS.bold, fontSize: 13, color: c.ink }}>{bucket.n}</Text>
              </Row>
            ))}
          </Col>
        </View>
        )}

        {missed.length ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 11 }}>
            <Text style={eyebrow(c)}>Qayta ko'rish kerak</Text>
            {missed.map((word) => (
              <Row key={word.id} gap={12}>
                <Text style={{ minWidth: 70, fontSize: 17, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }} numberOfLines={1}>{word.uz}</Text>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 12.5, color: c.danger }}>{word.times} xato</Text>
              </Row>
            ))}
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 12 }} />
        <Col gap={10}>
          {partOnly ? (
            <Button
              title={`${lesson.sittingsDone + 1}-qismni boshlash`}
              kind="inverse"
              onPress={() => navigation.replace("Session", { kind: "learn" })}
            />
          ) : levelDone ? (
            <Button title="Darajani yakunlash" kind="inverse" onPress={() => navigation.replace("LevelDone")} />
          ) : lesson.extra.length ? (
            <Button title="Yana 10 so'z" kind="inverse" onPress={() => navigation.replace("Session", { kind: "learn", extra: true })} />
          ) : null}
          {outcome.missed?.length ? (
            <Button
              title={`${outcome.missed.length} ta zaif so'zni mashq qilish`}
              kind="clear"
              textStyle={{ color: "#FFFFFF" }}
              onPress={() => navigation.replace("Session", {
                kind: "quiz", quizType: "mixed", title: "Zaif so'zlar", ids: outcome.missed.map((w) => w.id), count: outcome.missed.length * 2,
              })}
            />
          ) : null}
          <Button title={partOnly ? "Tanaffus — keyinroq" : "Bosh sahifa"} kind="clear" textStyle={{ color: c.greenTint }} onPress={home} />
        </Col>
      </ScrollView>
    </Screen>
  );
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
