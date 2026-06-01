// apps/mobile/src/components/StillFlame.jsx
//
// Flammen-Maskottchen für StillMind.
// Wächst von einem winzigen Funken (Tag 1) zu einer goldenen,
// violett-akzentuierten Flamme (Tag 100).
//
// Props:
//   streak: number        aktueller Streak-Wert (1–100+)
//   size:   number        Basisgröße (default 120)
//   style:  ViewStyle

import React, { useEffect, useRef, useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Ellipse, Path, G, Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";

const AnimatedG       = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath    = Animated.createAnimatedComponent(Path);
const AnimatedCircle  = Animated.createAnimatedComponent(Circle);

// ─── Color stages ──────────────────────────────────────────
// t=0 (Tag 1) → warmes Gold
// t=0.5       → tiefes Amber
// t=0.85      → Violett-Gold
// t=1 (Tag 100) → Platinum-Weiß-Gold (Weiser)

const STAGES = [
  { t: 0,    outer: "#C8A060", mid: "#D4A96A", inner: "#F0D090", core: "#FDE8B0", glowC: "#D4A96A" },
  { t: 0.15, outer: "#B8935A", mid: "#D4A96A", inner: "#F0C880", core: "#FFF0C0", glowC: "#EFC878" },
  { t: 0.35, outer: "#A07840", mid: "#C8935A", inner: "#E8B060", core: "#FFE8A0", glowC: "#D4A96A" },
  { t: 0.55, outer: "#7A5030", mid: "#B07840", inner: "#D4A060", core: "#F8E090", glowC: "#C8935A" },
  { t: 0.75, outer: "#5A3A50", mid: "#9A6870", inner: "#C89070", core: "#F0D890", glowC: "#B88060" },
  { t: 0.90, outer: "#3A2840", mid: "#7A5878", inner: "#B890A0", core: "#F8F0D0", glowC: "#C8A888" },
  { t: 1.0,  outer: "#2A1E38", mid: "#6A4870", inner: "#A88098", core: "#FFF8E8", glowC: "#D8C0A8" },
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function lerpHex(c1, c2, t) {
  const h = s => parseInt(s, 16);
  const r1=h(c1.slice(1,3)),g1=h(c1.slice(3,5)),b1=h(c1.slice(5,7));
  const r2=h(c2.slice(1,3)),g2=h(c2.slice(3,5)),b2=h(c2.slice(5,7));
  return "#" + [lerp(r1,r2,t),lerp(g1,g2,t),lerp(b1,b2,t)]
    .map(v => Math.round(v).toString(16).padStart(2,"0")).join("");
}

function getColors(t) {
  let i = 0;
  for (let j = 0; j < STAGES.length - 1; j++) {
    if (t >= STAGES[j].t && t <= STAGES[j+1].t) { i = j; break; }
  }
  const a = STAGES[i], b = STAGES[Math.min(i+1, STAGES.length-1)];
  const lt = a.t === b.t ? 0 : (t - a.t) / (b.t - a.t);
  return {
    outer: lerpHex(a.outer, b.outer, lt),
    mid:   lerpHex(a.mid,   b.mid,   lt),
    inner: lerpHex(a.inner, b.inner, lt),
    core:  lerpHex(a.core,  b.core,  lt),
    glowC: lerpHex(a.glowC, b.glowC, lt),
  };
}

function flameD(cx, base, tipY, wHalf, taper = 0.32) {
  const mid = tipY + (base - tipY) * 0.5;
  return (
    `M${cx},${tipY} ` +
    `C${cx - wHalf*taper},${mid} ${cx - wHalf},${base - wHalf*0.35} ${cx},${base} ` +
    `C${cx + wHalf},${base - wHalf*0.35} ${cx + wHalf*taper},${mid} ${cx},${tipY} Z`
  );
}

// ─── Main component ─────────────────────────────────────────
export default function StillFlame({ streak = 1, size = 120, style }) {
  const s    = Math.max(1, Math.min(streak, 100));
  const t    = clamp((s - 1) / 99, 0, 1);
  const C    = getColors(t);

  const CX   = size * 0.5;
  const BASE = size * 0.92;

  const flameSize = lerp(size * 0.08, size * 0.88, Math.pow(t, 0.52));
  const tipY      = BASE - flameSize * lerp(0.95, 1.85, t);
  const wHalf     = flameSize * lerp(0.30, 0.54, t);

  const glowRX  = lerp(0, size * 0.52, t);
  const glowRY  = lerp(0, size * 0.18, t);
  const glowRX2 = lerp(0, size * 0.72, t);
  const glowRY2 = lerp(0, size * 0.26, t);

  const coreH = Math.max(size * 0.04, flameSize * 0.17);
  const coreW = Math.max(size * 0.02, wHalf * 0.26);

  const showSideFlames = s >= 20;
  const showEmbers     = s >= 10;
  const showCorona     = s >= 50;

  const sideT  = clamp((s - 20) / 80, 0, 1);
  const sideW  = wHalf * lerp(0.28, 0.42, sideT);
  const sideH  = flameSize * lerp(0.38, 0.60, sideT);
  const sideOff = wHalf * lerp(0.62, 0.78, sideT);
  const sideTipY = BASE - sideH;
  const sideOpacity = lerp(0.45, 0.75, sideT);

  const coronaT  = clamp((s - 50) / 50, 0, 1);
  const coronaRX1 = wHalf * lerp(1.4, 1.8, coronaT);
  const coronaRY1 = flameSize * lerp(0.14, 0.22, coronaT);
  const coronaRX2 = wHalf * lerp(1.9, 2.5, coronaT);
  const coronaRY2 = flameSize * lerp(0.09, 0.16, coronaT);
  const coronaCY  = BASE - flameSize * 0.08;

  // Paths
  const p1 = s > 2 ? flameD(CX, BASE, tipY, wHalf, 0.32) : null;
  const p2 = s > 2 ? flameD(CX, BASE, tipY + (BASE-tipY)*0.16, wHalf*0.74, 0.28) : null;
  const p3 = s > 2 ? flameD(CX, BASE, tipY + (BASE-tipY)*0.34, wHalf*0.50, 0.24) : null;
  const p4 = s > 2 ? flameD(CX, BASE, tipY + (BASE-tipY)*0.52, wHalf*0.32, 0.20) : null;

  const sideLPath = showSideFlames
    ? `M${CX-sideOff},${sideTipY} C${CX-sideOff-sideW*0.3},${(sideTipY+BASE)/2} ${CX-sideOff-sideW},${BASE-sideW*0.3} ${CX-sideOff},${BASE} C${CX-sideOff+sideW*0.6},${BASE-sideW*0.2} ${CX-sideOff+sideW*0.2},${(sideTipY+BASE)/2} ${CX-sideOff},${sideTipY} Z`
    : null;
  const sideRPath = showSideFlames
    ? `M${CX+sideOff},${sideTipY} C${CX+sideOff+sideW*0.3},${(sideTipY+BASE)/2} ${CX+sideOff+sideW},${BASE-sideW*0.3} ${CX+sideOff},${BASE} C${CX+sideOff-sideW*0.6},${BASE-sideW*0.2} ${CX+sideOff-sideW*0.2},${(sideTipY+BASE)/2} ${CX+sideOff},${sideTipY} Z`
    : null;

  // ── Animations ────────────────────────────────────────────
  const flicker1 = useSharedValue(0);
  const flicker2 = useSharedValue(0);
  const flicker3 = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const sparkPulse = useSharedValue(0);
  const drift = useSharedValue(0);
  const emberY1 = useSharedValue(0);
  const emberY2 = useSharedValue(0);
  const emberY3 = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.inOut(Easing.sin);

    flicker1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: ease }),
        withTiming(0, { duration: 1100, easing: ease })
      ), -1, false
    );
    flicker2.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 950, easing: ease }),
        withTiming(0, { duration: 950, easing: ease })
      ), -1, false
    );
    flicker3.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: ease }),
        withTiming(0, { duration: 1300, easing: ease })
      ), -1, false
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: ease }),
        withTiming(0, { duration: 1400, easing: ease })
      ), -1, false
    );
    sparkPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: ease }),
        withTiming(0, { duration: 600, easing: ease })
      ), -1, false
    );
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: ease }),
        withTiming(0, { duration: 1800, easing: ease })
      ), -1, false
    );
    emberY1.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    emberY2.value = withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }), -1, false);
    emberY3.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false);
  }, []);

  const animF1 = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(flicker1.value, [0,1], [1, 0.95]) },
      { scaleY: interpolate(flicker1.value, [0,1], [1, 1.05]) },
    ],
  }));
  const animF2 = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(flicker2.value, [0,1], [1, 1.05]) },
      { scaleY: interpolate(flicker2.value, [0,1], [1, 0.95]) },
    ],
  }));
  const animF3 = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(flicker3.value, [0,1], [0.97, 1.03]) },
      { scaleY: interpolate(flicker3.value, [0,1], [1.04, 0.96]) },
    ],
  }));
  const animGlow = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0,1], [0.15, 0.40]),
  }));
  const animGlowOuter = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0,1], [0.06, 0.16]),
  }));
  const animSpark = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(sparkPulse.value, [0,1], [1, 0.65]) }],
    opacity: interpolate(sparkPulse.value, [0,1], [0.9, 0.45]),
  }));
  const animDrift = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(drift.value, [0,1], [0, size*0.015]) }],
  }));
  const animCorona = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0,1], [0.10, 0.25]),
  }));

  const animEmber1Props = useAnimatedProps(() => ({
    cy:      interpolate(emberY1.value, [0,1], [BASE - flameSize*0.3, BASE - flameSize*0.9]),
    cx:      CX - size*0.1 + interpolate(emberY1.value, [0,1], [0, -size*0.06]),
    opacity: interpolate(emberY1.value, [0,0.7,1], [0.8, 0.6, 0]),
  }));
  const animEmber2Props = useAnimatedProps(() => ({
    cy:      interpolate(emberY2.value, [0,1], [BASE - flameSize*0.2, BASE - flameSize*0.85]),
    cx:      CX + size*0.12 + interpolate(emberY2.value, [0,1], [0, size*0.07]),
    opacity: interpolate(emberY2.value, [0,0.7,1], [0.7, 0.5, 0]),
  }));
  const animEmber3Props = useAnimatedProps(() => ({
    cy:      interpolate(emberY3.value, [0,1], [BASE - flameSize*0.4, BASE - flameSize*0.95]),
    cx:      CX + interpolate(emberY3.value, [0,1], [0, size*0.04]),
    opacity: interpolate(emberY3.value, [0,0.6,1], [0.6, 0.4, 0]),
  }));

  const svgH = size * 1.05;

  return (
    <View style={[{ width: size, height: svgH }, style]}>
      <Svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`}>
        <Defs>
          <RadialGradient id="glowGrad" cx="50%" cy="80%" r="55%">
            <Stop offset="0%"   stopColor={C.glowC} stopOpacity="0.8" />
            <Stop offset="100%" stopColor={C.glowC} stopOpacity="0"   />
          </RadialGradient>
        </Defs>

        {/* Outer glow halo */}
        <AnimatedEllipse
          cx={CX} cy={BASE}
          rx={glowRX2} ry={glowRY2}
          fill={C.glowC}
          style={animGlowOuter}
        />
        {/* Inner glow */}
        <AnimatedEllipse
          cx={CX} cy={BASE}
          rx={glowRX} ry={glowRY}
          fill="url(#glowGrad)"
          style={animGlow}
        />

        {/* Corona rings (ab Tag 50) */}
        {showCorona && (
          <AnimatedG style={animCorona}>
            <Ellipse
              cx={CX} cy={coronaCY}
              rx={coronaRX1} ry={coronaRY1}
              fill="none"
              stroke={C.glowC}
              strokeWidth={size * 0.008}
            />
            <Ellipse
              cx={CX} cy={coronaCY}
              rx={coronaRX2} ry={coronaRY2}
              fill="none"
              stroke={C.mid}
              strokeWidth={size * 0.005}
            />
          </AnimatedG>
        )}

        {/* Flamme */}
        <AnimatedG style={animDrift}>
          {/* Spark (nur Tag 1–2) */}
          {s <= 2 && (
            <AnimatedG style={animSpark}>
              <Ellipse
                cx={CX} cy={BASE - flameSize * 0.5}
                rx={flameSize * 0.38} ry={flameSize}
                fill={C.outer} opacity={0.95}
              />
              <Ellipse
                cx={CX} cy={BASE - flameSize * 0.55}
                rx={flameSize * 0.22} ry={flameSize * 0.58}
                fill={C.core} opacity={0.9}
              />
            </AnimatedG>
          )}

          {/* Seitenflammen (ab Tag 20) */}
          {showSideFlames && sideLPath && sideRPath && (
            <AnimatedG style={animF2}>
              <Path d={sideLPath} fill={C.mid} opacity={sideOpacity} />
              <Path d={sideRPath} fill={C.mid} opacity={sideOpacity} />
            </AnimatedG>
          )}

          {/* Hauptflamme (4 Schichten) */}
          {s > 2 && p1 && (
            <>
              <AnimatedG style={animF1}>
                <Path d={p1} fill={C.outer} opacity={0.97} />
              </AnimatedG>
              <AnimatedG style={animF2}>
                <Path d={p2} fill={C.mid} />
              </AnimatedG>
              <AnimatedG style={animF3}>
                <Path d={p3} fill={C.inner} />
              </AnimatedG>
              <AnimatedG style={animF1}>
                <Path d={p4} fill={C.core} opacity={0.92} />
              </AnimatedG>
              <Ellipse
                cx={CX} cy={BASE - coreH * 0.45}
                rx={coreW} ry={coreH}
                fill={C.core} opacity={0.95}
              />
            </>
          )}
        </AnimatedG>

        {/* Glut-Partikel (ab Tag 10) */}
        {showEmbers && (
          <>
            <AnimatedCircle r={size*0.016} fill={C.mid} animatedProps={animEmber1Props} />
            <AnimatedCircle r={size*0.013} fill={C.inner} animatedProps={animEmber2Props} />
            <AnimatedCircle r={size*0.012} fill={C.glowC} animatedProps={animEmber3Props} />
          </>
        )}
      </Svg>
    </View>
  );
}
