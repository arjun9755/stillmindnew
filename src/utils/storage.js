// apps/mobile/src/utils/storage.js

let _asyncStorageInstance = null;
const getAsyncStorage = () => {
  if (!_asyncStorageInstance) {
    try {
      const mod = require("@react-native-async-storage/async-storage");
      _asyncStorageInstance = mod.default ?? mod;
    } catch (e) {
      console.warn("AsyncStorage loading failed in storage.js:", e);
    }
  }
  return _asyncStorageInstance;
};

const AsyncStorage = new Proxy({}, {
  get(target, prop) {
    const instance = getAsyncStorage();
    if (!instance) {
      return () => Promise.resolve(null);
    }
    const val = instance[prop];
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  }
});

import { Platform } from "react-native";
import {
  CREDITS_KEY,
  CREDITS_TRANSACTIONS_KEY,
  getCredits,
  addCredits,
} from "./credits-storage";

import { getAllModes } from "@/data/mode-quotes";

/* =========================
   Storage keys
   ========================= */
const _hasExpoDynamicAppIcon = () => {
  try {
    const { requireOptionalNativeModule } = require("expo-modules-core");
    if (requireOptionalNativeModule && requireOptionalNativeModule("ExpoDynamicAppIcon")) {
      return true;
    }
  } catch (_) {}
  try {
    if (globalThis.expo?.modules?.ExpoDynamicAppIcon) return true;
    const { NativeModulesProxy } = require("expo-modules-core");
    if (NativeModulesProxy && NativeModulesProxy.ExpoDynamicAppIcon) return true;
  } catch (_) {}
  return false;
};

const _switchAppIcon = async (plan) => {
  try {
    // Only on iOS — Android doesn't support alternate icons via this API
    if (Platform.OS !== "ios") return;
    if (!_hasExpoDynamicAppIcon()) return;

    let setAppIcon = null;
    let getAppIcon = null;
    try {
      const mod = require("expo-dynamic-app-icon");
      const resolved = mod.default ?? mod;
      setAppIcon = resolved.setAppIcon ?? resolved.setAlternateAppIcon ?? null;
      getAppIcon = resolved.getAppIcon ?? resolved.getAlternateAppIcon ?? null;
    } catch (_) {}
    if (!setAppIcon || !getAppIcon) return;
    const targetIcon = plan === "lifetime" ? "premium-life" : null;
    const currentIcon = await getAppIcon().catch(() => null);
    // null = default icon
    if (currentIcon !== targetIcon) {
      await setAppIcon(targetIcon).catch(() => {});
    }
  } catch (_) {}
};


const CANONICAL_ONBOARDING_KEY = "stillmind:onboardingCompleted";

const KEYS = {
  ONBOARDING_COMPLETED: "onboarding_completed",
  USER_PREFERENCES: "user_preferences",
  LOCAL_DATA_CONSENT: "local_data_consent",

  DISCLAIMER_SHOWN: "disclaimer_shown",
  FOCUS_HELP_SHOWN: "focus_help_shown",
  HOW_IT_WORKS_SHOWN: "how_it_works_shown",

  SESSION_HISTORY: "session_history",
  SETTINGS: "settings",
  PREMIUM_STATUS: "premium_status",
  USER_PLAN: "user_plan",
  DEV_PLAN_OVERRIDE: "dev_plan_override",
  SESSION_COUNT_TODAY: "session_count_today",
  LAST_SESSION_DATE: "last_session_date",

  // legacy start-bonus
  START_BONUS_USED: "start_bonus_used",
  TOTAL_SESSIONS: "total_sessions",

  // welcome credits
  WELCOME_CREDITS_GRANTED: "welcome_credits_granted",

  REMINDER_ENABLED: "reminder_enabled",
  REMINDER_TIME: "reminder_time",
  REMINDER_PERMISSION_ASKED: "reminder_permission_asked",
  REMINDER_NEXT_ASK_AT: "reminder_next_ask_at",

  // Interval reminders (2/4/8/12 days; then always 12)
  REMINDER_STAGE: "reminder_stage",
  REMINDER_LAST_SESSION_AT: "reminder_last_session_at",
  REMINDER_NEXT_AT: "reminder_next_at",
  REMINDER_SCHEDULED_ID: "reminder_scheduled_id",

  // ✅ User Name
  USER_NAME: "user_name",

  // ✅ Favorites
  FAVORITE_FOCUS_MODES: "favorite_focus_modes",

  // ✅ Session completions (for achievements / explorer etc.)
  COMPLETED_SESSIONS: "completed_sessions",

  // ✅ Achievements (unlocked badge ids)
  ACHIEVEMENTS_UNLOCKED: "achievements_unlocked",

  // ✅ User goals (custom goals for Pro)
  USER_GOALS: "user_goals",

  // ✅ Statistik: card layout order (drag & drop)
  STATISTIK_CARD_ORDER: "statistik_card_order",

  // ✅ One-time reward when user completes *all* achievements
  ALL_ACHIEVEMENTS_REWARD_GRANTED: "all_achievements_reward_granted",

  // 7-Tage Challenge (Pro Trial tracking)
  CHALLENGE_START_AT: "challenge_start_at",

  // App-Start Zähler
  APP_LAUNCH_COUNT: "app_launch_count",

  // Review Flags (je Trigger einmalig)
  REVIEW_ASKED_SESSION_3:  "review_asked_session_3",
  REVIEW_ASKED_SESSION_10: "review_asked_session_10",
  REVIEW_ASKED_STREAK_7:   "review_asked_streak_7",
  REVIEW_ASKED_LAUNCH_3:   "review_asked_launch_3",
  REVIEW_ASKED_PROGRAM:    "review_asked_program",
  REVIEW_REWARD_GRANTED:   "review_reward_granted",

  // Quote-Push (Morgenimpuls)
  QUOTE_PUSH_ENABLED: "quote_push_enabled",
};

/* =========================
   Date helpers
   ========================= */
const startOfLocalDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// ISO week (Mon 00:00 local time)
const startOfISOWeek = (d) => {
  const x = startOfLocalDay(d);
  const day = x.getDay(); // 0 (So) .. 6 (Sa)
  // shift so Monday is 0
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
};

/* =========================
   Helpers
   ========================= */
const todayKey = () => new Date().toDateString();

const readInt = async (key, fallback = 0) => {
  const v = await AsyncStorage.getItem(key);
  return v ? parseInt(v, 10) : fallback;
};

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_e) {
    return fallback;
  }
};

// Small helpers for boolean feature flags
const getBool = async (key, fallback = false) => {
  try {
    const v = await AsyncStorage.getItem(key);
    if (v === null || v === undefined) return fallback;
    return v === "true";
  } catch (_e) {
    return fallback;
  }
};

const setBool = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, value ? "true" : "false");
  } catch (_e) {}
};

const normalizePlanId = (plan) => {
  const raw = String(plan || "")
    .trim()
    .toLowerCase();
  const compact = raw.replace(/[\s_-]/g, "");

  if (compact === "lifetime" || compact === "premiumlife" || compact === "premiumlifetime") return "lifetime";
  // proLight wurde entfernt → free
  if (compact === "prolight") return "free";
  if (compact === "pro") return "pro";
  return "free";
};

/* =========================
   Onboarding
   ========================= */
export const getOnboardingCompleted = async () => {
  const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETED);
  return value === "true";
};

export const setOnboardingCompleted = async (completed = true) => {
  const v = completed ? "true" : "false";
  // Primary key used by storage helpers
  await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETED, v);
  // Canonical key used by app boot router (and migration target)
  try {
    await AsyncStorage.setItem(CANONICAL_ONBOARDING_KEY, v);
  } catch (_e) {}
};

export const resetOnboarding = async () => {
  await AsyncStorage.removeItem(KEYS.ONBOARDING_COMPLETED);
  try { await AsyncStorage.removeItem(CANONICAL_ONBOARDING_KEY); } catch (_) {}
};

export const getUserPreferences = async () => {
  const value = await AsyncStorage.getItem(KEYS.USER_PREFERENCES);
  const parsed = safeJsonParse(value, []);
  // Onboarding speichert ein Array von Strings. Wir normalisieren konsequent,
  // damit alle Call-Sites stabil bleiben (auch bei korrupten/alten Daten).
  return Array.isArray(parsed)
    ? parsed.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
};

export const saveUserPreferences = async (prefs) => {
  // Onboarding/Personalisierung erwartet ein Array von Strings.
  // Ältere/kaputte Daten (z.B. Objekt) normalisieren wir sauber, damit
  // "Für dich empfohlen" zuverlässig funktioniert.
  let list = [];

  if (Array.isArray(prefs)) {
    list = prefs;
  } else if (prefs && typeof prefs === "object") {
    // Wenn irgendwo noch ein Objekt-Shape durchrutscht ({ key: true }),
    // übernehmen wir die truthy Keys als Auswahl.
    list = Object.keys(prefs).filter((k) => !!prefs[k]);
  }

  // Filter + Dedupe
  list = Array.from(
    new Set(
      (list || [])
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
    )
  );

  await AsyncStorage.setItem(KEYS.USER_PREFERENCES, JSON.stringify(list));
  return list;
};

export const getLocalDataConsent = async () => {
  const value = await AsyncStorage.getItem(KEYS.LOCAL_DATA_CONSENT);
  return value === "true";
};

export const setLocalDataConsent = async (consent = true) => {
  await AsyncStorage.setItem(
    KEYS.LOCAL_DATA_CONSENT,
    consent ? "true" : "false"
  );
};

/* =========================
   Disclaimer / Focus help
   ========================= */
export const getDisclaimerShown = async () => {
  const v = await AsyncStorage.getItem(KEYS.DISCLAIMER_SHOWN);
  return v === "true";
};

export const setDisclaimerShown = async (shown = true) => {
  await AsyncStorage.setItem(KEYS.DISCLAIMER_SHOWN, shown ? "true" : "false");
};

// Einmalige globale Anleitung (HowItWorks) – wird beim ersten Session-Öffnen gezeigt
export const getHowItWorksShown = async () => {
  const v = await AsyncStorage.getItem(KEYS.HOW_IT_WORKS_SHOWN);
  return v === "true";
};

export const setHowItWorksShown = async (shown = true) => {
  await AsyncStorage.setItem(KEYS.HOW_IT_WORKS_SHOWN, shown ? "true" : "false");
};

export const getFocusHelpShown = async () => {
  const v = await AsyncStorage.getItem(KEYS.FOCUS_HELP_SHOWN);
  return v === "true";
};

export const setFocusHelpShown = async (shown = true) => {
  await AsyncStorage.setItem(KEYS.FOCUS_HELP_SHOWN, shown ? "true" : "false");
};

/* =========================
   Settings
   ========================= */
export const getSettings = async () => {
  const v = await AsyncStorage.getItem(KEYS.SETTINGS);
  return safeJsonParse(v, {});
};

export const saveSettings = async (settings) => {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings || {}));
};

/* =========================
   Plan
   ========================= */

// Lightweight in-memory pub/sub for plan changes.
// Tabs stay mounted, so screens must react to plan updates without requiring app restart.
const _planSubscribers = new Set();

const _notifyPlanChanged = (plan) => {
  _planSubscribers.forEach((cb) => {
    try {
      cb(plan);
    } catch (e) {
      // ignore subscriber errors
    }
  });
};

export const subscribeUserPlan = (cb) => {
  if (typeof cb !== "function") return () => {};
  _planSubscribers.add(cb);
  return () => _planSubscribers.delete(cb);
};
export const setUserPlan = async (plan) => {
  const normalized = normalizePlanId(plan || "free");
  await AsyncStorage.setItem(KEYS.USER_PLAN, normalized);
  _notifyPlanChanged(normalized);
  await _switchAppIcon(normalized);
};

