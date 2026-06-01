/**
 * widget-bridge.js — StillMind
 * Writes session + streak data to native shared storage
 * so iOS/Android widgets can read it without the app being open.
 *
 * iOS:  NSUserDefaults with App Group "group.de.stillmind.app"
 * Android: SharedPreferences "de.stillmind.app.widget"
 */
import { Platform, NativeModules } from "react-native";

// ── Shared Preferences bridge ─────────────────────────────────────────────────
// We use @react-native-community/async-storage's SharedPreferences bridge
// OR expo-modules — but the simplest approach: use a tiny native module.
// For Expo managed workflow we use expo-shared-preferences if available,
// otherwise fall back to writing a JSON file the widget reads.

let SharedGroupPreferences = null;
try {
  // react-native-shared-group-preferences (works iOS + Android)
  const mod = require("react-native-shared-group-preferences");
  SharedGroupPreferences = mod ? (mod.default ?? mod) : null;
} catch (_) {}

const IOS_APP_GROUP    = "group.de.stillmind.app";
const ANDROID_PREFS    = "de.stillmind.app.widget";

/**
 * Update widget data. Call after every session + on app launch.
 * @param {{ streak: number, doneToday: boolean, missedDays: number }} data
 */
export const updateWidgetData = async ({ streak, doneToday, missedDays }) => {
  try {
    if (Platform.OS === "ios" && SharedGroupPreferences) {
      await SharedGroupPreferences.setItem("widget_streak",     String(streak),     IOS_APP_GROUP);
      await SharedGroupPreferences.setItem("widget_done_today", doneToday ? "1" : "0", IOS_APP_GROUP);
      await SharedGroupPreferences.setItem("widget_missed_days", String(missedDays), IOS_APP_GROUP);
      await SharedGroupPreferences.setItem("widget_last_date",  new Date().toISOString().slice(0, 10), IOS_APP_GROUP);

      // Reload widget timeline
      try {
        const { reloadAllTimelines } = require("react-native-widgetkit");
        reloadAllTimelines();
      } catch (_) {}
    }

    if (Platform.OS === "android" && SharedGroupPreferences) {
      await SharedGroupPreferences.setItem("widget_streak",      String(streak),      ANDROID_PREFS);
      await SharedGroupPreferences.setItem("widget_done_today",  doneToday ? "1" : "0", ANDROID_PREFS);
      await SharedGroupPreferences.setItem("widget_missed_days", String(missedDays),  ANDROID_PREFS);
    }
  } catch (_) {}
};

/**
 * Compute widget data from storage and push to native layer.
 * Call after every session completion and on app launch.
 */
export const syncWidgetData = async () => {
  try {
    const {
      getDailyStreak,
      getSessionHistory,
    } = require("@/utils/storage");

    const history = await getSessionHistory().catch(() => []);
    const streak  = await getDailyStreak(history).catch(() => 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const list = Array.isArray(history) ? history : [];

    const doneToday = list.some((e) => {
      if (!e || (e.type && e.type !== "start")) return false;
      const ts = typeof e.timestamp === "number" ? e.timestamp : Number(e.date || 0);
      if (!ts) return false;
      const d = new Date(ts);
      return d.toISOString().slice(0, 10) === todayStr;
    });

    // missedDays: how many consecutive days without a session (not counting today)
    let missedDays = 0;
    if (!doneToday) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const checkStr = checkDate.toISOString().slice(0, 10);
        const hadSession = list.some((e) => {
          if (!e || (e.type && e.type !== "start")) return false;
          const ts = typeof e.timestamp === "number" ? e.timestamp : Number(e.date || 0);
          if (!ts) return false;
          return new Date(ts).toISOString().slice(0, 10) === checkStr;
        });
        if (hadSession) break;
        missedDays++;
      }
    }

    await updateWidgetData({ streak, doneToday, missedDays });
  } catch (_) {}
};
