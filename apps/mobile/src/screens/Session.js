// 11–17 — Dars sessiyasi. One screen for every sitting: a stage of a day, a review, free practice.
//
// packages/shared/exercise.js owns the sitting — which questions, in what order, what an answer does to
// the schedule. This screen only draws the current item and hands taps back to it. The session object is
// kept in a ref and mutated in place, exactly as the engine expects; `redraw` repaints after each change.
import { useEffect, useReducer, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import * as srs from "@upkorean/shared/srs.js";
import * as ex from "@upkorean/shared/exercise.js";
import { KEYS, backspace, compose, firstJamo, shiftKey } from "@upkorean/shared/hangul.js";

import { useStore } from "../store";
import { FONTS, shadow, useColors } from "../theme";
import {
  Bar, Button, Chip, Dialog, Empty, FadeIn, Feather, Option, PlayIcon, Radio, Row, Screen, SessionTop, Title, tapped,
} from "../ui";
import { useNarrator, useStopAudioOnLeave } from "../audio";
import { clozePieces, plainUz, uzPieces } from "../model";
import { Sentence } from "./WordSheet";
import Memo from "./Memo";

const TIME_LIMIT_MS = 20000;

function build(params, state, course, opts) {
  const xpStart = state.xp;
  if (params.kind === "learn") {
    const plan = srs.dayPlan(course, params.day);
    const stage = plan.stages[params.stageIdx];
    if (!stage) return null;
    let items;
    if (stage.kind === "learn") items = ex.introItems(course, plan.blocks[stage.block]);
    else if (stage.kind === "recall") items = ex.recallItems(course, plan.blocks[stage.block], opts);
    else items = ex.mixedItems(state, course, plan.words, opts);
    return ex.newSession("learn", items, { day: params.day, stageIdx: params.stageIdx, stage, category: "learn", xpStart });
  }
  if (params.kind === "review") {
    const ids = params.ids || srs.reviewQueue(state, course, params.mode || "due", params.extra ? srs.EXTRA_ROUND : undefined);
    return ex.newSession("review", ex.reviewItems(course, ids, opts), { category: "review", xpStart });
  }
  const ids = (params.ids || srs.learnedIds(state, course)).filter((id) => course.byId[id]);
  const items = ex.quizItems(state, course, ids, params.quizType || "mixed", opts, params.count || 20);
  return ex.newSession("quiz", items, {
    quizType: params.quizType || "mixed", title: params.title || "Mashq", category: "quiz", xpStart,
  });
}

export default function Session({ navigation, route }) {
  const params = route.params || {};
  const c = useColors();
  const store = useStore();
  const { state, course } = store;
  const narrator = useNarrator();
  useStopAudioOnLeave();

  const [, redraw] = useReducer((n) => n + 1, 0);
  const scroller = useRef(null);
  const [exitAsk, setExitAsk] = useState(false);
  const [restAsk, setRestAsk] = useState(false);
  const leaving = useRef(false);
  const sessionRef = useRef(null);
  if (!sessionRef.current && state && course) sessionRef.current = build(params, state, course, { audio: store.audio });
  const session = sessionRef.current;
  const item = session ? ex.current(session) : null;

  // Typing and matching keep a little state of their own that must reset with every new question.
  const [typed, setTyped] = useState("");
  const [shift, setShift] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => { setTyped(""); setShift(false); setHint(false); }, [session?.idx]);

  // Leaving by the system back button or a swipe asks first, like the ✕ does.
  useEffect(() => navigation.addListener("beforeRemove", (event) => {
    if (leaving.current || !session || session.finished || (!session.results.length && session.idx === 0)) return;
    event.preventDefault();
    setExitAsk(true);
  }), [navigation, session]);

  // The narrator: a listening question always speaks, a new word and a revealed card when the learner
  // has asked for it.
  useEffect(() => {
    if (!item || !store.audio) return;
    const auto = state.settings.autoAudio;
    if (item.type === "listen" && session.phase === "q") narrator.play("words", item.id);
    else if (auto && item.type === "intro") narrator.play("words", item.id);
    else if (auto && item.type === "card" && session.phase === "back") narrator.play("words", item.id);
  }, [session?.idx, session?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // The verdict takes the bottom of the screen; when the answers no longer fit above it, the list scrolls
  // to its end so the right one is never hidden behind the card.
  useEffect(() => {
    if (session?.phase === "a") setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    else scroller.current?.scrollTo({ y: 0, animated: false });
  }, [session?.idx, session?.phase]);

  // Practice with a time limit: an unanswered question counts as missed when the time runs out.
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!params.timeLimit || !item || session.phase !== "q" || item.type === "match") return undefined;
    setClock(0);
    const started = Date.now();
    const tick = setInterval(() => setClock(Date.now() - started), 250);
    const stop = setTimeout(() => { ex.skip(state, session, course); answered(false); }, TIME_LIMIT_MS);
    return () => { clearInterval(tick); clearTimeout(stop); };
  }, [session?.idx, session?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state || !course) return null;

  if (!session || !session.items.length) {
    return (
      <Screen edges={["top", "bottom"]}>
        <SessionTop onClose={() => navigation.goBack()} value={0} total={1} />
        <Empty
          ko="끝"
          title="Hozircha savol yo'q"
          body={params.kind === "review" ? "Bugun takrorlanadigan so'z qolmadi." : "Mashq uchun avval so'z o'rganing."}
          action="Orqaga"
          onAction={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const leave = () => {
    leaving.current = true;
    ex.abandon(state, session);
    store.save();
    navigation.goBack();
  };

  const finishSitting = () => {
    const outcome = ex.finish(state, session, course);
    srs.streak(state);
    const { earned } = srs.achievements(state, course);
    store.save();
    if (earned.length) store.say(`Yutuq ochildi — ${earned[0].title}`, "ok");
    leaving.current = true;
    if (session.kind === "learn") {
      if (outcome.dayDone) navigation.replace("DayDone", { outcome });
      else {
        store.say(`✓ ${session.stage.label} bajarildi`, "ok");
        navigation.replace("Day", { day: session.day });
      }
      return;
    }
    navigation.replace("SessionDone", { outcome, title: session.title });
  };

  const advance = () => {
    if (ex.restDue(session)) { ex.markRest(session); setRestAsk(true); return; }
    if (!ex.next(session)) { finishSitting(); return; }
    redraw();
  };

  function answered(correct) {
    tapped(correct ? "ok" : "bad");
    store.save();
    redraw();
  }

  const close = () => {
    if (!session.results.length && session.idx === 0) { leave(); return; }
    setExitAsk(true);
  };

  let body;
  switch (item.type) {
    case "intro": body = <Intro item={item} />; break;
    case "card": body = <Card item={item} session={session} onReveal={() => { ex.reveal(session); redraw(); }} onGrade={(g) => { ex.gradeCard(state, session, g); store.save(); tapped(g >= 3 ? "ok" : "light"); advance(); }} />; break;
    case "match": body = <Match item={item} session={session} onPick={(side, id) => {
      const result = ex.matchPick(state, session, side, id);
      if (result === "miss") {
        tapped("bad");
        setTimeout(() => { session.flash = null; redraw(); }, 650);
      } else if (result === "pair") tapped("light");
      else if (result === "done") { tapped("ok"); store.save(); }
      redraw();
    }} onSkip={advance} />; break;
    case "type": body = (
      <Typing
        item={item} session={session} typed={typed} hint={hint}
        onHint={() => setHint(true)}
        onSkip={() => { ex.skip(state, session, course); answered(false); }}
      />
    ); break;
    default: body = <Choose item={item} session={session} onChoose={(index) => {
      const result = ex.choose(state, session, course, index);
      if (result === null) redraw(); // the cloze question waits for "Tekshirish"
      else answered(result);
    }} onConfirm={() => answered(ex.confirm(state, session, course))} />;
  }

  const answeredNow = session.phase === "a";
  const keyboard = item.type === "type" && session.phase === "q";

  return (
    <Screen edges={["top", "bottom"]}>
      <SessionTop onClose={close} value={session.idx} total={session.items.length} />
      {params.timeLimit && session.phase === "q" && item.type !== "match" ? (
        <View style={{ paddingHorizontal: 20, marginTop: -10, marginBottom: 10 }}>
          <Bar value={TIME_LIMIT_MS - clock} total={TIME_LIMIT_MS} height={3} color={clock > 15000 ? c.danger : c.green} />
        </View>
      ) : null}
      <ScrollView ref={scroller} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <FadeIn key={session.idx} from="right" distance={28} duration={260} style={{ flex: 1 }}>{body}</FadeIn>
      </ScrollView>
      {answeredNow && item.type !== "match" ? (
        <FadeIn key={"v" + session.idx} distance={36} duration={220}><Verdict item={item} session={session} onNext={advance} /></FadeIn>
      ) : null}
      {item.type === "intro" ? (
        <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.line }}>
          <Button title="Tushundim" onPress={() => { ex.introNext(state, session); store.save(); advance(); }} />
        </View>
      ) : null}
      {answeredNow && item.type === "match" ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 26 }}>
          <Button title="Keyingi" onPress={advance} />
        </View>
      ) : null}
      {keyboard ? (
        <HangulKeyboard
          shift={shift}
          onKey={(jamo) => { setTyped((text) => compose(text, shiftKey(jamo, shift))); if (shift) setShift(false); }}
          onShift={() => setShift(!shift)}
          onBack={() => setTyped((text) => backspace(text))}
          onClear={() => setTyped("")}
          onSpace={() => setTyped((text) => (text && !text.endsWith(" ") ? `${text} ` : text))}
          onSubmit={() => { if (typed.trim()) answered(ex.submitTyped(state, session, course, typed)); }}
          canSubmit={!!typed.trim()}
        />
      ) : null}

      <Dialog
        visible={exitAsk}
        title="Mashqni to'xtatasizmi?"
        body="Berilgan javoblar saqlangan. Qolganini keyin davom ettirasiz."
        confirm="Chiqish"
        cancel="Davom etish"
        danger
        onConfirm={() => { setExitAsk(false); leave(); }}
        onCancel={() => setExitAsk(false)}
      />
      <Dialog
        visible={restAsk}
        title={`${session.idx + 1} ta so'z takrorlandi`}
        body={`${session.items.length - session.idx - 1} tasi qoldi. Davom etasizmi yoki shu yerda tugatasizmi? Javoblar saqlangan.`}
        confirm="Davom etish"
        cancel="Shu yerda tugatish"
        onConfirm={() => { setRestAsk(false); if (!ex.next(session)) finishSitting(); else redraw(); }}
        onCancel={() => { setRestAsk(false); ex.stopHere(session); finishSitting(); }}
      />
    </Screen>
  );
}