export const setDevPlanOverride = async (planOrNull) => {
  if (process.env.NODE_ENV !== "development" || !__DEV__) return;

  if (!planOrNull) {
    await AsyncStorage.removeItem(KEYS.DEV_PLAN_OVERRIDE);
    const p = await getUserPlan();
    _notifyPlanChanged(p);
    return;
  }

  await AsyncStorage.setItem(KEYS.DEV_PLAN_OVERRIDE, String(planOrNull));
  _notifyPlanChanged(normalizePlanId(planOrNull));
};

export const getDevPlanOverride = async () => {
  if (process.env.NODE_ENV !== "development" || !__DEV__) return null;
  const v = await AsyncStorage.getItem(KEYS.DEV_PLAN_OVERRIDE);
  return v || null;
};

export const getUserPlan = async () => {
  const devOverride = await getDevPlanOverride();
  if (devOverride) return normalizePlanId(devOverride);

  const value = await AsyncStorage.getItem(KEYS.USER_PLAN);
  return normalizePlanId(value || "free");
};

/* =========================
   Favorites (Focus modes)
   ========================= */
export const getFavoriteFocusModes = async () => {
  const v = await AsyncStorage.getItem(KEYS.FAVORITE_FOCUS_MODES);
  const arr = safeJsonParse(v, []);
  return Array.isArray(arr)
    ? arr.filter((x) => typeof x === "string" && x.length > 0)
    : [];
};

export const setFavoriteFocusModes = async (ids = []) => {
  const list = Array.isArray(ids)
    ? Array.from(
        new Set(ids.filter((x) => typeof x === "string" && x.length > 0))
      )
    : [];
  await AsyncStorage.setItem(KEYS.FAVORITE_FOCUS_MODES, JSON.stringify(list));
  return list;
};

export const toggleFavoriteFocusMode = async (id) => {
  if (!id || typeof id !== "string") return await getFavoriteFocusModes();
  const cur = await getFavoriteFocusModes();
  const set = new Set(cur);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return await setFavoriteFocusModes(Array.from(set));
};

/* =========================
   Session counters
   ========================= */
export const getSessionCountToday = async () => {
  const today = todayKey();
  const lastDate = await AsyncStorage.getItem(KEYS.LAST_SESSION_DATE);

  let todayCount = await readInt(KEYS.SESSION_COUNT_TODAY, 0);

  if (lastDate !== today) {
    await AsyncStorage.setItem(KEYS.LAST_SESSION_DATE, today);
    await AsyncStorage.setItem(KEYS.SESSION_COUNT_TODAY, "0");
    return 0;
  }

  return todayCount;
};

export const incrementSessionCountToday = async () => {
  const today = todayKey();
  const lastDate = await AsyncStorage.getItem(KEYS.LAST_SESSION_DATE);

  let todayCount = await readInt(KEYS.SESSION_COUNT_TODAY, 0);

  if (lastDate !== today) {
    await AsyncStorage.setItem(KEYS.LAST_SESSION_DATE, today);
    todayCount = 0;
  }

  const newCount = todayCount + 1;
  await AsyncStorage.setItem(KEYS.SESSION_COUNT_TODAY, String(newCount));
  await AsyncStorage.setItem(KEYS.LAST_SESSION_DATE, today);

  return newCount;
};

/* =========================
   History
   ========================= */
export const getSessionHistory = async () => {
  const v = await AsyncStorage.getItem(KEYS.SESSION_HISTORY);
  return safeJsonParse(v, []);
};

export const addToSessionHistory = async (entry) => {
  const history = await getSessionHistory();
  history.unshift(entry);
  await AsyncStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(history));
};

export const updateSessionHistoryEntry = async (entryId, patch = {}) => {
  if (!entryId) return null;

  const history = await getSessionHistory();
  const next = Array.isArray(history) ? [...history] : [];

  const i = next.findIndex((e) => (e && e.id) === entryId);
  if (i === -1) return null;

  next[i] = { ...next[i], ...patch };
  await AsyncStorage.setItem(KEYS.SESSION_HISTORY, JSON.stringify(next));
  return next[i];
};

/* =========================
   Session completions
   ========================= */
export const getCompletedSessions = async () => {
  const v = await AsyncStorage.getItem(KEYS.COMPLETED_SESSIONS);
  const parsed = safeJsonParse(v, []);
  return Array.isArray(parsed)
    ? parsed.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
};

// Marks a session as completed at least once (used for achievements like "Explorer").
// This is intentionally lightweight and local-only.
export const saveSessionCompletion = async (sessionId) => {
  const sid = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!sid) return null;

  const cur = await getCompletedSessions();
  if (cur.includes(sid)) return cur;

  const next = [sid, ...cur];
  await AsyncStorage.setItem(KEYS.COMPLETED_SESSIONS, JSON.stringify(next));
  return next;
};

/* =========================
   Achievements (local)
   ========================= */
export const getUnlockedAchievements = async () => {
  const v = await AsyncStorage.getItem(KEYS.ACHIEVEMENTS_UNLOCKED);
  const parsed = safeJsonParse(v, []);
  return Array.isArray(parsed)
    ? parsed.filter((x) => typeof x === "string" && x.trim().length > 0)
    : [];
};

export const setUnlockedAchievements = async (ids = []) => {
  const list = Array.isArray(ids)
    ? Array.from(
        new Set(
          ids
            .filter((x) => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => x.length > 0)
        )
      )
    : [];
  await AsyncStorage.setItem(KEYS.ACHIEVEMENTS_UNLOCKED, JSON.stringify(list));
  return list;
};

