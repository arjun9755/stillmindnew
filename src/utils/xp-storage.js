// apps/mobile/src/utils/xp-storage.js
//
// XP & Level System — StillMind
//
// Währung: "Stille" (intern immer XP, UI zeigt "Stille")
//
// Quellen:
//   Session abgeschlossen  +10 Stille  (Basis)
//   Streak-Tag             +5  Stille  (skaliert, einmal täglich)
//   Notiz gespeichert      +3  Stille
//   Badge freigeschaltet   +20 Stille
//
// Streak-Bonus (skaliert täglich):
//   Tag 1–6:    +5
//   Tag 7–13:   +10  (+Perfect-Week-Bonus einmalig +25)
//   Tag 14–29:  +15
//   Tag 30–99:  +25
//   Tag 100+:   +40
//
// Tiers:
//   Suchender   Level  1–5   (0–499 Stille)
//   Atmender    Level  6–15  (500–1999 Stille)
//   Stiller     Level 16–25  (2000–4999 Stille)
//   Weiser      Level 26+    (5000+ Stille)
//
// Unlocks (via checkUnlocks):
//   ≥ 7  Tage Streak → Streak-Freeze Joker
//   ≥ 14 Tage Streak → Schlaf-Session für alle
//   ≥ 30 Tage Streak → App-Icon "sunrise"
//   ≥ 100 Tage Streak → App-Icon "diamond" + Lifetime-Rabatt-Flag
//   Level 6 (Tier-Wechsel) → Exklusive Atemübungen freigeschaltet
//   Level 16 (Tier-Wechsel) → Stille-Modus freigeschaltet

import AsyncStorage from "@react-native-async-storage/async-storage";

/* ─── Storage Keys ─────────────────────────────────────── */
const XP_KEY               = "stillmind:xp_total";
const XP_HISTORY_KEY       = "stillmind:xp_history";        // [{ts, amount, reason, meta}]
const XP_STREAK_LAST_KEY   = "stillmind:xp_streak_last_date"; // "YYYY-MM-DD"
const XP_UNLOCKS_KEY       = "stillmind:xp_unlocks";
const XP_DAILY_KEY         = "stillmind:xp_daily";          // {date, earned}
const XP_PERFECT_WEEK_KEY  = "stillmind:xp_perfect_week_granted"; // Set<"YYYY-Www">

/* ─── Stille-Werte ─────────────────────────────────────── */
export const XP_VALUES = {
  SESSION:      10,
  NOTE:          3,
  BADGE:        20,
  PERFECT_WEEK: 25,  // einmalig pro Woche wenn 7 Tage in Folge
};

// Streak-Bonus skaliert
export const getStreakBonus = (streak) => {
  if (streak >= 100) return 40;
  if (streak >= 30)  return 25;
  if (streak >= 14)  return 15;
  if (streak >= 7)   return 10;
  return 5;
};

/* ─── Tages-Ziel ───────────────────────────────────────── */
export const DAILY_GOAL = 15; // Stille pro Tag als Miniziel (1 Session + 1 Note)

/* ─── Tier / Level Tabelle ─────────────────────────────── */
const TIERS = [
  { key: "seeker",     label: "Suchender",  labelEn: "Seeker",     minLevel: 1,  maxLevel: 5,
    unlockKey: null,   unlockLabel: null },
  { key: "breather",   label: "Atmender",   labelEn: "Breather",   minLevel: 6,  maxLevel: 15,
    unlockKey: "breathingUnlocked",    unlockLabel: "Exklusive Atemübungen" },
  { key: "still",      label: "Stiller",    labelEn: "Still",      minLevel: 16, maxLevel: 25,
    unlockKey: "silenceModeUnlocked",  unlockLabel: "Stille-Modus" },
  { key: "wise",       label: "Weiser",     labelEn: "Wise",       minLevel: 26, maxLevel: Infinity,
    unlockKey: null,   unlockLabel: null },
];

// XP-Schwellen pro Level (kumulativ, leicht beschleunigend)
// Level 1 → 0, Level 2 → 100, Level 3 → 250, Level 4 → 450, …
const xpForLevel = (level) => {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.round(n * 100 + (n * (n - 1) / 2) * 50);
};

const LEVEL_TABLE = Array.from({ length: 50 }, (_, i) => ({
  level: i + 1,
  xpRequired: xpForLevel(i + 1),
}));

