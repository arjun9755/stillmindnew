// TrialWelcomeModal.jsx – 7-Tage-Challenge mit Conversion-Logik
import React, { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import { useI18n } from "@/utils/i18n";

const { width: SW } = Dimensions.get("screen");

const C = {
  bg: "#0E0D0A",
  card: "#161410",
  accent: "#CDB98A",
  border: "rgba(205,185,138,0.13)",
  glow: "rgba(205,185,138,0.06)",
  text: "#EDE7D0",
  muted: "rgba(237,231,208,0.45)",
  green: "#4ADE80",
  greenBg: "rgba(74,222,128,0.10)",
};

const LOGO = require("../assets/brand/stillmind-logo-transparent.png");

const CHALLENGE_DAYS = [
  { day: 1, emoji: "🌱" },
  { day: 2, emoji: "🌿" },
  { day: 3, emoji: "💧" },
  { day: 4, emoji: "🔥" },
  { day: 5, emoji: "⚡" },
  { day: 6, emoji: "🌙" },
  { day: 7, emoji: "✨" },
];

export default function TrialWelcomeModal({
  visible,
  onStartChallenge,
  onClose,
  purchasing = false,
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bgOp = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(100)).current;
  const cardOp = useRef(new Animated.Value(0)).current;

  const WHAT_YOU_GET = useMemo(
    () => [
      t("trial_feat_1"),
      t("trial_feat_2"),
      t("trial_feat_3"),
      t("trial_stat_goals"),
    ],
    [t]
  );

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (!visible) return;

    bgOp.setValue(0);
    cardY.setValue(100);
    cardOp.setValue(0);

    Animated.timing(bgOp, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(cardOp, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 80);

    return () => clearTimeout(timeout);
  }, [visible, bgOp, cardY, cardOp]);

  if (!fontsLoaded) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "rgba(0,0,0,0.82)",
            opacity: bgOp,
            justifyContent: "flex-end",
          },
        ]}
      >
        <Animated.View
          style={{
            opacity: cardOp,
            transform: [{ translateY: cardY }],
            backgroundColor: C.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            borderWidth: 1,
            borderColor: C.border,
            borderBottomWidth: 0,
            paddingBottom: Math.max(insets.bottom, 20) + 4,
            overflow: "hidden",
          }}
        >
          {/* Top gold line */}
          <View
            style={{ height: 2, backgroundColor: C.accent, opacity: 0.45 }}
          />

          {/* Ambient glow */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -60,
              alignSelf: "center",
              width: SW,
              height: 220,
              borderRadius: 200,
              backgroundColor: C.glow,
            }}
          />

          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              backgroundColor: "rgba(205,185,138,0.20)",
              alignSelf: "center",
              marginTop: 14,
              marginBottom: 20,
            }}
          />

          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Image
              source={LOGO}
              style={{ width: 72, height: 72, opacity: 0.97 }}
              resizeMode="contain"
            />
          </View>

          {/* Eyebrow */}
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 10,
              letterSpacing: 3.2,
              color: C.accent,
              textTransform: "uppercase",
              textAlign: "center",
              opacity: 0.9,
              marginBottom: 10,
            }}
          >
            {t("trial_eyebrow")}
          </Text>

          {/* Headline — benefit-first */}
          <Text
            style={{
              fontFamily: "Montserrat_700Bold",
              fontSize: 24,
              color: C.text,
              textAlign: "center",
              lineHeight: 31,
              paddingHorizontal: 28,
              marginBottom: 6,
            }}
          >
            {t("trial_headline")}
          </Text>

          <Text
            style={{
              fontFamily: "Montserrat_400Regular",
              fontSize: 13,
              color: C.muted,
              textAlign: "center",
              paddingHorizontal: 32,
              lineHeight: 19,
              marginBottom: 18,
            }}
          >
            {t("trial_subtext")}
          </Text>

          {/* 7-Day timeline dots */}
          <View
            style={{
              paddingHorizontal: 24,
              marginBottom: 18,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            {CHALLENGE_DAYS.map((d) => (
              <View key={d.day} style={{ alignItems: "center", flex: 1 }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor:
                      d.day === 7 ? C.accent : "rgba(205,185,138,0.10)",
                    borderWidth: 1,
                    borderColor:
                      d.day === 7 ? C.accent : "rgba(205,185,138,0.20)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{d.emoji}</Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 9,
                    color: d.day === 7 ? C.accent : C.muted,
                    textAlign: "center",
                  }}
                >
                  T{d.day}
                </Text>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View
            style={{
              marginHorizontal: 24,
              height: 1,
              backgroundColor: C.border,
              marginBottom: 14,
            }}
          />

          {/* What you get */}
          <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 10,
                color: C.accent,
                letterSpacing: 1.8,
                textTransform: "uppercase",
                opacity: 0.75,
                marginBottom: 10,
              }}
            >
              {t("trial_included_label")}
            </Text>

            {WHAT_YOU_GET.map((f, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 7,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: C.greenBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: C.green, fontSize: 10 }}>✓</Text>
                </View>

                <Text
                  style={{
                    fontFamily: "Montserrat_400Regular",
                    fontSize: 13,
                    color: C.text,
                    opacity: 0.88,
                    flex: 1,
                  }}
                >
                  {f}
                </Text>
              </View>
            ))}
          </View>

          {/* Preis — prominent ÜBER dem Button */}
          <View style={{ paddingHorizontal: 22, marginBottom: 12, alignItems: "center" }}>
            <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 22, color: C.text, textAlign: "center" }}>
              {t("trial_price_amount")}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: C.muted, textAlign: "center", marginTop: 2 }}>
              {t("trial_price_before")} {t("trial_price_after")}
            </Text>
          </View>

          {/* CTA */}
          <View style={{ paddingHorizontal: 22, marginBottom: 10 }}>
            <TouchableOpacity
              onPress={purchasing ? null : onStartChallenge}
              activeOpacity={0.85}
              disabled={purchasing}
              style={{
                backgroundColor: purchasing ? "rgba(205,185,138,0.5)" : C.accent,
                borderRadius: 17,
                height: 58,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: C.accent,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.32,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {purchasing ? (
                <ActivityIndicator color="#0E0D0A" />
              ) : (
                <Text
                  style={{
                    fontFamily: "Montserrat_700Bold",
                    fontSize: 16,
                    color: "#0E0D0A",
                    letterSpacing: 0.2,
                  }}
                >
                  {t("trial_cta")}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Dismiss — als eigene Box */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              marginHorizontal: 22,
              paddingVertical: 13,
              borderRadius: 10,
              borderWidth: 0.5,
              borderColor: "rgba(237,231,208,0.12)",
              backgroundColor: "rgba(237,231,208,0.04)",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_500Medium",
                fontSize: 13,
                color: "rgba(237,231,208,0.65)",
              }}
            >
              {t("trial_dismiss")}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}