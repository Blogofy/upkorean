import { test, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

// A throwaway database and VAPID keys for this test file.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "upkorean-push-"));
process.env.DATA_DIR = dataDir;
const { q, db } = await import("../server/db.js");
const { reminderFor, reminderTimes, runReminders, PUSH_PUBLIC_KEY } = await import("../server/push.js");
after(() => { db.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const require = createRequire(import.meta.url);
const webpush = require("web-push");
const ece = require("http_ece");

const TZ = -300; // Tashkent
const at = (date, hm) => Date.parse(`${date}T${hm}:00+05:00`);
const TODAY = "2026-09-16";

function learner({ reminders = { on: true, learn: "09:00", review: "20:30", streak: true }, act = {}, words = {}, days = {} } = {}) {
  const email = `u${crypto.randomUUID()}@mail.uz`;
  const { lastInsertRowid: id } = q.insertUser.run(email, "Test", null, null);
  const state = { profile: { pace: 17, reminders }, act, words, days };
  q.putProgress.run(id, JSON.stringify(state), 0, null, 0, Date.now(), null);
  const t = reminderTimes(state);
  q.putReminders.run(id, TZ, t.learn, t.review, t.streak);
  q.putSub.run(`https://fcm.googleapis.com/fcm/send/${id}`, id, "key", "auth", Date.now());
  return Number(id);
}
const collect = () => { const sent = []; const send = async (userId, payload) => { sent.push({ userId, ...payload }); return { delivered: 1, retry: false }; }; return { sent, send }; };

test("reminder times come from the saved profile", () => {
  assert.deepEqual(reminderTimes({ profile: { reminders: { on: true, learn: "09:00", review: "20:30", streak: true } } }), { learn: "09:00", review: "20:30", streak: "21:30" });
  assert.deepEqual(reminderTimes({ profile: { reminders: { on: false, learn: "09:00" } } }), { learn: null, review: null, streak: null });
  assert.deepEqual(reminderTimes({ profile: { reminders: { on: true, learn: "25:00", learnOn: true, review: "20:30", reviewOn: false } } }), { learn: null, review: null, streak: null });
  assert.deepEqual(reminderTimes(null), { learn: null, review: null, streak: null });
});

test("reminder content depends on what the learner still has to do today", () => {
  const studied = { act: { [TODAY]: { learned: 5, reviewed: 0, xp: 20, min: {} } } };
  assert.equal(reminderFor("learn", studied, TODAY), null);
  const fresh = { days: { 1: { done: true }, 2: { done: true } }, act: {}, profile: { pace: 33 } };
  assert.match(reminderFor("learn", fresh, TODAY).body, /3-kun .* 40 daqiqa/);

  const words = { a: { learned: "x", due: "2026-09-15" }, b: { learned: "x", due: TODAY }, c: { learned: "x", due: "2026-09-20" }, d: { due: "2026-09-01" } };
  assert.match(reminderFor("review", { words }, TODAY).body, /^2 ta so'z/);
  assert.equal(reminderFor("review", { words: { c: words.c } }, TODAY), null);

  const act = { "2026-09-15": { learned: 1, min: {} }, "2026-09-14": { reviewed: 2, min: {} }, "2026-09-12": { learned: 3, min: {} } };
  assert.equal(reminderFor("streak", { act }, TODAY).title, "2 kunlik seriya xavf ostida");
  assert.equal(reminderFor("streak", { act: {} }, TODAY), null);
});

test("the scheduler sends each due reminder once per local day, within two hours of its time", async () => {
  const id = learner({ words: { w: { learned: "2026-09-10", due: "2026-09-15" } }, act: { "2026-09-15": { learned: 3, min: {} } } });
  const { sent, send } = collect();
  const mine = () => sent.filter((s) => s.userId === id).map((s) => s.tag);

  await runReminders(at(TODAY, "08:59"), send);
  assert.deepEqual(mine(), []);
  await runReminders(at(TODAY, "09:01"), send);
  assert.deepEqual(mine(), ["learn"]);
  await runReminders(at(TODAY, "09:30"), send);
  assert.deepEqual(mine(), ["learn"], "not twice on the same day");
  await runReminders(at(TODAY, "20:31"), send);
  await runReminders(at(TODAY, "21:31"), send);
  assert.deepEqual(mine(), ["learn", "review", "streak"]);
  await runReminders(at("2026-09-17", "09:00"), send);
  assert.deepEqual(mine(), ["learn", "review", "streak", "learn"], "again the next day");
});

test("a reminder more than two hours late is skipped, and learners who already studied get none", async () => {
  const late = learner({ reminders: { on: true, learn: "06:00", review: "20:30" } }); // 3h10m late at 09:10
  const busy = learner({ act: { [TODAY]: { learned: 10, reviewed: 3, xp: 50, min: { learn: 12 } } } });
  const off = learner({ reminders: { on: false, learn: "09:00" } });
  const { sent, send } = collect();
  await runReminders(at(TODAY, "09:10"), send);
  assert.equal(sent.filter((s) => s.userId === late).length, 0);
  assert.equal(sent.filter((s) => s.userId === busy).length, 0);
  assert.equal(sent.filter((s) => s.userId === off).length, 0);
});

test("a reminder is kept for the next tick when the send fails, and given up on when retrying cannot help", async () => {
  const DAY = "2026-09-19";
  const flaky = learner({ reminders: { on: true, learn: "09:00" } }); // push service answers 500 once
  const broken = learner({ reminders: { on: true, learn: "09:00" } }); // ... and keeps answering 500
  const gone = learner({ reminders: { on: true, learn: "09:00" } }); // 404/410: the subscription was dropped
  const tries = {};
  let down = true;
  const send = async (userId) => {
    tries[userId] = (tries[userId] || 0) + 1;
    if (userId === broken || (userId === flaky && down)) return { delivered: 0, retry: true };
    if (userId === gone) return { delivered: 0, retry: false };
    return { delivered: 1, retry: false };
  };

  await runReminders(at(DAY, "09:01"), send);
  assert.deepEqual([tries[flaky], tries[broken], tries[gone]], [1, 1, 1]);
  down = false;
  await runReminders(at(DAY, "09:02"), send);
  assert.equal(tries[flaky], 2, "a failed send is retried on the next tick, not silently lost");
  await runReminders(at(DAY, "09:03"), send);
  assert.equal(tries[flaky], 2, "once it is delivered it is done for the day");
  assert.equal(tries[gone], 1, "a subscription that is gone is not worth retrying");

  await runReminders(at(DAY, "09:04"), send);
  await runReminders(at(DAY, "09:05"), send);
  assert.equal(tries[broken], 3, "a send that keeps failing gives up instead of retrying the whole window");
});

test("the payload a push service receives is encrypted for the subscriber and decrypts to the reminder", () => {
  const receiver = crypto.createECDH("prime256v1");
  receiver.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    keys: { p256dh: receiver.getPublicKey().toString("base64url"), auth: authSecret.toString("base64url") },
  };
  const payload = { title: "Takrorlash vaqti", body: "3 ta so'z", url: "/#/review", tag: "review" };
  const req = webpush.generateRequestDetails(subscription, JSON.stringify(payload), { TTL: 60 });
  assert.equal(req.headers["Content-Encoding"], "aes128gcm");
  assert.match(req.headers.Authorization, new RegExp(`^vapid t=.+, k=${PUSH_PUBLIC_KEY}$`));
  const plain = ece.decrypt(req.body, { version: "aes128gcm", privateKey: receiver, authSecret: subscription.keys.auth });
  assert.deepEqual(JSON.parse(plain.toString("utf8")), payload);
});

test("VAPID keys are generated once and reused", async () => {
  const saved = JSON.parse(fs.readFileSync(path.join(dataDir, "vapid.json"), "utf8"));
  assert.equal(saved.publicKey, PUSH_PUBLIC_KEY);
});
