// 09 — Kurs. The level as one path of thirty-word lessons, grouped by the NIKL grade they teach, with today's
// plan as a card at the top. Nothing is locked: the order is advice, and a learner who already knows a lesson's
// words may walk past it.
import { Pressable, SectionList, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import { Bar, Button, Feather, Kicker, Row, Screen, TabHeader, Title, tapped } from "../ui";
import { gradeName, lessonProgress, levelInfo, openToday, todayAction, todayKicker, todayLine, todayProgress } from "../model";

export default function Course({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  if (!state || !course) return null;

  const level = levelInfo(store.levels, course.level);
  const finished = srs.courseDone(state, course);
  const learned = srs.learnedIds(state, course).length;
  const today = todayProgress(state, course);

  const sections = [];
  for (const lesson of (course.lessons || []).slice(1)) {
    let section = sections[sections.length - 1];
    if (!section || section.grade !== lesson.grade) sections.push(section = { grade: lesson.grade, data: [], words: 0 });
    section.data.push(lesson.n);
    section.words += lesson.ids.length;
  }

  const switcher = () => { tapped(); navigation.navigate("LevelSwitch"); };

  return (
    <Screen>
      <TabHeader
        title="Kurs"
        subtitle={`${level.ko} · ${learned} / ${course.words.length} so'z  ·  darajani almashtirish ›`}
        onSubtitle={switcher}
        right={
          <Pressable onPress={switcher} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: 99, backgroundColor: c.card }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: c.ink }}>{level.ko}</Text>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: c.ink2 }}>▾</Text>
          </Pressable>
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(n) => String(n)}
        stickySectionHeadersEnabled={false}
        initialNumToRender={20}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 6 }}>
            <View style={{ backgroundColor: c.card, borderRadius: 24, padding: 18, gap: 10 }}>
              <Row justify="space-between">
                <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>O'rganilgan so'zlar</Text>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.ink }}>{learned} / {course.words.length}</Text>
              </Row>
              <Bar value={learned} total={Math.max(1, course.words.length)} height={8} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: c.ink2 }}>
                {course.lessonCount} dars, har birida 30 so'z (3 bo'lim). Kunlik reja: {srs.dailyWords(state)} so'z.{!level.ready ? ` Hozircha ${course.words.length} so'z ochiq, qolgan ${Math.max(0, level.planned - course.words.length)} tasi tayyorlanmoqda.` : ""}
              </Text>
            </View>
            {finished ? null : <TodayCard progress={today} course={course} onStart={() => openToday(navigation, state, course)} />}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ paddingTop: 18, paddingBottom: 8, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: c.ink }}>{gradeName(section.grade)}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{section.data.length} dars · {section.words} so'z</Text>
          </Row>
        )}
        renderItem={({ item: n }) => (
          <LessonRow
            progress={lessonProgress(state, course, n)}
            onPress={() => { tapped(); navigation.navigate("Lesson", { lesson: n }); }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  );
}

function TodayCard({ progress, course, onStart }) {
  const c = useColors();
  const words = progress.nextIds.map((id) => course.byId[id]).filter(Boolean);
  return (
    <Pressable onPress={onStart} style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 14 }, shadow(c, 2)]}>
      <View style={{ gap: 3 }}>
        <Kicker>{todayKicker(progress)}</Kicker>
        <Title size={23}>{progress.done ? "Bajarildi" : `${progress.goal} ta yangi so'z`}</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{todayLine(progress)}</Text>
      </View>
      {words.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {words.slice(0, 6).map((word) => (
            <View key={word.id} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Button title={todayAction(progress)} kind={progress.done ? "tint" : "primary"} size="md" disabled={progress.done && !progress.extra.length} onPress={onStart} />
    </Pressable>
  );
}

// One lesson in the list: a circle that says where it stands, its name and themes, and a bar for each of its
// sections so a lesson half done shows which half.
function LessonRow({ progress, onPress }) {
  const c = useColors();
  const { status } = progress;
  const done = status === "done" || status === "mastered";
  const current = status === "current";
  const sub = [`${progress.words} so'z`, ...progress.themes].join(" · ");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 18,
        backgroundColor: c.card, borderWidth: current ? 2 : 0, borderColor: c.green, opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
        backgroundColor: done ? c.green : current ? c.greenTint : c.tint,
      }}>
        {status === "mastered"
          ? <Feather name="star" size={17} color={c.onGreen} />
          : done
            ? <Feather name="check" size={18} color={c.onGreen} />
            : <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: FONTS.bold, fontSize: 14, color: current ? c.greenDeep : c.ink2 }}>{progress.n}</Text>}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.ink }}>{progress.n}-dars · {progress.title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{sub}</Text>
        {progress.learned && !done ? (
          <Row gap={4} style={{ marginTop: 2 }}>
            {progress.sections.map((section) => (
              <Bar key={section.n} value={section.learned} total={Math.max(1, section.ids.length)} height={5} style={{ flex: 1 }} />
            ))}
          </Row>
        ) : null}
      </View>
      {progress.learned && !done ? (
        <Text style={{ fontFamily: FONTS.semi, fontSize: 12, color: c.ink2 }}>{progress.learned}/{progress.words}</Text>
      ) : null}
      <Feather name="chevron-right" size={16} color={c.ink4} />
    </Pressable>
  );
}
