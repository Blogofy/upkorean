// How the screens fit together.
//
// Five tabs for the things done every day, and a stack over them for everything that is entered and left:
// a day, a session, a summary. A session is pushed without the tab bar on purpose — the way out of it is
// its own ✕, which asks first, because a tab tapped by accident mid-question would throw the sitting away.
// "Ko'proq" is a small stack of its own (results, achievements, profile) so the tab bar stays under it.
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { FONTS, useTheme } from "./theme";
import { tapped } from "./ui";
import { useStore } from "./store";
import * as srs from "@upkorean/shared/srs.js";

import SignInScreen from "./screens/SignIn";
import SignUpScreen from "./screens/SignUp";
import ResetScreen from "./screens/Reset";
import OnboardingScreen from "./screens/Onboarding";
import TodayScreen from "./screens/Today";
import CourseScreen from "./screens/Course";
import DayScreen from "./screens/Day";
import SessionScreen from "./screens/Session";
import DayDoneScreen from "./screens/DayDone";
import ReviewScreen from "./screens/Review";
import SessionDoneScreen from "./screens/SessionDone";
import PracticeScreen from "./screens/Practice";
import WordsScreen from "./screens/Words";
import ResultsScreen from "./screens/Results";
import AchievementsScreen from "./screens/Achievements";
import ProfileScreen from "./screens/Profile";
import LevelSwitchScreen from "./screens/LevelSwitch";
import LevelDoneScreen from "./screens/LevelDone";
import PaywallScreen from "./screens/Paywall";
import OfflineScreen from "./screens/Offline";

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

// The design's own icons, drawn on a 24-unit grid. Feather has close cousins, but not these.
const TAB_ICONS = {
  Today: { d: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", cap: "butt" },
  Course: { d: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14", cap: "butt" },
  Review: { d: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7", cap: "round" },
  Words: { d: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8", cap: "butt" },
  More: { d: "M4 7h16M4 12h16M4 17h16", cap: "round" },
};
const TAB_LABELS = { Today: "Bugun", Course: "Kurs", Review: "Takror", Words: "So'zlar", More: "Ko'proq" };

// The badge over the review tab is the number of words waiting, which is the one thing worth pulling
// someone back into the app for. It turns red when some of them are already late.
function TabBar({ state, navigation }) {
  const { c } = useTheme();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const goal = store.state && store.course ? srs.reviewGoal(store.state, store.course) : null;
  const badge = goal ? goal.left : 0;

  return (
    <View style={{
      flexDirection: "row", backgroundColor: c.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingTop: 12, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 18),
    }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? c.green : c.ink4;
        const icon = TAB_ICONS[route.name];
        const count = route.name === "Review" ? badge : 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={TAB_LABELS[route.name]}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) { tapped(); navigation.navigate(route.name); }
            }}
            style={{ flex: 1, alignItems: "center", gap: 5 }}
          >
            <View>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d={icon.d} stroke={color} strokeWidth={focused ? 2 : 1.8} strokeLinejoin="round" strokeLinecap={icon.cap} />
              </Svg>
              {count > 0 ? (
                <View style={{
                  position: "absolute", top: -6, left: 13, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: goal.late > 0 && !focused ? c.danger : c.green,
                }}>
                  <Text style={{ fontFamily: FONTS.displayBold, fontSize: 10, color: c.onGreen }}>{count > 99 ? "99+" : count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: focused ? FONTS.bold : FONTS.body, fontSize: 11, color }}>{TAB_LABELS[route.name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MoreFlow() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false, ...push }}>
      <MoreStack.Screen name="Results" component={ResultsScreen} />
      <MoreStack.Screen name="Achievements" component={AchievementsScreen} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, animation: "shift" }}>
      <Tabs.Screen name="Today" component={TodayScreen} />
      <Tabs.Screen name="Course" component={CourseScreen} />
      <Tabs.Screen name="Review" component={ReviewScreen} />
      <Tabs.Screen name="Words" component={WordsScreen} />
      <Tabs.Screen name="More" component={MoreFlow} />
    </Tabs.Navigator>
  );
}

export function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, ...push }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="Reset" component={ResetScreen} />
    </AuthStack.Navigator>
  );
}

// A sheet route draws its own rise and fall (SheetScreen), so the navigator adds none of its own.
const sheet = { presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } };
// One motion for everything that is pushed: the iOS slide, on Android too, where the platform default is a
// zoom-and-fade that reads as a different app. A result screen fades up out of the sitting it closes.
const push = { animation: "ios_from_right", animationDuration: 320, gestureEnabled: true };
const rise = { animation: "fade_from_bottom", animationDuration: 280 };

export function AppFlow() {
  const store = useStore();
  const onboarded = !!store.state?.profile?.onboarded;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...push }}>
      {!onboarded
        ? <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: "fade" }} />
        : null}
      <Stack.Screen name="Tabs" component={MainTabs} options={{ animation: "fade" }} />
      <Stack.Screen name="Day" component={DayScreen} />
      <Stack.Screen name="Session" component={SessionScreen} options={{ ...rise, gestureEnabled: false }} />
      <Stack.Screen name="DayDone" component={DayDoneScreen} options={{ ...rise, gestureEnabled: false }} />
      <Stack.Screen name="SessionDone" component={SessionDoneScreen} options={{ ...rise, gestureEnabled: false }} />
      <Stack.Screen name="LevelDone" component={LevelDoneScreen} options={{ ...rise, gestureEnabled: false }} />
      <Stack.Screen name="Practice" component={PracticeScreen} />
      <Stack.Screen name="LevelSwitch" component={LevelSwitchScreen} options={sheet} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={rise} />
      <Stack.Screen name="Offline" component={OfflineScreen} />
    </Stack.Navigator>
  );
}

// The password-reset email opens upkorean://reset/<token>, which lands on the reset screen with the code
// already filled in.
const linking = {
  prefixes: ["upkorean://"],
  config: { screens: { Reset: "reset/:token", SignIn: "signin" } },
};

// React Navigation paints the gaps between screens itself — during a push, behind a sheet — so it is given
// the same palette as everything else, or night mode flashes white at every transition.
export function Navigation({ children }) {
  const { c, scheme } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.card, text: c.ink, border: c.line, primary: c.green },
  };
  return <NavigationContainer theme={theme} linking={linking}>{children}</NavigationContainer>;
}
