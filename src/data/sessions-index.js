import { t } from "@/utils/i18n";

export const getCategories = () => [
  { id:"calm",    label:t("cat_calm_label"),    icon:"🌊", description:t("cat_calm_desc") },
  { id:"sleep",   label:t("cat_sleep_label"),   icon:"🌙", description:t("cat_sleep_desc") },
  { id:"focus",   label:t("cat_focus_label"),   icon:"🎯", description:t("cat_focus_desc") },
  { id:"emotion", label:t("cat_emotion_label"), icon:"💚", description:t("cat_emotion_desc") },
  { id:"parent",  label:t("cat_parent_label"),  icon:"👨\u200d👩\u200d👧", description:t("cat_parent_desc") },
  { id:"work",    label:t("cat_work_label"),    icon:"☕", description:t("cat_work_desc") },
  { id:"thoughts",label:t("cat_thoughts_label"),icon:"🧠", description:t("cat_thoughts_desc") },
];

// categories: use getCategories() for translated version
export const categories = getCategories(); // called at import - ensure i18n is ready

export const getSessions = () => [
  { id:"calm-1",     title:t("sess_calm1_title"),     description:t("sess_calm1_desc"),     duration:60, type:t("sess_calm1_type"),    category:"calm",    categoryLabel:t("cat_calm_label"),    isPremium:false },
  { id:"calm-2",     title:t("sess_calm2_title"),     description:t("sess_calm2_desc"),     duration:60, type:t("sess_calm2_type"),    category:"calm",    categoryLabel:t("cat_calm_label"),    isPremium:true  },
  { id:"sleep-1",    title:t("sess_sleep1_title"),    description:t("sess_sleep1_desc"),    duration:60, type:t("sess_sleep1_type"),   category:"sleep",   categoryLabel:t("cat_sleep_label"),   isPremium:false },
  { id:"sleep-2",    title:t("sess_sleep2_title"),    description:t("sess_sleep2_desc"),    duration:60, type:t("sess_sleep2_type"),   category:"sleep",   categoryLabel:t("cat_sleep_label"),   isPremium:true  },
  { id:"focus-1",    title:t("sess_focus1_title"),    description:t("sess_focus1_desc"),    duration:60, type:t("sess_focus1_type"),   category:"focus",   categoryLabel:t("cat_focus_label"),   isPremium:false },
  { id:"focus-2",    title:t("sess_focus2_title"),    description:t("sess_focus2_desc"),    duration:60, type:t("sess_focus2_type"),   category:"focus",   categoryLabel:t("cat_focus_label"),   isPremium:true  },
  { id:"emotion-1",  title:t("sess_emotion1_title"),  description:t("sess_emotion1_desc"),  duration:60, type:t("sess_emotion1_type"), category:"emotion", categoryLabel:t("cat_emotion_label"), isPremium:false },
  { id:"emotion-2",  title:t("sess_emotion2_title"),  description:t("sess_emotion2_desc"),  duration:60, type:t("sess_emotion2_type"), category:"emotion", categoryLabel:t("cat_emotion_label"), isPremium:true  },
  { id:"parent-1",   title:t("sess_parent1_title"),   description:t("sess_parent1_desc"),   duration:60, type:t("sess_parent1_type"),  category:"parent",  categoryLabel:t("cat_parent_label"),  isPremium:false },
  { id:"parent-2",   title:t("sess_parent2_title"),   description:t("sess_parent2_desc"),   duration:60, type:t("sess_parent2_type"),  category:"parent",  categoryLabel:t("cat_parent_label"),  isPremium:true  },
  { id:"work-1",     title:t("sess_work1_title"),     description:t("sess_work1_desc"),     duration:60, type:t("sess_work1_type"),    category:"work",    categoryLabel:t("cat_work_label"),    isPremium:false },
  { id:"work-2",     title:t("sess_work2_title"),     description:t("sess_work2_desc"),     duration:60, type:t("sess_work2_type"),    category:"work",    categoryLabel:t("cat_work_label"),    isPremium:true  },
  { id:"thoughts-1", title:t("sess_thoughts1_title"), description:t("sess_thoughts1_desc"), duration:60, type:t("sess_thoughts1_type"),category:"thoughts",categoryLabel:t("cat_thoughts_label"),isPremium:false },
  { id:"thoughts-2", title:t("sess_thoughts2_title"), description:t("sess_thoughts2_desc"), duration:60, type:t("sess_thoughts2_type"),category:"thoughts",categoryLabel:t("cat_thoughts_label"),isPremium:true  },
];

export const sessions    = getSessions();
export const allSessions = getSessions(); // called at import - ensure i18n is ready
export const defaultSessionId = "calm-1";

export const getSessionById = (id) => { if (!id) return null; return getSessions().find(s => s.id === id) || null; };
export const getSessionsByCategory = (cat) => { if (!cat) return []; return getSessions().filter(s => s.category === cat); };
export const getFreeSessions = () => getSessions().filter(s => !s.isPremium);