export const unlockAchievements = async (achievementIds = []) => {
  const incoming = Array.isArray(achievementIds)
    ? achievementIds
    : [achievementIds];
  const cleaned = incoming
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  if (cleaned.length === 0) {
    return { unlocked: await getUnlockedAchievements(), newlyUnlocked: [] };
  }

  const current = await getUnlockedAchievements();
  const set = new Set(current);
  const newlyUnlocked = [];

  for (const id of cleaned) {
    if (!set.has(id)) {
      set.add(id);
      newlyUnlocked.push(id);
    }
  }

  const unlocked = Array.from(set);
  if (newlyUnlocked.length > 0) await setUnlockedAchievements(unlocked);
  return { unlocked, newlyUnlocked };
};

// Count-based achievements only (robust & low-risk for Launch)
export const evaluateCountAchievements = (totalSessions) => {
  // Counts "Starts" (each session start counts, also if aborted) – fits StillMind's "ohne Druck".
  const n = typeof totalSessions === "number" ? totalSessions : 0;
  const out = [];
  if (n >= 1) out.push("sessions_1");
  if (n >= 5) out.push("sessions_5");
  if (n >= 25) out.push("sessions_25");
  if (n >= 50) out.push("sessions_50");
  if (n >= 100) out.push("sessions_100");
  return out;
};

export const evaluateExplorerAchievement = (
  completedSessionIds = [],
  allSessionIds = []
) => {
  const completed = new Set(
    (Array.isArray(completedSessionIds) ? completedSessionIds : [])
      .filter((x) => typeof x === "string")
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
  );

  const all = (Array.isArray(allSessionIds) ? allSessionIds : [])
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

  if (all.length === 0) return [];
  for (const id of all) {
    if (!completed.has(id)) return [];
  }
  return ["explorer"];
};

export const checkAndUnlockAchievementsAfterSession = async () => {
  // After each session we run the *full* achievement evaluation so the
  // Statistik/Achievements screen and the "Gut gemacht" screen stay consistent.
  // We also pass the complete list of modes so "Explorer" can unlock correctly.
  const allSessionIds = (getAllModes && getAllModes() || [])
    .map((m) => (m && m.id))
    .filter((x) => typeof x === "string" && x.trim().length > 0);

  return await checkAndUnlockAchievements({ allSessionIds });
};

// Full achievement check (count + optional explorer)
export const checkAndUnlockAchievements = async ({ allSessionIds, _total, _completed, _history } = {}) => {
  // 1) Session-start count badges — use pre-loaded data if provided
  const total = typeof _total === "number" ? _total : await getTotalSessions();
  const ids = [...evaluateCountAchievements(total)];

  // 2) "Entdecken" (distinct sessions tried) + Explorer
  try {
    const completed = _completed !== undefined ? _completed : await getCompletedSessions();
    const distinct = new Set(
      (Array.isArray(completed) ? completed : []).filter(
        (x) => typeof x === "string" && x.length > 0
      )
    );

    if (distinct.size >= 5) ids.push("discover_5");

    if (Array.isArray(allSessionIds) && allSessionIds.length > 0) {
      ids.push(
        ...evaluateExplorerAchievement(Array.from(distinct), allSessionIds)
      );
    }
  } catch (_e) {}

  // 3) Weekly goal achievements + Reflection achievements (based on local history)
  try {
    const history = _history !== undefined ? _history : await getSessionHistory();
    const list = Array.isArray(history) ? history : [];

    // ISO week key helper (year-weekNumber)
    const isoWeekKey = (ts) => {
      const d = new Date(ts);
      // Thursday in current week decides the year.
      const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
      d.setDate(d.getDate() - day + 3); // move to Thursday
      const isoYear = d.getFullYear();
      const firstThursday = new Date(isoYear, 0, 4);
      const firstDay = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
      const weekNo =
        1 +
        Math.round(
          (d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000)
        );
      return `${isoYear}-W${String(weekNo).padStart(2, "0")}`;
    };

    const weeklyTarget = 5;

    const weekCounts = new Map();
    let moodCount = 0;
    let noteCount = 0;

    for (const h of list) {
      if ((h && h.type) && h.type !== "start") continue;
      const ts = typeof (h && h.timestamp) === "number" ? h.timestamp : (h && h.date);
      if (!ts) continue;

      // weekly
      const key = isoWeekKey(ts);
      weekCounts.set(key, (weekCounts.get(key) || 0) + 1);

      // reflection
      if ((h && h.mood) && ["worse", "same", "better"].includes(h.mood))
        moodCount += 1;
      if (typeof (h && h.note) === "string" && h.note.trim().length > 0)
        noteCount += 1;
    }

    const weeksAchieved = Array.from(weekCounts.values()).filter(
      (c) => c >= weeklyTarget
    ).length;
    if (weeksAchieved >= 1) ids.push("weekly_1");
    if (weeksAchieved >= 2) ids.push("weekly_2");
    if (weeksAchieved >= 5) ids.push("weekly_5");

    if (moodCount >= 5) ids.push("reflect_mood_5");
    if (noteCount >= 3) ids.push("reflect_note_3");
    if (noteCount >= 10) ids.push("reflect_note_10");
  } catch (_e) {}

  const unlockedRes = await unlockAchievements(ids);

  // 4) One-time bonus: if *all* achievements are unlocked, reward 5 sessions.
  // This is deliberately one-time to avoid farming by reopening the screen.
  const ALL_ACHIEVEMENT_IDS = [
    "sessions_1",
    "sessions_5",
    "sessions_25",
    "sessions_50",
    "sessions_100",
    "discover_5",
    "explorer",
    "weekly_1",
    "weekly_2",
    "weekly_5",
    "reflect_mood_5",
    "reflect_note_3",
    "reflect_note_10",
  ];

  let rewardGranted = false;
  try {
    const alreadyRewarded = await getBool(KEYS.ALL_ACHIEVEMENTS_REWARD_GRANTED);
    const unlockedSet = new Set((unlockedRes && unlockedRes.unlocked) || []);
    const hasAll = ALL_ACHIEVEMENT_IDS.every((id) => unlockedSet.has(id));

    if (hasAll && !alreadyRewarded) {
      await addCredits(5, {
        reason: "all_achievements_reward",
        source: "achievement_reward",
      });
      await setBool(KEYS.ALL_ACHIEVEMENTS_REWARD_GRANTED, true);
      rewardGranted = true;
    }
  } catch (_) {
    // Never crash the app because of a reward check.
  }

  return { ...unlockedRes, rewardGranted };
};

