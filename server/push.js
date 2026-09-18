// Web Push reminders: VAPID keys, sending to a learner's browsers, and the once-a-minute reminder check.
import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { q, DATA_DIR } from "./db.js";
import { localTime } from "./progress.js";

// ---------- Keys ----------
// VAPID keys identify this server to the browsers' push services. Subscriptions are tied to the public key,
// so it must never change: taken from .env, or generated once and kept in DATA_DIR/vapid.json.
function loadKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const file = path.join(DATA_DIR, "vapid.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(file, JSON.stringify(keys, null, 2));
  return keys;
}

// Push services (Apple's in particular) want a contact: an https site or a mailto: address.
function contact() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const app = process.env.APP_URL || "";
  if (app.startsWith("https://")) return app;
  const mail = (process.env.MAIL_FROM || process.env.SMTP_USER || "").match(/[^\s<>]+@[^\s<>]+/);
  return mail ? `mailto:${mail[0]}` : "mailto:admin@example.com";
}

const keys = loadKeys();
export const PUSH_PUBLIC_KEY = keys.publicKey;
export const PUSH_CONTACT = contact();
webpush.setVapidDetails(PUSH_CONTACT, keys.publicKey, keys.privateKey);

// ---------- Sending ----------
// One delivery round for a learner: how many browsers got it, and whether trying again could still help.
// A 404/410 means that subscription is gone for good, so it is dropped and there is nothing to retry;
// anything else (5xx, a network hiccup, a momentarily wrong key) is transient and worth another attempt.
export async function deliverToUser(userId, payload) {
  let delivered = 0;
  let retry = false;
  for (const sub of q.subsForUser.all(userId)) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 3 * 3600, urgency: "normal", topic: payload.tag },
      );
      delivered++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        q.deleteSub.run(sub.endpoint);
        console.log(`[push] user ${userId}: subscription expired (${err.statusCode}), removed`);
      }
      else {
        retry = true;
        console.error(`[push] user ${userId}: ${err.statusCode || ""} ${err.body || err.message}`);
      }
    }
  }
  return { delivered, retry };
}

// Sends to every browser the learner subscribed; returns how many of them got it.
export async function sendToUser(userId, payload) {
  return (await deliverToUser(userId, payload)).delivered;
}

// ---------- What to remind about ----------
const DAYS = 30;
const MINUTES = { 11: 12, 17: 22, 33: 40 };
const activeOn = (act) => !!act && (act.learned > 0 || act.reviewed > 0 || Object.values(act.min || {}).reduce((s, v) => s + v, 0) >= 1);
const prevDay = (key) => new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

// The notification for one reminder kind, or null when the learner does not need it today.
export function reminderFor(kind, state, today) {
  const act = state.act || {};
  const studiedToday = activeOn(act[today]);
  if (kind === "learn") {
    if (studiedToday) return null;
    let day = 1;
    while (day <= DAYS && state.days && state.days[day] && state.days[day].done) day++;
    if (day > DAYS) return null;
    const min = MINUTES[state.profile && state.profile.pace] || 22;
    return { title: "Bugungi dars vaqti", body: `${day}-kun sizni kutmoqda — taxminan ${min} daqiqa.`, url: `/#/day/${day}`, tag: "learn" };
  }
  if (kind === "review") {
    const due = Object.values(state.words || {}).filter((w) => w && w.learned && w.due && w.due <= today).length;
    if (!due) return null;
    return { title: "Takrorlash vaqti", body: `${due} ta so'z takrorlashni kutmoqda. Bir necha daqiqa ajrating — so'zlar esdan chiqmasin.`, url: "/#/review", tag: "review" };
  }
  if (kind === "streak") {
    if (studiedToday) return null;
    let streak = 0;
    for (let d = prevDay(today); activeOn(act[d]); d = prevDay(d)) streak++;
    if (!streak) return null;
    return { title: `${streak} kunlik seriya xavf ostida`, body: "Bugun hali mashq qilmadingiz. Seriyani saqlash uchun bir nechta so'z takrorlang.", url: "/#/review", tag: "streak" };
  }
  return null;
}

// Reminder times from the saved progress, as stored in the reminders table.
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function reminderTimes(state) {
  const r = (state && state.profile && state.profile.reminders) || {};
  if (!r.on) return { learn: null, review: null, streak: null };
  return {
    learn: r.learnOn !== false && HM.test(r.learn) ? r.learn : null,
    review: r.reviewOn !== false && HM.test(r.review) ? r.review : null,
    streak: r.streak ? "21:30" : null,
  };
}

// A reminder is due from its time until two hours later (covers a server restart), once per local day.
const WINDOW_MIN = 120;
const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));

// A delivery that failed for a passing reason is left unmarked so the next tick retries it — but only a
// few times, so a push service that stays broken is not hammered for the whole window. Attempts live in
// memory as `${user}:${kind}` -> { day, n }: a new local day replaces the old entry, so the map never
// grows past the reminders table. Trade-off: a restart clears them, which only grants a fresh set of
// tries — the marking itself stays in the database, so no reminder can go out twice.
const MAX_TRIES = 3;
const attempts = new Map();

let running = false;
export async function runReminders(now = Date.now(), send = deliverToUser) {
  if (running) return 0;
  running = true;
  let sent = 0;
  try {
    for (const row of q.activeReminders.all()) {
      const { today, minutes } = localTime(now, row.tz);
      let state; // parsed only when some reminder is actually due
      for (const kind of ["learn", "review", "streak"]) {
        const at = row[`${kind}_at`];
        if (!at || row[`${kind}_sent`] === today) continue;
        const late = minutes - toMin(at);
        if (late < 0 || late > WINDOW_MIN) continue;
        if (state === undefined) {
          const p = q.getProgress.get(row.user_id);
          try { state = p ? JSON.parse(p.state) : null; } catch { state = null; }
        }
        const payload = state && reminderFor(kind, state, today);
        if (!payload) { q.markSent[kind].run(today, row.user_id); continue; } // not needed today: handled
        const { delivered, retry } = await send(row.user_id, payload);
        if (delivered) sent++;
        const key = `${row.user_id}:${kind}`;
        const prev = attempts.get(key);
        const n = (prev && prev.day === today ? prev.n : 0) + 1;
        // Marked only once it is out of our hands: delivered, no live subscription left, or out of tries.
        if (delivered || !retry || n >= MAX_TRIES) { q.markSent[kind].run(today, row.user_id); attempts.delete(key); }
        else attempts.set(key, { day: today, n });
      }
    }
  } finally {
    running = false;
  }
  return sent;
}
