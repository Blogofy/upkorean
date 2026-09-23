// How a word is built, for the "Yodda tutish uchun" block on a new word and the "O'zak" part of the word
// card. Each piece is shown as the Korean syllable the learner actually reads — 생 · 활, not 生 · 活 —
// with its meaning under it; then what the pieces add up to, and other words that share them.
import { Fragment } from "react";
import { Text, View } from "react-native";

import { FONTS, useColors } from "../theme";

const cap = (text) => (text ? text[0].toUpperCase() + text.slice(1) : "");

export default function Memo({ root, onTint = true }) {
  const c = useColors();
  if (!root) return null;
  const parts = (root.parts || []).filter((part) => part.k);
  const family = root.family || [];
  const ink = onTint ? c.greenDeep : c.ink;
  const soft = onTint ? c.greenDeep : c.ink2;
  const box = onTint ? c.card : c.tint;

  return (
    <View style={{ gap: 12 }}>
      {parts.length ? (
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: 6 }}>
          {parts.map((part, i) => (
            <Fragment key={`${part.k}-${i}`}>
              {i > 0 ? <Text style={{ alignSelf: "center", fontFamily: FONTS.bold, fontSize: 15, color: soft, opacity: 0.7 }}>+</Text> : null}
              <View style={{
                flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 4,
                paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14,
                backgroundColor: part.ending ? "transparent" : box,
                borderWidth: part.ending ? 1.5 : 0, borderStyle: "dashed", borderColor: onTint ? c.greenLine : c.line,
              }}>
                <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "700", color: part.ending ? soft : ink }}>{part.k}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, lineHeight: 15, color: soft, textAlign: "center" }} numberOfLines={2}>
                  {part.uz}
                </Text>
              </View>
            </Fragment>
          ))}
        </View>
      ) : null}

      {root.idea ? (
        <Text style={{ fontFamily: FONTS.bold, fontSize: 14.5, lineHeight: 20, color: ink }}>
          {parts.length ? "= " : ""}{cap(root.idea)}
        </Text>
      ) : null}

      {root.hint ? <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: soft }}>{root.hint}</Text> : null}

      {family.length ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: FONTS.semi, fontSize: 12.5, color: soft, opacity: 0.85 }}>Shu bo'g'inlar bor so'zlar:</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {family.map(([ko, uz]) => (
              <View key={ko} style={{ flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 11, backgroundColor: box }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: ink }}>{ko}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: soft }}>{uz}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
