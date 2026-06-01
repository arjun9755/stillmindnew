// src/components/CelebrationModal.jsx
// Wiederverwendbare Feier-Animation für Ziele, Challenge, Kurse
// Kein externes Package – nur React Native Animated

import React, { useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  Text,
  View,
  Dimensions,
  StyleSheet,
} from "react-native";

const { width: W, height: H } = Dimensions.get("window");

// ── Konfetti-Partikel Konfiguration ────────────────────────────────────────
const PARTICLE_COUNT = 38;
const COLORS = [
  "#CDB98A", "#B89A6A", "#F0E6C8", // Gold-Töne (StillMind)
  "#8B5CF6", "#C4B5FD",            // Violett (Programme)
  "#34D399", "#6EE7B7",            // Grün
  "#60A5FA", "#93C5FD",            // Blau
  "#F59E0B", "#FCD34D",            // Amber
];
const SHAPES = ["●", "■", "▲", "◆", "★"];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function Particle({ delay, startX }) {
  const y        = useRef(new Animated.Value(-20)).current;
  const x        = useRef(new Animated.Value(0)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const rotate   = useRef(new Animated.Value(0)).current;
  const scale    = useRef(new Animated.Value(randomBetween(0.5, 1.2))).current;

  const color  = COLORS[Math.floor(Math.random() * COLORS.length)];
  const shape  = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const drift  = randomBetween(-80, 80);
  const dur    = randomBetween(1400, 2200);

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y, {
          toValue: H * 0.75,
          duration: dur,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: drift,
          duration: dur,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 400, delay: dur - 520, useNativeDriver: true }),
        ]),
        Animated.timing(rotate, {
          toValue: randomBetween(-4, 4),
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [-4, 4],
    outputRange: ["-720deg", "720deg"],
  });

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: startX,
        top: 0,
        fontSize: 14,
        color,
        opacity,
        transform: [{ translateY: y }, { translateX: x }, { rotate: spin }, { scale }],
      }}
    >
      {shape}
    </Animated.Text>
  );
}

// ── Haupt-Modal ─────────────────────────────────────────────────────────────
/**
 * Props:
 *   visible   boolean
 *   onClose   () => void
 *   emoji     string        z.B. "🏆" | "🎯" | "📚"
 *   title     string
 *   subtitle  string
 *   ctaLabel  string        Button-Text (default t("celebration_next"))
 */
export default function CelebrationModal({
  visible,
  onClose,
  emoji = "🎉",
  title = t("celebration_done"),
  subtitle = "",
  ctaLabel = t("celebration_next"),
}) {
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const cardAnim     = useRef(new Animated.Value(0)).current;
  const emojiScale   = useRef(new Animated.Value(0)).current;

  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      key: i,
      delay: Math.random() * 600,
      startX: randomBetween(W * 0.05, W * 0.95),
    }))
  ).current;

  const [particleKey, setParticleKey] = React.useState(0);

  useEffect(() => {
    if (visible) {
      // Reset & respawn particles
      setParticleKey((k) => k + 1);

      backdropAnim.setValue(0);
      cardAnim.setValue(0);
      emojiScale.setValue(0);

      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(cardAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(180),
          Animated.spring(emojiScale, {
            toValue: 1,
            tension: 80,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardAnim,     { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)", opacity: backdropAnim }]}
      />

      {/* Konfetti Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p) => (
          <Particle key={`${particleKey}-${p.key}`} delay={p.delay} startX={p.startX} />
        ))}
      </View>

      {/* Tap backdrop to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Card */}
      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [{ translateY: cardTranslateY }, { scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            },
          ]}
        >
          {/* Glow ring */}
          <View style={styles.glowRing} />

          {/* Emoji */}
          <Animated.Text style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}>
            {emoji}
          </Animated.Text>

          <Text style={styles.title}>{title}</Text>

          {!!subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* CTA */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.75 }]}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    backgroundColor: "#111111",
    borderRadius: 28,
    paddingTop: 40,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(205,185,138,0.25)",
    overflow: "hidden",
  },
  glowRing: {
    position: "absolute",
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(205,185,138,0.06)",
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 24,
    color: "#F0E6C8",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    color: "rgba(240,230,200,0.65)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  divider: {
    width: 48,
    height: 1.5,
    backgroundColor: "rgba(205,185,138,0.25)",
    borderRadius: 1,
    marginVertical: 22,
  },
  cta: {
    backgroundColor: "#CDB98A",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  ctaText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: "#0A0A0A",
    letterSpacing: 0.3,
  },
});
