// 24 — Natijalar, the root of the "Ko'proq" tab: the three numbers, fourteen days of study, how the
// learned words sit on the ladder, and the doors to achievements, practice, the profile and Premium.
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Bar, Feather, ListRow, Row, Screen, Stat, TabHeader, tapped } from "../ui";
import { badgeView, initial, lastDays } from "../model";
import { Star } from "./WordSheet";

export default function Results({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  if (!state || !course) return null;

  const learned = srs.learnedIds(state, course).length;
  const accuracy = srs.accuracy(state);
  const streak = srs.streak(state);
  const days = lastDays(state, 14);
  const active = days.filter((d) => d.minutes >= 1);
  const average = active.length ? Math.round(active.reduce((sum, d) => sum + d.minutes, 0) / active.length) : 0;
  const most = Math.max(1, ...days.map((d) => d.minutes));
  const breakdown = srs.masteryBreakdown(state, course);
  const { unlocked, total } = badgeView(state, course);
  const levels = [
    { label: "O'zlashtirilgan", n: breakdown.mastered, color: c.green },
    { label: "Mustahkam", n: breakdown.solid, color: c.greenMid },
    { label: "Yangi", n: breakdown.fresh, color: c.greenPale },
    { label: "Qiyin", n: breakdown.weak, color: c.danger, bad: true },
  ];

  return (
    <Screen>
      <TabHeader
        title="Natijalar"
        right={
          <Pressable
            accessibilityLabel="Profil"
            onPress={() => { tapped(); navigation.navigate("Profile"); }}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.green, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: c.onGreen }}>{initial(state.profile.name)}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 13 }} showsVerticalScrollIndicator={false}>
        <Row gap={10}>
          <Stat value={String(learned)} label="so'z o'rganildi" size={27} />
          <Stat value={accuracy === null ? "—" : `${accuracy}%`} label="o'rtacha aniqlik" size={27} />
          <Stat value={String(streak)} label="kunlik seriya" size={27} inverse />
        </Row>

        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
          <Row justify="space-between" align="baseline">
            <Text style={eyebrow(c)}>Oxirgi 14 kun</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{average ? `o'rtacha ${average} daq` : "hali faollik yo'q"}</Text>
          </Row>
          <Row gap={4} align="flex-end" style={{ height: 92 }}>
            {days.map((d, i) => {
              const recent = i >= days.length - 3;
              return (
                <View
                  key={d.key}
                  style={{
                    flex: 1, borderRadius: 4,
                    height: `${Math.max(8, (d.minutes / most) * 100)}%`,
                    backgroundColor: d.minutes < 1 ? c.line : d.today ? c.greenDeep : recent ? c.green : c.greenLine,
                  }}
                />
              );
            })}
          </Row>
        </View>

        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 15 }}>
          <Text style={eyebrow(c)}>O'zlashtirish darajasi</Text>
          <View style={{ gap: 12 }}>
            {levels.map((level) => (
              <Row key={level.label} gap={12}>
                <Text style={{ width: 104, fontFamily: FONTS.body, fontSize: 13.5, color: level.bad ? c.danger : c.ink }}>{level.label}</Text>
                <Bar value={level.n} total={Math.max(1, breakdown.total)} height={10} color={level.color} track={c.tint2} style={{ flex: 1 }} />
                <Text style={{ minWidth: 34, textAlign: "right", fontFamily: FONTS.bold, fontSize: 13, color: level.bad ? c.danger : c.ink }}>{level.n}</Text>
              </Row>
            ))}
          </View>
        </View>

        <View style={{ backgroundColor: c.card, borderRadius: 22, paddingVertical: 4, paddingHorizontal: 18 }}>
          <ListRow
            left={<IconBox><Star color={c.greenDeep} size={22} /></IconBox>}
            title="Yutuqlar"
            sub={`${unlocked} / ${total} ochilgan`}
            onPress={() => navigation.navigate("Achievements")}
          />
          <ListRow
            left={<IconBox><Feather name="target" size={20} color={c.greenDeep} /></IconBox>}
            title="Mashqlar"
            sub="turi va so'z manbasini o'zingiz tanlaysiz"
            onPress={() => navigation.navigate("Practice")}
          />
          <ListRow
            left={<IconBox><Feather name="user" size={20} color={c.greenDeep} /></IconBox>}
            title="Profil va sozlamalar"
            sub="kunlik yuk, eslatma, tungi rejim"
            onPress={() => navigation.navigate("Profile")}
          />
          <ListRow
            last
            left={<IconBox><Feather name="award" size={20} color={c.greenDeep} /></IconBox>}
            title="UpKorean Premium"
            sub="uchala daraja, cheksiz mashq"
            onPress={() => navigation.navigate("Paywall")}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function IconBox({ children }) {
  const c = useColors();
  return <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.greenTint, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
