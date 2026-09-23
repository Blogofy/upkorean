// The design in numbers: two palettes, one type scale, one set of corner radii.
//
// Every colour in the app comes from here. The dark palette is not a filter over the light one — it was
// drawn — so the two are written out side by side and a screen only ever asks for a role ("card", "ink2")
// and never for a hex value. That is what lets night mode be a single swap instead of thirty-four edits.
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

export const LIGHT = {
  dark: false,
  bg: "#E8E9E6",
  card: "#FFFFFF",
  // A panel inside a card — a field, a stat box, a row that needs to sit back one step.
  tint: "#F1F2F0",
  tint2: "#E9EAE7",
  line: "#DCDEDA",
  lineStrong: "#D6D9D4",
  ink: "#102221",
  ink2: "#48605C",
  ink3: "#7A8078",
  ink4: "#62756F",
  green: "#1B6F65",
  greenDeep: "#0F3F39",
  greenTint: "#E7F0EA",
  greenLine: "#D7E6DD",
  onGreen: "#FFFFFF",
  danger: "#A8452F",
  dangerInk: "#7E3123",
  dangerTint: "#F6E4E0",
  locked: "#E3E5E1",
  lockedInk: "#C4C8C2",
  // The mastery bars on the results screen: three steps of the one green, lightest for the newest words.
  greenMid: "#4A9B8E",
  greenPale: "#A9C9C1",
  // An empty radio ring and the day in the week grid that has not come yet.
  radio: "#CDD1CB",
  future: "#EFF3F0",
  // The Hangul keyboard is drawn by the app, so it carries its own two greys.
  keyboard: "#DEE0DC",
  keyMod: "#C4C8C2",
  keyInk: "#343A36",
  // The offline banner is the one warm surface in the app, so it cannot be mistaken for an error.
  banner: "#3C3A33",
  bannerInk: "#D6D2C6",
  amber: "#E8B44A",
  overlay: "rgba(16, 34, 33, 0.42)",
  shadow: "#102221",
};

export const DARK = {
  dark: true,
  bg: "#101613",
  card: "#19211D",
  tint: "#222B26",
  tint2: "#1E2622",
  line: "#242D28",
  lineStrong: "#2A332E",
  ink: "#E7EDEA",
  ink2: "#9FADA8",
  ink3: "#8A9993",
  ink4: "#9FADA8",
  green: "#2A9384",
  // On a dark tint the deep green of the light palette disappears, so the roles swap: the bright mint is
  // what carries text and icons over greenTint, and white still carries the filled buttons.
  greenDeep: "#7FD9C2",
  greenTint: "#1E332C",
  greenLine: "#25423A",
  onGreen: "#FFFFFF",
  danger: "#D8705A",
  dangerInk: "#F0A794",
  dangerTint: "#2E1D19",
  locked: "#2A332E",
  lockedInk: "#7B857F",
  greenMid: "#2F7C71",
  greenPale: "#2B4A42",
  radio: "#3A443E",
  future: "#1A221E",
  keyboard: "#151C18",
  keyMod: "#2A332E",
  keyInk: "#E7EDEA",
  banner: "#2E2C26",
  bannerInk: "#CFCABD",
  amber: "#E8B44A",
  overlay: "rgba(0, 0, 0, 0.62)",
  shadow: "#000000",
};

// Gabarito for anything that is a title, Figtree for everything that is read. Korean is left to the
// system font: both platforms ship one that is better than anything worth downloading for it.
export const FONTS = {
  display: "Gabarito_700Bold",
  displayBold: "Gabarito_800ExtraBold",
  body: "Figtree_400Regular",
  medium: "Figtree_500Medium",
  semi: "Figtree_600SemiBold",
  bold: "Figtree_700Bold",
};

export const RADIUS = { sm: 10, md: 13, lg: 16, xl: 20, card: 24, pill: 999 };
export const SPACE = { screen: 20, card: 18, gap: 14 };

// Type roles, so a heading is asked for by name and comes out the same size on every screen.
export const TYPE = {
  h1: { fontFamily: FONTS.display, fontSize: 32, letterSpacing: -0.8, lineHeight: 36 },
  h2: { fontFamily: FONTS.display, fontSize: 28, letterSpacing: -0.6, lineHeight: 32 },
  h3: { fontFamily: FONTS.display, fontSize: 22, letterSpacing: -0.4, lineHeight: 27 },
  h4: { fontFamily: FONTS.display, fontSize: 18, letterSpacing: -0.2, lineHeight: 23 },
  body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: FONTS.bold, fontSize: 13 },
  // The small all-caps line above a block — "50 KUNLIK REJA", "YANGI SO'Z".
  eyebrow: { fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  num: { fontFamily: FONTS.displayBold, fontSize: 28, letterSpacing: -0.6 },
};

const ThemeContext = createContext({ c: LIGHT, scheme: "light", preference: "system" });

// `preference` is the learner's setting — "system", "light" or "dark" — and the device decides only when
// it says "system".
export function ThemeProvider({ preference = "system", children }) {
  const device = useColorScheme();
  const value = useMemo(() => {
    const dark = preference === "dark" || (preference === "system" && device === "dark");
    return { c: dark ? DARK : LIGHT, scheme: dark ? "dark" : "light", preference };
  }, [preference, device]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).c;

// A card's lift. Kept here because iOS and Android express it differently and no screen should have to know.
export const shadow = (c, level = 1) => ({
  shadowColor: c.shadow,
  shadowOpacity: c.dark ? 0.4 : 0.08,
  shadowRadius: level === 2 ? 24 : 12,
  shadowOffset: { width: 0, height: level === 2 ? 10 : 4 },
  elevation: level === 2 ? 6 : 2,
});
