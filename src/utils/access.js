/**
 * access.js — Single Source of Truth für Plan-Gating in StillMind.
 *
 * Plans: "free" | "pro" | "lifetime"
 * (Pro Light wurde entfernt.)
 *
 * Alle Screens importieren NUR diese Funktionen.
 * Kein verstreutes if/else mehr.
 */

// ─── Normalize ───────────────────────────────────────────────────────────────
export function normalizeAccessPlan(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (s === "lifetime" || s === "premiumlife" || s === "premiumlifetime") return "lifetime";
  if (s === "pro")                             return "pro";
  // proLight wurde entfernt → wird zu "free" degradiert
  return "free";
}

// ─── Access Level ─────────────────────────────────────────────────────────────
export function getAccessLevel(plan) {
  const p = normalizeAccessPlan(plan);
  if (p === "lifetime") return "LIFETIME";
  if (p === "pro")      return "PRO";
  return "FREE";
}

// ─── Composite check (PRO or LIFETIME) ───────────────────────────────────────
export function hasProAccess(plan) {
  const p = normalizeAccessPlan(plan);
  return p === "pro" || p === "lifetime";
}

// ─── Feature gates ────────────────────────────────────────────────────────────

/** SOS-Button: ab Pro */
export function canUseSOS(plan) {
  return hasProAccess(plan);
}

/** Vollständige Statistiken (Logbuch > 7T, Insights, etc.): ab Pro */
export function canUseStats(plan) {
  return hasProAccess(plan);
}

/** Export (CSV/PDF): ab Pro */
export function canExport(plan) {
  return hasProAccess(plan);
}

/** Monatsbericht: ab Pro */
export function canUseMonthReport(plan) {
  return hasProAccess(plan);
}

/** Jahresbericht + Langzeittrends: nur Lifetime */
export function canUseYearReport(plan) {
  return normalizeAccessPlan(plan) === "lifetime";
}

/** Ziele setzen: ab Pro */
export function canSetGoals(plan) {
  return hasProAccess(plan);
}

/** Farbschema anpassen: nur Lifetime */
export function canCustomizeTheme(plan) {
  return normalizeAccessPlan(plan) === "lifetime";
}

/** Freie Zeitwahl (1–10 Min.): ab Pro */
export function canSelectMinutes(plan) {
  return hasProAccess(plan);
}

/** Verlauf (Tage): Free=7, Pro=90, Lifetime=unbegrenzt (Infinity) */
export function historyRangeDays(plan) {
  const p = normalizeAccessPlan(plan);
  if (p === "lifetime") return Infinity;
  if (p === "pro")      return 90;
  return 7;
}

/** Max. Sessions pro Tag: Free=1, Pro/Lifetime=Infinity */
export function sessionLimitPerDay(plan) {
  if (hasProAccess(plan)) return Infinity;
  return 1;
}

/** Max. Minuten erlaubt: Free=1, Pro/Lifetime=10 */
export function maxMinutesAllowed(plan) {
  if (hasProAccess(plan)) return 10;
  return 1;
}

/** Logbuch-Range-Optionen für Filter-Buttons */
export function getLogbookRangeOptions(plan) {
  const p = normalizeAccessPlan(plan);
  if (p === "free") return [{ key: "7", label: "7 Tage" }];
  if (p === "pro")  return [
    { key: "7",  label: "7 Tage"  },
    { key: "30", label: "30 Tage" },
    { key: "90", label: "90 Tage" },
  ];
  // lifetime
  return [
    { key: "7",      label: "7 Tage"    },
    { key: "30",     label: "30 Tage"   },
    { key: "90",     label: "90 Tage"   },
    { key: "all",    label: "Alle"      },
    { key: "custom", label: "Zeitraum"  },
  ];
}

export function clampLogbookRange(plan, stored) {
  const opts = getLogbookRangeOptions(plan);
  const allowed = new Set(opts.map((o) => o.key));
  return allowed.has(String(stored || "7")) ? String(stored) : "7";
}

/** Export-Range-Optionen */
export function getExportRangeOptions(plan) {
  return getLogbookRangeOptions(plan);
}

/** KI-Quartalsanalyse: nur Lifetime */
export function canUseAIAnalysis(plan) {
  return normalizeAccessPlan(plan) === "lifetime";
}

/** Feature-Voting: nur Lifetime */
export function canVote(plan) {
  return normalizeAccessPlan(plan) === "lifetime";
}

/** Gründer-Profil / Lifetime Badge: nur Lifetime */
export function hasLifetimeStatus(plan) {
  return normalizeAccessPlan(plan) === "lifetime";
}

/** Verlaufs-Historie: Free=7T, Pro=90T, Lifetime=∞ */
export function getHistoryLimit(plan) {
  const p = normalizeAccessPlan(plan);
  if (p === "lifetime") return null; // null = unbegrenzt
  if (p === "pro")      return 90;
  return 7;
}