// ---------- 11 · Tanishish ----------
// Three white cards: the word, a sentence it lives in, and how it is built.
function Intro({ item }) {
  const c = useColors();
  const store = useStore();
  const { play } = useNarrator();
  const example = item.example;
  return (
    <View style={{ gap: 12 }}>
      <View style={[{ backgroundColor: c.card, borderRadius: 26, paddingTop: 16, paddingBottom: 22, paddingHorizontal: 20, alignItems: "center", gap: 4 }, shadow(c, 2)]}>
        <View style={{ alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: c.greenTint }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 11.5, letterSpacing: 0.6, color: c.greenDeep }}>YANGI SO'Z</Text>
        </View>
        <Text style={{ fontSize: 60, lineHeight: 76, fontWeight: "700", color: c.ink, textAlign: "center" }} adjustsFontSizeToFit numberOfLines={1}>{item.ko}</Text>
        <Text style={{ fontFamily: FONTS.displayBold, fontSize: 25, lineHeight: 31, color: c.ink, textAlign: "center" }}>{item.uz}</Text>
        {store.audio ? (
          <Row gap={10} style={{ marginTop: 14 }}>
            <SoundPill label="Eshitish" solid onPress={() => play("words", item.id)} />
            <SoundPill label="Sekin" onPress={() => play("words", item.id, { rate: 0.7 })} />
          </Row>
        ) : null}
      </View>

      {example ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, paddingVertical: 16, paddingLeft: 18, paddingRight: 14, flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={eyebrow(c)}>Misol</Text>
            <Sentence text={example.ko} part={example.hl} size={17} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>{plainUz(example.uz)}</Text>
          </View>
          {store.audio ? (
            <Pressable
              accessibilityLabel="Gapni eshitish"
              hitSlop={8}
              onPress={() => { tapped(); play("sentences", item.id); }}
              style={({ pressed }) => [{ marginTop: 6, width: 44, height: 44, borderRadius: 22, backgroundColor: c.greenTint, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <PlayIcon size={14} color={c.greenDeep} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {item.roots ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 18, gap: 14 }}>
          <Text style={eyebrow(c)}>Yodda tutish uchun</Text>
          <Memo root={item.roots} />
        </View>
      ) : null}
    </View>
  );
}

function SoundPill({ label, onPress, solid }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => { tapped(); onPress(); }}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 99,
        backgroundColor: solid ? c.green : c.greenTint, transform: [{ scale: pressed ? 0.96 : 1 }],
      }]}
    >
      {solid ? <PlayIcon size={12} color={c.onGreen} /> : null}
      <Text style={{ fontFamily: FONTS.bold, fontSize: 14, color: solid ? c.onGreen : c.greenDeep }}>{label}</Text>
    </Pressable>
  );
}

