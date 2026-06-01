// apps/mobile/src/utils/useXP.js
//
// React Hook — lädt XP-State beim Mount und stellt Helper bereit.

import { useState, useEffect, useCallback } from "react";
import {
  getXPState,
  addSessionXP,
  addStreakXP,
  addNoteXP,
  addBadgeXP,
  checkUnlocks,
} from "./xp-storage";

/**
 * @returns {{
 *   xp: {
 *     totalXP: number,
 *     level: number,
 *     tier: string,          // "seeker" | "breather" | "still" | "wise"
 *     tierLabel: string,     // "Suchender" | "Atmender" | "Stiller" | "Weiser"
 *     progress: number,      // 0..1 innerhalb des Levels (für Fortschrittsbalken)
 *     xpIntoLevel: number,
 *     xpNeededForNext: number,
 *     unlocks: object,
 *     dailyProgress: {       // Tages-Miniziel (15 Stille)
 *       earned: number,
 *       progress: number,    // 0..1
 *       goalReached: boolean,
 *     },
 *     nextUnlock: {          // nächster Unlock als Motivations-Preview
 *       type: "tier"|"streak",
 *       label: string,
 *       xpNeeded: number|null,
 *       streakNeeded: number|null,
 *     }|null,
 *     stilleLabel: "Stille",
 *   }|null,
 *   loading: boolean,
 *   awardSession:  (meta?)           => Promise<AwardResult>,
 *   awardStreak:   (streak, meta?)   => Promise<StreakResult>,
 *   awardNote:     (meta?)           => Promise<AwardResult>,
 *   awardBadges:   (ids[], meta?)    => Promise<AwardResult|null>,
 *   refreshXP:     (streak?)         => Promise<void>,
 * }}
 *
 * AwardResult: {
 *   totalXP, prevXP, added,
 *   levelBefore, levelAfter, leveledUp,
 *   tierBefore, tierAfter, tierChanged,
 *   info, dailyProgress,
 *   newUnlocks: string[],   // neu freigeschaltete Unlock-IDs
 * }
 *
 * StreakResult: {
 *   xpResult: AwardResult|null,
 *   bonusResult: AwardResult|null,  // Perfect-Week-Bonus falls ausgelöst
 *   skipped: boolean,               // true = heute bereits Streak-XP vergeben
 *   newUnlocks: string[],
 * }
 */
export const useXP = () => {
  const [xp, setXP]           = useState(null);
  const [loading, setLoading] = useState(true);
  const [_streak, setStreak]  = useState(0); // intern gecacht für refreshXP

  const refreshXP = useCallback(async (currentStreak) => {
    try {
      const streak = currentStreak ?? _streak;
      const state  = await getXPState(streak);
      setXP(state);
    } catch (_) {}
  }, [_streak]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const state = await getXPState(0);
        if (mounted) { setXP(state); setLoading(false); }
      } catch (_) {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  /** Session abgeschlossen → +10 Stille */
  const awardSession = useCallback(async (meta = {}) => {
    const result = await addSessionXP(meta);
    if (result) {
      const { newly: newUnlocks } = await checkUnlocks(_streak, result.totalXP);
      await refreshXP();
      return { ...result, newUnlocks };
    }
    return { ...result, newUnlocks: [] };
  }, [_streak, refreshXP]);

  /**
   * Streak-Tag → skalierender Stille-Bonus (einmal täglich).
   * Prüft Streak-Unlocks und gibt { xpResult, bonusResult, skipped, newUnlocks } zurück.
   *
   * @param {number} currentStreak  aktueller Streak-Wert
   */
  const awardStreak = useCallback(async (currentStreak = 0, meta = {}) => {
    setStreak(currentStreak);
    const { xpResult, bonusResult, skipped } = await addStreakXP(currentStreak, meta);
    const totalXP = xpResult?.totalXP ?? (xp?.totalXP ?? 0);
    const { newly: newUnlocks } = await checkUnlocks(currentStreak, totalXP);
    await refreshXP(currentStreak);
    return { xpResult, bonusResult, skipped, newUnlocks };
  }, [xp, refreshXP]);

  /** Notiz gespeichert → +3 Stille */
  const awardNote = useCallback(async (meta = {}) => {
    const result = await addNoteXP(meta);
    if (result) {
      const { newly: newUnlocks } = await checkUnlocks(_streak, result.totalXP);
      await refreshXP();
      return { ...result, newUnlocks };
    }
    return { ...result, newUnlocks: [] };
  }, [_streak, refreshXP]);

  /** Neue Badges → +20 Stille pro Badge */
  const awardBadges = useCallback(async (newlyUnlockedIds = [], meta = {}) => {
    const result = await addBadgeXP(newlyUnlockedIds, meta);
    if (result) {
      const { newly: newUnlocks } = await checkUnlocks(_streak, result.totalXP);
      await refreshXP();
      return { ...result, newUnlocks };
    }
    return null;
  }, [_streak, refreshXP]);

  return {
    xp,
    loading,
    awardSession,
    awardStreak,
    awardNote,
    awardBadges,
    refreshXP,
  };
};
