import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { Search, Lock, Heart, Download, CheckCircle } from "lucide-react-native";
import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n, t } from "@/utils/i18n";
import MinutesBubble from "@/components/MinutesBubble";
import UpgradePopup from "@/components/UpgradePopup";
import CelebrationModal from "@/components/CelebrationModal";
import { getUserPlan, subscribeUserPlan, getSessionHistory, getReviewFlag, setReviewFlag, REVIEW_KEYS } from "@/utils/storage";
import * as StoreReview from "expo-store-review";
// Offline favorites — safe for Expo Go
let _offlineLib = null;
const _getOL = () => { if (!_offlineLib) try { _offlineLib = require("@/utils/offline-favorites"); } catch(_) {} return _offlineLib; };
const getOfflineFavorites = () => _getOL()?.getOfflineFavorites?.() ?? Promise.resolve([]);
const addOfflineFavorite = (id) => _getOL()?.addOfflineFavorite?.(id) ?? Promise.resolve();
const removeOfflineFavorite = (id) => _getOL()?.removeOfflineFavorite?.(id) ?? Promise.resolve();
const isOfflineFavorite = (id) => _getOL()?.isOfflineFavorite?.(id) ?? Promise.resolve(false);
const cacheAudioForSession = (id, url, cb) => _getOL()?.cacheAudioForSession?.(id, url, cb) ?? Promise.resolve();
const getCacheSizeMB = () => _getOL()?.getCacheSizeMB?.() ?? Promise.resolve(0);
let _audioLib = null;
const getAudioUrl = (id) => { if (!_audioLib) try { _audioLib = require("@/utils/audio-manager"); } catch(_) {} return _audioLib?.getAudioUrl?.(id) ?? null; };

const STILLMIND_LOGO = require("../../../../assets/brand/stillmind-logo-transparent.png");