/* =========================
   Weekly goal (local)
   ========================= */
export const getWeeklyResetsCount = async ({ includeAborted = true, _history } = {}) => {
  const history = _history !== undefined ? _history : await getSessionHistory();
  const start = startOfISOWeek(Date.now()).getTime();
  const end = start + 7 * 24 * 3600 * 1000;

  const list = Array.isArray(history) ? history : [];
  let count = 0;

  for (const e of list) {
    if (!e) continue;
    if ((e && e.type) && e.type !== "start") continue;

    const ts = typeof e.timestamp === "number" ? e.timestamp : (e && e.date);
    if (!ts || ts < start || ts >= end) continue;

    const status = typeof e.status === "string" ? e.status : "";
    if (status === "completed") {
      count += 1;
      continue;
    }
    if (includeAborted && status === "aborted") {
      // only count aborted sessions if there was actual usage
      const elapsed = Number(e.elapsedSec || 0);
      if (elapsed > 0) count += 1;
      continue;
    }

    // Legacy entries without status: count as a pause
    if (!status) count += 1;
  }

  return count;
};

/* =========================
   Tracking: Session starts
   ========================= */
export const trackSessionStart = async (meta = {}) => {
  const timestamp = Date.now();
  const id = `${timestamp}-${Math.random().toString(16).slice(2)}`;
  const entry = {
    id,
    timestamp,
    type: "start",
    sessionId: meta.sessionId || null,
    sessionName: meta.sessionName || null,
    mode: meta.mode || null,
    durationSec:
      typeof meta.durationSec === "number" ? meta.durationSec : undefined,
    source: meta.source || "session",
    programId: meta.programId || null,
    challengeDay: meta.challengeDay != null ? Number(meta.challengeDay) : undefined,
  };

  await addToSessionHistory(entry);
  return entry;
};

/* =========================
   Start bonus
   ========================= */
export const getTotalSessions = async () => {
  const v = await readInt(KEYS.TOTAL_SESSIONS, 0);
  return v;
};

export const decrementSessionCountToday = async () => {
  try {
    const cur = await getSessionCountToday();
    if (cur > 0) await AsyncStorage.setItem(KEYS.SESSION_COUNT_TODAY, String(cur - 1));
  } catch (_) {}
};

export const incrementTotalSessions = async () => {
  const cur = await getTotalSessions();
  const next = cur + 1;
  await AsyncStorage.setItem(KEYS.TOTAL_SESSIONS, String(next));
  return next;
};

export const getStartBonusUsed = async () => {
  const v = await AsyncStorage.getItem(KEYS.START_BONUS_USED);
  return v === "true";
};

export const setStartBonusUsed = async (used = true) => {
  await AsyncStorage.setItem(KEYS.START_BONUS_USED, used ? "true" : "false");
};

/* =========================
   Welcome credits (first install)
   ========================= */
export const getWelcomeCreditsGranted = async () => {
  const v = await AsyncStorage.getItem(KEYS.WELCOME_CREDITS_GRANTED);
  return v === "true";
};

export const setWelcomeCreditsGranted = async (granted = true) => {
  await AsyncStorage.setItem(
    KEYS.WELCOME_CREDITS_GRANTED,
    granted ? "true" : "false"
  );
};

/* =========================
   Credits
   ========================= */
export const getCreditsCount = async () => {
  return await getCredits();
};

export const addCreditsCount = async (amount, meta) => {
  return await addCredits(amount, meta);
};

/* =========================
   Session permission logic (Plans)
   ========================= */
export const canStartSession = async () => {
  // RevenueCat-Status zuerst prüfen und lokalen Plan synchronisieren
  try {
    const { checkPremiumStatus } = require("./revenuecat");
    const premiumState = await checkPremiumStatus();
    if (premiumState && premiumState.isPremium) {
      // RevenueCat sagt Pro/Lifetime → lokalen Plan synchronisieren
      const rcPlan = premiumState.isLifetime ? "lifetime" : "pro";
      await setUserPlan(rcPlan);
    }
  } catch (_) {
    // Falls RevenueCat nicht erreichbar → lokalen Plan verwenden
  }

  const plan = await getUserPlan();

  if (plan === "lifetime") {
    return { canStart: true, reason: "unlimited", remaining: Infinity };
  }

  const todayCount = await getSessionCountToday();

  // 1) Daily free quota (NOT stackable)
  // FREE: 1/Tag · PRO: unbegrenzt · LIFETIME: unbegrenzt
  let freeLimit = 1;
  if (plan === "pro" || plan === "lifetime") {
    return { canStart: true, reason: "pro-plan", remaining: Infinity };
  }

  const remainingFree = Math.max(0, freeLimit - todayCount);
  if (remainingFree > 0) {
    return { canStart: true, reason: "daily-free", remaining: remainingFree };
  }

  // 2) Credits only after daily free quota is used up
  const credits = await getCredits();
  if (credits > 0) {
    return { canStart: true, reason: "credit", remaining: credits };
  }

  // No free quota left and no credits left
  return { canStart: false, reason: "daily-free", remaining: 0 };
};

