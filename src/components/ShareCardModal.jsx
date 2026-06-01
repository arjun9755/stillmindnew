/**
 * ShareCardModal.jsx — v5
 * Vollbild-Karte (kein Bottom Sheet mehr)
 * Eigene Farbe + Emoji pro Modus
 * Preview = Export (1080×1920)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Share2, Lock, X } from "lucide-react-native";
import { buildShareCardHtml, resolveMode, shareSessionCard } from "@/utils/share-card";
import { getUserName, getDailyStreak, getSessionHistory } from "@/utils/storage";
import { useI18n } from "@/utils/i18n";
import { LOGO_TRANSPARENT_B64 } from "@/utils/logo-b64";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Tageszeit ─────────────────────────────────────────────────────────────────
function todLabel(ts, t) {
  const h = new Date(ts || Date.now()).getHours();
  if (h >= 5  && h < 9)  return { lbl: t("share_tod_morning_lbl"),   sub: t("share_tod_morning_sub")   };
  if (h >= 9  && h < 12) return { lbl: t("share_tod_forenoon_lbl"),  sub: t("share_tod_forenoon_sub")  };
  if (h >= 12 && h < 14) return { lbl: t("share_tod_lunch_lbl"),     sub: t("share_tod_lunch_sub")     };
  if (h >= 14 && h < 17) return { lbl: t("share_tod_afternoon_lbl"), sub: t("share_tod_afternoon_sub") };
  if (h >= 17 && h < 20) return { lbl: t("share_tod_evening_lbl"),   sub: t("share_tod_evening_sub")   };
  if (h >= 20 && h < 23) return { lbl: t("share_tod_night_lbl"),     sub: t("share_tod_night_sub")     };
  return                         { lbl: t("share_tod_late_lbl"),      sub: t("share_tod_late_sub")      };
}

function streakTxt(s, t) {
  if (!s || s < 2) return null;
  if (s < 7)  return t("share_streak_days",  { n: s });
  if (s < 30) return t("share_streak_week",  { n: s });
  return             t("share_streak_month", { n: s });
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function ShareCardModal({
  visible,
  onClose,
  sessionCompleted = false,
  modeId           = "calm",
  sessionType      = null,
  sessionTitle,
  durationMinutes  = 1,
  timestamp        = null,
  quote            = null,
}) {
  const { t }  = useI18n();
  const insets = useSafeAreaInsets();

  const scaleAnim  = useRef(new Animated.Value(0.92)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;

  const [sharing,  setSharing]  = useState(false);
  const [userName, setUserName] = useState(null);
  const [streak,   setStreak]   = useState(0);
  const [done,     setDone]     = useState(false);
  const [cardHTML, setCardHTML] = useState(null);

  // ── Mode auflösen ──────────────────────────────────────────────────────────
  const cfg = useMemo(() => resolveMode(modeId), [modeId]);

  const ts   = timestamp || Date.now();
  const mins = Math.max(1, durationMinutes || 1);
  const tod  = todLabel(ts, t);
  const _title = sessionTitle || cfg.label;
  const _quote = quote || cfg.subline || t("share_quote_fallback");

  const today   = new Date(ts);
  const dateStr = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${today.getFullYear()}`;
  const timeStr = `${String(today.getHours()).padStart(2,"0")}:${String(today.getMinutes()).padStart(2,"0")}`;

  // ── Daten laden ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setDone(false);
    setCardHTML(null);

    Promise.all([
      getUserName().catch(() => null),
      getSessionHistory().catch(() => []),
    ]).then(async ([name, history]) => {
      setUserName(name);
      const s = await getDailyStreak(history).catch(() => 0);
      setStreak(s);

      let logoUri = null;
      try {
        const full = LOGO_TRANSPARENT_B64;
        if (full && full.includes("base64,")) logoUri = full.split("base64,")[1];
      } catch (_) {}

      const html = buildShareCardHtml({
        modeId, durationMinutes: mins,
        timestamp: ts, sessionTitle: _title,
        quote: _quote, userName: name,
        streak: s, logoUri,
      });
      setCardHTML(html);
    });
  }, [visible, modeId, mins, _title, _quote]);

  // ── Animation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 14, tension: 80, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── Teilen ────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!sessionCompleted || !cardHTML) return;
    setSharing(true);
    try {
      const result = await shareSessionCard({
        modeId, sessionType, durationMinutes: mins,
        timestamp: ts, sessionTitle: _title,
        quote: _quote, customHtml: cardHTML,
      });
      if (result === "shared") {
        setDone(true);
        setTimeout(() => { setDone(false); onClose(); }, 1400);
      }
    } catch (_) {}
    finally { setSharing(false); }
  }, [sessionCompleted, cardHTML, modeId, sessionType, mins, ts, _title, _quote, onClose]);

  if (!visible) return null;

  const shareDisabled = !sessionCompleted || sharing || done || !cardHTML;
  const stText = streakTxt(streak, t);

  // Accent color from cfg
  const accent = cfg.color;
  const softBg = cfg.soft;
  const border = cfg.border;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>

      {/* Backdrop */}
      <Animated.View style={{ ...StyleSheet_absoluteFill, backgroundColor: "rgba(0,0,0,0.94)", opacity: opacAnim }} />

      {/* Vollbild-Karte */}
      <Animated.View style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        opacity: opacAnim,
        transform: [{ scale: scaleAnim }],
      }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Card body */}
          <View style={{
            marginTop: insets.top + 12,
            marginHorizontal: 12,
            borderRadius: 28,
            overflow: "hidden",
            backgroundColor: "#0B0D10",
            borderWidth: 1,
            borderColor: border,
          }}>

            {/* Top accent line */}
            <View style={{ height: 3, backgroundColor: accent, opacity: 0.85 }} />

            <View style={{ padding: 28, alignItems: "center" }}>

              {/* Logo */}
              <View style={{
                shadowColor: accent, shadowOpacity: 0.55,
                shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
                marginBottom: 8,
              }}>
                <Image
                  source={require("../assets/brand/stillmind-logo-transparent.png")}
                  style={{ width: 70, height: 70 }}
                  resizeMode="contain"
                />
              </View>

              {/* Date */}
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.28)", marginBottom: 20, letterSpacing: 0.4 }}>
                {dateStr} · {timeStr} {t("share_time_unit") || ""}
              </Text>

              {/* Time of day */}
              <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 11, color: accent, letterSpacing: 4, textTransform: "uppercase", textAlign: "center", marginBottom: 4 }}>
                {tod.lbl}
              </Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: "rgba(255,255,255,0.38)", textAlign: "center", marginBottom: 20 }}>
                {tod.sub}
              </Text>

              {/* Mode Chip — full width, centered */}
              <View style={{
                flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: 10, backgroundColor: softBg,
                borderWidth: 1.5, borderColor: border,
                borderRadius: 60, paddingHorizontal: 24, paddingVertical: 12,
                width: "100%", marginBottom: 24,
              }}>
                <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "rgba(255,255,255,0.88)" }}>
                  {_title}
                </Text>
              </View>

              {/* Duration — hero */}
              <View style={{ alignItems: "center", marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 96, color: "rgba(255,255,255,0.95)", letterSpacing: -3, lineHeight: 88 }}>
                    {mins}
                  </Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 24, color: "rgba(255,255,255,0.30)", marginBottom: 10 }}>
                    {mins === 1 ? t("minute_singular") : t("minute_plural")}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: "rgba(255,255,255,0.42)", textAlign: "center", marginTop: 4 }}>
                  {userName
                    ? t("share_user_line", { name: userName })
                    : t("share_calm_line")}
                </Text>
              </View>

              {/* Quote */}
              <View style={{
                width: "100%", marginTop: 20, marginBottom: 20,
                backgroundColor: softBg, borderRadius: 16, padding: 18,
                borderLeftWidth: 3, borderLeftColor: accent + "88",
              }}>
                <Text style={{
                  fontFamily: "Montserrat_400Regular", fontStyle: "italic",
                  fontSize: 14, color: "rgba(255,255,255,0.52)", lineHeight: 22, textAlign: "center",
                }} numberOfLines={4}>
                  "{(_quote || "").slice(0, 140)}"
                </Text>
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: "row", gap: 10, width: "100%", marginBottom: streak >= 2 ? 14 : 0 }}>
                {[
                  { lbl: t("share_stat_dur"),  val: `${mins}`, unit: "min",              emoji: false },
                  { lbl: t("share_stat_time"), val: timeStr,   unit: t("share_time_unit"), emoji: false },
                  { lbl: t("share_stat_mode"), val: cfg.icon,  unit: cfg.label,           emoji: true  },
                ].map((s) => (
                  <View key={s.lbl} style={{
                    flex: 1, backgroundColor: "rgba(255,255,255,0.04)",
                    borderRadius: 14, padding: 12, borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.07)", alignItems: "center", gap: 4,
                  }}>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 8, color: "rgba(255,255,255,0.24)", letterSpacing: 2, textTransform: "uppercase" }}>
                      {s.lbl}
                    </Text>
                    {s.emoji
                      ? <Text style={{ fontSize: 24 }}>{s.val}</Text>
                      : <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: s.lbl === t("share_stat_time") ? 14 : 18, color: accent, textAlign: "center" }} numberOfLines={1}>
                          {s.val}
                        </Text>
                    }
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 9, color: "rgba(255,255,255,0.22)", textAlign: "center" }} numberOfLines={1}>
                      {s.unit}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Streak */}
              {streak >= 2 && (
                <View style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, backgroundColor: "rgba(255,160,0,0.09)",
                  borderRadius: 40, paddingHorizontal: 18, paddingVertical: 10,
                  borderWidth: 1, borderColor: "rgba(255,160,0,0.26)",
                }}>
                  <Text style={{ fontSize: 18 }}>🔥</Text>
                  <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 17, color: "rgba(255,190,80,0.95)" }}>{streak}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,190,80,0.65)" }}>{stText}</Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View style={{
              backgroundColor: softBg, borderTopWidth: 1, borderTopColor: border,
              paddingHorizontal: 24, paddingVertical: 14,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: accent }}>stillmind.app</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://apps.apple.com/app/id6758213061")}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8,
                    paddingHorizontal: 9, paddingVertical: 5,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text style={{ fontSize: 12 }}>🍎</Text>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: "rgba(255,255,255,0.65)" }}>App Store</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=de.stillmind.app")}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8,
                    paddingHorizontal: 9, paddingVertical: 5,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Text style={{ fontSize: 12 }}>▶</Text>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: "rgba(255,255,255,0.65)" }}>Play Store</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Floating action bar */}
        <View style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
          backgroundColor: "rgba(10,10,12,0.95)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          flexDirection: "row",
          gap: 10,
        }}>
          {/* Status text */}
          <View style={{ position: "absolute", top: -28, left: 0, right: 0, alignItems: "center" }}>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.30)" }}>
              {!sessionCompleted ? t("share_card_pending") : !cardHTML ? t("share_card_building") : t("share_card_ready")}
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{
            width: 52, height: 52, borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          }}>
            <X size={20} color="rgba(255,255,255,0.50)" />
          </TouchableOpacity>

          {/* Share button */}
          <TouchableOpacity
            onPress={handleShare}
            disabled={shareDisabled}
            activeOpacity={0.88}
            style={{
              flex: 1, height: 52, borderRadius: 16,
              backgroundColor: done ? "#3A8A5A" : shareDisabled ? "rgba(255,255,255,0.07)" : accent,
              alignItems: "center", justifyContent: "center",
              flexDirection: "row", gap: 9,
              shadowColor: shareDisabled ? "transparent" : accent,
              shadowOpacity: shareDisabled ? 0 : 0.40,
              shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
              elevation: shareDisabled ? 0 : 8,
              opacity: sharing ? 0.80 : 1,
            }}
          >
            {sharing ? (
              <React.Fragment>
                <ActivityIndicator size="small" color="rgba(0,0,0,0.70)" />
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "rgba(0,0,0,0.75)" }}>{t("share_btn_creating")}</Text>
              </React.Fragment>
            ) : done ? (
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#fff" }}>{t("share_btn_shared")}</Text>
            ) : !sessionCompleted ? (
              <React.Fragment>
                <Lock size={16} color="rgba(255,255,255,0.30)" />
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>{t("share_btn_session_running")}</Text>
              </React.Fragment>
            ) : !cardHTML ? (
              <React.Fragment>
                <ActivityIndicator size="small" color={accent} />
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: accent }}>{t("share_btn_preparing")}</Text>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <Share2 size={18} color="rgba(0,0,0,0.82)" />
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "rgba(0,0,0,0.86)" }}>{t("share_card_btn")}</Text>
              </React.Fragment>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// Inline StyleSheet.absoluteFill equivalent
const StyleSheet_absoluteFill = {
  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
};
