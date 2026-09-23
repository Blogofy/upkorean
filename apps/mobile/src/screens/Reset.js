// 03 — Parolni tiklash. Two halves: asking for the email, and setting the new password once the code is
// here. The code arrives by the link in the email (upkorean://reset/<code> opens this screen with it) or
// is typed in by hand from the page the link opens in a browser.
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { Button, Col, Field, Note, Screen, Title, Txt } from "../ui";
import { BackTo, StrengthBar } from "./authParts";

export default function Reset({ navigation, route }) {
  const c = useColors();
  const store = useStore();
  const [email, setEmail] = useState(route.params?.email || "");
  const [token, setToken] = useState(route.params?.token || "");
  const [mode, setMode] = useState(route.params?.token ? "set" : "ask"); // "ask" | "sent" | "code" | "set"
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("SignIn"));

  const ask = async () => {
    if (!email.trim()) return setError({ field: "email", message: "Emailni yozing" });
    setBusy(true);
    setError(null);
    try {
      const answer = await store.auth.forgot(email.trim());
      // A development server hands the link straight back instead of emailing it.
      const devToken = answer?.devLink ? String(answer.devLink).split("/reset/")[1] : "";
      if (devToken) { setToken(devToken); setMode("set"); } else setMode("sent");
    } catch (problem) {
      setError({ field: problem.field || "email", message: problem.message });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (password.length < 8) return setError({ field: "password", message: "Parol kamida 8 belgidan iborat bo'lsin." });
    if (password !== repeat) return setError({ field: "repeat", message: "Parollar bir xil emas" });
    setBusy(true);
    setError(null);
    try {
      await store.auth.reset(token.trim(), password);
    } catch (problem) {
      setError({ field: problem.field, message: problem.message });
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (mode === "ask" || mode === "sent") {
    body = (
      <>
        <Col gap={8}>
          <BackTo label="Kirish" onPress={back} />
          <Title size={30} style={{ marginTop: 12 }}>Parolni tiklash</Title>
          <Txt c="ink2">Emailingizga yangi parol o'rnatish havolasini yuboramiz.</Txt>
        </Col>
        <Col gap={12} style={{ marginTop: 26 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={(text) => { setEmail(text); setError(null); if (mode === "sent") setMode("ask"); }}
            placeholder="aziz@mail.uz"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={ask}
            error={error?.field === "email" ? error.message : null}
          />
          {error && error.field !== "email" ? <Txt t="bodySm" c="dangerInk">{error.message}</Txt> : null}
          <Button title={mode === "sent" ? "Qayta yuborish" : "Havola yuborish"} onPress={ask} loading={busy} style={{ marginTop: 8 }} />
          <Button title="Kodim bor" kind="white" onPress={() => { setError(null); setMode("code"); }} />
        </Col>
        {mode === "sent" ? (
          <Note title="Havola yuborildi" style={{ marginTop: 22 }} tone="white">
            {`${email.trim()} manziliga xat keldi. Undagi tugma ilovani ochadi. Xat topilmasa, «Spam» papkasini tekshiring.`}
          </Note>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <Col gap={8}>
          <BackTo label="Kirish" onPress={back} />
          <Title size={30} style={{ marginTop: 12 }}>Yangi parol</Title>
          <Txt c="ink2">{email.trim() ? `${email.trim()} uchun yangi parol o'rnating.` : "Hisobingiz uchun yangi parol o'rnating."}</Txt>
        </Col>
        <Col gap={12} style={{ marginTop: 26 }}>
          {mode === "code" ? (
            <Field
              label="Kod"
              value={token}
              onChangeText={(text) => { setToken(text.trim()); setError(null); }}
              placeholder="xatdagi kod"
              autoCapitalize="none"
              autoCorrect={false}
              error={error?.field === "token" ? error.message : null}
            />
          ) : null}
          <Field
            label="Yangi parol"
            value={password}
            onChangeText={(text) => { setPassword(text); setError(null); }}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={error?.field === "password" ? error.message : null}
            right={
              <Pressable onPress={() => setShow((on) => !on)} hitSlop={10}>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>{show ? "Yashirish" : "Ko'rsatish"}</Text>
              </Pressable>
            }
          />
          <Field
            label="Takrorlang"
            value={repeat}
            onChangeText={(text) => { setRepeat(text); setError(null); }}
            secureTextEntry={!show}
            autoCapitalize="none"
            returnKeyType="go"
            onSubmitEditing={save}
            error={error?.field === "repeat" ? error.message : null}
          />
          <StrengthBar password={password} />
          {error && !["password", "repeat", "token"].includes(error.field) ? <Txt t="bodySm" c="dangerInk">{error.message}</Txt> : null}
          <Button title="Parolni saqlash" onPress={save} loading={busy} disabled={!token.trim()} style={{ marginTop: 8 }} />
        </Col>
        <Note title="Havola 30 daqiqa amal qiladi" tone="white" style={{ marginTop: 22 }}>
          Muddati o'tgan bo'lsa, kirish sahifasidan yangi havola so'rang.
        </Note>
      </>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 26, paddingTop: 34, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
