// 30 — UpKorean Premium. What the paid plan adds and what it costs. Payment is not connected yet, so the
// button says so rather than pretending to take money; everything in the app stays open meanwhile.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Feather, Radio, Row, Screen, Title, tapped } from "../ui";

const ROWS = [
  ["Kunlik dars", "1", "Cheksiz"],
  ["Erkin mashqlar", "kuniga 1", "Cheksiz"],
  ["Barcha darajalar", "초급", "3 ta"],
  ["Oflayn yuklab olish", false, true],
  ["Seriya himoyasi", false, "oyiga 2"],
];

const PLANS = [
  { id: "year", title: "Yillik", sub: "oyiga 24 000 so'm · 2 oy bepul", price: "288 000", per: "so'm / yil" },
  { id: "month", title: "Oylik", sub: "istalgan payt bekor qilasiz", price: "34 000", per: "so'm / oy" },
];

export default function Paywall({ navigation }) {
  const c = useColors();
  const store = useStore();
  const [plan, setPlan] = useState("year");
  const chosen = PLANS.find((p) => p.id === plan);

  const cell = (value, premium) => {
    if (value === true) return <Feather name="check" size={16} color={c.green} />;
    if (value === false) return <Feather name="x" size={15} color={c.danger} />;
    return <Text style={{ fontFamily: premium ? FONTS.bold : FONTS.body, fontSize: 13, color: premium ? c.greenDeep : c.ink2, textAlign: "center" }}>{value}</Text>;
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <Row justify="space-between" style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14 }}>
        <Title size={26}>UpKorean Premium</Title>
        <Pressable
          accessibilityLabel="Yopish"
          hitSlop={10}
          onPress={() => { tapped(); navigation.goBack(); }}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="x" size={15} color={c.ink2} />
        </Pressable>
      </Row>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 14, gap: 13 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: c.card, borderRadius: 24, paddingVertical: 8, paddingHorizontal: 20 }}>
          <Row gap={10} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.tint2 }}>
            <Text style={{ flex: 1, fontFamily: FONTS.bold, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: c.ink4 }}>Imkoniyat</Text>
            <Text style={{ width: 62, fontFamily: FONTS.bold, fontSize: 11.5, color: c.ink4, textAlign: "center" }}>Bepul</Text>
            <Text style={{ width: 74, fontFamily: FONTS.displayBold, fontSize: 11.5, color: c.greenDeep, textAlign: "center" }}>Premium</Text>
          </Row>
          {ROWS.map(([label, free, premium], i) => (
            <Row key={label} gap={10} style={{ paddingVertical: 13, borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderBottomColor: c.tint }}>
              <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: c.ink }}>{label}</Text>
              <View style={{ width: 62, alignItems: "center" }}>{cell(free, false)}</View>
              <View style={{ width: 74, alignItems: "center" }}>{cell(premium, true)}</View>
            </Row>
          ))}
        </View>

        <View style={{ gap: 10 }}>
          {PLANS.map((p) => {
            const on = p.id === plan;
            return (
              <Pressable
                key={p.id}
                onPress={() => { tapped(); setPlan(p.id); }}
                style={{ padding: 18, borderRadius: 20, backgroundColor: on ? c.green : c.card, flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <Radio selected={on} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: on ? c.onGreen : c.ink }}>{p.title}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: on ? c.greenTint : c.ink2 }}>{p.sub}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: on ? c.onGreen : c.ink }}>{p.price}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: on ? c.greenTint : c.ink4 }}>{p.per}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 18, paddingBottom: 26, gap: 9 }}>
        <Button title="7 kun bepul sinash" onPress={() => store.say("To'lov tez orada ulanadi. Hozircha hamma imkoniyat ochiq.")} />
        <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink4, textAlign: "center" }}>
          Sinov tugagach {chosen.price} so'm. Oldin bekor qilsangiz to'lov yo'q.
        </Text>
      </View>
    </Screen>
  );
}
