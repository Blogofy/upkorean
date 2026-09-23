// 08 — Bugun. The screen the app opens on: today's day and where it stands, the review waiting, the week,
// and the course as a strip. When yesterday went by without a lesson (31), a card says so first.
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import * as srs from "@upkorean/shared/srs.js";
import { fmtDayMonth, fmtLong, today } from "@upkorean/shared/dates.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import { Button, Col, Feather, Kicker, Pill, RingStat, Row, Screen, Segments, Title, Txt, tapped } from "../ui";
import { dayLine, dayProgress, firstName, levelInfo, openReview, openStage } from "../model";

export const Flame = ({ size = 15, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 1.5 1.5 2.5 2.5 2.5C12 8 11 6 12 3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function Today({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [hideMissed, setHideMissed] = useState(false);
  if (!state || !course) return null;

  const now = today();
  const level = levelInfo(store.levels, course.level);
  const streak = srs.streak(state, now);
  const goal = srs.reviewGoal(state, course, now);
  const week = srs.weekRhythm(state, now);
  const doneDays = srs.daysDone(state, course);
  const finished = srs.courseDone(state, course);
  const day = srs.currentDay(state, course);
  const progress = dayProgress(state, course, day);
  const missed = !hideMissed && !(state.act[now] && (state.act[now].learned || state.act[now].reviewed))
    ? srs.missedYesterday(state, course, now) : null;
  const lastDone = day > 1 ? srs.dayState(state, day - 1) : null;
  const doneToday = !!(lastDone && lastDone.done && lastDone.doneAt === now);
  // Nothing learned yet: there is nothing to review, and "bugun bajarildi" would praise work not done.
  const fresh = srs.learnedIds(state, course).length === 0;

  return (
    <Screen>
      <Row justify="space-between" style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
        <View style={{ gap: 1, flex: 1 }}>
          <Text style={{ fontFamily: FONTS.semi, fontSize: 13, color: c.ink2 }}>{fmtLong(now)}</Text>
          <Title>Salom, {firstName(state.profile.name)}</Title>
        </View>
        <Pressable
          onPress={() => { tapped(); navigation.navigate("More", { screen: "Achievements" }); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 99, backgroundColor: c.green }}
        >
          <Flame color={c.onGreen} />
          <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.onGreen }}>{streak}</Text>
        </Pressable>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        {store.offline || store.syncError ? <SyncBanner onPress={() => navigation.navigate("Offline")} /> : null}

        {missed ? (
          <MissedCard
            missed={missed}
            best={state.bestStreak}
            due={goal.due}
            onDo={() => openStage(navigation, state, course, day)}
            onSkip={() => setHideMissed(true)}
          />
        ) : null}

        {finished ? (
          <View style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 14 }, shadow(c, 1)]}>
            <Kicker>{level.ko} · tugadi</Kicker>
            <Title size={23}>Daraja tugatildi</Title>
            <Txt t="bodySm" c="ink2">{course.words.length} so'z o'rganildi. Takrorlash davom etadi.</Txt>
            <Button title="Keyingi daraja" size="md" onPress={() => navigation.navigate("LevelDone")} />
          </View>
        ) : (
          <DayCard
            day={day}
            dayCount={course.dayCount}
            progress={progress}
            doneToday={doneToday}
            onOpen={() => navigation.navigate("Day", { day })}
            onStart={() => openStage(navigation, state, course, day)}
          />
        )}

        <Row gap={12} align="stretch">
          <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
            <Text style={label(c)}>Takrorlash</Text>
            <Row gap={12}>
              <RingStat value={goal.done} total={goal.done + goal.left || 1} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.display, fontSize: 26, lineHeight: 29, color: c.ink }}>{fresh ? "—" : goal.left}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>
                  {fresh ? "ertadan boshlanadi" : goal.left ? `so'z · ~${goal.minutes} daq` : goal.done ? "bugun bajarildi" : "bugun so'z yo'q"}
                </Text>
              </View>
            </Row>
            <Button
              title={goal.left ? "Boshlash" : "Takrorlash"}
              size="sm"
              kind={goal.left ? "primary" : "tint"}
              disabled={fresh}
              onPress={() => (goal.left ? openReview(navigation) : navigation.navigate("Review"))}
            />
          </View>
          <View style={{ width: 132, backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 12 }}>
            <Text style={label(c)}>Hafta</Text>
            <Row gap={4} style={{ flex: 1 }}>
              {week.map((d) => (
                <View
                  key={d.key}
                  style={{
                    flex: 1, height: 34, borderRadius: 99,
                    backgroundColor: d.active ? (d.today ? c.greenDeep : c.green) : d.future ? c.future : c.greenLine,
                  }}
                />
              ))}
            </Row>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{week.filter((d) => d.active).length} / 7 kun</Text>
          </View>
        </Row>

        <Pressable
          onPress={() => { tapped(); navigation.navigate("Course"); }}
          style={({ pressed }) => [{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{ flex: 1, gap: 7 }}>
            <Row gap={7} align="baseline">
              <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.ink }}>Kurs</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{level.ko} · {doneDays} / {course.dayCount} kun</Text>
            </Row>
            <Segments
              total={20}
              filled={Math.round((doneDays / Math.max(1, course.dayCount)) * 20)}
              current={finished ? -1 : Math.min(19, Math.floor(((day - 1) / Math.max(1, course.dayCount)) * 20))}
            />
          </View>
          <Feather name="chevron-right" size={16} color={c.ink4} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const label = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink4 });

