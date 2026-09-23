// 18 — Kun tugadi. A green screen: what the day took, when its words come back, and which went wrong.
import { ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Bar, Button, Col, Row, Screen, Stat, Title } from "../ui";
import { reviewBuckets } from "../model";

export default function DayDone({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const outcome = route.params?.outcome || {};
  if (!state || !course) return null;

  const day = outcome.day;
  const record = srs.dayState(state, day);
  const plan = srs.dayPlan(course, day);
  const answered = (record.ok || 0) + (record.bad || 0);
  const accuracy = answered ? srs.pct(record.ok || 0, answered) : outcome.accuracy || 0;
  const minutes = Math.max(1, Math.round(record.min || outcome.minutes || 1));
  const streak = srs.streak(state);
  const buckets = reviewBuckets(state, plan.words);
  const most = Math.max(1, ...buckets.map((b) => b.n));
  const missed = (outcome.missed || []).slice(0, 4);
  const levelDone = srs.courseDone(state, course);
  const home = () => navigation.navigate("Tabs", { screen: "Today" });

  return (
    <Screen edges={["top", "bottom"]} style={{ backgroundColor: c.green }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingBottom: 26, gap: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 36, alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 44, fontWeight: "900", letterSpacing: 2, color: "rgba(255,255,255,0.34)" }}>완료</Text>
          <Title size={32} c="#FFFFFF" style={{ textAlign: "center" }}>{day}-kun tugadi</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: c.greenTint, textAlign: "center" }}>
            {plan.words.length} so'z o'rganildi.{streak > 1 ? ` Seriya ${streak} kunga yetdi.` : ""}
          </Text>
        </View>

        <View style={{ gap: 10, marginTop: 6 }}>
          <Row gap={10}>
            <Stat value={`${accuracy}%`} label="aniqlik" />
            <Stat value={`${minutes} daq`} label="vaqt" />
          </Row>
          <Row gap={10}>
            <Stat value={`+${record.xp || outcome.xp || 0}`} label="XP" />
            <Stat value={String(outcome.missed?.length || 0)} label="zaif so'z" tone={outcome.missed?.length ? "bad" : null} />
          </Row>
        </View>

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
          {levelDone ? (
            <Button title="Darajani yakunlash" kind="inverse" onPress={() => navigation.replace("LevelDone")} />
          ) : outcome.missed?.length ? (
            <Button
              title={`${outcome.missed.length} ta zaif so'zni mashq qilish`}
              kind="inverse"
              onPress={() => navigation.replace("Session", {
                kind: "quiz", quizType: "mixed", title: "Zaif so'zlar", ids: outcome.missed.map((w) => w.id), count: outcome.missed.length * 2,
              })}
            />
          ) : null}
          <Button title="Bosh sahifa" kind={levelDone || outcome.missed?.length ? "clear" : "inverse"} textStyle={levelDone || outcome.missed?.length ? { color: c.greenTint } : null} onPress={home} />
        </Col>
      </ScrollView>
    </Screen>
  );
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
