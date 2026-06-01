import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  DeviceEventEmitter,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
  Image,
  Linking,
  Share,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { router, useFocusEffect } from "expo-router";
import { X, ChevronRight } from "lucide-react-native";
import MinutesBubble from "@/components/MinutesBubble";
import UpgradePopup from "@/components/UpgradePopup";

import { useStillMindTheme } from "@/utils/stillmind-theme";
import {
  getSettings,
  saveSettings,
  clearAllData,
  getUserPlan,
  getReminderEnabled,
  resetOnboarding,
  getQuotePushEnabled,
  setQuotePushEnabled,
} from "@/utils/storage";
import {
  disableIntervalReminder,
  enableIntervalReminder,
  checkNotificationPermissions,
  requestNotificationPermissions,
  enableQuotePush,
  disableQuotePush,
} from "@/utils/notifications";
import { useI18n, SUPPORTED_LANGUAGES, setLanguage } from "@/utils/i18n";
import Purchases from "react-native-purchases";
import * as StoreReview from "expo-store-review";
import { writeMindfulSession, requestHealthPermissions } from "@/utils/health";

const STILLMIND_LOGO = require("../../../../assets/brand/stillmind-logo-transparent.png");

/* =========================
   Color helpers (no deps)
   ========================= */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const rgbToHex = (r, g, b) => {
  const to = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const h = hex.replace("#", "").trim();
  if (![3, 6].includes(h.length)) return null;
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const hsvToRgb = (h, s, v) => {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const vv = clamp(v, 0, 1);

  const c = vv * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vv - c;

  let rp = 0,
    gp = 0,
    bp = 0;

  if (hh < 60) {
    rp = c;
    gp = x;
    bp = 0;
  } else if (hh < 120) {
    rp = x;
    gp = c;
    bp = 0;
  } else if (hh < 180) {
    rp = 0;
    gp = c;
    bp = x;
  } else if (hh < 240) {
    rp = 0;
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    gp = 0;
    bp = c;
  } else {
    rp = c;
    gp = 0;
    bp = x;
  }

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
};

const rgbToHsv = (r, g, b) => {
  const rr = clamp(r / 255, 0, 1);
  const gg = clamp(g / 255, 0, 1);
  const bb = clamp(b / 255, 0, 1);

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;

  let h = 0;
  if (d === 0) h = 0;
  else if (max === rr) h = 60 * (((gg - bb) / d) % 6);
  else if (max === gg) h = 60 * ((bb - rr) / d + 2);
  else h = 60 * ((rr - gg) / d + 4);

  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
};

/* =========================
   Small UI primitives
   ========================= */
const Card = ({ colors, children }) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    {children}
  </View>
);

const SectionTitle = ({ colors, children }) => (
  <Text
    style={{
      fontFamily: "Montserrat_600SemiBold",
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 10,
    }}
  >
    {children}
  </Text>
);

const Row = ({ colors, left, right, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
    }}
    activeOpacity={0.85}
  >
    <Text
      style={{
        fontFamily: "Montserrat_500Medium",
        fontSize: 14,
        color: colors.text,
      }}
    >
      {left}
    </Text>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {right}
      <ChevronRight size={18} color={colors.textSecondary} />
    </View>
  </TouchableOpacity>
);

/* =========================
   Tap+Drag Slider (no deps)
   ========================= */
function TapSlider({
  colors,
  value,
  onChange,
  steps = 30,
  height = 14,
  renderSegments, // (i, steps) => color
}) {
  const [w, setW] = useState(0);

  const setFromX = useCallback(
    (x) => {
      if (!w) return;
      const t = clamp(x / w, 0, 1);
      onChange(t);
    },
    [w, onChange]
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => setFromX(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => setFromX(evt.nativeEvent.locationX),
      onPanResponderRelease: (evt) => setFromX(evt.nativeEvent.locationX),
    })
  ).current;

  const knobX = w ? clamp(value, 0, 1) * w : 0;

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceVariant,
      }}
      {...pan.panHandlers}
    >
      <View style={{ flexDirection: "row", height: "100%" }}>
        {Array.from({ length: steps }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: renderSegments
                ? renderSegments(i, steps)
                : "transparent",
            }}
          />
        ))}
      </View>

      {/* knob */}
      <View
        style={{
          position: "absolute",
          left: knobX - 10,
          top: -4,
          width: 20,
          height: height + 8,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: colors.primary,
          backgroundColor: "rgba(0,0,0,0.10)",
        }}
        pointerEvents="none"
      />
    </View>
  );
}

