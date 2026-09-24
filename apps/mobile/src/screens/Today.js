// 08 — Bugun. The screen the app opens on: the next lesson and today's goal, the review waiting, the week,
// and the course as a strip. When yesterday went by without a lesson (31), a card says so first.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";

import * as srs from "@upkorean/shared/srs.js";
import { fmtDayMonth, fmtLong, today } from "@upkorean/shared/dates.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import { Button, Col, Feather, Kicker, RingStat, Row, Screen, Segments, Title, Txt, tapped } from "../ui";
import { firstName, lessonLine, lessonProgress, levelInfo, openLesson, openReview, todayGoal } from "../model";

const MISSED_KEY = "uk_missed_hidden_on";

export const Flame = ({ size = 15, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .5 1.5 1.5 2.5 2.5 2.5C12 8 11 6 12 3z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export default function Today({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  // "Keyinroq" on the missed-day card holds for the rest of the day, not just until the app is closed.
  const [hiddenOn, setHiddenOn] = useState(null);
  useEffect(() => { AsyncStorage.getItem(MISSED_KEY).then(setHiddenOn).catch(() => {}); }, []);
  if (!state || !course) return null;

  const now = today();
  const level = levelInfo(store.levels, course.level);
  const streak = srs.streak(state, now);
  const goal = srs.reviewGoal(state, course, now);
  const week = srs.weekRhythm(state, now);
  const doneLessons = srs.lessonsDone(state, course);
  const finished = srs.courseDone(state, course);
  const current = srs.currentLesson(state, course);
  const progress = lessonProgress(state, course, current);
  const daily = todayGoal(state, now);
  const missed = hiddenOn !== now && !(state.act[now] && (state.act[now].learned || state.act[now].reviewed))
    ? srs.missedYesterday(state, course, now) : null;
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
          accessibilityLabel={`${streak} kunlik seriya`}
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
            onDo={() => openLesson(navigation, state, course, current)}
            onSkip={() => { setHiddenOn(now); AsyncStorage.setItem(MISSED_KEY, now).catch(() => {}); }}
          />
        ) : null}

        {fresh && !finished ? (
          <View style={{ gap: 4, paddingHorizontal: 4 }}>
            <Title size={19}>Birinchi dars shu yerdan boshlanadi</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>
              Har bir dars — 10 ta yangi so'z, 7 daqiqa. O'rgangan so'zlaringiz ertadan takrorlashga qaytib keladi.
            </Text>
          </View>
        ) : null}

        {finished ? (
          <View style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 14 }, shadow(c, 1)]}>
            <Kicker>{level.ko} · tugadi</Kicker>
            <Title size={23}>Daraja tugatildi</Title>
            <Txt t="bodySm" c="ink2">{course.words.length} so'z o'rganildi. Takrorlash davom etadi.</Txt>
            <Button title="Natijani ko'rish" size="md" onPress={() => navigation.navigate("LevelDone")} />
          </View>
        ) : (
          <LessonCard
            progress={progress}
            daily={daily}
            course={course}
            onOpen={() => navigation.navigate("Lesson", { lesson: current })}
            onStart={() => openLesson(navigation, state, course, current)}
          />
        )}

        {/* Before the first lesson everything below its card is still empty, so it steps back. */}
        <View style={{ gap: 14, opacity: fresh ? 0.55 : 1 }}>
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
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{level.ko} · {doneLessons} / {course.lessonCount} dars</Text>
            </Row>
            <Segments
              total={20}
              filled={Math.round((doneLessons / Math.max(1, course.lessonCount)) * 20)}
              current={finished ? -1 : Math.min(19, Math.floor(((current - 1) / Math.max(1, course.lessonCount)) * 20))}
            />
          </View>
          <Feather name="chevron-right" size={16} color={c.ink4} />
        </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const label = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink4 });

// The lesson card: the next lesson, a taste of its words, and today's goal as a ring beside it. Once the goal
// is met it says so and still offers the next lesson — the goal is a floor, not a ceiling.
function LessonCard({ progress, daily, course, onOpen, onStart }) {
  const c = useColors();
  const words = progress.ids.map((id) => course.byId[id]).filter(Boolean);
  const shown = Math.min(daily.learned, daily.goal);
  return (
    <Pressable onPress={onOpen} style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 16 }, shadow(c, 2)]}>
      <Row justify="space-between" align="flex-start" gap={14}>
        <View style={{ flex: 1, gap: 3 }}>
          <Kicker>{progress.n}-dars · {daily.done ? "bonus" : "keyingi"}</Kicker>
          <Title size={23}>{progress.title}</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{lessonLine(progress)}</Text>
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <RingStat value={shown} total={daily.goal} size={52} />
          <Text style={{ fontFamily: FONTS.semi, fontSize: 11.5, color: c.ink2 }}>{shown}/{daily.goal} so'z</Text>
        </View>
      </Row>
      {daily.done ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: c.ink2, marginTop: -4 }}>
          Bugungi maqsad bajarildi. Vaqtingiz bo'lsa, yana bitta dars — 10 ta so'z.
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {words.slice(0, 5).map((word) => (
          <View key={word.id} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
          </View>
        ))}
        {words.length > 5 ? (
          <View style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint, justifyContent: "center" }}>
            <Text style={{ fontFamily: FONTS.semi, fontSize: 13, color: c.ink2 }}>+{words.length - 5}</Text>
          </View>
        ) : null}
      </View>
      <Button title={daily.done ? "Yana bir dars" : "Boshlash"} kind={daily.done ? "tint" : "primary"} size="md" onPress={onStart} />
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
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>{fmtDayMonth(missed.date)} · seriya uzildi</Text>
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
        <Button title="Darsni boshlash" size="md" onPress={onDo} />
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