export const getLevelForXP = (totalXP) => {
  const xp = typeof totalXP === "number" && totalXP >= 0 ? totalXP : 0;
  let level = 1;
  for (const entry of LEVEL_TABLE) {
    if (xp >= entry.xpRequired) level = entry.level;
    else break;
  }
  return level;
};

export const getLevelInfo = (totalXP) => {
  const xp = typeof totalXP === "number" && totalXP >= 0 ? totalXP : 0;
  const level = getLevelForXP(xp);
  const currentThreshold = xpForLevel(level);
  const nextThreshold    = xpForLevel(level + 1);
  const xpIntoLevel      = xp - currentThreshold;
  const xpNeededForNext  = nextThreshold - currentThreshold;
  const progress         = xpNeededForNext > 0 ? Math.min(1, xpIntoLevel / xpNeededForNext) : 1;
  const tier             = TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel) || TIERS[0];

  return {
    totalXP: xp,
    level,
    tier: tier.key,
    tierLabel: tier.label,
    tierLabelEn: tier.labelEn,
    progress,
    xpIntoLevel,
    xpNeededForNext,
    xpForCurrentLevel: currentThreshold,
    xpForNextLevel: nextThreshold,
  };
};

/** Gibt den nächsten Unlock zurück, auf den der User hinarbeitet */
export const getNextUnlockPreview = (totalXP, currentStreak) => {
  const level = getLevelForXP(totalXP);
  const streak = typeof currentStreak === "number" ? currentStreak : 0;

  // Tier-Unlock (Level-basiert)
  const nextTierUnlock = TIERS.find(
    (t) => t.unlockKey && level < t.minLevel
  );
  if (nextTierUnlock) {
    const xpNeeded = xpForLevel(nextTierUnlock.minLevel) - totalXP;
    return {
      type: "tier",
      label: nextTierUnlock.unlockLabel,
      xpNeeded: Math.max(0, xpNeeded),
      streakNeeded: null,
    };
  }

  // Streak-basiert
  const streakMilestones = [
    { days: 7,   label: "Streak-Freeze Joker" },
    { days: 14,  label: "Schlaf-Session" },
    { days: 30,  label: "App-Icon Sunrise" },
    { days: 100, label: "App-Icon Diamond + Lifetime-Angebot" },
  ];
  const nextStreak = streakMilestones.find((m) => streak < m.days);
  if (nextStreak) {
    return {
      type: "streak",
      label: nextStreak.label,
      xpNeeded: null,
      streakNeeded: nextStreak.days - streak,
    };
  }

  return null;
};

/* ─── Helpers ──────────────────────────────────────────── */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ISO Woche z.B. "2025-W14"
const isoWeek = () => {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const safeJson = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; }
};

/* ─── Race-Condition-Schutz (einfache Promise-Queue) ───── */
let _writeQueue = Promise.resolve();
const enqueue = (fn) => {
  _writeQueue = _writeQueue.then(fn).catch(() => {});
  return _writeQueue;
};

/* ─── Core Storage ─────────────────────────────────────── */

