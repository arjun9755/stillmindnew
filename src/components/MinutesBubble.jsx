// apps/mobile/src/components/MinutesBubble.jsx

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  AppState,
  DeviceEventEmitter,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { canStartSession, getUserPlan } from "@/utils/storage";
import { useI18n, t } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import usePurchases from "@/utils/usePurchases";
import { PRODUCT_IDS, PLAN_IDS } from "@/utils/revenuecat";

// ── Farben (identisch zu premium/index.jsx) ────────────────────────────────
const ACCENT_PRO      = "#8B5CF6";
const ACCENT_LIFETIME = "#F59E0B";
const ACCENT_YEARLY   = "#10B981";

const PRICE_FALLBACK = {
  PRO_MONTHLY:  "8,99 €",
  PRO_YEARLY:   "59,00 €",
  PREMIUM_LIFE: "99,00 €",
};

function planLabel(plan, tFn) {
  if (plan === "lifetime") return tFn("premium_life");
  if (plan === "pro")      return tFn("plan_label_pro");
  return tFn("plan_label_basis");
}
function planTier(plan) {
  if (plan === "lifetime") return 3;
  if (plan === "pro")      return 2;
  return 0;
}
function planDailyLimit(plan) {
  if (plan === "lifetime") return Infinity;
  if (plan === "pro")      return 5;
  return 1;
}
function minutesLabel(status, tFn) {
  const tr = typeof tFn === "function" ? tFn : (key) => key;
  if (!status) return "—";
  if (status.reason === "unlimited") return tr("bubble_inf_minutes");
  if (typeof status.startsLeft === "number") {
    return status.startsLeft <= 0 ? `0 ${tr("share_min_plural")}` : status.startsLeft === 1 ? `1 ${tr("share_min_singular")}` : `${status.startsLeft} ${tr("share_min_plural")}`;
  }
  if (typeof status.remaining === "number") {
    return status.remaining <= 0 ? `0 ${tr("share_min_plural")}` : status.remaining === 1 ? `1 ${tr("share_min_singular")}` : `${status.remaining} ${tr("share_min_plural")}`;
  }
  return status.canStart ? tr("minutes_available") : tr("no_minutes");
}

