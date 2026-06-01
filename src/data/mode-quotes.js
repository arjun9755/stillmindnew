import { t } from "@/utils/i18n";

export const getModeQuotes = () => ({
  calm: {
    id: "calm",
    label: t("mode_calm"),
    icon: "🌊",
    quote: t("quote_calm_0"),
    quotes: [
      t("quote_calm_1"), t("quote_calm_2"), t("quote_calm_3"),
      t("quote_calm_4"), t("quote_calm_5"),
    ],
  },
  sleep: {
    id: "sleep",
    label: t("mode_sleep"),
    icon: "🌙",
    quote: t("quote_sleep_0"),
    quotes: [
      t("quote_sleep_1"), t("quote_sleep_2"), t("quote_sleep_3"),
      t("quote_sleep_4"), t("quote_sleep_5"),
    ],
  },
  focus: {
    id: "focus",
    label: t("mode_focus"),
    icon: "🎯",
    quote: t("quote_focus_0"),
    quotes: [
      t("quote_focus_1"), t("quote_focus_2"), t("quote_focus_3"),
      t("quote_focus_4"), t("quote_focus_5"),
    ],
  },
  emotion: {
    id: "emotion",
    label: t("mode_emotion"),
    icon: "💚",
    quote: t("quote_emotion_0"),
    quotes: [
      t("quote_emotion_1"), t("quote_emotion_2"), t("quote_emotion_3"),
      t("quote_emotion_4"), t("quote_emotion_5"),
    ],
  },
  parent: {
    id: "parent",
    label: t("mode_parent"),
    icon: "👨\u200d👩\u200d👧",
    quote: t("quote_parent_0"),
    quotes: [
      t("quote_parent_1"), t("quote_parent_2"), t("quote_parent_3"),
      t("quote_parent_4"), t("quote_parent_5"),
    ],
  },
  work: {
    id: "work",
    label: t("mode_work"),
    icon: "☕",
    quote: t("quote_work_0"),
    quotes: [
      t("quote_work_1"), t("quote_work_2"), t("quote_work_3"),
      t("quote_work_4"), t("quote_work_5"),
    ],
  },
  thoughts: {
    id: "thoughts",
    label: t("mode_thoughts"),
    icon: "🧠",
    quote: t("quote_thoughts_0"),
    quotes: [
      t("quote_thoughts_1"), t("quote_thoughts_2"), t("quote_thoughts_3"),
      t("quote_thoughts_4"), t("quote_thoughts_5"),
    ],
  },
});

export const getModeById = (id) => {
  const all = getModeQuotes();
  return all[id] || all.calm;
};

export const getAllModes = () => Object.values(getModeQuotes());

// Keep modeQuotes as alias for compatibility
export const modeQuotes = getModeQuotes();
