// apps/mobile/src/app/session-run/[id].jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Platform,
  Modal,
  Easing,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { Pause, Play, X, HelpCircle, Eye, EyeOff } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { useI18n, t } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { getSessionById } from "@/data/sessions-index";
import { getModeById } from "@/data/mode-quotes";
import { getAudioUrl, getSessionSfxUrl } from "@/utils/audio-manager";
import {
  getSettings,
  getDisclaimerShown,
  setDisclaimerShown,
  getHowItWorksShown,
  setHowItWorksShown,
  canStartSession,
  markSessionStarted,
  trackSessionStart,
  decrementSessionCountToday,
  getUserPlan,
  saveSessionCompletion,
  updateSessionHistoryEntry,
} from "@/utils/storage";
import { usePurchases } from "@/utils/usePurchases";
import { getCredits, useCredit } from "@/utils/credits-storage";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// --- Color helpers (for adaptive contrast on custom themes) ---
const parseColorToRgb = (input) => {
  if (!input || typeof input !== "string") return null;
  const s = input.trim();

  // Hex: #rgb, #rrggbb
  if (s[0] === "#") {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return { r, g, b };
    }
    return null;
  }

  // rgb()/rgba()
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m && m[1]) {
    const parts = m[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length < 3) return null;
    const r = Math.round(Number(parts[0]));
    const g = Math.round(Number(parts[1]));
    const b = Math.round(Number(parts[2]));
    if ([r, g, b].some((v) => !Number.isFinite(v))) return null;
    return {
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
    };
  }

  return null;
};

const relativeLuminance = (rgb) => {
  if (!rgb) return null;
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const lin = srgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};

// --- Rotierende Sprüche pro Start (für alle Sessions) ---

const pickRandom = (arr) => {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
};

const pickSessionQuote = (modeData, isSOS) => {
  if (isSOS) return pickRandom(SOS_QUOTES);
  if ((modeData && modeData.quotes) && modeData.quotes.length) return pickRandom(modeData.quotes);
  return (modeData && modeData.quote) || "";
};

