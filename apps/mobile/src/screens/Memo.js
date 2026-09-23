// How a word is built, for the "Yodda tutish uchun" card on a new word and the "O'zak" part of the word
// card. One syllable per row — the Hangul in its own box, the hanja behind it small and grey, its meaning
// beside them — then what they add up to, then other words built from the same syllables.
//
// <MemoCard> is the new-word version: a card that starts closed, showing only the syllables, and opens
// to the full breakdown when tapped, so the word and its sentence keep the screen until the learner asks.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";

import { FONTS, useColors } from "../theme";
import { Feather, tapped } from "../ui";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const sentence = (text) => {
  const t = String(text || "").trim();
  if (!t) return "";
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
};

const partsOf = (root) => (root?.parts || []).filter((part) => part.k);

export default function Memo({ root }) {
  const c = useColors();
  if (!root) return null;
  const parts = partsOf(root);
  const family = root.family || [];

  return (
    <View style={{ gap: 14 }}>
      {parts.length ? (
        <View style={{ gap: 8 }}>
          {parts.map((part, i) => (
            <View key={`${part.k}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{
                minWidth: 46, height: 46, paddingHorizontal: 10, borderRadius: 14, alignItems: "center", justifyContent: "center",
                backgroundColor: part.ending ? "transparent" : c.tint,
                borderWidth: part.ending ? 1.5 : 0, borderStyle: "dashed", borderColor: c.line,
              }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: part.ending ? c.ink2 : c.ink }}>{part.k}</Text>
              </View>
              {part.h ? <Text style={{ fontSize: 15, color: c.ink4, minWidth: 18 }}>{part.h}</Text> : null}
              <Text style={{ flex: 1, fontFamily: part.ending ? FONTS.body : FONTS.semi, fontSize: 14.5, lineHeight: 20, color: part.ending ? c.ink2 : c.ink }}>
                {part.uz}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {root.idea ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.greenTint }}>
          {parts.length ? <Text style={{ fontFamily: FONTS.displayBold, fontSize: 16, lineHeight: 21, color: c.greenDeep }}>=</Text> : null}
          <Text style={{ flex: 1, fontFamily: FONTS.semi, fontSize: 14.5, lineHeight: 21, color: c.greenDeep }}>{sentence(root.idea)}</Text>
        </View>
      ) : null}
      {root.hint ? <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: c.ink2 }}>{root.hint}</Text> : null}

      {family.length ? (
        <View style={{ gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.tint2 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>Shu bo'g'inli so'zlar</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {family.map(([ko, uz]) => (
              <View key={ko} style={{ flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.tint }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{ko}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{uz}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function MemoCard({ root, title = "Yodda tutish uchun" }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(turn, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [open, turn]);
  if (!root) return null;
  const preview = partsOf(root).filter((part) => !part.ending).map((part) => part.k).join(" + ");

  const toggle = () => {
    tapped();
    LayoutAnimation.configureNext(LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setOpen(!open);
  };

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 18, opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c.greenTint, alignItems: "center", justifyContent: "center" }}>
          <Feather name="zap" size={15} color={c.greenDeep} />
        </View>
        <Text style={{ flex: 1, fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>{title}</Text>
        {!open && preview ? <Text style={{ fontSize: 15, fontWeight: "700", color: c.ink4 }} numberOfLines={1}>{preview}</Text> : null}
        <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) }] }}>
          <Feather name="chevron-down" size={20} color={c.ink2} />
        </Animated.View>
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
          <Memo root={root} />
        </View>
      ) : null}
    </View>
  );
}

// The breakdown in a line or two, for the word card: [필 必 albatta] + [요 要 talab], then what they make.
export function MemoChips({ root }) {
  const c = useColors();
  const parts = partsOf(root).filter((part) => !part.ending);
  return (
    <View style={{ gap: 8 }}>
      {parts.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {parts.map((part, i) => (
            <View key={`${part.k}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {i > 0 ? <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: c.ink4 }}>+</Text> : null}
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 11, backgroundColor: c.tint }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.ink }}>{part.k}</Text>
                {part.h ? <Text style={{ fontSize: 12, color: c.ink4 }}>{part.h}</Text> : null}
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{part.uz}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {root?.idea ? <Text style={{ fontFamily: FONTS.semi, fontSize: 14, lineHeight: 20, color: c.greenDeep }}>{parts.length ? "= " : ""}{sentence(root.idea)}</Text> : null}
      {root?.hint ? <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: c.ink2 }}>{root.hint}</Text> : null}
    </View>
  );
}