// The day card: the stage just finished, the one to do now (open, green), and the one after it.
function DayCard({ day, dayCount, progress, doneToday, onOpen, onStart }) {
  const c = useColors();
  const { plan, stageIdx } = progress;
  const shown = [stageIdx - 1, stageIdx, stageIdx + 1].filter((i) => i >= 0 && i < plan.stages.length);
  return (
    <Pressable onPress={onOpen} style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 18 }, shadow(c, 2)]}>
      <Row justify="space-between" align="flex-start" gap={14}>
        <View style={{ flex: 1, gap: 3 }}>
          <Kicker>{day}-kun · {doneToday ? "keyingi" : "bugun"}</Kicker>
          <Title size={23}>{progress.title}</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{dayLine(progress)}</Text>
        </View>
        <Pill label={`${Math.min(stageIdx + 1, plan.stages.length)} / ${plan.stages.length}`} tone="green" />
      </Row>
      {doneToday ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2, marginTop: -6 }}>
          Bugungi kun bajarildi. Vaqtingiz bo'lsa, keyingisini boshlashingiz mumkin.
        </Text>
      ) : null}
      <Col gap={9}>
        {shown.map((i) => {
          const stage = plan.stages[i];
          if (i === stageIdx) {
            return (
              <View key={i} style={{ padding: 16, borderRadius: 20, backgroundColor: c.green, gap: 14 }}>
                <Row gap={12}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: FONTS.displayBold, fontSize: 13, color: c.dark ? c.green : c.greenDeep }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.onGreen }}>{stage.label}</Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.greenTint }}>{stage.note} · ~{stage.minutes} daq</Text>
                  </View>
                </Row>
                <Button title={i === 0 && !stageIdx ? "Boshlash" : "Davom etish"} kind="inverse" size="md" onPress={onStart} />
              </View>
            );
          }
          const done = i < stageIdx;
          return (
            <Row key={i} gap={12} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.tint }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center",
                backgroundColor: done ? c.green : c.line,
              }}>
                {done
                  ? <Feather name="check" size={14} color={c.onGreen} />
                  : <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.ink2 }}>{i + 1}</Text>}
              </View>
              <Text style={{ flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: c.ink2 }}>{stage.label}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: c.ink4 }}>{done ? "bajarildi" : `~${stage.minutes} daq`}</Text>
            </Row>
          );
        })}
      </Col>
    </Pressable>
  );
}

// 31 — the day after a missed one. It names what was lost and offers the straight way back.
function MissedCard({ missed, best, due, onDo, onSkip }) {
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 16 }, shadow(c, 2)]}>
      <Row gap={14}>
        <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: c.dangerTint, alignItems: "center", justifyContent: "center" }}>
          <Feather name="clock" size={21} color={c.danger} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Title size={20}>Kecha dars qoldi</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>{fmtDayMonth(missed.date)} · {missed.day}-kun bajarilmadi</Text>
        </View>
      </Row>
      <Row gap={14} style={{ padding: 16, borderRadius: 18, backgroundColor: c.tint }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>Seriya</Text>
          <Row gap={8} align="baseline">
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: c.danger }}>0</Text>
            {best ? <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink4 }}>eng uzuni {best} kun</Text> : null}
          </Row>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>Kutayotgan takrorlash</Text>
          <Row gap={8} align="baseline">
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: c.ink }}>{due}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink4 }}>so'z</Text>
          </Row>
        </View>
      </Row>
      <Col gap={10}>
        <Button title="Kechagi kunni bajarish" size="md" onPress={onDo} />
        <Button title="Keyinroq" size="md" kind="tint" onPress={onSkip} />
      </Col>
    </View>
  );
}

// 34 — the two banners: offline (warm, calm) and a save the server has not taken yet (red, with a retry).
export function SyncBanner({ onPress }) {
  const c = useColors();
  const store = useStore();
  if (store.offline) {
    return (
      <Pressable onPress={onPress} style={{ backgroundColor: c.banner, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.amber }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: "#FFFFFF" }}>Oflayn rejim</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.bannerInk }}>Natijalar qurilmada saqlanmoqda, internet qaytganda yuboriladi.</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={{ backgroundColor: c.dangerTint, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.danger, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: FONTS.displayBold, fontSize: 14, color: "#FFFFFF" }}>!</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.dangerInk }}>Serverga saqlanmadi</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.dangerInk }}>Qayta urinilmoqda… natijalar qurilmada turibdi.</Text>
      </View>
      <Pressable hitSlop={10} onPress={() => { tapped(); store.flush(); }}>
        <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.dangerInk }}>Qayta</Text>
      </Pressable>
    </View>
  );
}
