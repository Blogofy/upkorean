// 01 — Kirish. The first screen anyone sees, so it says what the app is before it asks for anything.
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useStore } from "../store";
import { useColors } from "../theme";
import { Button, Col, Field, Ko, Row, Screen, Txt } from "../ui";
import GoogleButton, { googleReady } from "./GoogleButton";

export default function SignIn({ navigation }) {
  const c = useColors();
  const store = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const passwordRef = useRef(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError({ field: !email.trim() ? "email" : "password", message: "To'ldiring" });
      return;
    }
    setBusy(true);
    try {
      await store.auth.login(email.trim(), password);
    } catch (problem) {
      setError({ field: problem.field, message: problem.message });
    } finally {
      setBusy(false);
    }
  };

  const tryDemo = async () => {
    setBusy(true);
    setError(null);
    try { await store.auth.demo(); } catch (problem) { setError({ message: problem.message }); } finally { setBusy(false); }
  };

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingTop: 34, gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.green, alignItems: "center", justifyContent: "center" }}>
              <Ko size={26} c="onGreen">가</Ko>
            </View>
            <Col gap={6}>
              <Txt t="h1">Xush kelibsiz</Txt>
              <Txt t="body" c="ink2">Har bir daraja uchun so'zlar, kundalik reja bilan. O'zbek tilida.</Txt>
            </Col>
          </View>

          <Col gap={12} style={{ marginTop: 36 }}>
            <Field
              label="Email"
              value={email}
              onChangeText={(text) => { setEmail(text); setError(null); }}
              placeholder="aziz@mail.uz"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={error?.field === "email" ? error.message : null}
            />
            <Field
              ref={passwordRef}
              label="Parol"
              value={password}
              onChangeText={(text) => { setPassword(text); setError(null); }}
              placeholder="••••••••"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error?.field === "password" ? error.message : null}
              right={
                <Pressable onPress={() => setShow((on) => !on)} hitSlop={10}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: c.green }}>{show ? "Yashirish" : "Ko'rsatish"}</Text>
                </Pressable>
              }
            />

            <Pressable onPress={() => navigation.navigate("Reset", { email: email.trim() })} hitSlop={8} style={{ alignSelf: "flex-end" }}>
              <Text style={{ fontSize: 13.5, fontWeight: "600", color: c.green }}>Parolni unutdingizmi?</Text>
            </Pressable>

            {error && !error.field ? <Txt t="bodySm" c="dangerInk">{error.message}</Txt> : null}

            <Button title="Kirish" onPress={submit} loading={busy} style={{ marginTop: 6 }} />

            {googleReady(store.config) ? (
              <>
                <Row gap={12} style={{ paddingVertical: 4 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong }} />
                  <Txt t="bodySm" c="ink2">yoki</Txt>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong }} />
                </Row>
                <GoogleButton onError={(message) => setError({ message })} />
              </>
            ) : null}

            {store.config.demo ? (
              <>
                <Row gap={12} style={{ paddingVertical: 4 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong }} />
                  <Txt t="bodySm" c="ink2">yoki</Txt>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.lineStrong }} />
                </Row>
                <Button title="Sinab ko'rish" kind="plain" icon="play" onPress={tryDemo} disabled={busy} />
              </>
            ) : null}
          </Col>

          <View style={{ flex: 1, minHeight: 28 }} />
          <Pressable onPress={() => navigation.navigate("SignUp")} style={{ alignSelf: "center" }} hitSlop={8}>
            <Text style={{ fontSize: 14, color: c.ink2 }}>
              Hisobingiz yo'qmi? <Text style={{ fontWeight: "700", color: c.green }}>Ro'yxatdan o'tish</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
