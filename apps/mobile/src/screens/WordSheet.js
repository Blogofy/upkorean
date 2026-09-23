// 23 — So'z kartasi. Everything known about one word, in a sheet over whatever list it was tapped in.
// The body scrolls and the two actions stay pinned under it, so a long example or breakdown can never push
// "Mashq qilish" off the screen.
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, PlayIcon, Row, Sheet, Ticks, tapped } from "../ui";
import { useNarrator } from "../audio";
import { highlight, nextReviewText, plainUz } from "../model";
import { MemoChips } from "./Memo";

export const Star = ({ size = 19, color, filled }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"}>
    <Path d="M12 3.6 14.1 9.3 20.2 9.5 15.4 13.3 17.1 19.2 12 15.8 6.9 19.2 8.6 13.3 3.8 9.5 9.9 9.3z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
  </Svg>
);

// A sentence with its taught word in green.
export function Sentence({ text, part, size = 17 }) {
  const c = useColors();
  return (
    <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.5), color: c.ink }}>
      {highlight(text, part).map((piece, i) => (
        <Text key={i} style={piece.hl ? { fontWeight: "700", color: c.green } : null}>{piece.text}</Text>
      ))}
    </Text>
  );
}

export default function WordSheet({ id, onClose, navigation }) {
  const c = useColors();
  const store = useStore();
  const { play } = useNarrator();
  const { state, course } = store;
  const word = id && course ? course.byId[id] : null;

  let body = null;
  let footer = null;
  if (word && state) {
    const example = course.examples[word.id];
    const root = course.roots[word.id];
    const memory = srs.wordState(state, word.id);
    // In the learner's language: "Ieroglifli so'z", not the Korean term for it.
    const origin = root?.origin ? srs.ORIGINS[root.origin]?.uz : null;
    const flagged = !!memory?.flag;
    const weak = srs.isWeak(state, word.id);
    const learned = srs.isLearned(state, word.id);

    body = (
      <View style={{ paddingHorizontal: 22, paddingTop: 4, gap: 14 }}>
        <Row justify="space-between" align="flex-start" gap={14}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 40, lineHeight: 48, fontWeight: "700", color: c.ink }} adjustsFontSizeToFit numberOfLines={1}>{word.ko}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: c.ink2 }}>
              {[`${word.day}-kun`, origin].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Row gap={8}>
            {store.audio ? (
              <Pressable
                accessibilityLabel="Eshitish"
                onPress={() => { tapped(); play("words", word.id); }}
                style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.green, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }]}
              >
                <PlayIcon size={15} color={c.onGreen} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel={flagged ? "Belgini olib tashlash" : "Belgilash"}
              onPress={() => { tapped(); srs.flag(state, word.id); store.save(); }}
              style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <Star color={c.green} filled={flagged} />
            </Pressable>
          </Row>
        </Row>

        <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 14 }}>
          <View style={{ gap: 3 }}>
            <Text style={label(c)}>Ma'nosi</Text>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 19, color: weak ? c.danger : c.ink }}>{word.uz}</Text>
          </View>
          {example ? (
            <View style={{ gap: 5, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.tint2 }}>
              <Row justify="space-between">
                <Text style={label(c)}>Misol</Text>
                {store.audio ? (
                  <Pressable accessibilityLabel="Gapni eshitish" hitSlop={10} onPress={() => { tapped(); play("sentences", word.id); }}>
                    <PlayIcon size={13} color={c.green} />
                  </Pressable>
                ) : null}
              </Row>
              <Sentence text={example.ko} part={example.hl} size={16} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>{plainUz(example.uz)}</Text>
            </View>
          ) : null}
          {root ? (
            <View style={{ gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.tint2 }}>
              <Text style={label(c)}>O'zak</Text>
              <MemoChips root={root} />
            </View>
          ) : null}
        </View>

        <Row gap={14} style={{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18 }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={label(c)}>O'zlashtirish</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>
              {learned ? nextReviewText(memory) : `${word.day}-kun darsida o'rganiladi`}
            </Text>
          </View>
          <Ticks level={srs.mastery(state, word.id)} weak={weak} width={7} height={22} gap={4} />
        </Row>
      </View>
    );

    footer = (
      <Row gap={10}>
        <Button
          title={flagged ? "Belgilangan" : "Belgilash"}
          kind="plain"
          size="md"
          icon={flagged ? "check" : undefined}
          style={{ flex: 1 }}
          onPress={() => { srs.flag(state, word.id); store.save(); }}
        />
        <Button
          title={learned ? "Mashq qilish" : `${word.day}-kunni ochish`}
          size="md"
          style={{ flex: 1 }}
          onPress={() => {
            onClose();
            if (!learned) { navigation.navigate("Day", { day: word.day }); return; }
            const ids = (course.days[word.day] || []).map((w) => w.id).filter((wid) => wid !== word.id && srs.isLearned(state, wid));
            navigation.navigate("Session", {
              kind: "quiz", quizType: "mixed", title: `${word.ko} mashqi`, ids: [word.id, ...ids], count: Math.min(10, ids.length + 1),
            });
          }}
        />
      </Row>
    );
  }

  return <Sheet visible={!!word} onClose={onClose} footer={footer}>{body}</Sheet>;
}

const label = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
