// app/lifetime-profile.jsx — Lifetime Badge & Gründerstatus
import React, { useCallback, useRef, useState , useMemo} from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Animated, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import {
  useFonts, Montserrat_400Regular, Montserrat_500Medium,
  Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import {
  getSessionHistory, getUserPlan, getDailyStreak, getUserName,
  getEarnedBadges, STREAK_BADGES,
} from "@/utils/storage";
import { useI18n, t } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");

export default function LifetimeProfileScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();

  const PERKS = useMemo(() => [
  { icon:"♾️",  title:t("lp_feat_history_title"),  desc:t("lp_feat_history_desc") },
  { icon:"📊",  title:t("yearly_report"),           desc:t("lp_feat_report_desc") },
  { icon:"🤖",  title:t("lp_feat_ai_title"),  desc:t("lp_feat_ai_desc") },
  { icon:"🗳️", title:t("lp_feat_voting_title"),  desc:t("lp_feat_voting_desc") },
  { icon:"⚡",  title:t("lp_feat_beta_title"),  desc:t("lp_feat_beta_desc") },
], [t]);
  const { colors } = useStillMindTheme();
  const [plan, setPlan]   = useState("free");
  const [name, setName]   = useState("");
  const [stats, setStats] = useState(null);
  const shimmer  = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular, Montserrat_500Medium,
    Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold,
  });

  useFocusEffect(useCallback(() => {
    (async () => {
      const [hist, p, n] = await Promise.all([
        getSessionHistory().catch(() => []),
        getUserPlan().catch(() => "free"),
        getUserName().catch(() => ""),
      ]);
      const [streak, badges] = await Promise.all([
        getDailyStreak(hist).catch(() => 0),
        getEarnedBadges(p).catch(() => []),
      ]);
      const totalSessions = hist.filter(e => e && (e.type === "start" || !e.type)).length;
      const totalMinutes  = hist.reduce((s, e) => s + Math.round(Number((e && e.durationSec) || 60) / 60), 0);
      setPlan(p); setName(n || "");
      setStats({ totalSessions, totalMinutes, streak, badges });

      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

      // Shimmer pulse
      Animated.loop(Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])).start();
    })();
  }, []));

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const isLifetime = plan === "lifetime";
  const A = "#CDB98A", G = "rgba(205,185,138,0.08)", B = "rgba(205,185,138,0.18)";
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.0] });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Ich meditiere mit StillMind${name ? `, ${name},` : ""} und bin Gründer-Mitglied. ${(stats && stats.totalSessions) || 0} Sessions — und es geht weiter. 🪷`,
        title: t("lp_founder_title"),
      });
    } catch (_) {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image source={LOGO} resizeMode="contain" style={{ width: 72, height: 72, opacity: 0.97 }} />
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary }}>{t("back_btn")}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <Animated.View style={{ opacity: fadeAnim, alignItems: "center", paddingHorizontal: 24, marginBottom: 24 }}>
          <Animated.View style={{ opacity: shimmerOpacity }}>
            <View style={{
              width: 128, height: 128, borderRadius: 64, marginBottom: 18,
              backgroundColor: G, borderWidth: 2, borderColor: B,
              alignItems: "center", justifyContent: "center",
              shadowColor: A, shadowOffset: { width: 0, height: 0 },
              shadowOpacity: isLifetime ? 0.45 : 0.08, shadowRadius: 28,
            }}>
              <Text style={{ fontSize: 60 }}>👑</Text>
            </View>
          </Animated.View>

          <Text style={{ fontFamily: "Montserrat_800ExtraBold", fontSize: 26, color: A, letterSpacing: -0.5, marginBottom: 6, textAlign: "center" }}>
            {isLifetime ? t("founder_member") : t("premium_life")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 21, paddingHorizontal: 16 }}>
            {isLifetime
              ? (name ? t("lp_founder_msg_active", {name: name+", "}) : t("lp_founder_msg_active_anon"))
              : t("lp_founder_msg_inactive")}
          </Text>

          {isLifetime && (
            <TouchableOpacity onPress={handleShare} style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: G, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: B }}>
              <Text style={{ fontSize: 15 }}>↗️</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: A }}>{t("lifetime_share_status")}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Stats (nur wenn Lifetime) */}
        {isLifetime && stats && (
          <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 24, marginBottom: 18 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { label: t("sessions_word"),  value: stats.totalSessions, icon: "🧘" },
                { label: t("minutes"),   value: stats.totalMinutes,  icon: "⏱" },
                { label: t("lp_streak_label"), value: `${stats.streak}T`, icon: stats.streak >= 30 ? "💎" : stats.streak >= 7 ? "🔥" : "⚡" },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: G, borderRadius: 16, borderWidth: 1, borderColor: B, padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, marginBottom: 5 }}>{item.icon}</Text>
                  <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: colors.text }}>{item.value}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: A, marginTop: 2 }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Badges */}
        {isLifetime && (stats && stats.badges) && stats.badges.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 24, marginBottom: 18 }}>
            <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 18 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text, marginBottom: 14 }}>
                {t("lifetime_achievements")} · {stats.badges.length}/{STREAK_BADGES.length}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {STREAK_BADGES.map(badge => {
                  const earned = stats.badges.includes(badge.id);
                  return (
                    <View key={badge.id} style={{ backgroundColor: earned ? G : "rgba(255,255,255,0.03)", borderRadius: 11, borderWidth: 1, borderColor: earned ? B : "rgba(255,255,255,0.07)", paddingHorizontal: 11, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, opacity: earned ? 1 : 0.3 }}>
                      <Text style={{ fontSize: 15 }}>{badge.icon}</Text>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: earned ? A : colors.textSecondary }}>{lang === "en" && badge.labelEn ? badge.labelEn : badge.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Quick nav buttons (nur Lifetime) */}
        {isLifetime && (
          <View style={{ paddingHorizontal: 24, marginBottom: 18, flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={() => router.push("/ai-quarterly-analysis")} activeOpacity={0.85} style={{ flex: 1, backgroundColor: G, borderRadius: 16, borderWidth: 1, borderColor: B, padding: 16, alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>🤖</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: A, textAlign: "center" }}>{t("lifetime_nav_ki")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/feature-voting")} activeOpacity={0.85} style={{ flex: 1, backgroundColor: G, borderRadius: 16, borderWidth: 1, borderColor: B, padding: 16, alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>🗳️</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: A, textAlign: "center" }}>{t("lifetime_feature_voting")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/monthly-reflection")} activeOpacity={0.85} style={{ flex: 1, backgroundColor: G, borderRadius: 16, borderWidth: 1, borderColor: B, padding: 16, alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 24 }}>📊</Text>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: A, textAlign: "center" }}>{t("lifetime_nav_reflexion")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Perks list */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: A, letterSpacing: 1.5, marginBottom: 14 }}>{t("lifetime_your_benefits")}</Text>
          {PERKS.map((p, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 14, backgroundColor: G, borderRadius: 16, borderWidth: 1, borderColor: B, padding: 16, marginBottom: 10, alignItems: "flex-start" }}>
              <Text style={{ fontSize: 22, lineHeight: 26 }}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: isLifetime ? colors.text : colors.textSecondary, marginBottom: 3 }}>{p.title}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>{p.desc}</Text>
              </View>
              {isLifetime && <Text style={{ fontSize: 12, color: A }}>✓</Text>}
            </View>
          ))}
        </View>

        {/* CTA wenn nicht Lifetime */}
        {!isLifetime && (
          <View style={{ paddingHorizontal: 24 }}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/premium")} activeOpacity={0.85} style={{ backgroundColor: A, borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowColor: A, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 8 }}>
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#0C0B09" }}>{t("lifetime_unlock_title")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(12,11,9,0.55)", marginTop: 3 }}>{t("prem_once_forever")}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
