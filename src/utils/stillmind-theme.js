// apps/mobile/src/utils/stillmind-theme.js
// Dark-only theme hook (system scheme is ignored to keep iOS/Android identical)

import { DeviceEventEmitter } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSettings, getUserPlan, getDevPlanOverride } from "@/utils/storage";

/* =========================
   Color helpers
   ========================= */
const clamp01 = (n) => Math.max(0, Math.min(1, n));

const clampIntensity = (n) => {
  const v = clamp01(n);
  return Math.max(0.35, v);
};

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== "string") return null;
  const h = hex.replace("#", "").trim();
  if (![3, 6].includes(h.length)) return null;

  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;

  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const rgbToHex = ({ r, g, b }) => {
  const to = (v) => v.toString(16).padStart(2, "0");
  return `#${to(Math.round(r))}${to(Math.round(g))}${to(Math.round(b))}`;
};

const mix = (aHex, bHex, t) => {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return aHex || bHex;

  const tt = clamp01(t);
  return rgbToHex({
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt,
  });
};

const lighten = (hex, amount) => mix(hex, "#FFFFFF", amount);

/* =========================
   Theme hook (Dark-only)
   ========================= */
export const useStillMindTheme = () => {
  const isDark = true;

  const [overrides, setOverrides] = useState({
    primary: null,
    intensity: 1,
  });

  // ✅ NEW: track effective plan so we can force standard color on downgrade
  const [effectivePlan, setEffectivePlan] = useState("free");

  const loadThemeOverrides = useCallback(async () => {
    try {
      const [s, devOverride, storedPlan] = await Promise.all([
        getSettings(),
        getDevPlanOverride && getDevPlanOverride(),
        getUserPlan && getUserPlan(),
      ]);

      const settings = s || {};
      const primary =
        typeof settings.themePrimary === "string"
          ? settings.themePrimary
          : null;

      const intensityRaw =
        typeof settings.themeIntensity === "number"
          ? settings.themeIntensity
          : 1;

      const plan = devOverride || storedPlan || "free";

      setEffectivePlan(plan);
      setOverrides({
        primary,
        intensity: clampIntensity(intensityRaw),
      });
    } catch (_e) {
      setEffectivePlan("free");
      setOverrides({ primary: null, intensity: 1 });
    }
  }, []);

  useEffect(() => {
    loadThemeOverrides();

    const subTheme = DeviceEventEmitter.addListener(
      "stillmind:themeChanged",
      loadThemeOverrides
    );

    // ✅ react to BOTH event names you use in the app
    const subPlanColon = DeviceEventEmitter.addListener(
      "stillmind:planChanged",
      loadThemeOverrides
    );
    const subPlanDot = DeviceEventEmitter.addListener(
      "stillmind.plan.changed",
      loadThemeOverrides
    );

    return () => {
      try {
        subTheme && subTheme.remove && subTheme.remove();
        subPlanColon && subPlanColon.remove && subPlanColon.remove();
        subPlanDot && subPlanDot.remove && subPlanDot.remove();
      } catch (_e) {}
    };
  }, [loadThemeOverrides]);

  const colors = useMemo(() => {
    const STANDARD_BEIGE = "#C9BCA8";

    const base = {
      background: "#0B0B0B",
      surface: "#141414",
      surfaceVariant: "#1A1A1A",
      border: "rgba(255,255,255,0.10)",

      text: "#FFFFFF",
      textSecondary: "rgba(255,255,255,0.65)",

      primary: STANDARD_BEIGE,

      categoryCalm: "#A8BEC4",
      categoryFocus: "#B3A594",
      categorySleep: "#9D8EAA",
      categoryEmotion: "#C49A9A",
      categoryWork: "#98AA98",
      categoryParent: "#AA9898",

      premium: "#C4A876",
      premiumLight: "#2A2618",
    };

    const sosBg = base.premium;
    const sosText = "#1A1815";

    // ✅ Only lifetime may use custom primary/intensity
    const isLifetime = effectivePlan === "lifetime";

    const intensity = isLifetime
      ? typeof overrides.intensity === "number"
        ? clampIntensity(overrides.intensity)
        : 1
      : 1;

    const primaryRaw = isLifetime
      ? overrides.primary || base.primary
      : base.primary;

    const primary =
      intensity >= 0.999
        ? primaryRaw
        : mix(base.background, primaryRaw, intensity);

    const secondaryRaw = lighten(primaryRaw, 0.18);
    const secondary =
      intensity >= 0.999
        ? secondaryRaw
        : mix(base.background, secondaryRaw, intensity);

    const themedBackground = mix(base.background, primary, 0.06);
    const themedSurface = mix(base.surface, primary, 0.1);
    const themedSurfaceVariant = mix(base.surfaceVariant, secondary, 0.1);

    const themedBorder = mix("#2A2A2A", secondary, 0.25);

    const categoryCalm = mix(base.categoryCalm, primary, 0.18);
    const categoryFocus = mix(base.categoryFocus, primary, 0.18);
    const categorySleep = mix(base.categorySleep, primary, 0.18);
    const categoryEmotion = mix(base.categoryEmotion, primary, 0.18);
    const categoryWork = mix(base.categoryWork, primary, 0.18);
    const categoryParent = mix(base.categoryParent, primary, 0.18);

    return {
      ...base,
      background: themedBackground,
      surface: themedSurface,
      surfaceVariant: themedSurfaceVariant,
      border: themedBorder,

      primary,
      secondary,

      categoryCalm,
      categoryFocus,
      categorySleep,
      categoryEmotion,
      categoryWork,
      categoryParent,

      sosBg,
      sosText,
    };
  }, [overrides, effectivePlan]);

  return { colors, isDark };
};