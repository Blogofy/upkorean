// 02 — Ro'yxatdan o'tish. Three fields and a strength bar; the server has the last word on each of them.
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Col, Field, Screen, Title, Txt } from "../ui";
import { BackTo, StrengthBar } from "./authParts";
import GoogleButton, { googleReady } from "./GoogleButton";
import { PRIVACY_URL } from "../config";

export default function SignUp({ navigation }) {
  const c = useColors();
  const store = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!name.trim()) return setError({ field: "name", message: "Ismingizni yozing" });
    if (!email.trim()) return setError({ field: "email", message: "Emailni yozing" });
    if (password.length < 8) return setError({ field: "password", message: "Parol kamida 8 belgidan iborat bo'lsin." });
    setBusy(true);
    try {
      await store.auth.register(name.trim(), email.trim(), password);
    } catch (problem) {
      setError({ field: problem.field, message: problem.message });
    } finally {
      setBusy(false);
    }
  };

  const clear = () => setError(null);

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 34, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <Col gap={8}>
            <BackTo label="Kirish" onPress={() => navigation.goBack()} />
            <Title size={30} style={{ marginTop: 12 }}>Hisob yarataylik</Title>
            <Txt c="ink2">Progress barcha qurilmalaringizda saqlanadi.</Txt>
          </Col>

          <Col gap={12} style={{ marginTop: 26 }}>
            <Field
              label="Ismingiz"
              value={name}
              onChangeText={(text) => { setName(text); clear(); }}
              placeholder="Aziz Rahimov"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              error={error?.field === "name" ? error.message : null}
            />
            <Field
              ref={emailRef}
              label="Email"
              value={email}
              onChangeText={(text) => { setEmail(text); clear(); }}
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
              onChangeText={(text) => { setPassword(text); clear(); }}
              placeholder="kamida 8 belgi"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error?.field === "password" ? error.message : null}
              right={
                <Pressable onPress={() => setShow((on) => !on)} hitSlop={10}>
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>{show ? "Yashirish" : "Ko'rsatish"}</Text>
                </Pressable>
              }
            />
            <StrengthBar password={password} />
            {error && !["name", "email", "password"].includes(error.field) ? <Txt t="bodySm" c="dangerInk">{error.message}</Txt> : null}
            <Button title="Davom etish" onPress={submit} loading={busy} style={{ marginTop: 8 }} />
            {googleReady(store.config) ? <GoogleButton label="Google bilan ro'yxatdan o'tish" onError={(message) => setError({ message })} /> : null}
          </Col>

          <View style={{ flex: 1, minHeight: 20 }} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 19, color: c.ink2, textAlign: "center" }}>
            Davom etish orqali{" "}
            <Text accessibilityRole="link" onPress={() => Linking.openURL(PRIVACY_URL)} style={{ fontFamily: FONTS.bold, color: c.green, textDecorationLine: "underline" }}>maxfiylik siyosati</Text>ga rozilik bildirasiz.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