export const markSessionStarted = async (meta = {}) => {
  try {
    const status = await canStartSession();

    if (!(status && status.canStart)) {
      return {
        success: false,
        error: "Keine Starts verfügbar. Du kannst zusätzliche Sessions kaufen.",
      };
    }

    if (status.reason === "unlimited") {
      await incrementSessionCountToday();
      await incrementTotalSessions();
      const historyEntry = await trackSessionStart({
        ...meta,
        source: meta.source || "session",
      });
      return { success: true, reason: status.reason, historyEntry };
    }

    if (status.reason === "credit") {
      await addCredits(-1, { reason: "session_start" });
      await incrementTotalSessions();
      const historyEntry = await trackSessionStart({
        ...meta,
        source: meta.source || "credit",
      });
      return { success: true, reason: status.reason, historyEntry };
    }

    await incrementSessionCountToday();
    await incrementTotalSessions();
    const historyEntry = await trackSessionStart({
      ...meta,
      source: meta.source || "session",
    });
    return { success: true, reason: status.reason, historyEntry };
  } catch (e) {
    return { success: false, error: (e && e.message) || "Unbekannter Fehler." };
  }
};

/* =========================
   Reminders
   ========================= */
export const getReminderEnabled = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_ENABLED);
  return v === "true";
};

export const setReminderEnabled = async (enabled) => {
  await AsyncStorage.setItem(KEYS.REMINDER_ENABLED, enabled ? "true" : "false");
};

export const getReminderTime = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_TIME);
  return v || null;
};

export const setReminderTime = async (timeStr) => {
  if (!timeStr) {
    await AsyncStorage.removeItem(KEYS.REMINDER_TIME);
    return;
  }
  await AsyncStorage.setItem(KEYS.REMINDER_TIME, timeStr);
};

export const getReminderPermissionAsked = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_PERMISSION_ASKED);
  return v === "true";
};

export const setReminderPermissionAsked = async (asked = true) => {
  await AsyncStorage.setItem(
    KEYS.REMINDER_PERMISSION_ASKED,
    asked ? "true" : "false"
  );
};

// If set, we should not show the in-app reminder prompt before this timestamp (ms)
export const getReminderNextAskAt = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_NEXT_ASK_AT);
  const n = v ? Number(v) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const setReminderNextAskAt = async (tsMs) => {
  const n = Number(tsMs);
  if (!Number.isFinite(n) || n <= 0) {
    await AsyncStorage.removeItem(KEYS.REMINDER_NEXT_ASK_AT);
    return;
  }
  await AsyncStorage.setItem(KEYS.REMINDER_NEXT_ASK_AT, String(Math.floor(n)));
};

/* =========================
   Interval reminder state (2/4/8/12 days; then always 12)
   ========================= */

export const getIntervalReminderStage = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_STAGE);
  const n = v ? Number(v) : 0;
  // clamp to 0..3
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 3) return 3;
  return Math.floor(n);
};

export const setIntervalReminderStage = async (stage) => {
  const n = Number(stage);
  const s = Number.isFinite(n) ? Math.floor(n) : 0;
  const clamped = s < 0 ? 0 : s > 3 ? 3 : s;
  await AsyncStorage.setItem(KEYS.REMINDER_STAGE, String(clamped));
};

export const getIntervalReminderLastSessionAt = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_LAST_SESSION_AT);
  return v || null; // ISO string
};

export const setIntervalReminderLastSessionAt = async (isoString) => {
  if (!isoString) {
    await AsyncStorage.removeItem(KEYS.REMINDER_LAST_SESSION_AT);
    return;
  }
  await AsyncStorage.setItem(KEYS.REMINDER_LAST_SESSION_AT, String(isoString));
};

export const getIntervalReminderNextAt = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_NEXT_AT);
  return v || null; // ISO string
};

export const setIntervalReminderNextAt = async (isoString) => {
  if (!isoString) {
    await AsyncStorage.removeItem(KEYS.REMINDER_NEXT_AT);
    return;
  }
  await AsyncStorage.setItem(KEYS.REMINDER_NEXT_AT, String(isoString));
};

export const getIntervalReminderScheduledId = async () => {
  const v = await AsyncStorage.getItem(KEYS.REMINDER_SCHEDULED_ID);
  return v || null;
};

export const setIntervalReminderScheduledId = async (id) => {
  if (!id) {
    await AsyncStorage.removeItem(KEYS.REMINDER_SCHEDULED_ID);
    return;
  }
  await AsyncStorage.setItem(KEYS.REMINDER_SCHEDULED_ID, String(id));
};

/* =========================
   Clear data
   ========================= */
export const clearAllData = async () => {
  // IMPORTANT: We intentionally do NOT remove usage/credits or plan state here.
  // This prevents abusing "Alle Daten loeschen" to regain free starts or credits.

  await AsyncStorage.multiRemove([
    KEYS.ONBOARDING_COMPLETED,
    KEYS.USER_PREFERENCES,
    KEYS.LOCAL_DATA_CONSENT,
    KEYS.DISCLAIMER_SHOWN,
    KEYS.FOCUS_HELP_SHOWN,
    KEYS.SESSION_HISTORY,
    KEYS.SETTINGS,
    KEYS.TOTAL_SESSIONS,
    KEYS.REMINDER_ENABLED,
    KEYS.REMINDER_TIME,
    KEYS.REMINDER_PERMISSION_ASKED,
    KEYS.REMINDER_NEXT_ASK_AT,
    KEYS.REMINDER_STAGE,
    KEYS.REMINDER_LAST_SESSION_AT,
    KEYS.REMINDER_NEXT_AT,
    KEYS.REMINDER_SCHEDULED_ID,
    KEYS.FAVORITE_FOCUS_MODES,
    KEYS.COMPLETED_SESSIONS,
    KEYS.ACHIEVEMENTS_UNLOCKED,
  ]);
};

/* =========================
   Goals (Custom goals / Pro)
   ========================= */

