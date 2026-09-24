// The parts every screen is built from.
//
// Nothing here knows about the course. These are the design's shapes — a card, a filled button, a ring
// around a number — with its colours already wired in, so a screen reads as a list of what it shows rather
// than a wall of style objects. Anything that appears twice in the design lives here; anything that
// appears once stays in its screen.
import { forwardRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";

import { FONTS, RADIUS, SPACE, TYPE, shadow, useColors } from "./theme";

export { Feather };

// A tap that is felt as well as seen. Silently does nothing where the platform has no motor.
export const tapped = (style = "light") => {
  if (Platform.OS === "web") return;
  const kind = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy }[style];
  if (kind) Haptics.impactAsync(kind).catch(() => {});
  else Haptics.notificationAsync(style === "ok" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
};

// ---------- Text ----------
// `t` names a role from the type scale; `c` a colour role from the palette. Everything else is a style.
export function Txt({ t = "body", c: role = "ink", style, children, ...rest }) {
  const colors = useColors();
  return <Text style={[TYPE[t] || TYPE.body, { color: colors[role] || role }, style]} {...rest}>{children}</Text>;
}

// Korean is set in the system font, one notch larger than the Latin around it: at the same nominal size
// Hangul reads smaller, and these are the characters a learner is trying to see.
export function Ko({ size = 20, weight = "700", c: role = "ink", style, children, ...rest }) {
  const colors = useColors();
  return (
    <Text
      style={[{ fontSize: size, fontWeight: weight, color: colors[role] || role, lineHeight: Math.round(size * 1.35) }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}

// ---------- Layout ----------
export function Screen({ children, style, edges = ["top"], scroll = false, contentStyle, ...rest }) {
  const colors = useColors();
  const body = scroll
    ? <ScrollView
        contentContainerStyle={[{ padding: SPACE.screen, paddingBottom: 40 }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        {...rest}
      >{children}</ScrollView>
    : children;
  return <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{body}</SafeAreaView>;
}

export const Row = ({ gap = 0, align = "center", justify = "flex-start", wrap = false, style, children, ...rest }) => (
  <View style={[{ flexDirection: "row", alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? "wrap" : "nowrap" }, style]} {...rest}>
    {children}
  </View>
);

export const Col = ({ gap = 0, style, children, ...rest }) => (
  <View style={[{ gap }, style]} {...rest}>{children}</View>
);

export const Spacer = ({ h = 0, flex = 0 }) => <View style={{ height: h, flex }} />;

export function Card({ style, pad = SPACE.card, lifted = false, children, onPress, ...rest }) {
  const colors = useColors();
  const box = [{ backgroundColor: colors.card, borderRadius: RADIUS.card, padding: pad }, lifted && shadow(colors, 1), style];
  if (!onPress) return <View style={box} {...rest}>{children}</View>;
  return <Pressable style={({ pressed }) => [box, pressed && { opacity: 0.85 }]} onPress={onPress} {...rest}>{children}</Pressable>;
}

// A card's own divider: full-bleed, so it reaches the card's edges rather than floating inside its padding.
export const Divider = ({ inset = 0 }) => {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.line, marginHorizontal: -inset }} />;
};

// ---------- Buttons ----------
const BUTTON_HEIGHT = { lg: 54, md: 46, sm: 38 };

export function Button({
  title, onPress, kind = "primary", size = "lg", icon, iconRight, disabled, loading,
  style, textStyle, haptic = "light", ...rest
}) {
  const colors = useColors();
  const height = BUTTON_HEIGHT[size];
  const look = {
    primary: { bg: colors.green, fg: colors.onGreen, border: "transparent" },
    soft: { bg: colors.greenTint, fg: colors.greenDeep, border: "transparent" },
    ghost: { bg: "transparent", fg: colors.ink2, border: colors.line },
    plain: { bg: colors.card, fg: colors.ink, border: "transparent" },
    danger: { bg: colors.dangerTint, fg: colors.dangerInk, border: "transparent" },
    // The quiet second button under a primary one: white, with the secondary ink.
    white: { bg: colors.card, fg: colors.ink2, border: "transparent" },
    // A button inside a white card sits one step back from the card itself.
    tint: { bg: colors.tint, fg: colors.ink2, border: "transparent" },
    // On a green surface — the finished day, the finished level — the main button turns white.
    inverse: { bg: "#FFFFFF", fg: colors.dark ? colors.green : colors.greenDeep, border: "transparent" },
    // Text only, for the last choice on a screen ("Bosh sahifa"); `textStyle` recolours it on green.
    clear: { bg: "transparent", fg: colors.ink2, border: "transparent" },
  }[kind] || {};
  const press = () => {
    if (disabled || loading) return;
    if (haptic) tapped(haptic);
    onPress?.();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading }}
      onPress={press}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height, borderRadius: size === "lg" ? 17 : size === "md" ? 15 : 13, backgroundColor: look.bg, borderWidth: kind === "ghost" ? 1.5 : 0,
          borderColor: look.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9,
          paddingHorizontal: size === "sm" ? 14 : 20,
        },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.985 }] },
        style,
      ]}
      {...rest}
    >
      {loading
        ? <ActivityIndicator color={look.fg} />
        : <>
            {icon ? <Feather name={icon} size={size === "sm" ? 15 : 18} color={look.fg} /> : null}
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[{ fontFamily: kind === "primary" || kind === "inverse" ? FONTS.displayBold : FONTS.bold, fontSize: size === "lg" ? 16 : size === "md" ? 15 : 13.5, color: look.fg }, textStyle]}>
              {title}
            </Text>
            {iconRight ? <Feather name={iconRight} size={size === "sm" ? 15 : 18} color={look.fg} /> : null}
          </>}
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 22, c: role = "ink", bg, label, style, ...rest }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [
        {
          width: size + 18, height: size + 18, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
          backgroundColor: bg ? colors[bg] || bg : "transparent",
        },
        pressed && { opacity: 0.6 },
        style,
      ]}
      {...rest}
    >
      <Feather name={name} size={size} color={colors[role] || role} />
    </Pressable>
  );
}