// ---------- 12 · Flashcard ----------
function Card({ item, session, onReveal, onGrade }) {
  const c = useColors();
  const store = useStore();
  const { play } = useNarrator();
  const { state } = store;
  const back = session.phase === "back";
  const flagged = !!srs.wordState(state, item.id)?.flag;
  const days = (g) => {
    const n = srs.previewInterval(state, item.id, g);
    return n <= 1 ? "ertaga" : `${n} kun`;
  };
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        disabled={back}
        onPress={() => { tapped(); onReveal(); }}
        style={[{ backgroundColor: c.card, borderRadius: 26, paddingVertical: 40, paddingHorizontal: 22, alignItems: "center", gap: 10 }, shadow(c, 2)]}
      >
        <Text style={{ fontSize: 60, lineHeight: 76, fontWeight: "700", color: c.ink, textAlign: "center" }} adjustsFontSizeToFit numberOfLines={1}>{item.ko}</Text>
        {back ? (
          <>
            <View style={{ width: 56, height: 1, backgroundColor: c.line, marginVertical: 14 }} />
            <Text style={{ fontFamily: FONTS.bold, fontSize: 27, color: c.ink, textAlign: "center" }}>{item.uz}</Text>
            {item.example ? (
              <View style={{ marginTop: 10, alignItems: "center", gap: 2 }}>
                <Sentence text={item.example.ko} part={item.example.hl} size={15} />
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: c.ink2, textAlign: "center" }}>{plainUz(item.example.uz)}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink4, marginTop: 18 }}>Ma'nosini eslang, keyin kartani oching</Text>
        )}
      </Pressable>
      <View style={{ flex: 1, minHeight: 16 }} />
      {back ? (
        <View style={{ gap: 12, paddingBottom: 16 }}>
          <Text style={{ textAlign: "center", fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>Bu so'zni qanchalik yaxshi eslaysiz?</Text>
          <Row gap={9}>
            <Grade title="Bilmadim" sub={days(1)} tone="bad" onPress={() => onGrade(1)} />
            <Grade title="Qiyin" sub={days(2)} onPress={() => onGrade(2)} />
            <Grade title="Bildim" sub={days(3)} tone="good" onPress={() => onGrade(3)} />
          </Row>
        </View>
      ) : (
        <Button title="Javobni ko'rsatish" onPress={onReveal} style={{ marginBottom: 16 }} />
      )}
      <Row gap={10} style={{ paddingBottom: 10 }}>
        <Button
          title={flagged ? "Belgilangan" : "Belgilash"}
          kind="white" size="md" style={{ flex: 1 }}
          onPress={() => { srs.flag(state, item.id); store.save(); }}
        />
        {store.audio ? <Button title="▶ Eshitish" kind="white" size="md" style={{ flex: 1 }} onPress={() => play("words", item.id)} /> : null}
      </Row>
    </View>
  );
}

