// The one daily reminder, scheduled on the phone itself.
//
// The server used to send Web Push to browsers; the app does not need a server for this. A local
// notification repeats every day at the learner's chosen time and survives the app being closed, and it
// is rescheduled whenever the setting changes or the app starts, so it always matches the saved profile.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const CHANNEL = "reminders";

// Turns the reminder on or off to match `reminders` ({ on, at: "HH:MM" }). Returns false when the learner
// has not allowed notifications, so the screen can say why nothing will arrive.
export async function syncReminder(reminders, { ask = false } = {}) {
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
