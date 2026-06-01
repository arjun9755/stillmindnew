// apps/mobile/src/app/_layout.jsx

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import * as SystemUI from "expo-system-ui";

import {
  initializeNotifications,
  scheduleFixedReminders,
  enableQuotePush,
} from "@/utils/notifications";
import { getReminderEnabled, getQuotePushEnabled, getIntervalReminderScheduledId, setUserPlan } from "@/utils/storage";
import { initializeRevenueCat } from "@/utils/revenuecat";
import { checkPremiumStatus } from "@/utils/revenuecat";
import { AppState } from "react-native";
import { initI18n } from "@/utils/i18n";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { syncWidgetData } from "@/utils/widget-bridge";
import { initWatchBridge } from "@/utils/watch-bridge";


/**
 * StillMind Dark-Only Theme + Accent Themes (Premium Life)
 * - Kein Light Mode
 * - Ignoriert System-Farbschema komplett
 * - iOS & Android wirken identisch (NavigationTheme + global contentStyle)
 */

const ThemeCtx = createContext(null);

export const useStillMindTheme = () => {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useStillMindTheme must be used within RootLayout");
  return ctx;
};

// 1) Dark-Core (niemals ändern -> garantiert kein Light Mode)
const darkCore = {
  background: "#0B0B0B",
  surface: "#121212",
  surface2: "#161616",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.70)",
};

// 2) Accent Themes (Premium Life – nur Akzent, nicht Hell/Dunkel)
const accentThemes = {
  zenSand: {
    accent: "#D6C7A1",
    accentSoft: "rgba(214,199,161,0.22)",
  },
  oceanDeep: {
    accent: "#4FA3A5",
    accentSoft: "rgba(79,163,165,0.22)",
  },
  royalPlum: {
    accent: "#8E5CF6",
    accentSoft: "rgba(142,92,246,0.22)",
  },
};

export default function RootLayout() {
  const [accentKey, setAccentKey] = useState("zenSand");


  const colors = useMemo(() => {
    const accent = (accentThemes[accentKey] || accentThemes.zenSand)
    return { ...darkCore, ...accent };
  }, [accentKey]);

  const navTheme = useMemo(() => {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
        notification: colors.accent,
      },
    };
  }, [colors]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  // Reconcile interval reminders on app boot (e.g. after iOS cleanup, reinstall, time change)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await initializeNotifications();
        await initI18n();
        await initializeRevenueCat();

        // Plan bei jedem Start frisch von RevenueCat holen und in Storage schreiben
        // → User deren Trial abgelaufen ist fallen automatisch auf "free" zurück
        try {
          const status = await checkPremiumStatus();
          await setUserPlan((status && status.planId) || "free");
        } catch (_) {}

        // Notifications neu planen falls 7 Tage abgelaufen
        try {
          const reminderEnabled = await getReminderEnabled();
          if (reminderEnabled) {
            const prevIds = await getIntervalReminderScheduledId();
            const ids = prevIds ? JSON.parse(prevIds) : [];
            // Wenn weniger als 2 IDs geplant → neu planen
            if (!Array.isArray(ids) || ids.length < 2) {
              scheduleFixedReminders().catch(() => {});
            }
          }
          const quotePushEnabled = await getQuotePushEnabled();
          if (quotePushEnabled) {
            // Morgenimpuls-IDs prüfen — wenn leer neu planen
            const storageMod = require("@react-native-async-storage/async-storage");
            const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
            const qRaw = await AsyncStorage.getItem("quote_push_notification_id").catch(() => null);
            const qIds = qRaw ? JSON.parse(qRaw) : [];
            if (!Array.isArray(qIds) || qIds.length === 0) {
              enableQuotePush().catch(() => {});
            }
          }
        } catch (_) {}

        // Widget-Daten synchronisieren
        syncWidgetData().catch(() => {});

        // Apple Watch Bridge initialisieren
        initWatchBridge().catch(() => {});

        if (!alive) return;
      } catch (_e) {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  // AppState-Listener: getCustomerInfo bei App-Resume (Apple IAP Anforderung)
  // Wenn User nach Kauf im App Store zurückkommt → Abo-Status sofort aktualisieren
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        try {
          const status = await checkPremiumStatus();
          await setUserPlan((status && status.planId) || "free");
        } catch (_) {}
      }
    });
    return () => sub.remove();
  }, []);

  // Notification Response Handler: Deep Link + Action Button
  // Kaltstart: getLastNotificationResponseAsync abfangen
  // Warmstart: addNotificationResponseReceivedListener
  useEffect(() => {
    function handleNotificationResponse(response) {
      try {
        const data = response?.notification?.request?.content?.data;
        const actionId = response?.actionIdentifier;
        const shouldStart =
          actionId === "START_SESSION" ||
          actionId === Notifications.DEFAULT_ACTION_IDENTIFIER;
        if (!shouldStart) return;
        const sessionId = data && data.sessionId;
        if (!sessionId) return;
        setTimeout(() => {
          try { router.push(`/session-run/${sessionId}`); } catch (_) {}
        }, 800);
      } catch (_) {}
    }

    // Kaltstart: wurde die App durch eine Notification geöffnet?
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    }).catch(() => {});

    // Warmstart: Listener für laufende App
    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, []);

  const themeApi = useMemo(
    () => ({
      colors,
      accentKey,
      setAccentKey,
      availableAccents: Object.keys(accentThemes),
    }),
    [colors, accentKey]
  );

  return (
    <ThemeCtx.Provider value={themeApi}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="mode-selection" />
          <Stack.Screen name="session-run/[id]" />
          <Stack.Screen name="session-detail/[id]" />
          <Stack.Screen name="session-result/[id]" />
        </Stack>
      </ThemeProvider>
    </ThemeCtx.Provider>
  );
}
