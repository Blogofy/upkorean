// The one daily reminder, scheduled on the phone itself.
//
// The server used to send Web Push to browsers; the app does not need a server for this. The reminder is a
// local notification at the learner's chosen time, one for each of the next two weeks — not a repeating
// one, so that a day whose plan is already kept can be left out: a reminder that nags after the work is
// done teaches people to ignore it. It is rescheduled whenever the setting changes, the app starts or
// today's plan is kept, so it always matches the saved profile. Someone who stays away for two weeks stops
// hearing from the app, which is kinder than a reminder they have learnt to swipe away.
//
// Expo Go on Android refuses to even load expo-notifications (it throws on import since SDK 53), so the
// module is required lazily and never inside Expo Go. There the reminder is simply off; a development or
// store build has it.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const CHANNEL = "reminders";
const DAYS_AHEAD = 14;
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let module = null;
function notifications() {
  if (IN_EXPO_GO) return null;
  if (!module) {
    module = require("expo-notifications");
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return module;
}

// Turns the reminder on or off to match `reminders` ({ on, at: "HH:MM" }). `keptToday` leaves today out;
// `words` is the day's standard, which the reminder names.
// Returns false when the learner has not allowed notifications, so the screen can say why nothing will
// arrive.
//
// Calls run one after another: the profile and the app shell can both ask at once, and two runs interleaving
// their cancel-then-schedule would leave every reminder scheduled twice.
let queue = Promise.resolve();
export function syncReminder(reminders, options) {
  const run = queue.then(() => schedule(reminders, options));
  queue = run.catch(() => {});
  return run;
}

async function schedule(reminders, { ask = false, keptToday = false, words = 20 } = {}) {
  const Notifications = notifications();
  // Expo Go: nothing to schedule, and no reason to tell the learner to change a permission.
  if (!Notifications) return true;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!reminders || !reminders.on) return true;

    let { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (!granted && ask && canAskAgain) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Kunlik eslatma",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const [hour, minute] = String(reminders.at || "20:00").split(":").map(Number);
    const now = new Date();
    for (let i = keptToday ? 1 : 0; i < DAYS_AHEAD; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, Number.isFinite(hour) ? hour : 20, Number.isFinite(minute) ? minute : 0);
      if (at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "UpKorean",
          body: `Bugungi reja hali bajarilmagan — ${words} ta yangi so'z. Seriyani saqlab qoling.`,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
    return true;
  } catch {
    return false;
  }
}

// Whether reminders can work in this build at all — false in Expo Go.
export const remindersAvailable = !IN_EXPO_GO;