const fmtMMSS = (totalSeconds) => {
  const s = Math.max(0, totalSeconds | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

// Position
const COUNTDOWN_Y_OFFSET = -90;

// Pulse tuning (slower + stronger)
const PULSE_MAX_SCALE = 1.075;
const PULSE_HALF_DURATION_MS = 2200;

// Transition tuning (smoother)
const OVERLAY_FADE_IN_MS = 320;
const OVERLAY_FADE_OUT_MS = 340;
const BUBBLE_IN_MS = 620;
const BUBBLE_OUT_MS = 360;

// ======================
// Breathing exercises (60s)
// ======================

export default function SessionRunScreen() {
  const { t } = useI18n();

  const SOS_QUOTES = useMemo(() => [
    t("run_panic_quote_0"),
    t("run_panic_quote_1"),
    t("run_panic_quote_2"),
  ], [t]);

  const BREATHING_EXERCISES = useMemo(() => ({
  diaphragmatic: {
    title: t("run_breath_diaphragmatic_title"),
    subtitle: "4s ein · 6s aus",
    semanticLabel: t("run_breath_diaphragmatic_semantic"),
    why: t("run_breath_diaphragmatic_why"),
    guidance: t("run_breath_diaphragmatic_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "exhale", seconds: 6, label: t("run_breath_exhale") },
    ],
  },
  "478": {
    title: "4-7-8-Atmung",
    subtitle: "4s ein · 4s halten · 6s aus",
    semanticLabel: t("run_breath_478_semantic"),
    why: t("run_breath_478_why"),
    guidance: t("run_breath_478_guidance"),
    caution:
      t("run_breath_478_caution"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "hold", seconds: 4, label: t("run_breath_hold") },
      { type: "exhale", seconds: 6, label: t("run_breath_exhale") },
    ],
  },
  box: {
    title: t("run_breath_box_title"),
    subtitle: "4-4-4-4",
    semanticLabel: t("run_breath_box_semantic"),
    why: t("run_breath_box_why"),
    guidance: t("run_breath_box_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "hold", seconds: 4, label: t("run_breath_hold") },
      { type: "exhale", seconds: 4, label: t("run_breath_exhale") },
      { type: "hold", seconds: 4, label: t("run_breath_hold") },
    ],
  },
  coherent: {
    title: t("run_breath_coherent_title"),
    subtitle: "5s ein · 5s aus",
    semanticLabel: t("run_breath_coherent_semantic"),
    why: t("run_breath_coherent_why"),
    guidance: t("run_breath_coherent_guidance"),
    pattern: [
      { type: "inhale", seconds: 5, label: t("run_breath_inhale") },
      { type: "exhale", seconds: 5, label: t("run_breath_exhale") },
    ],
  },
  long_exhale: {
    title: t("run_breath_long_exhale_title"),
    subtitle: "4s ein · 8s aus",
    semanticLabel: t("run_breath_long_exhale_semantic"),
    why: t("run_breath_long_exhale_why"),
    guidance: t("run_breath_long_exhale_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "exhale", seconds: 8, label: t("run_breath_exhale") },
    ],
  },
  phys_sigh: {
    title: t("run_breath_phys_sigh_title"),
    subtitle: t("run_breath_phys_sigh_subtitle"),
    semanticLabel: t("run_breath_phys_sigh_semantic"),
    why: t("run_breath_phys_sigh_why"),
    guidance:
      t("run_breath_phys_sigh_guidance"),
    pattern: [
      { type: "inhale", seconds: 2, label: t("run_breath_inhale") },
      { type: "inhale", seconds: 1, label: t("run_breath_nachatem") },
      { type: "exhale", seconds: 5, label: t("run_breath_exhale") },
    ],
  },
  nostril: {
    title: t("run_breath_nostril_title"),
    subtitle: t("run_breath_nostril_subtitle"),
    semanticLabel: t("run_breath_nostril_semantic"),
    why: t("run_breath_nostril_why"),
    guidance: t("run_breath_nostril_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_left_in") },
      { type: "exhale", seconds: 4, label: t("run_breath_right_out") },
      { type: "inhale", seconds: 4, label: t("run_breath_right_in") },
      { type: "exhale", seconds: 4, label: t("run_breath_left_out") },
    ],
  },
  pursed: {
    title: t("run_breath_pursed_title"),
    subtitle: "1:2 Rhythmus",
    semanticLabel: t("run_breath_pursed_semantic"),
    why: t("run_breath_pursed_why"),
    guidance: t("run_breath_pursed_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "exhale", seconds: 8, label: t("run_breath_exhale") },
    ],
  },
  counting: {
    title: t("run_breath_counting_title"),
    subtitle: "4s ein · 6s aus",
    semanticLabel: t("run_breath_counting_semantic"),
    why: t("run_breath_counting_why"),
    guidance: t("run_breath_counting_guidance"),
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_count_in") },
      { type: "exhale", seconds: 6, label: t("run_breath_count_out") },
    ],
  },
  observe: {
    title: t("run_breath_observe_title"),
    subtitle: t("run_breath_observe_subtitle"),
    semanticLabel: t("run_breath_observe_semantic"),
    why: t("run_breath_observe_why"),
    guidance: t("run_breath_observe_guidance"),
    pattern: [{ type: "observe", seconds: 60, label: t("run_breath_observe") }],
  },
  sleep_wind: {
    title: t("run_breath_sleep_title"),
    guidance: t("sess_sleep1_guidance"),
    isSleepMode: true,
    requiresLifetime: false,
    pattern: [
      { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
      { type: "exhale", seconds: 7, label: t("run_breath_exhale") },
    ],
  },
  }), [t]);
  const { id, mode, seconds, duration: durationParam, source, breathing, program: programParam, challengeDay: challengeDayParam } = useLocalSearchParams();
  const rawId = Array.isArray(id) ? id[0] : id;
  const breathingKey = Array.isArray(breathing) ? breathing[0] : breathing;

  const isBreathing =
    typeof rawId === "string" &&
    rawId.toLowerCase() === "breath" &&
    typeof breathingKey === "string" &&
    !!BREATHING_EXERCISES[breathingKey];

  const breathingExercise =
    isBreathing && typeof breathingKey === "string"
      ? BREATHING_EXERCISES[breathingKey]
      : null;

  const src = Array.isArray(source) ? source[0] : source;
  const isSOS =
    (typeof rawId === "string" && rawId.toLowerCase() === "sos") ||
    src === "sos" || src === "sos_extended";

  const insets = useSafeAreaInsets();
  const { colors } = useStillMindTheme();
  const { buyCredit } = usePurchases();

  // Session background can be very bright in Premium Life themes.
  // We adapt the inner circle contrast so it never "disappears" on neon/very light colors.
  const sessionBgColor = (isSOS && !isBreathing) ? "#B71C1C" : (breathingKey === "sleep_wind") ? "#0A0818" : colors.primary;
  const bgLum = relativeLuminance(parseColorToRgb(sessionBgColor));
  const isBrightBg = typeof bgLum === "number" && bgLum > 0.72;

  const innerCircleBg = isBrightBg
    ? "rgba(0,0,0,0.14)" // darker veil on very bright backgrounds
    : "rgba(255,255,255,0.32)";

  const innerCircleBorder = isBrightBg
    ? "rgba(0,0,0,0.18)"
    : "rgba(255,255,255,0.22)";

  // Text colors on the (sometimes very bright) session background.
  // If the background is bright, we switch to dark text to keep AA contrast.
  const onBgText = isBrightBg ? "rgba(0,0,0,0.90)" : "#FFFFFF";
  const onBgSub = isBrightBg ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.90)";
  const onBgMuted = isBrightBg ? "rgba(0,0,0,0.60)" : "rgba(255,255,255,0.86)";

  const addReadableShadow = (style) => style;

  const sessionFromId = rawId ? getSessionById(rawId) : null;
  const selectedMode = (isSOS && !isBreathing)
    ? ((typeof mode === "string" && mode) || "calm")
    : (typeof mode === "string" && mode) ||
      (isBreathing ? "calm" : (sessionFromId && sessionFromId.category)) ||
      "calm";

  const session = isSOS
    ? {
        id: "SOS",
        title: "SOS",
        category: "calm",
        description: t("run_sos_desc"),
        duration: 60,
      }
    : isBreathing
    ? {
        id: typeof breathingKey === "string" ? breathingKey : "breath",
        title: (breathingExercise && breathingExercise.title) || t("breathing_ex"),
        category: "calm",
        description: t("run_breath_session_desc"),
        duration: 60,
      }
    : sessionFromId || (rawId === "quick" ? {
        id: "quick",
        title: t("run_quick_title"),
        category: selectedMode || "calm",
        description: t("run_quick_desc"),
        duration: 60,
      } : null);

  const baseModeData = getModeById(selectedMode);

  // Für Atemübungen: eigener 'virtueller Modus' (ohne neue Dateien/Logikbruch)
  const modeData =
    isBreathing && breathingExercise
      ? {
          ...baseModeData,
          icon: "🫁",
          label: breathingExercise.title,
        }
      : baseModeData;

  // Für Atemübungen: eigenes Mini-"Modus"-Branding (ohne globale Mode-Logik zu verändern)
  const breathingModeData =
    isBreathing && breathingExercise
      ? {
          icon: "🫁",
          label: breathingExercise.title,
          subLabel: breathingExercise.subtitle || t("dur_60_sec"),
        }
      : null;

  const effectiveModeData = breathingModeData || modeData;

  // Zufälliger Spruch pro Start (bleibt während der Session stabil)
  const [displayQuote] = useState(() =>
    isBreathing
      ? (breathingExercise && breathingExercise.guidance) || t("run_default_guidance")
      : pickSessionQuote(modeData, isSOS)
  );

  // Musik: zuerst lokalen Cache prüfen, dann CDN
  // Start with null → resolve async → useAudioPlayer gets stable final URL
  const [musicSource, setMusicSource] = React.useState(null);
  React.useEffect(() => {
    const cdnUrl = getAudioUrl(selectedMode) || null;
    // SOS / quick / breath: kein Download-System → direkt CDN
    if (!id || id === "SOS" || id === "quick" || id === "breath") {
      setMusicSource(cdnUrl); return;
    }
    let alive = true;
    (async () => {
      try {
        const { getCachedAudioPath } = require("@/utils/offline-favorites");
        const local = await getCachedAudioPath(String(id));
        if (alive) setMusicSource(local || cdnUrl);
      } catch (_) { if (alive) setMusicSource(cdnUrl); }
    })();
    return () => { alive = false; };
  }, [id, selectedMode]);
  // useAudioPlayer: null = kein Audio bis Source aufgelöst
  const player = useAudioPlayer(musicSource);

  // Wenn musicSource sich ändert (z.B. von null auf lokalen Cache-Pfad),
  // muss musicPrimedRef zurückgesetzt werden damit der neue Player korrekt gestartet wird
  React.useEffect(() => {
    if (musicSource) {
      musicPrimedRef.current = false;
    }
  }, [musicSource]);

  // Audio priming: iOS blockt Audio, wenn play() nicht direkt im Button-Tap passiert.
  // Daher starten wir Audio beim Tap stumm und ziehen die Lautstärke nach dem Countdown hoch.
  const musicPrimedRef = useRef(false);

  // SFX cache
  const startSfxRef = useRef(null);
  const endSfxRef = useRef(null);
  const sfxLoadingRef = useRef({ start: false, end: false });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Refs for stable breathing animation gating (avoid stale state in closures)
  const hasStartedRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const [isLifetime, setIsLifetime] = useState(false);
  const [isSleepMode, setIsSleepMode] = useState(false);
  // Sleep mode: track current phase (phase 0-4 = progressively slower breathing)
  const sleepPhaseRef = useRef(0);
  const sleepPhaseTimerRef = useRef(null);

  const [sessionDurationSec, setSessionDurationSec] = useState(60);
  const [timeLeft, setTimeLeft] = useState(60);

  // Breathing guidance (nur für /session-run/breath?breathing=...)
  const [breathCue, setBreathCue] = useState("");
  const breathCueFrozenRef = useRef(false); // once true, setBreathLabel is ignored
  const [breathSubCue, setBreathSubCue] = useState("");

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [howItWorksAutoShown, setHowItWorksAutoShown] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showBreathText, setShowBreathText] = useState(true); // Toggle: Atemtext ein/ausblenden

  // First install can be slow (AsyncStorage reads + fonts). If the user taps
  // start during that window, we queue the intent and execute as soon as the
  // screen is ready and all blocking modals are handled.
  const pendingStartRef = useRef(false);

  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  const [usedCredit, setUsedCredit] = useState(false);
  const trackStartOnceRef = useRef(false);

  const historyEntryIdRef = useRef(null);
  const sessionPlannedDurationSecRef = useRef(60);

  // 🔒 verhindert doppeltes Finish / doppelte Navigation
  const finishedRef = useRef(false);
  const graceTimerRef = useRef(null);
  const sessionEndingRef = useRef(false);

  // ======================
  // Pre-Start Countdown
  // ======================
  const [preStartVisible, setPreStartVisible] = useState(false);
  const [preStartCount, setPreStartCount] = useState(3);
  const [preStartPhase, setPreStartPhase] = useState("count"); // "count" | "go"

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const centerOpacity = useRef(new Animated.Value(0)).current;
  const centerScale = useRef(new Animated.Value(0.985)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);

  const preStartTimersRef = useRef([]);
  const preStartRunningRef = useRef(false);

  const breatheAnim = useRef(new Animated.Value(1)).current;
  const breatheLoopRef = useRef(null);
  const intervalRef = useRef(null);
  const webAudioRef = useRef(null);

  // ======================
  // Breathing Engine (native Animation, 100% stabil)
  // ======================
  const sessionStartEpochMsRef = useRef(null);
  const pausedAccumMsRef = useRef(0);
  const pauseStartedAtRef = useRef(null);

  const breathEngineRef = useRef({
    segments: [], // { label, type, from, to, durMs }
    cycleMs: 0,
    min: 0.94,
    max: 1.08,
    running: false,
    idx: 0,
    anim: null,
    label: null,
  });

  // Counting technique: counts 1..10 across inhale/exhale segments
  const countingStepRef = useRef(1);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const clearPreStartTimers = () => {
    if ((preStartTimersRef.current && preStartTimersRef.current.length)) {
      preStartTimersRef.current.forEach((t) => clearTimeout(t));
      preStartTimersRef.current = [];
    }
  };

  // Reset audio on every mount so repeat sessions work
  useEffect(() => {
    musicPrimedRef.current = false;
    try {
      if (player) {
        player.pause();
        if (typeof player.seekTo === 'function') player.seekTo(0);
        else if (typeof player.currentTime !== 'undefined') player.currentTime = 0;
      }
    } catch (_) {}
  }, []);

  // ✅ ANDROID AUDIO FIX:
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (_e) {}
    })();
  }, []);

  useEffect(() => {
    try {
      if (!player) return;
      player.loop = true;
    } catch (_e) {}
  }, [player]);

  // Unload SFX sounds on unmount
  useEffect(() => {
    return () => {
      try {
        startSfxRef.current && startSfxRef.current.unloadAsync && startSfxRef.current.unloadAsync();
      } catch (_e) {}
      try {
        endSfxRef.current && endSfxRef.current.unloadAsync && endSfxRef.current.unloadAsync();
      } catch (_e) {}
    };
  }, []);

  useEffect(() => {
    return () => {
      clearPreStartTimers();
      preStartRunningRef.current = false;

      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
        pulseLoopRef.current = null;
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // 🔧 Android: nach SFX immer Musik wieder anstoßen (fix für "Start-Gong -> Stille")
  const kickMusicAndroid = async () => {
    if (Platform.OS !== "android") return;
    if (!soundEnabled) return;
    try {
      await new Promise((r) => setTimeout(r, 60));
    } catch (_e) {}
    try {
      if (typeof (player && player.volume) === "number") player.volume = 0.9;
    } catch (_e) {}
    try {
      player && player.play && player.play();
      musicPrimedRef.current = true;
    } catch (_e) {}
  };

  const playSfx = async (which) => {
    if (!soundEnabled) return;
    try {
      const uri =
        which === "start" ? getSessionSfxUrl("start") : getSessionSfxUrl("end");
      const ref = which === "start" ? startSfxRef : endSfxRef;
      const key = which === "start" ? "start" : "end";
      if (!ref.current && !sfxLoadingRef.current[key]) {
        sfxLoadingRef.current[key] = true;
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false, volume: 1.0 },
          null,
          false
        );
        ref.current = sound;
        sfxLoadingRef.current[key] = false;
      }
      if (!ref.current) return;
      await ref.current.setVolumeAsync(1.0);
      try {
        ref.current.setOnPlaybackStatusUpdate((status) => {
          if (!status) return;
          if (status.didJustFinish) {
            try {
              ref.current && ref.current.setOnPlaybackStatusUpdate && ref.current.setOnPlaybackStatusUpdate(null);
            } catch (_e) {}
            kickMusicAndroid();
          }
        });
      } catch (_e) {}
      try {
        await ref.current.setPositionAsync(0);
      } catch (_e) {}
      await ref.current.playAsync();
      kickMusicAndroid();
    } catch (_e) {
      // ignore
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const s = await getSettings();
        const plan = await getUserPlan();

        setSoundEnabled((s && s.soundEnabled) !== false);

        // Premium-Session gate: Free-User dürfen isPremium:true Sessions nicht starten
        if (plan === "free" && sessionFromId && sessionFromId.isPremium) {
          Alert.alert(
            t("premium_required") || t("run_pro_required"),
            t("run_alert_limit_free") || "Diese Session ist nur für Pro- und Lifetime-Mitglieder verfügbar.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return;
        }

        const isLife = plan === "lifetime";
        const isProPlus = plan === "pro" || plan === "lifetime";
        setIsLifetime(isLife);

        // Free: immer 60s (1 Minute fix)
        // Pro/Lifetime: 60–600s frei wählbar
        // SOS: immer 60s (egal welcher Plan)
        // Sleep mode (Lifetime): immer 20 Min (1200s)
        let dur = 60;
        const isSOSLocal = isSOS;
        const isBreathLocal = isBreathing;
        const isSleepModeLocal = isBreathLocal && breathingKey === "sleep_wind";

        if (isSleepModeLocal && isLife) {
          dur = 1200; // 20 Minuten für Einschlaf-Modus
          setIsSleepMode(true);
        } else if (isSOSLocal) {
          // SOS: duration param kommt als "duration" (nicht "seconds")
          const sosNum = Number(durationParam || seconds);
          if (!Number.isNaN(sosNum) && sosNum >= 60 && sosNum <= 600) {
            dur = sosNum;
          }
        } else if (!isBreathLocal) {
          const secNum = Number(seconds || durationParam);
          if (!Number.isNaN(secNum) && secNum >= 60 && secNum <= 600) {
            dur = secNum;
          } else if (!isSOSLocal && isProPlus && typeof (s && s.lifetimeSeconds) === "number") {
            dur = clamp(s.lifetimeSeconds, 60, 600);
          }
        }

        setSessionDurationSec(dur);
        setTimeLeft(dur);

        const shown = await getDisclaimerShown();
        setDisclaimerAccepted(!!shown);

        if (Platform.OS === "web") {
          try {
            const AudioCtor = typeof window !== "undefined" ? window.Audio : null;
            if (AudioCtor && musicSource) {
              const a = new AudioCtor(musicSource);
              a.loop = true;
              a.volume = 0.9;
              webAudioRef.current = a;
            }
          } catch (_e) {}
        }

        setIsReady(true);
      } catch (e) {
        console.error("❌ init:", e);
        setIsReady(true);
      }
    };

    init();
  }, [seconds, musicSource, isBreathing, isSOS]);

  // ======================
  // Anleitung wird nicht mehr automatisch gezeigt – nur noch beim ersten Start-Tap
  // ======================
  useEffect(() => {
    if (!isReady) return;
    if (isSOS) { setHowItWorksAutoShown(true); return; }
    // Bereits gesehen → Flag setzen damit startSessionWithCountdown nicht blockiert
    (async () => {
      try {
        const alreadySeen = await getHowItWorksShown();
        if (alreadySeen) setHowItWorksAutoShown(true);
        // Noch nicht gesehen → howItWorksAutoShown bleibt false → erster Start-Tap zeigt Modal
      } catch (_e) { setHowItWorksAutoShown(true); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isSOS]);

  // ======================
  // Breathing cue engine (nur isBreathing)
  // ======================
  useEffect(() => {
    if (!isBreathing || !breathingExercise) return;

    if (!hasStarted) {
      setBreathCue(breathingExercise.subtitle || t("dur_60_sec"));
      const guide = breathingExercise.guidance ? `${breathingExercise.guidance}\n\n` : "";
      const why = breathingExercise.why ? `${breathingExercise.why}\n\n` : "";
      setBreathSubCue(`${why}${guide}`.trim());
      return;
    }

    return;
  }, [isBreathing, breathingExercise, hasStarted, timeLeft, sessionDurationSec]);

  // ======================
  // Breath word overlay (für ALLE Sessions)
  // ======================
  useEffect(() => {
    if (isBreathing) return; // Atemübungen haben eigene Logik oben
    if (!hasStarted) {
      setBreathCue("");
      setBreathSubCue("");
      return;
    }
    return;
  }, [isBreathing, hasStarted, isPaused, timeLeft, sessionDurationSec, selectedMode]);

  const buildStartMeta = () => {
    const plannedDurationSec = clamp(sessionDurationSec || 60, 60, 600);

    const isSOSLocal = isSOS;
    const cdNum = challengeDayParam != null ? Number(challengeDayParam) : undefined;

    if (isSOSLocal) {
      return {
        sessionId: "SOS",
        sessionName: "SOS",
        mode: "calm",
        durationSec: 60,
        source: "sos",
      };
    }

    if (id === "quick") {
      return {
        sessionId: `quick:${selectedMode}`,
        sessionName: (modeData && modeData.label) || t("session"),
        mode: selectedMode || null,
        durationSec: plannedDurationSec,
        source: "quick",
        challengeDay: cdNum,
      };
    }

    return {
      sessionId: typeof id === "string" ? id : null,
      sessionName: (session && session.title) || null,
      mode: selectedMode || null,
      durationSec: plannedDurationSec,
      source: "session",
      programId: (typeof programParam === "string" && programParam) ? programParam : null,
      challengeDay: cdNum,
    };
  };

  const logSessionStartOnce = async () => {
    if (trackStartOnceRef.current) return;
    trackStartOnceRef.current = true;

    const meta = buildStartMeta();
    sessionPlannedDurationSecRef.current =
      (meta && meta.durationSec) || sessionPlannedDurationSecRef.current;

    if (usedCredit) {
      const historyEntry = await trackSessionStart(meta);
      if ((historyEntry && historyEntry.id)) historyEntryIdRef.current = historyEntry.id;
      return { success: true, reason: "credit-preused", historyEntry };
    }

    const res = await markSessionStarted(meta);
    if ((res && res.historyEntry) && id) historyEntryIdRef.current = res.historyEntry.id;
    return res;
  };

  // ======================
  // Audio timing (iOS-safe)
  // ======================
  const primeMusicSilently = async () => {
    if (!soundEnabled) return;
    if (Platform.OS === "android") return;

    try {
      if (Platform.OS === "web" && webAudioRef.current) {
        webAudioRef.current.loop = true;
        webAudioRef.current.volume = 0;
        await webAudioRef.current.play().catch(() => {});
        musicPrimedRef.current = true;
        return;
      }

      try {
        player.loop = true;
      } catch (_e) {}

      try {
        if (typeof player.volume === "number") player.volume = 0;
      } catch (_e) {}

      try {
        if (typeof player.currentTime !== "undefined") player.currentTime = 0;
      } catch (_e) {}

      try {
        player.play();
        musicPrimedRef.current = true;
      } catch (_e) {}
    } catch (e) {
      console.warn("primeMusicSilently failed", e);
    }
  };

  const makeMusicAudible = async () => {
    if (!soundEnabled) return;

    try {
      if (Platform.OS === "web" && webAudioRef.current) {
        if (webAudioRef.current.paused) {
          await webAudioRef.current.play().catch(() => {});
        }
        webAudioRef.current.volume = 0.9;
        return;
      }

      try {
        if (typeof player.volume === "number") player.volume = 0.9;
      } catch (_e) {}

      if (Platform.OS === "android") {
        try {
          player.play();
          musicPrimedRef.current = true;
        } catch (_e) {}
        return;
      }

      if (!musicPrimedRef.current) {
        try {
          player.play();
          musicPrimedRef.current = true;
        } catch (_e) {}
      }
    } catch (e) {
      console.warn("makeMusicAudible failed", e);
    }
  };

  // ======================
  // Breath Sync helpers
  // ======================
  const stopBreathing = () => {
    const eng = breathEngineRef.current;
    eng.running = false;

    try {
      if (eng.anim && typeof eng.anim.stop === "function") {
        eng.anim.stop();
      }
    } catch (_e) {}
    eng.anim = null;

    try {
      breatheAnim.stopAnimation(() => {});
    } catch (_e) {}

    eng.idx = 0;
  };

  const setBreathLabel = (label) => {
    if (breathCueFrozenRef.current) return; // session ending, label locked
    const eng = breathEngineRef.current;
    if (eng.label === label) return;
    eng.label = label;
    setBreathCue(label);
    setBreathSubCue("");
  };

  const buildSegmentsFromPattern = (pattern, opts) => {
    const min = (opts.min || 0.94)
    const max = (opts.max || 1.08)

    const segs = [];
    let current = min;

    const safeArr =
      Array.isArray(pattern) && pattern.length
        ? pattern
        : [
            { type: "inhale", seconds: 4, label: t("run_breath_inhale") },
            { type: "exhale", seconds: 4, label: t("run_breath_exhale") },
          ];

    for (const step of safeArr) {
      const type = String((step && step.type) || "").toLowerCase();
      const sec = Math.max(0, Number((step && step.seconds)) || 0);
      const durMs = Math.round(sec * 1000);

      let label = String((step && step.label) || "");
      if (!label) {
        if (type.includes("inhale") || type.includes("ein")) label = t("run_breath_inhale");
        else if (type.includes("exhale") || type.includes("aus")) label = t("run_breath_exhale");
        else label = t("run_breath_hold");
      }

      if (type.includes("inhale") || type.includes("ein")) {
        segs.push({ type: "inhale", label, from: current, to: max, durMs });
        current = max;
      } else if (type.includes("exhale") || type.includes("aus")) {
        segs.push({ type: "exhale", label, from: current, to: min, durMs });
        current = min;
      } else {
        const isObserve = type.includes("observe") || type.includes("beob");
        segs.push({
          type: isObserve ? "observe" : "hold",
          label,
          from: current,
          to: current,
          durMs,
        });
      }
    }

    const cycleMs = segs.reduce((a, s) => a + Math.max(0, s.durMs || 0), 0);
    return { segments: segs, cycleMs: Math.max(1, cycleMs), min, max };
  };

  const calcPositionAtOffset = (segments, cycleMs, offsetMs) => {
    const cyc = Math.max(1, cycleMs || 1);
    const t = ((offsetMs % cyc) + cyc) % cyc;

    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const dur = Math.max(0, s.durMs || 0);
      if (dur === 0) return { idx: i, within: 0, scale: s.to, label: s.label };
      if (t < acc + dur) {
        const within = t - acc;
        const p = dur > 0 ? within / dur : 0;
        const scale = s.from + (s.to - s.from) * p;
        return { idx: i, within, scale, label: s.label };
      }
      acc += dur;
    }

    const last = segments[segments.length - 1];
    return {
      idx: segments.length - 1,
      within: 0,
      scale: last.to || 1,
      label: last.label || t("run_breath_inhale"),
    };
  };

  const runBreathingChain = ({ startIdx, startWithinMs }) => {
    const eng = breathEngineRef.current;
    const segs = eng.segments;
    if (!Array.isArray(segs) || !segs.length) return;

    eng.running = true;
    eng.idx = startIdx;

    const runSegment = (idx, withinMs) => {
      const s = segs[idx];
      if (!s) return;

      let label = s.label;

      if (
        isBreathing &&
        breathingKey === "counting" &&
        (s.type === "inhale" || s.type === "exhale")
      ) {
        const n = Number(countingStepRef.current) || 1;
        const base = s.type === "inhale" ? t("run_breath_inhale") : t("run_breath_exhale");
        label = base + "  " + n;
        // Nur beim nächsten Einatmen hochzählen (1 Zähler pro vollem Atemzug)
        if (s.type === "exhale") {
          countingStepRef.current = n >= 10 ? 1 : n + 1;
        }
      }

      const dur = Math.max(0, s.durMs || 0);
      const remaining = Math.max(0, dur - Math.max(0, withinMs || 0));

      if (
        !hasStartedRef.current ||
        isPausedRef.current ||
        finishedRef.current ||
        sessionEndingRef.current ||
        !eng.running
      )
        return;

      setBreathLabel(label);

      if (remaining <= 0) {
        const nextIdx = (idx + 1) % segs.length;
        runSegment(nextIdx, 0);
        return;
      }

      try {
        if (eng.anim && typeof eng.anim.stop === "function") eng.anim.stop();
      } catch (_e) {}

      eng.anim = Animated.timing(breatheAnim, {
        toValue: s.to,
        duration: remaining,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });

      eng.anim.start(({ finished }) => {
        if (!finished) return;
        if (
          !hasStartedRef.current ||
          isPausedRef.current ||
          finishedRef.current ||
          sessionEndingRef.current ||
          !eng.running
        )
          return;
        const nextIdx = (idx + 1) % segs.length;
        runSegment(nextIdx, 0);
      });
    };

    runSegment(startIdx, startWithinMs);
  };

  // Sleep mode phase progression: slow breathing down gradually over 20 min
  // Phase 0 (0-3min):   4s in / 7s out
  // Phase 1 (3-6min):   5s in / 8s out
  // Phase 2 (6-10min):  5s in / 9s out  
  // Phase 3 (10-15min): 6s in / 10s out
  // Phase 4 (15-20min): 6s in / 12s out  ← deepest, near sleep
  const SLEEP_PHASES = [
    { inhale: 4, exhale: 7, startMin: 0 },
    { inhale: 5, exhale: 8, startMin: 3 },
    { inhale: 5, exhale: 9, startMin: 6 },
    { inhale: 6, exhale: 10, startMin: 10 },
    { inhale: 6, exhale: 12, startMin: 15 },
  ];

  const getSleepPhasePattern = (phaseIdx) => {
    const p = SLEEP_PHASES[Math.min(phaseIdx, SLEEP_PHASES.length - 1)];
    return [
      { type: "inhale", seconds: p.inhale, label: t("run_breath_inhale") },
      { type: "exhale",  seconds: p.exhale,  label: t("run_breath_exhale") },
    ];
  };

  const startBreathingForCurrentSession = () => {
    stopBreathing();

    if (isBreathing && breathingKey === "counting") {
      countingStepRef.current = 1;
    }

    const min = 0.94;
    const max = 1.08;

    let pattern = null;
    if (isBreathing && breathingKey === "sleep_wind") {
      // Use current sleep phase pattern
      pattern = getSleepPhasePattern(sleepPhaseRef.current);
    } else if (isBreathing && (breathingExercise && breathingExercise.pattern)) {
      pattern = breathingExercise.pattern;
    } else {
      // Standard: 5s ein / 5s aus = 10s Zyklus, 6 Zyklen in 60s
      // Letzte 5 Sek. des Zyklus sind immer Ausatmen → garantiert
      pattern = [
        { type: "inhale", seconds: 5, label: t("run_breath_inhale") },
        { type: "exhale", seconds: 5, label: t("run_breath_exhale") },
      ];
    }

    const built = buildSegmentsFromPattern(pattern, { min, max });
    const eng = breathEngineRef.current;
    eng.segments = built.segments;
    eng.cycleMs = built.cycleMs;
    eng.min = built.min;
    eng.max = built.max;

    const start = sessionStartEpochMsRef.current;
    const paused = pausedAccumMsRef.current || 0;
    const now = Date.now();
    const offset = start ? now - start - paused : 0;

    const pos = calcPositionAtOffset(eng.segments, eng.cycleMs, offset);
    try {
      breatheAnim.setValue(pos.scale);
    } catch (_e) {}

    runBreathingChain({ startIdx: pos.idx, startWithinMs: pos.within });
  };

  const beginSession = async () => {
    hasStartedRef.current = true;
    isPausedRef.current = false;
    setHasStarted(true);
    setIsPaused(false);

    setTimeLeft(sessionDurationSec);

    await makeMusicAudible();

    try {
      stopBreathing();

      sessionStartEpochMsRef.current = Date.now();
      pausedAccumMsRef.current = 0;
      pauseStartedAtRef.current = null;

      startBreathingForCurrentSession();

      // Sleep mode: schedule phase transitions
      if (isBreathing && breathingKey === "sleep_wind") {
        sleepPhaseRef.current = 0;
        if (sleepPhaseTimerRef.current) clearTimeout(sleepPhaseTimerRef.current);
        const SLEEP_PHASES_TIMES = [3, 6, 10, 15]; // minutes for phase 1,2,3,4
        SLEEP_PHASES_TIMES.forEach((startMin, idx) => {
          const timer = setTimeout(() => {
            if (!hasStartedRef.current || finishedRef.current) return;
            sleepPhaseRef.current = idx + 1;
            startBreathingForCurrentSession();
          }, startMin * 60 * 1000);
          // store last timer for cleanup
          if (idx === SLEEP_PHASES_TIMES.length - 1) sleepPhaseTimerRef.current = timer;
        });
      }
    } catch (e) {
      try {
        stopBreathing();
        setBreathLabel(t("run_breath_inhale"));
        const fallback = Animated.loop(
          Animated.sequence([
            Animated.timing(breatheAnim, {
              toValue: 1.08,
              duration: 1400,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(breatheAnim, {
              toValue: 0.94,
              duration: 1400,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          { resetBeforeIteration: false }
        );
        breathEngineRef.current.anim = fallback;
        fallback.start();
      } catch (_e) {}
    }

    // Start 5s grace period — abort before this = session count refunded
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = setTimeout(() => { graceTimerRef.current = null; }, 5000);

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          sessionEndingRef.current = true;
          breathCueFrozenRef.current = true;
          breathEngineRef.current.running = false;
          try { if (breathEngineRef.current.anim) breathEngineRef.current.anim.stop(); } catch(_){}
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ======================
  // Eligibility / Purchase flow
  // ======================
  const showNoCreditsAlert = async () => {
    const plan = await getUserPlan();

    Alert.alert(
      t("daily_limit_title"),
      plan === "free"
        ? t("run_alert_limit_free")
        : t("run_alert_limit_pro"),
      [
        {
          text: t("run_btn_extra_minute"),
          onPress: () => {
            (async () => {
              const result = await buyCredit();
              if (!(result && result.success)) {
                Alert.alert(
                  t("run_alert_purchase_fail"),
                  (result && result.error) || t("run_alert_purchase_fail_msg")
                );
                return;
              }
              startSessionWithCountdown();
            })();
          },
        },
        {
          text: t("run_btn_upgrade"),
          onPress: () => {
            Alert.alert(t("run_alert_error"), t("run_alert_start_fail"));
          },
        },
        { text: t("run_btn_later"), style: "cancel" },
      ]
    );
  };

  const preflightCanStart = async () => {
    try {
      const status = await canStartSession();
      if (!(status && status.canStart)) {
        await showNoCreditsAlert();
        return false;
      }
      return true;
    } catch (e) {
      console.error("❌ preflightCanStart:", e);
      Alert.alert(t("run_alert_error"), t("run_alert_check_fail"));
      return false;
    }
  };

  const finalizeStartSession = async () => {
    try {
      if (!disclaimerAccepted) return;

      const status = await canStartSession();
      const plan = await getUserPlan();

      if (!(status && status.canStart)) {
        Alert.alert(
          t("run_alert_unavailable"),
          plan === "free"
            ? t("run_alert_limit_free")
            : t("run_alert_limit_pro")
        );
        return;
      }

      if (status.reason === "credit") {
        const localCredits = await getCredits();
        if (localCredits > 0) {
          const used = await useCredit();
          if ((used && used.success)) {
            setUsedCredit(true);
            await logSessionStartOnce();
            await beginSession();
            return;
          }
        }
      }

      const marked = await logSessionStartOnce();
      if (!(marked && marked.success)) {
        Alert.alert(t("run_alert_error"), (marked && marked.error) || t("run_alert_start_fail"));
        return;
      }

      if (usedCredit) setUsedCredit(false);

      await logSessionStartOnce();
      await beginSession();
    } catch (e) {
      console.error("❌ finalizeStartSession:", e);
      Alert.alert(t("run_alert_error"), t("run_alert_start_fail"));
    }
  };

  // ======================
  // Countdown: smooth open/close + breathing pulse
  // ======================
  const startPulse = () => {
    if (pulseLoopRef.current) return;

    pulseScale.setValue(1);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: PULSE_MAX_SCALE,
          duration: PULSE_HALF_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseScale, {
          toValue: 1.0,
          duration: PULSE_HALF_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );

    pulseLoopRef.current = loop;
    loop.start();
  };

  const stopPulse = () => {
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }
    pulseScale.setValue(1);
  };

  const openCountdown = () => {
    setPreStartVisible(true);

    overlayOpacity.setValue(0);
    centerOpacity.setValue(0);
    centerScale.setValue(0.985);
    ringOpacity.setValue(0);

    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: OVERLAY_FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    Animated.parallel([
      Animated.timing(centerOpacity, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(centerScale, {
        toValue: 1,
        duration: BUBBLE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(ringOpacity, {
        toValue: 1,
        duration: BUBBLE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => {
      startPulse();
    });
  };

  const closeCountdown = (after) => {
    stopPulse();

    Animated.parallel([
      Animated.timing(centerOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: OVERLAY_FADE_OUT_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(centerScale, {
        toValue: 0.972,
        duration: BUBBLE_OUT_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 320,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => {
      setPreStartVisible(false);
      after && after();
    });
  };

  const startSOSInstant = async (fromTap = false) => {
    if (!isReady) return;
    if (!disclaimerAccepted) return;
    if (hasStarted || preStartRunningRef.current) return;
    if (preStartVisible) return;
    if (!isSOS) return;

    // Offline-Check: Basis-User dürfen auch SOS nicht ohne Internet starten
    let isOnline = false;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch("https://pub-10d1ab3245524dc29b0ce6ddd31a187a.r2.dev/calm.mp3", { method: "HEAD", signal: ctrl.signal });
      clearTimeout(timeout);
      isOnline = res.ok;
    } catch (_) { isOnline = false; }

    if (!isOnline) {
      const currentPlan = await getUserPlan().catch(() => "free");
      if (currentPlan !== "pro" && currentPlan !== "lifetime") {
        Alert.alert(
          t("offline_no_connection_title") || t("run_no_connection"),
          t("offline_no_connection_msg_free") || "Für diese Session wird eine Internetverbindung benötigt. Mit StillMind Pro kannst du Sessions herunterladen und offline nutzen.",
          [{ text: "OK" }]
        );
        return;
      }
    }

    finishedRef.current = false;
    sessionEndingRef.current = false;
    breathCueFrozenRef.current = false;

    const ok = await preflightCanStart();
    if (!ok) return;

    if (fromTap) {
      await primeMusicSilently();
      await makeMusicAudible();
    }

    clearPreStartTimers();
    preStartRunningRef.current = false;

    playSfx("start");

    await finalizeStartSession();
  };

  // ✅ SOS: startet sofort nach dem Öffnen (ohne Countdown/Overlay)
  useEffect(() => {
    if (!isSOS) return;
    if (!isReady) return;
    if (!disclaimerAccepted) return;
    if (hasStarted) return;
    if (preStartVisible || preStartRunningRef.current) return;

    (async () => {
      try {
        await startSOSInstant(false);
      } catch (e) {
        console.error("❌ SOS auto-start:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSOS, isReady, disclaimerAccepted]);

  const startSessionWithCountdown = async () => {
    // Offline-Check: Basis-User dürfen KEINE Session ohne Internet starten (auch SOS/quick/breath)
    const sessionKey = String(id);
    let isOnline = false;
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch("https://pub-10d1ab3245524dc29b0ce6ddd31a187a.r2.dev/calm.mp3", { method: "HEAD", signal: ctrl.signal });
      clearTimeout(timeout);
      isOnline = res.ok;
    } catch (_) { isOnline = false; }

    if (!isOnline) {
      const currentPlan = await getUserPlan().catch(() => "free");
      const canOffline = currentPlan === "pro" || currentPlan === "lifetime";
      if (!canOffline) {
        Alert.alert(
          t("offline_no_connection_title") || t("run_no_connection"),
          t("offline_no_connection_msg_free") || "Für diese Session wird eine Internetverbindung benötigt. Mit StillMind Pro kannst du Sessions herunterladen und offline nutzen.",
          [{ text: "OK" }]
        );
        return;
      }
      // Pro/Lifetime: nur normale Sessions brauchen Cache-Check (SOS/quick/breath immer erlaubt)
      const isSpecialSession = !id || id === "SOS" || id === "quick" || id === "breath";
      if (!isSpecialSession) {
        let isCached = false;
        try {
          const { getCachedAudioPath } = require("@/utils/offline-favorites");
          const local = await getCachedAudioPath(sessionKey);
          isCached = !!local;
        } catch (_) {}
        if (!isCached) {
          Alert.alert(
            t("offline_no_connection_title") || t("run_no_connection"),
            t("offline_no_connection_msg") || "Für diese Session wird eine Internetverbindung benötigt. Lade sie zuerst herunter, um sie offline zu nutzen.",
            [{ text: "OK" }]
          );
          return;
        }
      }
    }

    if (!isReady) {
      pendingStartRef.current = true;
      return;
    }
    if (!disclaimerAccepted) {
      pendingStartRef.current = true;
      return;
    }
    // Beim allerersten Start: Anleitung zeigen und erst nach t("run_understood") fortfahren
    if (!howItWorksAutoShown && !isSOS) {
      pendingStartRef.current = true;
      try {
        const alreadySeen = await getHowItWorksShown();
        if (!alreadySeen) {
          setShowHowItWorks(true);
          setHowItWorksAutoShown(true);
          setHowItWorksShown(true).catch(() => {});
          return; // Session startet erst nach t("run_understood")
        } else {
          setHowItWorksAutoShown(true);
        }
      } catch (_e) {
        setHowItWorksAutoShown(true);
      }
    }
    if (hasStarted || preStartRunningRef.current) return;
    if (preStartVisible) return;

    finishedRef.current = false;
    sessionEndingRef.current = false;
    breathCueFrozenRef.current = false;

    const ok = await preflightCanStart();
    if (!ok) return;

    preStartRunningRef.current = true;
    clearPreStartTimers();

    await primeMusicSilently();

    setPreStartPhase("count");
    setPreStartCount(3);
    openCountdown();

    preStartTimersRef.current.push(
      setTimeout(() => setPreStartCount(2), 1000),
      setTimeout(() => setPreStartCount(1), 2000),
      setTimeout(() => {
        setPreStartPhase("go");
      }, 3000),
      setTimeout(() => {
        playSfx("start");
      }, 3275),
      setTimeout(() => {
        makeMusicAudible();
        kickMusicAndroid();
      }, 3450),
      setTimeout(() => {
        if (!preStartRunningRef.current) return;
        finalizeStartSession();
      }, 3280),
      setTimeout(() => {
        closeCountdown(() => {
          preStartRunningRef.current = false;
        });
      }, 3850)
    );
  };

  useEffect(() => {
    if (!pendingStartRef.current) return;
    if (!isReady) return;
    if (!disclaimerAccepted) return;
    if (hasStarted || preStartVisible || preStartRunningRef.current) return;

    pendingStartRef.current = false;
    requestAnimationFrame(() => {
      startSessionWithCountdown();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, disclaimerAccepted]);

  const finishSession = async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    try {
      const entryId = historyEntryIdRef.current;
      if (entryId) {
        const planned = clamp(
          sessionPlannedDurationSecRef.current || sessionDurationSec || 60,
          1,
          36000
        );
        const elapsed = clamp(
          planned - (typeof timeLeft === "number" ? timeLeft : 0),
          0,
          planned
        );
        await updateSessionHistoryEntry(entryId, {
          endedAt: Date.now(),
          status: "completed",
          elapsedSec: elapsed,
          durationSec: planned,
        });
      }
    } catch (_e) {}

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      try {
        if (Platform.OS === "web" && webAudioRef.current) {
          try {
            webAudioRef.current.pause();
            webAudioRef.current.currentTime = 0;
          } catch (_e) {}
        } else {
          try {
            player.pause();
          } catch (_e) {}
        }
      } catch (_e) {}

      try {
        const sid = (session && session.id) || (typeof id === "string" ? id : undefined);
        if (sid) await saveSessionCompletion(sid);
      } catch (_e) {}

      if (usedCredit) setUsedCredit(false);

      const resultId = (session && session.id) || (typeof id === "string" ? id : null);

      await new Promise((r) => setTimeout(r, 150));

      if (resultId) {
        const hid = historyEntryIdRef.current;
        if (hid) {
          router.replace(`/session-result/${resultId}?hid=${encodeURIComponent(String(hid))}`);
        } else {
          router.replace(`/session-result/${resultId}`);
        }
      } else {
        router.back();
      }
    } catch (e) {
      console.error("❌ finishSession:", e);
      router.back();
    }
  };

  const handlePauseResume = () => {
    if (!hasStarted) return;
    if (finishedRef.current) return;

    if (isPaused) {
      try {
        if (Platform.OS === "web" && webAudioRef.current) {
          webAudioRef.current.play().catch(() => {});
        } else {
          player.play();
        }
      } catch (_e) {}

      try {
        const ps = pauseStartedAtRef.current;
        if (typeof ps === "number") {
          pausedAccumMsRef.current =
            (pausedAccumMsRef.current || 0) + (Date.now() - ps);
          pauseStartedAtRef.current = null;
        }
      } catch (_e) {}

      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(intervalRef.current);
              finishSession();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }

      isPausedRef.current = false;
      setIsPaused(false);
      startBreathingForCurrentSession();
      return;
    }

    try {
      if (Platform.OS === "web" && webAudioRef.current) {
        webAudioRef.current.pause && webAudioRef.current.pause();
      } else {
        player.pause();
      }
    } catch (_e) {}

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      if (!pauseStartedAtRef.current) pauseStartedAtRef.current = Date.now();
    } catch (_e) {}
    isPausedRef.current = true;
    stopBreathing();

    setIsPaused(true);
  };

  const handleCancel = () => {
    Alert.alert(t("run_alert_abort_title"), t("run_alert_abort_msg"), [
      { text: t("run_alert_no"), style: "cancel" },
      {
        text: t("run_alert_yes"),
        style: "destructive",
        onPress: async () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          try {
            if (Platform.OS === "web" && webAudioRef.current) {
              webAudioRef.current.pause();
            } else {
              player.pause();
            }
          } catch (_e) {}

          if (usedCredit) setUsedCredit(false);
          router.back();
        },
      },
    ]);
  };

  if (!fontsLoaded || !isReady) {
    return <View style={{ flex: 1, backgroundColor: colors.primary }} />;
  }

  const safeDuration = clamp(sessionDurationSec || 60, 60, 600);
  const showCircle = !isLifetime || safeDuration <= 60;
  const showCountdownOnly = isLifetime && safeDuration > 60;

  const canPressStart =
    isReady &&
    disclaimerAccepted &&
    !preStartRunningRef.current &&
    !preStartVisible &&
    !hasStarted;

  const DOTS = 60;
  const outerRadius = 140;
  const dotSize = 7;
  const dotRadius = dotSize / 2;

  // ── Atemzyklus: 5s ein / 5s aus = 10s Zyklus, 6 Zyklen in 60s
  // Letzte 5 Sekunden (timeLeft <= 5) sind IMMER Ausatmen
  const BREATH_CYCLE = 10;
  const INHALE_DUR   = 5;
  const isInhalePhase = (() => {
    if (!hasStarted || isPaused) return false;
    if (timeLeft <= 5) return false; // letzte 5 Sek. immer Ausatmen
    const elapsed = sessionDurationSec - timeLeft;
    const posInCycle = elapsed % BREATH_CYCLE;
    return posInCycle < INHALE_DUR;
  })();

  let dots = [];

  if (showCircle) {
    const remainingDots = hasStarted ? clamp(timeLeft, 0, DOTS) : DOTS;

    for (let i = 0; i < DOTS; i++) {
      const angle = -((i / DOTS) * Math.PI * 2) - Math.PI / 2;

      const x = outerRadius + outerRadius * Math.cos(angle);
      const y = outerRadius + outerRadius * Math.sin(angle);

      const active = i < remainingDots;

      // Beim Einatmen: Dots voll leuchtend; beim Ausatmen: sanfter
      const activeColor = isInhalePhase
        ? "rgba(255,255,255,1.0)"
        : "rgba(255,255,255,0.72)";

      dots.push(
        <View
          key={i}
          style={{
            position: "absolute",
            left: x - dotRadius,
            top: y - dotRadius,
            width: dotSize,
            height: dotSize,
            borderRadius: dotRadius,
            backgroundColor: active
              ? activeColor
              : "rgba(255,255,255,0.20)",
          }}
        />
      );
    }
  }

  const stopAllAudio = async () => {
    try {
      if (Platform.OS === "web" && webAudioRef.current) {
        try {
          webAudioRef.current.pause();
          webAudioRef.current.currentTime = 0;
        } catch (_e) {}
      } else {
        try {
          player.pause();
        } catch (_e) {}
      }
    } catch (_e) {}
  };

  const abortSession = async () => {
    finishedRef.current = true;

    preStartRunningRef.current = false;
    clearPreStartTimers();
    setPreStartVisible(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      pulseLoopRef.current && pulseLoopRef.current.stop && pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    } catch (_e) {}
    try {
      breatheLoopRef.current && breatheLoopRef.current.stop && breatheLoopRef.current.stop();
      breatheLoopRef.current = null;
    } catch (_e) {}

    stopBreathing();
    await stopAllAudio();

    setIsPaused(false);
    setShowExitConfirm(false);

    try {
      const entryId = historyEntryIdRef.current;
      if (entryId) {
        const planned = clamp(
          sessionPlannedDurationSecRef.current || sessionDurationSec || 60,
          1,
          36000
        );
        const elapsed = clamp(
          planned - (typeof timeLeft === "number" ? timeLeft : 0),
          0,
          planned
        );
        await updateSessionHistoryEntry(entryId, {
          endedAt: Date.now(),
          status: "aborted",
          elapsedSec: elapsed,
          durationSec: elapsed,
        });
        // Grace period: aborted within 5s → refund session count
        if (elapsed < 5) {
          try { await decrementSessionCountToday(); } catch (_) {}
        }
      }
    } catch (_e) {}

    if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null; }
    router.back();
  };

  const handleExitPress = () => {
    if (preStartVisible || preStartRunningRef.current) {
      abortSession();
      return;
    }
    setShowExitConfirm(true);
  };

  const renderExitConfirm = () => {
    if (!showExitConfirm) return null;

    return (
      <Modal transparent animationType="fade" visible={showExitConfirm}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.62)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#141414",
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              {t("run_alert_abort_title")}
            </Text>
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 14,
                color: "rgba(255,255,255,0.78)",
                lineHeight: 20,
                marginBottom: 14,
              }}
            >
              {t("run_alert_abort_msg_detail")}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowExitConfirm(false)}
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 14,
                    color: onBgSub,
                  }}
                >
                  {t("run_abort_continue")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={abortSession}
                activeOpacity={0.9}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,71,87,0.18)",
                  borderWidth: 1,
                  borderColor: "rgba(255,71,87,0.35)",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 14,
                    color: "#FF4757",
                  }}
                >
                  {t("run_alert_yes")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDisclaimer = () => {
    if (disclaimerAccepted) return null;

    return (
      <Modal
        visible={!disclaimerAccepted}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.background,
              borderRadius: 22,
              padding: 18,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 16,
                color: colors.text,
                marginBottom: 10,
              }}
            >
              {t("run_disclaimer_title")}
            </Text>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 13,
                color: colors.text,
                opacity: 0.78,
                lineHeight: 18,
                marginBottom: 12,
              }}
            >
              {t("run_disclaimer_text")}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setDisclaimerAccepted(true);
                setDisclaimerShown(true).catch(() => {});
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 14,
                  color: "#fff",
                }}
              >
                {t("run_guide_understood")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ✅ FINALER TEXT (mit Countdown) – FIXED (RN-safe)
  const renderHowItWorks = () => {
    const baseText = {
      fontFamily: "Montserrat_400Regular",
      fontSize: 14,
      color: colors.text,
      opacity: 0.82,
      lineHeight: 20,
    };

    const bold = {
      fontFamily: "Montserrat_600SemiBold",
      opacity: 1,
      color: colors.text,
    };

    const item = {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    };

    const num = {
      width: 20,
      ...baseText,
      opacity: 0.72,
    };

    const textWrap = {
      flex: 1,
    };

    return (
      <Modal
        visible={showHowItWorks}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowHowItWorks(false);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.62)",
            justifyContent: "center",
            alignItems: "center",
            padding: 22,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.background,
              borderRadius: 26,
              padding: 18,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.08)",
              shadowColor: "#000",
              shadowOpacity: 0.16,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 12 },
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 17,
                color: colors.text,
                marginBottom: 12,
              }}
            >
              {t("run_guide_title")}
            </Text>

            <View style={{ gap: 10 }}>
              <View style={item}>
                <Text style={num}>0)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    {t("run_guide_0")}
                  </Text>
                </View>
              </View>

              <View style={item}>
                <Text style={num}>1)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    {t("run_guide_1")}
                  </Text>
                </View>
              </View>

              <View style={item}>
                <Text style={num}>2)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    {t("run_guide_2_pre")}<Text style={bold}>{t("run_breath_label_inhale")}</Text> / <Text style={bold}>{t("run_breath_label_exhale")}</Text>{t("run_guide_2_mid")}
                  </Text>
                </View>
              </View>

              <View style={item}>
                <Text style={num}>3)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    {t("run_guide_3_pre")}<Text style={bold}>Ring</Text>{t("run_guide_3_mid")}
                  </Text>
                </View>
              </View>

              <View style={item}>
                <Text style={num}>4)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    {t("run_guide_4_pre")}<Text style={bold}>Timer (mm:ss)</Text>.
                  </Text>
                </View>
              </View>

              <View style={item}>
                <Text style={num}>5)</Text>
                <View style={textWrap}>
                  <Text style={baseText}>
                    <Text style={bold}>⏸ Pause</Text><Text>{t("run_guide_5_pre")}</Text><Text style={bold}>▶︎ Play</Text><Text>{t("run_guide_5_mid")}</Text>
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 16,
                backgroundColor: "rgba(255,180,0,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,180,0,0.25)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 13,
                  color: colors.text,
                  lineHeight: 18,
                }}
              >
                {t("run_guide_warning")}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setShowHowItWorks(false);

                if (pendingStartRef.current) {
                  pendingStartRef.current = false;
                  requestAnimationFrame(() => {
                    startSessionWithCountdown();
                  });
                }
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 12,
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 14,
                  color: "#fff",
                  letterSpacing: 0.2,
                }}
              >
                {t("run_guide_understood")}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderPreStartOverlay = () => {
    if (!preStartVisible) return null;

    const headline = preStartPhase === "go" ? t("run_prestart_go_headline") : t("run_prestart_ready_headline");
    const subline = preStartPhase === "go" ? t("run_prestart_go_sub") : t("run_prestart_ready_sub");

    const bubbleScale = Animated.multiply(centerScale, pulseScale);

    return (
      <Modal visible transparent animationType="none" onRequestClose={() => {}}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            opacity: overlayOpacity,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.18)",
            }}
          />

          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                transform: [{ translateY: COUNTDOWN_Y_OFFSET }],
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 360,
                  height: 360,
                  borderRadius: 180,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  opacity: ringOpacity,
                }}
              />

              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: 300,
                  height: 300,
                  borderRadius: 150,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                  opacity: ringOpacity,
                }}
              />

              <Animated.View
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.16)",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 22,
                  opacity: centerOpacity,
                  transform: [{ scale: bubbleScale }],
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 12 },
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_500Medium",
                    fontSize: 13,
                    color: "rgba(255,255,255,0.72)",
                    textAlign: "center",
                    marginBottom: 10,
                    letterSpacing: 0.3,
                  }}
                >
                  {headline}
                </Text>

                {preStartPhase === "go" ? (
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 44,
                      color: "#fff",
                      letterSpacing: 1.2,
                      marginTop: 2,
                    }}
                  >
                    GO
                  </Text>
                ) : (
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 92,
                      color: "#fff",
                      lineHeight: 96,
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {preStartCount}
                  </Text>
                )}

                <Text
                  style={{
                    fontFamily: "Montserrat_400Regular",
                    fontSize: 12.5,
                    color: "rgba(255,255,255,0.58)",
                    textAlign: "center",
                    marginTop: 12,
                    lineHeight: 16,
                  }}
                >
                  {subline}
                </Text>
              </Animated.View>
            </View>
          </View>
        </Animated.View>
      </Modal>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: sessionBgColor }}>
      <StatusBar style="light" />

      {renderPreStartOverlay()}

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "flex-end",
            marginBottom: 60,
            height: 370,
          }}
        >
          {/* Breath-Cue — always in flow but opacity-toggled, fixed height reserves space */}
          <View style={{ position: "absolute", top: -80, width: "100%", alignItems: "center" }}>
            {isBreathing ? (
              <View style={{ opacity: showBreathText ? 1 : 0, width: 320, maxWidth: "92%", paddingHorizontal: 18, paddingBottom: 14 }}>
                <Text style={addReadableShadow({ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: isBrightBg ? "#fff" : "rgba(255,255,255,0.92)", textAlign: "center", marginBottom: 6 })}>
                  {(breathingExercise && breathingExercise.title) || t("breathing_ex")}
                </Text>
                <Text style={addReadableShadow({ fontFamily: "Montserrat_600SemiBold", fontSize: hasStarted ? 24 : 18, color: onBgText, textAlign: "center", marginBottom: 8, letterSpacing: 0.3 })}>
                  {(hasStarted && !isBreathing && timeLeft <= 5) ? t("run_breath_exhale") : breathCue}
                </Text>
                {!!breathSubCue && <Text style={addReadableShadow({ fontFamily: "Montserrat_400Regular", fontSize: 13, color: onBgMuted, textAlign: "center", lineHeight: 18 })}>{breathSubCue}</Text>}
              </View>
            ) : (
              <View style={{ opacity: showBreathText ? 1 : 0, width: 320, maxWidth: "92%", paddingHorizontal: 18, paddingBottom: 14 }}>
                <Text style={addReadableShadow({ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: onBgSub, textAlign: "center", marginBottom: 6 })}>
                  {isSOS ? "SOS" : effectiveModeData.label}
                </Text>
                <Text style={addReadableShadow({ fontFamily: "Montserrat_600SemiBold", fontSize: 26, color: onBgText, textAlign: "center", marginBottom: 6, letterSpacing: 0.3 })}>
                  {(hasStarted && timeLeft <= 5) ? t("run_breath_exhale") : breathCue}
                </Text>
                {!!breathSubCue && <Text style={addReadableShadow({ fontFamily: "Montserrat_400Regular", fontSize: 13, color: onBgMuted, textAlign: "center" })}>{breathSubCue}</Text>}
              </View>
            )}
          </View>

          <View style={{ position: "relative", width: 280, height: 280 }}>
            {showCircle ? dots : null}

            <View
              style={{
                position: "absolute",
                top: 30,
                left: 30,
                width: 220,
                height: 220,
              }}
            >
              <Animated.View
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  backgroundColor: innerCircleBg,
                  borderWidth: 1,
                  borderColor: innerCircleBorder,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 24,
                  transform: [{ scale: breatheAnim }],
                }}
              >
                <Text style={{ fontSize: 32, marginBottom: 8 }}>
                  {isSOS ? "🆘" : effectiveModeData.icon}
                </Text>

                {showCountdownOnly && (
                  <Text
                    style={addReadableShadow({
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 28,
                      color: onBgText,
                      marginBottom: 10,
                      letterSpacing: 1,
                    })}
                  >
                    {fmtMMSS(timeLeft)}
                  </Text>
                )}

                <Text
                  style={addReadableShadow({
                    fontFamily: "Montserrat_500Medium",
                    fontSize: 14,
                    color: onBgSub,
                    textAlign: "center",
                    marginBottom: 16,
                    opacity: showCountdownOnly ? 0.95 : 1,
                  })}
                >
                  {displayQuote}
                </Text>

                {!hasStarted && (
                  <TouchableOpacity
                    disabled={!canPressStart}
                    onPress={isSOS ? () => startSOSInstant(true) : startSessionWithCountdown}
                    style={{
                      marginTop: 4,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: "#fff",
                      opacity: canPressStart ? 1 : 0.5,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Montserrat_600SemiBold",
                        fontSize: 14,
                        color: "#1a1a2e",
                      }}
                    >
                      {isSOS ? t("run_cta_sos") : t("run_cta_start")}
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>
          </View>
        </View>

        {!isBreathing && showBreathText && (
          <Text
            style={addReadableShadow({
              fontFamily: "Montserrat_400Regular",
              fontSize: 14,
              color: isBrightBg ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.86)",
              marginBottom: 4,
              textAlign: "center",
            })}
          >
            {hasStarted
              ? isSOS
                ? t("run_cue_sos_started")
                : t("run_cue_started")
              : isSOS
              ? t("run_cue_sos_idle")
              : t("run_cue_idle")}
          </Text>
        )}

        {showBreathText && (
          <Text
            style={addReadableShadow({
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 16,
              color: onBgSub,
              opacity: isBrightBg ? 1 : 0.9,
            })}
          >
            {isSOS
              ? "SOS"
              : isBreathing
              ? (breathingExercise && breathingExercise.semanticLabel) || t("breathing_ex")
              : effectiveModeData.label}
          </Text>
        )}
      </View>

      <View
        style={{
          paddingHorizontal: 32,
          paddingBottom: insets.bottom + 32,
          flexDirection: "row",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (_e) {}
            handleExitPress();
          }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            justifyContent: "center",
            alignItems: "center",
          }}
          accessibilityLabel="Session beenden"
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>

        {!isSOS && (
          <TouchableOpacity
            onPress={() => setShowHowItWorks(true)}
            style={{
              width: 52,
              height: 52,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              justifyContent: "center",
              alignItems: "center",
            }}
            accessibilityLabel="Anleitung"
          >
            <HelpCircle size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Toggle: Atemtext ein-/ausblenden */}
        <TouchableOpacity
          onPress={() => setShowBreathText((v) => !v)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: showBreathText
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: showBreathText
              ? "rgba(255,255,255,0.28)"
              : "rgba(255,255,255,0.12)",
            justifyContent: "center",
            alignItems: "center",
          }}
          accessibilityLabel={showBreathText ? t("run_breath_hide") : t("run_breath_show")}
        >
          {showBreathText
            ? <Eye size={20} color="#fff" />
            : <EyeOff size={20} color="rgba(255,255,255,0.55)" />
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePauseResume}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            justifyContent: "center",
            alignItems: "center",
          }}
          accessibilityLabel={isPaused ? t("run_resume") : t("run_pause")}
        >
          {isPaused ? <Play size={20} color="#fff" /> : <Pause size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      {renderExitConfirm()}
      {renderDisclaimer()}
      {renderHowItWorks()}
    </View>
  );
}