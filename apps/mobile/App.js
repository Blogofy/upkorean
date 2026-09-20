// The smallest app that proves the whole chain works end to end: the server's config, signing in with a
// bearer token, the course downloaded to the device, and a day of words on screen. Every real screen —
// the session, review, the profile — gets built on top of src/api.js and src/content.js from here.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { api, ApiError, restoreSession } from "./src/api";
import { API_URL } from "./src/config";
import { loadLevel } from "./src/content";

const TEAL = "#207F73";
const INK = "#16302c";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  const boot = useCallback(async () => {
    setError("");
    try {
      setConfig(await api.config());
      if (await restoreSession()) {
        const me = await api.me();
        setUser(me.user || null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { boot(); }, [boot]);

  if (booting) return <Center><ActivityIndicator color={TEAL} size="large" /></Center>;
  if (!user) return <SignIn config={config} error={error} onRetry={boot} onSignedIn={setUser} />;
  return <Home user={user} onSignedOut={() => setUser(null)} />;
}

function SignIn({ config, error: bootError, onRetry, onSignedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      const data = await action();
      onSignedIn(data.user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Kutilmagan xatolik");
    } finally {
      setBusy(false);
    }
  };

  const registering = mode === "register";
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <StatusBar style="auto" />
      <Text style={styles.brand}>UpKorean</Text>
      <Text style={styles.lead}>30 kunda TOPIK II so’z boyligi</Text>

      {registering && <Field label="Ism" value={name} onChangeText={setName} autoCapitalize="words" />}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Parol" value={password} onChangeText={setPassword} secureTextEntry />

      {!!(error || bootError) && <Text style={styles.error}>{error || bootError}</Text>}
      {!!bootError && (
        <Pressable onPress={onRetry}>
          <Text style={styles.link}>Qayta urinish</Text>
        </Pressable>
      )}

      <Button
        label={registering ? "Ro’yxatdan o’tish" : "Kirish"}
        busy={busy}
        onPress={() => run(() => (registering ? api.register(name, email, password) : api.login(email, password)))}
      />
      <Pressable onPress={() => { setMode(registering ? "login" : "register"); setError(""); }}>
        <Text style={styles.link}>{registering ? "Hisobingiz bormi? Kiring" : "Hisob yo’qmi? Ro’yxatdan o’ting"}</Text>
      </Pressable>
      {config?.demo && (
        <Pressable onPress={() => run(() => api.demo())}>
          <Text style={styles.link}>Demo hisob bilan ko’rish</Text>
        </Pressable>
      )}
      {!!bootError && <Text style={styles.footnote}>{API_URL}</Text>}
    </ScrollView>
  );
}

function Home({ user, onSignedOut }) {
  const [content, setContent] = useState(null);
  const [day, setDay] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLevel(user.level || "b").then(setContent).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Center>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => { setError(""); loadLevel(user.level || "b").then(setContent).catch((e) => setError(e.message)); }}>
          <Text style={styles.link}>Qayta urinish</Text>
        </Pressable>
      </Center>
    );
  }
  if (!content) return <Center><ActivityIndicator color={TEAL} size="large" /><Text style={styles.muted}>Kurs yuklanmoqda…</Text></Center>;

  const words = content.dayWords(day);
  return (
    <View style={styles.screenTop}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Salom, {user.name}</Text>
          <Text style={styles.muted}>
            {content.dayCount} kun · {content.words.length} so’z{content.offline ? " · oflayn nusxa" : ""}
          </Text>
        </View>
        <Pressable onPress={() => api.logout().then(onSignedOut)}>
          <Text style={styles.link}>Chiqish</Text>
        </Pressable>
      </View>

      <View style={styles.dayRow}>
        <Pressable style={styles.step} onPress={() => setDay((d) => Math.max(1, d - 1))}><Text style={styles.stepText}>‹</Text></Pressable>
        <Text style={styles.dayLabel}>{day}-kun</Text>
        <Pressable style={styles.step} onPress={() => setDay((d) => Math.min(content.dayCount, d + 1))}><Text style={styles.stepText}>›</Text></Pressable>
      </View>

      <FlatList
        data={words}
        keyExtractor={(w) => w.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.korean}>{item.ko}</Text>
            <Text style={styles.uzbek}>{item.uz}</Text>
            {!!content.examples[item.id] && <Text style={styles.example}>{content.examples[item.id].ko}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const Center = ({ children }) => <View style={[styles.screen, styles.center]}>{children}</View>;

const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#9bb0ab" {...props} />
  </View>
);

const Button = ({ label, busy, onPress }) => (
  <Pressable style={[styles.button, busy && styles.buttonBusy]} disabled={busy} onPress={onPress}>
    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
  </Pressable>
);

const styles = StyleSheet.create({
  screen: { flexGrow: 1, padding: 24, paddingTop: 72, backgroundColor: "#f6faf8" },
  screenTop: { flex: 1, paddingTop: 64, backgroundColor: "#f6faf8" },
  center: { alignItems: "center", justifyContent: "center", gap: 12 },
  brand: { fontSize: 34, fontWeight: "800", color: TEAL },
  lead: { fontSize: 15, color: "#5b7671", marginBottom: 28 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, color: "#5b7671", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d3e3de", borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: "#fff", color: INK },
  button: { backgroundColor: TEAL, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { color: TEAL, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 16 },
  error: { color: "#b3261e", fontSize: 14, marginBottom: 8 },
  muted: { color: "#5b7671", fontSize: 13 },
  footnote: { color: "#9bb0ab", fontSize: 12, textAlign: "center", marginTop: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 24 },
  hello: { fontSize: 22, fontWeight: "800", color: INK },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, paddingVertical: 16 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e4efec", alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 22, color: TEAL, lineHeight: 26 },
  dayLabel: { fontSize: 17, fontWeight: "700", color: INK, minWidth: 90, textAlign: "center" },
  list: { paddingHorizontal: 24, paddingBottom: 40 },
  row: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#e7f0ed" },
  korean: { fontSize: 20, fontWeight: "700", color: INK },
  uzbek: { fontSize: 15, color: "#41605a", marginTop: 2 },
  example: { fontSize: 13, color: "#7d948f", marginTop: 8 },
});
