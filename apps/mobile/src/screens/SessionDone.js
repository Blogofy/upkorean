// 20 — Sessiya yakuni. After a review or a practice round: the accuracy dial, what it earned, what to fix.
import { ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Bar, Button, Col, Note, RingStat, Row, Screen, Stat, Title } from "../ui";

const TYPE_LABEL = { ...srs.TYPE_NAMES, card: "Flashcard", match: "Juftlash" };

export default function SessionDone({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const outcome = route.params?.outcome || {};
  if (!store.state) return null;

  const review = outcome.kind === "review";
  const answered = (outcome.ok || 0) + (outcome.bad || 0);
  const missed = outcome.missed || [];
  const streak = srs.streak(store.state);
  const home = () => navigation.navigate("Tabs", { screen: "Today" });

  return (
    <Screen edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingBottom: 26, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 30, alignItems: "center", gap: 8 }}>
          <RingStat value={outcome.accuracy || 0} total={100} size={104} width={10} sub="aniqlik" track={c.line} />
          <Title size={27} style={{ marginTop: 6 }}>{review ? "Takrorlash tugadi" : "Mashq tugadi"}</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, color: c.ink2, textAlign: "center" }}>
            {answered} ta javobdan {outcome.ok || 0} tasi to'g'ri · {outcome.minutes || 1} daqiqa
          </Text>
        </View>

        <Row gap={9}>
          <Stat value={`+${outcome.xp || 0}`} label="XP" size={23} style={{ borderRadius: 18, paddingHorizontal: 12, paddingVertical: 15 }} />
          <Stat value={String(streak)} label="kun seriya" size={23} style={{ borderRadius: 18, paddingHorizontal: 12, paddingVertical: 15 }} />
          <Stat value={String(outcome.bad || 0)} label="xato" tone={outcome.bad ? "bad" : null} size={23} style={{ borderRadius: 18, paddingHorizontal: 12, paddingVertical: 15 }} />
        </Row>

        {missed.length ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Xato qilingan so'zlar</Text>
            <Col gap={10}>
              {missed.slice(0, 6).map((word) => (
                <Row key={word.id} gap={12}>
                  <Text style={{ minWidth: 72, fontSize: 18, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }} numberOfLines={1}>{word.uz}</Text>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: c.danger }}>{word.times} xato</Text>
                </Row>
              ))}
            </Col>
          </View>
        ) : null}

        {Object.keys(outcome.byType || {}).length > 1 ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 11 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Mashq turlari bo'yicha</Text>
            {Object.entries(outcome.byType)
              .sort((a, b) => b[1].bad - a[1].bad)
              .map(([type, row]) => {
                const all = row.ok + row.bad;
                return (
                  <Row key={type} gap={12}>
                    <Text style={{ width: 118, fontFamily: FONTS.body, fontSize: 13.5, color: c.ink }} numberOfLines={1}>{TYPE_LABEL[type] || type}</Text>
                    <Bar value={row.ok} total={all} height={8} track={row.bad ? c.dangerTint : c.tint2} style={{ flex: 1 }} />
                    <Text style={{ minWidth: 40, textAlign: "right", fontFamily: FONTS.bold, fontSize: 13, color: row.bad ? c.danger : c.ink }}>{row.ok}/{all}</Text>
                  </Row>
                );
              })}
          </View>
        ) : null}

        {missed.length && outcome.kind !== "quiz" ? <Note>Xato qilingan so'zlar ertaga birinchi bo'lib chiqadi.</Note> : null}

        <View style={{ flex: 1, minHeight: 12 }} />
        <Col gap={10}>
          {missed.length ? (
            <Button
              title={`${missed.length} ta xatoni hozir tuzatish`}
              onPress={() => navigation.replace("Session", {
                kind: "quiz", quizType: "mixed", title: "Xatolarni tuzatish", ids: missed.map((w) => w.id), count: missed.length * 2,
              })}
            />
          ) : null}
          <Button title="Bosh sahifa" kind={missed.length ? "white" : "primary"} onPress={home} />
        </Col>
      </ScrollView>
    </Screen>
  );
}
