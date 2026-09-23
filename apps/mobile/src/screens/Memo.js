// How a word is built, for the "Yodda tutish uchun" card on a new word and the "O'zak" part of the word
// card. Each piece is a chip: the Korean syllable the learner reads, the hanja behind it small and grey,
// and its meaning — 기 期 davr + 간 間 oraliq. Then what they add up to in one plain sentence, and, under
// a rule, other words built from the same syllables.
import { Text, View } from "react-native";

import { FONTS, useColors } from "../theme";

const sentence = (text) => {
  const t = String(text || "").trim();
  if (!t) return "";
  const capped = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
};

export default function Memo({ root }) {
  const c = useColors();
  if (!root) return null;
  const parts = (root.parts || []).filter((part) => part.k);
  const family = root.family || [];

  return (
    <View style={{ gap: 14 }}>
      {parts.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {parts.map((part, i) => (
            <View key={`${part.k}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {i > 0 ? <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.ink4 }}>+</Text> : null}
              <View style={{
                flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14,
                backgroundColor: part.ending ? "transparent" : c.tint,
                borderWidth: part.ending ? 1.5 : 0, borderStyle: "dashed", borderColor: c.line,
              }}>
                <Text style={{ fontSize: 19, fontWeight: "700", color: c.ink }}>{part.k}</Text>
                {part.h ? <Text style={{ fontSize: 12.5, color: c.ink4 }}>{part.h}</Text> : null}
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{part.uz}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {root.idea ? <Text style={{ fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: c.ink }}>{sentence(root.idea)}</Text> : null}
      {root.hint ? <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: c.ink2 }}>{root.hint}</Text> : null}

      {family.length ? (
        <View style={{ gap: 9, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.tint2 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>Shu bo'g'inli so'zlar</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {family.map(([ko, uz]) => (
              <View key={ko} style={{ flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.greenTint }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: c.greenDeep }}>{ko}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.greenDeep }}>{uz}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
