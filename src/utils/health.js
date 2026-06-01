/**
 * health.js — StillMind
 * iOS: HealthKit (react-native-health)
 * Android: Health Connect (react-native-health-connect)
 */
import { Platform } from "react-native";

// ── iOS ──────────────────────────────────────────────────────────────────────
let AppleHealthKit = null;
if (Platform.OS === "ios") {
  try {
    AppleHealthKit = require("react-native-health").AppleHealthKit;
  } catch (_) {}
}

const IOS_PERMISSIONS = AppleHealthKit
  ? {
      permissions: {
        read: [],
        write: [AppleHealthKit?.Constants?.Permissions?.MindfulSession],
      },
    }
  : null;

// ── Android ──────────────────────────────────────────────────────────────────
let HealthConnect = null;
if (Platform.OS === "android") {
  try {
    HealthConnect = require("react-native-health-connect");
  } catch (_) {}
}

// ── Shared state ─────────────────────────────────────────────────────────────
// Never cache init state between app launches - always re-init
let _iosInitialized = false;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request permissions. Call once on app start or before first write.
 * Returns { success: boolean }
 */
export const requestHealthPermissions = async () => {
  try {
    if (Platform.OS === "ios" && AppleHealthKit && IOS_PERMISSIONS) {
      _iosInitialized = false;
      return await new Promise((resolve) => {
        AppleHealthKit.initHealthKit(IOS_PERMISSIONS, (err) => {
          if (err) {
            // initHealthKit kann einen Fehler werfen obwohl die Permission bereits erteilt
            // wurde (z.B. bei erneutem Aufruf). Wir prüfen ob HealthKit trotzdem verfügbar ist.
            console.log("[Health] initHealthKit err (may still be authorized):", err);
            // Versuche einen Test-Write um zu prüfen ob wirklich keine Permission
            AppleHealthKit.isAvailable((availErr, available) => {
              if (!availErr && available) {
                _iosInitialized = true;
                resolve({ success: true });
              } else {
                resolve({ success: false });
              }
            });
            return;
          }
          _iosInitialized = true;
          resolve({ success: true });
        });
      });
    }

    if (Platform.OS === "android" && HealthConnect) {
      await HealthConnect.initialize();
      const result = await HealthConnect.requestPermission([
        { accessType: "write", recordType: "MindfulnessSession" },
      ]);
      return { success: Array.isArray(result) && result.length > 0 };
    }

    return { success: false };
  } catch (e) {
    console.log("[Health] requestHealthPermissions error:", e);
    return { success: false };
  }
};

/**
 * Ensure HealthKit is initialized (init if not yet done).
 * Returns { success: boolean }
 */
const ensureInitialized = async () => {
  if (_iosInitialized) return { success: true };
  return await requestHealthPermissions();
};

/**
 * Write a mindfulness session.
 * @param {number} startMs — session start timestamp (ms)
 * @param {number} durationSec — session duration in seconds
 */
export const writeMindfulSession = async (startMs, durationSec) => {
  try {
    const startDate = new Date(startMs);
    const endDate   = new Date(startMs + durationSec * 1000);

    // ── iOS ──
    if (Platform.OS === "ios" && AppleHealthKit) {
      const init = await ensureInitialized();
      if (!init.success) {
        console.log("[Health] Not initialized, cannot write session");
        return { success: false };
      }
      return await new Promise((resolve) => {
        AppleHealthKit.saveMindfulSession(
          {
            startDate: startDate.toISOString(),
            endDate:   endDate.toISOString(),
          },
          (err) => {
            if (err) console.log("[Health] saveMindfulSession error:", err);
            resolve({ success: !err });
          }
        );
      });
    }

    // ── Android ──
    if (Platform.OS === "android" && HealthConnect) {
      await HealthConnect.initialize();
      await HealthConnect.insertRecords([
        {
          recordType: "MindfulnessSession",
          startTime:  startDate.toISOString(),
          endTime:    endDate.toISOString(),
          title:      "StillMind",
        },
      ]);
      return { success: true };
    }

    return { success: false };
  } catch (e) {
    console.log("[Health] writeMindfulSession error:", e);
    return { success: false };
  }
};

/**
 * Check if health integration is available on this device.
 */
export const isHealthAvailable = () => {
  if (Platform.OS === "ios")     return !!AppleHealthKit;
  if (Platform.OS === "android") return !!HealthConnect;
  return false;
};
