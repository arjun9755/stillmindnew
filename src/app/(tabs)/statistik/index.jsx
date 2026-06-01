import React, {useCallback, useMemo, useRef, useState, useEffect} from "react";
import { useFocusEffect } from "@react-navigation/native";
import CelebrationModal from "@/components/CelebrationModal";
import UpgradePopup from "@/components/UpgradePopup";
import {
  View,
  Text,
  ScrollView,
  AppState,
  DeviceEventEmitter,
  Modal,
  Pressable,
  Animated,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  FlatList,
  PanResponder,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import {
  RefreshCcw,
  Sparkles,
  Compass,
  CalendarCheck,
  NotebookPen,
  ChevronRight,
  X,
  GripVertical,
} from "lucide-react-native";
import MinutesBubble from "@/components/MinutesBubble";
import {
  getSessionHistory,
  getUserPlan,
  getWeeklyResetsCount,
  checkAndUnlockAchievements,
  getUnlockedAchievements,
  getCompletedSessions,
  getTotalSessions,
  getUserGoals,
  updateUserGoal,
  addUserGoal,
  removeUserGoal,
  getStatistikCardOrder,
  setStatistikCardOrder,
} from "@/utils/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSessionById, sessions } from "@/data/sessions-index";
import { getModeById } from "@/data/mode-quotes";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n, t } from "@/utils/i18n";
import StillFlame from "@/components/StillFlame";
import {
  canExport,
  canSetGoals,
  canUseStats,
  canUseMonthReport,
  canUseYearReport,
  clampLogbookRange,
  getLogbookRangeOptions,
} from "@/utils/access";

