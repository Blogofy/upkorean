// 22 — So'zlar. The whole level as one searchable list; a tap opens the word card (23). The two empty
// states (33) — nothing found, nothing learned yet — live here too.
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Chip, Feather, Row, Screen, Ticks, Title, tapped } from "../ui";
import { levelInfo, openStage } from "../model";
import WordSheet from "./WordSheet";

const norm = (text) => String(text || "").toLowerCase().replace(/[’'`ʻʼ]/g, "'").trim();

export default function Words({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(null);

  const learnedCount = state && course ? srs.learnedIds(state, course).length : 0;
  const weakCount = state && course ? srs.weakIds(state, course).length : 0;

  const rows = useMemo(() => {
    if (!state || !course) return [];
    const q = norm(query);
    return course.words.filter((word) => {
      if (filter === "learned" && !srs.isLearned(state, word.id)) return false;
      if (filter === "weak" && !srs.isWeak(state, word.id)) return false;
      if (filter === "flag" && !state.words[word.id]?.flag) return false;
      if (!q) return true;
      return word.ko.includes(query.trim()) || norm(word.uz).includes(q);
    });
  }, [state, course, query, filter, store.state?.xp, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !course) return null;
  const level = levelInfo(store.levels, course.level);

  const empty = () => {
    if (query.trim()) {
      const shorter = [...query.trim()].slice(0, 2).join("");
      return (
        <EmptyCard
          icon="search"
          title="Hech narsa topilmadi"
          body={<>"{query.trim()}" bo'yicha mos so'z yo'q. Qisqaroq yozib ko'ring{shorter && shorter !== query.trim() ? <> — masalan <Text style={{ fontFamily: FONTS.bold, color: c.green }}>{shorter}</Text></> : null}.</>}
          action="Qidiruvni tozalash"
          soft
          onAction={() => setQuery("")}
        />
      );
    }
    if (!learnedCount) {
      return (
        <EmptyCard
          ko="시작"
          title="Hali so'z o'rganilmagan"
          body="Birinchi kunni tugatganingizdan keyin so'zlaringiz shu yerda o'zlashtirish darajasi bilan chiqadi."
          action="1-kunni boshlash"
          onAction={() => openStage(navigation, state, course, srs.currentDay(state, course))}
        />
      );
    }
    return <EmptyCard icon="inbox" title="Bu ro'yxat bo'sh" body="Boshqa filtrni tanlang." />;
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, gap: 14 }}>
        <View style={{ paddingHorizontal: 2, gap: 2 }}>
          <Title>So'zlar</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.ink2 }}>{level.ko} · {learnedCount} / {course.words.length} so'z</Text>
        </View>
        <Row gap={11} style={{ paddingHorizontal: 16, borderRadius: 16, backgroundColor: c.card }}>
          <Feather name="search" size={18} color={c.ink4} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Koreyscha yoki o'zbekcha qidirish"
            placeholderTextColor={c.ink4}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, paddingVertical: 13, fontFamily: FONTS.body, fontSize: 15, color: c.ink }}
          />
          {query ? (
            <Pressable hitSlop={10} onPress={() => setQuery("")} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.locked, alignItems: "center", justifyContent: "center" }}>
              <Feather name="x" size={12} color={c.ink2} />
            </Pressable>
          ) : null}
        </Row>
        <Row gap={7} wrap>
          <Chip label="Hammasi" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="O'rganilgan" selected={filter === "learned"} onPress={() => setFilter("learned")} />
          <Chip label={weakCount ? `Qiyin · ${weakCount}` : "Qiyin"} selected={filter === "weak"} onPress={() => setFilter("weak")} />
          <Chip label="Belgilangan" selected={filter === "flag"} onPress={() => setFilter("flag")} />
        </Row>
      </View>

      {rows.length ? (
        <FlatList
          data={rows}
          keyExtractor={(word) => word.id}
          initialNumToRender={20}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }}
          renderItem={({ item, index }) => {
            const weak = srs.isWeak(state, item.id);
            const memory = state.words[item.id];
            const first = index === 0, last = index === rows.length - 1;
            return (
              <Pressable
                onPress={() => { tapped(); setOpen(item.id); }}
                style={({ pressed }) => [{
                  backgroundColor: c.card, paddingHorizontal: 18,
                  borderTopLeftRadius: first ? 22 : 0, borderTopRightRadius: first ? 22 : 0,
                  borderBottomLeftRadius: last ? 22 : 0, borderBottomRightRadius: last ? 22 : 0,
                  paddingTop: first ? 4 : 0, paddingBottom: last ? 4 : 0, opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Row gap={14} style={{ paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.tint2 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 19, fontWeight: "700", color: c.ink }} numberOfLines={1}>{item.ko}</Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: weak ? c.danger : c.ink2 }} numberOfLines={1}>
                      {item.uz} · {weak ? `${memory.bad} xato` : `${item.day}-kun`}
                    </Text>
                  </View>
                  <Ticks level={srs.mastery(state, item.id)} weak={weak} width={6} height={16} />
                </Row>
              </Pressable>
            );
          }}
        />
      ) : (
        <View style={{ paddingHorizontal: 18 }}>{empty()}</View>
      )}

      <WordSheet id={open} onClose={() => setOpen(null)} navigation={navigation} />
    </Screen>
  );
}

function EmptyCard({ icon, ko, title, body, action, onAction, soft }) {
  const c = useColors();
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 24, paddingVertical: 34, paddingHorizontal: 24, alignItems: "center", gap: 10 }}>
      {ko ? (
        <Text style={{ fontSize: 34, fontWeight: "900", color: c.ink4 }}>{ko}</Text>
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.tint2, alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon} size={26} color={c.ink4} />
        </View>
      )}
      <Text style={{ fontFamily: FONTS.bold, fontSize: 17, color: c.ink, marginTop: 4, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: c.ink2, textAlign: "center" }}>{body}</Text>
      {action ? <Button title={action} kind={soft ? "soft" : "primary"} size="md" onPress={onAction} style={{ marginTop: 8, paddingHorizontal: 20 }} /> : null}
    </View>
  );
}
