// The app's one source of truth: who is signed in, what they know, and which level they are on.
//
// Progress is held as a single mutable object rather than as React state. That is deliberate: it is a few
// hundred kilobytes with thousands of keys, every answer touches one of them, and copying the whole thing
// per tap would be felt. Screens read it directly and call `save()`, which marks it dirty, bumps a counter
// to redraw, and sends only the difference a moment later. sync.js does the diffing and, when two devices
// collide, the merge.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { diffState, mergeStates } from "@upkorean/shared";
import * as srs from "@upkorean/shared/srs.js";
import { today } from "@upkorean/shared/dates.js";

import { ApiError, api, restoreSession } from "./api";
import { clearContent, loadLevel, loadManifest } from "./content";

const clone = (value) => JSON.parse(JSON.stringify(value));
const newRev = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const cacheKey = (userId) => `uk_progress_${userId}`;
const baseKey = (userId) => `uk_base_${userId}`;
const sendingKey = (userId) => `uk_sending_${userId}`;
const USER_KEY = "uk_user";
const CONFIG_KEY = "uk_config";

const readJson = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const writeJson = (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

export function StoreProvider({ children }) {
  // `phase` is what the shell shows: "boot" while deciding, "auth" when nobody is signed in, "ready"
  // when a level is loaded, "failed" when even the cached copy is unusable.
  const [phase, setPhase] = useState("boot");
  const [bootError, setBootError] = useState(null);
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState({});
  const [levels, setLevels] = useState([]);
  const [course, setCourse] = useState(null);
  const [offline, setOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [toast, setToast] = useState(null);
  const [, setVersion] = useState(0);

  const state = useRef(null);
  const base = useRef(null);
  const baseAt = useRef(null);
  const dirty = useRef(false);
  const saveTimer = useRef(null);
  const inflight = useRef(null);
  const lost = useRef(null);
  const conflicts = useRef(0);
  const userRef = useRef(null);
  // A save that fails may have to schedule another one, and a 401 has to sign the learner out — both of
  // which are defined below it. Holding them in refs keeps the cycle from turning into a stale closure.
  const flushRef = useRef(() => {});
  const signOutRef = useRef(async () => {});

  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const say = useCallback((message, tone = "ink") => setToast({ message, tone, at: Date.now() }), []);

  // ---------- Saving ----------
  const keepLocal = useCallback(() => {
    if (!userRef.current || !state.current) return;
    writeJson(cacheKey(userRef.current.id), { v: 1, dirty: dirty.current, state: state.current });
  }, []);

  const setBase = useCallback((snapshot, at) => {
    base.current = snapshot;
    baseAt.current = at;
    if (userRef.current) writeJson(baseKey(userRef.current.id), { at, state: snapshot });
  }, []);

  const push = useCallback(async () => {
    const me = userRef.current;
    if (!me || !state.current) return;
    const snapshot = clone(state.current);
    const rev = newRev();
    setSyncing(true);
    try {
      let answer;
      if (base.current) {
        const changes = diffState(base.current, snapshot);
        if (!changes.length) { keepLocal(); setSyncError(false); return; }
        await AsyncStorage.setItem(sendingKey(me.id), rev).catch(() => {});
        answer = await api.patchProgress(changes, { baseAt: baseAt.current, rev });
      } else {
        await AsyncStorage.setItem(sendingKey(me.id), rev).catch(() => {});
        answer = await api.putProgress(snapshot, { baseAt: baseAt.current, rev });
      }
      setBase(snapshot, answer.updatedAt);
      lost.current = null;
      conflicts.current = 0;
      setSyncError(false);
      setOffline(false);
      keepLocal();
      if (dirty.current) saveTimer.current = setTimeout(() => flushRef.current(), 700);
    } catch (error) {
      dirty.current = true;
      if (error.status === 401) {
        say("Sessiya tugadi — qaytadan kiring", "bad");
        await signOutRef.current();
        return;
      }
      if (error.status === 409 && error.conflict) {
        // Another device saved first. Merge its progress into ours and try again; if devices keep
        // colliding, back off rather than fighting.
        if (lost.current && error.rev && error.rev === lost.current.rev) {
          setBase(lost.current.snapshot, error.updatedAt); // our save did arrive; only its answer was lost
        } else {
          const merged = srs.normalize(mergeStates(base.current, state.current, error.state));
          for (const key of Object.keys(state.current)) if (!(key in merged)) delete state.current[key];
          Object.assign(state.current, merged);
          setBase(error.state, error.updatedAt);
          say("Boshqa qurilmadagi progress bilan birlashtirildi");
          bump();
        }
        lost.current = null;
        keepLocal();
        if (++conflicts.current <= 3) { saveTimer.current = setTimeout(() => flushRef.current(), 0); return; }
      } else if (error.status === 0) {
        lost.current = { rev, snapshot }; // it may still have reached the server
        setOffline(true);
      }
      setSyncError(true);
      saveTimer.current = setTimeout(() => flushRef.current(), 8000);
    } finally {
      setSyncing(false);
    }
  }, [bump, keepLocal, say, setBase]);

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    while (inflight.current) await inflight.current;
    if (!dirty.current || !userRef.current || !state.current) return;
    dirty.current = false;
    inflight.current = push().finally(() => { inflight.current = null; });
    return inflight.current;
  }, [push]);
  flushRef.current = flush;

  // What every screen calls after changing progress: redraw now, send in a moment.
  const save = useCallback(() => {
    if (!state.current || !userRef.current) return;
    dirty.current = true;
    bump();
    keepLocal();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushRef.current(), 700);
  }, [bump, keepLocal]);

  // ---------- Loading ----------
  const openLevel = useCallback(async (levelId, { force = false } = {}) => {
    const loaded = await loadLevel(levelId, { force });
    setCourse(loaded);
    setOffline((was) => was || !!loaded.offline);
    if (state.current) {
      // The queue is bounded before the first render, never during one.
      if (srs.newDay(state.current, loaded)) save();
    }
    return loaded;
  }, [save]);

  const startSession = useCallback(async (signedInUser) => {
    userRef.current = signedInUser;
    setUser(signedInUser);
    writeJson(USER_KEY, signedInUser);

    const cached = await readJson(cacheKey(signedInUser.id));
    const saved = await readJson(baseKey(signedInUser.id));
    const sentRev = await AsyncStorage.getItem(sendingKey(signedInUser.id)).catch(() => null);
    lost.current = null;
    conflicts.current = 0;

    let remote = null;
    try {
      remote = await api.getProgress();
      setOffline(false);
    } catch (error) {
      if (error.status !== 0 || !cached || !cached.state) throw error;
      // No network. This device's copy is a whole one; it syncs when the connection returns.
      setOffline(true);
      state.current = srs.normalize(cached.state);
      base.current = saved ? saved.state : null;
      baseAt.current = saved ? saved.at : null;
      dirty.current = !!cached.dirty;
      return;
    }

    const unsynced = !!(cached && cached.state && cached.dirty);
    let next = remote.state;
    let merged = false;
    if (unsynced) {
      if (!remote.state) next = cached.state;
      // The server still holds what this device last knew, or this device's own last save: nothing to merge.
      else if ((saved && saved.at === remote.updatedAt) || (sentRev && sentRev === remote.rev)) next = cached.state;
      else { next = mergeStates(saved ? saved.state : null, cached.state, remote.state); merged = true; }
    }
    setBase(remote.state, remote.updatedAt);
    // A copy: base must keep the server's version while state.current changes under it.
    state.current = srs.normalize(next ? clone(next) : srs.freshState({ joined: signedInUser.createdAt || today() }));
    state.current.profile.name = signedInUser.name;
    state.current.profile.email = signedInUser.email;
    dirty.current = unsynced || !remote.state;
    if (merged) say("Boshqa qurilmadagi progress bilan birlashtirildi");
  }, [say, setBase]);

  const finishSignIn = useCallback(async (signedInUser) => {
    await startSession(signedInUser);
    const manifest = await loadManifest().catch(() => null);
    if (manifest) setLevels(manifest.levels || []);
    const wanted = state.current.profile.level || (manifest && manifest.defaultLevel) || "b";
    const available = (manifest?.levels || []).find((level) => level.id === wanted && !level.locked)
      || (manifest?.levels || []).find((level) => !level.locked);
    const levelId = available ? available.id : wanted;
    if (state.current.profile.level !== levelId) { state.current.profile.level = levelId; dirty.current = true; }
    await openLevel(levelId);
    setPhase("ready");
    if (dirty.current) save();
    else keepLocal();
  }, [keepLocal, openLevel, save, startSession]);

  const boot = useCallback(async () => {
    setPhase("boot");
    setBootError(null);
    try {
      const fresh = await api.config().catch(() => null);
      if (fresh) { setConfig(fresh); writeJson(CONFIG_KEY, fresh); }
      else setConfig((await readJson(CONFIG_KEY)) || {});

      const hasToken = await restoreSession();
      if (!hasToken) { setPhase("auth"); return; }

      let me;
      try {
        me = (await api.me()).user;
      } catch (error) {
        if (error.status === 0) {
          const cachedUser = await readJson(USER_KEY);
          if (!cachedUser) throw error;
          me = cachedUser;
          setOffline(true);
        } else { setPhase("auth"); return; }
      }
      await finishSignIn(me);
    } catch (error) {
      setBootError(error instanceof ApiError ? error.message : "Ilovani ochib bo'lmadi");
      setPhase("failed");
    }
  }, [finishSignIn]);

  useEffect(() => { boot(); }, [boot]);

  // ---------- Signing in and out ----------
  const auth = useMemo(() => ({
    register: async (name, email, password) => { await finishSignIn((await api.register(name, email, password)).user); },
    login: async (email, password) => { await finishSignIn((await api.login(email, password)).user); },
    google: async (tokens) => { await finishSignIn((await api.google(tokens)).user); },
    demo: async () => { await finishSignIn((await api.demo()).user); },
    forgot: (email) => api.forgotPassword(email),
    reset: async (token, password) => { await finishSignIn((await api.resetPassword(token, password)).user); },
  }), [finishSignIn]);

  const signOutLocal = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const me = userRef.current;
    // Progress the server has not seen yet is the one thing worth keeping; everything else on a phone
    // someone else may pick up is not.
    if (me && !dirty.current) {
      await AsyncStorage.multiRemove([cacheKey(me.id), baseKey(me.id), sendingKey(me.id)]).catch(() => {});
    }
    await AsyncStorage.removeItem(USER_KEY).catch(() => {});
    state.current = null;
    base.current = null;
    baseAt.current = null;
    dirty.current = false;
    userRef.current = null;
    setUser(null);
    setCourse(null);
    setPhase("auth");
  }, []);
  signOutRef.current = signOutLocal;

  const signOut = useCallback(async () => {
    await flush().catch(() => {});
    await api.logout().catch(() => {});
    await signOutLocal();
  }, [flush, signOutLocal]);

  const deleteAccount = useCallback(async (password) => {
    await api.deleteAccount(password);
    const me = userRef.current;
    if (me) await AsyncStorage.multiRemove([cacheKey(me.id), baseKey(me.id), sendingKey(me.id)]).catch(() => {});
    await clearContent().catch(() => {});
    await signOutLocal();
  }, [signOutLocal]);

  // ---------- Switching level ----------
  const switchLevel = useCallback(async (levelId) => {
    if (!state.current) return;
    state.current.profile.level = levelId;
    save();
    await openLevel(levelId);
    bump();
  }, [bump, openLevel, save]);

  // ---------- Leaving and coming back ----------
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        // A phone that stayed in a pocket overnight is the other moment the local date changes.
        if (state.current && course && srs.newDay(state.current, course)) save();
        return;
      }
      flush().catch(() => {});
    });
    return () => subscription.remove();
  }, [course, flush, save]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // A renamed account or a changed password comes back from the server as a new user object.
  const updateUser = useCallback((next) => {
    if (!next) return;
    userRef.current = next;
    setUser(next);
    writeJson(USER_KEY, next);
    if (state.current) { state.current.profile.name = next.name; state.current.profile.email = next.email; }
    bump();
  }, [bump]);

  const value = useMemo(() => ({
    phase, bootError, retryBoot: boot, updateUser,
    user, config, levels, course, offline, syncing, syncError,
    get state() { return state.current; },
    save, flush, bump, say,
    toast, clearToast: () => setToast(null),
    auth, signOut, deleteAccount, switchLevel, openLevel,
    // Narrator audio only exists where the server said it does.
    audio: config.clips !== false,
    // The one place that decides which pieces of the course the learner may reach. Real payment comes
    // later; until then everybody is on the free plan and the limits below are what the screens read.
    premium: !!user?.premium,
  }), [
    phase, bootError, boot, user, config, levels, course, offline, syncing, syncError,
    save, flush, bump, say, toast, auth, signOut, deleteAccount, switchLevel, openLevel, updateUser,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

// A screen that changes progress calls this instead of reaching for the object twice: it hands over the
// state, runs the change, and saves — so no screen can forget the save.
export function useProgress() {
  const store = useStore();
  return useCallback((change) => {
    if (!store.state) return undefined;
    const result = change(store.state, store.course);
    store.save();
    return result;
  }, [store]);
}