export function Pill({ label, tone = "tint", icon, style, textStyle }) {
  const colors = useColors();
  const look = {
    tint: { bg: colors.tint, fg: colors.ink2 },
    green: { bg: colors.greenTint, fg: colors.greenDeep },
    solid: { bg: colors.green, fg: colors.onGreen },
    danger: { bg: colors.dangerTint, fg: colors.dangerInk },
    line: { bg: "transparent", fg: colors.ink3 },
  }[tone] || {};
  return (
    <View style={[
      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: look.bg, borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 5 },
      tone === "line" && { borderWidth: 1, borderColor: colors.line },
      style,
    ]}>
      {icon ? <Feather name={icon} size={12} color={look.fg} /> : null}
      <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: FONTS.bold, fontSize: 12.5, color: look.fg }, textStyle]}>{label}</Text>
    </View>
  );
}

// ---------- Progress ----------
export function Bar({ value, total = 100, height = 7, color, track, style }) {
  const colors = useColors();
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <View style={[{ height, borderRadius: RADIUS.pill, backgroundColor: track || colors.tint, overflow: "hidden" }, style]}>
      <View style={{ width: `${ratio * 100}%`, height: "100%", borderRadius: RADIUS.pill, backgroundColor: color || colors.green }} />
    </View>
  );
}

