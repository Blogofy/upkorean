// 09 — Kurs. The level as one path of lessons, grouped by the NIKL grade they teach, with the lesson in
// progress as a card at the top. Nothing is locked: the order is advice, and a learner who already knows a
// lesson's words may walk past it.
import { Pressable, SectionList, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import { Bar, Button, Feather, Kicker, Row, Screen, TabHeader, Title, tapped } from "../ui";
import { gradeName, lessonAction, lessonLine, lessonProgress, levelInfo, openLesson } from "../model";

export default function Course({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  if (!state || !course) return null;

  const level = levelInfo(store.levels, course.level);
  const done = srs.lessonsDone(state, course);
  const current = srs.currentLesson(state, course);
  const finished = srs.courseDone(state, course);
  const learned = srs.learnedIds(state, course).length;

  const sections = [];
  for (const lesson of course.lessons.slice(1)) {
    let section = sections[sections.length - 1];
    if (!section || section.grade !== lesson.grade) sections.push(section = { grade: lesson.grade, data: [] });
    section.data.push(lesson.n);
  }

  const switcher = () => { tapped(); navigation.navigate("LevelSwitch"); };

  return (
    <Screen>
      <TabHeader
        title="Kurs"
        subtitle={`${level.ko} · ${done} / ${course.lessonCount} dars  ·  darajani almashtirish ›`}
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
              {!level.ready ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: c.ink2 }}>
                  Hozircha {course.lessonCount} dars ochiq. Darajaning qolgan {Math.max(0, level.planned - course.words.length)} so'zi tayyorlanmoqda.
                </Text>
              ) : null}
            </View>
            {finished ? null : (
              <CurrentCard
                progress={lessonProgress(state, course, current)}
                course={course}
                onStart={() => openLesson(navigation, state, course, current)}
                onOpen={() => { tapped(); navigation.navigate("Lesson", { lesson: current }); }}
              />
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Row justify="space-between" style={{ paddingTop: 18, paddingBottom: 8, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: c.ink }}>{gradeName(section.grade)}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{section.data.length} dars</Text>
          </Row>
        )}
        renderItem={({ item: n }) => (
          <LessonRow
            progress={lessonProgress(state, course, n)}
            course={course}
            onPress={() => { tapped(); navigation.navigate("Lesson", { lesson: n }); }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </Screen>
  );
}

function CurrentCard({ progress, course, onStart, onOpen }) {
  const c = useColors();
  const words = progress.ids.map((id) => course.byId[id]).filter(Boolean);
  return (
    <Pressable onPress={onOpen} style={[{ backgroundColor: c.card, borderRadius: 26, padding: 22, gap: 14 }, shadow(c, 2)]}>
      <View style={{ gap: 3 }}>
        <Kicker>{progress.n}-dars · hozirgi{progress.parts > 1 ? ` · ${progress.partsDone}/${progress.parts} qism` : ""}</Kicker>
        <Title size={23}>{progress.title}</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{lessonLine(progress)}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {words.slice(0, 6).map((word) => (
          <View key={word.id} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 12, backgroundColor: c.tint }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{word.ko}</Text>
          </View>
        ))}
      </View>
      <Button title={lessonAction(progress)} size="md" onPress={onStart} />
    </Pressable>
  );
}

// One lesson in the list: a circle that says where it stands, its name, and the first of its words.
function LessonRow({ progress, course, onPress }) {
  const c = useColors();
  const { status } = progress;
  const done = status === "done" || status === "mastered";
  const current = status === "current";
  const words = progress.ids.slice(0, 4).map((id) => course.byId[id]?.ko).filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 18,
        backgroundColor: c.card, borderWidth: current ? 2 : 0, borderColor: c.green, opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
        backgroundColor: done ? c.green : current ? c.greenTint : c.tint,
      }}>
        {status === "mastered"
          ? <Feather name="star" size={16} color={c.onGreen} />
          : done
            ? <Feather name="check" size={17} color={c.onGreen} />
            : <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: FONTS.bold, fontSize: 13, color: current ? c.greenDeep : c.ink2 }}>{progress.n}</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.bold, fontSize: 14.5, color: c.ink }}>{progress.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink2 }}>{words}</Text>
      </View>
      {progress.partsDone && !done ? (
        <Text style={{ fontFamily: FONTS.semi, fontSize: 12, color: c.ink2 }}>{progress.partsDone}/{progress.parts} qism</Text>
      ) : null}
      <Feather name="chevron-right" size={16} color={c.ink4} />
    </Pressable>
  );
}