const FILTERS = [
  { id: "all",      label: () => t("all")       },
  { id: "breath",   label: () => t("breathing") },
  { id: "programs", label: () => t("programs")  },
  { id: "learn",    label: () => t("knowledge") },
];

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { t: tFn } = useI18n();
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const BREATHING_EXERCISES = useMemo(() => [
  {
    id: "diaphragmatic",
    title: tFn("bib_breath_diaphragmatic_title"),
    tag: tFn("bib_breath_diaphragmatic_tag"),
    why: tFn("bib_breath_diaphragmatic_why"),
    steps: [tFn("bib_breath_diaphragmatic_step1"), tFn("bib_breath_diaphragmatic_step2"), tFn("bib_breath_diaphragmatic_step3")],
  },
  {
    id: "478",
    title: tFn("bib_breath_478_title"),
    tag: tFn("bib_breath_478_tag"),
    why: tFn("bib_breath_478_why"),
    caution: tFn("bib_breath_478_caution"),
    steps: [tFn("bib_breath_478_step1"), tFn("bib_breath_478_step2"), tFn("bib_breath_478_step3"), tFn("bib_breath_478_step4")],
  },
  {
    id: "box",
    title: "Box Breathing",
    tag: tFn("bib_breath_box_tag"),
    why: tFn("bib_breath_box_why"),
    steps: [tFn("bib_breath_box_step1"), tFn("bib_breath_box_step2"), tFn("bib_breath_box_step3"), tFn("bib_breath_box_step4"), tFn("bib_breath_box_step5")],
  },
  {
    id: "coherent",
    title: tFn("bib_breath_coherent_title"),
    tag: tFn("bib_breath_coherent_tag"),
    why: tFn("bib_breath_coherent_why"),
    steps: [tFn("bib_breath_coherent_step1"), tFn("bib_breath_coherent_step2"), tFn("bib_breath_coherent_step3")],
  },
  {
    id: "long_exhale",
    title: tFn("bib_breath_long_exhale_title"),
    tag: tFn("bib_breath_long_exhale_tag"),
    why: tFn("bib_breath_long_exhale_why"),
    steps: [tFn("bib_breath_long_exhale_step1"), tFn("bib_breath_long_exhale_step2"), tFn("bib_breath_long_exhale_step3")],
  },
  {
    id: "phys_sigh",
    title: tFn("bib_breath_phys_sigh_title"),
    tag: tFn("bib_breath_phys_sigh_tag"),
    why: tFn("bib_breath_phys_sigh_why"),
    steps: [
      tFn("bib_breath_phys_sigh_step1"),
      tFn("bib_breath_phys_sigh_step2"),
      tFn("bib_breath_phys_sigh_step3"),
      tFn("bib_breath_phys_sigh_step4"),
    ],
  },
  {
    id: "nostril",
    title: tFn("bib_breath_nostril_title"),
    tag: tFn("bib_breath_nostril_tag"),
    why: tFn("bib_breath_nostril_why"),
    steps: [
      tFn("bib_breath_nostril_step1"),
      tFn("bib_breath_nostril_step2"),
      tFn("bib_breath_nostril_step3b"),
      tFn("bib_breath_nostril_step4"),
    ],
  },
  {
    id: "pursed",
    title: tFn("bib_breath_pursed_title"),
    tag: tFn("bib_breath_pursed_tag"),
    why: tFn("bib_breath_pursed_why"),
    steps: [
      tFn("bib_breath_pursed_step1"), tFn("bib_breath_pursed_step2"), tFn("bib_breath_pursed_step3"),
    ],
  },
  {
    id: "counting",
    title: tFn("bib_breath_counting_title"),
    tag: tFn("bib_breath_counting_tag"),
    why: tFn("bib_breath_counting_why"),
    steps: [tFn("bib_breath_counting_step1"), tFn("bib_breath_counting_step2"), tFn("bib_breath_counting_step3")],
  },
  {
    id: "observe",
    title: tFn("bib_breath_observe_title"),
    tag: tFn("bib_breath_observe_tag"),
    why: tFn("bib_breath_observe_why"),
    steps: [tFn("bib_breath_observe_step1"), tFn("bib_breath_observe_step2"), tFn("bib_breath_observe_step3")],
  },
  ], [tFn]);

  const MINI_PROGRAMS = useMemo(() => [
  {
    id: "reset-7",
    title: tFn("bib_prog_reset7_title"),
    tag: tFn("bib_prog_reset7_tag"),
    why: tFn("bib_prog_reset7_why"),
    sessions: ["calm-1", "thoughts-1", "work-1", "emotion-1", "calm-2", "focus-1", "sleep-1"],
    steps: [
      tFn("bib_prog_reset7_step1"),
      tFn("bib_prog_reset7_step2"),
      tFn("bib_prog_reset7_step3"),
      tFn("bib_prog_reset7_step4"),
      tFn("bib_prog_reset7_step5"),
      tFn("bib_prog_reset7_step6"),
      tFn("bib_prog_reset7_step7"),
    ],
  },
  {
    id: "sleep-program",
    title: tFn("bib_prog_sleep_title"),
    tag: tFn("bib_prog_sleep_tag"),
    why: tFn("bib_prog_sleep_why"),
    sessions: ["sleep-1", "sleep-2"],
    steps: [tFn("bib_prog_sleep_step1"), tFn("bib_prog_sleep_step2"), tFn("bib_prog_sleep_step3")],
  },
  {
    id: "workday",
    title: tFn("bib_prog_workday_title"),
    tag: tFn("bib_prog_workday_tag"),
    why: tFn("bib_prog_workday_why"),
    sessions: ["work-1", "focus-1", "calm-1"],
    steps: [tFn("bib_prog_workday_step1"), tFn("bib_prog_workday_step2"), tFn("bib_prog_workday_step3")],
  },
  {
    id: "morning-start",
    title: tFn("bib_prog_morning_title"),
    tag: tFn("bib_prog_morning_tag"),
    why: tFn("bib_prog_morning_why"),
    sessions: ["calm-1", "focus-1", "work-1", "thoughts-1", "sleep-1"],
    steps: [
      tFn("bib_prog_morning_step1"),
      tFn("bib_prog_morning_step2"),
      tFn("bib_prog_morning_step3"),
      tFn("bib_prog_morning_step4"),
      tFn("bib_prog_morning_step5"),
    ],
  },
  {
    id: "emotion-regulation",
    title: tFn("bib_prog_emotion_title"),
    tag: tFn("bib_prog_emotion_tag"),
    why: tFn("bib_prog_emotion_why"),
    sessions: ["emotion-1", "calm-1", "thoughts-1"],
    steps: [
      tFn("bib_prog_emotion_step1"),
      tFn("bib_prog_emotion_step2"),
      tFn("bib_prog_emotion_step3"),
    ],
  },
  {
    id: "focus-week",
    title: tFn("bib_prog_focus_week_title"),
    tag: tFn("bib_prog_focus_tag"),
    why: tFn("bib_prog_focus_why"),
    sessions: ["focus-1", "work-1", "thoughts-1", "calm-1", "focus-1"],
    steps: [
      tFn("bib_prog_focus_step1"),
      tFn("bib_prog_focus_step2"),
      tFn("bib_prog_focus_step3"),
      tFn("bib_prog_focus_step4"),
      tFn("bib_prog_focus_step5"),
    ],
  },
  {
    id: "exam-stress",
    title: tFn("prog_exam_title"),
    tag: tFn("prog_exam_sub"),
    why: tFn("prog_exam_desc"),
    sessions: ["focus-1", "calm-1", "thoughts-1", "work-1", "focus-2"],
    steps: [
      tFn("prog_exam_s1"),
      tFn("prog_exam_s2"),
      tFn("prog_exam_s3"),
      tFn("prog_exam_s4"),
      tFn("prog_exam_s5"),
    ],
  },
  {
    id: "parent-pause",
    title: tFn("prog_parent_title"),
    tag: tFn("prog_parent_sub"),
    why: tFn("prog_parent_desc"),
    sessions: ["parent-1", "calm-1", "emotion-1", "parent-2", "calm-2"],
    steps: [
      tFn("prog_parent_s1"),
      tFn("prog_parent_s2"),
      tFn("prog_parent_s3"),
      tFn("prog_parent_s4"),
      tFn("prog_parent_s5"),
    ],
  },
  {
    id: "digital-detox",
    title: tFn("prog_digital_title"),
    tag: tFn("prog_digital_tag"),
    why: tFn("prog_digital_desc"),
    sessions: ["calm-1", "thoughts-1", "focus-1", "calm-2", "thoughts-2"],
    steps: [
      tFn("prog_digital_s1"),
      tFn("prog_digital_s2"),
      tFn("prog_digital_s3"),
      tFn("prog_digital_s4"),
      tFn("prog_digital_s5"),
    ],
  },
  {
    id: "conflict-prep",
    title: tFn("prog_conflict_title"),
    tag: tFn("prog_conflict_sub"),
    why: tFn("prog_conflict_desc"),
    sessions: ["emotion-1", "calm-1", "thoughts-1"],
    steps: [
      tFn("prog_conflict_s1"),
      tFn("prog_conflict_s2"),
      tFn("prog_conflict_s3"),
    ],
  },
  ], [tFn]);

  const KNOWLEDGE_CARDS = useMemo(() => [
  {
    id: "why60",
    title: tFn("bib_know_why60_title"),
    tag: tFn("bib_know_why60_tag"),
    body: tFn("bib_know_why60_body"),
  },
  {
    id: "stressloop",
    title: tFn("bib_know_stressloop_title"),
    tag: tFn("bib_know_stressloop_tag"),
    body: tFn("bib_know_stressloop_body"),
  },
  {
    id: "panic",
    title: tFn("bib_know_panic_title"),
    tag: tFn("bib_know_panic_tag"),
    body: tFn("bib_know_panic_body"),
  },
  {
    id: "habit",
    title: tFn("bib_know_habit_title"),
    tag: tFn("bib_know_habit_tag"),
    body: "60 Sekunden sind so kurz, dass dein Gehirn kaum Widerstand aufbaut. Genau das macht es zur Gewohnheit. Ein kleiner, verl\u00e4sslicher Schritt schl\u00e4gt gro\u00dfe Pl\u00e4ne, die du nicht durchziehst.",
  },
  {
    id: "vagus",
    title: tFn("bib_know_vagus_title"),
    tag: tFn("bib_know_vagus_tag"),
    body: tFn("bib_know_vagus_body"),
  },
  {
    id: "cortisol",
    title: tFn("bib_know_cortisol_title"),
    tag: tFn("bib_know_cortisol_tag"),
    body: tFn("bib_know_cortisol_body"),
  },
  {
    id: "breathscience",
    title: tFn("bib_know_breathscience_title"),
    tag: tFn("bib_know_breathscience_tag"),
    body: tFn("bib_know_breathscience_body"),
  },
  {
    id: "sleep-science",
    title: tFn("bib_know_sleep_title"),
    tag: tFn("bib_know_sleep_tag"),
    body: tFn("bib_know_sleep_body"),
  },
  {
    id: "hrv",
    title: tFn("bib_know_hrv_title"),
    tag: tFn("bib_know_hrv_tag"),
    body: tFn("bib_know_hrv_body"),
  },
  ], [tFn]);
  const { colors, isDark } = useStillMindTheme();
  const [plan, setPlan] = useState("free");
  const [upgradeReason, setUpgradeReason] = useState("bib_sessions");
  const [upgradePopupVisible, setUpgradePopupVisible] = useState(false);
  const openLockedPopup = (reason) => { setUpgradeReason(reason); setUpgradePopupVisible(true); };
  const [programProgress, setProgramProgress] = useState({});
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("breath");
  const [offlineFavs, setOfflineFavs] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailType, setDetailType] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [courseCelebVisible, setCourseCelebVisible] = useState(false);
  const [celebCourseTitle, setCelebCourseTitle] = useState("");

  const computeProgress = (history) => {
    const safe = Array.isArray(history) ? history : [];
    const progress = {};
    MINI_PROGRAMS.forEach(prog => {
      // Only count sessions that were explicitly started as part of this program
      const relevant = safe.filter(h =>
        h && h.type !== "end" &&
        typeof h.sessionId === "string" &&
        prog.sessions.includes(h.sessionId) &&
        h.programId === prog.id  // must have been started via this program
      );
      const uniqueDays = new Set(
        relevant.map(h => new Date(Number(h.timestamp || 0)).toDateString())
      );
      progress[prog.id] = Math.min(uniqueDays.size, prog.sessions.length);
    });
    return progress;
  };

  const refresh = useCallback(async () => {
    const [userPlan, hist, favs] = await Promise.all([
      getUserPlan(),
      getSessionHistory().catch(() => []),
      getOfflineFavorites().catch(() => []),
    ]);
    setPlan(userPlan);
    const h = Array.isArray(hist) ? hist : [];
    setProgramProgress(computeProgress(h));
    setOfflineFavs(Array.isArray(favs) ? favs : []);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const { DeviceEventEmitter } = require("react-native");

    const safeRefresh = async () => {
      if (!isMounted) return;
      await refresh();
    };

    safeRefresh();

    const unsubPlan = subscribeUserPlan(() => safeRefresh());
    const subCompleted = DeviceEventEmitter.addListener("stillmind:sessionCompleted", () => safeRefresh());

    return () => {
      isMounted = false;
      unsubPlan && unsubPlan();
      subCompleted && subCompleted.remove && subCompleted.remove();
    };
  }, [refresh]);

  // Re-load plan when tab gains focus
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Defined BEFORE fontsLoaded guard so useFocusEffect can call it
  const openDetail = useCallback((type, item) => {
    setDetailType(type);
    setDetailItem(item);
    setDetailVisible(true);
  }, []);

  // When navigated from Home with openProgram param, open that program's detail modal
  const { openProgram } = useLocalSearchParams();
  const handledOpenProgramRef = useRef(null); // track which program we already auto-opened
  useFocusEffect(
    useCallback(() => {
      if (!openProgram || !MINI_PROGRAMS.length) return;
      if (handledOpenProgramRef.current === openProgram) return; // already handled
      const prog = MINI_PROGRAMS.find((p) => p.id === openProgram);
      if (prog) {
        handledOpenProgramRef.current = openProgram;
        setActiveFilter("programs");
        setTimeout(() => openDetail("program", prog), 150);
      }
    }, [openProgram, openDetail])
  );

  const isOfflineAllowed = useCallback((sessionId, sessionType) => {
    if (plan === "free") return false;
    return true;
  }, [plan]);

  const handleToggleOfflineFav = useCallback(async (session) => {
    const sessionId = session.id || "";
    const sessionType = session.type || "session";
    if (!isOfflineAllowed(sessionId, sessionType)) {
      openLockedPopup("bib_sessions");
      return;
    }
    const isFav = offlineFavs.includes(sessionId);
    if (isFav) {
      await removeOfflineFavorite(sessionId);
      setOfflineFavs(prev => prev.filter(id => id !== sessionId));
    } else {
      await addOfflineFavorite(sessionId);
      setOfflineFavs(prev => [...prev, sessionId]);
      const category = session.category || sessionId.split("-")[0];
      const audioUrl = session.audioUrl || getAudioUrl(category) || getAudioUrl(sessionId);
      if (audioUrl) {
        setDownloadingId(sessionId);
        cacheAudioForSession(sessionId, audioUrl, (p) => {
          setDownloadProgress(prev => ({ ...prev, [sessionId]: p }));
        }).then(() => {
          setDownloadingId(id => id === sessionId ? null : id);
        }).catch(() => {
          setDownloadingId(id => id === sessionId ? null : id);
        });
      } else {
        // No audio to cache — mark as downloaded immediately (session has no music)
        setDownloadingId(null);
      }
    }
  }, [plan, offlineFavs, tFn]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const handleBreathPress = (exercise) => {
    if (plan === "free" && exercise.id !== "diaphragmatic") {
      openLockedPopup("bib_breathing");
      return;
    }
    router.push(`/session-run/breath?breathing=${exercise.id}&source=library`);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setDetailType(null);
    setDetailItem(null);
  };

  const handleProgramStart = (program) => {
    if (plan === "free" && program.id !== "reset-7") {
      openLockedPopup("bib_programs");
      return;
    }

    const sessions = Array.isArray(program && program.sessions ? program.sessions : null) ? program.sessions : [];
    if (!sessions.length) return;

    const done = programProgress[program.id] || 0;
    const nextIdx = Math.min(done, sessions.length - 1);
    const nextSessionId = sessions[nextIdx];

    // Review-Trigger bei Programm-Abschluss (letzte Session)
    if (done + 1 >= sessions.length) {
      (async () => {
        try {
          const asked = await getReviewFlag(REVIEW_KEYS.PROGRAM);
          if (!asked) {
            await setReviewFlag(REVIEW_KEYS.PROGRAM);
            const can = await StoreReview.hasAction();
            if (can) setTimeout(() => StoreReview.requestReview(), 3000);
          }
        } catch (_) {}
      })();
    }

    closeDetail();
    router.push(`/session-run/${nextSessionId}?source=library&program=${program.id}&day=${nextIdx + 1}`);
  };

  const q = query.trim().toLowerCase();

  const filteredBreaths = BREATHING_EXERCISES.filter((e) => {
    if (!q) return true;
    const searchStr = `${e.title} ${e.tag} ${e.why} ${(e.steps || []).join(" ")}`.toLowerCase();
    return searchStr.includes(q);
  });

  const BREATH_ACCENT  = "#60A5FA";
  const PROGRAM_ACCENT = "#8B5CF6";
  const LEARN_ACCENT   = "#34D399";
  const SESSION_ACCENT = "#F59E0B";

  const accentFor = (filter) => {
    if (filter === "breath")   return BREATH_ACCENT;
    if (filter === "programs") return PROGRAM_ACCENT;
    if (filter === "learn")    return LEARN_ACCENT;
    return SESSION_ACCENT;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image
            source={STILLMIND_LOGO}
            resizeMode="contain"
            style={{ width: 72, height: 72, opacity: 0.97 }}
          />
          <MinutesBubble floating={false} />
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 40, color: colors.text, marginBottom: 6 }}>
            {tFn("library_title")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary }}>
            {plan === "free" ? tFn("bib_free_sub") : tFn("library_unlocked")}
          </Text>
        </View>

        {plan === "free" && (
          <TouchableOpacity
            onPress={() => openLockedPopup("bib_sessions")}
            activeOpacity={0.85}
            style={{ marginHorizontal: 24, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: "rgba(205,185,138,0.3)", backgroundColor: "rgba(205,185,138,0.07)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Text style={{ fontSize: 22 }}>🔓</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#CDB98A" }}>{tFn("bib_unlock_all_title")}</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{tFn("bib_unlock_all_sub")}</Text>
            </View>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#CDB98A" }}>Pro →</Text>
          </TouchableOpacity>
        )}

        <View style={{ paddingHorizontal: 24 }}>
          <View style={{
            flexDirection: "row", alignItems: "center",
            borderRadius: 16,
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
            paddingHorizontal: 14, paddingVertical: 11,
            gap: 10, marginBottom: 18,
          }}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tFn("search_placeholder")}
              placeholderTextColor={isDark ? "rgba(255,255,255,0.30)" : "#bbb"}
              style={{ flex: 1, fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text }}
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 26, paddingHorizontal: 24 }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.id;
            const accent = accentFor(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: active ? accent : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
                  borderRadius: 12,
                  paddingHorizontal: 16, paddingVertical: 9,
                  borderWidth: 1,
                  borderColor: active ? accent : "transparent",
                }}
              >
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: active ? "#fff" : colors.text }}>
                  {typeof f.label === "function" ? f.label() : f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ATEMUBUNGEN */}
        {(activeFilter === "breath" || activeFilter === "all") && (
          <View style={{ marginBottom: 30, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: BREATH_ACCENT }} />
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text }}>
                {tFn("breathing")}
              </Text>
            </View>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginLeft: 13 }}>
              {tFn("bib_breath_section_sub")}
            </Text>

            {/* ── Einschlaf-Modus Hero-Karte — Feature des Monats ── */}
            {!query.trim() && (
              <View style={{ marginBottom: 20, position: "relative" }}>

                {/* Feature-des-Monats Badge */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(167,139,250,0.12)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(167,139,250,0.30)" }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#A78BFA" }} />
                    <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 11, color: "#C4B5FD", letterSpacing: 1.5, textTransform: "uppercase" }}>{t("feat_month_badge")}</Text>
                    <Text style={{ fontSize: 12 }}>✦</Text>
                  </View>
                </View>

                <View style={{ position: "relative" }}>

                  {/* Aktionsbubble */}
                  <View style={{ position: "absolute", top: -14, right: -14, width: 104, height: 104, borderRadius: 52, backgroundColor: "#6D28D9", alignItems: "center", justifyContent: "center", borderWidth: 3.5, borderColor: "#0A0A18", zIndex: 10, transform: [{ rotate: "-8deg" }], shadowColor: "#7C3AED", shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10 }}>
                    <Text style={{ fontSize: 9, fontFamily: "Montserrat_700Bold", color: "#FDE68A", letterSpacing: 1.5 }}>{t("feat_month_gratis")}</Text>
                    <Text style={{ fontSize: 26 }}>🌙</Text>
                    <Text style={{ fontSize: 9, fontFamily: "Montserrat_700Bold", color: "#E9D5FF" }}>{t("feat_month_until")}</Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      router.push("/session-run/breath?breathing=sleep_wind&source=library");
                    }}
                    style={{ borderRadius: 22, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(139,92,246,0.45)", backgroundColor: "#12112A" }}
                  >
                    {/* Akzentstreifen oben */}
                    <View style={{ height: 3, backgroundColor: "#7C3AED", opacity: 0.9 }} />

                    <View style={{ padding: 20 }}>

                      {/* Titel-Zeile */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12, paddingRight: 76 }}>
                        <View style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: "rgba(139,92,246,0.18)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(139,92,246,0.45)" }}>
                          <Text style={{ fontSize: 30 }}>🌙</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 20, color: "#fff", lineHeight: 24 }}>{tFn("run_breath_sleep_title")}</Text>
                          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "#A78BFA", marginTop: 3 }}>{tFn("feat_month_premium_only")}</Text>
                        </View>
                      </View>

                      {/* Sterne + Rating */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <Text style={{ fontSize: 12 }}>⭐⭐⭐⭐⭐</Text>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t("feat_month_rating")}</Text>
                      </View>

                      {/* Beschreibung */}
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 21, marginBottom: 14 }}>{tFn("bib_sleep_hero_teaser")}</Text>

                      {/* Chips */}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                        {[t("feat_month_chip_1"), t("feat_month_chip_2"), t("feat_month_chip_3")].map((chip, i) => (
                          <View key={i} style={{ backgroundColor: "rgba(139,92,246,0.14)", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.32)" }}>
                            <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: "rgba(255,255,255,0.82)" }}>{chip}</Text>
                          </View>
                        ))}
                      </View>

                      {/* Fortschrittsbalken Aktion */}
                      <View style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 10, color: "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>{t("feat_month_action")}</Text>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 10, color: "#A78BFA", letterSpacing: 0.5 }}>{t("feat_month_action_until")}</Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: "rgba(139,92,246,0.15)", borderRadius: 10, overflow: "hidden" }}>
                          <View style={{ height: 5, width: "68%", backgroundColor: "#7C3AED", borderRadius: 10 }} />
                        </View>
                      </View>

                      {/* CTA */}
                      <View style={{ backgroundColor: "#6D28D9", borderRadius: 16, paddingVertical: 15, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.35)" }}>
                        <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 15, color: "#fff" }}>{t("feat_month_cta")}</Text>
                      </View>

                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.28)", textAlign: "center", marginTop: 10 }}>{t("feat_month_footer")}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {filteredBreaths.map((e) => {
              const AKTION_GRATIS = ["diaphragmatic", "sleep-wind-down"];
              const locked = plan === "free" && !AKTION_GRATIS.includes(e.id);
              return (
                <TouchableOpacity
                  key={e.id}
                  onPress={() => handleBreathPress(e)}
                  activeOpacity={0.88}
                  style={{
                    borderRadius: 20,
                    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : colors.surface,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border,
                    padding: 18,
                    marginBottom: 12,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: BREATH_ACCENT, opacity: locked ? 0.3 : 0.7 }} />
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 17, color: colors.text, marginBottom: 3 }}>
                        {e.title}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: BREATH_ACCENT, opacity: 0.7 }} />
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: colors.textSecondary }}>
                          {e.tag}
                        </Text>
                      </View>
                    </View>
                    {locked ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(96,165,250,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(96,165,250,0.20)" }}>
                        <Lock size={13} color={BREATH_ACCENT} />
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: BREATH_ACCENT }}>Pro</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {(
                          <TouchableOpacity
                            onPress={(ev) => { ev.stopPropagation?.(); handleToggleOfflineFav(e); }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: offlineFavs.includes(e.id) ? "rgba(96,165,250,0.20)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: offlineFavs.includes(e.id) ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.08)" }}
                          >
                            {downloadingId === e.id
                              ? <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: BREATH_ACCENT }}>{Math.round((downloadProgress[e.id] || 0) * 100)}%</Text>
                              : offlineFavs.includes(e.id)
                                ? <CheckCircle size={16} color={BREATH_ACCENT} />
                                : <Download size={16} color="rgba(255,255,255,0.45)" />
                            }
                          </TouchableOpacity>
                        )}
                        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(96,165,250,0.12)", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ fontSize: 16 }}>🫁</Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 12 }}>
                    {e.why}
                  </Text>
                  {e.caution && (
                    <View style={{ padding: 10, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.08)", borderWidth: 1, borderColor: "rgba(245,158,11,0.20)", marginBottom: 12 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#F59E0B", lineHeight: 17 }}>⚠️ {e.caution}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {(e.steps || []).map((step, i) => (
                      <View key={i} style={{ backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.text, opacity: 0.85 }}>{step}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
            {filteredBreaths.length === 0 && (
              <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: colors.textSecondary, textAlign: "center", paddingVertical: 14 }}>
                Keine Atemübungen gefunden.
              </Text>
            )}
          </View>
        )}

        {/* MINI-PROGRAMME */}
        {(activeFilter === "programs" || activeFilter === "all") && (
          <View style={{ marginBottom: 30, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: PROGRAM_ACCENT }} />
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text }}>
                {tFn("programs")}
              </Text>
            </View>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginLeft: 13 }}>
              {tFn("bib_prog_section_sub")}
            </Text>

            {MINI_PROGRAMS.filter((p) => {
              if (!q) return true;
              return `${p.title} ${p.tag} ${p.why} ${(p.steps||[]).join(" ")}`.toLowerCase().includes(q);
            }).map((p) => {
              const locked = plan === "free" && p.id !== "reset-7";
              const done = programProgress[p.id] || 0;
              const total = p.sessions.length;
              const pct = total > 0 ? done / total : 0;
              const completed = done >= total && total > 0;
              const started = done > 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => openDetail("program", p)}
                  activeOpacity={0.88}
                  style={{
                    borderRadius: 20,
                    backgroundColor: isDark ? "rgba(139,92,246,0.06)" : colors.surface,
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(139,92,246,0.18)" : colors.border,
                    padding: 18,
                    marginBottom: 12,
                    overflow: "hidden",
                  }}
                >
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: PROGRAM_ACCENT, opacity: locked ? 0.3 : 0.7 }} />
                  {!locked && pct > 0 && (
                    <View style={{ position: "absolute", top: 2, left: 0, height: 2,
                      backgroundColor: completed ? "#34D399" : PROGRAM_ACCENT,
                      width: `${Math.round(pct * 100)}%`, opacity: 0.9 }} />
                  )}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 17, color: colors.text, marginBottom: 3 }}>{p.title}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 20, height: 2, borderRadius: 1, backgroundColor: PROGRAM_ACCENT, opacity: 0.7 }} />
                        <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: colors.textSecondary }}>{p.tag}</Text>
                      </View>
                    </View>
                    {locked ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(139,92,246,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(139,92,246,0.20)" }}>
                        <Lock size={13} color={PROGRAM_ACCENT} />
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 11, color: PROGRAM_ACCENT }}>Pro</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {(p.sessions || []).length > 0 && (
                          <TouchableOpacity
                            onPress={(ev) => {
                              ev.stopPropagation?.();
                              // Cache all sessions of the program
                              (p.sessions || []).forEach(sid => {
                                const cat = sid.split("-")[0];
                                handleToggleOfflineFav({ id: sid, category: cat, type: "program" });
                              });
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: (p.sessions || []).every(sid => offlineFavs.includes(sid)) ? "rgba(139,92,246,0.20)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: (p.sessions || []).every(sid => offlineFavs.includes(sid)) ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.08)" }}
                          >
                            {(p.sessions || []).every(sid => offlineFavs.includes(sid))
                              ? <CheckCircle size={14} color={PROGRAM_ACCENT} />
                              : <Download size={14} color="rgba(255,255,255,0.45)" />
                            }
                          </TouchableOpacity>
                        )}
                        <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
                          backgroundColor: completed ? "rgba(52,211,153,0.12)" : started ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.06)",
                          borderWidth: 1, borderColor: completed ? "rgba(52,211,153,0.30)" : "rgba(139,92,246,0.20)" }}>
                          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 10, color: completed ? "#34D399" : PROGRAM_ACCENT }}>
                            {completed ? "✓ Fertig" : started ? `Tag ${done}/${total}` : `${total} Tage`}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: !locked && started ? 10 : 0 }}>{p.why}</Text>
                  {!locked && started && (
                    <View style={{ height: 4, backgroundColor: "rgba(139,92,246,0.12)", borderRadius: 999, overflow: "hidden" }}>
                      <View style={{ height: 4, width: `${Math.round(pct * 100)}%`,
                        backgroundColor: completed ? "#34D399" : PROGRAM_ACCENT, borderRadius: 999 }} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* WISSEN */}
        {(activeFilter === "learn" || activeFilter === "all") && (
          <View style={{ marginBottom: 30, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: LEARN_ACCENT }} />
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text }}>
                {tFn("knowledge")}
              </Text>
            </View>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginLeft: 13 }}>
              {tFn("bib_know_section_sub")}
            </Text>

            {KNOWLEDGE_CARDS.filter((k) => {
              if (!q) return true;
              return `${k.title} ${k.tag} ${k.body}`.toLowerCase().includes(q);
            }).map((k) => (
              <TouchableOpacity
                key={k.id}
                onPress={() => openDetail("knowledge", k)}
                activeOpacity={0.88}
                style={{
                  borderRadius: 20,
                  backgroundColor: isDark ? "rgba(52,211,153,0.04)" : colors.surface,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(52,211,153,0.14)" : colors.border,
                  padding: 18,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: LEARN_ACCENT, opacity: 0.6 }} />
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(52,211,153,0.12)", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16 }}>
                      {k.id === "why60" ? "\u26a1" : k.id === "stressloop" ? "🔄" : k.id === "panic" ? "🧘" : "🌱"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: colors.text, marginBottom: 2 }}>{k.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: LEARN_ACCENT, opacity: 0.7 }} />
                      <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 11, color: colors.textSecondary }}>{k.tag}</Text>
                    </View>
                  </View>
                </View>
                <Text numberOfLines={3} style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                  {k.body}
                </Text>
                <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: LEARN_ACCENT }}>{tFn("bib_read_more")}</Text>
                  <Text style={{ fontSize: 12, color: LEARN_ACCENT }}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Offline-Favoriten ─────────────────────────────── */}
        {(plan === "pro" || plan === "lifetime") && offlineFavs.length > 0 && (
          <View style={{ marginBottom: 30, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <View style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: "#F59E0B" }} />
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: colors.text }}>
                Offline
              </Text>
            </View>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginLeft: 13 }}>
              Gespeicherte Sessions – auch ohne Internet verfügbar.
            </Text>
            {offlineFavs.map((sessionId) => {
              const isDownloading = downloadingId === sessionId;
              const progress = downloadProgress[sessionId] || 0;
              return (
                <View key={sessionId} style={{
                  flexDirection: "row", alignItems: "center", gap: 12,
                  backgroundColor: "rgba(245,158,11,0.06)", borderRadius: 16,
                  paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
                  borderWidth: 1, borderColor: "rgba(245,158,11,0.18)",
                }}>
                  <Text style={{ fontSize: 18 }}>📥</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>{sessionId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Text>
                    {isDownloading && (
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(245,158,11,0.15)", marginTop: 5, overflow: "hidden" }}>
                        <View style={{ height: 3, width: `${Math.round(progress * 100)}%`, backgroundColor: "#F59E0B", borderRadius: 2 }} />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleToggleOfflineFav({ id: sessionId, category: sessionId.split("-")[0] })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Heart size={18} color="#F59E0B" fill="#F59E0B" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal visible={detailVisible} transparent animationType="slide" onRequestClose={closeDetail}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Pressable style={{ flex: 1 }} onPress={closeDetail} />
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            maxHeight: "82%",
            borderWidth: 1, borderColor: colors.border,
            shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: -6 },
            elevation: 16,
          }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" }} />
            </View>
            <View style={{ height: 2, marginHorizontal: 20, borderRadius: 1, backgroundColor: detailType === "program" ? PROGRAM_ACCENT : LEARN_ACCENT, opacity: 0.7, marginBottom: 2 }} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 28 }}
            >
              {detailItem && detailType === "program" && (() => {
                const done = programProgress[detailItem.id] || 0;
                const total = (detailItem.steps || []).length;
                const completed = done >= total && total > 0;
                const pct = total > 0 ? done / total : 0;
                const nextDay = completed ? total - 1 : done;

                return (
                  <View>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 24, color: colors.text, marginBottom: 4 }}>{detailItem.title}</Text>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: PROGRAM_ACCENT, marginBottom: 12 }}>{detailItem.tag}</Text>
                    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 18 }}>{detailItem.why}</Text>

                    <View style={{ marginBottom: 22 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }}>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: colors.text }}>
                          {completed ? tFn("bib_prog_completed") : done === 0 ? tFn("bib_prog_not_started") : tFn("bib_prog_day_of", {done, total})}
                        </Text>
                        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: completed ? "#34D399" : PROGRAM_ACCENT }}>
                          {Math.round(pct * 100)}%
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: "rgba(139,92,246,0.12)", borderRadius: 999, overflow: "hidden" }}>
                        <View style={{ height: 6, width: `${Math.round(pct * 100)}%`,
                          backgroundColor: completed ? "#34D399" : PROGRAM_ACCENT, borderRadius: 999 }} />
                      </View>
                    </View>

                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: colors.text, marginBottom: 12 }}>{tFn("bib_prog_dayplan")}</Text>
                    {(detailItem.steps || []).map((step, i) => {
                      const isDone = i < done;
                      const isNext = i === nextDay && !completed;
                      const isFuture = !isDone && !isNext;
                      return (
                        <View key={i} style={{
                          flexDirection: "row", alignItems: "flex-start", gap: 12,
                          marginBottom: 10,
                          opacity: isDone ? 0.42 : isFuture ? 0.50 : 1,
                        }}>
                          <View style={{
                            width: 30, height: 30, borderRadius: 9,
                            alignItems: "center", justifyContent: "center",
                            flexShrink: 0, marginTop: 2,
                            backgroundColor: isDone ? "rgba(52,211,153,0.15)" : isNext ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.05)",
                            borderWidth: 1.5,
                            borderColor: isDone ? "rgba(52,211,153,0.40)" : isNext ? PROGRAM_ACCENT : "rgba(255,255,255,0.10)",
                          }}>
                            {isDone
                              ? <Text style={{ fontSize: 13, color: "#34D399" }}>✓</Text>
                              : <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12,
                                  color: isNext ? PROGRAM_ACCENT : "rgba(255,255,255,0.28)" }}>{i + 1}</Text>
                            }
                          </View>
                          <View style={{ flex: 1, paddingTop: 2 }}>
                            {isNext && (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: PROGRAM_ACCENT }} />
                                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: PROGRAM_ACCENT, letterSpacing: 0.8 }}>
                                  {tFn("bib_prog_next")}
                                </Text>
                              </View>
                            )}
                            <Text style={{
                              fontFamily: isNext ? "Montserrat_500Medium" : "Montserrat_400Regular",
                              fontSize: 14, lineHeight: 20,
                              color: isDone ? colors.textSecondary : isNext ? colors.text : "rgba(255,255,255,0.45)",
                              textDecorationLine: isDone ? "line-through" : "none",
                            }}>{step}</Text>
                          </View>
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => handleProgramStart(detailItem)}
                      activeOpacity={0.88}
                      style={{
                        marginTop: 18,
                        backgroundColor: completed ? "rgba(52,211,153,0.12)" : PROGRAM_ACCENT,
                        borderRadius: 16, paddingVertical: 14, alignItems: "center",
                        borderWidth: completed ? 1 : 0,
                        borderColor: completed ? "rgba(52,211,153,0.35)" : "transparent",
                      }}
                    >
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: completed ? "#34D399" : "#fff" }}>
                        {completed ? tFn("bib_prog_done") : done === 0 ? tFn("bib_prog_start") : tFn("bib_prog_continue", {n: done + 1})}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {detailItem && detailType === "knowledge" && (
                <View>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(52,211,153,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                    <Text style={{ fontSize: 22 }}>
                      {detailItem.id === "why60" ? "\u26a1" : detailItem.id === "stressloop" ? "🔄" : detailItem.id === "panic" ? "🧘" : "🌱"}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 24, color: colors.text, marginBottom: 4 }}>{detailItem.title}</Text>
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: LEARN_ACCENT, marginBottom: 18 }}>{detailItem.tag}</Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 15, color: colors.textSecondary, lineHeight: 24 }}>{detailItem.body}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <CelebrationModal
        visible={courseCelebVisible}
        onClose={() => setCourseCelebVisible(false)}
        emoji="📚"
        title={tFn("celeb_course_title")}
        subtitle={`${celebCourseTitle}\n${tFn("celeb_course_sub")}`}
        ctaLabel={tFn("celeb_course_cta")}
      />
    <UpgradePopup
        visible={upgradePopupVisible}
        onClose={() => setUpgradePopupVisible(false)}
        reason={upgradeReason}
      />
    </View>
  );
}
