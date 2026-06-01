// app/sos-extended.jsx — Erweiterter SOS-Modus (ab Pro)
// Kontextbezogene Soforthilfe: Stress, Wut, Angst, Überforderung, Panik
// Jeder Kontext startet die passende Atemübung via /session-run/breath?breathing=KEY
import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from "@expo-google-fonts/montserrat";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";
import { canStartSession } from "@/utils/storage";

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");

// ── SOS Kontexte ────────────────────────────────────────────────────────────
// breathingKey → startet echte Atemübung in session-run/breath?breathing=KEY
// Jede Technik ist wissenschaftlich auf den Kontext abgestimmt:

export default function SOSExtendedScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const SOS_CONTEXTS = useMemo(() => [
  {
    id: "stress",
    icon: "⚡",
    label: t("sos_scenario_stress_label"),
    color: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.30)",
    accent: "#EF4444",
    desc: t("sos_scenario_stress_desc"),
    breathingKey: "long_exhale",      // 4s ein · 8s aus – Vagusnerv-Aktivierung,
    breathingLabel: t("sos_scenario_stress_bl"),
    breathingDetail: t("sos_stress_detail"),
    steps: [
      t("sos_scenario_stress_step1"),
      t("sos_scenario_stress_step2"),
      t("sos_scenario_stress_step3"),
      t("sos_scenario_stress_step4"),
    ],
    tip: t("sos_scenario_stress_tip"),
  },
  {
    id: "anger",
    icon: "🌋",
    label: t("sos_scenario_anger_label"),
    color: "rgba(251,146,60,0.12)",
    border: "rgba(251,146,60,0.28)",
    accent: "#FB923C",
    desc: t("sos_scenario_anger_desc"),
    breathingKey: "phys_sigh",        // tief ein · kurzer Nachatem · lang aus – akuter Reset,
    breathingLabel: t("sos_scenario_anger_bl"),
    breathingDetail: t("sos_scenario_anger_bd"),
    steps: [
      t("sos_scenario_anger_step1"),
      t("sos_scenario_anger_step2"),
      t("sos_scenario_anger_step3"),
      t("sos_scenario_anger_step4"),
    ],
    tip: t("sos_scenario_anger_tip"),
  },
  {
    id: "anxiety",
    icon: "🌀",
    label: t("sos_scenario_anxiety_label"),
    color: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.28)",
    accent: "#8B5CF6",
    desc: t("sos_scenario_anxiety_desc"),
    breathingKey: "box",              // 4-4-4-4 – strukturiert, erdet, stoppt Gedankenspirale,
    breathingLabel: t("sos_scenario_anxiety_bl"),
    breathingDetail: t("sos_anxiety_detail"),
    steps: [
      t("sos_scenario_anxiety_step1"),
      t("sos_scenario_anxiety_step2"),
      t("sos_scenario_anxiety_step3"),
      t("sos_scenario_anxiety_step4"),
    ],
    tip: t("sos_scenario_anxiety_tip"),
  },
  {
    id: "overwhelm",
    icon: "🌊",
    label: t("sos_scenario_overwhelm_label"),
    color: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.25)",
    accent: "#06B6D4",
    desc: t("sos_scenario_overwhelm_desc"),
    breathingKey: "counting",         // Zählen zieht aus Überforderungs-Loop, gibt Struktur,
    breathingLabel: t("sos_scenario_overwhelm_bl"),
    breathingDetail: t("sos_counting_detail"),
    steps: [
      t("sos_scenario_overwhelm_step1"),
      t("sos_scenario_overwhelm_step2"),
      t("sos_scenario_overwhelm_step3"),
      t("sos_scenario_overwhelm_step4"),
    ],
    tip: t("sos_scenario_overwhelm_tip"),
  },
  {
    id: "panic",
    icon: "💙",
    label: t("sos_scenario_panic_label"),
    color: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.28)",
    accent: "#3B82F6",
    desc: t("sos_scenario_panic_desc"),
    breathingKey: "diaphragmatic",    // 4s ein · 6s aus, kein Halten – sanft, für Panik geeignet,
    breathingLabel: t("sos_scenario_panic_bl"),
    breathingDetail: t("sos_panic_detail"),
    steps: [
      t("sos_scenario_panic_step1"),
      t("sos_scenario_panic_step2"),
      t("sos_scenario_panic_step3"),
      t("sos_scenario_panic_step4"),
    ],
    tip: t("sos_scenario_panic_tip"),
  },
], [t]);
  const { colors } = useStillMindTheme();
  const [selected, setSelected] = useState(null);
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });

  const startSession = async (ctx) => {
    try {
      const status = await canStartSession();
      if (!(status && status.canStart)) {
        Alert.alert(t("home_no_session"), t("sos_all_sessions_used"), [
          { text: "OK", style: "cancel" },
          { text: t("view_premium"), onPress: () => router.push("/(tabs)/premium") },
        ]);
        return;
      }
      // Alle SOS-Kontexte haben eine passende Atemtechnik → immer Breathing-Modus
      router.push(`/session-run/breath?breathing=${ctx.breathingKey}&source=sos_extended`);
    } catch (e) {
      console.error(e);
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const RED = "#EF4444";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image source={LOGO} resizeMode="contain" style={{ width: 72, height: 72, opacity: 0.97 }} />
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary }}>{t("back_btn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: RED }} />
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: RED, letterSpacing: 2 }}>{t("sos_modus_label")}</Text>
          </View>
          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 32, color: colors.text, letterSpacing: -0.5, marginBottom: 4 }}>{t("sos_title")}</Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary }}>{t("sos_subtitle")}</Text>
        </View>

        {/* Context Cards */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 }}>
          {SOS_CONTEXTS.map(ctx => {
            const isSelected = (selected && selected.id) === ctx.id;
            return (
              <TouchableOpacity
                key={ctx.id}
                onPress={() => setSelected(isSelected ? null : ctx)}
                activeOpacity={0.82}
                style={{
                  marginBottom: 10, borderRadius: 18, overflow: "hidden",
                  backgroundColor: isSelected ? ctx.color : "rgba(255,255,255,0.04)",
                  borderWidth: 1.5,
                  borderColor: isSelected ? ctx.border : "rgba(255,255,255,0.08)",
                }}
              >
                {/* Collapsed row */}
                <View style={{ flexDirection: "row", alignItems: "center", padding: 18, gap: 14 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: isSelected ? ctx.color : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: isSelected ? ctx.border : "rgba(255,255,255,0.10)" }}>
                    <Text style={{ fontSize: 24 }}>{ctx.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: isSelected ? ctx.accent : colors.text, marginBottom: 2 }}>{ctx.label}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{ctx.desc}</Text>
                    {/* Technik-Badge: immer sichtbar damit Nutzer schon vor Öffnen weiß was kommt */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 }}>
                      <Text style={{ fontSize: 10 }}>🫁</Text>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 10, color: ctx.accent, opacity: isSelected ? 1 : 0.65 }}>
                        {ctx.breathingLabel} · {ctx.breathingDetail}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 16, color: colors.textSecondary, opacity: 0.5 }}>{isSelected ? "▲" : "▼"}</Text>
                </View>

                {/* Expanded */}
                {isSelected && (
                  <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                    <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 16 }} />

                    {/* Steps */}
                    {ctx.steps.map((step, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ctx.color, borderWidth: 1, borderColor: ctx.border, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 11, color: ctx.accent }}>{i + 1}</Text>
                        </View>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.text, flex: 1, lineHeight: 20 }}>{step}</Text>
                      </View>
                    ))}

                    {/* Tip */}
                    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 12, marginTop: 6, marginBottom: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                      <Text style={{ fontSize: 14 }}>💡</Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, flex: 1, lineHeight: 18, fontStyle: "italic" }}>{ctx.tip}</Text>
                    </View>

                    {/* Vorbereitungsschritte vor dem Session-Start */}
                    <View style={{ backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 14, marginBottom: 14 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 0.8, marginBottom: 10, textTransform: "uppercase" }}>
                        {t("sos_before_start")}
                      </Text>
                      {[
                        t("sos_before_step1"),
                        t("sos_before_step2"),
                        t("sos_before_step3"),
                        t("sos_before_step4"),
                      ].map((step, i) => (
                        <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: i < 3 ? 8 : 0, alignItems: "flex-start" }}>
                          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: ctx.accent, marginTop: 2, width: 16 }}>{i + 1}.</Text>
                          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.80)", flex: 1, lineHeight: 18 }}>{step}</Text>
                        </View>
                      ))}
                    </View>

                    {/* CTA → startet echte Atemübung */}
                    <TouchableOpacity
                      onPress={() => startSession(ctx)}
                      activeOpacity={0.85}
                      style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: ctx.accent, shadowColor: ctx.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
                    >
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#fff" }}>
                        {t("sos_start_btn", {bl: ctx.breathingLabel})}
                      </Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                        {ctx.breathingDetail}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info */}
        <View style={{ paddingHorizontal: 24, marginTop: 4 }}>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, textAlign: "center", lineHeight: 18 }}>
            {t("sos_disclaimer")}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
