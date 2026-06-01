// apps/mobile/src/app/index.jsx
// Premium Splash Screen
// – Logo groß und zentriert, kein schwarzer Kasten
// – Warmer Glow-Effekt: mehrere überlagerte Circles
// – Cinematic: Glow blooms → Logo lifts in → Separator → fade-out

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Animated,
  Easing,
  Image,
  Dimensions,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SW } = Dimensions.get("screen");

const CANONICAL_KEY   = "stillmind:onboardingCompleted";
const ONBOARDING_KEYS = [
  CANONICAL_KEY,
  "onboardingCompleted",
  "onboarding_completed",
  "stillmind_onboarding_completed",
  "stillmind:onboardingDone",
];

const LOGO = require("../../assets/brand/stillmind-logo-transparent.png");
const BG   = "#0B0B0B";

async function readOnboardingCompleted() {
  for (const key of ONBOARDING_KEYS) {
    try {
      const v = await AsyncStorage.getItem(key);
      if (v === "true") return { completed: true, key };
    } catch (_) {}
  }
  return { completed: false, key: null };
}

export default function Index() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  // Animation values
  const glow1   = useRef(new Animated.Value(0)).current;
  const glow2   = useRef(new Animated.Value(0)).current;
  const glow3   = useRef(new Animated.Value(0)).current;
  const logoOp  = useRef(new Animated.Value(0)).current;
  const logoY   = useRef(new Animated.Value(20)).current;
  const lineOp  = useRef(new Animated.Value(0)).current;
  const screenOp = useRef(new Animated.Value(1)).current;

  const targetRoute = useRef(null);

  // ── Boot ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { completed } = await readOnboardingCompleted();
        if (!alive) return;
        if (completed) {
          try { await AsyncStorage.setItem(CANONICAL_KEY, "true"); } catch (_) {}
        }
        targetRoute.current = completed ? "/(tabs)" : "/onboarding";
      } catch (_) {
        targetRoute.current = "/onboarding";
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Cinematic sequence ──
  useEffect(() => {
    // Outer halo
    Animated.timing(glow1, {
      toValue: 1, duration: 1100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Mid glow (100ms stagger)
    setTimeout(() => {
      Animated.timing(glow2, {
        toValue: 1, duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 100);

    // Core (200ms stagger)
    setTimeout(() => {
      Animated.timing(glow3, {
        toValue: 1, duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 200);

    // Logo lifts in
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOp, {
          toValue: 1, duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoY, {
          toValue: 0, duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 220);

    // Separator line
    setTimeout(() => {
      Animated.timing(lineOp, {
        toValue: 1, duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 700);
  }, []);

  // ── Navigate ──
  useEffect(() => {
    if (booting) return;
    const t = setTimeout(() => {
      Animated.timing(screenOp, {
        toValue: 0, duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        try { router.replace(targetRoute.current); } catch (_) {}
      });
    }, 980);
    return () => clearTimeout(t);
  }, [booting]);

  const logoSz  = Math.min(340, Math.round(SW * 0.72));  // Größer und prägnanter
  const halo    = Math.round(SW * 1.20);
  const mid     = Math.round(SW * 0.80);
  const core    = Math.round(SW * 0.46);

  return (
    <Animated.View style={[s.root, { opacity: screenOp }]}>

      {/* ── Glow layer 1: outer warm halo ── */}
      <Animated.View
        pointerEvents="none"
        style={[s.glowBase, {
          width: halo, height: halo, borderRadius: halo / 2,
          // Warm beige, very transparent – creates atmosphere
          backgroundColor: "rgba(210,194,168,0.038)",
          opacity: glow1,
          transform: [{ scale: glow1.interpolate({ inputRange: [0,1], outputRange: [0.50, 1] }) }],
        }]}
      />

      {/* ── Glow layer 2: mid ring ── */}
      <Animated.View
        pointerEvents="none"
        style={[s.glowBase, {
          width: mid, height: mid, borderRadius: mid / 2,
          backgroundColor: "rgba(218,202,174,0.060)",
          opacity: glow2,
          transform: [{ scale: glow2.interpolate({ inputRange: [0,1], outputRange: [0.55, 1] }) }],
        }]}
      />

      {/* ── Glow layer 3: bright inner core ── */}
      <Animated.View
        pointerEvents="none"
        style={[s.glowBase, {
          width: core, height: core, borderRadius: core / 2,
          backgroundColor: "rgba(232,218,192,0.090)",
          opacity: glow3,
          transform: [{ scale: glow3.interpolate({ inputRange: [0,1], outputRange: [0.60, 1] }) }],
        }]}
      />

      {/* ── Logo – NO background, transparent container ── */}
      <Animated.View style={{
        opacity: logoOp,
        transform: [{ translateY: logoY }],
        // CRITICAL: transparent so the glow shows through on Android
        backgroundColor: "transparent",
      }}>
        <Image
          source={LOGO}
          style={{
            width: logoSz,
            height: logoSz,
            // transparent background eliminates black box on Android
            backgroundColor: "transparent",
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Thin separator line beneath logo ── */}
      <Animated.View
        pointerEvents="none"
        style={{
          opacity: lineOp,
          marginTop: Math.round(logoSz * 0.24),
          width: 42,
          height: 1.5,
          borderRadius: 1,
          backgroundColor: "rgba(201,188,168,0.32)",
        }}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    // Ensure no stray backgrounds
    overflow: "hidden",
  },
  glowBase: {
    position: "absolute",
    // centered via absolute + negative margins trick won't work with Animated
    // so we use alignSelf + the fact root is centered
    alignSelf: "center",
  },
});
