// The narrator. One player for the whole app, because two clips at once is never what anyone meant.
//
// Clips are served by word id — /media/clip/words/b-1-0.mp3 — and they are behind the session, so the
// request carries the bearer token. expo-audio takes headers on the source, which is why the app never
// needs a signed URL.
import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { api, authHeaders } from "./api";

// Study audio should play through the earpiece route the learner expects and must not stop their music
// on iOS silently — a card that says "Eshitish" and makes no sound reads as a broken app.
setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: "mixWithOthers" }).catch(() => {});

let player = null;
let currentKey = null;
let listeners = new Set();
const notify = (key) => { for (const listener of listeners) listener(key); };

function ensurePlayer() {
  if (player) return player;
  player = createAudioPlayer(null);
  player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish || (!status.playing && status.isLoaded && status.currentTime >= status.duration && status.duration > 0)) {
      currentKey = null;
      notify(null);
    }
  });
  return player;
}

export function stopClip() {
  if (!player) return;
  try { player.pause(); } catch { /* already gone */ }
  currentKey = null;
  notify(null);
}

// Plays a clip and returns whether it was asked to. `rate` below 1 is the "Sekin eshitish" button; the
// pitch is corrected, so a slow word still sounds like the same word.
export function playClip(kind, wordId, { rate = 1 } = {}) {
  const key = `${kind}/${wordId}`;
  try {
    const sound = ensurePlayer();
    sound.replace({ uri: api.clipUrl(kind, wordId), headers: authHeaders() });
    sound.shouldCorrectPitch = true;
    sound.playbackRate = Math.max(0.5, Math.min(1.5, rate));
    sound.seekTo(0).catch(() => {});
    sound.play();
    currentKey = key;
    notify(key);
    return true;
  } catch {
    currentKey = null;
    notify(null);
    return false;
  }
}

export const playingKey = () => currentKey;

// Which clip is sounding right now, so a play button can show itself as playing. One subscription per
// component, and the module keeps no React state of its own.
export function useNarrator() {
  const [playing, setPlaying] = useState(currentKey);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const listener = (key) => { if (mounted.current) setPlaying(key); };
    listeners.add(listener);
    return () => { mounted.current = false; listeners.delete(listener); };
  }, []);

  const play = useCallback((kind, wordId, options) => playClip(kind, wordId, options), []);
  const isPlaying = useCallback((kind, wordId) => playing === `${kind}/${wordId}`, [playing]);
  return { play, stop: stopClip, playing, isPlaying };
}

// Leaving a screen must silence it. A card that keeps talking over the next one is the commonest way an
// audio app feels broken.
export function useStopAudioOnLeave() {
  useEffect(() => () => stopClip(), []);
}