// The number in a ring, which is how the design shows a percentage: the ring carries the ratio, the middle
// carries the number the learner is actually after.
export function Ring({ value, total = 100, size = 74, width = 7, color, track, children, style }) {
  const colors = useColors();
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track || colors.tint} strokeWidth={width} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color || colors.green} strokeWidth={width} fill="none" strokeLinecap="round"
          strokeDasharray={`${circumference * ratio} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// Fourteen days of study time, drawn as bars. Short enough to read at a glance, long enough to show a habit.
export function Sparkline({ values, height = 54, color, style }) {
  const colors = useColors();
  const max = Math.max(1, ...values);
  return (
    <View style={[{ height, flexDirection: "row", alignItems: "flex-end", gap: 4 }, style]}>
      {values.map((value, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(3, (value / max) * height),
            borderRadius: 4,
            backgroundColor: value > 0 ? color || colors.green : colors.tint,
          }}
        />
      ))}
    </View>
  );
}

// ---------- Fields ----------
export const Field = forwardRef(function Field(
  { label, error, hint, right, style, inputStyle, boxStyle, ...rest }, ref,
) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 7 }, style]}>
      {label ? <Text style={[TYPE.label, { color: colors.ink2 }]}>{label}</Text> : null}
      <View style={[{
        flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: RADIUS.lg,
        borderWidth: 2, borderColor: error ? colors.danger : focused ? colors.green : "transparent",
        paddingHorizontal: 15,
      }, boxStyle]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink3}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ flex: 1, paddingVertical: 15, fontFamily: FONTS.body, fontSize: 15, color: colors.ink }, inputStyle]}
          {...rest}
        />
        {right}
      </View>
      {error ? <Text style={[TYPE.bodySm, { color: colors.dangerInk }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[TYPE.bodySm, { color: colors.ink3 }]}>{hint}</Text> : null}
    </View>
  );
});

// The round mark in front of a choice: an empty ring, or a white disc with a green tick once chosen.
export function Radio({ selected, onGreen = true, size = 26 }) {
  const colors = useColors();
  if (!selected) {
    return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.radio }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
      backgroundColor: onGreen ? "#FFFFFF" : colors.green,
    }}>
      <Feather name="check" size={size * 0.54} color={onGreen ? colors.green : colors.onGreen} />
    </View>
  );
}

// A green disc with a tick — a finished stage, a premium feature, something that works offline.
export function Tick({ size = 24, done = true, label }) {
  const colors = useColors();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
      backgroundColor: done ? colors.green : colors.tint2,
    }}>
      {done
        ? <Feather name="check" size={size * 0.54} color={colors.onGreen} />
        : <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.5, color: colors.ink2 }}>{label}</Text>}
    </View>
  );
}

// One of a short list of choices, laid out as rows the whole width of the screen: the goal, the pace, the
// level, the plan. The chosen one fills with green, which is how the design says "this one".
export function Choice({ title, titleKo, desc, note, right, selected, onPress, disabled, align = "center", style }) {
  const colors = useColors();
  const sub = selected ? colors.greenTint : colors.ink2;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [
        {
          flexDirection: "row", alignItems: align, gap: 14, padding: 20, borderRadius: RADIUS.xl,
          backgroundColor: selected ? colors.green : colors.card,
        },
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={align === "flex-start" ? { marginTop: 2 } : null}><Radio selected={selected} /></View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 9 }}>
          {titleKo ? <Text style={{ fontSize: 19, fontWeight: "700", color: selected ? colors.onGreen : colors.ink }}>{titleKo}</Text> : null}
          <Text style={{ fontFamily: FONTS.bold, fontSize: titleKo ? 15 : 16, color: selected ? colors.onGreen : colors.ink }}>{title}</Text>
        </View>
        {desc ? <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: sub }}>{desc}</Text> : null}
        {note ? <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, marginTop: 2, color: selected ? colors.greenTint : colors.ink4 }}>{note}</Text> : null}
      </View>
      {typeof right === "string"
        ? <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: sub }}>{right}</Text>
        : right}
    </Pressable>
  );
}

// A row of two or three equal choices — the pace picker on the profile, the question count on the practice
// screen. Short labels only; anything that needs a sentence is a Choice.
export function Segmented({ options, value, onChange, style }) {
  const colors = useColors();
  return (
    <View style={[{ flexDirection: "row", gap: 8 }, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => { tapped(); onChange?.(option.value); }}
            style={({ pressed }) => [{
              flex: 1, paddingVertical: 12, borderRadius: RADIUS.md, alignItems: "center",
              backgroundColor: selected ? colors.green : colors.tint,
              opacity: pressed ? 0.85 : 1,
            }]}
          >
            <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: FONTS.bold, fontSize: 14.5, color: selected ? colors.onGreen : colors.ink2 }}>{option.label}</Text>
            {option.sub ? (
              <Text style={{ fontFamily: FONTS.medium, fontSize: 11.5, marginTop: 2, color: selected ? colors.onGreen : colors.ink3 }}>{option.sub}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange }) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
      onPress={() => { tapped(); onChange?.(!value); }}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.green : colors.lineStrong }}
    >
      <Animated.View style={{
        width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF",
        transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
      }} />
    </Pressable>
  );
}

// ---------- Headers ----------
// The title block at the top of a tab screen: a big name and one line of context under it.
export function Header({ title, subtitle, right, style }) {
  return (
    <Row justify="space-between" align="flex-start" style={[{ paddingHorizontal: SPACE.screen, paddingTop: 6, paddingBottom: 14 }, style]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt t="h2">{title}</Txt>
        {subtitle ? <Txt t="bodySm" c="ink2">{subtitle}</Txt> : null}
      </View>
      {right}
    </Row>
  );
}

// The back link on a pushed screen — "← Kurs" — which names where it goes rather than just
// pointing at it.
export function BackLink({ label, onPress, style }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Feather name="chevron-left" size={17} color={colors.green} />
      <Text style={{ fontFamily: FONTS.bold, fontSize: 13.5, color: colors.green }}>{label}</Text>
    </Pressable>
  );
}

// The small all-caps line above a block of content.
export const Eyebrow = ({ children, c: role = "ink2", style }) => (
  <Txt t="eyebrow" c={role} style={style}>{children}</Txt>
);

// ---------- Overlays ----------
// A sheet that rises from the bottom edge. The word card and the level switcher are both this.
export function Sheet({ visible, onClose, children, title, footer, maxHeight = "88%" }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: visible ? 280 : 180, easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, slide]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: slide }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Yopish" />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, maxHeight,
          backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: insets.bottom + 16,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }],
        }}
      >
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong }} />
        </View>
        {title ? (
          <Row justify="space-between" style={{ paddingHorizontal: SPACE.screen, paddingVertical: 8 }}>
            <Txt t="h3">{title}</Txt>
            <IconButton name="x" label="Yopish" size={20} c="ink2" onPress={onClose} />
          </Row>
        ) : null}
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: footer ? 12 : 4 }} showsVerticalScrollIndicator={false} bounces={false}>
          {children}
        </ScrollView>
        {footer ? (
          <View style={{ paddingHorizontal: SPACE.screen + 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>{footer}</View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

// A question with two answers, centred. Used where a toast could only tell and not ask — leaving a
// session, stopping a long review.
export function Dialog({ visible, title, body, confirm, cancel, onConfirm, onCancel, danger }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: 28 }}>
        <View style={[{ width: "100%", maxWidth: 380, backgroundColor: colors.card, borderRadius: 26, padding: 24, gap: 10 }, shadow(colors, 2)]}>
          <Txt t="h3">{title}</Txt>
          {body ? <Txt t="body" c="ink2">{body}</Txt> : null}
          <Col gap={9} style={{ marginTop: 10 }}>
            <Button title={confirm} kind={danger ? "danger" : "primary"} onPress={onConfirm} />
            {cancel ? <Button title={cancel} kind="ghost" onPress={onCancel} /> : null}
          </Col>
        </View>
      </View>
    </Modal>
  );
}

// ---------- States ----------
export function Empty({ ko, icon, title, body, action, onAction, style }) {
  const colors = useColors();
  return (
    <View style={[{ alignItems: "center", paddingVertical: 44, paddingHorizontal: 26, gap: 12 }, style]}>
      <View style={{
        width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.greenTint,
      }}>
        {ko
          ? <Text style={{ fontSize: 24, fontWeight: "700", color: colors.greenDeep }}>{ko}</Text>
          : <Feather name={icon || "inbox"} size={26} color={colors.greenDeep} />}
      </View>
      <Txt t="h4" style={{ textAlign: "center" }}>{title}</Txt>
      {body ? <Txt t="bodySm" c="ink2" style={{ textAlign: "center", maxWidth: 300 }}>{body}</Txt> : null}
      {action ? <Button title={action} onPress={onAction} size="md" style={{ marginTop: 8, alignSelf: "center", paddingHorizontal: 26 }} /> : null}
    </View>
  );
}

export function Loading({ label }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.green} />
      {label ? <Txt t="bodySm" c="ink2">{label}</Txt> : null}
    </View>
  );
}

// Something failed and the learner can do something about it: say what happened and offer the retry.
export function Failed({ title = "Xatolik", body, action = "Qayta urinish", onAction, secondary, onSecondary }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }}>
      <Empty icon="wifi-off" title={title} body={body} />
      <Button title={action} onPress={onAction} style={{ alignSelf: "stretch" }} />
      {secondary ? <Button title={secondary} kind="ghost" onPress={onSecondary} style={{ alignSelf: "stretch" }} /> : null}
    </View>
  );
}

// A short note that drops in under the status bar and leaves on its own. It says what happened and never
// asks; it sits at the top so it can never cover the button the learner is about to press. `onDone` is kept
// in a ref: the store hands a fresh function every render, and restarting the timer on each one kept a
// note on screen for as long as the app kept redrawing.
export function Toast({ message, tone = "ink", onDone }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!message) return undefined;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, damping: 18, stiffness: 220, mass: 0.9, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => done.current?.());
    }, 2400);
    return () => clearTimeout(timer);
  }, [message, anim]);
  if (!message) return null;
  const text = String(message).replace(/^✓\s*/, "");
  const icon = { ok: "check", bad: "alert-circle" }[tone] || "info";
  const accent = { ok: colors.green, bad: colors.danger }[tone] || colors.ink2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute", left: 16, right: 16, top: insets.top + 8, alignSelf: "center",
        flexDirection: "row", alignItems: "center", gap: 11,
        backgroundColor: colors.card, borderRadius: 18, paddingVertical: 12, paddingLeft: 12, paddingRight: 16,
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }, shadow(colors, 2)]}
    >
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accent, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={15} color="#FFFFFF" />
      </View>
      <Text style={{ flex: 1, fontFamily: FONTS.semi, fontSize: 14, lineHeight: 19, color: colors.ink }} numberOfLines={2}>{text}</Text>
    </Animated.View>
  );
}

// The play triangle the audio buttons use, drawn rather than typed: "▶" renders as an emoji on some
// Android builds and as a tiny glyph on others.
export const PlayIcon = ({ size = 14, color }) => (
  <Svg width={size} height={size} viewBox="0 0 12 12">
    <Path d="M3 1.8 10 6 3 10.2 Z" fill={color} />
  </Svg>
);

// ---------- Pieces the design repeats ----------

// The small line that says which lesson this is: "12-DARS · KEYINGI", in green, spaced wide.
export const Kicker = ({ children, c: role = "green", style }) => (
  <Txt style={[{ fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }, style]} c={role}>{children}</Txt>
);

// A title on the display face at any size the design asks for, so screens do not each restate the font.
export const Title = ({ size = 28, children, style, c: role = "ink", ...rest }) => (
  <Txt
    style={[{ fontFamily: FONTS.display, fontSize: size, letterSpacing: -size * 0.022, lineHeight: Math.round(size * 1.18) }, style]}
    c={role}
    {...rest}
  >{children}</Txt>
);

// The top of a tab: a big title and one line of context.
export function TabHeader({ title, subtitle, right, onSubtitle }) {
  return (
    <Row justify="space-between" align="flex-end" style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16, gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Title>{title}</Title>
        {subtitle ? (
          <Pressable disabled={!onSubtitle} onPress={onSubtitle}>
            <Txt style={{ fontSize: 13 }} c="ink2">{subtitle}</Txt>
          </Pressable>
        ) : null}
      </View>
      {right}
    </Row>
  );
}

// A number over its label, in a white box — the day summary, the results screen, the level summary.
export function Stat({ value, label, tone, size = 28, style, inverse }) {
  const colors = useColors();
  return (
    <View style={[{ flex: 1, backgroundColor: inverse ? colors.green : colors.card, borderRadius: 20, padding: 16, gap: 4 }, style]}>
      <Text style={{
        fontFamily: FONTS.display, fontSize: size, lineHeight: size + 4,
        color: inverse ? colors.onGreen : tone === "bad" ? colors.danger : colors.ink,
      }}>{value}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: inverse ? colors.greenTint : colors.ink2 }}>{label}</Text>
    </View>
  );
}

// Five short bars for how well a word is held. A word that keeps going wrong shows one red bar instead.
export function Ticks({ level = 0, weak = false, width = 5, height = 12, gap = 3 }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            width, height, borderRadius: Math.min(3, width / 2),
            backgroundColor: weak ? (i === 0 ? colors.danger : colors.line) : i < level ? colors.green : colors.line,
          }}
        />
      ))}
    </View>
  );
}

// A row inside a white list card: a title, a line under it, and whatever sits on the right.
export function ListRow({ title, sub, right, onPress, last, chevron = !!onPress, left, titleStyle }) {
  const colors = useColors();
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.tint2, opacity: pressed ? 0.7 : 1,
      }]}
    >
      {left}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[{ fontFamily: FONTS.bold, fontSize: 14.5, color: colors.ink }, titleStyle]}>{title}</Text>
        {sub ? <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: colors.ink2 }}>{sub}</Text> : null}
      </View>
      {right}
      {chevron ? <Feather name="chevron-right" size={16} color={colors.ink4} /> : null}
    </Pressable>
  );
}

// A rounded chip: the filters on the word list, the exercise types, a hint in the typing question.
export function Chip({ label, selected, onPress, tone, style, square }) {
  const colors = useColors();
  const bg = selected ? colors.green : tone === "tint" ? colors.tint : tone === "soft" ? colors.greenTint : colors.card;
  const fg = selected ? colors.onGreen : tone === "soft" ? colors.greenDeep : tone === "muted" ? colors.ink2 : colors.ink;
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [{
        paddingHorizontal: 14, paddingVertical: square ? 10 : 9, borderRadius: square ? 13 : RADIUS.pill,
        backgroundColor: bg, opacity: pressed ? 0.8 : 1,
      }, style]}
    >
      <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: selected || tone === "soft" ? FONTS.bold : FONTS.semi, fontSize: 13, color: fg }}>{label}</Text>
    </Pressable>
  );
}

// A bar split into equal segments — the course strip on the home screen, the level switcher.
export function Segments({ total, filled, current = -1, height = 6, gap = 2, on, off, style }) {
  const colors = useColors();
  return (
    <View style={[{ flexDirection: "row", gap }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1, height, borderRadius: RADIUS.pill,
            backgroundColor: i === current ? colors.greenDeep : i < filled ? on || colors.green : off || colors.line,
          }}
        />
      ))}
    </View>
  );
}

// The strip across the top of every exercise: a way out, how far along, and the count.
export function SessionTop({ onClose, value, total }) {
  const colors = useColors();
  return (
    <Row gap={14} style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chiqish"
        hitSlop={10}
        onPress={() => { tapped(); onClose?.(); }}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}
      >
        <Feather name="x" size={16} color={colors.ink2} />
      </Pressable>
      <Bar value={value} total={total} height={8} track={colors.line} style={{ flex: 1 }} />
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: FONTS.bold, fontSize: 13, color: colors.ink2 }}>{Math.min(value + 1, total)} / {total}</Text>
    </Row>
  );
}

// A numbered answer: the circle with its number, the Korean, and its meaning when there is one.
// `state` is null while the question is open, then "right", "wrong" or "dim".
export function Option({ index, ko, text, meaning, state, onPress, disabled }) {
  const colors = useColors();
  const right = state === "right", wrong = state === "wrong";
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tapped(); onPress?.(); }}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 18,
        backgroundColor: right ? colors.green : wrong ? colors.dangerTint : colors.card,
        borderWidth: 2, borderColor: wrong ? colors.danger : right ? colors.green : state === "picked" ? colors.green : "transparent",
        opacity: state === "dim" ? 0.6 : pressed ? 0.85 : 1,
      }]}
    >
      {right ? <Radio selected /> : wrong ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" }}>
          <Feather name="x" size={15} color="#FFFFFF" />
        </View>
      ) : (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.greenTint, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 12, color: colors.greenDeep }}>{index + 1}</Text>
        </View>
      )}
      {ko ? (
        <Text style={{ fontSize: 20, fontWeight: "700", color: right ? colors.onGreen : wrong ? colors.dangerInk : colors.ink }}>{ko}</Text>
      ) : null}
      {text ? (
        <Text style={{ flex: 1, fontFamily: right ? FONTS.displayBold : FONTS.bold, fontSize: 17, color: right ? colors.onGreen : wrong ? colors.dangerInk : colors.ink }}>{text}</Text>
      ) : null}
      {meaning ? (
        <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: right ? colors.greenTint : colors.ink2 }} numberOfLines={1}>{meaning}</Text>
      ) : null}
    </Pressable>
  );
}

// A note on the green tint: how the schedule works, what a level keeps, why a word came back.
export function Note({ title, children, style, tone = "green" }) {
  const colors = useColors();
  const bg = tone === "white" ? colors.card : colors.greenTint;
  const fg = tone === "white" ? colors.ink : colors.greenDeep;
  return (
    <View style={[{ backgroundColor: bg, borderRadius: 22, padding: 18, gap: 6 }, style]}>
      {title ? <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: fg }}>{title}</Text> : null}
      {children ? <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, color: tone === "white" ? colors.ink2 : fg }}>{children}</Text> : null}
    </View>
  );
}

// A number inside a ring. Without `sub` it is the small percentage the home and review cards carry; with
// it, the big accuracy dial of a summary.
export function RingStat({ value, total = 100, size = 52, width = 5, label, sub, onGreen, track }) {
  const colors = useColors();
  const pctValue = total > 0 ? Math.round((Math.min(value, total) / total) * 100) : 0;
  return (
    <Ring
      value={value} total={total} size={size} width={width}
      color={onGreen ? "#FFFFFF" : colors.green}
      track={onGreen ? "rgba(255,255,255,0.28)" : track || colors.locked}
    >
      <View style={{ alignItems: "center" }}>
        <Text style={{
          fontFamily: sub ? FONTS.display : FONTS.bold, fontSize: sub ? size * 0.28 : size * 0.25,
          color: onGreen ? "#FFFFFF" : sub ? colors.ink : colors.greenDeep,
        }}>{label ?? `${pctValue}%`}</Text>
        {sub ? <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: colors.ink2 }}>{sub}</Text> : null}
      </View>
    </Ring>
  );
}

// Content that arrives rather than appears: it fades in while travelling a few points into place. Keyed
// by the caller (a question's index, a step), so every new item enters the same way. Native driver only —
// opacity and transform never touch layout, so nothing around it jumps.
export function FadeIn({ children, from = "bottom", distance = 14, duration = 240, delay = 0, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [anim, duration, delay]);
  const back = from === "left" || from === "top";
  const offset = anim.interpolate({ inputRange: [0, 1], outputRange: [back ? -distance : distance, 0] });
  const transform = from === "left" || from === "right" ? [{ translateX: offset }] : [{ translateY: offset }];
  return <Animated.View style={[{ opacity: anim, transform }, style]}>{children}</Animated.View>;
}

// The grabber-and-panel shape a sheet has, for screens that are pushed as a modal route rather than drawn
// with <Sheet>: the level switcher. The route itself has no animation; the backdrop fades and the panel
// rises here, and `children` may be a function that receives `close`, which plays it all backwards first.
export function SheetScreen({ onClose, children }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anim]);
  const close = (after) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(anim, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => (after || onClose)());
  };
  return (
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={() => close()} accessibilityLabel="Yopish" />
      </Animated.View>
      <Animated.View style={{
        backgroundColor: colors.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingTop: 14, paddingHorizontal: 22, paddingBottom: insets.bottom + 24, gap: 16,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }],
      }}>
        <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.radio, alignSelf: "center" }} />
        {typeof children === "function" ? children(close) : children}
      </Animated.View>
    </View>
  );
}
