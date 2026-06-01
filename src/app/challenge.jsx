// challenge.jsx — 7-Tage StillMind Kurs
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import CelebrationModal from "@/components/CelebrationModal";
import {
  View, Text, ScrollView, TouchableOpacity,
  Animated, Easing, Image, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserPlan } from "@/utils/storage";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { useFocusEffect } from "@react-navigation/native";
import { getSessionHistory, canStartSession } from "@/utils/storage";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";
import { Alert } from "react-native";

const STILLMIND_LOGO = require("../assets/brand/stillmind-logo-transparent.png");


export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [plan, setPlan] = useState("free");
  useEffect(() => { getUserPlan().then(p => setPlan(p || "free")).catch(() => {}); }, []);

  const DAYS = useMemo(() => [
  {
    day: 1,
    title: t("challenge_day_1_title"),
    subtitle: t("chal_day_1_subtitle"),
    desc: t("challenge_day_1_desc"),
    icon: "🌱",
    mode: t("challenge_day_1_mode"),
    modeId: "calm",
    durationSec: 60,
    duration: `1 ${t("challenge_min")}`,
    tip: t("challenge_day_1_tip"),
  },
  {
    day: 2,
    title: t("challenge_day_2_title"),
    subtitle: t("chal_day_2_subtitle"),
    desc: t("challenge_day_2_desc"),
    icon: "⚓",
    mode: t("challenge_day_2_mode"),
    modeId: "focus",
    durationSec: 60,
    duration: `1 ${t("challenge_min")}`,
    tip: t("challenge_day_2_tip"),
  },
  {
    day: 3,
    title: t("challenge_day_3_title"),
    subtitle: t("chal_day_3_subtitle"),
    desc: t("challenge_day_3_desc"),
    icon: "🌊",
    mode: t("challenge_day_1_mode"),
    modeId: "calm",
    durationSec: 120,
    duration: `2 ${t("challenge_min")}`,
    tip: t("challenge_day_3_tip"),
  },
  {
    day: 4,
    title: t("challenge_day_4_title"),
    subtitle: t("chal_day_4_subtitle"),
    desc: t("challenge_day_4_desc"),
    icon: "⚡",
    mode: t("challenge_day_4_mode"),
    modeId: "emotion",
    durationSec: 120,
    duration: `2 ${t("challenge_min")}`,
    tip: t("challenge_day_4_tip"),
  },
  {
    day: 5,
    title: t("chal_day_5_title"),
    subtitle: t("chal_day_5_subtitle"),
    desc: t("chal_day_5_desc"),
    icon: "🌅",
    mode: t("mode_work"),
    modeId: "work",
    durationSec: 180,
    duration: `3 ${t("challenge_min")}`,
    tip: t("chal_day_5_tip"),
  },
  {
    day: 6,
    title: t("chal_day_6_title"),
    subtitle: t("chal_day_6_subtitle"),
    desc: t("chal_day_6_desc"),
    icon: "🧘",
    mode: t("mode_sleep"),
    modeId: "sleep",
    durationSec: 180,
    duration: `3 ${t("challenge_min")}`,
    tip: t("chal_day_6_tip"),
  },
  {
    day: 7,
    title: t("chal_day_7_title"),
    subtitle: t("chal_day_7_subtitle"),
    desc: t("chal_day_7_desc"),
    icon: "🏆",
    mode: t("challenge_day_1_mode"),
    modeId: "calm",
    durationSec: 300,
    duration: `5 ${t("challenge_min")}`,
    tip: t("chal_day_7_tip"),
    isLast: true,
  },
], [t]);
  const { colors } = useStillMindTheme();
  const [completedDays, setCompletedDays] = useState(new Set());
  const [expandedDay, setExpandedDay] = useState(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const prevCompletedCount = useRef(0);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  const loadProgress = useCallback(async () => {
    try {
      const history = await getSessionHistory();
      if (!Array.isArray(history)) return;
      const done = new Set(
        history
          .filter(h => (h && h.type) !== "end" && (h && h.challengeDay))
          .map(h => Number(h.challengeDay))
          .filter(d => d >= 1 && d <= 7)
      );
      if (done.size >= 7 && prevCompletedCount.current < 7) {
        setCelebrationVisible(true);
      }
      prevCompletedCount.current = done.size;
      setCompletedDays(done);
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { loadProgress(); }, [loadProgress]));

  const startSession = async (day) => {
    try {
      const status = await canStartSession();
      if (!(status && status.canStart)) {
        Alert.alert(
          t("home_no_session"),
          t("challenge_used_sessions"),
          [
            { text: "OK", style: "cancel" },
            { text: t("view_premium"), onPress: () => router.push("/(tabs)/premium") },
          ]
        );
        return;
      }
      router.push({
        pathname: "/session-run/quick",
        params: {
          mode: day.modeId,
          duration: String(day.durationSec),
          source: "challenge",
          challengeDay: String(day.day),
        },
      });
    } catch (e) {
      console.error("Challenge start error:", e);
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const completedCount = completedDays.size;
  const ACCENT = "#CDB98A";
  const ACCENT_DIM = "rgba(205,185,138,0.45)";
  const BORDER = "rgba(205,185,138,0.14)";
  const GREEN = "#4ADE80";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER — gleich wie andere Tabs ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image source={STILLMIND_LOGO} resizeMode="contain" style={{ width: 72, height: 72, opacity: 0.97 }} />
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)")}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}
          >
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary }}>{t("back_btn")}</Text>
          </TouchableOpacity>
        </View>

        {/* ── TITLE ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 36, color: colors.text, letterSpacing: -0.5, marginBottom: 4 }}>
            {t("challenge_title")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, lineHeight: 21 }}>
            {t("challenge_subtitle")}
          </Text>
        </View>

        {/* ── PROGRESS CARD ── */}
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <View style={{
            backgroundColor: "rgba(205,185,138,0.07)",
            borderRadius: 18, borderWidth: 1, borderColor: BORDER,
            padding: 18,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>
                {completedCount >= 7 ? t("challenge_complete") : t("challenge_day_progress").replace("{{n}}", completedCount + 1)}
              </Text>
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 14, color: ACCENT }}>
                {completedCount}/7
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <View style={{
                height: 8,
                width: `${Math.round((completedCount / 7) * 100)}%`,
                backgroundColor: ACCENT, borderRadius: 4,
              }} />
            </View>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: ACCENT_DIM, marginTop: 8 }}>
              {completedCount === 0
                ? t("challenge_start_hint")
                : completedCount >= 7
                ? t("challenge_mastered")
                : `Noch ${7 - completedCount} Tage bis zum Ziel.`}
            </Text>
          </View>
        </View>

        {/* ── DAY CARDS ── */}
        <View style={{ paddingHorizontal: 16 }}>
          {DAYS.map((day) => {
            const isCompleted = completedDays.has(day.day);
            const isExpanded  = expandedDay === day.day;
            const isActive    = day.day === Math.min(completedCount + 1, 7);

            return (
              <TouchableOpacity
                key={day.day}
                activeOpacity={0.82}
                onPress={() => setExpandedDay(isExpanded ? null : day.day)}
                style={{
                  backgroundColor: isExpanded
                    ? "rgba(205,185,138,0.07)"
                    : "rgba(255,255,255,0.04)",
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isActive && !isCompleted
                    ? ACCENT
                    : isCompleted
                    ? "rgba(74,222,128,0.25)"
                    : "rgba(255,255,255,0.08)",
                  marginBottom: 10,
                  overflow: "hidden",
                }}
              >
                {/* Active gold top line */}
                {isActive && !isCompleted && (
                  <View style={{ height: 2, backgroundColor: ACCENT, opacity: 0.65 }} />
                )}

                {/* Row */}
                <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}>
                  {/* Circle */}
                  <View style={{
                    width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                    backgroundColor: isCompleted
                      ? "rgba(74,222,128,0.12)"
                      : isActive
                      ? "rgba(205,185,138,0.14)"
                      : "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: isCompleted
                      ? "rgba(74,222,128,0.35)"
                      : isActive
                      ? ACCENT
                      : "rgba(255,255,255,0.10)",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    {isCompleted
                      ? <Text style={{ fontSize: 20, color: GREEN }}>✓</Text>
                      : <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 16, color: isActive ? ACCENT : colors.textSecondary }}>{day.day}</Text>
                    }
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{
                      fontFamily: "Montserrat_600SemiBold", fontSize: 15,
                      color: isCompleted ? GREEN : colors.text,
                      marginBottom: 3,
                    }}>
                      {day.icon}  {day.title}
                    </Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary }}>
                      {day.subtitle}
                    </Text>
                  </View>

                  <Text style={{ color: colors.textSecondary, fontSize: 16, opacity: 0.6 }}>
                    {isExpanded ? "▲" : "▼"}
                  </Text>
                </View>

                {/* Expanded */}
                {isExpanded && (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 14 }} />

                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text, lineHeight: 22, marginBottom: 14 }}>
                      {day.desc}
                    </Text>

                    {/* Tip */}
                    <View style={{
                      backgroundColor: "rgba(205,185,138,0.06)",
                      borderRadius: 12, borderWidth: 1, borderColor: BORDER,
                      padding: 12, marginBottom: 14,
                      flexDirection: "row", gap: 10, alignItems: "flex-start",
                    }}>
                      <Text style={{ fontSize: 15 }}>💡</Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: ACCENT_DIM, flex: 1, lineHeight: 19 }}>
                        {day.tip}
                      </Text>
                    </View>

                    {/* Duration + Mode */}
                    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                      <View style={{
                        flex: 1, backgroundColor: "rgba(255,255,255,0.04)",
                        borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                        padding: 12, alignItems: "center",
                      }}>
                        <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: colors.text }}>{day.duration}</Text>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: colors.textSecondary, marginTop: 2, letterSpacing: 1 }}>{t("challenge_duration_label")}</Text>
                      </View>
                      <View style={{
                        flex: 2, backgroundColor: "rgba(255,255,255,0.04)",
                        borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
                        padding: 12, alignItems: "center",
                      }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: colors.text }}>{day.mode}</Text>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: colors.textSecondary, marginTop: 2, letterSpacing: 1 }}>{t("challenge_mode_label")}</Text>
                      </View>
                    </View>

                    {/* CTA */}
                    <TouchableOpacity
                      onPress={() => startSession(day)}
                      activeOpacity={0.85}
                      style={{
                        borderRadius: 14, height: 52,
                        alignItems: "center", justifyContent: "center",
                        backgroundColor: isCompleted ? "rgba(74,222,128,0.12)" : ACCENT,
                        borderWidth: isCompleted ? 1 : 0,
                        borderColor: "rgba(74,222,128,0.30)",
                        shadowColor: isCompleted ? "transparent" : ACCENT,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.28, shadowRadius: 12, elevation: 8,
                      }}
                    >
                      <Text style={{
                        fontFamily: "Montserrat_600SemiBold", fontSize: 15,
                        color: isCompleted ? GREEN : "#0C0B09",
                      }}>
                        {isCompleted ? t("challenge_day_repeat") : t("challenge_day_start").replace("{{n}}", day.day)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── BOTTOM CTA – only for free users ── */}
        {plan === "free" && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View style={{
            backgroundColor: "rgba(205,185,138,0.06)",
            borderRadius: 18, borderWidth: 1, borderColor: BORDER,
            padding: 20, alignItems: "center",
          }}>
            <Text style={{ fontSize: 26, marginBottom: 10 }}>✦</Text>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text, textAlign: "center", marginBottom: 8 }}>
              {t("challenge_ready_title")}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 16 }}>
              {t("challenge_ready_body")}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/premium")}
              activeOpacity={0.85}
              style={{ backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32 }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#0C0B09" }}>
                {t("challenge_ready_btn")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

      </ScrollView>
      <CelebrationModal
        visible={celebrationVisible}
        onClose={() => setCelebrationVisible(false)}
        emoji="🏆"
        title={t("celeb_challenge_title")}
        subtitle={t("celeb_challenge_sub")}
        ctaLabel={t("celeb_challenge_cta")}
      />
    </View>
  );
}
