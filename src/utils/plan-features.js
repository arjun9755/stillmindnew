/**
 * plan-features.js — Backward-compat re-export.
 * Alle Importe aus plan-features bleiben stabil.
 * Intern wird auf access.js delegiert.
 */
export {
  normalizeAccessPlan as normalizePlan,
  canExport,
  canUseStats,
  canSetGoals,
  canCustomizeTheme,
  canUseSOS,
  canSelectMinutes,
  canUseMonthReport,
  canUseYearReport,
  historyRangeDays,
  sessionLimitPerDay,
  maxMinutesAllowed,
  getLogbookRangeOptions,
  clampLogbookRange,
  getExportRangeOptions,
} from "./access";
