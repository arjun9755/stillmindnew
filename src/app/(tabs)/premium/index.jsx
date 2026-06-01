// apps/mobile/src/app/(tabs)/premium/index.jsx
// Preise: PRO 8,99€/Monat · 59€/Jahr (Highlight) · Premium Life 149€ Early 99€
import React, { useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  DeviceEventEmitter,
  Linking,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { router } from "expo-router";

import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n, t } from "@/utils/i18n";
import { usePurchases } from "@/utils/usePurchases";
import { PRODUCT_IDS, PLAN_IDS } from "@/utils/revenuecat";
import Purchases from "react-native-purchases";
import MinutesBubble from "@/components/MinutesBubble";
import { setDevPlanOverride, getUserPlan } from "@/utils/storage";
import { normalizeAccessPlan } from "@/utils/access";

const STILLMIND_LOGO = require("../../../../assets/brand/stillmind-logo-transparent.png");

const PRIVACY_URL = "https://appstillmind.com/privacy.html";
const TERMS_URL   = "https://appstillmind.com/terms.html";

const PRICE_FALLBACK = {
  PRO_MONTHLY:  "8,99 €",
  PRO_YEARLY:   "59,00 €",
  PREMIUM_LIFE: "99,00 €",
  CREDIT_1:     "0,99 €",
};

const ACCENT_PRO      = "#8B5CF6";
const ACCENT_LIFETIME = "#F59E0B";
const ACCENT_YEARLY   = "#10B981";

