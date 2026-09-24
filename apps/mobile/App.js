// The shell: fonts, the store, the theme the learner chose, and which flow to show.
//
// Everything a screen needs comes from the store (src/store.js). This file only decides between four
// states — still starting, nobody signed in, ready, and the one failure the app cannot get past on its own
// (no network and nothing stored yet) — and keeps the daily reminder in step with the saved profile.
import { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// One import per weight: the packages' index pulls in every weight and italic, a megabyte nobody uses.
import { Gabarito_700Bold } from "@expo-google-fonts/gabarito/700Bold";
import { Gabarito_800ExtraBold } from "@expo-google-fonts/gabarito/800ExtraBold";
import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";

import * as srs from "@upkorean/shared/srs.js";

import { StoreProvider, useStore } from "./src/store";
import { ThemeProvider, useTheme } from "./src/theme";
import { AppFlow, AuthFlow, Navigation } from "./src/nav";
import { Failed, Loading, Toast } from "./src/ui";
import { syncReminder } from "./src/notify";
import { API_URL } from "./src/config";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsReady] = useFonts({
    Gabarito_700Bold, Gabarito_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
  });
  useEffect(() => { if (fontsReady) SplashScreen.hideAsync().catch(() => {}); }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

// The theme is a setting inside the progress object, so it can only be read once the store has it.
function Themed() {
  const store = useStore();
  return (
    <ThemeProvider preference={store.state?.settings?.theme || "system"}>
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const store = useStore();
  const { c, scheme } = useTheme();
  const reminders = store.state?.profile?.reminders;
  const onboarded = !!store.state?.profile?.onboarded;
  const keptToday = store.state ? srs.planMet(store.state) : false;
  const words = store.state ? srs.dailyWords(store.state) : 20;

  // Whatever the phone has scheduled is replaced by what the profile says, on every start and change — and
  // once today's plan is kept, today's reminder is dropped.
  useEffect(() => {
    if (store.phase === "ready" && onboarded) syncReminder(reminders, { keptToday, words });
  }, [store.phase, onboarded, reminders?.on, reminders?.at, keptToday, words]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (store.phase === "boot") body = <Loading label="UpKorean ochilmoqda…" />;
  else if (store.phase === "failed") {
    body = (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Failed
          title="Ulanib bo'lmadi"
          body={`${store.bootError || "Internet aloqasini tekshiring."}\n\nKurs birinchi marta yuklanishi uchun internet kerak.`}
          onAction={store.retryBoot}
        />
      </View>
    );
  } else {
    body = (
      <Navigation>
        {store.phase === "auth" ? <AuthFlow /> : <AppFlow />}
      </Navigation>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {body}
      <Toast
        key={store.toast?.at}
        message={store.toast?.message}
        tone={store.toast?.tone}
        onDone={store.clearToast}
      />
      {__DEV__ ? <DevHost url={API_URL} /> : null}
    </View>
  );
}

// Nothing on screen in development either; the API address is logged once so a wrong one is easy to spot.
function DevHost({ url }) {
  useEffect(() => { console.log(`[UpKorean] API: ${url}`); }, [url]);
  return null;
}
