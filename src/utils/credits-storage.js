// apps/mobile/src/utils/credits-storage.js
/**
 * ✅ Compatibility Layer
 *
 * In der App wird an mehreren Stellen erwartet, dass "@/utils/credits-storage"
 * folgende Funktionen exportiert:
 * - getCredits, addCredits, useCredit, syncCreditsWithRevenueCat
 *
 * Diese Logik existiert bereits in "./credits.js" (Consumable Credits).
 * Daher exportieren wir hier einfach alles sauber weiter.
 */

export {
  CREDITS_KEY,
  CREDITS_TRANSACTIONS_KEY,
  getCredits,
  setCredits,
  addCredits,
  useCredit,
  hasCredits,
  resetCredits,
  syncCreditsWithRevenueCat,
} from "./credits";