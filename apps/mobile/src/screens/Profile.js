// 26 — Profil. Who, the daily plan, the reminder, night mode, the narrator, and the account itself.
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { BackLink, Button, Dialog, Field, ListRow, Row, Screen, Segmented, Sheet, Title, Toggle } from "../ui";
import { api } from "../api";
import { initial, levelInfo, rangeLine, standardLine } from "../model";
import { syncReminder } from "../notify";
import { PRIVACY_URL, SOURCE_URL } from "../config";

const TIMES = ["08:00", "13:00", "20:00", "21:30"];
const THEMES = [
  { value: "system", label: "Tizim" },
  { value: "light", label: "Kunduzgi" },
  { value: "dark", label: "Tungi" },
];

export default function Profile({ navigation }) {
  const c = useColors();
  const store = useStore();
  const { state, course, user } = store;
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [removeAsk, setRemoveAsk] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  if (!state || !course) return null;

  const profile = state.profile;
  const settings = state.settings;
  const level = levelInfo(store.levels, course.level);
  const xp = srs.levelInfo(state);
  const streak = srs.streak(state);
  const set = (change) => { change(); store.save(); };

  const reminder = async (next) => {
    set(() => { profile.reminders = { ...profile.reminders, ...next }; });
    if (profile.reminders.on) {
      const allowed = await syncReminder(profile.reminders, { ask: true, keptToday: srs.planMet(state), words: srs.dailyWords(state) });
      if (!allowed) store.say("Telefon sozlamalarida bildirishnomalarga ruxsat bering", "bad");
    } else syncReminder(profile.reminders);
  };

  const exportData = () => {
    const learned = srs.learnedIds(state, course).map((id) => {
      const word = course.byId[id];
      const memory = state.words[id];
      return `${word.ko}\t${word.uz}\t${word.lesson}-dars\t${memory.ok}/${memory.ok + memory.bad}`;
    });
    Share.share({
      title: "UpKorean — so'zlarim",
      message: `UpKorean · ${level.ko} · ${learned.length} so'z\n\n${learned.join("\n")}`,
    }).catch(() => {});
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <BackLink label="Natijalar" onPress={() => navigation.goBack()} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 13 }} showsVerticalScrollIndicator={false}>
        <Row gap={16} style={{ backgroundColor: c.green, borderRadius: 26, padding: 22 }}>
          <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 25, color: c.dark ? c.green : c.greenDeep }}>{initial(profile.name)}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Title size={21} c="#FFFFFF" numberOfLines={1}>{profile.name || user?.name}</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: c.greenTint }}>{level.ko} · {xp.level}-daraja · {streak} kunlik seriya</Text>
          </View>
        </Row>

        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
          <Text style={eyebrow(c)}>Kunlik reja</Text>
          <View style={{ gap: 6 }}>
            <Row justify="space-between">
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>{level.ko} darajasida kuniga</Text>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.ink }}>{standardLine(srs.dailyWords(state))}</Text>
            </Row>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: c.ink4 }}>
              {planLine(state, course)}
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>Kunlik takrorlash maqsadi</Text>
            <Segmented
              options={srs.REVIEW_GOAL_CHOICES.map((n) => ({ value: n, label: String(n) }))}
              value={profile.reviewGoal}
              onChange={(goal) => set(() => { profile.reviewGoal = goal; })}
            />
          </View>
        </View>

        <View style={{ backgroundColor: c.card, borderRadius: 22, paddingVertical: 6, paddingHorizontal: 18 }}>
          <ListRow
            title="Eslatmalar"
            sub={profile.reminders.on ? `reja bajarilmagan kuni ${profile.reminders.at} da` : "o'chirilgan"}
            right={<Toggle value={profile.reminders.on} onChange={(on) => reminder({ on })} />}
            chevron={false}
          />
          {profile.reminders.on ? (
            <View style={{ paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.tint2 }}>
              <Segmented options={TIMES.map((t) => ({ value: t, label: t }))} value={profile.reminders.at} onChange={(at) => reminder({ at })} />
            </View>
          ) : null}
          <ListRow
            title="Tungi rejim"
            sub={settings.theme === "system" ? "tizim sozlamasiga ergashadi" : settings.theme === "dark" ? "doim yoqilgan" : "doim o'chirilgan"}
            chevron={false}
          />
          <View style={{ paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: c.tint2 }}>
            <Segmented options={THEMES} value={settings.theme} onChange={(theme) => set(() => { settings.theme = theme; })} />
          </View>
          {store.audio ? (
            <ListRow
              title="Talaffuz ovozi"
              sub="yangi so'z ochilganda avtomatik eshittiriladi"
              right={<Toggle value={settings.autoAudio} onChange={(on) => set(() => { settings.autoAudio = on; })} />}
              chevron={false}
            />
          ) : null}
          <ListRow title="Daraja" sub={`${level.ko} · ${level.uz}`} onPress={() => navigation.navigate("LevelSwitch")} />
          <ListRow title="Ma'lumotlarni yuklab olish" sub="o'rganilgan so'zlar ro'yxati" onPress={exportData} />
          <ListRow title="Maxfiylik siyosati" sub="qanday ma'lumot saqlanadi" onPress={() => Linking.openURL(PRIVACY_URL)} />
          {/* The word list is 공공누리 type 1: free to use, as long as its source is named where it is used. */}
          <ListRow title="So'zlar manbasi" sub="국립국어원 (Koreya Milliy til instituti) · 공공누리 1유형" onPress={() => Linking.openURL(SOURCE_URL)} />
          <ListRow last title="Hisob" sub={user?.email || profile.email} onPress={user?.demo ? undefined : () => setAccountOpen(true)} chevron={!user?.demo} />
        </View>

        <Button title="Chiqish" kind="white" textStyle={{ color: c.danger }} onPress={() => setLeaveAsk(true)} style={{ marginTop: 6 }} />
        {user?.demo ? null : (
          <Pressable onPress={() => setRemoveAsk(true)} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 6 }}>
            <Text style={{ fontFamily: FONTS.semi, fontSize: 13, color: c.ink4 }}>Hisobni o'chirish</Text>
          </Pressable>
        )}
      </ScrollView>

      <Dialog
        visible={leaveAsk}
        title="Hisobdan chiqasizmi?"
        body="Progress serverda saqlangan. Qayta kirganingizda hammasi joyida bo'ladi."
        confirm="Chiqish"
        cancel="Qolish"
        danger
        onConfirm={() => { setLeaveAsk(false); store.signOut(); }}
        onCancel={() => setLeaveAsk(false)}
      />
      <RemoveAccount visible={removeAsk} onClose={() => setRemoveAsk(false)} />
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </Screen>
  );
}