const STILLMIND_LOGO = require("../../../../assets/brand/stillmind-logo-transparent.png");
const pad2 = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad2(x.getMonth()+1)}-${pad2(x.getDate())}`; };
const isoWeekKeyGlobal = (ts) => { const d = new Date(ts); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day+3); const isoYear=d.getFullYear(); const ft=new Date(isoYear,0,4); const fd=(ft.getDay()+6)%7; ft.setDate(ft.getDate()-fd+3); return `${isoYear}-W${String(1+Math.round((d.getTime()-ft.getTime())/(7*24*3600*1000))).padStart(2,"0")}`; };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const weekdayDE = (d, tFn) => [tFn("weekday_su"),tFn("weekday_mo"),tFn("weekday_di"),tFn("weekday_mi"),tFn("weekday_do"),tFn("weekday_fr"),tFn("weekday_sa")][d.getDay()] || "";
const formatHHmm = (ts) => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const formatDuration = (sec) => { const s = Math.max(0, Math.round(Number(sec)||0)); const h = Math.floor(s/3600); const m = Math.floor((s%3600)/60); const r = s%60; if (h>0) return `${h}:${pad2(m)}:${pad2(r)}`; return `${m}:${pad2(r)}`; };
const moodEmoji = (m) => { const x = typeof m==="string"?m.trim():""; if (x==="better"||x==="😌") return "😌"; if (x==="same"||x==="😐") return "😐"; if (x==="worse"||x==="😣") return "😣"; if (x==="gut"||x==="🙂") return "🙂"; if (x==="sehr_gut") return "😌"; if (x==="gestresst") return "😣"; if (x==="angespannt") return "😕"; return ""; };
const formatDateDE = (ts) => { const d = new Date(ts); return `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`; };
const clampRangeDays = (plan, n) => { const isPaid = plan==="pro"||plan==="lifetime"; const v = Number(n)||7; if (!isPaid) return 7; if (v===7||v===30||v===90) return v; return 7; };
const getRangeMinTs = (days) => { const d = Number(days)||7; const now = Date.now(); return startOfDay(now).getTime() - (d-1)*24*3600*1000; };

const getEntryTitle = (entry) => {
  if ((entry && entry.sessionName)) return entry.sessionName;
  if ((entry && entry.source)==="sos"||(entry && entry.sessionId)==="SOS") return "SOS";
  if ((entry && entry.sessionId)) { const s = getSessionById(entry.sessionId); if ((s && s.title)) return s.title; if (typeof entry.sessionId==="string"&&entry.sessionId.startsWith("quick:")) { const m = getModeById(entry.sessionId.split(":")[1]); if ((m && m.label)) return m.label; } }
  if ((entry && entry.mode)) { const m = getModeById(entry.mode); if ((m && m.label)) return m.label; }
  return "Session";
};

const DEFAULT_CARD_ORDER = ["overview","logbook","goals","achievements","insights","export"];
const getCardLabels = (tFn) => ({ overview:tFn("stat_overview"), logbook:tFn("logbook"), goals:tFn("stat_card_goals"), weeklyGoal:tFn("weekly_goal_soft"), achievements:tFn("achievements"), insights:tFn("stat_card_insights"), export:tFn("stat_card_export") });



const LOGBOOK_LIMITS = { free:10, pro:Infinity, lifetime:Infinity };
export default function StatistikScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang } = useI18n();
  const { colors: themeColors } = useStillMindTheme();
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });

  const [history, setHistory] = useState([]);
  const [plan, setPlan] = useState("free");
  const [totalStarts, setTotalStarts] = useState(0);
  const [completedIds, setCompletedIds] = useState([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const weeklyTarget = 5;
  const [weeklyCelebVisible, setWeeklyCelebVisible] = useState(false);
  const prevWeeklyCount = useRef(0);

  // On mount: if this week was already celebrated, set prevWeeklyCount high so it never re-triggers
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const weekKey = `celeb_weekly_${now.getFullYear()}_${isoWeekKeyGlobal(now.getTime())}`;
        const already = await AsyncStorage.getItem(weekKey);
        if (already) prevWeeklyCount.current = 9999;
      } catch (_) {}
    })();
  }, []);
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [explorerRemaining, setExplorerRemaining] = useState(null);
  const [goals, setGoals] = useState([]);

  // UI state
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState("pro");
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalValue, setGoalValue] = useState("5");
  const [goalsModalVisible, setGoalsModalVisible] = useState(false);
  const [goalCreateVisible, setGoalCreateVisible] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("3");
  const [newGoalType, setNewGoalType] = useState("sessionsPerWeek");
  const [logbookVisible, setLogbookVisible] = useState(false);
  const [logbookRange, setLogbookRange] = useState("30");
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [activeBadge, setActiveBadge] = useState(null);
  const [exportRangeVisible, setExportRangeVisible] = useState(false);
  const [exportRangeKey, setExportRangeKey] = useState("30");
  const [chartRangeDays] = useState(7);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Layout editor
  const [cardOrder, setCardOrder] = useState(DEFAULT_CARD_ORDER);
  const [layoutEditVisible, setLayoutEditVisible] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState([...DEFAULT_CARD_ORDER]);

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const categoryAnim = useRef(new Animated.Value(0)).current;
  const refreshSpin = useRef(new Animated.Value(0)).current;

  const colors = useMemo(() => ({
    bg: themeColors.background,
    surface: themeColors.surface,
    surface2: themeColors.surfaceVariant,
    borderLight: themeColors.border,
    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.65)",
    textDim: "rgba(255,255,255,0.5)",
    bar: "rgba(255,255,255,0.25)",
    barActive: "rgba(255,255,255,0.55)",
    accent: themeColors.primary,
  }), [themeColors.background, themeColors.surface, themeColors.surfaceVariant, themeColors.border, themeColors.primary]);

  const isProPlus = plan==="pro"||plan==="lifetime"; // ab Pro
  const hasDailyTracking = plan==="pro"||plan==="lifetime";
  const [upgradeReason, setUpgradeReason] = useState("stats");
  const [upgradePopupVisible, setUpgradePopupVisible] = useState(false);
  const openLockedPopup = (reason = "stats") => { setUpgradeReason(reason); setUpgradePopupVisible(true); };
  const openPremium = () => openLockedPopup("stats");

  // Memoize month summary to avoid repeated heavy loops each render (prevents UI stalls on low-end devices)
  const monthSummary = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime();
    const entries = (Array.isArray(history)?history:[]).filter(h => {
      const ts = Number(h.timestamp||h.ts||h.date||0);
      return ts>=start && ts<end;
    });
    const totalSec = entries.reduce((acc,e) => acc + Math.max(0, Number(e.elapsedSec||e.durationSec||e.duration||60)), 0);
    const moodList = entries.map(e => moodEmoji(e.mood)).filter(Boolean);
    return { y:d.getFullYear(), m:d.getMonth(), entries, totalSec, moodAvg:moodList.length?moodList[Math.floor(moodList.length/2)]:"😌" };
  }, [history]);
  const monthMinutes = useMemo(() => Math.max(0, Math.round(((monthSummary && monthSummary.totalSec)||0)/60)), [monthSummary]);

  const load = useCallback(async () => {
    const [h,p,co,gs,ts,c,wc] = await Promise.all([
      getSessionHistory().catch(()=>[]),
      getUserPlan().catch(()=> "free"),
      getStatistikCardOrder().catch(()=> null),
      getUserGoals().catch(()=> []),
      getTotalSessions().catch(()=> 0),
      getCompletedSessions().catch(()=> []),
      getWeeklyResetsCount({includeAborted:true}).catch(()=> 0),
    ]);
    setHistory(Array.isArray(h)?h:[]);
    const nextPlan = p||"free"; setPlan(nextPlan);
    setLogbookRange(prev => clampLogbookRange(nextPlan, prev));
    if (Array.isArray(co)&&co.length) setCardOrder(co);
    setGoals(Array.isArray(gs)?gs:[]);
    setTotalStarts(typeof ts==="number"?ts:0);
    setCompletedIds(Array.isArray(c)?c:[]);
    const newWc = typeof wc==="number"?wc:0;
    if (newWc >= weeklyTarget && prevWeeklyCount.current < weeklyTarget) {
      // Only celebrate once per calendar week — persist the key
      try {
        const now = new Date();
        const weekKey = `celeb_weekly_${now.getFullYear()}_${isoWeekKeyGlobal(now.getTime())}`;
        const already = await AsyncStorage.getItem(weekKey);
        if (!already) {
          await AsyncStorage.setItem(weekKey, "1");
          setWeeklyCelebVisible(true);
        }
      } catch (_) {
        // silently ignore — don't show celebration on error
      }
    }
    prevWeeklyCount.current = newWc;
    setWeeklyCount(newWc);
    try {
      const allIds = Array.isArray(sessions)?sessions.map(s=>(s && s.id)).filter(Boolean):[];
      await checkAndUnlockAchievements({allSessionIds:allIds});
      const unlocked = await getUnlockedAchievements(); setUnlockedAchievements(Array.isArray(unlocked)?unlocked:[]);
      const completed = await getCompletedSessions(); const completedSet = new Set(Array.isArray(completed)?completed:[]);
      setExplorerRemaining(allIds.filter(id=>!completedSet.has(id)).length);
    } catch (_e) { setUnlockedAchievements([]); setExplorerRemaining(null); }
  }, []);

  const runRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true); refreshSpin.setValue(0);
    const spinAnim = Animated.loop(Animated.timing(refreshSpin, { toValue:1, duration:650, useNativeDriver:true }));
    spinAnim.start();
    try { await load(); } finally { spinAnim.stop(); setIsRefreshing(false); refreshSpin.setValue(0); }
  }, [isRefreshing, load, refreshSpin]);

  React.useEffect(() => {
    let mounted = true;
    const safeLoad = async () => {
      if (!mounted) return;
      await load();
    };
    safeLoad();
    const sub = AppState.addEventListener("change", state => {
      if (state === "active" && mounted) safeLoad();
    });
    const planSub = DeviceEventEmitter.addListener("stillmind:planChanged", () => {
      if (mounted) safeLoad();
    });
    return () => {
      mounted = false;
      sub.remove();
      planSub.remove();
    };
  }, [load]);

  React.useEffect(() => {
    if (layoutEditVisible) setLayoutDraft([...(cardOrder||DEFAULT_CARD_ORDER)]);
  }, [layoutEditVisible, cardOrder]);

  const persistCardOrder = useCallback(async (next) => {
    const clean = Array.isArray(next)&&next.length ? next : DEFAULT_CARD_ORDER;
    setCardOrder(clean);
    try { await setStatistikCardOrder(clean); } catch (_e) {}
  }, []);

  // Prevent "nothing happens" taps if an invisible overlay (e.g. Layout-Editor backdrop) is still mounted.
  const safeOpenGoalsModal = useCallback(() => {
    if (layoutEditVisible) setLayoutEditVisible(false);
    setGoalsModalVisible(true);
  }, [layoutEditVisible]);
  const safeOpenGoalCreate = useCallback(() => {
    if (layoutEditVisible) setLayoutEditVisible(false);
    setGoalsModalVisible(false);
    // Small delay to avoid modal stacking freeze
    setTimeout(() => setGoalCreateVisible(true), 50);
  }, [layoutEditVisible]);

  const stats = useMemo(() => {
    const now = new Date();
    const rangeDays = clampRangeDays(plan, chartRangeDays);
    const days = Array.from({length:rangeDays}).map((_,i) => { const d = startOfDay(now); d.setDate(d.getDate()-(rangeDays-1-i)); return d; });
    const dayKeys = days.map(d => toDateKey(d));
    const minDate = days[0];
    const entries = (Array.isArray(history)?history:[]).filter(h => { if ((h && h.type)&&h.type!=="start") return false; const ts = typeof (h && h.timestamp)==="number"?h.timestamp:(h && h.date); if (!ts) return false; return new Date(ts)>=minDate; });
    const uniqueDays = new Set(entries.map(h => toDateKey(h.timestamp||h.date)));
    let currentStreak = 0;
    for (let i = dayKeys.length-1; i >= 0; i--) { if (uniqueDays.has(dayKeys[i])) currentStreak+=1; else break; }
    const sessionsByDay = dayKeys.map((k,idx) => ({ date:k, label:weekdayDE(days[idx], t), count:0 }));
    let totalSeconds = 0;
    for (const h of entries) {
      const ts = typeof (h && h.timestamp)==="number"?h.timestamp:(h && h.date);
      const key = toDateKey(ts);
      const durSec = typeof (h && h.durationSec)==="number"&&Number.isFinite(h.durationSec)?h.durationSec:null;
      const durMin = typeof (h && h.durationMin)==="number"&&Number.isFinite(h.durationMin)?h.durationMin:null;
      const elapsedSec = typeof (h && h.elapsedSec)==="number"&&Number.isFinite(h.elapsedSec)?h.elapsedSec:durSec?durSec:durMin?Math.round(durMin*60):60;
      const fixed = ((h && h.status)==="completed"||(h && h.status)==="done")&&elapsedSec<=0?(durSec?durSec:durMin?Math.round(durMin*60):60):elapsedSec;
      const add = hasDailyTracking?Math.max(0,Math.round(fixed)):60;
      totalSeconds += add;
      const idx = sessionsByDay.findIndex(d => d.date===key);
      if (idx>=0) sessionsByDay[idx].count += add;
    }
    return { totalSeconds: hasDailyTracking?totalSeconds:entries.length*60, totalDays:uniqueDays.size, streak:currentStreak, sessionsByDay };
  }, [history, hasDailyTracking, chartRangeDays, plan, lang]);

  const weeklyHybrid = useMemo(() => {
    const now = new Date(); const out = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(now.getDate()-i); const key = toDateKey(d); const count = (Array.isArray(history)?history:[]).filter(h => toDateKey(h.timestamp||h.ts||h.date||0)===key).length; out.push({key, label:weekdayDE(d, t), value:count}); }
    return out;
  }, [history, lang]);

  const getMonthSummary = (monthOffset=0) => {
    const d = new Date(); d.setMonth(d.getMonth()+monthOffset);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime();
    const entries = (Array.isArray(history)?history:[]).filter(h => { const ts = Number(h.timestamp||h.ts||h.date||0); return ts>=start&&ts<end; });
    const totalSec = entries.reduce((acc,e) => acc+Math.max(0,Number(e.elapsedSec||e.durationSec||e.duration||60)), 0);
    const moodList = entries.map(e => moodEmoji(e.mood)).filter(Boolean);
    return { y:d.getFullYear(), m:d.getMonth(), entries, totalSec, moodAvg:moodList.length?moodList[Math.floor(moodList.length/2)]:"😌" };
  };

  const achievementBadges = useMemo(() => ({
    sessions: [
      {id:"sessions_1",label:t("ach_first_reset_label"),short:"1",target:1,desc:t("ach_first_reset_desc")},
      {id:"sessions_5",label:t("ach_5_label"),short:"5",target:5,desc:t("ach_5_desc")},
      {id:"sessions_25",label:t("ach_25_label"),short:"25",target:25,desc:t("ach_25_desc")},
      {id:"sessions_50",label:t("ach_50_label"),short:"50",target:50,desc:t("ach_50_desc")},
      {id:"sessions_100",label:t("ach_100_label"),short:"100",target:100,desc:t("ach_100_desc")},
    ],
    discover: [
      {id:"discover_5",label:t("ach_discover_5_label"),short:"5",target:5,desc:t("ach_discover_5_desc")},
      {id:"explorer",label:t("ach_explorer_label"),short:"∞",target:undefined,desc:t("ach_explorer_desc")},
    ],
    weekly: [
      {id:"weekly_1",label:t("ach_good_week"),target:1,desc:t("ach_good_week_desc")},
      {id:"weekly_2",label:t("ach_rhythm"),target:2,desc:t("ach_rhythm_desc")},
      {id:"weekly_5",label:t("ach_reliable"),target:5,desc:t("ach_reliable_desc")},
    ],
    reflection: [
      {id:"reflect_mood_5",label:t("ach_checkin_label"),target:5,desc:t("ach_checkin_desc")},
      {id:"reflect_note_3",label:t("ach_reflect_3_label"),target:3,desc:t("ach_reflect_3_desc")},
      {id:"reflect_note_10",label:t("ach_reflect_10_label"),target:10,desc:t("ach_reflect_10_desc")},
    ],
  }), [lang]);

  const achievementsUnlockedSet = useMemo(() => new Set(Array.isArray(unlockedAchievements)?unlockedAchievements:[]), [unlockedAchievements]);

  const achievementProgress = useMemo(() => {
    const list = Array.isArray(history)?history:[];
    const weekCounts = new Map(); let moodCount=0; let noteCount=0;
    const isoWeekKey = (ts) => { const d = new Date(ts); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day+3); const isoYear=d.getFullYear(); const ft=new Date(isoYear,0,4); const fd=(ft.getDay()+6)%7; ft.setDate(ft.getDate()-fd+3); return `${isoYear}-W${String(1+Math.round((d.getTime()-ft.getTime())/(7*24*3600*1000))).padStart(2,"0")}`; };
    for (const h of list) { if ((h && h.type)&&h.type!=="start") continue; const ts = typeof (h && h.timestamp)==="number"?h.timestamp:(h && h.date); if (!ts) continue; const key=isoWeekKey(ts); weekCounts.set(key,(weekCounts.get(key)||0)+1); if ((h && h.mood)&&["worse","same","better"].includes(h.mood)) moodCount+=1; if (typeof (h && h.note)==="string"&&h.note.trim().length>0) noteCount+=1; }
    return { totalStarts:typeof totalStarts==="number"?totalStarts:0, distinctCompletedCount:new Set((Array.isArray(completedIds)?completedIds:[]).filter(x=>typeof x==="string"&&x.length>0)).size, weeksAchieved:Array.from(weekCounts.values()).filter(c=>c>=weeklyTarget).length, moodCount, noteCount };
  }, [history, completedIds, totalStarts]);

  const achievementCategories = useMemo(() => {
    const su = achievementBadges.sessions.filter(b=>achievementsUnlockedSet.has(b.id)).length;
    const du = achievementBadges.discover.filter(b=>achievementsUnlockedSet.has(b.id)).length;
    const wu = achievementBadges.weekly.filter(b=>achievementsUnlockedSet.has(b.id)).length;
    const ru = achievementBadges.reflection.filter(b=>achievementsUnlockedSet.has(b.id)).length;
    return [
      {id:"sessions",title:t("ach_cat_sessions_title"),subtitle:`${su}/${achievementBadges.sessions.length} ${t("ach_unlocked")}`,icon:"sparkles",hint:t("ach_cat_sessions_hint")},
      {id:"discover",title:t("ach_cat_discover_title"),subtitle:`${du}/${achievementBadges.discover.length} ${t("ach_unlocked")}`,icon:"compass",hint:t("ach_cat_discover_hint")},
      {id:"weekly",title:t("ach_cat_weekly_title"),subtitle:`${wu}/${achievementBadges.weekly.length} ${t("ach_unlocked")}`,icon:"calendar",hint:t("ach_cat_weekly_hint")},
      {id:"reflection",title:t("ach_cat_reflection_title"),subtitle:`${ru}/${achievementBadges.reflection.length} ${t("ach_unlocked")}`,icon:"note",hint:t("ach_cat_reflection_hint")},
    ];
  }, [achievementBadges, achievementsUnlockedSet, lang]);

  const achievementsOverall = useMemo(() => {
    const allIds = Object.values(achievementBadges||{}).flat().map(b=>(b && b.id)).filter(Boolean);
    const unique = [...new Set(allIds)];
    const unlocked = unique.filter(id=>achievementsUnlockedSet.has(id)).length;
    return { total:unique.length, unlocked, percent:unique.length>0?Math.round(unlocked/unique.length*100):0 };
  }, [achievementBadges, achievementsUnlockedSet, lang]);

  const lastN = stats.sessionsByDay;
  const maxCount = useMemo(() => Math.max(1,...(lastN||[]).map(d=>d.count||0)), [lastN]);

  const selectedDayEntries = useMemo(() => {
    if (!selectedDayKey) return [];
    return (Array.isArray(history)?history:[]).filter(h => { if ((h && h.type)&&h.type!=="start") return false; const ts = typeof (h && h.timestamp)==="number"?h.timestamp:(h && h.date); if (!ts) return false; return toDateKey(ts)===selectedDayKey; }).map(h => {
      const ts = typeof (h && h.timestamp)==="number"?h.timestamp:(h && h.date);
      const durSec = typeof (h && h.durationSec)==="number"&&Number.isFinite(h.durationSec)?h.durationSec:null;
      const durMin = typeof (h && h.durationMin)==="number"&&Number.isFinite(h.durationMin)?h.durationMin:null;
      const elapsedSec = typeof (h && h.elapsedSec)==="number"&&Number.isFinite(h.elapsedSec)?h.elapsedSec:durSec?durSec:durMin?Math.round(durMin*60):60;
      const fixed = ((h && h.status)==="completed"||(h && h.status)==="done")&&elapsedSec<=0?(durSec||Math.round((durMin||0)*60)||60):elapsedSec;
      return { ts, time:formatHHmm(ts), dateLabel:formatDateDE(ts), title:getEntryTitle(h), mood:typeof (h && h.mood)==="string"?h.mood:"", note:typeof (h && h.note)==="string"?h.note:"", durationSec:hasDailyTracking?Math.max(0,Math.round(fixed)):60 };
    }).sort((a,b)=>a.ts-b.ts);
  }, [history, selectedDayKey, hasDailyTracking]);

  const logbookEntries = useMemo(() => {
    const minTs = getRangeMinTs(logbookRange==="custom"?90:Number(logbookRange)||30);
    return (Array.isArray(history)?history:[]).filter(h => { if ((h && h.type)&&h.type!=="start") return false; const ts = Number((h && h.timestamp)||(h && h.date)||0); return ts>=minTs; }).slice().sort((a,b)=>Number(b.timestamp||b.date||0)-Number(a.timestamp||a.date||0)).slice(0, LOGBOOK_LIMITS[plan]||10);
  }, [history, logbookRange, plan, lang]);
  const openDay = useCallback((dayKey) => {
    if (!(plan==="pro"||plan==="lifetime")) return;
    setSelectedDayKey(dayKey); setSheetVisible(true);
    sheetAnim.setValue(0); Animated.timing(sheetAnim,{toValue:1,duration:220,useNativeDriver:true}).start();
  }, [plan, sheetAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim,{toValue:0,duration:180,useNativeDriver:true}).start(()=>setSheetVisible(false));
  }, [sheetAnim]);

  const openCategory = useCallback((categoryId) => {
    setActiveCategoryId(categoryId); setCategoryModalVisible(true);
    categoryAnim.setValue(0); Animated.timing(categoryAnim,{toValue:1,duration:220,useNativeDriver:true}).start();
  }, [categoryAnim]);

  const closeCategory = useCallback(() => {
    Animated.timing(categoryAnim,{toValue:0,duration:180,useNativeDriver:true}).start(()=>{ setCategoryModalVisible(false); setActiveCategoryId(null); });
  }, [categoryAnim]);

  const openBadge = useCallback((badge) => {
    const unlocked = achievementsUnlockedSet.has(badge.id);
    const current = badge.id.startsWith("sessions_")?achievementProgress.totalStarts:badge.id==="discover_5"?achievementProgress.distinctCompletedCount:badge.id==="explorer"?null:badge.id.startsWith("weekly_")?achievementProgress.weeksAchieved:badge.id==="reflect_mood_5"?achievementProgress.moodCount:badge.id.startsWith("reflect_note_")?achievementProgress.noteCount:null;
    setActiveBadge({...badge,unlocked,current});
    Animated.timing(categoryAnim,{toValue:0,duration:160,useNativeDriver:true}).start(()=>{ setCategoryModalVisible(false); setActiveCategoryId(null); requestAnimationFrame(()=>setBadgeModalVisible(true)); });
  }, [achievementsUnlockedSet, achievementProgress, categoryAnim]);

  const spin = refreshSpin.interpolate({inputRange:[0,1],outputRange:["0deg","360deg"]});

  const runCsvExport = useCallback(async ({minTs,maxTs}) => {
    try {
      const rows = (Array.isArray(history)?history:[]).filter(h => { const ts = Number(h.timestamp||h.ts||h.date||0); if (!ts) return false; if (typeof minTs==="number"&&ts<minTs) return false; if (typeof maxTs==="number"&&ts>maxTs) return false; return true; }).slice().sort((a,b)=>Number(a.timestamp||a.ts||a.date||0)-Number(b.timestamp||b.ts||b.date||0)).map(h => { const ts = Number(h.timestamp||h.ts||h.date||0); return [formatDateDE(ts),formatHHmm(ts),getEntryTitle(h).replace(/\s+/g," ").trim(),Math.max(0,Math.round(Number(h.elapsedSec||h.durationSec||h.duration||60))),moodEmoji(h.mood),typeof h.note==="string"?h.note.replace(/\s+/g," ").trim():""]; });
      const header = [t("csv_date"),t("csv_time"),"Session",t("csv_duration"),t("csv_emoji"),t("csv_note")];
      const csv = [header,...rows].map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) { await Clipboard.setStringAsync(csv); Alert.alert(t("stat_export_copied_title"), t("stat_export_copied_msg")); return; }
      const uri = (FileSystem.cacheDirectory||FileSystem.documentDirectory||"")+`stillmind_export_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, {encoding:"utf8"});
      await Sharing.shareAsync(uri, {mimeType:"text/csv",dialogTitle:"StillMind – CSV Export", ...(Platform.OS==="ios"?{UTI:"public.comma-separated-values-text"}:{})});
    } catch (e) { console.error("CSV Export Fehler:", e); Alert.alert(t("stat_export_fail"), (e && e.message) || "Bitte versuche es erneut."); }
  }, [history]);
  // ─────────────── RENDER HELPERS ───────────────

  const renderFlameHero = () => {
    const streak = stats.streak || 0;
    const TIERS = [
      { min:0,  max:6,  label:t("tier_seeker"),  bg:"rgba(241,239,232,0.08)", tc:"rgba(255,255,255,0.45)" },
      { min:7,  max:29, label:t("tier_breather"),   bg:"rgba(250,238,218,0.10)", tc:"rgba(212,169,106,0.85)" },
      { min:30, max:99, label:t("tier_still"),    bg:"rgba(238,237,254,0.10)", tc:"rgba(175,169,236,0.85)" },
      { min:100,max:999,label:t("tier_wise"),     bg:"rgba(253,243,227,0.12)", tc:"rgba(216,192,168,0.90)" },
    ];
    const tier = TIERS.find(t => streak >= t.min && streak <= t.max) || TIERS[0];

    const NEXT = [
      { until:7,   txt:t("streak_next_freeze").replace("{{n}}", 7-streak)  },
      { until:14,  txt:t("streak_next_sleep").replace("{{n}}", 14-streak) },
      { until:30,  txt:t("streak_next_icon").replace("{{n}}", 30-streak)   },
      { until:100, txt:t("streak_next_legend").replace("{{n}}", 100-streak)       },
    ];
    const hint = NEXT.find(n => streak < n.until);

    return (
      <View style={{
        marginTop:22,
        backgroundColor: colors.surface,
        borderRadius:24,
        borderWidth:1,
        borderColor: colors.borderLight,
        paddingVertical:24,
        paddingHorizontal:20,
        alignItems:"center",
      }}>
        <StillFlame streak={Math.max(1, streak)} size={110} />

        <View style={{flexDirection:"row",alignItems:"center",gap:14,marginTop:10}}>
          <Text style={{
            fontFamily:"Montserrat_600SemiBold",
            fontSize:52,
            color:colors.text,
            lineHeight:58,
          }}>{streak}</Text>
          <View>
            <Text style={{fontFamily:"Montserrat_400Regular",fontSize:13,color:colors.textMuted}}>
              {streak === 1 ? t("streak_days_singular") : t("streak_days_plural")}
            </Text>
            <View style={{
              marginTop:6,
              backgroundColor:tier.bg,
              borderRadius:20,
              paddingHorizontal:12,
              paddingVertical:3,
              alignSelf:"flex-start",
            }}>
              <Text style={{
                fontFamily:"Montserrat_600SemiBold",
                fontSize:11,
                color:tier.tc,
                letterSpacing:0.8,
                textTransform:"uppercase",
              }}>{tier.label}</Text>
            </View>
          </View>
        </View>

        {hint && (
          <Text style={{
            marginTop:10,
            fontFamily:"Montserrat_400Regular",
            fontSize:12,
            color:colors.textDim,
            textAlign:"center",
          }}>{hint.txt}</Text>
        )}
      </View>
    );
  };

  const renderKIAnalysisBanner = () => {
    const isLifetime = plan === "lifetime";
    const A = "#CDB98A";
    const openKI = () => { try { const { router } = require("expo-router"); router.push("/ai-quarterly-analysis"); } catch(_){} };
    const openPrem = () => openLockedPopup("stats");

    return (
      <TouchableOpacity
        onPress={isLifetime ? openKI : openPrem}
        activeOpacity={0.88}
        style={{ marginTop: 18, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: "rgba(205,185,138,0.28)" }}
      >
        <View style={{ padding: 18 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(205,185,138,0.10)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(205,185,138,0.20)" }}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text }}>{t("ki_banner_title")}</Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: A, marginTop: 2 }}>{t("ki_banner_sub")}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: "rgba(205,185,138,0.12)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(205,185,138,0.28)" }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: A, letterSpacing: 1 }}>{t("ki_banner_badge")}</Text>
            </View>
          </View>

          {/* Analyse Preview */}
          <View style={{ gap: 0, marginBottom: 12 }}>
            {[
              { label: t("ki_banner_label_1"),    pct: 0.73, val: "73%",  note: t("ki_banner_note_1"), color: "#CDB98A" },
              { label: t("ki_banner_label_2"),   pct: 0.34, val: "34%",  note: t("ki_banner_note_2"), color: "#E8A87C" },
              { label: t("ki_banner_label_3"), pct: 0.91, val: "91%",  note: t("ki_banner_note_3"), color: "#A8D5A2" },
              { label: t("ki_banner_label_4"),  pct: 0.58, val: "58%",  note: t("ki_banner_note_4"), color: "#CDB98A" },
              { label: t("ki_banner_label_5"),     pct: 0.17, val: "17%",  note: t("ki_banner_note_5"), color: "#A8D5A2" },
            ].map((row, i) => (
              <View key={i} style={{ paddingVertical: 7, borderBottomWidth: i < 4 ? 0.5 : 0, borderBottomColor: "rgba(255,255,255,0.05)" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: isLifetime ? 3 : 0 }}>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: isLifetime ? "rgba(205,185,138,0.75)" : "rgba(205,185,138,0.30)", width: 112 }}>{row.label}</Text>
                  <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                    <View style={{ width: isLifetime ? row.pct * 100 + "%" : (12 + i * 9) + "%", height: "100%", backgroundColor: isLifetime ? row.color : "rgba(205,185,138,0.15)", borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: isLifetime ? row.color : "rgba(205,185,138,0.20)", width: 32, textAlign: "right" }}>{isLifetime ? row.val : "–"}</Text>
                </View>
                {isLifetime && (
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 10, color: "rgba(255,255,255,0.30)", marginLeft: 120, lineHeight: 14 }}>{row.note}</Text>
                )}
              </View>
            ))}
          </View>

          {/* KI Empfehlung — nur für Lifetime sichtbar */}
          {isLifetime && (
            <View style={{ backgroundColor: "rgba(205,185,138,0.06)", borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(205,185,138,0.15)" }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: A, marginBottom: 4, letterSpacing: 0.5 }}>{t("ki_banner_rec_label")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.60)", lineHeight: 18 }}>
                {t("ki_banner_rec_text")}
              </Text>
            </View>
          )}

          {/* Lock hint for non-lifetime */}
          {!isLifetime && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "rgba(205,185,138,0.06)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(205,185,138,0.15)" }}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(205,185,138,0.65)", flex: 1 }}>
                {t("ki_banner_lock_text")}
              </Text>
            </View>
          )}

          {/* CTA */}
          <View style={{ backgroundColor: isLifetime ? A : "rgba(205,185,138,0.10)", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: isLifetime ? 0 : 1, borderColor: "rgba(205,185,138,0.22)" }}>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: isLifetime ? "#0C0B09" : A }}>
              {isLifetime ? t("ki_banner_cta_lifetime") : t("ki_banner_cta_lock")}
            </Text>
          </View>

        </View>
      </TouchableOpacity>
    );
  };

    const renderOverviewBlock = () => (
    <View style={{flexDirection:"row",gap:12,marginTop:18}}>
      <View style={{flex:1,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.borderLight}}>
        <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textMuted,marginBottom:10}}>{t("minutes")}</Text>
        <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:42}}>{formatDuration(stats.totalSeconds)}</Text>
      </View>
      <View style={{flex:1,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.borderLight}}>
        <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textMuted,marginBottom:10}}>{t("days_short")}</Text>
        <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:42}}>
          {stats.totalDays}{" "}<Text style={{fontSize:20,color:colors.textMuted}}>{t("days_word")}</Text>
        </Text>
      </View>
    </View>
  );

  const renderAchievementsBlock = () => (
    <React.Fragment>
      <View style={{marginTop:18,backgroundColor:colors.surface,borderRadius:22,padding:18,borderWidth:1,borderColor:colors.borderLight}}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:16}}>{t("achievements")}</Text>
          <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textDim,fontSize:12}}>{achievementsOverall.unlocked} / {achievementsOverall.total} ({achievementsOverall.percent}%)</Text>
        </View>
        <View style={{marginTop:12,height:12,justifyContent:"center"}}>
          <View style={{height:10,borderRadius:999,backgroundColor:colors.bar,overflow:"hidden"}}>
            <View style={{height:"100%",width:`${Math.max(0,Math.min(100,achievementsOverall.percent||0))}%`,backgroundColor:colors.barActive,borderRadius:999}} />
          </View>
        </View>
        <Text style={{marginTop:10,fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:12,lineHeight:16}}>
          {achievementsOverall.percent>=100?t("ach_reward_100"):t("ach_reward_hint")}
        </Text>
        <Text style={{marginTop:8,fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:13,lineHeight:18}}>
          {t("ach_tap_hint")}
        </Text>
        <View style={{marginTop:14,gap:10}}>
          {achievementCategories.map(c => {
            const Icon = c.icon==="sparkles"?Sparkles:c.icon==="compass"?Compass:c.icon==="calendar"?CalendarCheck:NotebookPen;
            return (
              <Pressable key={c.id} onPress={()=>openCategory(c.id)} style={({pressed})=>({borderRadius:18,paddingVertical:14,paddingHorizontal:14,backgroundColor:pressed?"rgba(255,255,255,0.10)":"rgba(255,255,255,0.06)",borderWidth:1,borderColor:"rgba(255,255,255,0.12)",flexDirection:"row",alignItems:"center",justifyContent:"space-between"})}>
                <View style={{flexDirection:"row",alignItems:"center",flex:1,paddingRight:12}}>
                  <View style={{width:38,height:38,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,0.08)",borderWidth:1,borderColor:"rgba(255,255,255,0.14)"}}>
                    <Icon size={18} color={colors.text} />
                  </View>
                  <View style={{flex:1,marginLeft:12}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:14}}>{c.title}</Text>
                    <Text style={{marginTop:2,fontFamily:"Montserrat_400Regular",color:colors.textDim,fontSize:12}}>{c.hint} • {c.subtitle}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {hasDailyTracking && (
        <View style={{marginTop:18,backgroundColor:colors.surface,borderRadius:18,padding:18,borderWidth:1,borderColor:colors.borderLight}}>
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:16}}>{t("stat_last_n_days").replace("{{n}}", clampRangeDays(plan,chartRangeDays))}</Text>
            <TouchableOpacity onPress={()=>setLogbookVisible(true)} style={{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:"rgba(255,255,255,0.06)",borderWidth:1,borderColor:colors.borderLight}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:12,color:colors.text}}>{t("logbook")}</Text>
            </TouchableOpacity>
          </View>
          <View style={{flexDirection:"row",gap:8,marginTop:16,paddingBottom:4}}>
            {lastN.map(d => {
              const pct = maxCount > 0 ? (d.count||0)/maxCount : 0;
              const barH = Math.max(6, Math.round(pct * 110));
              const active = selectedDayKey===d.date;
              return (
                <Pressable key={d.date} onPress={()=>openDay(d.date)} style={{flex:1,alignItems:"center"}}>
                  <View style={{width:"100%",maxWidth:32,height:120,borderRadius:16,justifyContent:"flex-end",overflow:"hidden",backgroundColor:"rgba(255,255,255,0.05)",borderWidth:1,borderColor:colors.borderLight}}>
                    <View style={{height:barH,borderRadius:16,backgroundColor:active?colors.barActive:colors.bar}} />
                  </View>
                  <Text style={{marginTop:8,fontFamily:"Montserrat_600SemiBold",fontSize:11,color:active?colors.text:colors.textMuted}}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{marginTop:14,fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:13,lineHeight:18}}>{t("stat_tap_day")}</Text>
        </View>
      )}

      {!hasDailyTracking && (
        <TouchableOpacity onPress={openPremium} activeOpacity={0.9} style={{marginTop:18,borderRadius:18,overflow:"hidden",borderWidth:1,borderColor:"rgba(205,185,138,0.25)"}}>
          {/* Blurred fake chart */}
          <View style={{backgroundColor:colors.surface,padding:18}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:16,opacity:0.4}}>{t("stat_activity_30_days")}</Text>
              <View style={{backgroundColor:"rgba(205,185,138,0.15)",borderRadius:999,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:"rgba(205,185,138,0.3)"}}>
                <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:11,color:"#CDB98A"}}>PRO</Text>
              </View>
            </View>
            {/* Fake blurred bars */}
            <View style={{flexDirection:"row",gap:8,height:120,alignItems:"flex-end",opacity:0.25}}>
              {[0.3,0.6,0.4,0.9,0.5,0.7,0.8,0.3,0.6,0.5,0.9,0.4,0.7,0.6].map((h,i) => (
                <View key={i} style={{flex:1,height:Math.round(h*110),borderRadius:8,backgroundColor:"#CDB98A"}} />
              ))}
            </View>
            {/* Lock overlay */}
            <View style={{position:"absolute",top:0,left:0,right:0,bottom:0,alignItems:"center",justifyContent:"center"}}>
              <View style={{backgroundColor:"rgba(12,11,9,0.85)",borderRadius:20,padding:20,alignItems:"center",borderWidth:1,borderColor:"rgba(205,185,138,0.3)"}}>
                <Text style={{fontSize:28,marginBottom:8}}>🔒</Text>
                <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:15,color:"#FFFFFF",textAlign:"center",marginBottom:4}}>{t("stat_detailed_stats_title")}</Text>
                <Text style={{fontFamily:"Montserrat_400Regular",fontSize:12,color:"rgba(255,255,255,0.55)",textAlign:"center",marginBottom:14}}>{t("stat_detailed_stats_msg")}</Text>
                <View style={{backgroundColor:"#CDB98A",borderRadius:12,paddingHorizontal:20,paddingVertical:10}}>
                  <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:13,color:"#0C0B09"}}>{t("stat_pro_unlock_cta")}</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </React.Fragment>
  );

  const renderInsightsBlock = () => (
    <View style={{marginTop:14,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.borderLight,overflow:"hidden"}}>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
        <View style={{flex:1,paddingRight:12}}>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:16}}>{t("stat_card_insights")}</Text>
          <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,marginTop:4,fontSize:13,lineHeight:17}}>{t("stat_insights_sub")}</Text>
        </View>
        {!isProPlus && <View style={{paddingHorizontal:10,paddingVertical:6,borderRadius:999,borderWidth:1,borderColor:colors.borderLight}}><Text style={{fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:12}}>{"Pro"}</Text></View>}
      </View>
      <View style={{marginTop:14}}>
        <View style={{flexDirection:"row",gap:6,alignItems:"flex-end",height:70,marginBottom:4}}>
          {weeklyHybrid.map(b => {
            const maxVal = Math.max(...weeklyHybrid.map(x=>x.value||0), 1);
            const bH = Math.max(6, Math.round(((b.value||0)/maxVal)*48));
            return (
              <View key={b.key} style={{flex:1,alignItems:"center",justifyContent:"flex-end"}}>
                <View style={{width:"100%",height:bH,borderRadius:8,backgroundColor:colors.barActive,opacity:isProPlus?1:0.9}} />
                <Text style={{marginTop:7,fontSize:11,color:colors.textDim,fontFamily:"Montserrat_400Regular"}}>{b.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{flexDirection:"row",justifyContent:"space-between",marginTop:14}}>
        <View style={{flex:1}}>
          <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:12}}>{t("stat_mood_label")}</Text>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:22,marginTop:4}}>{monthSummary.moodAvg}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:12}}>{t("stat_month_label")}</Text>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:22,marginTop:4}}>
            {monthMinutes}{" "}<Text style={{fontSize:14,color:colors.textMuted}}>{"Min"}</Text>
          </Text>
        </View>
      </View>
      {!isProPlus && (
        <React.Fragment>
          <View style={{position:"absolute",left:0,right:0,bottom:0,top:0,backgroundColor:"rgba(11,11,12,0.82)"}}/>
          <View style={{position:"absolute",left:16,right:16,top:0,bottom:0,justifyContent:"center"}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#fff",fontSize:15,marginBottom:5}}>{t("stat_full_stats")}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular",color:"rgba(255,255,255,0.60)",fontSize:13,lineHeight:17,marginBottom:12}}>{t("stat_pro_locked_hint")}</Text>
            <TouchableOpacity onPress={openPremium} activeOpacity={0.85} style={{backgroundColor:"#8B5CF6",borderRadius:14,paddingVertical:12,alignItems:"center"}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#fff",fontSize:14}}>{t("stat_pro_unlock")}</Text>
            </TouchableOpacity>
          </View>
        </React.Fragment>
      )}
    </View>
  );

  // ── Helper: build luxury PDF HTML ──
    // ── Helper: build luxury PDF HTML (print-safe, dark, app-like) ──
  const buildLuxuryReportHtml = useCallback((periodLabel, reportType="year") => {
    const h = Array.isArray(history) ? history : [];
    const now = new Date();

    // Filter by period: month = current calendar month, year = current year
    const isMonth = reportType === "month";
    const periodStart = isMonth
      ? new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      : new Date(now.getFullYear(), 0, 1).getTime();
    const periodEnd = isMonth
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
    const hFiltered = h.filter(e => {
      const ts = Number(e.timestamp||e.ts||e.date||0);
      return ts >= periodStart && ts <= periodEnd;
    });

    const completed = hFiltered.filter(e => (e && e.status) === "completed" || !(e && e.status));
    const totalSessions = completed.length;
    const totalMinutes = Math.round(completed.reduce((a,e)=>a + Math.max(0, Number(e.elapsedSec||e.durationSec||e.duration||60)), 0) / 60);

    const dayKeys = [...new Set(completed.map(e => {
      const d = new Date(Number(e.timestamp||e.ts||e.date||0));
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }).filter(Boolean))];

    const activeDays  = dayKeys.length;
    const avgDuration = totalSessions > 0 ? (totalMinutes / totalSessions).toFixed(1) : "0.0";

    // Best streak (by calendar days)
    const sortedDays = dayKeys.map(k => {
      const [y,m,d] = k.split("-").map(Number);
      return new Date(y,m,d).getTime();
    }).sort((a,b)=>a-b);

    let bestStreak = 0;
    let cur = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) { cur = 1; bestStreak = 1; continue; }
      const diff = Math.round((sortedDays[i] - sortedDays[i-1]) / (24*3600*1000));
      if (diff === 1) cur += 1;
      else cur = 1;
      if (cur > bestStreak) bestStreak = cur;
    }
    if (!sortedDays.length) bestStreak = 0;

    const achievementMetaMap = Object.values(achievementBadges || {}).flat().reduce((acc, badge) => {
      if (badge && badge.id) acc[badge.id] = badge;
      return acc;
    }, {});
    const normalizedAchievements = (Array.isArray(unlockedAchievements) ? unlockedAchievements : []).map((item) => {
      if (typeof item === "string") return achievementMetaMap[item] || { id: item, label: item, icon: "🏆" };
      const id = item && item.id;
      return { ...(id && achievementMetaMap[id] ? achievementMetaMap[id] : {}), ...(item || {}) };
    });
    const achCount = normalizedAchievements.length;
    const weeklyResets = typeof weeklyCount === "number" ? weeklyCount : 0;

    const bg = "#0B0B0B";
    const surface = "#141414";
    const surface2 = "#1A1A1A";
    const border = "rgba(255,255,255,0.10)";
    const beige = "#D6C7A1";

    const safe = (s) => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const isDE = lang === "de";
    const locale = isDE ? "de-DE" : "en-US";
    const createdDate = new Date().toLocaleDateString(locale, {
      year: "numeric",
      month: isDE ? "2-digit" : "long",
      day: "numeric",
    });
    const reportTypeLabel = isMonth ? t("pdf_monthly_report") : t("pdf_annual_report");
    const detailLabel = "Details";
    const avgPerSessionLabel = t("pdf_avg_per_session");
    const sessionsShortLabel = t("pdf_sessions_short");
    const minutesShortLabel = t("pdf_minutes_short");
    const moodLabelMap = isDE
      ? { great:t("stat_great"), good:"Gut", neutral:"Neutral", bad:"Schlecht", terrible:"Sehr schlecht", toll:t("stat_great"), gut:"Gut", schlecht:"Schlecht", sehr_schlecht:"Sehr schlecht", better:"Besser", same:"Gleich", worse:"Schlechter" }
      : { great:"Great", good:"Good", neutral:"Neutral", bad:"Bad", terrible:"Very bad", toll:"Great", gut:"Good", schlecht:"Bad", sehr_schlecht:"Very bad", better:"Better", same:"Same", worse:"Worse" };

    // Compute chart data for the period
    const byDay = {};
    completed.forEach(e => {
      const d = new Date(Number(e.timestamp||e.ts||e.date||0));
      const key = isMonth
        ? `${d.getDate()}.${d.getMonth()+1}`
        : `${d.getMonth()+1}.${String(d.getFullYear()).slice(-2)}`;
      byDay[key] = (byDay[key]||0) + Math.round(Number(e.elapsedSec||e.durationSec||60)/60);
    });
    const dayEntries = Object.entries(byDay).slice(-10);
    const barMax = Math.max(1, ...dayEntries.map(e=>e[1]));
    const chartTitle = isMonth
      ? (t("stat_activity_month"))
      : (t("stat_activity_year"));

    // ── Extra data for annual report pages ──
    const monthNames_de = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
    const monthNames_en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthNames = isDE ? monthNames_de : monthNames_en;

    // Monthly breakdown for the year
    const byMonth = {};
    for (let m = 0; m < 12; m++) byMonth[m] = {sessions:0, minutes:0, days:new Set()};
    completed.forEach(e => {
      const d = new Date(Number(e.timestamp||e.ts||e.date||0));
      if (d.getFullYear() === now.getFullYear()) {
        const m = d.getMonth();
        byMonth[m].sessions++;
        byMonth[m].minutes += Math.round(Number(e.elapsedSec||e.durationSec||60)/60);
        byMonth[m].days.add(`${d.getMonth()}-${d.getDate()}`);
      }
    });
    const monthData = Array.from({length:12},(_,m)=>({
      label: monthNames[m],
      sessions: byMonth[m].sessions,
      minutes: byMonth[m].minutes,
      days: byMonth[m].days.size
    }));
    const maxMonthMins = Math.max(1, ...monthData.map(m=>m.minutes));
    const maxMonthSess = Math.max(1, ...monthData.map(m=>m.sessions));

    // Time-of-day distribution
    const timeSlots = {morning:0, noon:0, afternoon:0, evening:0, night:0};
    completed.forEach(e => {
      const h = new Date(Number(e.timestamp||e.ts||e.date||0)).getHours();
      if (h>=5 && h<10) timeSlots.morning++;
      else if (h>=10 && h<13) timeSlots.noon++;
      else if (h>=13 && h<18) timeSlots.afternoon++;
      else if (h>=18 && h<22) timeSlots.evening++;
      else timeSlots.night++;
    });
    const timeLabels_en = {morning:"Morning (5–10)",noon:"Midday (10–13)",afternoon:"Afternoon (13–18)",evening:"Evening (18–22)",night:"Night (22–5)"};
    const timeLabels_de = {morning:t("stat_time_morning"),noon:"Mittag (10–13)",afternoon:"Nachmittag (13–18)",evening:t("stat_time_evening"),night:"Nacht (22–5)"};
    const timeLabels = isDE ? timeLabels_de : timeLabels_en;
    const maxTimeSlot = Math.max(1, ...Object.values(timeSlots));
    const bestTimeEntry = Object.entries(timeSlots).sort((a,b)=>b[1]-a[1])[0];
    const bestTimeLabel = timeLabels[bestTimeEntry[0]];

    // Mood distribution
    const moodCounts = {};
    completed.forEach(e => { if (e.mood) moodCounts[e.mood] = (moodCounts[e.mood]||0)+1; });
    const moodEntries = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]);
    const moodIconMap = {great:"😄",good:"🙂",neutral:"😐",bad:"😕",terrible:"😞",
                         toll:"😄",gut:"🙂",schlecht:"😕",sehr_schlecht:"😞"};

    // ── Shared helpers ──
    const logoB64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAGzSURBVHja7Jk9TsNAEIW/XQcEKSkRDRdARUlBQ0HBEThCjkBJyQ04QktDQUFBQUFBQUFBQUFBQQEEBVGSXez1Y+04iePYcbzjkUYa7czOm52ZnZ0VASGEEEIIIYQQ4t8CgABAAqAH8APcABeADmABOAAO0ABQAI4A24A8AD2ADuAbsA0cAEoAHYA7gGVgAlgGbgBeAHYAvQDqAF2AL0A5gAdgBvgD2AC0A4gAtQB+AJ0A7gClAI0A5gBtQE2AIcA6QAygBeAH0A5gBdAMoAaoAXgANAJ0A7gDpAK2AHkAVQAKQBdAGUABQAFgBlAGUA";

    const pageHeader = (pageNum, subtitle) => `
  <div class="accent"></div>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR4nOzdd5xkVZk//s8558aq6jQzJBVEMItp17jqAkbU3dV1FbOucQ0oou4a9rtmZV1114C6IJJBQNE1khQxgKIoKohKHGDyTIeKN53w++Pcqq7u6ZlBkvDj83696tVhuqtu3br9qnme85znAYiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiI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iIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiOhe8f8DbB05xh5L12UAAAAASUVORK5CYII=" style="width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(214,199,161,0.20));" alt="StillMind"/>
      <div class="brand-period" style="margin-top:0;">${safe(periodLabel)}</div>
    </div>
    <div class="meta">
      ${safe(createdDate)}<br/>
      ${reportTypeLabel}<br/>
      <span style="font-size:9px;opacity:0.45;">${t("pdf_page_of").replace("{n}",pageNum)}</span>
    </div>
  </div>
  ${subtitle ? `<div class="page-title">${subtitle}</div>` : ""}`;

    const sharedFooter = `
  <div class="footer">
    <div class="footer-pill">StillMind – ${t("pdf_footer_pill")}</div>
    <div class="footer-note">stillmind.app<br/>${t("pdf_exported")} ${safe(createdDate)}</div>
  </div>`;

    // ── PAGE 1: Overview ──
    const page1 = `
<div class="page">
  ${pageHeader(isMonth ? "" : "1", isMonth ? "" : (t("stat_year_overview")))}

  <div class="hero-row">
    <div class="hero-kpi"><div class="val">${totalSessions}</div><div class="lbl">${t("sessions_word")}</div></div>
    <div class="hero-kpi"><div class="val">${totalMinutes}</div><div class="lbl">${t("pdf_total_minutes")}</div></div>
    <div class="hero-kpi"><div class="val">${activeDays}</div><div class="lbl">${t("pdf_active_days")}</div></div>
    <div class="hero-kpi"><div class="val">${bestStreak}</div><div class="lbl">Streak</div></div>
  </div>

  <div class="divider"><div class="divider-line"></div><div class="divider-label">${detailLabel}</div><div class="divider-line"></div></div>

  <div class="grid2">
    <div class="stat-card">
      <div class="stat-label">${t("pdf_total_sessions")}</div>
      <div class="stat-value">${totalSessions}</div>
      <div class="stat-hint">${t("pdf_total_sessions_hint")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("pdf_total_minutes")}</div>
      <div class="stat-value">${totalMinutes}</div>
      <div class="stat-hint">${t("pdf_total_minutes_hint")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${avgPerSessionLabel}</div>
      <div class="stat-value">${safe(avgDuration)}</div>
      <div class="stat-hint">${t("pdf_avg_session_hint")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("pdf_achievements")}</div>
      <div class="stat-value">${achCount}</div>
      <div class="stat-hint">${t("pdf_achievements_hint")}</div>
    </div>
  </div>

  ${dayEntries.length > 0 ? `
  <div class="chart-section">
    <div class="chart-title">${chartTitle}</div>
    <div class="bars" style="height:70px;">
      ${dayEntries.map(([day,mins]) => `
        <div class="bar-col">
          <div class="bar-val">${mins}</div>
          <div class="bar-fill" style="height:${Math.round((mins/barMax)*54)}px;background:linear-gradient(180deg,#D6C7A1,#B8A87A);"></div>
          <div class="bar-day">${day}</div>
        </div>`).join("")}
    </div>
  </div>` : ""}

  ${achCount > 0 ? `
  <div class="divider"><div class="divider-line"></div><div class="divider-label">${t("pdf_achievements")}</div><div class="divider-line"></div></div>
  <div class="ach-grid">
    ${normalizedAchievements.slice(0, isMonth ? 12 : 8).map(a => `<div class="ach-chip">${a.icon||"🏆"} ${safe(a.label||a.id||"")}</div>`).join("")}
  </div>` : ""}

  ${sharedFooter}
</div>`;

    // ── Return early for monthly report ──
    if (isMonth) {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color-adjust:exact!important; }
  html,body { margin:0; padding:0; width:210mm; background:#0B0B0B; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif; color:#fff; }
  .page { padding:28px 32px 32px; background:#0B0B0B; position:relative; display:flex; flex-direction:column; }
  .accent { height:3px; background:linear-gradient(90deg,transparent,#D6C7A1 30%,#D6C7A1AA 70%,transparent); margin:-28px -32px 28px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
  .brand-name { font-size:20px; font-weight:800; letter-spacing:-0.3px; }
  .brand-period { font-size:10px; letter-spacing:2.5px; text-transform:uppercase; color:rgba(255,255,255,0.42); margin-top:4px; }
  .meta { text-align:right; font-size:10px; color:rgba(255,255,255,0.40); line-height:1.5; }
  .hero-row { display:flex; gap:10px; margin-bottom:18px; }
  .hero-kpi { flex:1; padding:14px 12px; background:linear-gradient(145deg,rgba(214,199,161,0.10),rgba(214,199,161,0.04)); border:1px solid rgba(214,199,161,0.22); border-radius:14px; text-align:center; }
  .hero-kpi .val { font-size:30px; font-weight:800; color:#D6C7A1; line-height:1; }
  .hero-kpi .lbl { font-size:9px; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.44); margin-top:5px; }
  .divider { display:flex; align-items:center; gap:10px; margin:16px 0; }
  .divider-line { flex:1; height:1px; background:rgba(255,255,255,0.08); }
  .divider-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.28); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }
  .stat-card { background:#141414; border:1px solid rgba(255,255,255,0.09); border-radius:12px; padding:14px; }
  .stat-label { font-size:9px; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.40); margin-bottom:7px; }
  .stat-value { font-size:26px; font-weight:800; }
  .stat-hint { margin-top:5px; font-size:10px; color:rgba(255,255,255,0.45); line-height:1.4; }
  .chart-section { background:#141414; border:1px solid rgba(255,255,255,0.09); border-radius:12px; padding:16px; margin-bottom:18px; }
  .chart-title { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.44); margin-bottom:12px; }
  .bars { display:flex; align-items:flex-end; gap:6px; }
  .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
  .bar-fill { width:100%; border-radius:3px 3px 0 0; min-height:0; }
  .bar-day { font-size:8px; color:rgba(255,255,255,0.35); }
  .bar-val { font-size:8px; color:rgba(255,255,255,0.55); min-height:10px; }
  .ach-grid { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:18px; }
  .ach-chip { background:rgba(214,199,161,0.08); border:1px solid rgba(214,199,161,0.20); border-radius:28px; padding:5px 12px; font-size:10px; color:rgba(214,199,161,0.85); display:flex; align-items:center; gap:5px; }
  .footer { margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; }
  .footer-pill { background:rgba(214,199,161,0.12); border:1px solid rgba(214,199,161,0.22); color:#D6C7A1; padding:4px 10px; border-radius:999px; font-size:9px; font-weight:700; }
  .footer-note { font-size:9px; color:rgba(255,255,255,0.30); text-align:right; line-height:1.4; }
</style>
</head>
<body>
${page1}
</body>
</html>`;
    }

    // ── PAGE 2: Monthly Activity ──
    const page2 = `
<div class="page">
  ${pageHeader("2", t("stat_monthly_activity"))}

  <div class="chart-section" style="margin-bottom:12px;">
    <div class="chart-title">${t("pdf_sessions_per_month")}</div>
    <div class="bars" style="height:80px;">
      ${monthData.map(m => `
        <div class="bar-col">
          <div class="bar-val">${m.sessions>0?m.sessions:""}</div>
          <div class="bar-fill" style="height:${m.sessions>0?Math.max(4,Math.round((m.sessions/maxMonthSess)*64)):0}px;background:${m.sessions>0?"linear-gradient(180deg,#D6C7A1,#B8A87A)":"transparent"};"></div>
          <div class="bar-day">${m.label}</div>
        </div>`).join("")}
    </div>
  </div>

  <div class="chart-section" style="margin-bottom:12px;">
    <div class="chart-title">${t("pdf_minutes_per_month")}</div>
    <div class="bars" style="height:80px;">
      ${monthData.map(m => `
        <div class="bar-col">
          <div class="bar-val">${m.minutes>0?m.minutes:""}</div>
          <div class="bar-fill" style="height:${m.minutes>0?Math.max(4,Math.round((m.minutes/maxMonthMins)*64)):0}px;background:${m.minutes>0?"linear-gradient(180deg,rgba(139,92,246,0.9),rgba(109,62,216,0.8))":"transparent"};"></div>
          <div class="bar-day">${m.label}</div>
        </div>`).join("")}
    </div>
  </div>

  <div class="divider"><div class="divider-line"></div><div class="divider-label">${t("stat_month_by_month")}</div><div class="divider-line"></div></div>

  <div class="grid3">
    ${monthData.map(m => `
    <div class="stat-card-sm" style="${m.sessions===0?"opacity:0.30":""}">
      <div class="stat-label-sm">${m.label}</div>
      <div style="font-size:18px;font-weight:800;color:${m.sessions>0?"#D6C7A1":"rgba(255,255,255,0.20)"};">${m.sessions}</div>
      <div style="font-size:9px;color:rgba(255,255,255,0.40);margin-top:2px;">${m.minutes} ${minutesShortLabel} · ${m.days}${t("pdf_days_abbr")}</div>
    </div>`).join("")}
  </div>

  ${sharedFooter}
</div>`;

    // ── PAGE 3: Time-of-Day Analysis ──
    const page3 = `
<div class="page">
  ${pageHeader("3", t("pdf_time_analysis"))}

  <div class="chart-section" style="margin-bottom:16px;">
    <div class="chart-title">${t("pdf_sessions_by_time")}</div>
    <div class="bars" style="height:90px;gap:14px;">
      ${Object.entries(timeSlots).map(([key,val]) => `
        <div class="bar-col">
          <div class="bar-val">${val>0?val:""}</div>
          <div class="bar-fill" style="height:${val>0?Math.max(4,Math.round((val/maxTimeSlot)*74)):0}px;background:${val>0?"linear-gradient(180deg,#D6C7A1,#B8A87A)":"transparent"};"></div>
          <div class="bar-day" style="font-size:7px;text-align:center;line-height:1.2;">${timeLabels[key].split("(")[0].trim()}</div>
        </div>`).join("")}
    </div>
  </div>

  <div class="grid2" style="margin-bottom:14px;">
    <div class="stat-card" style="border-color:rgba(214,199,161,0.35);">
      <div class="stat-label">${t("pdf_favorite_time")}</div>
      <div style="font-size:14px;font-weight:700;color:#D6C7A1;margin:6px 0;">${bestTimeLabel}</div>
      <div class="stat-hint">${bestTimeEntry[1]} ${t("pdf_sessions_short")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("pdf_best_streak")}</div>
      <div class="stat-value">${bestStreak}</div>
      <div class="stat-hint">${t("pdf_consecutive_days")}</div>
    </div>
  </div>

  <div class="divider"><div class="divider-line"></div><div class="divider-label">${t("pdf_time_details")}</div><div class="divider-line"></div></div>

  <div style="display:flex;flex-direction:column;gap:9px;">
    ${Object.entries(timeSlots).map(([key,val]) => `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:140px;font-size:10px;color:rgba(255,255,255,0.55);flex-shrink:0;">${timeLabels[key]}</div>
      <div style="flex:1;height:9px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
        <div style="height:9px;width:${totalSessions>0?Math.round((val/totalSessions)*100):0}%;background:linear-gradient(90deg,#D6C7A1,#B8A87A);border-radius:999px;"></div>
      </div>
      <div style="width:36px;font-size:11px;font-weight:700;text-align:right;color:${val>0?"#D6C7A1":"rgba(255,255,255,0.25)"};">${val}</div>
    </div>`).join("")}
  </div>

  ${sharedFooter}
</div>`;

    // ── PAGE 4: Mood Analysis ──
    const page4 = `
<div class="page">
  ${pageHeader("4", t("pdf_mood_analysis"))}

  ${moodEntries.length > 0 ? `
  <div class="chart-section" style="margin-bottom:14px;">
    <div class="chart-title">${t("pdf_mood_after")}</div>
    <div class="bars" style="height:90px;gap:18px;">
      ${moodEntries.slice(0,7).map(([mood,count]) => `
        <div class="bar-col">
          <div class="bar-val">${count}</div>
          <div class="bar-fill" style="height:${Math.max(4,Math.round((count/moodEntries[0][1])*74))}px;background:linear-gradient(180deg,#D6C7A1,#B8A87A);"></div>
          <div class="bar-day" style="font-size:14px;">${moodIconMap[mood]||"•"}</div>
        </div>`).join("")}
    </div>
  </div>

  <div class="divider"><div class="divider-line"></div><div class="divider-label">${t("pdf_mood_details")}</div><div class="divider-line"></div></div>

  <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:16px;">
    ${moodEntries.map(([mood,count]) => `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:16px;flex-shrink:0;width:24px;text-align:center;">${moodIconMap[mood]||"•"}</div>
      <div style="width:100px;font-size:10px;color:rgba(255,255,255,0.55);flex-shrink:0;">${safe(moodLabelMap[mood] || mood)}</div>
      <div style="flex:1;height:9px;background:rgba(255,255,255,0.06);border-radius:999px;overflow:hidden;">
        <div style="height:9px;width:${totalSessions>0?Math.round((count/totalSessions)*100):0}%;background:linear-gradient(90deg,#D6C7A1,#B8A87A);border-radius:999px;"></div>
      </div>
      <div style="width:65px;font-size:10px;text-align:right;color:rgba(255,255,255,0.50);">${count} · ${totalSessions>0?Math.round((count/totalSessions)*100):0}%</div>
    </div>`).join("")}
  </div>` : `
  <div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,0.30);font-size:13px;">
    ${t("stat_no_mood_data")}
  </div>`}

  <div class="grid2">
    <div class="stat-card">
      <div class="stat-label">${t("pdf_active_days")}</div>
      <div class="stat-value">${activeDays}</div>
      <div class="stat-hint">${t("pdf_active_days_hint")}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${t("pdf_avg_active_day")}</div>
      <div class="stat-value">${activeDays>0?(totalMinutes/activeDays).toFixed(1):"0"}</div>
      <div class="stat-hint">${t("pdf_avg_active_day_hint")}</div>
    </div>
  </div>

  ${sharedFooter}
</div>`;

    // ── PAGE 5: Achievements & Monthly Summary ──
    const page5 = `
<div class="page">
  ${pageHeader("5", t("pdf_achievements_month"))}

  <div class="divider" style="margin-top:0;"><div class="divider-line"></div><div class="divider-label">${t("pdf_achievements")} (${achCount})</div><div class="divider-line"></div></div>

  ${achCount > 0 ? `
  <div class="ach-grid" style="margin-bottom:14px;">
    ${normalizedAchievements.map(a => `<div class="ach-chip">${a.icon||"🏆"} ${safe(a.label||a.id||"")}</div>`).join("")}
  </div>` : `
  <div style="padding:14px;background:#141414;border-radius:12px;margin-bottom:14px;color:rgba(255,255,255,0.30);font-size:11px;text-align:center;">
    ${t("pdf_no_achievements")}
  </div>`}

  <div class="divider"><div class="divider-line"></div><div class="divider-label">${t("stat_month_by_month")} ${now.getFullYear()}</div><div class="divider-line"></div></div>

  <div class="grid3">
    ${monthData.map(m => `
    <div class="stat-card-sm" style="${m.sessions===0?"opacity:0.28":""}">
      <div class="stat-label-sm">${m.label}</div>
      <div style="display:flex;align-items:baseline;gap:3px;margin:3px 0;">
        <span style="font-size:17px;font-weight:800;color:${m.sessions>0?"#D6C7A1":"rgba(255,255,255,0.22)"};">${m.sessions}</span>
        <span style="font-size:8px;color:rgba(255,255,255,0.35);">${sessionsShortLabel}</span>
      </div>
      <div style="font-size:8px;color:rgba(255,255,255,0.40);">${m.minutes} ${minutesShortLabel}</div>
      <div style="font-size:8px;color:rgba(255,255,255,0.35);">${m.days} ${t("pdf_days_label")}</div>
    </div>`).join("")}
  </div>

  ${sharedFooter}
</div>`;

    // ── Full annual CSS + all 5 pages ──
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; size: A4 portrait; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; color-adjust:exact!important; }
  html,body { margin:0; padding:0; width:210mm; background:#0B0B0B; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif; color:#fff; }

  .page { padding:22px 28px 26px; background:#0B0B0B; position:relative; display:flex; flex-direction:column; page-break-after:always; }
  .page:last-child { page-break-after:auto; }

  .accent { height:3px; background:linear-gradient(90deg,transparent,#D6C7A1 30%,#D6C7A1AA 70%,transparent); margin:-22px -28px 20px; }

  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; }
  .brand-name { font-size:18px; font-weight:800; letter-spacing:-0.3px; }
  .brand-period { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.42); margin-top:3px; }
  .meta { text-align:right; font-size:9px; color:rgba(255,255,255,0.40); line-height:1.5; }

  .page-title { font-size:15px; font-weight:700; color:rgba(255,255,255,0.80); margin-bottom:13px; letter-spacing:-0.2px; }

  .hero-row { display:flex; gap:9px; margin-bottom:14px; }
  .hero-kpi { flex:1; padding:12px 10px; background:linear-gradient(145deg,rgba(214,199,161,0.10),rgba(214,199,161,0.04)); border:1px solid rgba(214,199,161,0.22); border-radius:13px; text-align:center; }
  .hero-kpi .val { font-size:27px; font-weight:800; color:#D6C7A1; line-height:1; }
  .hero-kpi .lbl { font-size:8px; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.44); margin-top:5px; }

  .divider { display:flex; align-items:center; gap:9px; margin:13px 0; }
  .divider-line { flex:1; height:1px; background:rgba(255,255,255,0.08); }
  .divider-label { font-size:8px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.28); white-space:nowrap; }

  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:14px; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:7px; margin-bottom:14px; }

  .stat-card { background:#141414; border:1px solid rgba(255,255,255,0.09); border-radius:11px; padding:12px; }
  .stat-card-sm { background:#141414; border:1px solid rgba(255,255,255,0.09); border-radius:9px; padding:9px; }
  .stat-label { font-size:8px; letter-spacing:1.5px; text-transform:uppercase; color:rgba(255,255,255,0.40); margin-bottom:6px; }
  .stat-label-sm { font-size:7px; letter-spacing:1px; text-transform:uppercase; color:rgba(255,255,255,0.40); margin-bottom:3px; }
  .stat-value { font-size:24px; font-weight:800; }
  .stat-hint { margin-top:4px; font-size:9px; color:rgba(255,255,255,0.45); line-height:1.3; }

  .chart-section { background:#141414; border:1px solid rgba(255,255,255,0.09); border-radius:11px; padding:13px; margin-bottom:13px; }
  .chart-title { font-size:8px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.44); margin-bottom:11px; }
  .bars { display:flex; align-items:flex-end; gap:5px; }
  .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
  .bar-fill { width:100%; border-radius:3px 3px 0 0; }
  .bar-day { font-size:7px; color:rgba(255,255,255,0.35); }
  .bar-val { font-size:7px; color:rgba(255,255,255,0.55); min-height:10px; }

  .ach-grid { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
  .ach-chip { background:rgba(214,199,161,0.08); border:1px solid rgba(214,199,161,0.20); border-radius:26px; padding:4px 11px; font-size:9px; color:rgba(214,199,161,0.85); display:flex; align-items:center; gap:4px; }

  .footer { margin-top:auto; padding-top:13px; border-top:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center; }
  .footer-pill { background:rgba(214,199,161,0.12); border:1px solid rgba(214,199,161,0.22); color:#D6C7A1; padding:4px 10px; border-radius:999px; font-size:8px; font-weight:700; letter-spacing:0.5px; }
  .footer-note { font-size:8px; color:rgba(255,255,255,0.30); text-align:right; line-height:1.4; }
</style>
</head>
<body>
${page1}
${page2}
${page3}
${page4}
${page5}
</body>
</html>`;
  }, [history, unlockedAchievements, weeklyCount, achievementBadges, lang, t]);
  const renderExportBlock = () => (
    <View style={{marginTop:12,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.borderLight,overflow:"hidden"}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:10}}>
        <View style={{width:38,height:38,borderRadius:10,backgroundColor:"rgba(214,199,161,0.10)",alignItems:"center",justifyContent:"center"}}>
          <Text style={{fontSize:20}}>{"📊"}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:15}}>{t("stat_export_section")}</Text>
          <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:12,marginTop:2}}>{t("stat_export_pdf_sub")}</Text>
        </View>
        {plan==="lifetime" && (
          <View style={{backgroundColor:"rgba(214,199,161,0.15)",borderRadius:6,paddingHorizontal:7,paddingVertical:3,borderWidth:0.5,borderColor:"rgba(214,199,161,0.35)"}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:9,color:"#D6C7A1",letterSpacing:0.5}}>{"LIFE"}</Text>
          </View>
        )}
      </View>

      {/* Preview chips */}
      <View style={{flexDirection:"row",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {[t("yearly_overview"),t("time_of_day"),t("mood_chart"),t("achievements_tab"),t("month_details")].map(chip => (
          <View key={chip} style={{backgroundColor:"rgba(255,255,255,0.05)",borderRadius:6,paddingHorizontal:8,paddingVertical:4,borderWidth:0.5,borderColor:"rgba(255,255,255,0.10)"}}>
            <Text style={{fontFamily:"Montserrat_500Medium",fontSize:10,color:colors.textMuted}}>{chip}</Text>
          </View>
        ))}
      </View>

      <View style={{gap:8}}>
        {/* CSV Export – ab Pro */}
        <TouchableOpacity onPress={()=>{if(!canExport(plan))return openPremium();setExportRangeVisible(true);}} activeOpacity={0.85}
          style={{borderRadius:14,paddingVertical:12,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderWidth:1,borderColor:colors.borderLight,backgroundColor:"rgba(255,255,255,0.04)"}}>
          <View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:13}}>
              {canExport(plan)?t("export_csv"):t("export_csv_locked")}
            </Text>
            {!canExport(plan) && <Text style={{marginTop:2,fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:10}}>{t("from_pro")}</Text>}
          </View>
          {canExport(plan) && <Text style={{color:colors.textMuted,fontSize:16}}>›</Text>}
        </TouchableOpacity>

        {/* Monatsbericht PDF – ab Pro */}
        <TouchableOpacity onPress={async()=>{
          if (!canUseMonthReport(plan)) return openPremium();
          try {
            const now = new Date();
            const locale = lang === "de" ? "de-DE" : "en-US";
            const monthName = now.toLocaleString(locale, {month:"long"});
            const label = t("stat_month_report_label").replace("{{year}}", now.getFullYear()).replace("{{month}}", monthName);
            const html = buildLuxuryReportHtml(label, "month");
            const canShare = await Sharing.isAvailableAsync();
            if (!canShare) { Alert.alert(t("stat_unavailable"),t("stat_pdf_unsupported")); return; }
            const {uri} = await Print.printToFileAsync({html, base64:false});
            await Sharing.shareAsync(uri,{mimeType:"application/pdf",dialogTitle:`StillMind – ${label}`,UTI:"com.adobe.pdf"});
          } catch(e) { Alert.alert(t("prem_error_generic"), t("stat_pdf_error")); }
        }} activeOpacity={0.85}
          style={{borderRadius:14,paddingVertical:12,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",
            backgroundColor: canUseMonthReport(plan) ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            borderWidth:1,borderColor:colors.borderLight}}>
          <View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:13}}>
              {canUseMonthReport(plan)?t("export_month_pdf"):t("export_month_locked")}
            </Text>
            <Text style={{marginTop:2,fontFamily:"Montserrat_500Medium",color:colors.textMuted,fontSize:10}}>
              {canUseMonthReport(plan)?t("export_month_sub"):t("export_month_sub_locked")}
            </Text>
          </View>
          {canUseMonthReport(plan) && <Text style={{color:colors.textMuted,fontSize:16}}>›</Text>}
        </TouchableOpacity>

        {/* Jahresbericht PDF – nur Lifetime */}
        <TouchableOpacity onPress={async()=>{
          if (!canUseYearReport(plan)) return openPremium();
          try {
            const now = new Date();
            const label = t("stat_year_report_label").replace("{{year}}", now.getFullYear());
            const html = buildLuxuryReportHtml(label);
            const canShare = await Sharing.isAvailableAsync();
            if (!canShare) { Alert.alert(t("stat_unavailable"),t("stat_pdf_unsupported")); return; }
            const {uri} = await Print.printToFileAsync({html, base64:false});
            await Sharing.shareAsync(uri,{mimeType:"application/pdf",dialogTitle:`StillMind – ${label}`,UTI:"com.adobe.pdf"});
          } catch(e) { Alert.alert(t("prem_error_generic"), t("stat_pdf_error")); }
        }} activeOpacity={0.85}
          style={{borderRadius:14,paddingVertical:12,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",
            backgroundColor: canUseYearReport(plan) ? "#D6C7A1" : "rgba(214,199,161,0.08)",
            borderWidth: canUseYearReport(plan) ? 0 : 1,
            borderColor:"rgba(214,199,161,0.30)",
            shadowColor:"#D6C7A1",shadowOpacity:canUseYearReport(plan)?0.18:0,shadowRadius:12,shadowOffset:{width:0,height:4},
            elevation:canUseYearReport(plan)?4:0}}>
          <View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:canUseYearReport(plan)?"#0D0C0A":"#D6C7A1",fontSize:13}}>
              {canUseYearReport(plan)?t("export_year_pdf"):t("export_year_locked")}
            </Text>
            <Text style={{marginTop:2,fontFamily:"Montserrat_500Medium",color:canUseYearReport(plan)?"rgba(13,12,10,0.60)":"rgba(214,199,161,0.50)",fontSize:10}}>
              {canUseYearReport(plan)?t("export_year_sub"):t("export_year_sub_locked")}
            </Text>
          </View>
          {canUseYearReport(plan) && <Text style={{color:"rgba(13,12,10,0.50)",fontSize:16}}>›</Text>}
        </TouchableOpacity>
      </View>

      {!isProPlus && (
        <React.Fragment>
          <View style={{position:"absolute",left:0,right:0,bottom:0,top:0,backgroundColor:"rgba(11,11,12,0.88)",borderRadius:16}}/>
          <View style={{position:"absolute",left:16,right:16,top:0,bottom:0,justifyContent:"center"}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#fff",fontSize:15,marginBottom:5}}>{t("stat_export_section2")}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular",color:"rgba(255,255,255,0.60)",fontSize:13,lineHeight:17,marginBottom:12}}>{t("stat_export_hint")}</Text>
            <TouchableOpacity onPress={openPremium} activeOpacity={0.85} style={{backgroundColor:"#8B5CF6",borderRadius:14,paddingVertical:12,alignItems:"center"}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#fff",fontSize:14}}>{t("stat_pro_unlock")}</Text>
            </TouchableOpacity>
          </View>
        </React.Fragment>
      )}
    </View>
  );
  const renderLogbookCard = () => (
    <TouchableOpacity onPress={()=>setLogbookVisible(true)} activeOpacity={0.9} style={{marginTop:12,backgroundColor:colors.surface,borderRadius:16,padding:16,borderWidth:1,borderColor:colors.borderLight}}>
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
        <View style={{flex:1,paddingRight:10}}>
          <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:16}}>{t("logbook")}</Text>
          <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,marginTop:4,fontSize:13,lineHeight:17}}>{t("logbook_sub")}</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
      {(() => {
        const latest = (Array.isArray(history)?history:[]).find(h=>(h && h.type)==="start"&&((h && h.timestamp)||(h && h.date)));
        if (!latest) return null;
        const ts = Number(latest.timestamp||latest.date||0);
        return (
          <Text style={{marginTop:10,fontFamily:"Montserrat_500Medium",color:colors.textDim,fontSize:12,lineHeight:16}} numberOfLines={2}>
            {t("stat_last_prefix")}{formatDateDE(ts)}{" • "}{formatHHmm(ts)}{" · "}{getEntryTitle(latest)}{"\n"}{moodEmoji(latest.mood||"")||""}{" "}{typeof latest.note==="string"&&latest.note?latest.note:"—"}
          </Text>
        );
      })()}
    </TouchableOpacity>
  );

  // ─────────────── ZIELE & WOCHENZIEL (kombinierter Banner) ───────────────
  const renderGoalsCard = () => {
    // Free: zeigt Upgrade-Banner mit Teaser
    // Pro/Lifetime: zeigt echte Ziele + Wochenziel + t("add_goal") Button
    const weeklyPct = Math.min((weeklyCount||0) / Math.max(weeklyTarget||1, 1), 1);

    if (!isProPlus) {
      // ── UPGRADE BANNER (Free) ──────────────────────────
      return (
        <TouchableOpacity
          onPress={openPremium}
          activeOpacity={0.88}
          style={{marginTop:12, borderRadius:18, overflow:"hidden", borderWidth:1.5, borderColor:"rgba(139,92,246,0.35)"}}
        >
          {/* Demo-Inhalt dahinter (leicht gegraut) */}
          <View style={{backgroundColor:colors.surface, padding:18, paddingBottom:22}}>
            {/* Header */}
            <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
              <View>
                <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.text, fontSize:17}}>{t("goals")}</Text>
                <Text style={{fontFamily:"Montserrat_400Regular", color:colors.textMuted, fontSize:12, marginTop:2}}>{t("stat_goals_hint")}</Text>
              </View>
              <View style={{backgroundColor:"rgba(139,92,246,0.20)", paddingHorizontal:11, paddingVertical:5, borderRadius:999, borderWidth:1, borderColor:"rgba(139,92,246,0.40)"}}>
                <Text style={{fontFamily:"Montserrat_600SemiBold", fontSize:11, color:"#A78BFA"}}>{t("from_pro").toUpperCase()}</Text>
              </View>
            </View>

            {/* Demo-Ziele (gegraut) */}
            {[
              {title:t("goals_sample_1"), pct:0.6, type:"sessionsPerWeek", current:2, target:3},
              {title:t("goals_sample_2"), pct:0.4, type:"minutesPerWeek", current:8, target:20},
            ].map((g,i) => (
              <View key={i} style={{marginBottom:12, opacity:0.40}}>
                <View style={{flexDirection:"row", justifyContent:"space-between", marginBottom:5}}>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:colors.text, fontSize:13}}>{g.title}</Text>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:colors.textMuted, fontSize:12}}>{g.current} / {g.target}</Text>
                </View>
                <View style={{height:8, backgroundColor:colors.bar, borderRadius:999, overflow:"hidden"}}>
                  <View style={{height:8, width:`${Math.round(g.pct*100)}%`, backgroundColor:"rgba(139,92,246,0.70)", borderRadius:999}} />
                </View>
              </View>
            ))}

            {/* Wochenziel Demo */}
            <View style={{opacity:0.40, marginBottom:16}}>
              <Text style={{fontFamily:"Montserrat_500Medium", color:colors.textMuted, fontSize:12, marginBottom:5}}>{t("stat_weekly_goal_label")}</Text>
              <View style={{height:8, backgroundColor:colors.bar, borderRadius:999, overflow:"hidden"}}>
                <View style={{height:8, width:"55%", backgroundColor:"rgba(139,92,246,0.70)", borderRadius:999}} />
              </View>
              <Text style={{fontFamily:"Montserrat_400Regular", color:colors.textMuted, fontSize:11, marginTop:4}}>{"3 / 5 " + t("sessions_this_week").replace("{{n}}", "")}</Text>
            </View>

            {/* Solid Upgrade-Overlay unten */}
            <View style={{backgroundColor:"rgba(11,11,12,0.82)", borderRadius:14, padding:14, borderWidth:1, borderColor:"rgba(139,92,246,0.30)"}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold", color:"#fff", fontSize:15, marginBottom:4}}>{t("goals_own_label")}</Text>
              <Text style={{fontFamily:"Montserrat_400Regular", color:"rgba(255,255,255,0.65)", fontSize:13, lineHeight:18, marginBottom:12}}>
                {t("goals_define_hint")}
              </Text>
              <View style={{flexDirection:"row", alignItems:"center", gap:10}}>
                <View style={{flex:1, backgroundColor:"rgba(139,92,246,0.22)", borderRadius:11, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:"rgba(139,92,246,0.35)"}}>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:"#A78BFA", fontSize:12}}>{t("goals_own_example")}</Text>
                </View>
                <View style={{flex:1, backgroundColor:"rgba(139,92,246,0.22)", borderRadius:11, paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:"rgba(139,92,246,0.35)"}}>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:"#A78BFA", fontSize:12}}>{"✓ " + t("stat_weekly_goal_label")}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={openPremium}
                activeOpacity={0.85}
                style={{marginTop:12, backgroundColor:"#8B5CF6", borderRadius:14, paddingVertical:13, alignItems:"center"}}
              >
                <Text style={{fontFamily:"Montserrat_600SemiBold", color:"#fff", fontSize:15}}>{t("goals_pro_unlock")}</Text>
              </TouchableOpacity>
              <Text style={{fontFamily:"Montserrat_400Regular", color:"rgba(255,255,255,0.40)", fontSize:11, textAlign:"center", marginTop:6}}>{t("stat_pro_trial_hint").replace("{{price}}", t("stat_pro_price_fallback") || "8,99\u00a0\u20ac")}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ── PRO/LIFETIME: Echter Inhalt ──────────────────────────
    return (
      <View style={{marginTop:12, backgroundColor:colors.surface, borderRadius:18, padding:16, borderWidth:1, borderColor:colors.borderLight}}>
        {/* Header */}
        <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:14}}>
          <View>
            <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.text, fontSize:17}}>{t("stat_goals_title")}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular", color:colors.textMuted, fontSize:12, marginTop:2}}>{t("goals_sub")}</Text>
          </View>
          <View style={{flexDirection:"row", gap:8, alignItems:"center"}}>
            {goals && goals.length > 0 && (
              <TouchableOpacity
                onPress={safeOpenGoalsModal}
                style={{flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(255,255,255,0.07)", paddingHorizontal:12, paddingVertical:7, borderRadius:999, borderWidth:1, borderColor:colors.borderLight}}
              >
                <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.textMuted, fontSize:13}}>{t("edit")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={safeOpenGoalCreate}
              style={{flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(255,255,255,0.07)", paddingHorizontal:12, paddingVertical:7, borderRadius:999, borderWidth:1, borderColor:colors.borderLight}}
            >
              <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.text, fontSize:13}}>{t("add_goal")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sanftes Wochenziel */}
        <View style={{backgroundColor:"rgba(255,255,255,0.04)", borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:colors.borderLight}}>
          <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:6}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.text, fontSize:14}}>{t("stat_weekly_goal_label")}</Text>
            <Text style={{fontFamily:"Montserrat_600SemiBold", color:colors.accent, fontSize:14}}>{Math.min(weeklyCount,weeklyTarget)}{" / "}{weeklyTarget}</Text>
          </View>
          <View style={{height:8, backgroundColor:colors.bar, borderRadius:999, overflow:"hidden"}}>
            <View style={{height:8, width:`${Math.round(weeklyPct*100)}%`, backgroundColor:colors.barActive, borderRadius:999}} />
          </View>
          <Text style={{fontFamily:"Montserrat_400Regular", color:colors.textMuted, fontSize:12, marginTop:5}}>
            {weeklyCount>=weeklyTarget ? t("weekly_goal_reached") : `${t("sessions_weekly_goal").replace("{{n}}", Math.max(0,weeklyTarget-weeklyCount))} ${t("stat_to_goal_suffix")}`}
          </Text>
        </View>

        {/* Eigene Ziele */}
        {goals && goals.length > 0 ? (
          goals.slice(0,3).map(g => {
            const current = g.type==="minutesPerWeek"
              ? monthMinutes
              : weeklyCount;
            const pct = Math.max(0,Math.min(1,(current||0)/(g.target||1)));
            return (
              <View key={g.id} style={{marginBottom:10}}>
                <View style={{flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:4}}>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:colors.text, fontSize:13}}>{g.title}</Text>
                  <Text style={{fontFamily:"Montserrat_500Medium", color:colors.textMuted, fontSize:12}}>{current} / {g.target}{g.type==="minutesPerWeek"?" Min":""}</Text>
                </View>
                <View style={{height:7, backgroundColor:colors.bar, borderRadius:999, overflow:"hidden"}}>
                  <View style={{height:7, width:`${Math.round(pct*100)}%`, backgroundColor:colors.barActive, borderRadius:999}} />
                </View>
              </View>
            );
          })
        ) : (
          <TouchableOpacity onPress={safeOpenGoalCreate} activeOpacity={0.85} style={{borderWidth:1, borderColor:colors.borderLight, borderStyle:"dashed", borderRadius:12, paddingVertical:14, alignItems:"center"}}>
            <Text style={{fontFamily:"Montserrat_500Medium", color:colors.textMuted, fontSize:13}}>{t("stat_create_first")}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderWeeklyGoalCard = () => null; // In renderGoalsCard integriert

  // ─────────────── LAYOUT EDITOR (simple drag-and-drop via move buttons) ───────────────
  // ─── Layout Editor ─────────────────────────────────────────────────────────
  // Long-press → wiggle mode. Drag any row → instant reorder + smooth clone.
  // NO freeze: setLayoutDraft fires immediately on release, clone snaps in parallel.
  // NO jump:  position = startIdx*ROW_STEP + (pageY - grantPageY)

  const ROW_HEIGHT = 64;
  const ROW_GAP    = 8;
  const ROW_STEP   = ROW_HEIGHT + ROW_GAP;

  const [wiggleActive,  setWiggleActive]  = useState(false);
  const [draggingId,    setDraggingId]    = useState(null);
  const draggingIdRef   = useRef(null);
  const dragStartIndex  = useRef(0);
  const dragCurrentIndex = useRef(0);
  const dragAbsY        = useRef(new Animated.Value(0)).current;
  const grantPageY      = useRef(0);
  const layoutDraftRef  = useRef(layoutDraft);
  const wiggleAnims     = useRef({});
  const wiggleLoops     = useRef({});
  const longPressTimer  = useRef(null);
  const rowPRCache      = useRef({});

  useEffect(() => { layoutDraftRef.current = layoutDraft; }, [layoutDraft]);

  const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const getWiggleAnim = useCallback((id) => {
    if (!wiggleAnims.current[id]) wiggleAnims.current[id] = new Animated.Value(0);
    return wiggleAnims.current[id];
  }, []);

  const startWiggle = useCallback((excludeId = null) => {
    const list = layoutDraftRef.current || [];
    list.forEach((id, i) => {
      if (id === excludeId) return;
      const anim = getWiggleAnim(id);
      try { anim.stopAnimation(); anim.setValue(0); } catch (_) {}
      const dir = i % 2 === 0 ? 1 : -1;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue:  dir * 2.0, duration: 100, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -dir * 2.0, duration: 200, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  dir * 2.0, duration: 100, useNativeDriver: true }),
        ])
      );
      wiggleLoops.current[id] = loop;
      loop.start();
    });
  }, [getWiggleAnim]);

  const stopWiggle = useCallback(() => {
    Object.values(wiggleLoops.current).forEach(l => { try { if (l && l.stop) l.stop(); } catch (_) {} });
    wiggleLoops.current = {};
    Object.values(wiggleAnims.current).forEach(a => { try { if (a && a.stopAnimation) a.stopAnimation(); if (a && a.setValue) a.setValue(0); } catch (_) {} });
  }, []);

  // Stop all animations when tab loses focus (prevents crash on fast tab switching)
  useFocusEffect(
    useCallback(() => {
      return () => {
        stopWiggle();
        clearTimeout(longPressTimer.current);
        try { dragAbsY.stopAnimation(); dragAbsY.setValue(0); } catch (_) {}
        draggingIdRef.current = null;
        setDraggingId(null);
        setWiggleActive(false);
        setLayoutEditVisible(false);
      };
    }, [stopWiggle, dragAbsY])
  );

  // Rebuild PR cache when wiggle mode changes so callbacks capture fresh state
  useEffect(() => { rowPRCache.current = {}; }, [wiggleActive]);

  useEffect(() => () => { stopWiggle(); clearTimeout(longPressTimer.current); }, [stopWiggle]);

  const makeRowPR = useCallback((id) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => draggingIdRef.current === id,
    onMoveShouldSetPanResponderCapture: () => draggingIdRef.current === id,

    onPanResponderGrant: (e) => {
      clearTimeout(longPressTimer.current);
      grantPageY.current = e.nativeEvent.pageY;

      if (wiggleActive) {
        // Already in wiggle mode → start drag immediately
        const idx = layoutDraftRef.current.indexOf(id);
        if (idx < 0) return;
        draggingIdRef.current     = id;
        dragStartIndex.current    = idx;
        dragCurrentIndex.current  = idx;
        try { dragAbsY.stopAnimation(); dragAbsY.setValue(idx * ROW_STEP); } catch (_) {}
        setDraggingId(id);
        try { wiggleLoops.current[id] && wiggleLoops.current[id].stop(); } catch (_) {}
        try { wiggleAnims.current[id] && wiggleAnims.current[id].setValue(0); } catch (_) {}
      } else {
        // Enter wiggle mode after long-press delay
        longPressTimer.current = setTimeout(() => {
          const idx = layoutDraftRef.current.indexOf(id);
          if (idx < 0) return;
          draggingIdRef.current     = id;
          dragStartIndex.current    = idx;
          dragCurrentIndex.current  = idx;
          try { dragAbsY.stopAnimation(); dragAbsY.setValue(idx * ROW_STEP); } catch (_) {}
          setWiggleActive(true);
          startWiggle(id);
          setDraggingId(id);
        }, 300);
      }
    },

    onPanResponderMove: (e) => {
      if (draggingIdRef.current !== id) return;
      const list = layoutDraftRef.current || [];
      const dy   = e.nativeEvent.pageY - grantPageY.current;
      const raw  = dragStartIndex.current * ROW_STEP + dy;
      const top  = clampV(raw, 0, (list.length - 1) * ROW_STEP);
      dragAbsY.setValue(top);
      dragCurrentIndex.current = clampV(Math.round(top / ROW_STEP), 0, list.length - 1);
    },

    onPanResponderRelease: () => {
      clearTimeout(longPressTimer.current);
      if (draggingIdRef.current !== id) return;

      const toIdx = dragCurrentIndex.current;

      // 1. Update order IMMEDIATELY → no freeze waiting for animation
      setLayoutDraft(prev => {
        const arr  = Array.isArray(prev) ? [...prev] : [];
        const from = arr.indexOf(id);
        if (from < 0) return prev;
        const next = [...arr];
        next.splice(from, 1);
        next.splice(toIdx, 0, id);
        return next;
      });

      // 2. Snap clone to slot, then hide it
      const snapTarget = toIdx * ROW_STEP;
      try {
        Animated.spring(dragAbsY, {
          toValue: snapTarget, bounciness: 0, speed: 40, useNativeDriver: false,
        }).start(() => {
          try {
            draggingIdRef.current = null;
            setDraggingId(null);
            dragAbsY.setValue(0);
            if (wiggleActive) startWiggle(null);
          } catch (_) {}
        });
      } catch (_) {
        draggingIdRef.current = null;
        setDraggingId(null);
      }
    },

    onPanResponderTerminate: () => {
      clearTimeout(longPressTimer.current);
      draggingIdRef.current = null;
      setDraggingId(null);
      try { dragAbsY.stopAnimation(); dragAbsY.setValue(0); } catch (_) {}
    },
  }), [wiggleActive, startWiggle, dragAbsY, ROW_STEP]);

  const getRowPR = useCallback((id) => {
    if (!rowPRCache.current[id]) rowPRCache.current[id] = makeRowPR(id);
    return rowPRCache.current[id];
  }, [makeRowPR]);

  const closeLayoutEditor = useCallback(() => {
    clearTimeout(longPressTimer.current);
    stopWiggle();
    setWiggleActive(false);
    draggingIdRef.current = null;
    setDraggingId(null);
    try { dragAbsY.stopAnimation(); dragAbsY.setValue(0); } catch (_) {}
    setLayoutEditVisible(false);
  }, [stopWiggle, dragAbsY]);