const _normalizeGoals = (goals) => {
  if (!Array.isArray(goals)) return [];
  return goals
    .filter((g) => g && typeof g === "object")
    .map((g) => ({
      id:
        String(g.id || "").trim() ||
        `g_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: g.type === "minutesPerWeek" ? "minutesPerWeek" : "sessionsPerWeek",
      title:
        typeof g.title === "string" && g.title.trim().length > 0
          ? g.title.trim()
          : g.type === "minutesPerWeek"
          ? "Sanftes Minuten-Ziel"
          : "Sanftes Wochenziel",
      target: Math.max(1, Math.round(Number(g.target) || 0)) || 1,
      createdAt: Number(g.createdAt) || Date.now(),
      isActive: g.isActive === false ? false : true,
    }));
};

export const getUserGoals = async () => {
  try {
    const v = await AsyncStorage.getItem(KEYS.USER_GOALS);
    return _normalizeGoals(safeJsonParse(v, []));
  } catch (_e) {
    return [];
  }
};

export const saveUserGoals = async (goals) => {
  const norm = _normalizeGoals(goals);
  try {
    await AsyncStorage.setItem(KEYS.USER_GOALS, JSON.stringify(norm));
  } catch (_e) {}
  return norm;
};

/* =========================
   Statistik layout
   ========================= */

// All Statistik sections that can be reordered.
// IMPORTANT: stable ids (no random / index keys).
const DEFAULT_STATISTIK_CARD_ORDER = [
  "overview",
  "logbook",
  "goals",
  "weeklyGoal",
  "achievements",
  "insights",
  "export",
];

export const getStatistikCardOrder = async () => {
  try {
    const v = await AsyncStorage.getItem(KEYS.STATISTIK_CARD_ORDER);
    const arr = safeJsonParse(v, null);
    if (!Array.isArray(arr)) return DEFAULT_STATISTIK_CARD_ORDER;
    const clean = [];
    const seen = new Set();
    for (const x of arr) {
      const id = typeof x === "string" ? x.trim() : "";
      if (!id) continue;
      if (!DEFAULT_STATISTIK_CARD_ORDER.includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      clean.push(id);
    }

    // append missing defaults (downgrade/upgrade safe)
    for (const id of DEFAULT_STATISTIK_CARD_ORDER) {
      if (!seen.has(id)) clean.push(id);
    }
    return clean;
  } catch (_e) {
    return DEFAULT_STATISTIK_CARD_ORDER;
  }
};

export const setStatistikCardOrder = async (order) => {
  try {
    const arr = Array.isArray(order) ? order : [];
    const clean = [];
    const seen = new Set();
    for (const x of arr) {
      const id = typeof x === "string" ? x.trim() : "";
      if (!id) continue;
      if (!DEFAULT_STATISTIK_CARD_ORDER.includes(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      clean.push(id);
    }
    // ensure all exist
    for (const id of DEFAULT_STATISTIK_CARD_ORDER) {
      if (!seen.has(id)) clean.push(id);
    }
    await AsyncStorage.setItem(KEYS.STATISTIK_CARD_ORDER, JSON.stringify(clean));
    return clean;
  } catch (_e) {
    return Array.isArray(order) ? order : [];
  }
};

export const addUserGoal = async (goal) => {
  const cur = await getUserGoals();
  const next = _normalizeGoals([...(cur || []), goal]);
  await AsyncStorage.setItem(KEYS.USER_GOALS, JSON.stringify(next));
  return next;
};

export const removeUserGoal = async (goalId) => {
  const id = String(goalId || "");
  const cur = await getUserGoals();
  const next = (cur || []).filter((g) => String(g.id) !== id);
  await AsyncStorage.setItem(KEYS.USER_GOALS, JSON.stringify(next));
  return next;
};

export const toggleUserGoal = async (goalId, isActive) => {
  const id = String(goalId || "");
  const cur = await getUserGoals();
  const next = (cur || []).map((g) =>
    String(g.id) === id
      ? {
          ...g,
          isActive: typeof isActive === "boolean" ? isActive : !g.isActive,
        }
      : g
  );
  await AsyncStorage.setItem(KEYS.USER_GOALS, JSON.stringify(next));
  return next;
};

export async function updateUserGoal(goalId, patch) {
  const id = String(goalId || "");
  const goals = await getUserGoals();
  const merged = (goals || []).map((g) => (String(g.id) === id ? { ...g, ...patch, id } : g));
  const next = _normalizeGoals(merged);
  try {
    await AsyncStorage.setItem(KEYS.USER_GOALS, JSON.stringify(next));
  } catch (_e) {}
  return next;
}

/* =========================
   7-Tage Challenge (Pro Trial Tracking)
   Speichert lokal, wann PRO erstmals aktiv wurde.
   Nur für UI/Retention – steuert kein Abo.
   ========================= */
export const getChallengeStartAt = async () => {
  try {
    const v = await AsyncStorage.getItem(KEYS.CHALLENGE_START_AT);
    return v ? Number(v) : null;
  } catch (_) { return null; }
};

export const setChallengeStartAt = async (tsMs) => {
  try {
    await AsyncStorage.setItem(KEYS.CHALLENGE_START_AT, String(Math.floor(Number(tsMs))));
  } catch (_) {}
};

/** Initialisiert challengeStartAt wenn noch nicht gesetzt (idempotent) */
export const ensureChallengeStartAt = async () => {
  const existing = await getChallengeStartAt();
  if (!existing) {
    await setChallengeStartAt(Date.now());
  }
};

/** Gibt Tag 1..7 zurück, oder null wenn kein Challenge-Start */
export const getChallengeDay = async () => {
  const start = await getChallengeStartAt();
  if (!start) return null;
  const elapsed = Date.now() - start;
  const day = Math.floor(elapsed / (24 * 3600 * 1000)) + 1;
  return Math.min(Math.max(day, 1), 7);
};


/* ── User Name ─────────────────────────────────────────── */
export const getUserName = async () => {
  try {
    const v = await AsyncStorage.getItem(KEYS.USER_NAME);
    return v || "";
  } catch (_) { return ""; }
};

export const setUserName = async (name) => {
  try {
    await AsyncStorage.setItem(KEYS.USER_NAME, name.trim());
  } catch (_) {}
};

// Alias für Onboarding-Import
export const saveUserName = setUserName;


/* =========================
   Streak & Badges
   ========================= */

/** Berechnet konsekutive Tage (jeden Tag mindestens 1 Session) */
export const getDailyStreak = async (_history) => {
  try {
    const history = _history || await getSessionHistory();
    const list = Array.isArray(history) ? history : [];
    if (list.length === 0) return 0;

    // Get unique days with completed sessions (as "YYYY-MM-DD")
    const daySet = new Set(
      list
        .filter(e => e && (e.type === "start" || !e.type))
        .map(e => {
          const ts = typeof e.timestamp === "number" ? e.timestamp : Number(e.date || 0);
          if (!ts) return null;
          const d = new Date(ts);
          return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        })
        .filter(Boolean)
    );

    const days = [...daySet].sort().reverse(); // newest first
    if (days.length === 0) return 0;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const yesterdayD = new Date(today); yesterdayD.setDate(today.getDate()-1);
    const yesterdayStr = `${yesterdayD.getFullYear()}-${String(yesterdayD.getMonth()+1).padStart(2,"0")}-${String(yesterdayD.getDate()).padStart(2,"0")}`;

    // Streak must include today or yesterday
    if (days[0] !== todayStr && days[0] !== yesterdayStr) return 0;

    let streak = 0;
    let current = new Date(days[0]);
    for (const day of days) {
      const d = new Date(day);
      const diff = Math.round((current - d) / (1000*60*60*24));
      if (diff === 0 || diff === 1) {
        streak++;
        current = d;
      } else {
        break;
      }
    }
    return streak;
  } catch (_e) { return 0; }
};



/* =========================
   Streak Freeze (Pro+)
   ========================= */
// Pro: 2 Freezes/Monat, Lifetime: 5 Freezes/Monat
const STREAK_FREEZE_KEY = "streak_freeze_data";

const getFreezesPerMonth = (plan) => {
  const p = String(plan || "").toLowerCase();
  if (p === "lifetime" || p === "premium_lifetime") return 5;
  if (p === "pro") return 2;
  return 0;
};

export const getStreakFreezeData = async () => {
  try {
    const raw = await AsyncStorage.getItem(STREAK_FREEZE_KEY);
    if (!raw) return { freezesLeft: 0, usedDates: [], lastReset: null };
    return JSON.parse(raw);
  } catch (_) {
    return { freezesLeft: 0, usedDates: [], lastReset: null };
  }
};

// Monatliches Reset + Plan-Sync aufrufen (z.B. beim App-Start)
export const syncStreakFreezes = async (plan) => {
  try {
    const allowance = getFreezesPerMonth(plan);
    if (allowance === 0) return;
    const data = await getStreakFreezeData();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${now.getMonth()}`;
    if (data.lastReset !== thisMonth) {
      // Neuer Monat → Freezes auffüllen (auf Maximum, nicht addieren)
      const newData = {
        freezesLeft: allowance,
        usedDates: data.usedDates || [],
        lastReset: thisMonth,
      };
      await AsyncStorage.setItem(STREAK_FREEZE_KEY, JSON.stringify(newData));
      return newData;
    }
    return data;
  } catch (_) {}
};

export const useStreakFreeze = async (plan) => {
  try {
    const allowance = getFreezesPerMonth(plan);
    if (allowance === 0) return { success: false, reason: "not_eligible" };

    const data = await getStreakFreezeData();
    if (data.freezesLeft <= 0) return { success: false, reason: "no_freezes_left" };

    const todayStr = new Date().toISOString().slice(0, 10);
    if ((data.usedDates || []).includes(todayStr)) {
      return { success: false, reason: "already_used_today" };
    }

    // Fake-Session für heute eintragen damit der Streak nicht bricht
    const fakeEntry = {
      id: `freeze_${Date.now()}`,
      type: "start",
      sessionId: "__freeze__",
      timestamp: Date.now(),
      isFreeze: true,
    };
    const history = await getSessionHistory();
    const updated = Array.isArray(history) ? [fakeEntry, ...history] : [fakeEntry];
    await AsyncStorage.setItem(KEYS.SESSION_HISTORY || "session_history", JSON.stringify(updated));

    const newData = {
      freezesLeft: data.freezesLeft - 1,
      usedDates: [...(data.usedDates || []), todayStr],
      lastReset: data.lastReset,
    };
    await AsyncStorage.setItem(STREAK_FREEZE_KEY, JSON.stringify(newData));

    return { success: true, freezesLeft: newData.freezesLeft };
  } catch (e) {
    return { success: false, reason: "error" };
  }
};

/* =========================
   App Launch Counter
   ========================= */
export const incrementAppLaunchCount = async () => {
  try {
    const cur = await readInt(KEYS.APP_LAUNCH_COUNT, 0);
    await AsyncStorage.setItem(KEYS.APP_LAUNCH_COUNT, String(cur + 1));
    return cur + 1;
  } catch (_) { return 0; }
};

export const getAppLaunchCount = async () => {
  try { return await readInt(KEYS.APP_LAUNCH_COUNT, 0); } catch (_) { return 0; }
};

/* =========================
   Review Flags
   ========================= */
export const getReviewFlag = async (key) => {
  try { return await getBool(key, false); } catch (_) { return false; }
};

export const setReviewFlag = async (key) => {
  try { await setBool(key, true); } catch (_) {}
};

export const REVIEW_KEYS = {
  SESSION_3:  "review_asked_session_3",
  SESSION_10: "review_asked_session_10",
  STREAK_7:   "review_asked_streak_7",
  LAUNCH_3:   "review_asked_launch_3",
  PROGRAM:    "review_asked_program",
  REWARD:     "review_reward_granted",
};

/* =========================
   Quote Push
   ========================= */
export const getQuotePushEnabled = async () => {
  try { return await getBool(KEYS.QUOTE_PUSH_ENABLED, false); } catch (_) { return false; }
};

export const setQuotePushEnabled = async (val) => {
  try { await setBool(KEYS.QUOTE_PUSH_ENABLED, val); } catch (_) {}
};
