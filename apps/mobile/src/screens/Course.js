// 09 — Kurs. Every day of the level as a grid, and the day in progress as a card under it.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import { Button, Kicker, Pill, Row, Screen, TabHeader, Title, tapped } from "../ui";
import { PHASE_OF, dayLine, dayProgress, levelInfo, openStage } from "../model";

const FIRST_ROWS = 18;

export default function Course({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [all, setAll] = useState(false);
  if (!state || !course) return null;

  const level = levelInfo(store.levels, course.level);
  const doneDays = srs.daysDone(state, course);
  const current = srs.currentDay(state, course);
  const days = Array.from({ length: course.dayCount }, (_, i) => i + 1);
  const shown = all ? days : days.slice(0, Math.max(FIRST_ROWS, Math.ceil(current / 6) * 6));
  const hidden = days.length - shown.length;
  const progress = dayProgress(state, course, current);
  const finished = srs.courseDone(state, course);

  const open = (day, status) => {
    if (status === "locked") { store.say("Avval oldingi kunlarni tugating"); return; }
    tapped();
    navigation.navigate("Day", { day });
  };

  return (
    <Screen>
      <TabHeader
        title="Kurs"
        subtitle={`${level.ko} · ${doneDays} / ${course.dayCount} kun  ·  darajani almashtirish ›`}
        onSubtitle={() => { tapped(); navigation.navigate("LevelSwitch"); }}
        right={
          <Pressable onPress={() => { tapped(); navigation.navigate("LevelSwitch"); }} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 99, backgroundColor: c.card }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>{level.ko}</Text>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: c.ink2 }}>▾</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 18, gap: 14 }}>
          <Row justify="space-between">
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>{course.dayCount} kunlik reja</Text>
            <Row gap={12}>
              <Legend color={c.green} label="tugagan" />
              <Legend color={c.line} label="yopiq" />
            </Row>
          </Row>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
            {shown.map((day) => {
              const status = srs.dayStatus(state, course, day);
              const isCurrent = day === current && !finished;
              const done = status === "completed" || status === "mastered";
              const bg = isCurrent ? c.greenDeep : done ? c.green : status === "locked" ? c.line : c.tint;
              const fg = isCurrent || done ? (c.dark && isCurrent ? c.card : c.onGreen) : status === "locked" ? c.ink2 : c.ink2;
              return (
                <View key={day} style={{ width: `${100 / 6}%`, padding: 4 }}>
                  <Pressable
                    onPress={() => open(day, status)}
                    style={({ pressed }) => [{
                      height: 44, borderRadius: 13, backgroundColor: bg, alignItems: "center", justifyContent: "center",
                      borderWidth: isCurrent ? 3 : 0, borderColor: c.greenLine, opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: isCurrent ? FONTS.displayBold : done ? FONTS.bold : FONTS.semi, fontSize: 14, color: fg }}>{day}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {hidden > 0 || all ? (
            <Pressable onPress={() => { tapped(); setAll(!all); }} hitSlop={8}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{all ? "Qisqartirish" : `+ yana ${hidden} kun`}</Text>
            </Pressable>
          ) : null}
        </View>

        {finished ? null : (
          <View style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 16 }, shadow(c, 2)]}>
            <Row justify="space-between" align="flex-start" gap={12}>
              <View style={{ flex: 1, gap: 3 }}>
                <Kicker>{current}-kun · bugun</Kicker>
                <Title size={23}>{progress.title}</Title>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{dayLine(progress)}</Text>
              </View>
              <Pill label={`${Math.min(progress.stageIdx + 1, progress.plan.stages.length)} / ${progress.plan.stages.length}`} tone="green" />
            </Row>
            <PhasePills progress={progress} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {(course.days[current] || []).slice(0, 4).map((word) => (
                <View key={word.id} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
                </View>
              ))}
              {(course.days[current] || []).length > 4 ? (
                <View style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint, justifyContent: "center" }}>
                  <Text style={{ fontFamily: FONTS.semi, fontSize: 13, color: c.ink2 }}>+{course.days[current].length - 4}</Text>
                </View>
              ) : null}
            </View>
            <Button title={progress.stageIdx ? "Davom etish" : "Boshlash"} size="md" onPress={() => openStage(navigation, state, course, current)} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function Legend({ color, label }) {
  const c = useColors();
  return (
    <Row gap={5}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: c.ink2 }}>{label}</Text>
    </Row>
  );
}

// "✓ tanishish · faol eslash · kun testi": which of the day's three kinds of work is behind, which is now.
export function PhasePills({ progress }) {
  const c = useColors();
  const current = progress.stage ? PHASE_OF[progress.stage.kind] : null;
  const phases = ["tanishish", "faol eslash", "kun testi"];
  const order = phases.indexOf(current);
  return (
    <Row gap={8}>
      {phases.map((phase, i) => {
        const now = phase === current;
        const past = progress.done || (order >= 0 && i < order);
        return (
          <View key={phase} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: now ? c.green : past ? c.greenTint : c.tint }}>
            <Text style={{ fontFamily: now || past ? FONTS.bold : FONTS.semi, fontSize: 12, color: now ? c.onGreen : past ? c.greenDeep : c.ink2 }}>
              {past ? "✓ " : ""}{phase}
            </Text>
          </View>
        );
      })}
    </Row>
  );
}