/* =========================
   Settings Screen
   ========================= */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();

  const storeLabel = Platform.OS === "android" ? "Google Play Store" : "App Store";
  const { t, lang } = useI18n();
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [offboardVisible, setOffboardVisible] = useState(false);
  const [offboardStep, setOffboardStep] = useState(1); // 1=reasons, 2=retention
  const [offboardReason, setOffboardReason] = useState(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [quotePushEnabled, setQuotePushEnabledState] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [subModal, setSubModal] = useState(null);
  const [healthEnabled, setHealthEnabled] = useState(false);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [plan, setPlan] = useState("free");

  const [themePrimary, setThemePrimary] = useState(null);
  const [themeIntensity, setThemeIntensity] = useState(1);
  const [customPalette, setCustomPalette] = useState([]);

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Custom color picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("gitter"); // gitter | spektrum | regler
  const [pickerName, setPickerName] = useState("");

  // Picker color (HSV + RGB)
  const [hue, setHue] = useState(25);
  const [sat, setSat] = useState(0.25);
  const [val, setVal] = useState(0.8);
  const [rIn, setRIn] = useState("0");
  const [gIn, setGIn] = useState("0");
  const [bIn, setBIn] = useState("0");

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const load = useCallback(async () => {
    const s = (await getSettings()) || {};
    setSoundEnabled(
      typeof s.soundEnabled === "boolean" ? s.soundEnabled : true
    );
    setVibrationEnabled(
      typeof s.vibrationEnabled === "boolean" ? s.vibrationEnabled : true
    );

    setThemePrimary(typeof s.themePrimary === "string" ? s.themePrimary : null);
    setThemeIntensity(
      typeof s.themeIntensity === "number" && Number.isFinite(s.themeIntensity)
        ? clamp(s.themeIntensity, 0, 1)
        : 1
    );

    setCustomPalette(
      Array.isArray(s.themeCustomPalette)
        ? s.themeCustomPalette
            .filter(
              (x) =>
                x &&
                typeof x === "object" &&
                typeof x.color === "string" &&
                x.color.startsWith("#")
            )
            .slice(0, 12)
        : []
    );

    const userPlan = await getUserPlan();
    setPlan(userPlan);

    const remEnabled = await getReminderEnabled();
    setReminderEnabled(!!remEnabled);
    const qEnabled = await getQuotePushEnabled();
    setQuotePushEnabledState(!!qEnabled);
    try {
      const storageMod = require("@react-native-async-storage/async-storage");
      const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
      const hEnabled = await AsyncStorage.getItem("stillmind:health_enabled");
      setHealthEnabled(hEnabled === "true");
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("stillmind:planChanged", () =>
      load()
    );
    return () => {
      try {
        sub && sub.remove && sub.remove();
      } catch (_e) {}
    };
  }, [load]);

  const persistTheme = useCallback(
    async (nextPrimary, nextIntensity, nextCustomPalette) => {
      const current = (await getSettings()) || {};
      const next = { ...current };

      if (typeof nextPrimary === "string" && nextPrimary.length > 0)
        next.themePrimary = nextPrimary;
      else delete next.themePrimary;

      if (typeof nextIntensity === "number" && Number.isFinite(nextIntensity)) {
        next.themeIntensity = clamp(nextIntensity, 0, 1);
      } else {
        delete next.themeIntensity;
      }

      if (Array.isArray(nextCustomPalette))
        next.themeCustomPalette = nextCustomPalette.slice(0, 12);
      else delete next.themeCustomPalette;

      // alte Sekundärreste entfernen, falls noch vorhanden
      if ("themeSecondary" in next) delete next.themeSecondary;

      await saveSettings(next);
      try {
        DeviceEventEmitter.emit("stillmind:themeChanged");
      } catch (_e) {}
    },
    []
  );

  const onToggleSound = useCallback(async (value) => {
    setSoundEnabled(value);
    const current = (await getSettings()) || {};
    await saveSettings({ ...current, soundEnabled: value });
  }, []);

  const onToggleReminder = useCallback(async (val) => {
    try {
      if (val) {
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) {
          const granted = await requestNotificationPermissions();
          if (!granted) return;
        }
        await enableIntervalReminder();
      } else {
        await disableIntervalReminder();
      }
      setReminderEnabled(val);
    } catch (_) {}
  }, []);

  const onToggleHealth = useCallback(async (val) => {
    try {
      const storageMod = require("@react-native-async-storage/async-storage");
      const AsyncStorage = storageMod ? (storageMod.default ?? storageMod) : null;
      if (val) {
        setHealthEnabled(true);
        const { InteractionManager } = require("react-native");
        await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));
        const result = await requestHealthPermissions();
        if (!result || !result.success) {
          setHealthEnabled(false);
          await AsyncStorage.setItem("stillmind:health_enabled", "false");
          Alert.alert(
            t("health_permission_denied_title") || "Zugriff verweigert",
            t("health_permission_denied_msg") || "Bitte erlaube den Zugriff auf Apple Health unter Einstellungen → Datenschutz → Health → StillMind.",
            [{ text: "OK" }]
          );
          return;
        }
        await AsyncStorage.setItem("stillmind:health_enabled", "true");
      } else {
        setHealthEnabled(false);
        await AsyncStorage.setItem("stillmind:health_enabled", "false");
      }
    } catch (_) {}
  }, []);

  const onToggleQuotePush = useCallback(async (val) => {
    try {
      if (val) {
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) {
          const granted = await requestNotificationPermissions();
          if (!granted) return;
        }
        await enableQuotePush();
      } else {
        await disableQuotePush();
      }
      await setQuotePushEnabled(val);
      setQuotePushEnabledState(val);
    } catch (_) {}
  }, []);

  const onToggleVibration = useCallback(async (value) => {
    setVibrationEnabled(value);
    const current = (await getSettings()) || {};
    await saveSettings({ ...current, vibrationEnabled: value });
  }, []);

  const INTENSITY_PRESETS = useMemo(
    () => [
      { label: "60%", value: 0.6 },
      { label: "75%", value: 0.75 },
      { label: "85%", value: 0.85 },
      { label: "95%", value: 0.95 },
      { label: "100%", value: 1 },
    ],
    []
  );

  const selectIntensity = useCallback(
    async (value) => {
      const v = clamp(value, 0, 1);
      setThemeIntensity(v);
      await persistTheme(themePrimary, v, customPalette);
    },
    [persistTheme, themePrimary, customPalette]
  );

  const selectPrimary = useCallback(
    async (hexOrNull) => {
      setThemePrimary(hexOrNull);
      await persistTheme(hexOrNull, themeIntensity, customPalette);
    },
    [persistTheme, themeIntensity, customPalette]
  );

  // ✅ Standard IMMER beige
  const STANDARD_BEIGE = "#C9BCA8";

  const PALETTE = useMemo(() => {
    const base = [
      { id: null, name: "Standard", color: STANDARD_BEIGE }, // sichtbar beige
      { id: "#C9BCA8", name: "Beige", color: "#C9BCA8" },
      { id: "#E5C896", name: "Gold", color: "#E5C896" },
      { id: "#A8C4A0", name: "Sage", color: "#A8C4A0" },
      { id: "#D4E5E8", name: "Aqua", color: "#D4E5E8" },
      { id: "#D0C4DC", name: "Lilac", color: "#D0C4DC" },
      { id: "#E8C8C8", name: "Rose", color: "#E8C8C8" },
      { id: "#D4B5A8", name: "Terra", color: "#D4B5A8" },
      { id: "#DDD4C5", name: "Sand", color: "#DDD4C5" },
    ];

    const custom = (customPalette || []).map((x, idx) => ({
      id: x.color,
      name: x.name || `Custom ${idx + 1}`,
      color: x.color,
      isCustom: true,
    }));

    const seen = new Set(base.map((b) => b.id || "__STANDARD__"));
    const merged = [...base];

    for (const c of custom) {
      if (!(c && c.id)) continue;
      const key = c.id.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }

    return merged;
  }, [customPalette]);

  const showFarbschema = plan === "lifetime";
  const [upgradeReason, setUpgradeReason] = useState("color_scheme");
  const [upgradePopupVisible, setUpgradePopupVisible] = useState(false);
  const openLockedPopup = (reason) => { setUpgradeReason(reason); setUpgradePopupVisible(true); };

  // ===== Custom picker computed color =====
  const pickerRgb = useMemo(() => hsvToRgb(hue, sat, val), [hue, sat, val]);
  const pickerHex = useMemo(
    () => rgbToHex(pickerRgb.r, pickerRgb.g, pickerRgb.b),
    [pickerRgb]
  );

  const syncRgbInputsFromHSV = useCallback(() => {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    setRIn(String(clamp(Math.round(r), 0, 255)));
    setGIn(String(clamp(Math.round(g), 0, 255)));
    setBIn(String(clamp(Math.round(b), 0, 255)));
  }, [hue, sat, val]);

  useEffect(() => {
    // beim Öffnen oder tabwechsel: Inputs passend setzen
    if (pickerOpen) syncRgbInputsFromHSV();
  }, [pickerOpen, pickerTab, syncRgbInputsFromHSV]);

  const applyRgbInputs = useCallback(() => {
    const r = clamp(parseInt(rIn || "0", 10) || 0, 0, 255);
    const g = clamp(parseInt(gIn || "0", 10) || 0, 0, 255);
    const b = clamp(parseInt(bIn || "0", 10) || 0, 0, 255);
    const hsv = rgbToHsv(r, g, b);
    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);
  }, [rIn, gIn, bIn]);

  const removeCustomColor = useCallback(
    async (hex) => {
      const nextList = (customPalette || [])
        .filter(
          (x) => ((x && x.color) || "").toUpperCase() !== (hex || "").toUpperCase()
        )
        .slice(0, 12);

      setCustomPalette(nextList);
      await persistTheme(themePrimary, themeIntensity, nextList);
    },
    [customPalette, persistTheme, themePrimary, themeIntensity]
  );

  const addCustomFromPicker = useCallback(async () => {
    const name = (pickerName || "").trim().slice(0, 18);
    const hex = pickerHex;

    const nextList = [
      { color: hex, name: name || "Custom" },
      ...(customPalette || []),
    ]
      .filter((x, idx, arr) => {
        if (!(x && x.color)) return false;
        const up = x.color.toUpperCase();
        return (
          arr.findIndex((y) => ((y && y.color) || "").toUpperCase() === up) === idx
        );
      })
      .slice(0, 12);

    setCustomPalette(nextList);
    await persistTheme(themePrimary, themeIntensity, nextList);

    setPickerName("");
    setPickerOpen(false);

    // zurück in Farbschema
    setTimeout(() => setPaletteOpen(true), 150);
  }, [
    pickerName,
    pickerHex,
    customPalette,
    persistTheme,
    themePrimary,
    themeIntensity,
  ]);

  // ===== Grid colors like iOS (approx) =====
  const gridRows = useMemo(() => {
    // 10 columns x 8 rows = iOS-like feeling
    const cols = 10;
    const rows = 8;

    // top row grayscale (white -> black)
    const grays = Array.from({ length: cols }).map((_, i) => {
      const t = i / (cols - 1);
      const v = 255 * (1 - t);
      return rgbToHex(v, v, v);
    });

    // color rows: vary hue across columns, and saturation/value across rows
    const colorRows = Array.from({ length: rows }).map((_, rIdx) => {
      // go from vivid (top) to pastel (bottom)
      const v = 1 - rIdx * (0.55 / (rows - 1)); // 1 -> 0.45
      const s = 0.95 - rIdx * (0.45 / (rows - 1)); // 0.95 -> 0.50

      return Array.from({ length: cols }).map((__, cIdx) => {
        const h = (cIdx / cols) * 360; // wrap
        const { r, g, b } = hsvToRgb(h, s, v);
        return rgbToHex(r, g, b);
      });
    });

    return { grays, colorRows };
  }, []);

  const openPicker = useCallback(() => {
    // Palette modal schließen, dann Picker öffnen (Modal-Stack iOS safe)
    setPaletteOpen(false);

    // Startfarbe: aktuell gewählte Primärfarbe (oder Standard)
    const startHex = themePrimary || STANDARD_BEIGE;
    const rgb = hexToRgb(startHex) || { r: 201, g: 188, b: 168 };
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

    setHue(hsv.h);
    setSat(hsv.s);
    setVal(hsv.v);

    setPickerTab("gitter");
    setPickerName("");

    setTimeout(() => setPickerOpen(true), 160);
  }, [themePrimary]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: Logo links, MinutesBubble rechts */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image
            source={STILLMIND_LOGO}
            resizeMode="contain"
            style={{ width: 72, height: 72, opacity: 0.97 }}
          />
          <MinutesBubble floating={false} />
        </View>

        {/* Title (gleich wie Statistik/Bibliothek) */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              // gleiche Größe/Höhe wie die anderen Tabs
              fontSize: 40,
              lineHeight: 48,
              color: colors.text,
              marginBottom: 8,
            }}
          >
            {t("settings_title")}
          </Text>
          <Text
            style={{
              fontFamily: "Montserrat_400Regular",
              fontSize: 14,
              lineHeight: 18,
              color: colors.textMuted || colors.textSecondary,
            }}
          >
            {t("settings_sub_text")}
          </Text>
        </View>

        {/* ── Einstellungsmenü ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <TouchableOpacity onPress={() => setSubModal("general")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12 }}>
            <Text style={{ fontSize: 22, marginRight: 16 }}>⚙️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("einst_menu_general")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{t("sound") + " · " + t("vibration") + " · " + t("health_toggle_label") + " · " + t("language")}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSubModal("notifications")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12 }}>
            <Text style={{ fontSize: 22, marginRight: 16 }}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("einst_menu_notifications")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{t("reminders") + " · " + t("morgenimpuls_label")}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          {showFarbschema && (
            <TouchableOpacity onPress={() => setSubModal("premium")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12 }}>
              <Text style={{ fontSize: 22, marginRight: 16 }}>💎</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("einst_menu_premium")}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{t("color_scheme")}</Text>
              </View>
              <ChevronRight size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {!showFarbschema && (
            <TouchableOpacity onPress={() => openLockedPopup("color_scheme")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1, borderColor: "rgba(205,185,138,0.3)", backgroundColor: "rgba(205,185,138,0.07)", paddingVertical: 16, paddingHorizontal: 18, marginBottom: 12 }}>
              <Text style={{ fontSize: 22, marginRight: 16 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#CDB98A" }}>{t("einst_sub_premium")}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>{t("einst_lifetime_locked_sub")}</Text>
              </View>
              <ChevronRight size={18} color="rgba(205,185,138,0.5)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setSubModal("community")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 18, marginBottom: 12 }}>
            <Text style={{ fontSize: 22, marginRight: 16 }}>❤️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("einst_menu_community")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{"Instagram · TikTok · " + t("app_share") + " · " + t("app_rate")}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSubModal("info")} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 18, paddingHorizontal: 18 }}>
            <Text style={{ fontSize: 22, marginRight: 16 }}>ℹ️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("einst_menu_info")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{t("privacy") + " · " + t("imprint") + " · " + t("settings_data_section")}</Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Zitat ── */}
        <View style={{ paddingHorizontal: 28, paddingTop: 16, paddingBottom: 16, alignItems: "center" }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "rgba(201,188,168,0.88)", textAlign: "center", lineHeight: 24, letterSpacing: 0.3, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>
            {t("einst_quote")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "rgba(201,188,168,0.45)", marginTop: 10, letterSpacing: 3, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
            STILLMIND
          </Text>
        </View>

      </ScrollView>

      {/* Sub-Modal: Allgemein */}
      <Modal visible={subModal === "general"} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setSubModal(null)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("einst_sub_general")}</Text>
            </View>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionTitle colors={colors}>{t("einst_section_tones")}</SectionTitle>
              <Card colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.text }}>{t("sound")}</Text>
                  <Switch value={soundEnabled} onValueChange={onToggleSound} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.text }}>{t("vibration")}</Text>
                  <Switch value={vibrationEnabled} onValueChange={onToggleVibration} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.text }}>{t("health_toggle_label")}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t("health_toggle_sub")}</Text>
                  </View>
                  <Switch value={healthEnabled} onValueChange={onToggleHealth} />
                </View>
              </Card>
              <View style={{ height: 16 }} />
              <SectionTitle colors={colors}>{t("einst_section_language")}</SectionTitle>
              <Card colors={colors}>
                <Row colors={colors} left={t("language")} right={
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginRight: 4 }}>
                    {(SUPPORTED_LANGUAGES.find(l => l.code === lang) || {}).flag || "🌍"} {(SUPPORTED_LANGUAGES.find(l => l.code === lang) || {}).label || lang}
                  </Text>
                } onPress={() => { setSubModal(null); setTimeout(() => setLangModalOpen(true), 350); }} />
              </Card>

              <View style={{ height: 16 }} />
              <SectionTitle colors={colors}>Apple Watch</SectionTitle>
              <Card colors={colors}>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: "#FFFFFF", marginBottom: 8 }}>{t("watch_how_title")}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 18 }}>{t("watch_how_desc")}</Text>
                </View>
              </Card>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sub-Modal: Benachrichtigungen */}
      <Modal visible={subModal === "notifications"} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setSubModal(null)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("einst_sub_notifications")}</Text>
            </View>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionTitle colors={colors}>{t("einst_section_push")}</SectionTitle>
              <Card colors={colors}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.text }}>{t("reminders")}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t("reminders_sub")}</Text>
                  </View>
                  <Switch value={reminderEnabled} onValueChange={onToggleReminder} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                  <View style={{ flex: 1, marginRight: 16 }}>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.text }}>{t("morgenimpuls_label")}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t("morgenimpuls_sub")}</Text>
                  </View>
                  <Switch value={quotePushEnabled} onValueChange={onToggleQuotePush} />
                </View>

              </Card>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sub-Modal: Premium Life */}
      {showFarbschema && (
        <Modal visible={subModal === "premium"} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setSubModal(null)} />
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
              </View>
              <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("einst_sub_premium")}</Text>
              </View>
              <View style={{ paddingHorizontal: 24 }}>
                <SectionTitle colors={colors}>{t("einst_section_personal")}</SectionTitle>
                <Card colors={colors}>
                  <Row colors={colors} left={t("color_scheme")} right={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary }} />
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginRight: 4 }}>{t("customize")}</Text>
                    </View>
                  } onPress={() => { setSubModal(null); setTimeout(() => setPaletteOpen(true), 350); }} />
                </Card>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Sub-Modal: Community */}
      <Modal visible={subModal === "community"} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setSubModal(null)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("einst_sub_community")}</Text>
            </View>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionTitle colors={colors}>{t("einst_section_follow")}</SectionTitle>
              <Card colors={colors}>
                <Row colors={colors} left="Instagram" right={<Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginRight: 4 }}>@stillmind.app</Text>}
                  onPress={() => Linking.openURL("https://www.instagram.com/stillmind.app").catch(() => {})} />
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <Row colors={colors} left="TikTok" right={<Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginRight: 4 }}>@stillmind.app</Text>}
                  onPress={() => Linking.openURL("https://www.tiktok.com/@stillmind.app").catch(() => {})} />
              </Card>
              <View style={{ height: 16 }} />
              <SectionTitle colors={colors}>{t("einst_section_share")}</SectionTitle>
              <Card colors={colors}>
                <Row colors={colors} left={t("app_share") + " 🔗"} right={<View />} onPress={async () => {
                  try { await Share.share({ message: t("share_msg"), title: t("share_title") }); } catch (_) {}
                }} />
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <Row colors={colors} left={t("app_rate") + " ⭐"} right={<View />} onPress={() => { setSubModal(null); setTimeout(() => setReviewModalVisible(true), 350); }} />
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <Row colors={colors} left={t("feedback")} right={<View />} onPress={() => Linking.openURL("mailto:support@appstillmind.com?subject=StillMind%20Feedback").catch(() => {})} />
              </Card>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sub-Modal: Info & Rechtliches */}
      <Modal visible={subModal === "info"} transparent animationType="slide" onRequestClose={() => setSubModal(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setSubModal(null)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("einst_sub_info")}</Text>
            </View>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionTitle colors={colors}>{t("einst_section_legal")}</SectionTitle>
              <Card colors={colors}>
                <Row colors={colors} left={t("imprint")} right={<View />} onPress={() => { setSubModal(null); setTimeout(() => router.push("/legal/impressum"), 350); }} />
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <Row colors={colors} left={t("privacy")} right={<View />} onPress={() => { setSubModal(null); setTimeout(() => router.push("/legal/datenschutz"), 350); }} />
                <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                <Row colors={colors} left={t("liability")} right={<View />} onPress={() => { setSubModal(null); setTimeout(() => router.push("/legal/haftung"), 350); }} />
              </Card>
              <View style={{ height: 16 }} />
              <SectionTitle colors={colors}>{t("einst_section_data")}</SectionTitle>
              <Card colors={colors}>
                <TouchableOpacity onPress={() => Alert.alert(t("delete_account_title"), t("delete_account_msg").replace(/\{\{store\}\}/g, storeLabel), [
                  { text: t("cancel"), style: "cancel" },
                  { text: t("delete_account_btn"), style: "destructive", onPress: async () => {
                    await clearAllData();
                    try { await Purchases.logOut(); } catch (_) {}
                    try { DeviceEventEmitter.emit("stillmind:themeChanged"); DeviceEventEmitter.emit("stillmind:planChanged"); } catch (_) {}
                    setSubModal(null); load();
                  }},
                ])} style={{ padding: 16 }} activeOpacity={0.85}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#FF5A5A" }}>{t("delete_account_label")}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t("delete_account_sub").replace(/\{\{store\}\}/g, storeLabel)}</Text>
                </TouchableOpacity>
                {plan === "pro" && (
                  <React.Fragment>
                    <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
                    <TouchableOpacity onPress={() => { setSubModal(null); setTimeout(() => { setOffboardStep(1); setOffboardReason(null); setOffboardVisible(true); }, 350); }} activeOpacity={0.85} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#FF5A5A" }}>{t("offboard_cancel_row_title")}</Text>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{t("offboard_cancel_row_sub").replace(/\{\{store\}\}/g, storeLabel)}</Text>
                      </View>
                      <ChevronRight size={18} color="rgba(255,90,90,0.5)" />
                    </TouchableOpacity>
                  </React.Fragment>
                )}
              </Card>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pre-Review Modal */}
      <Modal transparent visible={reviewModalVisible} animationType="fade" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: colors.surface, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, textAlign: "center", marginBottom: 10 }}>{t("pre_review_title")}</Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: "center", marginBottom: 22 }}>
              {t("pre_review_body")}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.surfaceVariant, alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>{t("pre_review_dismiss")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                setReviewModalVisible(false);
                try {
                  const can = await StoreReview.hasAction();
                  if (can) await StoreReview.requestReview();
                  else Linking.openURL("https://apps.apple.com/app/id6758213061?action=write-review");
                } catch (_) {}
              }} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.background }}>{t("pre_review_confirm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* ── Offboarding Modal ─────────────────────────────────────── */}
      <Modal visible={offboardVisible} transparent animationType="slide" onRequestClose={() => setOffboardVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.60)", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingTop: 12, paddingHorizontal: 22, paddingBottom: 40,
          }}>
            {/* Handle */}
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)" }} />
            </View>

            {offboardStep === 1 && (
              <>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text, marginBottom: 6 }}>
                  {t("offboard_title")}
                </Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: 22, lineHeight: 21 }}>
                  {t("offboard_subtitle")}
                </Text>

                {[
                  { key: "too_expensive",  label: t("offboard_reason_price") },
                  { key: "not_using",      label: t("offboard_reason_usage") },
                  { key: "missing_feat",   label: t("offboard_reason_features") },
                  { key: "technical",      label: t("offboard_reason_technical") },
                  { key: "other",          label: t("offboard_reason_other") },
                ].map(r => (
                  <TouchableOpacity
                    key={r.key}
                    onPress={() => setOffboardReason(r.key)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 13,
                      paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: offboardReason === r.key
                        ? "rgba(201,188,168,0.12)"
                        : "rgba(255,255,255,0.04)",
                      borderWidth: 1,
                      borderColor: offboardReason === r.key
                        ? "rgba(201,188,168,0.40)"
                        : "rgba(255,255,255,0.07)",
                    }}
                  >
                    <View style={{
                      width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
                      borderColor: offboardReason === r.key ? colors.primary : "rgba(255,255,255,0.22)",
                      backgroundColor: offboardReason === r.key ? colors.primary : "transparent",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      {offboardReason === r.key && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#1A1A1A" }} />
                      )}
                    </View>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text, flex: 1 }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  onPress={() => { if (offboardReason) setOffboardStep(2); }}
                  activeOpacity={0.8}
                  style={{
                    marginTop: 14, borderRadius: 16, paddingVertical: 15,
                    alignItems: "center",
                    backgroundColor: offboardReason ? colors.primary : "rgba(201,188,168,0.18)",
                  }}
                >
                  <Text style={{
                    fontFamily: "Montserrat_600SemiBold", fontSize: 15,
                    color: offboardReason ? "#1A1A1A" : "rgba(255,255,255,0.30)",
                  }}>
                    {t("continue")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setOffboardVisible(false)}
                  style={{ marginTop: 12, alignItems: "center", paddingVertical: 10 }}
                >
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
                    {t("cancel")}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {offboardStep === 2 && (
              <>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text, marginBottom: 8 }}>
                  {offboardReason === "too_expensive" ? t("offboard_ret_price_title") : t("offboard_ret_title")}
                </Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: 22, lineHeight: 21 }}>
                  {offboardReason === "too_expensive" ? t("offboard_ret_price_body") : t("offboard_ret_body")}
                </Text>

                {offboardReason === "too_expensive" && Platform.OS === "ios" && (
                  <View style={{
                    backgroundColor: "rgba(201,188,168,0.07)", borderRadius: 16,
                    padding: 16, marginBottom: 20,
                    borderWidth: 1, borderColor: "rgba(201,188,168,0.18)",
                  }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.primary, marginBottom: 5 }}>
                      {t("offboard_pause_offer").replace(/\{\{store\}\}/g, storeLabel)}
                    </Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                      {t("offboard_pause_body").replace(/\{\{store\}\}/g, storeLabel)}
                    </Text>
                  </View>
                )}

                {/* Bleib dabei – primärer CTA */}
                <TouchableOpacity
                  onPress={() => setOffboardVisible(false)}
                  activeOpacity={0.8}
                  style={{
                    borderRadius: 16, paddingVertical: 15,
                    alignItems: "center",
                    backgroundColor: colors.primary,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#1A1A1A" }}>
                    {t("offboard_keep")}
                  </Text>
                </TouchableOpacity>

                {/* Kündigen → Store öffnen */}
                <TouchableOpacity
                  onPress={() => {
                    setOffboardVisible(false);
                    const url = Platform.OS === "ios"
                      ? "https://apps.apple.com/account/subscriptions"
                      : "https://play.google.com/store/account/subscriptions";
                    Linking.openURL(url).catch(() => {});
                  }}
                  activeOpacity={0.7}
                  style={{
                    borderRadius: 16, paddingVertical: 13,
                    alignItems: "center",
                    backgroundColor: "transparent",
                  }}
                >
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.30)" }}>
                    {t("offboard_confirm_cancel").replace(/\{\{store\}\}/g, storeLabel)}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Sprach-Modal */}
      <Modal visible={langModalOpen} transparent animationType="slide" onRequestClose={() => setLangModalOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => setLangModalOpen(false)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ paddingHorizontal: 24, paddingVertical: 16 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: colors.text, letterSpacing: -0.3 }}>{t("language")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{t("einst_lang_hint") || "Die Sprache gilt für die gesamte App."}</Text>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 10, paddingBottom: 20 }}>
              {SUPPORTED_LANGUAGES.map((l) => {
                const isActive = l.code === lang;
                return (
                  <TouchableOpacity
                    key={l.code}
                    onPress={async () => {
                      await setLanguage(l.code);
                      setLangModalOpen(false);
                    }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      padding: 16, borderRadius: 16,
                      backgroundColor: isActive ? "rgba(205,185,138,0.12)" : colors.card,
                      borderWidth: 1,
                      borderColor: isActive ? "rgba(205,185,138,0.45)" : colors.border,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontSize: 24 }}>{l.flag}</Text>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 15, color: isActive ? "#CDB98A" : colors.text }}>{l.label}</Text>
                    </View>
                    {isActive && (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#CDB98A", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 11, color: "#000" }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* ── Farbschema Palette Modal ─────────────────────────────────────── */}
      {showFarbschema && (
        <Modal visible={paletteOpen} transparent animationType="slide" onRequestClose={() => setPaletteOpen(false)}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }} activeOpacity={1} onPress={() => setPaletteOpen(false)} />
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border, maxHeight: "80%" }}>
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 2 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
              </View>
              {/* Header */}
              <View style={{ paddingHorizontal: 24, paddingTop: 14, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text, letterSpacing: -0.3 }}>{t("color_scheme")}</Text>
                <TouchableOpacity onPress={openPicker} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: colors.primary, lineHeight: 20 }}>+</Text>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.text }}>
                    {t("custom_label")}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}>
                {/* Color swatches – centered grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, marginBottom: 28 }}>
                  {PALETTE.map((item) => {
                    const isSelected = (themePrimary === item.id) || (item.id === null && !themePrimary);
                    return (
                      <View key={item.id ?? "__standard__"} style={{ alignItems: "center", gap: 6, width: 56 }}>
                        <TouchableOpacity onPress={() => selectPrimary(item.id)} activeOpacity={0.75} style={{ position: "relative" }}>
                          <View style={{
                            width: 52, height: 52, borderRadius: 26,
                            backgroundColor: item.color,
                            borderWidth: isSelected ? 3 : 1.5,
                            borderColor: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.12)",
                            shadowColor: isSelected ? item.color : "transparent",
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: isSelected ? 0.6 : 0,
                            shadowRadius: 8,
                            elevation: isSelected ? 6 : 0,
                          }} />
                          {isSelected && (
                            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>✓</Text>
                              </View>
                            </View>
                          )}
                        </TouchableOpacity>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: isSelected ? colors.text : colors.textSecondary, textAlign: "center" }} numberOfLines={1}>{item.name}</Text>
                        {item.isCustom && (
                          <TouchableOpacity onPress={() => removeCustomColor(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={{ marginTop: -2 }}>
                            <Text style={{ fontSize: 9, color: "rgba(255,80,80,0.6)" }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Intensität */}
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {t("intensity_label")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[0.35, 0.5, 0.65, 0.8, 1.0].map((v) => {
                      const active = Math.abs(themeIntensity - v) < 0.08;
                      return (
                        <TouchableOpacity key={v} onPress={() => selectIntensity(v)} activeOpacity={0.75} style={{
                          flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                          backgroundColor: active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.04)",
                          borderWidth: 1, borderColor: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.07)",
                        }}>
                          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, opacity: v, marginBottom: 5 }} />
                          <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 10, color: active ? colors.text : colors.textSecondary }}>{Math.round(v * 100)}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Custom Color Picker Modal ─────────────────────────────────────── */}
      {showFarbschema && (
        <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => { setPickerOpen(false); setTimeout(() => setPaletteOpen(true), 150); }}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)" }} activeOpacity={1} onPress={() => { setPickerOpen(false); setTimeout(() => setPaletteOpen(true), 150); }} />
            <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 48, borderTopWidth: 1, borderColor: colors.border, maxHeight: "90%" }}>
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 2 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
              </View>
              {/* Header – nur ein Zurück-Button */}
              <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity onPress={() => { setPickerOpen(false); setTimeout(() => setPaletteOpen(true), 150); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 18, color: colors.text }}>‹</Text>
                </TouchableOpacity>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: colors.text, flex: 1, textAlign: "center", letterSpacing: -0.3 }}>
                  {t("custom_color_label")}
                </Text>
                <View style={{ width: 36 }} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
                {/* Live Preview */}
                <View style={{ alignItems: "center", marginBottom: 22 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: pickerHex, shadowColor: pickerHex, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 8, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" }} />
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text, marginTop: 10, letterSpacing: 1.5 }}>{pickerHex.toUpperCase()}</Text>
                </View>

                {/* Color Grid – full width, centered */}
                <View style={{ width: "100%", marginBottom: 20 }}>
                  {/* Graustufen */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    {gridRows.grays.map((hex, i) => (
                      <TouchableOpacity key={`g${i}`} onPress={() => { const rgb = hexToRgb(hex) || { r: 128, g: 128, b: 128 }; const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b); setHue(hsv.h); setSat(hsv.s); setVal(hsv.v); }} style={{ flex: 1, aspectRatio: 1, marginHorizontal: 1.5, borderRadius: 5, backgroundColor: hex }} />
                    ))}
                  </View>
                  {/* Farbreihen */}
                  {gridRows.colorRows.map((row, rIdx) => (
                    <View key={rIdx} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      {row.map((hex, cIdx) => (
                        <TouchableOpacity key={cIdx} onPress={() => { const rgb = hexToRgb(hex) || { r: 128, g: 128, b: 128 }; const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b); setHue(hsv.h); setSat(hsv.s); setVal(hsv.v); }} style={{ flex: 1, aspectRatio: 1, marginHorizontal: 1.5, borderRadius: 4, backgroundColor: hex }} />
                      ))}
                    </View>
                  ))}
                </View>

                {/* Name input */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {t("name_optional")}
                  </Text>
                  <TextInput
                    value={pickerName}
                    onChangeText={setPickerName}
                    placeholder={t("color_placeholder")}
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    maxLength={18}
                    style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border }}
                  />
                </View>

                {/* Speichern */}
                <TouchableOpacity onPress={addCustomFromPicker} activeOpacity={0.85} style={{ backgroundColor: pickerHex, borderRadius: 16, paddingVertical: 16, alignItems: "center" }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#1A1A1A" }}>
                    {t("save_color")}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      <UpgradePopup
        visible={upgradePopupVisible}
        onClose={() => setUpgradePopupVisible(false)}
        reason={upgradeReason}
      />
    </View>
  );
}