function Grade({ title, sub, tone, onPress }) {
  const c = useColors();
  const good = tone === "good";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, paddingVertical: 16, paddingHorizontal: 8, borderRadius: 17, alignItems: "center", gap: 3, backgroundColor: good ? c.green : c.card, opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={{ fontFamily: FONTS.bold, fontSize: 14.5, color: good ? c.onGreen : tone === "bad" ? c.danger : c.ink }}>{title}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: good ? c.greenTint : c.ink2 }}>{sub}</Text>
    </Pressable>
  );
}

// ---------- 14, 16, 17 · Choosing: meaning, Korean, by ear, in a sentence ----------
function Choose({ item, session, onChoose, onConfirm }) {
  const c = useColors();
  const store = useStore();
  const { play, isPlaying } = useNarrator();
  const answered = session.phase === "a";
  const stateOf = (index) => {
    const option = item.opts[index];
    if (!answered) return item.type === "sent" && session.chosen === index ? "picked" : null;
    if (option === item.answer) return "right";
    if (index === session.chosen) return "wrong";
    return "dim";
  };

  let prompt;
  if (item.type === "listen") {
    const playing = isPlaying("words", item.id);
    prompt = (
      <View style={{ backgroundColor: c.green, borderRadius: 26, paddingVertical: 20, paddingHorizontal: 22, alignItems: "center", gap: 12 }}>
        <Text style={{ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.6, textTransform: "uppercase", color: c.greenTint }}>Eshiting va tanlang</Text>
        <Pressable
          accessibilityLabel="Eshitish"
          onPress={() => { tapped(); play("words", item.id); }}
          style={({ pressed }) => [{ width: 76, height: 76, borderRadius: 38, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.96 : 1 }] }]}
        >
          <PlayIcon size={26} color={c.green} />
        </Pressable>
        <Wave active={playing} />
        <Pressable onPress={() => { tapped(); play("words", item.id, { rate: 0.7 }); }} style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 99, backgroundColor: "#FFFFFF" }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.dark ? c.green : c.greenDeep }}>Sekin eshitish</Text>
        </Pressable>
      </View>
    );
  } else if (item.type === "sent") {
    const { before, after } = clozePieces(item.example);
    const picked = session.chosen !== null && session.chosen !== undefined ? item.opts[session.chosen] : null;
    prompt = (
      <View style={{ backgroundColor: c.card, borderRadius: 26, paddingVertical: 28, paddingHorizontal: 22, gap: 14 }}>
        <Text style={eyebrow(c)}>Bo'sh joyni to'ldiring</Text>
        <Text style={{ fontSize: 23, lineHeight: 38, color: c.ink }}>
          {before}
          <Text style={{ fontWeight: "700", color: picked ? (answered ? (picked === item.answer ? c.green : c.danger) : c.green) : c.ink4, textDecorationLine: "underline" }}>
            {picked ? ` ${picked} ` : "  ?  "}
          </Text>
          {after}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 22, color: c.ink2 }}>
          {uzPieces(item.example.uz).map((piece, i) => (piece.hl ? <Text key={i}>____</Text> : piece.text))}
        </Text>
      </View>
    );
  } else {
    const fromKorean = item.type === "mc";
    prompt = (
      <View style={{ backgroundColor: c.card, borderRadius: 26, paddingVertical: 24, paddingHorizontal: 22, alignItems: "center", gap: 8 }}>
        <Text style={eyebrow(c)}>{fromKorean ? "Tarjimasini tanlang" : "Koreyschasini tanlang"}</Text>
        {fromKorean ? (
          <>
            <Text style={{ fontSize: 52, lineHeight: 66, fontWeight: "700", color: c.ink }} adjustsFontSizeToFit numberOfLines={1}>{item.ko}</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: c.ink2 }}>{item.day}-kun</Text>
          </>
        ) : (
          <>
            <Title size={30} style={{ textAlign: "center" }}>{item.uz}</Title>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>{item.day}-kun</Text>
          </>
        )}
        {fromKorean && store.audio ? (
          <Pressable
            accessibilityLabel="Eshitish"
            hitSlop={8}
            onPress={() => { tapped(); play("words", item.id); }}
            style={({ pressed }) => [{ marginTop: 6, width: 48, height: 48, borderRadius: 24, backgroundColor: c.greenTint, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <PlayIcon size={18} color={c.greenDeep} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  const koOptions = item.type !== "mc" && item.type !== "listen";
  return (
    <View style={{ flex: 1 }}>
      {prompt}
      <View style={{ gap: 10, marginTop: 14, paddingBottom: 6 }}>
        {item.opts.map((option, index) => (
          <Option
            key={`${index}-${option}`}
            index={index}
            ko={koOptions ? option : null}
            text={koOptions ? null : option}
            state={stateOf(index)}
            disabled={answered}
            onPress={() => onChoose(index)}
          />
        ))}
        {item.type === "sent" && !answered ? (
          <Button title="Tekshirish" disabled={session.chosen === null || session.chosen === undefined} onPress={onConfirm} style={{ marginTop: 4 }} />
        ) : null}
      </View>
    </View>
  );
}

function Wave({ active }) {
  const bars = [10, 20, 26, 14, 22, 9, 17];
  return (
    <Row gap={3} align="flex-end" style={{ height: 26 }}>
      {bars.map((h, i) => (
        <View key={i} style={{ width: 4, height: h, borderRadius: 2, backgroundColor: active && i % 2 === 0 ? "#FFFFFF" : "rgba(255,255,255,0.55)" }} />
      ))}
    </Row>
  );
}

// ---------- 13 · Yozish ----------
function Typing({ item, session, typed, hint, onHint, onSkip }) {
  const c = useColors();
  const answered = session.phase === "a";
  return (
    <View style={{ gap: 16 }}>
      <View style={{ backgroundColor: c.card, borderRadius: 26, paddingVertical: 30, paddingHorizontal: 22, alignItems: "center", gap: 8 }}>
        <Text style={eyebrow(c)}>Koreyscha yozing</Text>
        <Title size={30} style={{ textAlign: "center" }}>{item.uz}</Title>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>{item.syllables} bo'g'in · {item.day}-kun</Text>
      </View>
      <View style={{
        paddingVertical: 18, paddingHorizontal: 20, borderRadius: 20, backgroundColor: c.card, borderWidth: 2,
        borderColor: answered ? (session.correct ? c.green : c.danger) : c.green, flexDirection: "row", alignItems: "center", gap: 4, minHeight: 72,
      }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: answered && !session.correct ? c.danger : c.ink }}>{answered ? session.typed : typed}</Text>
        {!answered ? <View style={{ width: 2, height: 28, backgroundColor: c.green }} /> : null}
        <View style={{ flex: 1 }} />
        {!answered && !hint ? (
          <Pressable hitSlop={10} onPress={() => { tapped(); onHint(); }}>
            <Text style={{ fontFamily: FONTS.bold, fontSize: 13, color: c.green }}>Maslahat</Text>
          </Pressable>
        ) : null}
      </View>
      {!answered ? (
        <Row gap={8} wrap>
          {hint ? <Chip label={`Birinchi harf: ${firstJamo(item.answer)}`} tone="muted" /> : null}
          <Chip label="O'tkazib yuborish" tone="muted" onPress={onSkip} />
        </Row>
      ) : null}
    </View>
  );
}

function HangulKeyboard({ shift, onKey, onShift, onBack, onClear, onSpace, onSubmit, canSubmit }) {
  const c = useColors();
  const key = (label, onPress, style = {}, textStyle = {}) => (
    <Pressable
      key={label}
      onPress={() => { tapped(); onPress(); }}
      style={({ pressed }) => [{ height: 42, borderRadius: 7, backgroundColor: c.card, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Text style={[{ fontSize: 17, fontWeight: "500", color: c.ink }, textStyle]}>{label}</Text>
    </Pressable>
  );
  const mod = { backgroundColor: c.keyMod };
  const modText = { fontFamily: FONTS.bold, fontSize: 13, color: c.keyInk };
  return (
    <View style={{ backgroundColor: c.keyboard, paddingTop: 10, paddingHorizontal: 6, paddingBottom: 12, gap: 7 }}>
      <Row gap={5}>{KEYS[0].map((k) => key(shiftKey(k, shift), () => onKey(k), { flex: 1 }))}</Row>
      <Row gap={5} style={{ paddingHorizontal: 18 }}>{KEYS[1].map((k) => key(k, () => onKey(k), { flex: 1 }))}</Row>
      <Row gap={5}>
        {key("⇧", onShift, { flex: 1.4, ...(shift ? { backgroundColor: c.green } : mod) }, { ...modText, color: shift ? c.onGreen : c.keyInk })}
        {KEYS[2].map((k) => key(k, () => onKey(k), { flex: 1 }))}
        {key("⌫", onBack, { flex: 1.4, ...mod }, modText)}
      </Row>
      <Row gap={5}>
        {key("Tozalash", onClear, { flex: 1.2, ...mod }, { ...modText, fontSize: 12 })}
        {key(" ", onSpace, { flex: 3 })}
        {key("Tekshirish", onSubmit, { flex: 1.6, backgroundColor: c.green, opacity: canSubmit ? 1 : 0.5 }, { fontFamily: FONTS.displayBold, fontSize: 14, color: c.onGreen })}
      </Row>
    </View>
  );
}

// ---------- 15 · Juftlash ----------
function Match({ item, session, onPick, onSkip }) {
  const c = useColors();
  const { course } = useStore();
  const done = session.phase === "a";
  const cell = (side, id) => {
    const word = course.byId[id];
    const matched = session.matched.includes(id);
    const selected = session.sel?.[side] === id;
    const flashed = session.flash && session.flash[side] === id;
    const bg = flashed ? c.dangerTint : selected ? c.green : matched ? c.locked : c.card;
    const fg = flashed ? c.dangerInk : selected ? c.onGreen : matched ? c.ink4 : c.ink;
    return (
      <View key={`${side}-${id}`} style={{ width: "50%", padding: 5 }}>
        <Pressable
          disabled={matched || done}
          onPress={() => onPick(side, id)}
          style={({ pressed }) => [{
            minHeight: 64, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 18, backgroundColor: bg,
            alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: flashed ? c.danger : "transparent",
            opacity: pressed ? 0.85 : 1,
          }]}
        >
          {side === "ko"
            ? <Text style={{ fontSize: 21, fontWeight: "700", color: fg, textAlign: "center" }} numberOfLines={1} adjustsFontSizeToFit>{word.ko}</Text>
            : <Text style={{ fontFamily: FONTS.semi, fontSize: 15, color: fg, textAlign: "center" }} numberOfLines={2}>{word.uz}</Text>}
        </Pressable>
      </View>
    );
  };
  const left = item.ids.length - session.matched.length;
  return (
    <View style={{ flex: 1, gap: 16 }}>
      <Text style={{ alignSelf: "center", fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>So'zlarni ma'nosi bilan juftlang</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 }}>
        {item.koOrder.map((id, i) => [cell("ko", id), cell("uz", item.uzOrder[i])])}
      </View>
      <Row gap={14} style={{ backgroundColor: c.card, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18 }}>
        <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13.5, color: c.ink2 }}>
          {done ? "Barcha juftlar topildi" : `${session.matched.length} juft topildi · ${left} tasi qoldi`}
        </Text>
        <Row gap={4}>
          {item.ids.map((id, i) => (
            <View key={id} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i < session.matched.length ? c.green : c.line }} />
          ))}
        </Row>
      </Row>
      <View style={{ flex: 1 }} />
      {!done ? <Button title="O'tkazib yuborish" kind="white" size="md" onPress={onSkip} style={{ marginBottom: 10 }} /> : null}
    </View>
  );
}

// ---------- 17 · The verdict under an answered question ----------
function Verdict({ item, session, onNext }) {
  const c = useColors();
  const right = !!session.correct;
  const chosen = item.type === "type"
    ? session.typed
    : session.chosen !== null && session.chosen !== undefined ? item.opts[session.chosen] : "";
  const byMeaning = item.type === "mc" || item.type === "listen";
  const shown = byMeaning ? item.ko : item.type === "sent" ? item.answer : item.uz;
  const later = session.kind === "quiz"
    ? "Erkin mashq takrorlash jadvalini o'zgartirmaydi."
    : session.requeued ? "Bu so'z birozdan keyin yana chiqadi." : "Bu so'z ertaga yana chiqadi.";

  let title, text;
  if (right) {
    title = "To'g'ri!";
    text = `${item.ko} — ${item.uz}`;
  } else if (!chosen) {
    title = "O'tkazib yuborildi";
    text = `To'g'ri javob: ${byMeaning ? `${item.ko} — ${item.uz}` : `${item.answer} (${item.uz})`}. ${later}`;
  } else {
    title = `Xato — ${byMeaning ? item.ko : chosen} ≠ ${byMeaning ? chosen : shown}`;
    text = `To'g'ri javob: ${byMeaning ? `${item.ko} — ${item.uz}` : item.answer}${byMeaning || item.type === "sent" ? "" : ` — ${item.uz}`}. ${later}`;
  }

  return (
    <View style={[{
      marginHorizontal: 18, marginBottom: 14, marginTop: 4, backgroundColor: c.card, borderRadius: 22,
      paddingVertical: 14, paddingLeft: 16, paddingRight: 14, flexDirection: "row", alignItems: "center", gap: 12,
    }, shadow(c, 1)]}>
      {right ? <Radio selected onGreen={false} /> : (
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.danger, alignItems: "center", justifyContent: "center" }}>
          <Feather name="x" size={15} color="#FFFFFF" />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: FONTS.bold, fontSize: 14.5, color: right ? c.green : c.dangerInk }} numberOfLines={2}>{title}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, color: c.ink2 }} numberOfLines={3}>{text}</Text>
      </View>
      <Button title="Keyingi" size="sm" onPress={onNext} style={{ paddingHorizontal: 18 }} />
    </View>
  );
}

const eyebrow = (c) => ({ fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.ink2 });