export default function MinutesBubble({ floating = true, top, right, left, bottom }) {
  const { t } = useI18n();
  const { colors }  = useStillMindTheme();
  const isFocused   = useIsFocused();
  const insets      = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const sheetY     = useRef(new Animated.Value(screenH)).current;
  const backdropA  = useRef(new Animated.Value(0)).current;
  const isOpenRef  = useRef(false);
  const isAnimRef  = useRef(false);
  const scrollYRef = useRef(0);

  const {
    loading: purchasesLoading, isConfigured, planId, credits,
    isPro, isLifetime, getPackageByProductId, getPriceString, purchase, buyCredit,
  } = usePurchases();

  const [plan, setPlan]             = useState("free");
  const [status, setStatus]         = useState(null);
  const [open, setOpen]             = useState(false);
  const [busyKey, setBusyKey]       = useState(null);
  const [proBilling, setProBilling] = useState("yearly");

  const storeLabel = Platform.OS === "ios" ? "App Store" : "Google Play Store";

  // ── Sheet open / close ───────────────────────────────────────────────────
  const openSheet = useCallback(() => {
    if (isOpenRef.current || isAnimRef.current) return;
    isAnimRef.current = true;
    scrollYRef.current = 0;
    sheetY.setValue(screenH);
    backdropA.setValue(0);
    setOpen(true);
    requestAnimationFrame(() => {
      isOpenRef.current = true;
      Animated.parallel([
        Animated.timing(sheetY,    { toValue: 0, duration: 340, easing: Easing.out(Easing.bezier(0.25, 0.46, 0.45, 0.94)), useNativeDriver: true }),
        Animated.timing(backdropA, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => { isAnimRef.current = false; });
    });
  }, [sheetY, backdropA, screenH]);

  const closeSheet = useCallback(() => {
    if (!isOpenRef.current || isAnimRef.current) return;
    isAnimRef.current = true;
    Animated.parallel([
      Animated.timing(sheetY,    { toValue: screenH, duration: 280, easing: Easing.in(Easing.bezier(0.55, 0.055, 0.675, 0.19)), useNativeDriver: true }),
      Animated.timing(backdropA, { toValue: 0,       duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      isOpenRef.current = false;
      isAnimRef.current = false;
      setOpen(false);
      sheetY.setValue(screenH);
    });
  }, [screenH, sheetY, backdropA]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => {
      if (Math.abs(g.dy) < 10) return false;
      if (Math.abs(g.dx) > Math.abs(g.dy) * 0.7) return false;
      return g.dy > 0 && (scrollYRef.current || 0) <= 0.5;
    },
    onPanResponderMove: (_, g) => {
      if ((scrollYRef.current || 0) > 0.5) return;
      sheetY.setValue(Math.max(0, g.dy));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 1.0) closeSheet();
      else Animated.spring(sheetY, { toValue: 0, bounciness: 4, speed: 18, useNativeDriver: true }).start();
    },
  }), [closeSheet, sheetY]);

  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });

  // ── Plan & Status laden ──────────────────────────────────────────────────
  const load = async () => {
    try {
      const p = await getUserPlan();
      setPlan(p || "free");
      const s = await canStartSession();
      setStatus(s || null);
    } catch (_) {}
  };

  useEffect(() => {
    load();
    const s1 = AppState.addEventListener("change", (st) => { if (st === "active") load(); });
    const s2 = DeviceEventEmitter.addListener("stillmind:creditsChanged", load);
    const s3 = DeviceEventEmitter.addListener("stillmind:planChanged",    load);
    return () => { s1 && s1.remove && s1.remove(); s2 && s2.remove && s2.remove(); s3 && s3.remove && s3.remove(); };
  }, []);
  useEffect(() => { if (isFocused) load(); }, [isFocused]);

  // ── Preise auflösen ──────────────────────────────────────────────────────
  const resolvePrice = useCallback((productId, fallbackKey) => {
    const pkg = typeof getPackageByProductId === "function" && productId
      ? getPackageByProductId(productId) : null;
    const rc  = pkg && typeof getPriceString === "function" ? getPriceString(pkg) : null;
    if (typeof rc === "string" && rc.trim()) return rc.trim();
    return PRICE_FALLBACK[fallbackKey] || null;
  }, [getPackageByProductId, getPriceString]);

  // ── Kauf-Handler ─────────────────────────────────────────────────────────
  const handlePurchase = async (planKey) => {
    try {
      setBusyKey(planKey);
      if (!isConfigured) { closeSheet(); return; }
      const ok = await purchase(planKey);
      if (ok) closeSheet();
      else Alert.alert(t("error"), t("purchase_failed"));
    } catch (e) {
      Alert.alert(t("error"), (e && e.message) || t("unknown_error"));
    } finally { setBusyKey(null); }
  };

  const onQuickBuyCredit = async () => {
    try {
      setBusyKey("credit");
      if (!isConfigured) { closeSheet(); return; }
      await buyCredit();
    } finally { setBusyKey(null); }
  };

  if (!fontsLoaded) return null;

  // ── Berechnungen ─────────────────────────────────────────────────────────
  const currentPlanKey    = isLifetime ? "lifetime" : isPro ? "pro" : plan || "free";
  const currentTier       = planTier(currentPlanKey);
  const currentDailyLimit = planDailyLimit(currentPlanKey);
  const isProActive       = currentPlanKey === "pro";
  const isLifetimeActive  = currentPlanKey === "lifetime";
  const isFreeActive      = currentPlanKey === "free";

  const topText        = planLabel(currentPlanKey, t);
  const bottomText     = isFreeActive
    ? minutesLabel(status, t)
    : isProActive
      ? t("bubble_plan_pro_short")
      : t("bubble_plan_life_short");
  const indicatorColor = status
    ? (status.canStart || status.reason === "unlimited" ? "#3BD17A" : "#FF4D4D")
    : "rgba(255,255,255,0.35)";

  const rawRemaining = (status && status.reason) === "unlimited" ? Infinity
    : typeof (status && status.startsLeft) === "number" ? status.startsLeft
    : typeof (status && status.remaining)  === "number" ? status.remaining : null;
  const creditsLine  = typeof credits === "number" ? credits : null;
  let remainingToday = rawRemaining;
  if (typeof remainingToday === "number" && typeof creditsLine === "number")
    remainingToday = Math.max(0, remainingToday - creditsLine);
  const minutesLine  = remainingToday === Infinity ? "∞"
    : typeof remainingToday === "number" ? remainingToday : "—";

  const priceMonthly  = resolvePrice(PRODUCT_IDS.PRO_MONTHLY,  "PRO_MONTHLY");
  const priceYearly   = resolvePrice(PRODUCT_IDS.PRO_YEARLY,   "PRO_YEARLY");
  const lifetimePrice = resolvePrice(PRODUCT_IDS.PREMIUM_LIFE, "PREMIUM_LIFE");

  const yearlyNum  = parseFloat((priceYearly  || "59").replace(",", ".").replace(/[^0-9.]/g, ""));
  const monthlyNum = parseFloat((priceMonthly || "8.99").replace(",", ".").replace(/[^0-9.]/g, ""));
  const yearlyMonthlyEquiv = isNaN(yearlyNum) ? "4,92 €" : `${(yearlyNum / 12).toFixed(2).replace(".", ",")} €`;
  const yearSavings = (!isNaN(yearlyNum) && !isNaN(monthlyNum) && monthlyNum > 0)
    ? Math.round((1 - yearlyNum / (monthlyNum * 12)) * 100) : 45;

  const lifetimeNum   = parseFloat((lifetimePrice || "99").replace(",", ".").replace(/[^0-9.]/g, ""));
  const lifetimeYears = (!isNaN(lifetimeNum) && !isNaN(yearlyNum) && yearlyNum > 0)
    ? Math.ceil(lifetimeNum / yearlyNum) : 2;

  const proActivePlanKey = proBilling === "yearly" ? "pro-yearly" : PLAN_IDS.PRO;

  const floatingStyle = floating ? {
    position: "absolute",
    top:    typeof top    === "number" ? top    : 12,
    right:  typeof right  === "number" ? right  : 12,
    left:   typeof left   === "number" ? left   : undefined,
    bottom: typeof bottom === "number" ? bottom : undefined,
    zIndex: 1000,
  } : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={openSheet}
      style={[{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 13, paddingVertical: 10,
        borderRadius: 999, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
      }, floatingStyle]}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, marginRight: 9, backgroundColor: indicatorColor }} />
      <View>
        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, lineHeight: 14 }} numberOfLines={1}>
          {topText}
        </Text>
        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: colors.textSecondary, marginTop: 2, lineHeight: 12 }} numberOfLines={1}>
          {bottomText}
        </Text>
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">

          {/* Backdrop */}
          <BlurView intensity={20} tint="dark" pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <Animated.View pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, { opacity: backdropA, backgroundColor: "rgba(0,0,0,0.50)" }]}>
            <Pressable onPress={closeSheet} style={StyleSheet.absoluteFill} />
          </Animated.View>

          {/* Sheet */}
          <Animated.View style={{
            transform: [{ translateY: sheetY }],
            maxHeight: Math.round(screenH * 0.93),
            backgroundColor: colors.surface,
            borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderWidth: 1, borderColor: colors.border,
            shadowColor: "#000", shadowOpacity: 0.40,
            shadowRadius: 24, shadowOffset: { width: 0, height: -8 },
            elevation: 20,
          }}>
            {/* Drag handle */}
            <View {...panResponder.panHandlers} style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)" }} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(e) => { scrollYRef.current = e?.nativeEvent?.contentOffset?.y ?? 0; }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
            >
              {/* Titel */}
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 32, color: colors.text, marginBottom: 4, marginTop: 8 }}>
                Premium
              </Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: 22 }}>
                {isFreeActive ? t("bubble_plan_free") : isProActive ? t("bubble_plan_pro") : t("bubble_plan_life")}
              </Text>

              {/* ══ BASIS ══ */}
              <View style={{
                backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 20, padding: 18,
                borderWidth: 1, borderColor: isFreeActive ? "rgba(255,255,255,0.18)" : colors.border,
                marginBottom: 14,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Text style={{ fontSize: 22 }}>🪷</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: isFreeActive ? colors.text : "rgba(255,255,255,0.38)" }}>{t("plan_basis")}</Text>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary }}>
                      {t("prem_free")} · {t("bubble_today_remaining", {n: minutesLine})}
                    </Text>
                  </View>
                  {isFreeActive && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: colors.text }}>{t("plan_current")}</Text>
                    </View>
                  )}
                </View>
                {[t("sessions_daily"), t("fix_one_minute"), t("library_preview"), t("bubble_no_stats_sos")].map((f, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Text style={{ color: "rgba(255,255,255,0.18)", fontSize: 13 }}>•</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.32)" }}>{f}</Text>
                  </View>
                ))}

              </View>

              {/* ══ PRO ══ */}
              <View style={{
                backgroundColor: "rgba(139,92,246,0.07)", borderRadius: 22,
                borderWidth: isProActive ? 2 : 1.5,
                borderColor: isProActive ? ACCENT_PRO : "rgba(139,92,246,0.48)",
                marginBottom: 14, overflow: "hidden",
              }}>
                <View style={{ backgroundColor: isProActive ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.16)", paddingHorizontal: 18, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>🟡</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#fff" }}>Pro</Text>
                  </View>
                  <View style={{ backgroundColor: ACCENT_PRO, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "#fff", letterSpacing: 0.5 }}>
                      {isProActive ? t("bubble_plan_active") : t("bubble_popular")}
                    </Text>
                  </View>
                </View>

                <View style={{ padding: 18 }}>
                  {!isProActive && (
                    <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setProBilling("monthly")}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center", backgroundColor: proBilling === "monthly" ? "rgba(139,92,246,0.22)" : "transparent", borderWidth: proBilling === "monthly" ? 1 : 0, borderColor: ACCENT_PRO }}
                      >
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: proBilling === "monthly" ? "#fff" : "rgba(255,255,255,0.45)" }}>{t("plan_monthly")}</Text>
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: proBilling === "monthly" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.30)", marginTop: 2 }}>
                          {priceMonthly || "8,99 €"} / Mo
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setProBilling("yearly")}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center", backgroundColor: proBilling === "yearly" ? "rgba(16,185,129,0.18)" : "transparent", borderWidth: proBilling === "yearly" ? 1 : 0, borderColor: ACCENT_YEARLY }}
                      >
                        <View style={{ position: "absolute", top: -9, right: 4, backgroundColor: ACCENT_YEARLY, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: "#fff" }}>{yearSavings}% SPAREN</Text>
                        </View>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: proBilling === "yearly" ? "#fff" : "rgba(255,255,255,0.45)" }}>{t("prem_yearly_label")}</Text>
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: proBilling === "yearly" ? ACCENT_YEARLY : "rgba(255,255,255,0.30)", marginTop: 2 }}>
                          {priceYearly || "59,00 €"} {t("prem_per_year")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!isProActive && (
                    <View style={{ marginBottom: 14 }}>
                      {proBilling === "yearly" ? (
                        <View>
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                            <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 34, color: "#fff" }}>{priceYearly || "59 €"}</Text>
                            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>{t("prem_per_year")}</Text>
                          </View>
                          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                            {t("prem_equals_per_month").replace("{{price}}", yearlyMonthlyEquiv)}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 34, color: "#fff" }}>{priceMonthly || "8,99 €"}</Text>
                          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>{t("per_month")}</Text>
                        </View>
                      )}
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 6 }}>
                        {t("prem_try_free")} · {t("prem_then_billing").replace("{{price}}", proBilling === "yearly" ? `${priceYearly || "59 €"}/${t("prem_per_year").trim()}` : `${priceMonthly || "8,99 €"}/${t("prem_per_year").trim()}`).replace("{{store}}", storeLabel)}
                      </Text>
                    </View>
                  )}

                  <View style={{ backgroundColor: "rgba(139,92,246,0.10)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderWidth: 1, borderColor: "rgba(139,92,246,0.22)" }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: ACCENT_PRO, marginBottom: 3 }}>{t("prem_smart_plan")}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                      {t("prem_smart_plan_sub")}
                    </Text>
                  </View>

                  {[
                    { t: t("bubble_unlimited"),        h: true  },
                    { t: t("bubble_feat_free_time"),        h: false },
                    { t: t("bubble_feat_all_modes"),        h: false },
                    { t: t("bubble_feat_sos"),   h: true  },
                    { t: t("stats_streak_goals"),   h: false },
                    { t: t("bubble_monthly_reflection"),       h: false },
                    { t: t("prem_pro_feat_history"),            h: false },
                    { t: t("bubble_feat_csv"),         h: false },
                  ].map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <Text style={{ fontSize: 14, color: ACCENT_PRO }}>✓</Text>
                      <Text style={{ fontFamily: f.h ? "Montserrat_600SemiBold" : "Montserrat_400Regular", fontSize: 13, color: f.h ? "#fff" : colors.textSecondary }}>{f.t}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={isProActive ? null : () => handlePurchase(proActivePlanKey)}
                    disabled={isProActive || busyKey === proActivePlanKey}
                    style={{ marginTop: 14, height: 56, borderRadius: 16, backgroundColor: isProActive ? "rgba(255,255,255,0.08)" : ACCENT_PRO, justifyContent: "center", alignItems: "center", opacity: isProActive ? 0.6 : 1 }}
                  >
                    {busyKey === proActivePlanKey
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "#fff" }}>
                          {isProActive ? t("bubble_pro_active") : proBilling === "yearly" ? t("bubble_pro_unlock_free") : t("bubble_pro_unlock_challenge")}
                        </Text>}
                  </TouchableOpacity>
                  {!isProActive && (
                    <Text style={{ marginTop: 7, fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, textAlign: "center" }}>
                      {t("prem_trial_footer").replace("{{price}}", proBilling === "yearly" ? `${priceYearly || "59 €"}/${t("prem_per_year").trim()}` : `${priceMonthly || "8,99 €"}`)}
                    </Text>
                  )}
                </View>
              </View>

              {/* ══ PREMIUM LIFE ══ */}
              <View style={{
                backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 22,
                borderWidth: isLifetimeActive ? 2 : 1.5,
                borderColor: isLifetimeActive ? ACCENT_LIFETIME : "rgba(245,158,11,0.38)",
                marginBottom: 14, overflow: "hidden",
              }}>
                <View style={{ backgroundColor: isLifetimeActive ? "rgba(245,158,11,0.22)" : "rgba(245,158,11,0.10)", paddingHorizontal: 18, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 20 }}>💎</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#fff" }}>{t("premium_life")}</Text>
                  </View>
                  <View style={{ backgroundColor: isLifetimeActive ? ACCENT_LIFETIME : "rgba(245,158,11,0.85)", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "#000" }}>
                      {isLifetimeActive ? t("bubble_lifetime_active") : t("prem_price_badge")}
                    </Text>
                  </View>
                </View>

                <View style={{ padding: 18 }}>
                  {!isLifetimeActive && (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 30, color: "#fff" }}>{lifetimePrice || "99 €"}</Text>
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 16, color: "rgba(255,255,255,0.32)", textDecorationLine: "line-through" }}>149 €</Text>
                      </View>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: ACCENT_LIFETIME, marginTop: 3 }}>
                        {t("bubble_lifetime_tagline")}
                      </Text>
                      <View style={{ backgroundColor: "rgba(245,158,11,0.10)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10, borderWidth: 1, borderColor: "rgba(245,158,11,0.22)" }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: ACCENT_LIFETIME, marginBottom: 3 }}>
                          {t("prem_early_founder_title")}
                        </Text>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                          {t("prem_early_founder_sub").replace("{{price}}", lifetimePrice || "99 €")}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={{ backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.20)" }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: ACCENT_LIFETIME, marginBottom: 3 }}>{t("prem_one_time_own")}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                      {t("prem_one_time_own_sub")}
                    </Text>
                  </View>

                  {[
                    { t: t("lifetime_all_pro"),         h: true },
                    { t: t("prem_lifetime_feat_history"),            h: true },
                    { t: t("prem_lifetime_feat_report"),       h: true },
                    { t: t("prem_lifetime_feat_ai"),            h: true },
                    { t: t("prem_lifetime_feat_sleep"),         h: true },
                    { t: t("prem_lifetime_feat_voting"),            h: true },
                    { t: t("bubble_lifetime_badge"),          h: true },
                    { t: t("bubble_future_features"),       h: false },
                  ].map((f, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }}>
                      <Text style={{ fontSize: 14, color: ACCENT_LIFETIME }}>✓</Text>
                      <Text style={{ fontFamily: f.h ? "Montserrat_500Medium" : "Montserrat_400Regular", fontSize: 13, color: f.h ? "#fff" : colors.textSecondary }}>{f.t}</Text>
                    </View>
                  ))}

                  {!isLifetimeActive && (
                    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                        {t("prem_lifetime_value_hint").replace("{{yearly}}", priceYearly || "59 €").replace("{{years}}", lifetimeYears).replace("{{year_word}}", lifetimeYears === 1 ? t("prem_year_singular") : t("prem_year_plural"))}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={isLifetimeActive || currentTier >= 3 ? null : () => handlePurchase(PLAN_IDS.LIFETIME)}
                    disabled={isLifetimeActive || currentTier >= 3 || busyKey === PLAN_IDS.LIFETIME}
                    style={{ height: 56, borderRadius: 16, backgroundColor: isLifetimeActive ? "rgba(255,255,255,0.08)" : ACCENT_LIFETIME, justifyContent: "center", alignItems: "center", opacity: isLifetimeActive ? 0.6 : 1 }}
                  >
                    {busyKey === PLAN_IDS.LIFETIME
                      ? <ActivityIndicator color="#000" />
                      : <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: isLifetimeActive ? colors.text : "#000" }}>
                          {isLifetimeActive ? t("bubble_pro_active") : `${t("one_time_buy")} · ${lifetimePrice || "99 €"}`}
                        </Text>}
                  </TouchableOpacity>
                  {!isLifetimeActive && (
                    <Text style={{ marginTop: 7, fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, textAlign: "center" }}>
                      {t("prem_one_time_footer")}
                    </Text>
                  )}
                </View>
              </View>

              {/* Legal */}
              <View style={{ marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginBottom: 10 }}>
                  {t("prem_billing_footer").replace(/\{\{store\}\}/g, storeLabel)}
                </Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <TouchableOpacity onPress={() => router.push("/legal/datenschutz")} activeOpacity={0.8}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, textDecorationLine: "underline", opacity: 0.85 }}>{t("prem_footer_privacy")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push("/legal/impressum")} activeOpacity={0.8}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, textDecorationLine: "underline", opacity: 0.85 }}>{t("imprint")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* Schließen */}
            <TouchableOpacity
              onPress={closeSheet}
              activeOpacity={0.88}
              style={{ marginHorizontal: 18, marginTop: 6, marginBottom: insets.bottom > 0 ? insets.bottom : 16, paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>{t("close")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}
