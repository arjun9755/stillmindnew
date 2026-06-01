// app/ai-quarterly-analysis.jsx — KI-Quartalsanalyse (Lifetime only)
// Nutzt Anthropic Claude API direkt aus dem App heraus
import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Animated, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import {
  useFonts, Montserrat_400Regular, Montserrat_500Medium,
  Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold,
} from "@expo-google-fonts/montserrat";
import { getSessionHistory, getUserPlan, getDailyStreak, getUserName } from "@/utils/storage";
import { useI18n } from "@/utils/i18n";
import { useStillMindTheme } from "@/utils/stillmind-theme";

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");

// Quartal berechnen
function getCurrentQuarter() {
  const m = new Date().getMonth();
  return Math.floor(m / 3) + 1;
}

function getQuarterRange(offset = 0) {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + offset;
  const year = now.getFullYear() + Math.floor(q / 4);
  const quarter = ((q % 4) + 4) % 4;
  const startMonth = quarter * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { start, end, quarter: quarter + 1, year };
}

function buildQuarterStats(history, start, end) {
  const list = (Array.isArray(history) ? history : []).filter(e => {
    if (!e || (e.type && e.type !== "start")) return false;
    const ts = Number(e.timestamp || e.date || 0);
    return ts >= start.getTime() && ts <= end.getTime();
  });

  const totalSessions = list.length;
  const totalMinutes  = list.reduce((s, e) => s + Math.round(Number(e.durationSec || 60) / 60), 0);
  const avgMinutes    = totalSessions > 0 ? (totalMinutes / totalSessions).toFixed(1) : 0;

  const modeCounts = {};
  list.forEach(e => { const m = e.mode || e.modeId || "calm"; modeCounts[m] = (modeCounts[m] || 0) + 1; });
  const topMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0] && [0] || "-";

  const moodValues = list.map(e => Number(e.mood)).filter(v => v >= 1 && v <= 5);
  const avgMood = moodValues.length > 0 ? (moodValues.reduce((a, b) => a + b, 0) / moodValues.length).toFixed(1) : null;

  const daySet = new Set(list.map(e => {
    const d = new Date(Number(e.timestamp || e.date || 0));
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  // Consistency: % of days in quarter that had a session
  const totalDaysInRange = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const consistencyPct = totalDaysInRange > 0 ? Math.round((daySet.size / totalDaysInRange) * 100) : 0;

  // Month breakdown
  const months = [0, 1, 2].map(offset => {
    const mIdx = start.getMonth() + offset;
    const mStart = new Date(start.getFullYear(), mIdx, 1).getTime();
    const mEnd   = new Date(start.getFullYear(), mIdx + 1, 0).getTime();
    const count  = list.filter(e => {
      const ts = Number(e.timestamp || e.date || 0);
      return ts >= mStart && ts <= mEnd;
    }).length;
    const locale = require("@/utils/i18n").getLanguage() === "en" ? "en" : "de";
    const label = new Date(start.getFullYear(), mIdx, 1).toLocaleString(locale, { month: "short" });
    return { label, count };
  });

  return { totalSessions, totalMinutes, avgMinutes, topMode, avgMood, activeDays: daySet.size, consistencyPct, months };
}

// Prompt für Claude bauen
function buildPrompt(stats, name, streak, quarter, year, t, lang) {
  const modeName = { calm:t("cat_calm_label"), focus:t("cat_focus_label"), sleep:t("cat_sleep_label"), emotion:t("cat_emotion_label"), work:t("cat_work_label") };
  const langNames = {de:"German",en:"English",es:"Spanish",zh:"Chinese",fr:"French",pt:"Portuguese",ja:"Japanese",ko:"Korean",it:"Italian",ru:"Russian",hi:"Hindi",tr:"Turkish",nl:"Dutch",pl:"Polish",sv:"Swedish",he:"Hebrew"};
  const langName = langNames[lang] || "English";
  const intro = `You are a compassionate mindfulness coach. Analyse the following meditation data for Q${quarter} ${year}${name ? ` from ${name}` : ""} and provide a personal, honest and motivating quarterly analysis. IMPORTANT: Write the ENTIRE response in ${langName}. Do not use any other language.`;
  const isEn = lang === "en";
  const dataLabel = isEn ? "DATA" : "DATEN";
  const instructions = isEn
    ? `Write an analysis with exactly these 4 sections. Separate them with "---":

1. OVERVIEW (2-3 sentences): What do these numbers really say about the quarter?
2. STRENGTHS (2-3 sentences): What is going well? Be specific and honest.
3. GROWTH (2-3 sentences): What could be different next quarter? No pressure, just honest observation.
4. IMPULSE (1 sentence): One single, personal sentence as a close — direct and meaningful.

Style: Warm, honest, not over-the-top. No marketing speak. Address the person directly.`
    : `Schreibe eine Analyse mit genau diesen 4 Abschnitten. Trenne sie mit "---":

1. GESAMTBILD (2-3 Sätze): Was sagen diese Zahlen wirklich über das Quartal?
2. STÄRKEN (2-3 Sätze): Was läuft gut? Sei konkret und aufrichtig.
3. WACHSTUM (2-3 Sätze): Was könnte im nächsten Quartal anders werden? Kein Druck, nur ehrliche Beobachtung.
4. IMPULS (1 Satz): Ein einziger, persönlicher Satz als Abschluss — direkt und bedeutsam.

Stil: Warm, ehrlich, nicht überschwänglich. Kein Marketing-Speak. Sprich die Person direkt an.`;
  const dayWord = isEn ? "days" : "Tage";
  const minWord = isEn ? "min." : "Min.";
  return `${intro}

${dataLabel}:
- ${isEn?"Total sessions":"Sessions gesamt"}: ${stats.totalSessions}
- ${isEn?"Total minutes":"Gesamtminuten"}: ${stats.totalMinutes} ${minWord}
- ${isEn?"Avg minutes/session":"Ø Minuten pro Session"}: ${stats.avgMinutes} ${minWord}
- ${isEn?"Active days":"Aktive Tage"}: ${stats.activeDays}
- ${isEn?"Consistency":"Konsistenz"}: ${stats.consistencyPct}% ${isEn?"of all days":"aller Tage"}
- ${isEn?"Favourite mode":"Lieblings-Modus"}: ${modeName[stats.topMode] || stats.topMode}
- ${isEn?"Avg mood":"Ø Stimmung"}: ${stats.avgMood ? `${stats.avgMood}/5` : t("ai_no_data")}
- ${isEn?"Current streak":"Aktueller Streak"}: ${streak} ${dayWord}
- ${isEn?"Monthly":"Monatlich"}: ${stats.months.map(m => `${m.label}: ${m.count}`).join(", ")}

${instructions}`;
}

export default function AIQuarterlyAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { colors } = useStillMindTheme();
  const [plan,     setPlan]     = useState("free");
  const [name,     setName]     = useState("");
  const [stats,    setStats]    = useState(null);
  const [streak,   setStreak]   = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [quarter,  setQuarter]  = useState(() => getQuarterRange(0));
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular, Montserrat_500Medium,
    Montserrat_600SemiBold, Montserrat_700Bold, Montserrat_800ExtraBold,
  });

  const load = useCallback(async () => {
    const [hist, p, n] = await Promise.all([
      getSessionHistory().catch(() => []),
      getUserPlan().catch(() => "free"),
      getUserName().catch(() => ""),
    ]);
    const str = await getDailyStreak(hist).catch(() => 0);
    setPlan(p); setName(n || ""); setStreak(str);
    setStats(buildQuarterStats(hist, quarter.start, quarter.end));
    setAnalysis(null); setError("");
  }, [quarter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goQuarter = (d) => {
    const next = getQuarterRange(d);
    // Don't go future
    if (next.start > new Date()) return;
    setQuarter(next);
  };

  const runAnalysis = async () => {
    if (!stats || loading) return;
    setLoading(true); setError(""); setAnalysis(null);
    try {
      const prompt = buildPrompt(stats, name, streak, quarter.quarter, quarter.year, t, lang);
      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || "";
      if (!apiKey) throw new Error("API key not configured");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = (errBody && errBody.error && errBody.error.message) || JSON.stringify(errBody);
        throw new Error(`API ${res.status}: ${errMsg}`);
      }
      const data = await res.json();
      const text = data.content && data.content.map(c => c.text || "").join("") || "";
      // Parse sections
      const parts = text.split("---").map(s => s.trim()).filter(Boolean);
      setAnalysis(parts);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (e) {
      console.error("[KI-Analyse] Fehler:", e.message);
      // Zeige spezifischere Fehlermeldung
      const msg = e.message || "";
      if (msg.includes("401") || msg.includes("403") || msg.includes("authentication") || msg.includes("auth")) {
        setError(t("ai_err_api_invalid"));
      } else if (msg.includes("API key not configured")) {
        setError(t("ai_err_api_missing"));
      } else if (msg.includes("network") || msg.includes("Network") || msg.includes("fetch")) {
        setError(t("ai_err_no_internet"));
      } else {
        setError(msg); // Zeige exakte API-Fehlermeldung
      }
    } finally {
      setLoading(false);
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const isLifetime = plan === "lifetime";
  const A = "#CDB98A";
  const G = "rgba(205,185,138,0.08)";
  const B = "rgba(205,185,138,0.18)";
  const isFuture = quarter.start > new Date();

  const SECTION_ICONS  = ["🔭", "⭐", "🌱", "✦"];
  const SECTION_LABELS = [t("ai_section_labels_0"), t("ai_section_labels_1"), t("ai_section_labels_2"), t("ai_section_labels_3")];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image source={LOGO} resizeMode="contain" style={{ width: 72, height: 72, opacity: 0.97 }} />
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary }}>{t("back_btn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 11, fontFamily: "Montserrat_700Bold", color: A, letterSpacing: 2 }}>{t("ai_badge_label")}</Text>
            <View style={{ backgroundColor: `${A}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: `${A}35` }}>
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 9, color: A, letterSpacing: 1 }}>LIFETIME</Text>
            </View>
          </View>
          <Text style={{ fontFamily: "Montserrat_800ExtraBold", fontSize: 30, color: colors.text, letterSpacing: -0.5, marginBottom: 4, lineHeight: 36 }}>
            {t("ai_title")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary }}>
            {t("ai_subtitle")}
          </Text>
        </View>

        {/* Quarter picker */}
        <View style={{ paddingHorizontal: 24, marginTop: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingVertical: 14, paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => goQuarter(-1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={{ fontSize: 22, color: A }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 17, color: colors.text }}>
              Q{quarter.quarter} {quarter.year}
            </Text>
            <TouchableOpacity onPress={() => goQuarter(1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ opacity: isFuture ? 0.2 : 1 }}>
              <Text style={{ fontSize: 22, color: A }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats snapshot */}
        {stats && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: t("sessions_word"), value: stats.totalSessions, icon: "🧘" },
                { label: t("minutes"),  value: stats.totalMinutes,  icon: "⏱" },
                { label: t("ai_consistency"), value: `${stats.consistencyPct}%`, icon: "📅" },
                { label: t("streak"), value: `${streak}${t("ai_streak_unit")}`, icon: streak >= 7 ? "🔥" : "⚡" },
              ].map(item => (
                <View key={item.label} style={{ flex: 1, backgroundColor: G, borderRadius: 14, borderWidth: 1, borderColor: B, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 16, marginBottom: 4 }}>{item.icon}</Text>
                  <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 16, color: colors.text }}>{item.value}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 9, color: A, marginTop: 2, textAlign: "center" }}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Mini month chart */}
            {stats.totalSessions > 0 && (
              <View style={{ marginTop: 12, flexDirection: "row", gap: 6 }}>
                {stats.months.map((m, i) => {
                  const max = Math.max(...stats.months.map(x => x.count), 1);
                  const h = Math.max(6, (m.count / max) * 52);
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", gap: 5 }}>
                      <View style={{ width: "100%", height: 52, justifyContent: "flex-end" }}>
                        <View style={{ width: "100%", height: h, borderRadius: 6, backgroundColor: A + "AA" }} />
                      </View>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 10, color: colors.textSecondary }}>{m.label}</Text>
                      <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 10, color: A }}>{m.count}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Gate: Teaser für non-Lifetime mit Blur-Overlay */}
        {!isLifetime ? (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{ position: "relative", borderRadius: 20, overflow: "hidden" }}>

              {/* Echter Fake-Inhalt der durchscheint */}
              <View style={{ backgroundColor: "rgba(205,185,138,0.06)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(205,185,138,0.18)", padding: 22 }}>
                {/* Mini Statistik-Chips */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                  {[
                    { icon: "🧘", label: "Sessions", val: "–" },
                    { icon: "⏱", label: "Minuten", val: "–" },
                    { icon: "📅", label: "Konstanz", val: "–%" },
                  ].map((s, i) => (
                    <View key={i} style={{ flex: 1, backgroundColor: "rgba(205,185,138,0.10)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(205,185,138,0.15)", padding: 10, alignItems: "center" }}>
                      <Text style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</Text>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "rgba(205,185,138,0.60)" }}>{s.val}</Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 9, color: "rgba(205,185,138,0.40)", marginTop: 2 }}>{s.label}</Text>
                    </View>
                  ))}
                </View>

                {[
                  { icon: "🔭", title: "Dein Quartal im Überblick", w1: "85%", w2: "60%" },
                  { icon: "⭐", title: "Stärkste Momente", w1: "70%", w2: "90%" },
                  { icon: "🌱", title: "Wachstumsbereiche", w1: "75%", w2: "50%" },
                  { icon: "✦",  title: "Persönliche Empfehlung", w1: "80%", w2: "65%" },
                ].map((s, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "rgba(205,185,138,0.55)", marginBottom: 7 }}>{s.icon}  {s.title}</Text>
                    <View style={{ height: 9, borderRadius: 5, backgroundColor: "rgba(205,185,138,0.14)", marginBottom: 5, width: s.w1 }} />
                    <View style={{ height: 9, borderRadius: 5, backgroundColor: "rgba(205,185,138,0.09)", width: s.w2 }} />
                  </View>
                ))}
              </View>

              {/* Gradient Overlay — oben transparent, unten undurchsichtig */}
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 }}>
                {/* Obere Hälfte: kaum Overlay — Inhalt sichtbar */}
                <View style={{ flex: 1, backgroundColor: "rgba(10,10,12,0.15)" }} />
                {/* Untere Hälfte: dichter — Lock-Bereich */}
                <View style={{ flex: 1, backgroundColor: "rgba(10,10,12,0.92)", alignItems: "center", justifyContent: "center", padding: 24 }}>
                  <Text style={{ fontSize: 28, marginBottom: 10 }}>🔒</Text>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 17, color: "#CDB98A", textAlign: "center", marginBottom: 6 }}>
                    {t("ai_lifetime_only_lock")}
                  </Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(205,185,138,0.60)", textAlign: "center", lineHeight: 19, marginBottom: 18 }}>
                    {t("ai_lifetime_only")}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/premium")}
                    activeOpacity={0.85}
                    style={{ backgroundColor: A, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 }}
                  >
                    <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 14, color: "#0C0B09" }}>{t("ai_cta_unlock")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </View>
        ) : (
          <React.Fragment>
            {/* Run button */}
            {!analysis && !loading && (
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={runAnalysis}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: A, borderRadius: 18, paddingVertical: 18,
                    alignItems: "center", justifyContent: "center",
                    shadowColor: A, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 8,
                  }}
                >
                  <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 16, color: "#0C0B09" }}>
                    {t("ai_start_btn")}
                  </Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(12,11,9,0.55)", marginTop: 4 }}>
                    Q{quarter.quarter} {quarter.year} · {t("ai_analysed_by")}
                  </Text>
                </TouchableOpacity>
                <Text style={{ textAlign: "center", fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, marginTop: 10, lineHeight: 16 }}>
                  {t("ai_loading_hint")}
                </Text>
              </View>
            )}

            {/* Loading */}
            {loading && (
              <View style={{ paddingHorizontal: 24, marginBottom: 16, alignItems: "center", paddingVertical: 32 }}>
                <ActivityIndicator color={A} size="large" style={{ marginBottom: 16 }} />
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text, marginBottom: 6 }}>
                  {t("ai_analysing")}
                </Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
                  {t("ai_sessions_count").replace("{{n}}", (stats && stats.totalSessions) || 0)}
                </Text>
              </View>
            )}

            {/* Error */}
            {!!error && (
              <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
                <View style={{ backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.20)", padding: 16 }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#EF4444", marginBottom: 6 }}>{t("error")}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>{error}</Text>
                  <TouchableOpacity onPress={runAnalysis} style={{ marginTop: 12, backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 10, paddingVertical: 10, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#EF4444" }}>{t("retry")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Analysis sections */}
            {analysis && (
              <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 24 }}>
                {analysis.map((section, i) => (
                  <View key={i} style={{ backgroundColor: i === analysis.length - 1 ? G : "rgba(255,255,255,0.04)", borderRadius: 20, borderWidth: 1, borderColor: i === analysis.length - 1 ? B : "rgba(255,255,255,0.08)", padding: 20, marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Text style={{ fontSize: 20 }}>{SECTION_ICONS[i] || "·"}</Text>
                      <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 13, color: i === analysis.length - 1 ? A : colors.text, letterSpacing: 0.5 }}>
                        {SECTION_LABELS[i] || (i + 1)}
                      </Text>
                    </View>
                    <Text style={{
                      fontFamily: i === analysis.length - 1 ? "Montserrat_600SemiBold" : "Montserrat_400Regular",
                      fontSize: i === analysis.length - 1 ? 16 : 14,
                      color: colors.text,
                      lineHeight: i === analysis.length - 1 ? 26 : 22,
                      fontStyle: i === analysis.length - 1 ? "italic" : "normal",
                    }}>
                      {/* Strip section header if Claude included it */}
                      {section.replace(/^(GESAMTBILD|STÄRKEN|WACHSTUM|IMPULS)[:\s]*/i, "").trim()}
                    </Text>
                  </View>
                ))}

                {/* Regenerate */}
                <TouchableOpacity onPress={runAnalysis} style={{ marginTop: 4, marginBottom: 16, alignItems: "center", paddingVertical: 12 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: colors.textSecondary }}>
                    {t("ai_regenerate")}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </React.Fragment>
        )}

      </ScrollView>
    </View>
  );
}
