// apps/mobile/src/app/session-result/[id].jsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  Share,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import * as Print from "expo-print";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { Check, RotateCcw, Home, Sparkles, Share2 } from "lucide-react-native";
import ShareCardModal from "@/components/ShareCardModal";
import { router, useLocalSearchParams } from "expo-router";
import * as StoreReview from "expo-store-review";
import { useI18n } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { getModeById } from "@/data/mode-quotes";
import { getSessionById } from "@/data/sessions-index";
import { getSessionSfxUrl } from "@/utils/audio-manager";
import {
  getSessionHistory,
  updateSessionHistoryEntry,
  checkAndUnlockAchievementsAfterSession,
  getReminderEnabled,
  setReminderPermissionAsked,
  getReminderNextAskAt,
  setReminderNextAskAt,
  getUserName,
  getUserPlan,
  getTotalSessions,
  getDailyStreak,
  getReviewFlag,
  setReviewFlag,
  REVIEW_KEYS,
  addCredits,
} from "@/utils/storage";
import { writeMindfulSession, isHealthAvailable, requestHealthPermissions } from "@/utils/health";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as MediaLibrary from "expo-media-library";
import { syncWidgetData } from "@/utils/widget-bridge";

import {
  initializeNotifications,
  enableIntervalReminder,
  markSessionActivityForIntervalReminder,
} from "@/utils/notifications";

function inferModeFromResultId(rawId) {
  if (!rawId || typeof rawId !== "string") return "calm";
  if (rawId.startsWith("quick-")) return rawId.replace("quick-", "") || "calm";
  return rawId;
}

// NOTE: This file lives in apps/mobile/src/app/session-result/[id].jsx
// Assets live in apps/mobile/assets/... => go up 3 levels (session-result -> app -> src -> mobile)
const STILLMIND_LOGO = require("../../../assets/brand/stillmind-logo-transparent.png");


// Mode-specific color palette for share card
const MODE_PALETTE = {
  calm: { accent: "#4F8CFF", accent2: "#7AB0FF", bg1: "rgba(79,140,255,0.08)", bg2: "rgba(79,140,255,0.04)" },
  sleep: { accent: "#8B6FE8", accent2: "#B09EF0", bg1: "rgba(139,111,232,0.08)", bg2: "rgba(139,111,232,0.04)" },
  focus: { accent: "#DCA028", accent2: "#F0C850", bg1: "rgba(220,160,40,0.08)", bg2: "rgba(220,160,40,0.04)" },
  emotion: { accent: "#32AA64", accent2: "#50C882", bg1: "rgba(50,170,100,0.08)", bg2: "rgba(50,170,100,0.04)" },
  parent: { accent: "#DC5064", accent2: "#F07888", bg1: "rgba(220,80,100,0.08)", bg2: "rgba(220,80,100,0.04)" },
  work: { accent: "#B47846", accent2: "#D29B6E", bg1: "rgba(180,120,70,0.08)", bg2: "rgba(180,120,70,0.04)" },
  thoughts: { accent: "#8C50DC", accent2: "#AA78F0", bg1: "rgba(140,80,220,0.08)", bg2: "rgba(140,80,220,0.04)" },
};
const DEFAULT_PALETTE = MODE_PALETTE.calm;
const getModePalette = (id) => MODE_PALETTE[id] || DEFAULT_PALETTE;

