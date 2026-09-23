// "Google bilan davom etish" — shown only when the server has an OAuth client for this platform. The
// hook throws without its client id, so the caller renders this component only when `googleReady` says so.
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { useStore } from "../store";
import { FONTS, useColors } from "../theme";
import { tapped } from "../ui";

WebBrowser.maybeCompleteAuthSession();

export const googleReady = (config) =>
  !!(Platform.OS === "android" ? config?.googleAndroid : Platform.OS === "ios" ? config?.googleIos : config?.google);

const GoogleMark = () => (
  <Svg width={19} height={19} viewBox="0 0 48 48">
    <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.2-3.8 6.6-9.5 6.6-15.7" />
    <Path fill="#34A853" d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.3c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3 0-6.7 5.2-.1.3C8 41.4 15.4 46 24 46" />
    <Path fill="#FBBC05" d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l0-.3-6.8-5.3-.2.1C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 9.9z" />
    <Path fill="#EA4335" d="M24 9.9c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.7 29.9 1.5 24 1.5 15.4 1.5 8 6.1 4.5 14.1l7 5.4C13.3 13.7 18.2 9.9 24 9.9" />
  </Svg>
);

export default function GoogleButton({ label = "Google bilan davom etish", onError }) {
  const c = useColors();
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: store.config.googleAndroid || undefined,
    iosClientId: store.config.googleIos || undefined,
    webClientId: store.config.google || undefined,
  });

  useEffect(() => {
    if (response?.type !== "success") { if (response) setBusy(false); return; }
    const credential = response.params?.id_token;
    if (!credential) { setBusy(false); onError?.("Google javob bermadi"); return; }
    store.auth.google({ credential })
      .catch((problem) => onError?.(problem.message))
      .finally(() => setBusy(false));
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!request || busy}
      onPress={() => { tapped(); setBusy(true); promptAsync().catch(() => setBusy(false)); }}
      style={({ pressed }) => [{
        height: 54, borderRadius: 17, backgroundColor: c.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 11,
        opacity: !request || busy ? 0.5 : pressed ? 0.85 : 1,
      }]}
    >
      <View><GoogleMark /></View>
      <Text style={{ fontFamily: FONTS.bold, fontSize: 15, color: c.ink }}>{busy ? "Kutilmoqda…" : label}</Text>
    </Pressable>
  );
}
