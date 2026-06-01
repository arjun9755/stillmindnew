/**
 * 🪙 Credits Storage (Consumable)
 *
 * Credits sind Einmalkäufe (Consumables) und werden lokal gespeichert.
 *
 * WICHTIG:
 * - Credits werden lokal gespeichert, aber können anhand der Kaufhistorie über RevenueCat erneut vergeben werden
 * - Bei App-Deinstallation bleiben gekaufte Credits über RevenueCat nachvollziehbar und können nach der Neuinstallation synchronisiert werden
 * - 1 Credit = 1 zusätzliche Session
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const CREDITS_KEY = "@stillmind_credits";

// Persistierte Liste von bereits gewährten RevenueCat‑Transaktions‑IDs
const CREDITS_TRANSACTIONS_KEY = "@stillmind_credits_transactions";

// Export keys für andere Module
export { CREDITS_KEY, CREDITS_TRANSACTIONS_KEY };

/**
 * Lädt aktuelle Credit-Anzahl
 * @returns {Promise<number>}
 */
export const getCredits = async () => {
  try {
    const value = await AsyncStorage.getItem(CREDITS_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error("❌ Fehler beim Laden der Credits:", error);
    return 0;
  }
};

/**
 * Setzt neue Credit-Anzahl
 * @param {number} count
 * @returns {Promise<void>}
 */
export const setCredits = async (count) => {
  try {
    await AsyncStorage.setItem(CREDITS_KEY, count.toString());
  } catch (error) {
    console.error("❌ Fehler beim Speichern der Credits:", error);
  }
};

/**
 * Fügt Credits hinzu (nach Kauf)
 * @param {number} amount - Anzahl Credits zum Hinzufügen
 * @returns {Promise<number>} - Neue Gesamt-Anzahl
 */
export const addCredits = async (amount = 1) => {
  try {
    const current = await getCredits();
    const newCount = current + amount;
    await setCredits(newCount);
    return newCount;
  } catch (error) {
    console.error("❌ Fehler beim Hinzufügen von Credits:", error);
    return 0;
  }
};

/**
 * Verbraucht einen Credit (nach Session-Start)
 * @returns {Promise<{success: boolean, remaining: number}>}
 */
export const useCredit = async () => {
  try {
    const current = await getCredits();

    if (current <= 0) {
      return {
        success: false,
        remaining: 0,
      };
    }

    const newCount = current - 1;
    await setCredits(newCount);

    return {
      success: true,
      remaining: newCount,
    };
  } catch (error) {
    console.error("❌ Fehler beim Verbrauchen eines Credits:", error);
    return {
      success: false,
      remaining: 0,
    };
  }
};

/**
 * Prüft ob Credits verfügbar sind
 * @returns {Promise<boolean>}
 */
export const hasCredits = async () => {
  const count = await getCredits();
  return count > 0;
};

/**
 * Setzt Credits zurück (z.B. für Testing)
 * @returns {Promise<void>}
 */
export const resetCredits = async () => {
  await setCredits(0);
  // Entferne auch gespeicherte Transaktions‑IDs
  try {
    await AsyncStorage.removeItem(CREDITS_TRANSACTIONS_KEY);
  } catch (_error) {
    // Silent
  }
};

/**
 * Synchronisiert lokal gespeicherte Credits mit der RevenueCat‑Kaufhistorie.
 * Siehe Dokumentation in credits-storage.js für Details.
 *
 * @param {object} customerInfo
 */
export const syncCreditsWithRevenueCat = async (customerInfo) => {
  try {
    if (
      !customerInfo ||
      !customerInfo.allPurchaseTransactions ||
      !Array.isArray(customerInfo.allPurchaseTransactions)
    ) {
      return;
    }
    const creditTransactions = customerInfo.allPurchaseTransactions.filter(
      (tx) => tx.productIdentifier === "stillmind_credit_1"
    );
    const stored = await AsyncStorage.getItem(CREDITS_TRANSACTIONS_KEY);
    let grantedIds = [];
    if (stored) {
      try {
        grantedIds = JSON.parse(stored);
      } catch (_e) {
        grantedIds = [];
      }
    }
    const newTransactions = creditTransactions.filter(
      (tx) => !grantedIds.includes(tx.transactionIdentifier)
    );
    if (newTransactions.length > 0) {
      const newCredits = newTransactions.length;
      const current = await getCredits();
      const updated = current + newCredits;
      await setCredits(updated);
      const updatedIds = [
        ...grantedIds,
        ...newTransactions.map((tx) => tx.transactionIdentifier),
      ];
      await AsyncStorage.setItem(
        CREDITS_TRANSACTIONS_KEY,
        JSON.stringify(updatedIds)
      );
    }
  } catch (_e) {
    return;
  }
};