export default function PremiumScreen() {
  const insets             = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();

  const {
    loading, error: purchaseError, planId, credits,
    getPriceString, getPackageByProductId,
    purchase, buyCredit, restore, refresh,
  } = usePurchases();

  const [purchasing,    setPurchasing]    = useState(null);
  const [effectivePlan, setEffectivePlan] = useState("free");
  const [devOpen,       setDevOpen]       = useState(false);
  const [proBilling,    setProBilling]    = useState("yearly");
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const { t } = useI18n();
  const storeLabel  = Platform.OS === "ios" ? "App Store" : "Google Play Store";

  const openUrl = (url) => { try { if (url) Linking.openURL(url); } catch (_) {} };

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      const load = async () => {
        try {
          const stored = await getUserPlan();
          const p = __DEV__ ? stored : planId || stored;
          if (alive) setEffectivePlan(normalizeAccessPlan(p));
        } catch (_) {
          if (alive) setEffectivePlan(normalizeAccessPlan(planId));
        }
      };
      load();
      const sub = DeviceEventEmitter.addListener("stillmind:planChanged", load);
      return () => {
        alive = false; sub && sub.remove && sub.remove();
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
        tapCountRef.current = 0; setDevOpen(false);
      };
    }, [planId])
  );

  const onLogoTap = () => {
    if (!__DEV__) return;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapCountRef.current += 1;
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 1800);
    if (tapCountRef.current >= 5) { tapCountRef.current = 0; setDevOpen((v) => !v); }
  };

  const applyDev = async (plan) => {
    if (!__DEV__) return;
    try {
      await setDevPlanOverride(plan);
      DeviceEventEmitter.emit("stillmind:planChanged");
      await refresh();
      Alert.alert("DEV", plan ? `Plan: ${plan}` : "Reset.");
    } catch (_) {}
  };

  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });

  const resolvePrice = (productId, fallbackKey) => {
    const pkg = typeof getPackageByProductId === "function" && productId
      ? getPackageByProductId(productId) : null;
    const rc = pkg && typeof getPriceString === "function" ? getPriceString(pkg) : null;
    if (typeof rc === "string" && rc.trim()) return rc.trim();
    return PRICE_FALLBACK[fallbackKey] || null;
  };

  const currentRank = useMemo(() => {
    if (effectivePlan === "lifetime") return 3;
    if (effectivePlan === "pro")      return 2;
    return 0;
  }, [effectivePlan]);

  const handlePurchase = async (planKey) => {
    try {
      setPurchasing(planKey);

      // planKey → korrektes RevenueCat Package-Objekt auflösen
      let productId;
      if (planKey === PLAN_IDS.LIFETIME || planKey === "premium_lifetime") {
        productId = PRODUCT_IDS.PREMIUM_LIFE;
      } else if (planKey === "pro-yearly") {
        productId = PRODUCT_IDS.PRO_YEARLY;
      } else {
        // PLAN_IDS.PRO ("pro") → Monthly
        productId = PRODUCT_IDS.PRO_MONTHLY;
      }

      const pkg = getPackageByProductId(productId);
      if (!pkg) {
        Alert.alert(t("prem_error_generic"), t("prem_purchase_error"));
        return;
      }

      const result = await purchase(pkg);
      if (!result || !result.success) {
        // Abbruch durch User → kein Alert nötig
        if (result && result.cancelled) return;
        Alert.alert(t("prem_error_generic"), t("prem_purchase_error"));
      } else {
        DeviceEventEmitter.emit("stillmind:planChanged");
      }
    } catch (e) {
      Alert.alert(t("prem_error_generic"), (e && e.message) || t("prem_error_generic"));
    } finally { setPurchasing(null); }
  };

  const handleRestore = async () => {
    try {
      setPurchasing("restore");
      const ok = await restore();
      if (ok) Alert.alert(t("prem_restored_title"), t("prem_restore_ok"));
      else    Alert.alert(t("prem_hint_title"), t("prem_restore_none"));
    } catch (_) { Alert.alert(t("prem_error_generic"), t("prem_restore_fail")); }
    finally { setPurchasing(null); }
  };

  const handleRedeemCode = async () => {
    try {
      await Purchases.presentCodeRedemptionSheet();
    } catch (e) {
      console.warn("Code redemption failed:", e);
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const isProActive      = effectivePlan === "pro";
  const isLifetimeActive = effectivePlan === "lifetime";
  const isFreeActive     = effectivePlan === "free";

  const priceMonthly  = resolvePrice(PRODUCT_IDS.PRO_MONTHLY,  "PRO_MONTHLY");
  const priceYearly   = resolvePrice(PRODUCT_IDS.PRO_YEARLY,   "PRO_YEARLY");
  const lifetimePrice = resolvePrice(PRODUCT_IDS.PREMIUM_LIFE, "PREMIUM_LIFE");

  const yearlyNum  = parseFloat((priceYearly  || "59").replace(",",".").replace(/[^0-9.]/g,""));
  const monthlyNum = parseFloat((priceMonthly || "8.99").replace(",",".").replace(/[^0-9.]/g,""));
  const yearlyMonthlyEquiv = isNaN(yearlyNum) ? "4,92 €" : `${(yearlyNum / 12).toFixed(2).replace(".",",")} €`;
  const yearSavings = (!isNaN(yearlyNum) && !isNaN(monthlyNum) && monthlyNum > 0)
    ? Math.round((1 - yearlyNum / (monthlyNum * 12)) * 100) : 45;

  const proActivePlanKey = proBilling === "yearly" ? "pro-yearly" : PLAN_IDS.PRO;
  const proDisplayPrice  = proBilling === "yearly" ? priceYearly  : priceMonthly;

  const lifetimeNum      = parseFloat((lifetimePrice || "99").replace(",",".").replace(/[^0-9.]/g,""));
  const lifetimeYears    = (!isNaN(lifetimeNum) && !isNaN(yearlyNum) && yearlyNum > 0)
    ? Math.ceil(lifetimeNum / yearlyNum) : 2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header: Logo links, MinutesBubble rechts ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={onLogoTap} activeOpacity={__DEV__ ? 0.85 : 1}>
            <Image
            source={STILLMIND_LOGO}
            resizeMode="contain"
            style={{ width: 72, height: 72, opacity: 0.97 }}
          />
          </TouchableOpacity>
          <MinutesBubble floating={false} />
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 28 }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 40, color: colors.text, marginBottom: 6 }}>{t("premium_title")}</Text>
          {!isLifetimeActive && (
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary }}>
              {isFreeActive ? t("premium_free_line") : isProActive ? t("premium_pro_active") : t("premium_life_active")}
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 24 }}>

          {/* ══════════════════ BASIS ══════════════════ */}
          <View style={{
            backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 20, padding: 18,
            borderWidth: 1, borderColor: isFreeActive ? "rgba(255,255,255,0.18)" : colors.border,
            marginBottom: 14,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 22 }}>🪷</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 18, color: isFreeActive ? colors.text : "rgba(255,255,255,0.38)" }}>{t("plan_basis")}</Text>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary }}>{t("prem_free")}</Text>
              </View>
              {isFreeActive && (
                <View style={{ backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: colors.text }}>{t("plan_current")}</Text>
                </View>
              )}
            </View>
            {[t("basis_feat_1"), t("basis_feat_2"), t("basis_feat_3"), t("basis_feat_4")].map((f, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <Text style={{ color: "rgba(255,255,255,0.18)", fontSize: 13 }}>•</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.32)" }}>{f}</Text>
              </View>
            ))}
          </View>

          {/* ══════════════════ PRO ══════════════════ */}
          <View style={{
            backgroundColor: "rgba(139,92,246,0.07)", borderRadius: 22,
            borderWidth: isProActive ? 2 : 1.5,
            borderColor: isProActive ? ACCENT_PRO : "rgba(139,92,246,0.48)",
            marginBottom: 14, overflow: "hidden",
          }}>
            {/* Kopfzeile */}
            <View style={{ backgroundColor: isProActive ? "rgba(139,92,246,0.28)" : "rgba(139,92,246,0.16)", paddingHorizontal: 18, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🟡</Text>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#fff" }}>Pro</Text>
              </View>
              <View style={{ backgroundColor: ACCENT_PRO, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "#fff", letterSpacing: 0.5 }}>
                  {isProActive ? t("prem_active_plan_badge") : t("popular")}
                </Text>
              </View>
            </View>

            <View style={{ padding: 18 }}>

              {/* Billing-Switcher */}
              {!isProActive && (
                <View style={{ flexDirection: "row", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
                  <TouchableOpacity
                    onPress={() => setProBilling("monthly")}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center",
                      backgroundColor: proBilling === "monthly" ? "rgba(139,92,246,0.22)" : "transparent",
                      borderWidth: proBilling === "monthly" ? 1 : 0, borderColor: ACCENT_PRO,
                    }}
                  >
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: proBilling === "monthly" ? "#fff" : "rgba(255,255,255,0.45)" }}>{t("monthly")}</Text>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: proBilling === "monthly" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.30)", marginTop: 2 }}>
                      {priceMonthly || "8,99 €"} / Mo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setProBilling("yearly")}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center",
                      backgroundColor: proBilling === "yearly" ? "rgba(16,185,129,0.18)" : "transparent",
                      borderWidth: proBilling === "yearly" ? 1 : 0, borderColor: ACCENT_YEARLY,
                    }}
                  >
                    <View style={{ position: "absolute", top: -9, right: 4, backgroundColor: ACCENT_YEARLY, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: "#fff" }}>{t("prem_save_pct").replace("{{n}}", yearSavings)}</Text>
                    </View>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: proBilling === "yearly" ? "#fff" : "rgba(255,255,255,0.45)" }}>{t("prem_yearly_label")}</Text>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: proBilling === "yearly" ? ACCENT_YEARLY : "rgba(255,255,255,0.30)", marginTop: 2 }}>
                      {priceYearly || "59,00 €"} {t("per_year_label")}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Preiszeile */}
              {!isProActive && (
                <View style={{ marginBottom: 14 }}>
                  {proBilling === "yearly" ? (
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 28, color: "#fff" }}>{priceYearly || "59 €"}</Text>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>{t("prem_per_year")}</Text>
                      </View>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                        {t("prem_equals_per_month").replace("{{price}}", yearlyMonthlyEquiv)}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 28, color: "#fff" }}>{priceMonthly || "8,99 €"}</Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>{t("per_month")}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Trial-Hinweis */}
              {!isProActive && (
                <View style={{ backgroundColor: "rgba(139,92,246,0.14)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: ACCENT_PRO, marginBottom: 2 }}>{t("try_free_days").replace("{{n}}", 7)}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                    {t("premium_billing_info", {price: proBilling==="yearly"?`${priceYearly||"59 €"}${t("per_year_label")}`:`${priceMonthly||"8,99 €"}${t("per_month")}`, store: storeLabel})}
                  </Text>
                </View>
              )}

              {/* Features */}
              {/* Pro Badge */}
              <View style={{ backgroundColor: "rgba(139,92,246,0.10)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderWidth: 1, borderColor: "rgba(139,92,246,0.22)" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: ACCENT_PRO, marginBottom: 3 }}>{t("prem_smart_plan")}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  {t("prem_smart_plan_sub")}
                </Text>
              </View>
              {[
                t("unlimited_sessions"),
                t("free_time_choice"),
                t("premium_pro_features_1"),
                t("premium_pro_features_2"),
                t("premium_pro_features_3"),
                t("premium_pro_features_4"),
                t("prem_pro_feat_history"),
                t("premium_pro_features_5"),
                t("premium_pro_features_6"),
              ].map((f, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <Text style={{ fontSize: 14, color: ACCENT_PRO }}>✓</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>{f}</Text>
                </View>
              ))}

              {/* CTA */}
              <TouchableOpacity
                onPress={isProActive ? null : () => handlePurchase(proActivePlanKey)}
                disabled={isProActive || purchasing === proActivePlanKey}
                style={{
                  marginTop: 14, height: 56, borderRadius: 16,
                  backgroundColor: isProActive ? "rgba(255,255,255,0.08)" : ACCENT_PRO,
                  justifyContent: "center", alignItems: "center",
                  opacity: isProActive ? 0.6 : 1,
                }}
              >
                {purchasing === proActivePlanKey
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "#fff" }}>
                      {isProActive ? t("premium_cta_active") : proBilling === "yearly" ? t("premium_cta_yearly") : t("premium_cta_monthly")}
                    </Text>
                }
              </TouchableOpacity>
              {!isProActive && (
                <Text style={{ marginTop: 7, fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, textAlign: "center" }}>
                  {proBilling === "yearly" ? t("premium_trial_footer_yearly", {price: priceYearly||"59 €"}) : t("premium_trial_footer_monthly", {price: priceMonthly||"8,99 €"})}
                </Text>
              )}
            </View>
          </View>

          {/* ══════════════════ PREMIUM LIFE – AKTIV (V28 Design) ══════════════════ */}
          {isLifetimeActive && (
            <View style={{ marginBottom: 20 }}>

              {/* ── Tagline ── */}
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: ACCENT_LIFETIME, marginBottom: 20 }}>
                {t("prem_your_life_features")}
              </Text>

              {/* ── {t("prem_founder_member")} Hero Card ── */}
              <TouchableOpacity
                activeOpacity={0.88}
                style={{
                  backgroundColor: "rgba(245,158,11,0.08)",
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(245,158,11,0.28)",
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 18,
                  marginBottom: 28,
                }}
              >
                {/* Crown circle */}
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: "rgba(245,158,11,0.18)",
                  alignItems: "center", justifyContent: "center",
                  marginRight: 16,
                }}>
                  <Text style={{ fontSize: 26 }}>👑</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 17, color: ACCENT_LIFETIME }}>
                      {t("prem_founder_member")}
                    </Text>
                    <View style={{
                      backgroundColor: "rgba(245,158,11,0.18)",
                      borderRadius: 6,
                      paddingHorizontal: 7, paddingVertical: 2,
                      borderWidth: 1, borderColor: "rgba(245,158,11,0.35)",
                    }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: ACCENT_LIFETIME, letterSpacing: 0.5 }}>
                        LIFETIME
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary }}>
                    {t("prem_founder_tagline")}
                  </Text>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 18, marginLeft: 8 }}>›</Text>
              </TouchableOpacity>

              {/* ── {t("prem_exclusive_features")} ── */}
              <Text style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 11,
                color: ACCENT_LIFETIME,
                letterSpacing: 1.5,
                marginBottom: 14,
              }}>
                {t("prem_exclusive_features_label").toUpperCase()}
              </Text>

              {[
                { icon: "♾️",  label: t("prem_feat_unlimited_history"),   route: null },
                { icon: "📊",  label: t("yearly_report_pdf"),       route: "/(tabs)/statistik" },
                { icon: "🤖",  label: t("prem_feat_ai_analysis"),          route: "/ai-quarterly-analysis" },
                { icon: "😴",  label: t("prem_lifetime_feat_sleep"),       route: null },
                { icon: "📦",  label: t("prem_feat_feature_voting"),       route: "/feature-voting" },
                { icon: "👑",  label: t("prem_feat_founder_badge"),        route: "/lifetime-profile" },
              ].map((f, i, arr) => (
                <View key={i}>
                  <TouchableOpacity
                    activeOpacity={f.route ? 0.75 : 1}
                    onPress={f.route ? () => router.push(f.route) : undefined}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: f.route ? "rgba(245,158,11,0.20)" : "rgba(255,255,255,0.07)",
                    }}
                  >
                    <View style={{
                      width: 46, height: 46, borderRadius: 12,
                      backgroundColor: f.route ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.07)",
                      alignItems: "center", justifyContent: "center",
                      marginRight: 14,
                    }}>
                      <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                    </View>

                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 15, color: colors.text, flex: 1 }}>
                      {f.label}
                    </Text>

                    {f.route
                      ? <Text style={{ color: ACCENT_LIFETIME, fontSize: 18 }}>›</Text>
                      : <Text style={{ color: ACCENT_LIFETIME, fontSize: 17 }}>✓</Text>
                    }
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={{ height: 10 }} />}
                </View>
              ))}

              {/* ── Plan wechseln ── */}
              <View style={{ marginTop: 20, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: colors.textSecondary, marginBottom: 4, letterSpacing: 0.5 }}>
                  PLAN WECHSELN
                </Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginBottom: 12, opacity: 0.7 }}>
                  Zum Testen oder Zurücksetzen
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { label: "→ Pro",   plan: "pro" },
                    { label: "→ " + t("basis"), plan: "free" },
                  ].map((b) => (
                    <TouchableOpacity
                      key={b.plan}
                      onPress={async () => {
                        try {
                          await setDevPlanOverride(b.plan);
                          setEffectivePlan(b.plan);
                          DeviceEventEmitter.emit("stillmind:planChanged");
                        } catch (_) {}
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: b.plan === "free" ? "rgba(255,80,80,0.08)" : "rgba(205,185,138,0.10)",
                        paddingVertical: 10, borderRadius: 10, alignItems: "center",
                        borderWidth: 1,
                        borderColor: b.plan === "free" ? "rgba(255,80,80,0.20)" : "rgba(205,185,138,0.25)",
                      }}
                    >
                      <Text style={{
                        fontFamily: "Montserrat_600SemiBold", fontSize: 12,
                        color: b.plan === "free" ? "rgba(255,120,120,0.9)" : ACCENT_LIFETIME,
                      }}>{b.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════ PREMIUM LIFE – KAUFEN ══════════════════ */}
          {!isLifetimeActive && (
          <View style={{
            backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 22,
            borderWidth: 1.5, borderColor: "rgba(245,158,11,0.38)",
            marginBottom: 14, overflow: "hidden",
          }}>
            <View style={{ backgroundColor: "rgba(245,158,11,0.10)", paddingHorizontal: 18, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>💎</Text>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#fff" }}>{t("premium_life")}</Text>
              </View>
              <View style={{ backgroundColor: "#F59E0B", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5, borderColor: "#FCD34D", shadowColor: "#F59E0B", shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#000", letterSpacing: 0.5 }}>⚡ {t("prem_lifetime_badge")}</Text>
              </View>
            </View>

            <View style={{ padding: 18 }}>
              {/* Preis */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 30, color: "#fff" }}>{lifetimePrice || "99 €"}</Text>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 16, color: "rgba(255,255,255,0.32)", textDecorationLine: "line-through" }}>149 €</Text>
                  <View style={{ backgroundColor: "rgba(239,68,68,0.35)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 2, borderColor: "#EF4444", shadowColor: "#EF4444", shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }}>
                    <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 11, color: "#FF6B6B", letterSpacing: 0.5 }}>{t("prem_price_badge")}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: ACCENT_LIFETIME, marginTop: 3 }}>
                  {t("prem_lifetime_one_time")}
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

              {/* Badge */}
              <View style={{ backgroundColor: "rgba(245,158,11,0.08)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.20)" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: ACCENT_LIFETIME, marginBottom: 3 }}>{t("prem_one_time_own")}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
                  {t("prem_one_time_own_sub")}
                </Text>
              </View>

              {/* Features */}
              {[
                { text: t("prem_all_pro_permanent"), highlight: true },
                { text: t("prem_unlimited_no_limit"), highlight: true },
                { text: t("prem_lifetime_feat_sleep"), highlight: true },
                { text: t("yearly_trends"), highlight: true },
                { text: t("prem_feat_themes"), highlight: false },
                { text: t("prem_feat_future"), highlight: true },
                { text: t("prem_lifetime_badge"), highlight: false },
                { text: t("prem_feat_priority"), highlight: false },
              ].map((f, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <Text style={{ fontSize: 14, color: ACCENT_LIFETIME }}>✓</Text>
                  <Text style={{ fontFamily: f.highlight ? "Montserrat_500Medium" : "Montserrat_400Regular", fontSize: 13, color: f.highlight ? "#fff" : colors.textSecondary }}>{f.text}</Text>
                </View>
              ))}

              {/* Amortisierung */}
              <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                  {t("prem_lifetime_value_hint").replace("{{yearly}}", priceYearly || "59 €").replace("{{years}}", lifetimeYears).replace("{{year_word}}", lifetimeYears === 1 ? t("prem_year_singular") : t("prem_year_plural"))}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handlePurchase(PLAN_IDS.LIFETIME)}
                disabled={purchasing === PLAN_IDS.LIFETIME}
                style={{ height: 56, borderRadius: 16, backgroundColor: ACCENT_LIFETIME, justifyContent: "center", alignItems: "center" }}
              >
                {purchasing === PLAN_IDS.LIFETIME
                  ? <ActivityIndicator color="#000" />
                  : <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "#000" }}>
                      {t("prem_buy_once").replace("{{price}}", lifetimePrice || "99 €")}
                    </Text>
                }
              </TouchableOpacity>
              <Text style={{ marginTop: 7, fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, textAlign: "center" }}>
                {t("prem_one_time_footer")}
              </Text>
            </View>
          </View>
          )}

          {/* ── Restore ── */}
          <TouchableOpacity onPress={handleRestore} disabled={purchasing === "restore"} style={{ alignItems: "center", paddingVertical: 12, marginBottom: 4 }}>
            {purchasing === "restore"
              ? <ActivityIndicator />
              : <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary, textDecorationLine: "underline" }}>{t("prem_restore")}</Text>
            }
          </TouchableOpacity>

          {/* ── Offer Code Redemption (iOS only) ── */}
          {Platform.OS === "ios" && (
            <TouchableOpacity
              onPress={handleRedeemCode}
              style={{ alignItems: "center", paddingVertical: 12, marginBottom: 4 }}
            >
              <Text style={{
                fontFamily: "Montserrat_500Medium",
                fontSize: 13,
                color: colors.textSecondary,
                textDecorationLine: "underline",
              }}>
                {t("prem_redeem_code")}
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Legal ── */}
          <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
              {t("prem_billing_footer").replace(/\{\{store\}\}/g, storeLabel)}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, textDecorationLine: "underline" }} onPress={() => openUrl(PRIVACY_URL)}>{t("prem_footer_privacy")}</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, textDecorationLine: "underline" }} onPress={() => openUrl(TERMS_URL)}>{t("prem_footer_terms")}</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text, textDecorationLine: "underline" }} onPress={() => router.push("/legal/impressum")}>{t("prem_footer_imprint")}</Text>
            </View>
          </View>

          {/* ── DEV ── */}
          {__DEV__ && devOpen && (
            <View style={{ marginTop: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>DEV – Plan simulieren</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[{ t: "Free", v: "free" }, { t: "Pro", v: "pro" }, { t: "Lifetime", v: "lifetime" }, { t: "Reset", v: null }].map((b) => (
                  <TouchableOpacity key={String(b.v)} onPress={() => applyDev(b.v)} style={{ backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: colors.text }}>{b.t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
