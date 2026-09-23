// 25 — Yutuqlar. The XP level, every badge (earned first), and this week's leaderboard.
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import * as srs from "@upkorean/shared/srs.js";

import { api } from "../api";
import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Feather, RingStat, Row, Screen, Title } from "../ui";
import { badgeView } from "../model";
import { Flame } from "./Today";
import { Star } from "./WordSheet";

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const ICON = {
  s3: "flame", s10: "flame", s30: "flame",
  first: "check", week: "check", d10: "check", half: "check", grad: "check",
  w100: "star", w300: "star", w500: "star", wall: "star", m50: "star", m200: "star",
};

export default function Achievements({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [board, setBoard] = useState(null); // null = loading, false = could not load

  // Anything earned since the last sitting is marked (and saved) once, here, rather than while drawing.
  useEffect(() => {
    if (state && course && srs.achievements(state, course).earned.length) store.save();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true;
    api.leaderboard().then((data) => { if (live) setBoard(data); }).catch(() => { if (live) setBoard(false); });
    return () => { live = false; };
  }, []);

  if (!state || !course) return null;
  const xp = srs.levelInfo(state);
  const { list, unlocked, total } = badgeView(state, course);
  const sorted = [...list.filter((a) => a.done), ...list.filter((a) => !a.done)];

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 8 }}>
        <BackLink label="Natijalar" onPress={() => navigation.goBack()} />
        <Title>Yutuqlar</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{unlocked} / {total} ochilgan</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        <Row gap={16} style={{ backgroundColor: c.green, borderRadius: 22, padding: 20 }}>
          <RingStat value={xp.pct} total={100} size={58} onGreen label={String(xp.level)} />
          <View style={{ gap: 3, flex: 1 }}>
            <Title size={19} c="#FFFFFF">{xp.level}-daraja</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.greenTint }}>{fmt(xp.xp)} XP · {xp.level + 1}-darajagacha {fmt(xp.toNext)} XP</Text>
          </View>
        </Row>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5 }}>
          {sorted.map((a) => (
            <View key={a.id} style={{ width: `${100 / 3}%`, padding: 4.5 }}>
              <View style={{ backgroundColor: c.card, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, alignItems: "center", gap: 7, opacity: a.done ? 1 : 0.55, minHeight: 112 }}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: a.done ? c.greenTint : c.locked, alignItems: "center", justifyContent: "center" }}>
                  {!a.done ? <Lock color={c.ink2} />
                    : ICON[a.id] === "flame" ? <Flame size={21} color={c.greenDeep} />
                    : ICON[a.id] === "check" ? <Feather name="check" size={21} color={c.greenDeep} />
                    : ICON[a.id] === "star" ? <Star size={21} color={c.greenDeep} />
                    : <Text style={{ fontSize: a.ko.length > 1 ? 13 : 17, fontWeight: "700", color: c.greenDeep }}>{a.ko}</Text>}
                </View>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 12.5, lineHeight: 16, color: a.done ? c.ink : c.ink2, textAlign: "center" }} numberOfLines={2}>{a.title}</Text>
                {!a.done && a.progress ? <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: c.ink4 }}>{a.progress}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {board === null || board === false ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 6 }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Haftalik reyting</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>
              {board === null ? "Yuklanmoqda…" : "Reyting internet orqali ko'rinadi — hozir aloqa yo'q."}
            </Text>
          </View>
        ) : null}
        {board && board.rows?.length ? (
          <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 13 }}>
            <Row justify="space-between" align="baseline">
              <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 }}>Haftalik reyting</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: c.ink2 }}>{board.total} ishtirokchi</Text>
            </Row>
            <View style={{ gap: 11 }}>
              {board.rows.map((row) => (
                <Row
                  key={`${row.rank}-${row.name}`}
                  gap={12}
                  style={row.me ? { paddingVertical: 10, paddingHorizontal: 12, marginHorizontal: -12, borderRadius: 14, backgroundColor: c.greenTint } : null}
                >
                  <Text style={{ width: 22, fontFamily: FONTS.bold, fontSize: 13, color: row.me ? c.greenDeep : c.ink2 }}>{row.rank}</Text>
                  <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: row.me ? c.green : c.tint2, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: row.me ? c.onGreen : c.ink }}>{String(row.name)[0]}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: row.me ? FONTS.bold : FONTS.body, fontSize: 14, color: row.me ? c.greenDeep : c.ink }}>{row.me ? "Siz" : row.name}</Text>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: row.me ? c.greenDeep : c.ink }}>{fmt(row.xp)}</Text>
                </Row>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const Lock = ({ color }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Rect x={5} y={11} width={14} height={10} rx={2} stroke={color} strokeWidth={1.9} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={1.9} />
  </Svg>
);