// Deleting the account asks for the password: it cannot be undone, and a phone left unlocked is not
// the owner asking.
function RemoveAccount({ visible, onClose }) {
  const c = useColors();
  const store = useStore();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await store.deleteAccount(password);
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.overlay, alignItems: "center", justifyContent: "center", padding: 28 }}>
        <View style={{ width: "100%", maxWidth: 380, backgroundColor: c.card, borderRadius: 26, padding: 24, gap: 12 }}>
          <Title size={22}>Hisobni o'chirish</Title>
          <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21, color: c.ink2 }}>
            Hisob va butun progress butunlay o'chiriladi. Buni qaytarib bo'lmaydi.
          </Text>
          <Field
            label="Parolingiz"
            value={password}
            onChangeText={(text) => { setPassword(text); setError(null); }}
            secureTextEntry
            autoCapitalize="none"
            error={error}
            boxStyle={{ backgroundColor: c.tint }}
          />
          <Button title="O'chirish" kind="danger" loading={busy} disabled={!password} onPress={remove} style={{ marginTop: 6 }} />
          <Button title="Bekor qilish" kind="ghost" onPress={() => { setPassword(""); setError(null); onClose(); }} />
        </View>
      </View>
    </Modal>
  );
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });

// How long the rest of the level takes on its plan, from where the standard stands now.
function planLine(state, course) {
  const left = Math.max(0, course.words.length - srs.learnedIds(state, course).length);
  if (!left) return "Ochiq so'zlarning hammasi o'rganilgan.";
  const range = srs.dailyRange(course.level);
  const grows = range.to > range.from ? ` Reja har hafta ${srs.DAILY_STEP} so'zga oshib boradi: ${rangeLine(range)}.` : "";
  return `Qolgan ${left} so'z taxminan ${srs.levelDays(course.level, left, srs.dailyWords(state))} kunda tugaydi.${grows}`;
}

// Name and password, in a sheet from the "Hisob" row. The server signs every other device out on a
// password change and hands this one a new session, which api.changePassword keeps.
function AccountSheet({ visible, onClose }) {
  const c = useColors();
  const store = useStore();
  const [name, setName] = useState(store.user?.name || "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const rename = async () => {
    setBusy("name"); setError(null);
    try {
      const data = await api.rename(name.trim());
      store.updateUser(data.user);
      store.say("Ism saqlandi", "ok");
    } catch (problem) { setError({ field: "name", message: problem.message }); }
    finally { setBusy(null); }
  };
  const password = async () => {
    setBusy("password"); setError(null);
    try {
      const data = await api.changePassword(current, next);
      if (data?.user) store.updateUser(data.user);
      setCurrent(""); setNext("");
      store.say("Parol o'zgartirildi. Boshqa qurilmalardan chiqildi.", "ok");
      onClose();
    } catch (problem) { setError({ field: problem.field === "current" ? "current" : "next", message: problem.message }); }
    finally { setBusy(null); }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Hisob">
      <View style={{ paddingHorizontal: 22, gap: 14, paddingBottom: 8 }}>
        <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 16, gap: 12 }}>
          <Field label="Ism" value={name} onChangeText={(t) => { setName(t); setError(null); }} autoCapitalize="words" boxStyle={{ backgroundColor: c.tint }}
            error={error?.field === "name" ? error.message : null} />
          <Button title="Ismni saqlash" size="md" loading={busy === "name"} disabled={!name.trim() || name.trim() === store.user?.name} onPress={rename} />
        </View>
        {store.user?.hasPassword ? (
          <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 16, gap: 12 }}>
            <Field label="Hozirgi parol" value={current} onChangeText={(t) => { setCurrent(t); setError(null); }} secureTextEntry autoCapitalize="none" boxStyle={{ backgroundColor: c.tint }}
              error={error?.field === "current" ? error.message : null} />
            <Field label="Yangi parol" value={next} onChangeText={(t) => { setNext(t); setError(null); }} secureTextEntry autoCapitalize="none" boxStyle={{ backgroundColor: c.tint }}
              hint="kamida 8 belgi" error={error?.field === "next" ? error.message : null} />
            <Button title="Parolni o'zgartirish" size="md" kind="soft" loading={busy === "password"} disabled={!current || next.length < 8} onPress={password} />
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}