const renderLayoutEditor = () => {
  const listH = layoutDraft.length * ROW_STEP - ROW_GAP;

  return (
    <Modal visible={layoutEditVisible} transparent animationType="fade" onRequestClose={closeLayoutEditor}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeLayoutEditor} />

        <View style={{ width: "90%", backgroundColor: "rgba(18,18,20,0.98)", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", padding: 18 }}>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: "#fff", fontFamily: "Montserrat_600SemiBold", fontSize: 16 }}>{t("stat_layout_edit")}</Text>
            <TouchableOpacity onPress={closeLayoutEditor} style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <X size={17} color="rgba(255,255,255,0.80)" />
            </TouchableOpacity>
          </View>

          <Text style={{ color: "rgba(255,255,255,0.40)", fontFamily: "Montserrat_500Medium", fontSize: 12, marginBottom: 16 }}>
            {wiggleActive ? t("goals_drag_hint") : t("goals_hold_hint")}
          </Text>

          {/* Sortable rows */}
          <View style={{ height: listH, position: "relative" }}>

            {layoutDraft.map((id, idx) => {
              const isGhost = draggingId === id;
              const wAnim   = getWiggleAnim(id);
              const pr      = getRowPR(id);
              return (
                <Animated.View
                  key={id}
                  {...pr.panHandlers}
                  style={{
                    position: "absolute",
                    top: idx * ROW_STEP,
                    left: 0, right: 0, height: ROW_HEIGHT,
                    flexDirection: "row", alignItems: "center",
                    backgroundColor: isGhost ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                    borderRadius: 14, borderWidth: 1,
                    borderColor: isGhost ? "rgba(255,255,255,0.04)" : wiggleActive ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.10)",
                    paddingHorizontal: 14,
                    opacity: isGhost ? 0.08 : 1,
                    transform: [{ rotate: wAnim.interpolate({ inputRange: [-3, 0, 3], outputRange: ["-3deg", "0deg", "3deg"] }) }],
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: wiggleActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)", marginRight: 12 }}>
                    <GripVertical size={17} color={wiggleActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)"} />
                  </View>
                  <Text style={{ flex: 1, color: "#fff", fontFamily: "Montserrat_600SemiBold", fontSize: 14 }} numberOfLines={1}>
                    {getCardLabels(t)[id] || id}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.30)", fontFamily: "Montserrat_500Medium", fontSize: 12 }}>
                    {idx + 1}
                  </Text>
                </Animated.View>
              );
            })}

            {/* Floating clone while dragging */}
            {draggingId ? (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: ROW_HEIGHT,
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.42)",
                  paddingHorizontal: 14, zIndex: 99,
                  shadowColor: "#000", shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.5, shadowRadius: 16, elevation: 16,
                  transform: [{ translateY: dragAbsY }],
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.38)", marginRight: 12 }}>
                  <GripVertical size={17} color="#fff" />
                </View>
                <Text style={{ flex: 1, color: "#fff", fontFamily: "Montserrat_600SemiBold", fontSize: 14 }} numberOfLines={1}>
                  {getCardLabels(t)[draggingId] || draggingId}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Montserrat_500Medium", fontSize: 12 }}>≡</Text>
              </Animated.View>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={async () => { await persistCardOrder(layoutDraft); closeLayoutEditor(); }}
            style={{ marginTop: 18, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 13, alignItems: "center" }}
            activeOpacity={0.85}
          >
            <Text style={{ color: "#000", fontFamily: "Montserrat_600SemiBold", fontSize: 15 }}>{t("save")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

  // ─────────────── LOGBUCH MODAL ───────────────
  const renderLogbookModal = () => (
    <Modal visible={logbookVisible} transparent animationType="slide" onRequestClose={()=>setLogbookVisible(false)}>
      <View style={{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,0.5)"}}>
        <View style={{backgroundColor:colors.surface,borderTopLeftRadius:22,borderTopRightRadius:22,paddingTop:12,paddingBottom:insets.bottom+18,paddingHorizontal:18,borderWidth:1,borderColor:colors.borderLight,maxHeight:"85%"}}>
          <View style={{alignItems:"center",marginBottom:12}}><View style={{width:52,height:5,borderRadius:5,backgroundColor:"rgba(255,255,255,0.16)"}} /></View>
          <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:18}}>{t("logbook")}</Text>
            <TouchableOpacity onPress={()=>setLogbookVisible(false)}><X size={20} color={colors.textMuted} /></TouchableOpacity>
          </View>
          <View style={{flexDirection:"row",gap:8,marginBottom:14}}>
            {["7","30","90"].map(opt => (
              <TouchableOpacity key={opt} onPress={()=>setLogbookRange(opt)} style={{paddingHorizontal:14,paddingVertical:7,borderRadius:999,backgroundColor:logbookRange===opt?colors.accent:"rgba(255,255,255,0.06)",borderWidth:1,borderColor:logbookRange===opt?colors.accent:colors.borderLight}}>
                <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:12,color:logbookRange===opt?"#0B0B0C":colors.textMuted}}>{opt==="7"?t("last_7_days"):opt==="30"?t("last_30_days"):t("last_90_days")}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {logbookEntries.length===0 ? (
              <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:14,textAlign:"center",paddingVertical:24}}>{t("stat_no_entries")}</Text>
            ) : logbookEntries.map((h,idx)=>{
              const ts = Number(h.timestamp||h.date||0);
              const mood = moodEmoji(h.mood||"");
              return (
                <View key={`${ts}-${idx}`} style={{paddingVertical:12,borderBottomWidth:idx===logbookEntries.length-1?0:1,borderBottomColor:colors.borderLight}}>
                  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:14,flex:1}} numberOfLines={1}>{getEntryTitle(h)}</Text>
                    <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textDim,fontSize:12}}>{formatDateDE(ts)}</Text>
                  </View>
                  <View style={{flexDirection:"row",alignItems:"center",marginTop:4,gap:8}}>
                    {!!mood && <Text style={{fontSize:16}}>{mood}</Text>}
                    <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:12,flex:1}} numberOfLines={2}>{typeof h.note==="string"&&h.note?h.note:"Keine Notiz"}</Text>
                    <Text style={{fontFamily:"Montserrat_500Medium",color:colors.textDim,fontSize:12}}>{formatDuration(h.elapsedSec||h.durationSec||60)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─────────────── KATEGORIE MODAL ───────────────
  const activeCategoryData = achievementCategories.find(c=>c.id===activeCategoryId);
  const activeCategoryBadges = activeCategoryId ? (achievementBadges[activeCategoryId]||[]) : [];

  const renderCategoryModal = () => (
    <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={closeCategory}>
      <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeCategory} />
        <View style={{width:"90%",maxHeight:"80%",backgroundColor:"rgba(20,20,22,0.97)",borderRadius:20,borderWidth:1,borderColor:"rgba(255,255,255,0.10)",padding:18}}>
          <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <Text style={{color:"#fff",fontFamily:"Montserrat_600SemiBold",fontSize:17}}>{(activeCategoryData && activeCategoryData.title)||""}</Text>
            <TouchableOpacity onPress={closeCategory} style={{width:34,height:34,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,0.08)"}}>
              <X size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {activeCategoryBadges.map(badge=>{
              const unlocked = achievementsUnlockedSet.has(badge.id);
              return (
                <TouchableOpacity key={badge.id} onPress={()=>openBadge(badge)} style={{flexDirection:"row",alignItems:"center",paddingVertical:14,borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,0.07)"}}>
                  <View style={{width:44,height:44,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:unlocked?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",borderWidth:1,borderColor:unlocked?"rgba(255,255,255,0.20)":"rgba(255,255,255,0.08)",marginRight:14}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:unlocked?"#fff":"rgba(255,255,255,0.30)",fontSize:13}}>{badge.short||"?"}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:unlocked?"#fff":"rgba(255,255,255,0.45)",fontSize:14}}>{badge.label}</Text>
                    <Text style={{fontFamily:"Montserrat_400Regular",color:"rgba(255,255,255,0.50)",fontSize:12,marginTop:2}} numberOfLines={2}>{badge.desc}</Text>
                  </View>
                  {unlocked && <Text style={{fontSize:18,marginLeft:10}}>{"✓"}</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ─────────────── BADGE DETAIL MODAL ───────────────
  const renderBadgeModal = () => (
    <Modal visible={badgeModalVisible} transparent animationType="fade" onRequestClose={()=>setBadgeModalVisible(false)}>
      <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setBadgeModalVisible(false)} />
        {activeBadge && (
          <View style={{width:"84%",backgroundColor:"rgba(20,20,22,0.97)",borderRadius:20,borderWidth:1,borderColor:"rgba(255,255,255,0.10)",padding:22,alignItems:"center"}}>
            <View style={{width:72,height:72,borderRadius:20,alignItems:"center",justifyContent:"center",backgroundColor:activeBadge.unlocked?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",borderWidth:1,borderColor:activeBadge.unlocked?"rgba(255,255,255,0.20)":"rgba(255,255,255,0.08)",marginBottom:14}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",color:activeBadge.unlocked?"#fff":"rgba(255,255,255,0.25)",fontSize:18}}>{activeBadge.short||"?"}</Text>
            </View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:activeBadge.unlocked?"#fff":"rgba(255,255,255,0.55)",fontSize:18,textAlign:"center",marginBottom:8}}>{activeBadge.label}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular",color:"rgba(255,255,255,0.65)",fontSize:14,textAlign:"center",lineHeight:20,marginBottom:16}}>{activeBadge.desc}</Text>
            {activeBadge.target && typeof activeBadge.current==="number" && (
              <View style={{width:"100%",marginBottom:16}}>
                <View style={{flexDirection:"row",justifyContent:"space-between",marginBottom:6}}>
                  <Text style={{fontFamily:"Montserrat_500Medium",color:"rgba(255,255,255,0.50)",fontSize:12}}>{t("progress")}</Text>
                  <Text style={{fontFamily:"Montserrat_600SemiBold",color:"rgba(255,255,255,0.70)",fontSize:12}}>{Math.min(activeBadge.current,activeBadge.target)} / {activeBadge.target}</Text>
                </View>
                <View style={{height:8,borderRadius:999,backgroundColor:"rgba(255,255,255,0.10)",overflow:"hidden"}}>
                  <View style={{height:"100%",width:`${Math.min(1,(activeBadge.current||0)/(activeBadge.target||1))*100}%`,borderRadius:999,backgroundColor:activeBadge.unlocked?colors.accent:"rgba(255,255,255,0.30)"}} />
                </View>
              </View>
            )}
            {activeBadge.unlocked && <Text style={{fontSize:28,marginBottom:8}}>{"🏆"}</Text>}
            <TouchableOpacity onPress={()=>setBadgeModalVisible(false)} style={{paddingHorizontal:24,paddingVertical:10,borderRadius:14,backgroundColor:"rgba(255,255,255,0.10)"}}>
              <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#fff",fontSize:14}}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  // ─────────────── UPGRADE MODAL ───────────────
  const renderUpgradeModal = () => (
    <Modal visible={upgradeVisible} transparent animationType="fade" onRequestClose={()=>setUpgradeVisible(false)}>
      <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setUpgradeVisible(false)} />
        <View style={{width:"86%",backgroundColor:"rgba(20,20,22,0.96)",borderRadius:18,borderWidth:1,borderColor:"rgba(255,255,255,0.10)",padding:16}}>
          <Text style={{color:"#fff",fontFamily:"Montserrat_600SemiBold",fontSize:16,marginBottom:6}}>{t("goals_pro_unlock")}</Text>
          <Text style={{color:"rgba(255,255,255,0.78)",fontFamily:"Montserrat_500Medium",fontSize:13,lineHeight:18,marginBottom:14}}>{t("stat_pro_hint")}</Text>
          <TouchableOpacity onPress={()=>{setUpgradeVisible(false);openPremium();}} style={{backgroundColor:"#fff",borderRadius:14,paddingVertical:12,alignItems:"center",marginBottom:8}}>
            <Text style={{color:"#000",fontFamily:"Montserrat_600SemiBold"}}>{t("goals_pro_unlock")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={()=>setUpgradeVisible(false)} style={{paddingVertical:10,alignItems:"center"}}>
            <Text style={{color:"rgba(255,255,255,0.70)",fontFamily:"Montserrat_600SemiBold"}}>{t("stat_later")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─────────────── ZIELE MODAL ───────────────
  const renderGoalsModal = () => (
    <Modal visible={goalsModalVisible} transparent animationType="slide" onRequestClose={()=>setGoalsModalVisible(false)}>
      <View style={{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,0.5)"}}>
        <View style={{backgroundColor:colors.surface,borderTopLeftRadius:22,borderTopRightRadius:22,paddingTop:12,paddingBottom:insets.bottom+18,paddingHorizontal:18,borderWidth:1,borderColor:colors.borderLight,maxHeight:"85%"}}>
          <View style={{alignItems:"center",marginBottom:12}}><View style={{width:52,height:5,borderRadius:5,backgroundColor:"rgba(255,255,255,0.16)"}} /></View>
          <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:18}}>{"Meine Ziele"}</Text>
            <View style={{flexDirection:"row",gap:10,alignItems:"center"}}>
              <TouchableOpacity onPress={safeOpenGoalCreate} style={{paddingHorizontal:14,paddingVertical:8,borderRadius:999,backgroundColor:colors.accent}}>
                <Text style={{fontFamily:"Montserrat_600SemiBold",color:"#0B0B0C",fontSize:13}}>{"+ Neu"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>setGoalsModalVisible(false)}><X size={20} color={colors.textMuted} /></TouchableOpacity>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {goals.length===0 ? (
              <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:14,textAlign:"center",paddingVertical:24}}>{"Noch keine Ziele. Tippe auf + Neu."}</Text>
            ) : goals.map(g=>{
              const current = g.type==="minutesPerWeek"?monthMinutes:weeklyCount;
              const pct = Math.max(0,Math.min(1,(current||0)/(g.target||1)));
              return (
                <View key={g.id} style={{paddingVertical:14,borderBottomWidth:1,borderBottomColor:colors.borderLight}}>
                  <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:15,flex:1}}>{g.title||t("stat_goal_fallback")}</Text>
                    <View style={{flexDirection:"row",gap:4}}>
                      <TouchableOpacity
                        onPress={()=>{
                          setEditingGoal(g);
                          setNewGoalTitle(g.title||"");
                          setNewGoalType(g.type||"sessionsPerWeek");
                          setNewGoalTarget(String(g.target||3));
                          setGoalsModalVisible(false);
                          setTimeout(()=>setGoalCreateVisible(true),200);
                        }}
                        style={{padding:6}}
                      >
                        <Text style={{fontSize:15}}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async()=>{
                          try{
                            await removeUserGoal(g.id);
                            const gs = await getUserGoals();
                            setGoals(Array.isArray(gs)?gs:goals.filter(x=>x.id!==g.id));
                          }catch(_e){}
                        }}
                        style={{padding:6}}
                      >
                        <X size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{height:10,backgroundColor:colors.bar,borderRadius:999,overflow:"hidden"}}>
                    <View style={{height:10,width:`${Math.round(pct*100)}%`,backgroundColor:colors.barActive,borderRadius:999}} />
                  </View>
                  <Text style={{marginTop:6,fontFamily:"Montserrat_400Regular",color:colors.textDim,fontSize:12}}>{current} / {g.target}{g.type==="minutesPerWeek"?" Min":" Sessions"}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderGoalCreateModal = () => (
    <Modal visible={goalCreateVisible} transparent animationType="fade" onRequestClose={()=>setGoalCreateVisible(false)}>
      <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>{setGoalCreateVisible(false);}} />
        <View style={{width:"86%",backgroundColor:"rgba(20,20,22,0.96)",borderRadius:18,borderWidth:1,borderColor:"rgba(255,255,255,0.10)",padding:16}}>
          <Text style={{color:"#fff",fontFamily:"Montserrat_600SemiBold",fontSize:16,marginBottom:12}}>
            {editingGoal ? t("stat_edit_goal") : t("stat_new_goal")}
          </Text>
          <TextInput value={newGoalTitle} onChangeText={setNewGoalTitle} placeholder="Titel" placeholderTextColor="rgba(255,255,255,0.35)" style={{color:"#fff",borderWidth:1,borderColor:"rgba(255,255,255,0.10)",borderRadius:12,paddingHorizontal:12,paddingVertical:10,marginBottom:10,fontFamily:"Montserrat_500Medium"}} />
          <View style={{flexDirection:"row",gap:8,marginBottom:10}}>
            {[["sessionsPerWeek",t("sessions_per_week")],["minutesPerWeek",t("minutes_per_week")]].map(([key,label])=>(
              <TouchableOpacity key={key} onPress={()=>setNewGoalType(key)} style={{flex:1,paddingVertical:8,borderRadius:10,alignItems:"center",backgroundColor:newGoalType===key?colors.accent:"rgba(255,255,255,0.06)",borderWidth:1,borderColor:newGoalType===key?colors.accent:"rgba(255,255,255,0.10)"}}>
                <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:12,color:newGoalType===key?"#0B0B0C":colors.textMuted}}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{color:"rgba(255,255,255,0.70)",fontFamily:"Montserrat_600SemiBold",marginBottom:6,fontSize:13}}>{t("stat_goal_value")}</Text>
          <TextInput value={newGoalTarget} onChangeText={setNewGoalTarget} keyboardType="numeric" style={{color:"#fff",borderWidth:1,borderColor:"rgba(255,255,255,0.10)",borderRadius:12,paddingHorizontal:12,paddingVertical:10,marginBottom:14,fontFamily:"Montserrat_500Medium"}} />
          <TouchableOpacity onPress={async()=>{
            const v = Math.max(1,Number(newGoalTarget)||1);
            if (editingGoal) {
              await updateUserGoal(editingGoal.id, {title:newGoalTitle||t("goals_default_title"),type:newGoalType,target:v});
            } else {
              await addUserGoal({id:String(Date.now()),title:newGoalTitle||t("goals_default_title"),type:newGoalType,target:v,createdAt:Date.now(),isActive:true});
            }
            const gs = await getUserGoals(); setGoals(Array.isArray(gs)?gs:[]);
            setGoalCreateVisible(false); setGoalsModalVisible(false);
            setNewGoalTitle(""); setNewGoalTarget("3"); setEditingGoal(null);
          }} style={{backgroundColor:"#fff",borderRadius:14,paddingVertical:12,alignItems:"center"}}>
            <Text style={{color:"#000",fontFamily:"Montserrat_600SemiBold"}}>{t("save")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─────────────── EXPORT RANGE MODAL ───────────────
  const renderExportRangeModal = () => (
    <Modal visible={exportRangeVisible} transparent animationType="fade" onRequestClose={()=>setExportRangeVisible(false)}>
      <View style={{flex:1,justifyContent:"center",alignItems:"center"}}>
        <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(0,0,0,0.72)"}]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setExportRangeVisible(false)} />
        <View style={{width:"86%",backgroundColor:"rgba(20,20,22,0.96)",borderRadius:18,borderWidth:1,borderColor:"rgba(255,255,255,0.10)",padding:16}}>
          <Text style={{color:"#fff",fontFamily:"Montserrat_600SemiBold",fontSize:16,marginBottom:12}}>{t("stat_range_pick")}</Text>
          {[["7",t("last_7_days")],["30",t("last_30_days")],["90",t("last_90_days")],["all",t("all_time")]].map(([key,label])=>(
            <TouchableOpacity key={key} onPress={()=>setExportRangeKey(key)} style={{flexDirection:"row",alignItems:"center",paddingVertical:12,borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,0.07)"}}>
              <View style={{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:exportRangeKey===key?colors.accent:"rgba(255,255,255,0.30)",alignItems:"center",justifyContent:"center",marginRight:12}}>
                {exportRangeKey===key && <View style={{width:10,height:10,borderRadius:5,backgroundColor:colors.accent}} />}
              </View>
              <Text style={{color:"#fff",fontFamily:"Montserrat_500Medium",fontSize:14}}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={async()=>{
            setExportRangeVisible(false);
            const minTs = exportRangeKey==="all"?0:getRangeMinTs(Number(exportRangeKey)||30);
            await runCsvExport({minTs,maxTs:undefined});
          }} style={{backgroundColor:"#fff",borderRadius:14,paddingVertical:12,alignItems:"center",marginTop:14}}>
            <Text style={{color:"#000",fontFamily:"Montserrat_600SemiBold"}}>{t("export_btn")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─────────────── MAIN RENDER ───────────────
  // Avoid hook-order mismatch: always run hooks even while fonts load.
  if (!fontsLoaded) return <View style={{flex:1,backgroundColor:colors.bg}} />;

  return (
    <View style={{flex:1,backgroundColor:colors.bg}}>
      <StatusBar style="light" />

      <ScrollView contentContainerStyle={{paddingTop:insets.top+16,paddingHorizontal:24,paddingBottom:insets.bottom+24}} showsVerticalScrollIndicator={false}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <Image
            source={STILLMIND_LOGO}
            resizeMode="contain"
            style={{ width: 72, height: 72, opacity: 0.97 }}
          />
          <MinutesBubble floating={false} />
        </View>

        <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"}}>
          <View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",fontSize:40,color:colors.text,marginBottom:6}}>{t("stats_title")}</Text>
            <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,fontSize:14,lineHeight:18}}>{t("stats_sub")}</Text>
          </View>
          <View style={{gap:10,alignItems:"flex-end"}}>
            <TouchableOpacity onPress={runRefresh} activeOpacity={0.85} style={{width:44,height:44,borderRadius:16,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.borderLight,alignItems:"center",justifyContent:"center"}}>
              <Animated.View style={{transform:[{rotate:spin}]}}><RefreshCcw size={18} color={colors.text} /></Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setLayoutEditVisible(true)} activeOpacity={0.85} style={{width:44,height:44,borderRadius:16,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.borderLight,alignItems:"center",justifyContent:"center"}}>
              <NotebookPen size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Flammen-Hero */}
        {renderFlameHero()}

        {/* KI-Analyse Banner — immer sichtbar, vor allen Cards */}
        {renderKIAnalysisBanner()}

        {(cardOrder||DEFAULT_CARD_ORDER).map(id => {
          if (id==="overview") return <React.Fragment key={id}>{renderOverviewBlock()}</React.Fragment>;
          if (id==="logbook") return <React.Fragment key={id}>{renderLogbookCard()}</React.Fragment>;
          if (id==="goals") return <React.Fragment key={id}>{renderGoalsCard()}</React.Fragment>;
          if (id==="weeklyGoal") return <React.Fragment key={id}>{renderWeeklyGoalCard()}</React.Fragment>;
          if (id==="achievements") return <React.Fragment key={id}>{renderAchievementsBlock()}</React.Fragment>;
          if (id==="insights") return <React.Fragment key={id}>{renderInsightsBlock()}</React.Fragment>;
          if (id==="export") return <React.Fragment key={id}>{renderExportBlock()}</React.Fragment>;
          return null;
        })}
      </ScrollView>

      {renderLayoutEditor()}
      {renderUpgradeModal()}
      {renderGoalsModal()}
      {renderGoalCreateModal()}
      {renderLogbookModal()}
      {renderCategoryModal()}
      {renderBadgeModal()}
      {renderExportRangeModal()}

      {/* Day detail sheet */}
      <Modal visible={sheetVisible} transparent animationType="fade">
        <Pressable onPress={closeSheet} style={{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"flex-end"}}>
          <Animated.View style={{backgroundColor:colors.surface,borderTopLeftRadius:22,borderTopRightRadius:22,paddingTop:10,paddingBottom:insets.bottom+18,paddingHorizontal:18,borderWidth:1,borderColor:colors.borderLight,transform:[{translateY:sheetAnim.interpolate({inputRange:[0,1],outputRange:[380,0]})}]}}>
            <View style={{alignItems:"center",marginBottom:10}}><View style={{width:52,height:5,borderRadius:5,backgroundColor:"rgba(255,255,255,0.16)"}} /></View>
            <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text,fontSize:18,marginBottom:12}}>{t("sessions_word")}</Text>
            <View style={{marginTop:6}}>
              {selectedDayEntries.length===0 ? (
                <Text style={{fontFamily:"Montserrat_400Regular",color:colors.textMuted,paddingVertical:14}}>{"Keine Sessions an diesem Tag."}</Text>
              ) : selectedDayEntries.map((s,idx)=>(
                <View key={`${s.ts}-${idx}`} style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:12,borderBottomWidth:idx===selectedDayEntries.length-1?0:1,borderBottomColor:colors.borderLight}}>
                  <Text style={{width:64,fontFamily:"Montserrat_600SemiBold",color:colors.textMuted}}>{s.time}</Text>
                  <View style={{flex:1,paddingRight:10}}>
                    <Text style={{fontFamily:"Montserrat_600SemiBold",color:colors.text}} numberOfLines={1}>{s.title}</Text>
                    <Text style={{marginTop:2,fontFamily:"Montserrat_400Regular",color:colors.textDim,fontSize:12}} numberOfLines={1}>{moodEmoji(s.mood)}{s.note?`  •  ${s.note}`:""}</Text>
                  </View>
                  <Text style={{width:64,textAlign:"right",fontFamily:"Montserrat_600SemiBold",color:colors.textMuted}}>{formatDuration(s.durationSec)}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Modal>
      <CelebrationModal
        visible={weeklyCelebVisible}
        onClose={() => setWeeklyCelebVisible(false)}
        emoji="🎯"
        title={t("celeb_weekly_title")}
        subtitle={t("celeb_weekly_sub")}
        ctaLabel={t("celeb_weekly_cta")}
      />
      <UpgradePopup
        visible={upgradePopupVisible}
        onClose={() => setUpgradePopupVisible(false)}
        reason={upgradeReason}
      />
    </View>
  );
}
