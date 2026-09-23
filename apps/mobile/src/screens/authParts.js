// Two pieces the sign-up and new-password screens share: the back link at the top and the strength bar.
import { Pressable, Text, View } from "react-native";

import { FONTS, useColors } from "../theme";
import { tapped } from "../ui";

// Weak below eight characters, which the server refuses anyway; strong once it is long and mixes letters
// with digits or symbols.
export function strength(password) {
  const p = String(password || "");
  if (!p) return 0;
  if (p.length < 8) return 1;
  const kinds = [/[a-z]/i, /\d/, /[^a-z\d]/i].filter((re) => re.test(p)).length;
  return p.length >= 10 && kinds >= 2 ? 3 : 2;
}

export function StrengthBar({ password }) {
  const c = useColors();
  const level = strength(password);
  if (!level) return null;
  const color = level === 1 ? c.danger : c.green;
  const label = ["", "zaif", "o'rtacha", "kuchli"][level];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1, height: 5, borderRadius: 99, backgroundColor: i <= level ? color : c.line }} />
      ))}
      <Text style={{ fontFamily: level === 3 ? FONTS.bold : FONTS.body, fontSize: 12, color: level === 3 ? c.green : c.ink2, marginLeft: 4 }}>{label}</Text>
    </View>
  );
}

export function BackTo({ label, onPress }) {
  const c = useColors();
  return (
    <Pressable onPress={() => { tapped(); onPress(); }} hitSlop={10} style={{ alignSelf: "flex-start" }}>
      <Text style={{ fontFamily: FONTS.bold, fontSize: 13.5, color: c.green }}>← {label}</Text>
    </Pressable>
  );
}