export const getTotalXP = async () => {
  try {
    const v = await AsyncStorage.getItem(XP_KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (_) { return 0; }
};

const _setTotalXP = async (xp) => {
  await AsyncStorage.setItem(XP_KEY, String(Math.max(0, Math.floor(xp))));
};

export const getXPHistory = async () => {
  try {
    const v   = await AsyncStorage.getItem(XP_HISTORY_KEY);
    const arr = safeJson(v, []);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
};

const _appendXPHistory = async (entry) => {
  try {
    const cur  = await getXPHistory();
    const next = [entry, ...cur].slice(0, 200);
    await AsyncStorage.setItem(XP_HISTORY_KEY, JSON.stringify(next));
  } catch (_) {}
};

export const getStreakXPLastDate = async () => {
  try { return (await AsyncStorage.getItem(XP_STREAK_LAST_KEY)) || null; }
  catch (_) { return null; }
};

export const getXPUnlocks = async () => {
  try {
    const v = await AsyncStorage.getItem(XP_UNLOCKS_KEY);
    return safeJson(v, {
      sleepSession:       false,
      icon30:             false,
      icon100:            false,
      lifetimeDeal:       false,
      streakFreezeJoker:  false,
      breathingUnlocked:  false,
      silenceModeUnlocked:false,
    });
  } catch (_) {
    return {
      sleepSession: false, icon30: false, icon100: false,
      lifetimeDeal: false, streakFreezeJoker: false,
      breathingUnlocked: false, silenceModeUnlocked: false,
    };
  }
};

const _saveXPUnlocks = async (unlocks) => {
  await AsyncStorage.setItem(XP_UNLOCKS_KEY, JSON.stringify(unlocks));
};

/* ─── Tages-Statistik ──────────────────────────────────── */

/** Heute verdiente Stille + Tages-Ziel-Progress (0..1) */
export const getDailyProgress = async () => {
  try {
    const v    = await AsyncStorage.getItem(XP_DAILY_KEY);
    const data = safeJson(v, { date: null, earned: 0 });
    const today = todayISO();
    if (data.date !== today) return { earned: 0, progress: 0, goalReached: false };
    const earned   = data.earned || 0;
    const progress = Math.min(1, earned / DAILY_GOAL);
    return { earned, progress, goalReached: earned >= DAILY_GOAL };
  } catch (_) { return { earned: 0, progress: 0, goalReached: false }; }
};

const _addToDailyXP = async (amount) => {
  try {
    const v    = await AsyncStorage.getItem(XP_DAILY_KEY);
    const data = safeJson(v, { date: null, earned: 0 });
    const today = todayISO();
    const newEarned = (data.date === today ? (data.earned || 0) : 0) + amount;
    await AsyncStorage.setItem(XP_DAILY_KEY, JSON.stringify({ date: today, earned: newEarned }));
  } catch (_) {}
};

/* ─── addXP (mit Queue-Schutz) ─────────────────────────── */

/**
 * Fügt Stille hinzu, thread-safe via Promise-Queue.
 *
 * @returns {{
 *   totalXP, prevXP, added,
 *   levelBefore, levelAfter, leveledUp,
 *   tierBefore, tierAfter, tierChanged,
 *   info,
 *   dailyProgress,
 * }}
 */
export const addXP = (amount, reason, meta = {}) =>
  new Promise((resolve) => {
    enqueue(async () => {
      const n = typeof amount === "number" && amount > 0 ? Math.floor(amount) : 0;
      if (n === 0) { resolve(null); return; }

      const prevXP = await getTotalXP();
      const newXP  = prevXP + n;
      await _setTotalXP(newXP);
      await _addToDailyXP(n);
      await _appendXPHistory({ ts: Date.now(), amount: n, reason: String(reason || "unknown"), ...meta });

      const levelBefore = getLevelForXP(prevXP);
      const levelAfter  = getLevelForXP(newXP);
      const tierBefore  = (TIERS.find((t) => levelBefore >= t.minLevel && levelBefore <= t.maxLevel) || TIERS[0]).key;
      const tierAfter   = (TIERS.find((t) => levelAfter  >= t.minLevel && levelAfter  <= t.maxLevel) || TIERS[0]).key;
      const info        = getLevelInfo(newXP);
      const dailyProgress = await getDailyProgress();

      resolve({
        totalXP: newXP,
        prevXP,
        added: n,
        levelBefore,
        levelAfter,
        leveledUp:  levelAfter > levelBefore,
        tierBefore,
        tierAfter,
        tierChanged: tierAfter !== tierBefore,
        info,
        dailyProgress,
      });
    });
  });

/* ─── Convenience Functions ────────────────────────────── */

/** +10 Stille nach Session-Abschluss */
export const addSessionXP = (meta = {}) =>
  addXP(XP_VALUES.SESSION, "session", meta);

/**
 * Streak-Stille — skaliert nach aktuellem Streak, einmal täglich.
 * Prüft außerdem Perfect-Week-Bonus.
 *
 * @param {number} currentStreak  aktueller Streak-Wert
 * @returns {{ xpResult, bonusResult, skipped: boolean }}
 */
export const addStreakXP = async (currentStreak = 0, meta = {}) => {
  try {
    const today = todayISO();
    const last  = await getStreakXPLastDate();
    if (last === today) return { xpResult: null, bonusResult: null, skipped: true };

    await AsyncStorage.setItem(XP_STREAK_LAST_KEY, today);

    const bonus   = getStreakBonus(currentStreak);
    const xpResult = await addXP(bonus, "streak", { streak: currentStreak, ...meta });

    // Perfect-Week-Bonus (7 Tage Streak, einmal pro Woche)
    let bonusResult = null;
    if (currentStreak > 0 && currentStreak % 7 === 0) {
      const week = isoWeek();
      const rawGranted = await AsyncStorage.getItem(XP_PERFECT_WEEK_KEY);
      const granted    = safeJson(rawGranted, []);
      if (!granted.includes(week)) {
        await AsyncStorage.setItem(XP_PERFECT_WEEK_KEY, JSON.stringify([...granted, week]));
        bonusResult = await addXP(XP_VALUES.PERFECT_WEEK, "perfect_week", { week, streak: currentStreak });
      }
    }

    return { xpResult, bonusResult, skipped: false };
  } catch (_) { return { xpResult: null, bonusResult: null, skipped: false }; }
};

/** +3 Stille für gespeicherte Notiz */
export const addNoteXP = (meta = {}) =>
  addXP(XP_VALUES.NOTE, "note", meta);

/**
 * +20 Stille pro neu freigeschaltetem Badge.
 * @param {string[]} newlyUnlockedIds
 */
export const addBadgeXP = async (newlyUnlockedIds = [], meta = {}) => {
  const ids = Array.isArray(newlyUnlockedIds) ? newlyUnlockedIds.filter(Boolean) : [];
  if (ids.length === 0) return null;
  return await addXP(XP_VALUES.BADGE * ids.length, "badge", { badgeIds: ids, ...meta });
};

/* ─── Unlocks prüfen ───────────────────────────────────── */

/**
 * Prüft Streak- und Level-basierte Unlocks.
 * @param {number} currentStreak
 * @param {number} totalXP
 * @returns {{ unlocks, newly: string[] }}
 */
export const checkUnlocks = async (currentStreak, totalXP) => {
  const streak = typeof currentStreak === "number" ? currentStreak : 0;
  const xp     = typeof totalXP === "number" ? totalXP : await getTotalXP();
  const level  = getLevelForXP(xp);
  const unlocks = await getXPUnlocks();
  const newly   = [];

  // Streak-basiert
  if (streak >= 7  && !unlocks.streakFreezeJoker)  { unlocks.streakFreezeJoker  = true; newly.push("streakFreezeJoker"); }
  if (streak >= 14 && !unlocks.sleepSession)        { unlocks.sleepSession        = true; newly.push("sleepSession"); }
  if (streak >= 30 && !unlocks.icon30)              { unlocks.icon30              = true; newly.push("icon30"); }
  if (streak >= 100 && !unlocks.icon100)            { unlocks.icon100             = true; newly.push("icon100"); }
  if (streak >= 100 && !unlocks.lifetimeDeal)       { unlocks.lifetimeDeal        = true; newly.push("lifetimeDeal"); }

  // Level-basiert (Tier-Wechsel)
  if (level >= 6  && !unlocks.breathingUnlocked)   { unlocks.breathingUnlocked   = true; newly.push("breathingUnlocked"); }
  if (level >= 16 && !unlocks.silenceModeUnlocked)  { unlocks.silenceModeUnlocked = true; newly.push("silenceModeUnlocked"); }

  if (newly.length > 0) await _saveXPUnlocks(unlocks);
  return { unlocks, newly };
};

/* ─── Vollständiger State-Snapshot ─────────────────────── */

export const getXPState = async (currentStreak = 0) => {
  const [totalXP, unlocks, dailyProgress] = await Promise.all([
    getTotalXP(),
    getXPUnlocks(),
    getDailyProgress(),
  ]);
  const levelInfo   = getLevelInfo(totalXP);
  const nextUnlock  = getNextUnlockPreview(totalXP, currentStreak);

  return {
    totalXP,
    ...levelInfo,
    unlocks,
    dailyProgress,
    nextUnlock,
    // Alias für UI
    stilleLabel: "Stille",  // Währungsname für Anzeige
  };
};

/* ─── Reset ────────────────────────────────────────────── */
export const resetXPData = async () => {
  await AsyncStorage.multiRemove([
    XP_KEY,
    XP_HISTORY_KEY,
    XP_STREAK_LAST_KEY,
    XP_UNLOCKS_KEY,
    XP_DAILY_KEY,
    XP_PERFECT_WEEK_KEY,
  ]);
};

export const resetUnlocksOnly = async () => {
  await AsyncStorage.removeItem(XP_UNLOCKS_KEY);
};
