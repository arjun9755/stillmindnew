// app/feature-voting.jsx — Feature-Voting & Beta-Zugang (Lifetime only)
import React, { useMemo, useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFonts, Montserrat_400Regular, Montserrat_500Medium,
  Montserrat_600SemiBold, Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { useI18n } from "@/utils/i18n";
import { getUserPlan, getUserName } from "@/utils/storage";
import { useStillMindTheme } from "@/utils/stillmind-theme";

// ── Konfiguration ─────────────────────────────────────────────────────────────
// E-Mail-Adresse die die Votes erhält (ersetze mit deiner eigenen)
const VOTE_EMAIL = "support@appstillmind.com";

// Optional: Webhook-URL (Make.com / n8n / Zapier) für automatisches Tracking
// Leer lassen wenn nicht benötigt
const VOTE_WEBHOOK_URL = ""; // z.B. "https://hook.eu2.make.com/xxxxx"

// Letzte Abstimmung nicht öfter als alle N Stunden senden
const MIN_HOURS_BETWEEN_SUBMITS = 24;

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");
const VOTES_KEY        = "stillmind_feature_votes_v1";
const LAST_SUBMIT_KEY  = "stillmind_feature_votes_last_submit";

export default function FeatureVotingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useStillMindTheme();
  const { t, lang } = useI18n();

  const FEATURES = useMemo(() => [
  { id:"f1", emoji:"🎵", title:t("feat_voice"),      desc:t("feat_voice_desc"),                   tag:t("feat_tag_session") },
  { id:"f2", emoji:"⌚", title:t("feat_watch"),   desc:t("feat_watch_desc"),                         tag:t("feat_tag_hardware") },
  { id:"f3", emoji:"🌙", title:t("feat_sleep"),      desc:t("feat_sleep_desc"),                            tag:t("feat_tag_wellness") },
  { id:"f4", emoji:"👥", title:t("feat_partner"),    desc:t("feat_partner_desc"),                      tag:t("feat_tag_social") },
  { id:"f5", emoji:"🎨", title:t("feat_themes"),          desc:t("feat_themes_desc"),                                  tag:t("feat_tag_design") },
  { id:"f6", emoji:"📆", title:t("feat_planned"),    desc:t("feat_planned_desc"),                      tag:t("feat_tag_planning") },
  { id:"f7", emoji:"🧠", title:t("feat_bodyscan"),   desc:t("feat_bodyscan_desc"),                  tag:t("feat_tag_session") },
  { id:"f8", emoji:"🌍", title:t("feat_languages"),     desc:t("feat_languages_desc"),                                tag:t("feat_tag_language") },
  ], [t]);

  const BETA = useMemo(() => [
  { id:"b1", emoji:"🤖", title:t("feat_beta_ki_title"),  desc:t("feat_beta_ki_desc"),   status:"live",    color:"#4ADE80" },
  { id:"b2", emoji:"📊", title:t("feat_beta_insights_title"), desc:t("feat_beta_insights_desc"), status:"beta",    color:"#38BDF8" },
  { id:"b3", emoji:"🎯", title:t("feat_adaptive"),       desc:t("feat_adaptive_desc"),    status:"testing", color:"#CDB98A" },
  ], [t]);
  const [plan,        setPlan]        = useState("free");
  const [votes,       setVotes]       = useState({});
  const [userName,    setUserName]    = useState("");
  const [lastSubmit,  setLastSubmit]  = useState(null); // timestamp ms
  const [submitting,  setSubmitting]  = useState(false);
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });

  useFocusEffect(useCallback(() => {
    Promise.all([
      getUserPlan().catch(() => "free"),
      AsyncStorage.getItem(VOTES_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_SUBMIT_KEY).catch(() => null),
      getUserName().catch(() => ""),
    ]).then(([p, stored, lastSub, name]) => {
      setPlan(p);
      if (stored) try { setVotes(JSON.parse(stored)); } catch (_) {}
      if (lastSub) setLastSubmit(Number(lastSub));
      setUserName(name || "");
    });
  }, []));

  // ── Toggle Vote lokal speichern ─────────────────────────────────────────────
  const toggle = async (id) => {
    if (plan !== "lifetime") { router.push("/(tabs)/premium"); return; }
    const next = { ...votes, [id]: !votes[id] };
    setVotes(next);
    await AsyncStorage.setItem(VOTES_KEY, JSON.stringify(next)).catch(() => {});
  };

  // ── Votes abschicken (E-Mail + optionaler Webhook) ─────────────────────────
  const submitVotes = async () => {
    const selected = FEATURES.filter(f => votes[f.id]);
    if (selected.length === 0) {
      Alert.alert(t("feat_nothing_selected"), t("feat_select_hint"));
      return;
    }

    // Cooldown prüfen
    if (lastSubmit) {
      const hoursSince = (Date.now() - lastSubmit) / (1000 * 60 * 60);
      if (hoursSince < MIN_HOURS_BETWEEN_SUBMITS) {
        Alert.alert(
          t("feat_already_voted"),
          t("feat_voting_cooldown").replace("{{h}}", Math.ceil(MIN_HOURS_BETWEEN_SUBMITS - hoursSince))
        );
        return;
      }
    }

    setSubmitting(true);

    const timestamp  = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
    const voteList   = selected.map(f => `• ${f.emoji} ${f.title} (${f.tag})`).join("\n");
    const totalVotes = selected.length;

    // 1) E-Mail via mailto:
    const subject = encodeURIComponent(t("feat_voting_email_subject").replace("{{name}}", userName || t("anonym") || "User").replace("{{n}}", totalVotes).replace("{{s}}", totalVotes > 1 ? "s" : ""));
    const body = encodeURIComponent(
      `Hallo Dennis,\n\njemand hat für folgende Features abgestimmt:\n\n${voteList}\n\n` +
      `Nutzer: ${userName || "–"}\nPlan: ${plan}\nZeitpunkt: ${timestamp}\n\n` +
      t("feat_voting_total").replace("{{n}}", totalVotes) + "\n\n– StillMind App"
    );
    const mailtoUrl = `mailto:${VOTE_EMAIL}?subject=${subject}&body=${body}`;

    // 2) Optionaler Webhook (silent, kein UI-Block)
    if (VOTE_WEBHOOK_URL) {
      fetch(VOTE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event:     "feature_vote",
          user:      userName || "anonym",
          plan,
          timestamp,
          votes:     selected.map(f => ({ id: f.id, title: f.title, tag: f.tag })),
          total:     totalVotes,
        }),
      }).catch(() => {}); // silent – kein Absturz wenn Webhook nicht erreichbar
    }

    // Letzten Submit-Zeitpunkt speichern
    await AsyncStorage.setItem(LAST_SUBMIT_KEY, String(Date.now())).catch(() => {});
    setLastSubmit(Date.now());
    setSubmitting(false);

    // mailto öffnen
    const canOpen = await Linking.canOpenURL(mailtoUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(mailtoUrl).catch(() => {});
    } else {
      // Fallback: zeige Votes als Alert wenn kein Mail-Client
      Alert.alert(
        "✅ Vote registriert",
        `Deine Auswahl wurde gespeichert:\n\n${voteList}\n\nDanke für dein Feedback!`
      );
    }
  };

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const isLifetime = plan === "lifetime";
  const A = "#CDB98A", G = "rgba(205,185,138,0.08)", B = "rgba(205,185,138,0.18)";
  const votedCount = Object.values(votes).filter(Boolean).length;

  // Kann erneut abstimmen?
  const canSubmit = lastSubmit
    ? (Date.now() - lastSubmit) / (1000 * 60 * 60) >= MIN_HOURS_BETWEEN_SUBMITS
    : true;

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

        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 32, color: colors.text, letterSpacing: -0.5, marginBottom: 4 }}>Feature-Voting</Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, lineHeight: 21 }}>
            {isLifetime ? t("feat_lifetime_only") : t("feat_premium_only")}
          </Text>
        </View>

        {/* Letzter Submit Info */}
        {isLifetime && lastSubmit && (
          <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            <View style={{ backgroundColor: canSubmit ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", borderRadius: 12, borderWidth: 1, borderColor: canSubmit ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.08)", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>{canSubmit ? "✅" : "⏳"}</Text>
              <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: canSubmit ? "#4ADE80" : colors.textSecondary }}>
                {canSubmit
                  ? t("feat_vote_again")
                  : t("feat_voting_next_in").replace("{{h}}", Math.ceil(MIN_HOURS_BETWEEN_SUBMITS - (Date.now() - lastSubmit) / (1000 * 60 * 60)))}
              </Text>
            </View>
          </View>
        )}

        {/* Vote counter + Submit Button */}
        {isLifetime && votedCount > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 14, gap: 10 }}>
            <View style={{ backgroundColor: G, borderRadius: 14, borderWidth: 1, borderColor: B, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 20 }}>🗳️</Text>
              <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: A, flex: 1 }}>
                {t("feat_selected", {n: votedCount, s: votedCount > 1 ? "s" : ""})}
              </Text>
            </View>

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              onPress={submitVotes}
              disabled={submitting || !canSubmit}
              activeOpacity={0.82}
              style={{
                backgroundColor: canSubmit && !submitting ? A : "rgba(205,185,138,0.25)",
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 18 }}>📨</Text>
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 15, color: canSubmit && !submitting ? "#0C0B09" : "rgba(12,11,9,0.45)" }}>
                {submitting ? t("feat_submitting") : t("feat_submit")}
              </Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: colors.textSecondary, textAlign: "center" }}>
              {t("feat_open_mail")}
            </Text>
          </View>
        )}

        {/* Features */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          {FEATURES.map(feat => {
            const active = !!votes[feat.id];
            return (
              <TouchableOpacity
                key={feat.id}
                onPress={() => toggle(feat.id)}
                activeOpacity={0.82}
                style={{ marginBottom: 10, borderRadius: 18, borderWidth: 1.5, borderColor: active ? B : "rgba(255,255,255,0.08)", backgroundColor: active ? G : "rgba(255,255,255,0.03)", padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: active ? "rgba(205,185,138,0.12)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: active ? B : "rgba(255,255,255,0.09)" }}>
                  <Text style={{ fontSize: 22 }}>{feat.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: active ? A : colors.text }}>{feat.title}</Text>
                    <View style={{ backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 9, color: colors.textSecondary }}>{feat.tag}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{feat.desc}</Text>
                </View>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: active ? A : "rgba(255,255,255,0.07)", borderWidth: active ? 0 : 1, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                  {active && <Text style={{ fontSize: 13, color: "#0C0B09" }}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* In Entwicklung */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: A, letterSpacing: 1.5, marginBottom: 14 }}>{t("feat_in_development")}</Text>
          {BETA.map(b => (
            <View key={b.id} style={{ flexDirection: "row", gap: 14, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, marginBottom: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text, marginBottom: 3 }}>{b.title}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{b.desc}</Text>
              </View>
              <View style={{ backgroundColor: `${b.color}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: `${b.color}35` }}>
                <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 9, color: b.color, letterSpacing: 1 }}>
                  {b.status === "live" ? t("feat_status_live") : b.status === "beta" ? t("feat_status_beta") : t("feat_status_test")}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {!isLifetime && (
          <View style={{ paddingHorizontal: 24 }}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/premium")} activeOpacity={0.85} style={{ backgroundColor: A, borderRadius: 16, paddingVertical: 15, alignItems: "center" }}>
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#0C0B09" }}>{t("feat_unlock_lifetime")}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
