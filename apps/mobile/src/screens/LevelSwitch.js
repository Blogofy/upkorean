// 27 — Darajani almashtirish. A sheet over the screen it was opened from. Progress in every level is kept,
// so switching is never a loss — which is the one thing the sheet has to say.
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Segments, SheetScreen, Title, tapped } from "../ui";
import { allLevels } from "../model";

export default function LevelSwitch({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [busy, setBusy] = useState(null);
  const closeRef = useRef((after) => (after || navigation.goBack)());
  if (!state || !course) return null;
  const levels = allLevels(store.levels);

  // How far a level has gone, read from the words the account has met in it — its course need not be loaded.
  const learnedIn = (id) => Object.keys(state.words).filter((wid) => wid.startsWith(`${id}-`) && state.words[wid].learned).length;

  const go = async (id) => {
    setBusy(id);
    try {
      await store.switchLevel(id);
      closeRef.current(() => navigation.goBack());
    } catch (problem) {
      store.say(problem.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <SheetScreen onClose={() => navigation.goBack()}>
      {(close) => { closeRef.current = close; return (<>
      <View style={{ gap: 4 }}>
        <Title size={24}>Darajani almashtirish</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: c.ink2 }}>Progress saqlanadi — istalgan payt qaytasiz.</Text>
      </View>
      <View style={{ gap: 10 }}>
        {levels.map((level) => {
          const current = level.id === course.level;
          const learned = current ? srs.learnedIds(state, course).length : learnedIn(level.id);
          const started = learned > 0;
          if (current) {
            return (
              <View key={level.id} style={{ padding: 18, borderRadius: 20, backgroundColor: c.green, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Badge ko={level.ko} on />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 15.5, color: c.onGreen }}>{level.uz} · joriy</Text>
                  <Segments total={10} filled={Math.round((learned / Math.max(1, course.words.length)) * 10)} height={5} on="#FFFFFF" off="rgba(255,255,255,0.3)" />
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.greenTint }}>{learned} / {course.words.length} so'z · kuniga {srs.dailyWords(state)} ta</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={level.id} style={{ padding: 18, borderRadius: 20, backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Badge ko={level.ko} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 15.5, color: c.ink }}>{level.uz}</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>
                  {level.locked ? "Tayyorlanmoqda" : started ? `${learned} so'z o'rganilgan` : "Boshlanmagan"} · {level.planned} so'z
                </Text>
              </View>
              {level.locked ? (
                <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.tint }}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.ink4 }}>Tez kunda</Text>
                </View>
              ) : (
                <Pressable
                  disabled={!!busy}
                  onPress={() => { tapped(); go(level.id); }}
                  style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.greenTint, minWidth: 70, alignItems: "center" }}
                >
                  {busy === level.id
                    ? <ActivityIndicator size="small" color={c.greenDeep} />
                    : <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.greenDeep }}>O'tish</Text>}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      <Button title="Bekor qilish" kind="white" onPress={() => close()} />
      </>); }}
    </SheetScreen>
  );
}

function Badge({ ko, on }) {
  const c = useColors();
  return (
    <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: on ? "#FFFFFF" : c.greenTint, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: on ? c.green : c.greenDeep }}>{ko}</Text>
    </View>
  );
}