export default function SessionResultScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { colors } = useStillMindTheme();
  const params = useLocalSearchParams();

  const rawId = typeof (params && params.id) === "string" ? params.id : "";
  const historyEntryId =
    typeof (params && params.hid) === "string" && params.hid.trim().length > 0
      ? params.hid.trim()
      : null;

  const modeId = useMemo(() => inferModeFromResultId(rawId), [rawId]);
  const mode = useMemo(() => getModeById(modeId) || null, [modeId]);

  const [resolvedHistoryId, setResolvedHistoryId] = useState(historyEntryId);
  const [resolvedHistoryEntry, setResolvedHistoryEntry] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [moodChoice, setMoodChoice] = useState(null);
  const [moodSaved, setMoodSaved] = useState(false);
  const [newBadges, setNewBadges] = useState([]);

  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const noteSaveTimerRef = useRef(null);
  const noteTextRef = useRef("");
  const scrollRef = useRef(null);
  const shareCardRef = useRef(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [shareCardVisible, setShareCardVisible] = useState(false);

  // Snackbar (Saved feedback) + micro animation for primary CTA
  const [snackbarText, setSnackbarText] = useState("");
  const [lifetimePromoVisible, setLifetimePromoVisible] = useState(false);
  const snackbarAnim = useRef(new Animated.Value(0)).current;
  const snackbarHideTimer = useRef(null);

  const saveBtnScale = useRef(new Animated.Value(1)).current;

  const showSnackbar = (text) => {
    try {
      if (snackbarHideTimer.current) {
        clearTimeout(snackbarHideTimer.current);
        snackbarHideTimer.current = null;
      }
    } catch (_e) {}
    setSnackbarText(text);
    Animated.timing(snackbarAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    snackbarHideTimer.current = setTimeout(() => {
      Animated.timing(snackbarAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 1200);
  };

  // Push reminder opt-in (shown after session completion)
  const [reminderPromptVisible, setReminderPromptVisible] = useState(false);
  const [userPlan, setUserPlanState] = useState("free");
  const reminderFlowLockRef = useRef(false);

  // Pre-Review Modal
  const [preReviewVisible, setPreReviewVisible] = useState(false);
  const [surpriseVisible, setSurpriseVisible] = useState(false);

  // Onboarding Upgrade-Moment (nach 1. Session)
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [timeUpsellVisible, setTimeUpsellVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  useEffect(() => {
    return () => {
      try {
        if (snackbarHideTimer.current) clearTimeout(snackbarHideTimer.current);
      } catch (_e) {}
    };
  }, [snackbarHideTimer]);

  const SUCCESS_MESSAGES = useMemo(
    () => [
      t("result_msg_0", { m: "{m}" }),
      t("result_msg_1", { m: "{m}" }),
      t("result_msg_2", { m: "{m}" }),
      t("result_msg_3", { m: "{m}" }),
      t("result_msg_4", { m: "{m}" }),
      t("result_msg_5", { m: "{m}" }),
      t("result_msg_6", { m: "{m}" }),
      t("result_msg_7", { m: "{m}" }),
      t("result_msg_8", { m: "{m}" }),
      t("result_msg_9", { m: "{m}" }),
    ],
    [t]
  );

  const successMessage = useMemo(() => {
    const m = Math.max(1, durationMinutes || 1);
    const base = `${rawId}|${m}`;
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
    }
    const msg = SUCCESS_MESSAGES[hash % SUCCESS_MESSAGES.length];
    return msg.replace("{m}", String(m));
  }, [SUCCESS_MESSAGES, rawId, durationMinutes]);

  const endSfxRef = useRef(null);
  const endSfxWebRef = useRef(null);
  const hasPlayedEndSfxRef = useRef(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    if (hasPlayedEndSfxRef.current) return;
    hasPlayedEndSfxRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        if (Platform.OS === "web") {
          const a = new window.Audio(getSessionSfxUrl("end"));
          a.volume = 1;
          endSfxWebRef.current = a;
          await a.play();
          return;
        }

        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            allowsRecordingIOS: false,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch (_) {}

        const { sound } = await Audio.Sound.createAsync(
          { uri: getSessionSfxUrl("end") },
          { shouldPlay: true, volume: 1 }
        );

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }

        endSfxRef.current = sound;

        try {
          await sound.setPositionAsync(0);
        } catch (_) {}
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      try {
        endSfxWebRef.current && endSfxWebRef.current.pause && endSfxWebRef.current.pause();
        endSfxWebRef.current = null;
      } catch (_e) {}

      (async () => {
        try {
          if (endSfxRef.current) {
            await endSfxRef.current.unloadAsync();
            endSfxRef.current = null;
          }
        } catch (_e) {}
      })();
    };
  }, [fontsLoaded]);

  useEffect(() => {
    noteTextRef.current = noteText;
  }, [noteText]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (historyEntryId) {
          if (alive) setResolvedHistoryId(historyEntryId);
          return;
        }
        const hist = await getSessionHistory();
        if (!Array.isArray(hist) || hist.length === 0) return;

        const now = Date.now();
        const windowMs = 20 * 60 * 1000;

        const candidates = hist
          .filter((e) => {
            if (!e || typeof e !== "object") return false;
            if (e.type !== "start") return false;
            const ts = typeof e.timestamp === "number" ? e.timestamp : 0;
            if (!ts || now - ts > windowMs) return false;
            return e.mode === modeId || e.sessionId === rawId || e.sessionId === modeId;
          })
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const inferredId = candidates[0]?.id || null;
        if (alive) setResolvedHistoryId(inferredId);
      } catch (_) {
        if (alive) setResolvedHistoryId(historyEntryId || null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [historyEntryId, modeId, rawId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hid = resolvedHistoryId;
        if (hid) {
          const hist = await getSessionHistory();
          const entry = Array.isArray(hist) ? hist.find((e) => (e && e.id) === hid) : null;
          const sec = typeof (entry && entry.durationSec) === "number" && entry.durationSec > 0 ? entry.durationSec : 60;
          const mins = Math.max(1, Math.round(sec / 60));
          if (alive) {
            setResolvedHistoryEntry(entry || null);
            setDurationMinutes(mins);
          }

          const existingMood = typeof (entry && entry.mood) === "string" ? entry.mood.trim() : "";
          if (alive && existingMood) {
            setMoodChoice(existingMood);
            setMoodSaved(true);
          }

          const existingNote = typeof (entry && entry.note) === "string" ? entry.note : "";
          if (alive) setNoteText(existingNote);

          // Write to Apple Health / Health Connect
          try {
            const hEnabled = await AsyncStorage.getItem("stillmind:health_enabled");
            if (entry && isHealthAvailable() && hEnabled === "true") {
              const startMs = typeof entry.timestamp === "number" ? entry.timestamp : Date.now();
              writeMindfulSession(startMs, sec).catch(() => {});
            }
          } catch (_) {}

          // Sync widget data
          syncWidgetData().catch(() => {});
        }
      } catch (_) {
        if (alive) setResolvedHistoryEntry(null);
      }

      try {
        const res = await checkAndUnlockAchievementsAfterSession();
        if (alive && Array.isArray(res && res.newlyUnlocked) && res.newlyUnlocked.length) {
          setNewBadges(res.newlyUnlocked);
        }
      } catch (_) {}
    })();

    return () => {
      alive = false;
    };
  }, [resolvedHistoryId]);

  // After a completed session: softly ask for a daily reminder (in-app first).
  // Rules:
  // - Only show if reminders are not enabled
  // - If user tapped t("result_later"), ask again after 2 days
  useEffect(() => {
    if (!fontsLoaded) return;
    if (!resolvedHistoryId) return; // ensures we only ask after we have a result context
    if (reminderFlowLockRef.current) return;

    let alive = true;
    (async () => {
      // Load plan for paywall banner
      try { setUserPlanState(await getUserPlan()); } catch (_) {}

      // Multi-trigger review logic
      try {
        const canReview = await StoreReview.hasAction();
        if (canReview) {
          const [total, streak] = await Promise.all([
            getTotalSessions(),
            getDailyStreak().catch(() => 0),
          ]);

          // Upgrade-Moment nach 1. Session
          if (total === 1) {
            setTimeout(() => setUpgradeVisible(true), 2000);
          }

          // Lifetime Promo nach 2. Session (7/14 Tage Intervall)
          if (total === 2 && userPlanState === "free") {
            try {
              const now = Date.now();
              const shown7  = await AsyncStorage.getItem("stillmind:lifetime_promo_shown_7").catch(() => null);
              const shown14 = await AsyncStorage.getItem("stillmind:lifetime_promo_shown_14").catch(() => null);
              const shownFirst = await AsyncStorage.getItem("stillmind:lifetime_promo_shown_first").catch(() => null);

              if (!shownFirst) {
                await AsyncStorage.setItem("stillmind:lifetime_promo_shown_first", String(now));
                setTimeout(() => setLifetimePromoVisible(true), 1500);
              } else if (!shown7 && now - parseInt(shownFirst) > 7 * 24 * 60 * 60 * 1000) {
                await AsyncStorage.setItem("stillmind:lifetime_promo_shown_7", String(now));
                setTimeout(() => setLifetimePromoVisible(true), 1500);
              } else if (!shown14 && shown7 && now - parseInt(shown7) > 14 * 24 * 60 * 60 * 1000) {
                await AsyncStorage.setItem("stillmind:lifetime_promo_shown_14", String(now));
                setTimeout(() => setLifetimePromoVisible(true), 1500);
              }
            } catch (_) {}
          }

          // Zeitbasierter Upsell: nach 3, 7, 14 Tagen aktiver Nutzung
          if (userPlan === "free" && total >= 3) {
            try {
              const AsyncStorage = require("@react-native-async-storage/async-storage").default;
              // Ersten Nutzungstag speichern
              let firstUse = await AsyncStorage.getItem("stillmind:first_use_date").catch(() => null);
              if (!firstUse) {
                firstUse = new Date().toISOString();
                await AsyncStorage.setItem("stillmind:first_use_date", firstUse);
              }
              const daysSince = Math.floor((Date.now() - new Date(firstUse).getTime()) / (1000 * 60 * 60 * 24));
              const shownKey = `stillmind:time_upsell_shown_${daysSince >= 14 ? "14" : daysSince >= 7 ? "7" : "3"}`;
              const alreadyShown = await AsyncStorage.getItem(shownKey).catch(() => null);

              if (!alreadyShown && ((daysSince >= 3 && daysSince < 7) || (daysSince >= 7 && daysSince < 14) || daysSince >= 14)) {
                await AsyncStorage.setItem(shownKey, "true");
                setTimeout(() => setTimeUpsellVisible(true), 2500);
              }
            } catch (_) {}
          }

          const checks = [
            { key: REVIEW_KEYS.SESSION_3,  condition: total === 3 },
            { key: REVIEW_KEYS.SESSION_10, condition: total === 10 },
            { key: REVIEW_KEYS.STREAK_7,   condition: streak >= 7 },
          ];
          for (const c of checks) {
            if (c.condition) {
              const asked = await getReviewFlag(c.key);
              if (!asked && alive) {
                await setReviewFlag(c.key);
                setTimeout(() => setPreReviewVisible(true), 1800);
                break;
              }
            }
          }
        }
      } catch (_) {}

      try {
        const enabled = await getReminderEnabled();
        if (enabled) {
          // User completed a session -> reset interval reminders (stage 0) and re-schedule.
          try {
            await markSessionActivityForIntervalReminder();
          } catch (_) {}
          return;
        }

        const nextAskAt = await getReminderNextAskAt();
        const now = Date.now();
        if (nextAskAt && now < nextAskAt) return;

        if (alive) {
          reminderFlowLockRef.current = true;
          setReminderPromptVisible(true);
        }
      } catch (_) {}
    })();

    return () => {
      alive = false;
    };
  }, [fontsLoaded, resolvedHistoryId]);

  const handlePreReviewYes = async () => {
    setPreReviewVisible(false);
    try { await StoreReview.requestReview(); } catch (_) {}
    // Surprise reward — check if not already granted
    try {
      const already = await getReviewFlag(REVIEW_KEYS.REWARD);
      if (!already) {
        await setReviewFlag(REVIEW_KEYS.REWARD);
        await addCredits(3, { reason: "review_reward" });
        setTimeout(() => setSurpriseVisible(true), 800);
      }
    } catch (_) {}
  };

  const handlePreReviewNo = () => {
    setPreReviewVisible(false);
  };

  const handleReminderLater = async () => {
    try {
      // Snooze the in-app prompt for 2 days
      const in2Days = Date.now() + 2 * 24 * 60 * 60 * 1000;
      await setReminderNextAskAt(in2Days);
    } catch (_) {}
    setReminderPromptVisible(false);
    reminderFlowLockRef.current = false;
  };

  const handleReminderYes = async () => {
    try {
      await setReminderPermissionAsked(true);
    } catch (_) {}

    try {
      await initializeNotifications();
      const res = await enableIntervalReminder();
      if (!(res && res.success)) {
        await handleReminderLater();
        return;
      }
      await setReminderNextAskAt(0);
      setReminderPromptVisible(false);
      reminderFlowLockRef.current = false;
    } catch (_) {
      await handleReminderLater();
    }
  };

  useEffect(() => {
    return () => {
      if (noteSaveTimerRef.current) {
        clearTimeout(noteSaveTimerRef.current);
        noteSaveTimerRef.current = null;
      }
    };
  }, []);

  const resolvedSession = useMemo(() => {
    const sessionId = typeof (resolvedHistoryEntry && resolvedHistoryEntry.sessionId) === "string"
      ? resolvedHistoryEntry.sessionId
      : rawId;
    return getSessionById(sessionId) || null;
  }, [resolvedHistoryEntry, rawId]);

  const title =
    (resolvedHistoryEntry && resolvedHistoryEntry.sessionName) ||
    (resolvedSession && resolvedSession.title) ||
    (mode && mode.label) ||
    "60 Sekunden Ruhe";

  const resolvedSessionType =
    (resolvedSession && resolvedSession.type) ||
    (mode && mode.type) ||
    null;

  const resolvedTimestamp =
    typeof (resolvedHistoryEntry && resolvedHistoryEntry.timestamp) === "number"
      ? resolvedHistoryEntry.timestamp
      : Date.now();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }


  const quote = (mode && mode.quote) || t("result_fallback_quote");

  const shareSuccess = () => {
    setShareCardVisible(true);
  };

  const handleDownloadShareCard = async () => {
    try {
      if (!shareCardRef.current) return;
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") return;
      await MediaLibrary.saveToLibraryAsync(uri);
      showSnackbar("📸 In Galerie gespeichert");
    } catch (e) {
      console.warn("Download share card error:", e);
    }
  };

  const doShare = async () => {
    try {
      const mins = Math.max(1, durationMinutes || 1);
      const modeLabel = (mode && mode.label) || title || t("meditation");
      const modeIcon  = (mode && mode.icon)  || "🪷";
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
      const displayQuote = (quote || t("result_quote_fallback2")).slice(0, 90);
      const pal = MODE_PALETTE[modeId] || MODE_PALETTE.calm;
      const palRgb = pal.accent.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',');
      const userName = await getUserName();

      const msg =
        `${modeIcon} StillMind – ${modeLabel}\n\n` +
        `${mins} ${mins === 1 ? t("minute_singular") : t("minute_plural")} Ruhe geschenkt.\n\n` +
        `"${displayQuote}"\n\n` +
        `Kostenlos: stillmind.app\n` +
        `#StillMind #Achtsamkeit #Meditation`;

      // Share Card — screenshot des nativen Views (kein PDF, kein WebKit)
      try {
        if (shareCardRef.current) {
          // Karte kurz anzeigen damit sie gerendert ist
          const uri = await captureRef(shareCardRef, {
            format: "png",
            quality: 1.0,
            result: "tmpfile",
          });
          const available = await Sharing.isAvailableAsync();
          if (available && uri) {
            await Sharing.shareAsync(uri, {
              dialogTitle: t("share_dialog_title"),
              mimeType: "image/png",
              UTI: "public.png",
            });
            return;
          }
        }
      } catch (captureErr) {
        console.warn("ViewShot failed, falling back to text:", captureErr);
      }

      // Fallback: Text teilen
      await Share.share(
        { message: msg, title: t("share_app_title") },
        { dialogTitle: t("share_dialog_title") }
      );
    } catch (e) {
      const m = (e && e.message) || "";
      if (!m.toLowerCase().includes("cancel") && !m.toLowerCase().includes("dismiss")) {
        console.warn("Share error:", m);
      }
    }
  };

  const badgeLabel = (id) => {
    switch (id) {
      case "sessions_1":
        return t("badge_first_session");
      case "sessions_10":
        return "10 Sessions";
      case "sessions_50":
        return "50 Sessions";
      case "sessions_100":
        return "100 Sessions";
      default:
        return t("badge_sessions_new");
    }
  };

  const handleMood = (choice) => {
    setMoodChoice(choice);
  };

  const saveMood = async () => {
    if (moodSaved) return;
    const choice = moodChoice;
    const hid = resolvedHistoryId;
    setMoodSaved(true);
    if (!hid || !choice) return;
    try {
      await updateSessionHistoryEntry(hid, {
        mood: choice,
        moodAt: Date.now(),
      });
    } catch (_) {}
  };

  const persistNote = async (value) => {
    const v = typeof value === "string" ? value : "";
    setNoteSaving(true);
    const hid = resolvedHistoryId;
    if (!hid) {
      setNoteSaving(false);
      return;
    }

    let ok = false;
    try {
      await updateSessionHistoryEntry(hid, {
        note: v,
        noteAt: Date.now(),
      });
      ok = true;
    } catch (_e) {
      ok = false;
    } finally {
      setNoteSaving(false);
    }

    if (ok) {
      showSnackbar(t("result_saved_ok"));
    }
  };

  const handleRepeat = () => {
    const ts = Date.now();
    if (rawId.startsWith("quick-")) {
      router.push(`/session-run/quick?mode=${modeId}&ts=${ts}`);
      return;
    }
    router.push(`/session-run/${rawId}?mode=${modeId}&ts=${ts}`);
  };

  // ---------- Design tokens (Dark-only, konsistent mit Hauptscreens) ----------
  const bg = colors.background;
  const onCardText = colors.text;
  const onCardSub = colors.textSecondary;
  const onCardMuted = "rgba(255,255,255,0.45)";
  const glassBg = colors.surface;
  const glassBorder = colors.border;
  const glassBgStrong = colors.surfaceVariant;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style="light" />

      {/* ===== Push reminder opt-in (in-app ask BEFORE OS permission) ===== */}
      <Modal
        transparent
        visible={reminderPromptVisible}
        animationType="fade"
        onRequestClose={handleReminderLater}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 520,
              backgroundColor: colors.surface,
              borderRadius: 28,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.14,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 10 },
              elevation: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: onCardText,
              }}
            >
              {t("notif_prompt_title")}
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontFamily: "Montserrat_500Medium",
                fontSize: 14,
                lineHeight: 20,
                color: onCardSub,
              }}
            >
              {t("notif_prompt_body")}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={handleReminderLater}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceVariant,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    color: onCardText,
                  }}
                >
                  {t("notif_prompt_later")}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleReminderYes}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    color: colors.background,
                  }}
                >
                  {t("notif_prompt_yes")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== Pre-Review Modal ===== */}
      <Modal transparent visible={preReviewVisible} animationType="fade" onRequestClose={handlePreReviewNo}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: onCardText, textAlign: "center", marginBottom: 10 }}>
              {lang === "de" ? "✨ Gefällt dir StillMind?" : "✨ Enjoying StillMind?"}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 22, color: onCardSub, textAlign: "center", marginBottom: 22 }}>
              {lang === "de"
                ? "Deine Bewertung hilft anderen gestressten Menschen, StillMind zu entdecken."
                : "Your review helps other people discover StillMind."}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={handlePreReviewNo} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.surfaceVariant, alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: onCardText }}>
                  {lang === "de" ? "Nicht jetzt" : "Not now"}
                </Text>
              </Pressable>
              <Pressable onPress={handlePreReviewYes} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.background }}>
                  {lang === "de" ? "Ja, gerne ⭐" : "Yes, sure ⭐"}
                </Text>
              </Pressable>
            </View>
            <Text style={{ marginTop: 10, fontFamily: "Montserrat_400Regular", fontSize: 11, color: onCardSub, textAlign: "center" }}>
              {lang === "de" ? "Danach wartet eine Überraschung auf dich." : "A little surprise awaits you after."}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ===== Surprise Reward Modal ===== */}
      <Modal transparent visible={surpriseVisible} animationType="fade" onRequestClose={() => setSurpriseVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: 28, padding: 28, borderWidth: 1, borderColor: "rgba(205,185,138,0.35)", alignItems: "center" }}>
            <Text style={{ fontSize: 52, marginBottom: 14 }}>🎁</Text>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: "#CDB98A", textAlign: "center", marginBottom: 10 }}>
              3 Bonus-Sessions!
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 22, color: onCardSub, textAlign: "center", marginBottom: 24 }}>
              Danke für deine Bewertung. Du hast 3 zusätzliche Sessions erhalten – als kleines Dankeschön.
            </Text>
            <Pressable onPress={() => setSurpriseVisible(false)} style={{ paddingVertical: 13, paddingHorizontal: 36, borderRadius: 14, backgroundColor: "#CDB98A", alignItems: "center" }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#0C0B09" }}>Super, danke! 🙌</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ===== Onboarding Upgrade-Moment (nach 1. Session) ===== */}
      {/* ── Zeitbasierter Upsell ──────────────────────────────────────────── */}
      <Modal transparent visible={timeUpsellVisible} animationType="fade" onRequestClose={() => setTimeUpsellVisible(false)}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.72)", padding: 24 }}>
          <View style={{ backgroundColor: "#141414", borderRadius: 28, padding: 28, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: "rgba(205,185,138,0.2)" }}>
            <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>✨</Text>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#FFFFFF", textAlign: "center", marginBottom: 8, letterSpacing: -0.3 }}>
              {userPlan === "free"
                ? (lang === "de" ? "Du machst echte Fortschritte" : "You're making real progress")
                : ""}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 21, marginBottom: 24 }}>
              {lang === "de"
                ? "Schalte unbegrenzte Sessions, Offline-Modus und tiefe Statistiken frei – und bleib dabei."
                : "Unlock unlimited sessions, offline mode and deep statistics — and keep the momentum going."}
            </Text>
            <TouchableOpacity
              onPress={() => { setTimeUpsellVisible(false); try { const { router } = require("expo-router"); router.push("/(tabs)/premium"); } catch(_){} }}
              activeOpacity={0.85}
              style={{ backgroundColor: "#CDB98A", borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 10 }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#0C0B09" }}>
                {lang === "de" ? "7 Tage kostenlos testen →" : "Try free for 7 days →"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTimeUpsellVisible(false)} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                {lang === "de" ? "Später" : "Not now"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={upgradeVisible} animationType="fade" onRequestClose={() => setUpgradeVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: 28, padding: 26, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)" }}>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: "#C4B5FD", textAlign: "center", marginBottom: 8 }}>
              Du hast deine erste Minute gemeistert. 🎉
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 22, color: onCardSub, textAlign: "center", marginBottom: 20 }}>
              Mit Pro hast du unbegrenzte Sessions, Programme und SOS-Modus – immer wenn du es brauchst.
            </Text>
            <TouchableOpacity
              onPress={() => { setUpgradeVisible(false); router.push("/(tabs)/premium"); }}
              style={{ backgroundColor: "#8B5CF6", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 10 }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#fff" }}>Pro 7 Tage kostenlos testen</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setUpgradeVisible(false)} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: onCardSub }}>Später</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mini Overlay */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.22)",
        }}
      />

      {/* ===== Background: Soft Glow ===== */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -220,
          left: -160,
          width: 520,
          height: 520,
          borderRadius: 520,
          backgroundColor: "rgba(255,255,255,0.10)",
          opacity: 0.1,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: insets.top + 80,
          right: -220,
          width: 560,
          height: 560,
          borderRadius: 560,
          backgroundColor: "rgba(255,255,255,0.06)",
          opacity: 0.08,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -260,
          left: -140,
          width: 520,
          height: 520,
          borderRadius: 520,
          backgroundColor: "rgba(255,255,255,0.55)",
          opacity: 0.1,
        }}
      />

      {/* ===== Content ===== */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: Platform.OS === "android" ? 110 : insets.bottom + 32,
            paddingHorizontal: 22,
            flexGrow: 1,
            justifyContent: "center",
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View
            style={{
              flexGrow: 1,
              width: "100%",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View style={{ width: "100%", maxWidth: 520, alignItems: "center" }}>
              {/* Pill */}
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: glassBg,
                  borderWidth: 1,
                  borderColor: glassBorder,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Sparkles size={14} color={onCardText} />
                <Text
                  style={{
                    fontFamily: "Montserrat_500Medium",
                    fontSize: 12,
                    color: onCardText,
                    letterSpacing: 0.25,
                  }}
                >
                  {t("result_session_done")}
                </Text>
              </View>

              <View style={{ height: 18 }} />

              {/* Check circle */}
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 96,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: glassBgStrong,
                  borderWidth: 1.25,
                  borderColor: glassBorder,
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: 66,
                    height: 66,
                    borderRadius: 66,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.55)",
                    backgroundColor: "rgba(255,255,255,0.25)",
                  }}
                />
                <Check size={36} color={onCardText} />
              </View>

              <Text
                style={{
                  marginTop: 18,
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 34,
                  color: onCardText,
                  textAlign: "center",
                  letterSpacing: 0.15,
                }}
              >
                {t("great_job")}
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  fontFamily: "Montserrat_500Medium",
                  fontSize: 15,
                  color: onCardSub,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>

              <View
                style={{
                  width: 52,
                  height: 1.5,
                  borderRadius: 2,
                  marginTop: 18,
                  backgroundColor: "rgba(36, 28, 22, 0.18)",
                }}
              />

              <Text
                style={{
                  marginTop: 18,
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 14,
                  color: onCardSub,
                  textAlign: "center",
                  lineHeight: 20,
                  maxWidth: 420,
                }}
              >
                {successMessage}
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 13,
                  color: onCardMuted,
                  textAlign: "center",
                  lineHeight: 19,
                  maxWidth: 420,
                }}
              >
                {quote}
              </Text>

              {/* Mood */}
              <View
                style={{
                  width: "100%",
                  maxWidth: 420,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  backgroundColor: glassBg,
                  borderWidth: 1,
                  borderColor: glassBorder,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_500Medium",
                    fontSize: 13,
                    color: onCardText,
                    textAlign: "center",
                  }}
                >
                  {t("result_mood_question")}
                </Text>

                <View style={{ height: 10 }} />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { key: "gestresst", label: "😣" },
                    { key: "angespannt", label: "😕" },
                    { key: "neutral", label: "😐" },
                    { key: "gut", label: "🙂" },
                    { key: "sehr_gut", label: "😌" },
                  ].map((m) => {
                    const selected = moodChoice === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => !moodSaved && handleMood(m.key)}
                        activeOpacity={0.9}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? "rgba(255,255,255,0.22)" : colors.surfaceVariant,
                          borderWidth: 1,
                          borderColor: selected ? "rgba(255,255,255,0.45)" : colors.border,
                          opacity: moodSaved ? 0.55 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{m.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ height: 12 }} />

                <TouchableOpacity
                  onPress={saveMood}
                  disabled={!moodChoice || moodSaved}
                  activeOpacity={0.9}
                  style={{
                    width: "100%",
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: !moodChoice || moodSaved ? colors.surfaceVariant : colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: !moodChoice || moodSaved ? 0.75 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 14,
                      color: !moodChoice || moodSaved ? onCardText : colors.background,
                      letterSpacing: 0.2,
                    }}
                  >
                    {moodSaved ? t("result_saved_ok") : t("result_save_mood")}
                  </Text>
                </TouchableOpacity>

                <View style={{ height: 10 }} />

                <TouchableOpacity
                  onPress={() => {
                    setNoteDraft(noteTextRef.current || "");
                    setNoteModalVisible(true);
                  }}
                  activeOpacity={0.9}
                  style={{
                    width: "100%",
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceVariant,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 14,
                      color: onCardText,
                    }}
                  >
                    {t("result_add_note")}
                  </Text>
                </TouchableOpacity>

                {noteText ? (
                  <Text
                    numberOfLines={2}
                    style={{
                      marginTop: 10,
                      fontFamily: "Montserrat_400Regular",
                      fontSize: 12,
                      color: onCardMuted,
                      textAlign: "center",
                      maxWidth: 400,
                    }}
                  >
                    {t("result_current_note", { text: noteText })}
                  </Text>
                ) : null}

                <View style={{ height: 14 }} />

                <TouchableOpacity
                  onPress={shareSuccess}
                  activeOpacity={0.9}
                  style={{
                    width: "100%",
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceVariant,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Share2 size={18} color={onCardText} />
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 14,
                      color: onCardText,
                      letterSpacing: 0.2,
                    }}
                  >
                    {t("result_share_btn")}
                  </Text>
                </TouchableOpacity>

                {/* Download + Social Share Row */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={handleDownloadShareCard}
                    activeOpacity={0.88}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14,
                      backgroundColor: colors.surfaceVariant, alignItems: "center",
                      justifyContent: "center", borderWidth: 1, borderColor: colors.border,
                      flexDirection: "row", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>⬇️</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: onCardText }}>
                      Speichern
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { try { require("react-native").Linking.openURL("instagram://"); } catch (_) { require("react-native").Linking.openURL("https://www.instagram.com/stillmind.app"); } }}
                    activeOpacity={0.88}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14,
                      backgroundColor: "rgba(131,58,180,0.10)", alignItems: "center",
                      justifyContent: "center", borderWidth: 1, borderColor: "rgba(131,58,180,0.25)",
                      flexDirection: "row", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>📸</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#C084FC" }}>
                      Instagram
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { try { require("react-native").Linking.openURL("snssdk1233://"); } catch (_) { require("react-native").Linking.openURL("https://www.tiktok.com/@stillmind.app"); } }}
                    activeOpacity={0.88}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14,
                      backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center",
                      justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                      flexDirection: "row", gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>🎵</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: onCardText }}>
                      TikTok
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* ── Upgrade Banner (Free only) ── */}
                {userPlan === "free" && (
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/premium")}
                    activeOpacity={0.88}
                    style={{
                      width: "100%",
                      marginTop: 14,
                      marginBottom: 4,
                      paddingVertical: 18,
                      paddingHorizontal: 20,
                      borderRadius: 18,
                      backgroundColor: "rgba(205,185,138,0.12)",
                      borderWidth: 1.5,
                      borderColor: "rgba(205,185,138,0.35)",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 6 }}>✨</Text>
                    <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#CDB98A", textAlign: "center", letterSpacing: 0.2, marginBottom: 4 }}>
                      {t("result_upgrade_title")}
                    </Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(205,185,138,0.75)", textAlign: "center", lineHeight: 19, marginBottom: 8 }}>
                      {t("result_upgrade_sub")}
                    </Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#CDB98A", letterSpacing: 0.3 }}>
                      {t("result_upgrade_btn")} →
                    </Text>
                  </TouchableOpacity>
                )}


                <View style={{ height: 10 }} />

                <TouchableOpacity
                  onPress={() => router.replace("/(tabs)")}
                  activeOpacity={0.9}
                  style={{
                    width: "100%",
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceVariant,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  <Home size={18} color={onCardText} />
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 14,
                      color: onCardText,
                    }}
                  >
                    {t("result_home_btn")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Upsell Banner für Free-User */}
              {userPlan === "free" && (
                <TouchableOpacity
                  onPress={() => { try { const { router } = require("expo-router"); router.push("/(tabs)/premium"); } catch(_){} }}
                  activeOpacity={0.85}
                  style={{ margin: 20, borderRadius: 18, borderWidth: 1, borderColor: "rgba(205,185,138,0.3)", backgroundColor: "rgba(205,185,138,0.07)", padding: 18 }}
                >
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#CDB98A", textAlign: "center", marginBottom: 6 }}>Mit Pro noch mehr herausholen</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 18, marginBottom: 14 }}>
                    Unbegrenzte Sessions · Offline verfügbar{"\n"}Detaillierte Statistiken · KI-Analyse
                  </Text>
                  <View style={{ backgroundColor: "#CDB98A", borderRadius: 12, paddingVertical: 11, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#0C0B09" }}>7 Tage kostenlos testen →</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>

      {/* Notiz Modal */}
      <Modal
        transparent
        visible={noteModalVisible}
        animationType="fade"
        onRequestClose={() => {
          setNoteModalVisible(false);
          Keyboard.dismiss();
        }}
      >
        <Pressable
          onPress={() => {
            setNoteModalVisible(false);
            Keyboard.dismiss();
          }}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.72)",
            alignItems: "center",
            justifyContent: "center",
            padding: 22,
          }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%", maxWidth: 520 }}>
            <Pressable
              onPress={() => {}}
              style={{
                width: "100%",
                backgroundColor: colors.surface,
                borderRadius: 28,
                padding: 18,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#000",
                shadowOpacity: 0.14,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 10 },
                elevation: 10,
              }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: onCardText }}>{t("result_note_title")}</Text>

              <Text style={{ marginTop: 6, fontFamily: "Montserrat_500Medium", fontSize: 13, color: onCardSub, lineHeight: 18 }}>
                {t("result_note_sub")}
              </Text>

              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder={t("result_note_placeholder")}
                placeholderTextColor={"rgba(255,255,255,0.35)"}
                multiline
                style={{
                  marginTop: 12,
                  minHeight: 120,
                  maxHeight: 240,
                  borderRadius: 18,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  backgroundColor: colors.surfaceVariant,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: onCardText,
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              />

              <View style={{ height: 12 }} />

              {/* Sticky Primary CTA */}
              <Animated.View style={{ transform: [{ scale: saveBtnScale }] }}>
                <TouchableOpacity
                  onPress={() => {
                    const v = (noteDraft || "").trim();
                    setNoteText(v);

                    Animated.sequence([
                      Animated.timing(saveBtnScale, {
                        toValue: 0.98,
                        duration: 90,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                      }),
                      Animated.timing(saveBtnScale, {
                        toValue: 1,
                        duration: 130,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: true,
                      }),
                    ]).start();

                    if (noteSaveTimerRef.current) {
                      clearTimeout(noteSaveTimerRef.current);
                      noteSaveTimerRef.current = null;
                    }

                    persistNote(v);

                    setNoteModalVisible(false);
                    Keyboard.dismiss();
                  }}
                  disabled={noteSaving}
                  activeOpacity={0.92}
                  style={{
                    width: "100%",
                    paddingVertical: 14,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOpacity: 0.16,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 4,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                    opacity: noteSaving ? 0.75 : 1,
                  }}
                >
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#fff", letterSpacing: 0.2 }}>
                    {noteSaving ? t("result_saving") : t("result_note_save")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                onPress={() => {
                  setNoteModalVisible(false);
                  Keyboard.dismiss();
                }}
                activeOpacity={0.85}
                style={{ paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: onCardText, opacity: 0.7 }}>{t("cancel")}</Text>
              </TouchableOpacity>

              <Text style={{ marginTop: 2, fontFamily: "Montserrat_400Regular", fontSize: 12, color: onCardMuted, textAlign: "center" }}>
                {t("result_note_local")}
              </Text>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* ===== SHARE CARD MODAL ===== */}
      <ShareCardModal
        visible={shareCardVisible}
        onClose={() => setShareCardVisible(false)}
        sessionCompleted={true}
        modeId={modeId}
        sessionType={resolvedSessionType}
        sessionTitle={title}
        durationMinutes={Math.max(1, durationMinutes || 1)}
        timestamp={resolvedTimestamp}
        quote={quote}
      />
      {/* Snackbar */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + 16,
          transform: [
            {
              translateY: snackbarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
          opacity: snackbarAnim,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.78)",
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#fff", textAlign: "center" }}>
            {snackbarText}
          </Text>
        </View>
      </Animated.View>

      {/* ===== Lifetime Promo Modal ===== */}
      <Modal transparent visible={lifetimePromoVisible} animationType="fade" onRequestClose={() => setLifetimePromoVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 24 }} onPress={() => setLifetimePromoVisible(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, backgroundColor: "#0D0905", borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: "rgba(205,185,138,0.15)" }}>

            <View style={{ padding: 28, paddingBottom: 22, backgroundColor: "rgba(205,185,138,0.06)", borderBottomWidth: 1, borderBottomColor: "rgba(205,185,138,0.08)", alignItems: "center" }}>
              <Text style={{ fontSize: 32, marginBottom: 10 }}>💎</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, letterSpacing: 2, color: "rgba(205,185,138,0.5)", textTransform: "uppercase", marginBottom: 6 }}>{t("prem_excl_offer") || "Exklusives Angebot"}</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: "#fff", letterSpacing: -0.3, marginBottom: 4 }}>Premium Life</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(205,185,138,0.55)" }}>{t("prem_once_forever") || "Einmalig kaufen · Für immer besitzen"}</Text>
            </View>

            <View style={{ padding: 22 }}>
              {[
                t("prem_life_feat_1") || "Alle Pro-Features — dauerhaft & ohne Limit",
                "😴 " + (t("prem_life_feat_2") || "Einschlaf-Modus (20 Min)"),
                t("prem_life_feat_3") || "Jahresbericht & Langzeittrends",
                "💎 " + (t("prem_life_feat_4") || "Lifetime Badge & Founder Status"),
                t("prem_life_feat_5") || "Alle zukünftigen Features — garantiert",
              ].map((feat, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
                  <Text style={{ color: "#CDB98A", fontSize: 12, marginTop: 2 }}>✓</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 19, flex: 1 }}>{feat}</Text>
                </View>
              ))}

              <View style={{ backgroundColor: "rgba(205,185,138,0.06)", borderWidth: 1, borderColor: "rgba(205,185,138,0.12)", borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 20 }}>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(205,185,138,0.6)", lineHeight: 18, textAlign: "center" }}>
                  ⚡ {t("prem_early_bird_hint") || "Early Bird Preis — nur noch kurze Zeit verfügbar"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => { setLifetimePromoVisible(false); router.push("/(tabs)/premium"); }}
                style={{ backgroundColor: "#CDB98A", borderRadius: 13, padding: 15, alignItems: "center", marginBottom: 12 }}
                activeOpacity={0.85}
              >
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#0D0905", letterSpacing: 0.2 }}>
                  {t("prem_discover_lifetime") || "Jetzt Premium Life entdecken →"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setLifetimePromoVisible(false)} style={{ alignItems: "center", paddingVertical: 4 }}>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{t("result_later") || "Später"}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingBottom: 16, flexDirection: "row", justifyContent: "center", gap: 16 }}>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: "rgba(255,255,255,0.15)", textDecorationLine: "underline" }} onPress={() => require("react-native").Linking.openURL("https://appstillmind.com/privacy.html")}>{t("prem_footer_privacy") || "Datenschutz"}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: "rgba(255,255,255,0.08)" }}>·</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: "rgba(255,255,255,0.15)", textDecorationLine: "underline" }} onPress={() => require("react-native").Linking.openURL("https://appstillmind.com/terms.html")}>{t("prem_footer_terms") || "Nutzungsbedingungen"}</Text>
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );