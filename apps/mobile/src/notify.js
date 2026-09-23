// The one daily reminder, scheduled on the phone itself.
//
// The server used to send Web Push to browsers; the app does not need a server for this. A local
// notification repeats every day at the learner's chosen time and survives the app being closed, and it
// is rescheduled whenever the setting changes or the app starts, so it always matches the saved profile.
//
// Expo Go on Android refuses to even load expo-notifications (it throws on import since SDK 53), so the
// module is required lazily and never inside Expo Go. There the reminder is simply off; a development or
// store build has it.
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

const CHANNEL = "reminders";
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

// Turns the reminder on or off to match `reminders` ({ on, at: "HH:MM" }). Returns false when the learner
// has not allowed notifications, so the screen can say why nothing will arrive.
export async function syncReminder(reminders, { ask = false } = {}) {
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
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "UpKorean",
        body: "Bugungi so'zlar sizni kutmoqda — seriyani saqlab qoling.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Number.isFinite(hour) ? hour : 20,
        minute: Number.isFinite(minute) ? minute : 0,
        channelId: CHANNEL,
      },
    });
    return true;
  } catch {
    return false;
  }
}

// Whether reminders can work in this build at all — false in Expo Go.
export const remindersAvailable = !IN_EXPO_GO;
