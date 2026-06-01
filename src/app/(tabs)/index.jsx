import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  Animated,
  PanResponder,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";

import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";
import MinutesBubble from "@/components/MinutesBubble";
import {
  getSessionHistory,
  getUserPlan,
  canStartSession,
  getFavoriteFocusModes,
  getUserPreferences,
  getWeeklyResetsCount,
  getUserName,
  getDailyStreak,
  getStreakFreezeData,
  syncStreakFreezes,
  useStreakFreeze,
  getReviewFlag,
  setReviewFlag,
  REVIEW_KEYS,
  incrementAppLaunchCount,
} from "@/utils/storage";
import * as StoreReview from "expo-store-review";
import { getSessions, getCategories } from "@/data/sessions-index";
// Offline favorites — safe for Expo Go
let _offlineLib = null;
const _getOL = () => { if (!_offlineLib) try { _offlineLib = require("@/utils/offline-favorites"); } catch(_) {} return _offlineLib; };
const getOfflineFavorites = () => _getOL()?.getOfflineFavorites?.() ?? Promise.resolve([]);
const addOfflineFavorite = (id) => _getOL()?.addOfflineFavorite?.(id) ?? Promise.resolve();
const removeOfflineFavorite = (id) => _getOL()?.removeOfflineFavorite?.(id) ?? Promise.resolve();
const cacheAudioForSession = (id, url, cb) => _getOL()?.cacheAudioForSession?.(id, url, cb) ?? Promise.resolve();
let _audioLib = null;
const getAudioUrl = (id) => { if (!_audioLib) try { _audioLib = require("@/utils/audio-manager"); } catch(_) {} return _audioLib?.getAudioUrl?.(id) ?? null; };
import { canUseSOS } from "@/utils/access";

const STILLMIND_LOGO = require("../../../assets/brand/stillmind-logo-transparent.png");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const [challengeDays, setChallengeDays] = useState(0);
  const [activePrograms, setActivePrograms] = useState([]);
  const theme = useStillMindTheme();

  const colorsObj = theme.colors || theme || {};
  const isDark = typeof theme.isDark === "boolean" ? theme.isDark : true;

  const BG = colorsObj.background || "#0A0A0A";
  const PRIMARY = colorsObj.primary || "#B9AC98";
  const TEXT = colorsObj.textPrimary || colorsObj.text || "#FFFFFF";
  const MUTED =
    colorsObj.textSecondary || colorsObj.muted || "rgba(255,255,255,0.65)";

  const [sessionHistory, setSessionHistory] = useState([]);
  const [plan, setPlan] = useState("free");
  const [favoriteModes, setFavoriteModes] = useState([]);
  const [userPreferences, setUserPreferences] = useState([]);
  const [weeklyStreak, setWeeklyStreak] = useState(0);
  const [userName, setUserNameState] = useState("");
  const [dailyStreak, setDailyStreak] = useState(0);
  const [freezeData, setFreezeData] = useState({ freezesLeft: 0, usedDates: [] });
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [whatsNewVisible, setWhatsNewVisible] = useState(false);
  const [preReviewVisible, setPreReviewVisible] = useState(false);
  const [sessionLimitVisible, setSessionLimitVisible] = useState(false);
  const [offlineFavs, setOfflineFavs] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [updatePopupVisible, setUpdatePopupVisible] = useState(false);

  // Swipe-to-close für Neuigkeiten Modal
  const whatsNewTranslateY = React.useRef(new Animated.Value(0)).current;
  const whatsNewPanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) whatsNewTranslateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          Animated.timing(whatsNewTranslateY, { toValue: 600, duration: 250, useNativeDriver: true }).start(() => {
            setWhatsNewVisible(false);
            whatsNewTranslateY.setValue(0);
          });
        } else {
          Animated.spring(whatsNewTranslateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const APP_VERSION = "1.0.3";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const suffix = userName ? `, ${userName}` : "";

    if (h >= 5 && h < 11) return `${t("greeting_morning")}${suffix}`;
    if (h >= 11 && h < 14) return `${t("greeting_afternoon")}${suffix}`;
    if (h >= 14 && h < 18) return `${t("greeting_afternoon")}${suffix}`;
    if (h >= 18 && h < 22) return `${t("greeting_evening")}${suffix}`;
    return `${t("greeting_night")}${suffix}`;
  }, [t, userName]);

  const greetingSubtext = useMemo(() => {
    const h = new Date().getHours();

    if (weeklyStreak >= 5) {
      return `${t("sessions_this_week").replace("{{n}}", weeklyStreak)} ${t("home_streak_on_fire")}`;
    }
    if (weeklyStreak >= 3) {
      return `${t("sessions_this_week").replace("{{n}}", weeklyStreak)} ${t("home_streak_good")}`;
    }
    if (weeklyStreak === 1) {
      return (
        t("sessions_this_week").replace("{{n}}", "1") + " " + t("home_streak_continue")
      );
    }
    if (h >= 5 && h < 11) return t("home_sub_morning");
    if (h >= 14 && h < 18) return t("home_sub_afternoon");
    if (h >= 18 && h < 22) return t("home_sub_evening");
    if (h >= 22 || h < 5) return t("home_sub_night");
    return t("home_sub_default");
  }, [t, weeklyStreak]);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const recommendedSessions = useMemo(() => {
    const all = getSessions();
    if (all.length === 0) return [];

    const prefToCategory = {
      [t("mode_calm")]: "calm",
      [t("mode_sleep")]: "sleep",
      [t("mode_focus")]: "focus",
      [t("mode_emotion")]: "emotion",
      [t("sos_scenario_anxiety_label")]: "emotion",
    };

    const prefs = Array.isArray(userPreferences) ? userPreferences : [];
    const preferredCategoryIds = prefs
      .map((p) => prefToCategory[String(p || "").trim()])
      .filter(Boolean);

    const h = Array.isArray(sessionHistory) ? sessionHistory : [];
    const sessionAgg = new Map();
    const modeAgg = new Map();
    const tried = new Set();

    const moodToScore = (m) => {
      if (m === "better") return 1;
      if (m === "same") return 0;
      if (m === "worse") return -1;
      return 0;
    };

    for (const e of h) {
      const sid = e && e.sessionId;
      if (sid) tried.add(sid);

      const ms = moodToScore(e && e.mood);
      const hasMood =
        typeof (e && e.mood) === "string" &&
        ["better", "same", "worse"].includes(e.mood);

      if (hasMood && sid) {
        const cur = sessionAgg.get(sid) || { sum: 0, count: 0 };
        cur.sum += ms;
        cur.count += 1;
        sessionAgg.set(sid, cur);
      }

      if (hasMood && e && e.mode) {
        const cur = modeAgg.get(e.mode) || { sum: 0, count: 0 };
        cur.sum += ms;
        cur.count += 1;
        modeAgg.set(e.mode, cur);
      }
    }

    const avg = (agg, key) => {
      const v = agg.get(key);
      if (!v || !v.count) return null;
      return v.sum / v.count;
    };

    const pool =
      preferredCategoryIds.length > 0
        ? all.filter((s) => preferredCategoryIds.includes(s && s.category))
        : all;

    const candidates = pool.length > 0 ? pool : all;

    const scored = candidates
      .map((s) => {
        const sid = s && s.id;
        const sessionScore = sid ? avg(sessionAgg, sid) : null;
        const modeScore = s && s.mode ? avg(modeAgg, s.mode) : null;
        const isUntried = sid ? !tried.has(sid) : false;

        // Tageszeit-Score
        const hour = new Date().getHours();
        const cat = s && s.category;
        let timeScore = 0;
        if (hour >= 5 && hour < 11) {
          if (cat === "focus" || cat === "calm") timeScore = 0.3;
          if (cat === "work") timeScore = 0.2;
        } else if (hour >= 11 && hour < 14) {
          if (cat === "work" || cat === "focus") timeScore = 0.3;
        } else if (hour >= 14 && hour < 18) {
          if (cat === "focus" || cat === "calm") timeScore = 0.2;
          if (cat === "emotion") timeScore = 0.1;
        } else if (hour >= 18 && hour < 22) {
          if (cat === "emotion" || cat === "calm") timeScore = 0.3;
          if (cat === "thoughts") timeScore = 0.2;
        } else {
          if (cat === "sleep") timeScore = 0.4;
          if (cat === "calm") timeScore = 0.2;
        }

        let score = timeScore;
        if (isUntried) score += 0.35;
        if (typeof sessionScore === "number") score += sessionScore * 1.0;
        else if (typeof modeScore === "number") score += modeScore * 0.6;

        return { s, score, isUntried, sessionScore, modeScore };
      })
      .sort((a, b) => b.score - a.score);

    const picked = [];
    const pickedIds = new Set();

    const untriedExists = scored.some((x) => x.isUntried);

    if (untriedExists) {
      const firstUntried = scored.find((x) => x.isUntried);
      if (firstUntried && firstUntried.s && firstUntried.s.id) {
        picked.push(firstUntried.s);
        pickedIds.add(firstUntried.s.id);
      }
    }

    for (const x of scored) {
      if (picked.length >= 3) break;

      const id = x && x.s && x.s.id;
      if (!id || pickedIds.has(id)) continue;

      picked.push(x.s);
      pickedIds.add(id);
    }

    if (picked.length === 0) return all.slice(0, 3);
    return picked.slice(0, 3);
  }, [sessionHistory, userPreferences, t]);

  const recommendedWhyText = useMemo(() => {
    const prefs = Array.isArray(userPreferences) ? userPreferences : [];
    const h = Array.isArray(sessionHistory) ? sessionHistory : [];
    const hasMood = h.some((e) => typeof (e && e.mood) === "string");
    const hasPrefs = prefs.length > 0;

    if (hasMood) return t("recommended_sub");
    if (hasPrefs) return t("recommended_sub");
    return t("home_onb_hint");
  }, [t, userPreferences, sessionHistory]);

  const mapFavoriteIdsToModes = useCallback((favIds) => {
    const ids = Array.isArray(favIds) ? favIds : [];
    const cats = getCategories();

    return ids
      .map((id) =>
        cats.find((c) => (c && c.id) === id || (c && c.key) === id)
      )
      .filter(Boolean);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const load = useCallback(async () => {
    try {
      const [p, offFavs, prefs, history, favIds, name] = await Promise.all([
        getUserPlan().catch(() => "free"),
        getOfflineFavorites().catch(() => []),
        getUserPreferences().catch(() => []),
        getSessionHistory().catch(() => []),
        getFavoriteFocusModes().catch(() => []),
        getUserName().catch(() => ""),
      ]);

      const safeHistory = Array.isArray(history) ? history : [];
      const wc = await getWeeklyResetsCount({
        includeAborted: false,
        _history: safeHistory,
      }).catch(() => 0);

      setPlan(p || "free");
      setOfflineFavs(Array.isArray(offFavs) ? offFavs : []);
      setUserPreferences(Array.isArray(prefs) ? prefs : []);
      setSessionHistory(safeHistory);
      setFavoriteModes(mapFavoriteIdsToModes(favIds));
      setWeeklyStreak(typeof wc === "number" ? wc : 0);
      setUserNameState(name || "");

      // Streak Freeze: sync monatliche Allowance + aktuellen Stand laden
      const ds = await getDailyStreak(safeHistory).catch(() => 0);
      setDailyStreak(typeof ds === "number" ? ds : 0);
      await syncStreakFreezes(p || "free");
      const fd = await getStreakFreezeData().catch(() => ({ freezesLeft: 0, usedDates: [] }));
      setFreezeData(fd);

      const nowMs = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const safeHist = Array.isArray(history) ? history : [];

      const uniqueDays7 = new Set(
        safeHist
          .filter(
            (h) =>
              (h && h.type) !== "end" &&
              Number((h && h.timestamp) || (h && h.date) || 0) > nowMs - weekMs
          )
          .map((h) =>
            new Date(Number((h && h.timestamp) || (h && h.date))).toDateString()
          )
      );

      setChallengeDays(Math.min(uniqueDays7.size, 7));

      // ── Active programs ──
      const PROGRAM_IDS = [
        { id: "reset-7",            titleKey: "bib_prog_reset7_title",    sessions: ["calm-1","thoughts-1","work-1","emotion-1","calm-2","focus-1","sleep-1"] },
        { id: "sleep-program",      titleKey: "bib_prog_sleep_title",     sessions: ["sleep-1","sleep-2"] },
        { id: "workday",            titleKey: "bib_prog_workday_title",   sessions: ["work-1","focus-1","calm-1"] },
        { id: "morning-start",      titleKey: "bib_prog_morning_title",   sessions: ["calm-1","focus-1","work-1","thoughts-1","sleep-1"] },
        { id: "emotion-regulation", titleKey: "bib_prog_emotion_title",   sessions: ["emotion-1","calm-1","thoughts-1"] },
        { id: "focus-week",         titleKey: "bib_prog_focus_week_title",sessions: ["focus-1","work-1","thoughts-1","calm-1","focus-1"] },
      ];
      const started = PROGRAM_IDS.map((prog) => {
        const relevant = safeHist.filter(
          (h) =>
            h &&
            h.type !== "end" &&
            typeof h.sessionId === "string" &&
            prog.sessions.includes(h.sessionId) &&
            h.programId === prog.id
        );
        const uniqueDaysSet = new Set(
          relevant.map((h) => new Date(Number(h.timestamp || 0)).toDateString())
        );
        const done = Math.min(uniqueDaysSet.size, prog.sessions.length);
        return { ...prog, done, total: prog.sessions.length };
      }).filter((p) => p.done > 0 && p.done < p.total);
      setActivePrograms(started);
    } catch (e) {
      console.error("Home load error:", e);
    }
  }, [mapFavoriteIdsToModes]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Einmaliges Update-Popup nach App-Update
  useEffect(() => {
    AsyncStorage.getItem("stillmind_last_seen_version").then((seen) => {
      if (seen !== APP_VERSION) {
        setTimeout(() => setUpdatePopupVisible(true), 800);
        AsyncStorage.setItem("stillmind_last_seen_version", APP_VERSION);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Launch-3 Review Trigger
  useEffect(() => {
    (async () => {
      try {
        const count = await incrementAppLaunchCount();
        if (count === 3) {
          const asked = await getReviewFlag(REVIEW_KEYS.LAUNCH_3);
          if (!asked) {
            await setReviewFlag(REVIEW_KEYS.LAUNCH_3);
            setTimeout(() => setPreReviewVisible(true), 3000);
          }
        }
      } catch (_) {}
    })();
  }, []);

  const showSOS =
    plan === "pro" || plan === "lifetime" || canUseSOS({ plan });

  const handlePreReviewYes = async () => {
    setPreReviewVisible(false);
    try {
      const can = await StoreReview.hasAction();
      if (can) {
        await StoreReview.requestReview();
      } else {
        await Linking.openURL("itms-apps://itunes.apple.com/app/id6758213061?action=write-review");
      }
    } catch (_) {
      try { await Linking.openURL("https://apps.apple.com/app/id6758213061?action=write-review"); } catch (__) {}
    }
  };
  const handlePreReviewNo = () => setPreReviewVisible(false);

  const gateStart = useCallback(
    async (next) => {
      try {
        const status = await canStartSession();
        if (!(status && status.canStart)) {
          setSessionLimitVisible(true);
          return;
        }
        next();
      } catch (e) {
        console.error("Gate error:", e);
      }
    },
    [router, t]
  );

  const handleStartSession = useCallback(() => {
    gateStart(() => router.push("/mode-selection"));
  }, [gateStart, router]);

  const handleSOSPress = useCallback(() => {
    if (plan === "pro" || plan === "lifetime") {
      router.push("/sos-extended");
      return;
    }

    gateStart(() =>
      router.push({
        pathname: "/session-run/SOS",
        params: { mode: "calm", source: "sos" },
      })
    );
  }, [gateStart, router, plan]);

  const handleStartFavoriteMode = useCallback(
    (modeId) => {
      gateStart(() =>
        router.push({
          pathname: "/session-run/quick",
          params: { mode: modeId, source: "favorite" },
        })
      );
    },
    [gateStart, router]
  );

  const openModeSelectionForFavorites = useCallback(() => {
    router.push("/mode-selection");
  }, [router]);

  const FREE_OFFLINE_SESSIONS = ["calm-1"]; // Basis: 1 session from favorites
  const canDownload = useCallback((sessionId) => {
    if (plan === "pro" || plan === "lifetime") return true;
    return FREE_OFFLINE_SESSIONS.includes(sessionId);
  }, [plan]);
  const handleToggleOffline = useCallback(async (session) => {
    if (plan === "free") {
      Alert.alert(t("premium_required"), t("offline_fav_locked"), [
        { text: t("run_btn_later"), style: "cancel" },
        { text: t("run_btn_upgrade"), onPress: () => router.push("/(tabs)/premium") },
      ]); return;
    }
    const isFav = offlineFavs.includes(session.id);
    if (isFav) {
      await removeOfflineFavorite(session.id);
      setOfflineFavs(prev => prev.filter(id => id !== session.id));
    } else {
      await addOfflineFavorite(session.id);
      setOfflineFavs(prev => [...prev, session.id]);
      const audioUrl = getAudioUrl(session.category) || getAudioUrl(session.id);
      if (audioUrl) {
        setDownloadingId(session.id);
        cacheAudioForSession(session.id, audioUrl, (p) => {
          setDownloadProgress(prev => ({ ...prev, [session.id]: p }));
        }).then(() => setDownloadingId(id => id === session.id ? null : id))
          .catch(() => setDownloadingId(id => id === session.id ? null : id));
      }
    }
  }, [plan, offlineFavs]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: 24,
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Image
            source={STILLMIND_LOGO}
            resizeMode="contain"
            style={{ width: 72, height: 72, opacity: 0.97 }}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setWhatsNewVisible(true)}
              activeOpacity={0.75}
              style={{ paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, backgroundColor: "rgba(205,185,138,0.10)", borderWidth: 1, borderColor: "rgba(205,185,138,0.25)", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#CDB98A" }}>✦</Text>
            </TouchableOpacity>
            <MinutesBubble floating={false} />
          </View>
        </View>

        {/* Einmaliges Update-Popup */}
        <Modal visible={updatePopupVisible} transparent animationType="fade" onRequestClose={() => setUpdatePopupVisible(false)}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <TouchableOpacity
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)" }}
              activeOpacity={1}
              onPress={() => setUpdatePopupVisible(false)}
            />
            <View style={{ backgroundColor: "#111111", borderRadius: 24, width: "100%", maxWidth: 380, overflow: "hidden", borderWidth: 1, borderColor: "rgba(205,185,138,0.20)" }}>
              {/* Header */}
              <View style={{ backgroundColor: "rgba(205,185,138,0.08)", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 20, borderBottomWidth: 0.5, borderBottomColor: "rgba(255,255,255,0.08)" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 24, color: "#FFFFFF", letterSpacing: -0.5, marginBottom: 4 }}>
                  {t("update_popup_title")}
                </Text>
                <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.50)" }}>
                  {t("update_popup_sub")}
                </Text>
              </View>
              {/* Feature-Liste */}
              <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, gap: 14 }}>
                {[
                  { icon: "📶", label: t("whats_new_offline_title"), desc: t("whats_new_offline_desc") },
                  { icon: "✨", label: t("whats_new_uix_title"), desc: t("whats_new_uix_desc") },
                  { icon: "⌚", label: t("whats_new_watch_title"), desc: t("whats_new_watch_desc") },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(205,185,138,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(205,185,138,0.18)", flexShrink: 0 }}>
                      <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#FFFFFF", marginBottom: 3 }}>{item.label}</Text>
                      <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 18 }}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {/* Buttons */}
              <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => { setUpdatePopupVisible(false); setWhatsNewVisible(true); }}
                  style={{ backgroundColor: "#CDB98A", borderRadius: 14, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#000000" }}>
                    {t("update_popup_btn")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setUpdatePopupVisible(false)}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: "rgba(255,255,255,0.40)" }}>
                    {t("update_popup_close")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Neuigkeiten Modal */}
        <Modal visible={whatsNewVisible} transparent animationType="slide" onRequestClose={() => { setWhatsNewVisible(false); whatsNewTranslateY.setValue(0); }}>
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <TouchableOpacity style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }} activeOpacity={1} onPress={() => { setWhatsNewVisible(false); whatsNewTranslateY.setValue(0); }} />
            <Animated.View style={{ backgroundColor: "#111111", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "75%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.10)", transform: [{ translateY: whatsNewTranslateY }] }} {...whatsNewPanResponder.panHandlers}>
              {/* Drag Handle – fix oben */}
              <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
              </View>
              {/* Titel – fix oben */}
              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 26, color: "#FFFFFF", letterSpacing: -0.5 }}>{t("whats_new_title")}</Text>
              </View>
              {/* Scrollbarer Inhalt */}
              <ScrollView
                style={{ flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* ── Feature des Monats (Highlight) ── */}
                {(() => {
                  const feature = { icon: "🤖", title: t("whats_new_ki_title"), badge: t("whats_new_badge_feature"), desc: t("whats_new_ki_desc") };
                  return (
                    <View key="feature" style={{ marginBottom: 4, borderRadius: 18, backgroundColor: "rgba(205,185,138,0.07)", borderWidth: 1, borderColor: "rgba(205,185,138,0.30)", padding: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <View style={{ backgroundColor: "#CDB98A", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 9, color: "#0B0B0B", letterSpacing: 1 }}>{feature.badge}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(205,185,138,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(205,185,138,0.35)" }}>
                          <Text style={{ fontSize: 26 }}>{feature.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Montserrat_700Bold", fontSize: 17, color: "#FFFFFF", marginBottom: 6 }}>{feature.title}</Text>
                          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.60)", lineHeight: 20 }}>{feature.desc}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* ── Neue Updates ── */}
                {[
                  { icon: "📶", title: t("whats_new_offline_title"), badge: t("whats_new_badge_new"), badgeColor: "#CDB98A", desc: t("whats_new_offline_desc") },
                  { icon: "✨", title: t("whats_new_uix_title"), badge: t("whats_new_badge_new"), badgeColor: "#CDB98A", desc: t("whats_new_uix_desc") },
                  { icon: "❤️", title: t("whats_new_health_title"), badge: t("whats_new_badge_new"), badgeColor: "#CDB98A", desc: t("whats_new_health_desc") },
                  { icon: "⌚", title: t("whats_new_watch_title"), badge: t("whats_new_badge_new"), badgeColor: "#CDB98A", desc: t("whats_new_watch_desc") },
                  { icon: "🌍", title: t("whats_new_lang_title"), badge: t("whats_new_badge_new"), badgeColor: "#CDB98A", desc: t("whats_new_lang_desc") },
                ].map((item, i, arr) => (
                  <View key={i} style={{ paddingVertical: 16, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0, borderBottomColor: "rgba(255,255,255,0.07)" }}>
                    <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(205,185,138,0.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(205,185,138,0.20)" }}>
                        <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "#FFFFFF" }}>{item.title}</Text>
                          <View style={{ backgroundColor: "rgba(205,185,138,0.14)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(205,185,138,0.28)" }}>
                            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: "#CDB98A", letterSpacing: 1 }}>{item.badge}</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 20 }}>{item.desc}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                {/* ── Bald verfügbar ── */}
                <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: "rgba(255,255,255,0.07)", paddingTop: 8 }}>
                  {[
                    { icon: "🪨", title: t("whats_new_widget_title"), badge: t("whats_new_badge_soon"), desc: t("whats_new_widget_desc") },
                  ].map((item, i, arr) => (
                    <View key={i} style={{ paddingVertical: 16, borderBottomWidth: i < arr.length - 1 ? 0.5 : 0, borderBottomColor: "rgba(255,255,255,0.07)" }}>
                      <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
                        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
                          <Text style={{ fontSize: 24, opacity: 0.5 }}>{item.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: "rgba(255,255,255,0.40)" }}>{item.title}</Text>
                            <View style={{ backgroundColor: "rgba(205,185,138,0.08)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "rgba(205,185,138,0.15)" }}>
                              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: "rgba(205,185,138,0.55)", letterSpacing: 1 }}>{item.badge}</Text>
                            </View>
                          </View>
                          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.25)", lineHeight: 20 }}>{item.desc}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {/* Close Button – fix unten */}
              <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 }}>
                <TouchableOpacity
                  onPress={() => { setWhatsNewVisible(false); whatsNewTranslateY.setValue(0); }}
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "rgba(255,255,255,0.70)", letterSpacing: 0.3 }}>{t("close")}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 40,
              color: TEXT,
              marginBottom: 4,
              letterSpacing: 0.2,
            }}
          >
            {greeting}
          </Text>
          <Text
            style={{
              fontFamily: "Montserrat_400Regular",
              fontSize: 15,
              lineHeight: 22,
              color: MUTED,
              marginBottom: 14,
            }}
          >
            {greetingSubtext}
          </Text>
        </View>

        {weeklyStreak > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: 14,
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <Text style={{ fontSize: 20 }}>
                {weeklyStreak >= 5 ? "🔥" : weeklyStreak >= 3 ? "⚡" : "✨"}
              </Text>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 13,
                    color: TEXT,
                  }}
                >
                  {t("sessions_this_week").replace("{{n}}", weeklyStreak)}
                </Text>

                <Text
                  style={{
                    fontFamily: "Montserrat_400Regular",
                    fontSize: 12,
                    color: MUTED,
                    marginTop: 1,
                  }}
                >
                  {weeklyStreak < 5
                    ? t("sessions_weekly_goal").replace(
                        "{{n}}",
                        5 - weeklyStreak
                      )
                    : t("sessions_weekly_goal").replace("{{n}}", 0) + " 🎉"}
                </Text>
              </View>

              <View
                style={{
                  width: 48,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (weeklyStreak / 5) * 100)}%`,
                    backgroundColor:
                      weeklyStreak >= 5 ? "#F59E0B" : PRIMARY,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Streak Upsell Banner — Free + Streak ≥5 */}
        {plan === "free" && dailyStreak >= 5 && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/premium")}
            activeOpacity={0.85}
            style={{ marginHorizontal: 24, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: "rgba(205,185,138,0.25)", backgroundColor: "rgba(205,185,138,0.07)", paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <Text style={{ fontSize: 20 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 13, color: "#CDB98A" }}>{dailyStreak} Tage Streak — schütz ihn mit Pro</Text>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{t("whats_new_sub")}</Text>
            </View>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>›</Text>
          </TouchableOpacity>
        )}

        <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push("/challenge")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: "rgba(205,185,138,0.07)",
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: "rgba(205,185,138,0.20)",
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(205,185,138,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22 }}>
                {challengeDays >= 7 ? "🏆" : "⚔️"}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 13,
                  color: "#EDE7D0",
                  marginBottom: 4,
                }}
              >
                {challengeDays >= 7
                  ? t("challenge_complete")
                  : `${t("challenge_title")} · ${t("challenge_day").replace("{{n}}", challengeDays + 1)}`}
              </Text>

              <View
                style={{
                  height: 4,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 3,
                }}
              >
                <View
                  style={{
                    height: 4,
                    width: `${Math.round((challengeDays / 7) * 100)}%`,
                    backgroundColor: "#CDB98A",
                    borderRadius: 2,
                  }}
                />
              </View>

              <Text
                style={{
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 11,
                  color: "rgba(237,231,208,0.45)",
                }}
              >
                {challengeDays === 0
                  ? t("challenge_start_today")
                  : challengeDays >= 7
                  ? t("challenge_completed")
                  : t("challenge_days_done").replace("{{n}}", challengeDays)}
              </Text>
            </View>

            <Text
              style={{ color: "rgba(205,185,138,0.50)", fontSize: 20 }}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>


        {/* ── Streak Freeze (Pro+) ─────────────────────────── */}
        {(plan === "pro" || plan === "lifetime") && dailyStreak >= 2 && (() => {
          const todayStr = new Date().toISOString().slice(0, 10);
          const usedToday = (freezeData.usedDates || []).includes(todayStr);
          const hasFreeze = freezeData.freezesLeft > 0 && !usedToday;
          if (usedToday) return null; // Nach Nutzung ausblenden – Streak ist gesichert
          return (
            <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
              <TouchableOpacity
                activeOpacity={hasFreeze ? 0.82 : 1}
                onPress={async () => {
                  if (!hasFreeze || freezeLoading) return;
                  setFreezeLoading(true);
                  const result = await useStreakFreeze(plan);
                  if (result.success) {
                    const fd = await getStreakFreezeData().catch(() => freezeData);
                    setFreezeData(fd);
                  }
                  setFreezeLoading(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: hasFreeze
                    ? "rgba(205,185,138,0.06)"
                    : "rgba(255,255,255,0.03)",
                  borderRadius: 14,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: hasFreeze
                    ? "rgba(205,185,138,0.18)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <Text style={{ fontSize: 20 }}>🧊</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: "Montserrat_600SemiBold", fontSize: 13,
                    color: hasFreeze ? "#CDB98A" : "rgba(255,255,255,0.28)",
                    marginBottom: 2,
                  }}>
                    {hasFreeze
                      ? t("freeze_available").replace("{{n}}", freezeData.freezesLeft)
                      : t("freeze_none_left")}
                  </Text>
                  <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
                    {t("freeze_sub").replace("{{streak}}", dailyStreak)}
                  </Text>
                </View>
                {hasFreeze && !freezeLoading && (
                  <View style={{
                    backgroundColor: "rgba(205,185,138,0.14)",
                    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                    borderWidth: 1, borderColor: "rgba(205,185,138,0.25)",
                  }}>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#CDB98A" }}>
                      {t("freeze_btn")}
                    </Text>
                  </View>
                )}
                {freezeLoading && (
                  <Text style={{ fontSize: 13, color: "rgba(205,185,138,0.50)" }}>…</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Streak-Schutz Upsell (zweiter entfernt – einer reicht) */}

        {activePrograms.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 12,
                color: MUTED,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              {t("home_active_programs")}
            </Text>

            {activePrograms.map((prog) => (
              <TouchableOpacity
                key={prog.id}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/bibliothek",
                    params: { openProgram: prog.id },
                  })
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  backgroundColor: "rgba(139,92,246,0.08)",
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderWidth: 1,
                  borderColor: "rgba(139,92,246,0.22)",
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "rgba(139,92,246,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 20 }}>📚</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 13,
                      color: "#C4B5FD",
                      marginBottom: 5,
                    }}
                  >
                    {t(prog.titleKey) || prog.id}
                  </Text>

                  <View
                    style={{
                      height: 4,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      borderRadius: 2,
                      overflow: "hidden",
                      marginBottom: 3,
                    }}
                  >
                    <View
                      style={{
                        height: 4,
                        width: `${Math.round((prog.done / prog.total) * 100)}%`,
                        backgroundColor: "#8B5CF6",
                        borderRadius: 2,
                      }}
                    />
                  </View>

                  <Text
                    style={{
                      fontFamily: "Montserrat_400Regular",
                      fontSize: 11,
                      color: "rgba(196,181,253,0.50)",
                    }}
                  >
                    {t("home_prog_day").replace("{{done}}", prog.done).replace("{{total}}", prog.total)}
                  </Text>
                </View>

                <Text style={{ color: "rgba(139,92,246,0.50)", fontSize: 20 }}>
                  ›
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showSOS && (
          <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
            <TouchableOpacity
              onPress={handleSOSPress}
              activeOpacity={0.9}
              style={{
                backgroundColor: "#FF4757",
                borderRadius: 16,
                padding: 20,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#FF4757",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.28,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "rgba(255,255,255,0.20)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Text style={{ fontSize: 22 }}>🚨</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 18,
                    color: "#FFFFFF",
                    marginBottom: 4,
                  }}
                >
                  {t("sos_title")}
                </Text>

                <Text
                  style={{
                    fontFamily: "Montserrat_400Regular",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {t("sos_subtitle")}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={handleStartSession}
            activeOpacity={0.9}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="play-outline" size={20} color="#FFFFFF" />
            <Text
              style={{
                marginLeft: 10,
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: "#FFFFFF",
              }}
            >
              {t("start_session")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: TEXT,
              }}
            >
              {t("favorites")}
            </Text>

            <TouchableOpacity
              onPress={openModeSelectionForFavorites}
              activeOpacity={0.9}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 13,
                  color: MUTED,
                }}
              >
                {t("edit")}
              </Text>
            </TouchableOpacity>
          </View>

          {favoriteModes.length === 0 ? (
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 14,
                color: MUTED,
                lineHeight: 20,
              }}
            >
              {t("no_favorites")}
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {favoriteModes.map((m) => {
                const label = m.label || m.title || m.name || t("home_favorite_label");
                const icon = m.icon || m.emoji || "⭐";
                const id = m.id || m.key || label;

                return (
                  <TouchableOpacity
                    key={String(id)}
                    onPress={() => handleStartFavoriteMode(m.id || m.key)}
                    activeOpacity={0.9}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      borderRadius: 16,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.08)",
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 20, marginRight: 12 }}>{icon}</Text>
                    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: TEXT, flex: 1 }} numberOfLines={1}>
                      {label}
                    </Text>
                    <TouchableOpacity
                      onPress={(ev) => { ev.stopPropagation?.(); const sid = (id + "-1") ; handleToggleOffline({ id: sid, category: String(id) }); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: offlineFavs.includes(id + "-1") ? "rgba(201,188,168,0.18)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: offlineFavs.includes(id + "-1") ? "rgba(201,188,168,0.35)" : "rgba(255,255,255,0.08)" }}
                    >
                      {downloadingId === (id + "-1")
                        ? <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: PRIMARY }}>{Math.round((downloadProgress[id + "-1"] || 0) * 100)}%</Text>
                        : offlineFavs.includes(id + "-1")
                          ? <Ionicons name="checkmark-circle" size={14} color={PRIMARY} />
                          : <Ionicons name="arrow-down-circle-outline" size={14} color={canDownload(id + "-1") ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.20)"} />
                      }
                    </TouchableOpacity>
                    <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 13, color: MUTED }}>Start</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: TEXT,
              }}
            >
              {t("recommended")}
            </Text>
          </View>

          <Text
            style={{
              marginBottom: 10,
              fontFamily: "Montserrat_400Regular",
              fontSize: 13,
              color: MUTED,
              lineHeight: 18,
            }}
          >
            {recommendedWhyText}
          </Text>

          {recommendedSessions.map((s) => (
            <TouchableOpacity
              key={String(s.id)}
              onPress={() => router.push(`/session-run/${s.id}`)}
              activeOpacity={0.9}
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: 18,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: TEXT }} numberOfLines={1}>
                  {s.title}
                </Text>
                <TouchableOpacity
                  onPress={(ev) => { ev.stopPropagation?.(); handleToggleOffline(s); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 10, width: 32, height: 32, borderRadius: 8, backgroundColor: offlineFavs.includes(s.id) ? "rgba(201,188,168,0.18)" : "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: offlineFavs.includes(s.id) ? "rgba(201,188,168,0.35)" : "rgba(255,255,255,0.08)" }}
                >
                  {downloadingId === s.id
                    ? <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 9, color: PRIMARY }}>{Math.round((downloadProgress[s.id] || 0) * 100)}%</Text>
                    : offlineFavs.includes(s.id)
                      ? <Ionicons name="checkmark-circle" size={16} color={PRIMARY} />
                      : <Ionicons name="arrow-down-circle-outline" size={16} color={canDownload(s.id) ? "rgba(255,255,255,0.50)" : "rgba(255,255,255,0.20)"} />
                  }
                </TouchableOpacity>
                <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 14, color: MUTED, marginLeft: 8 }}>
                  {s.duration || 60} Sek.
                </Text>
              </View>

              {!!s.description && (
                <Text
                  style={{
                    marginTop: 8,
                    fontFamily: "Montserrat_400Regular",
                    fontSize: 13,
                    color: MUTED,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  {s.description}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Session-Limit Modal */}
      <Modal transparent visible={sessionLimitVisible} animationType="fade" onRequestClose={() => setSessionLimitVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: "#1C1A17", borderRadius: 28, padding: 26, borderWidth: 1, borderColor: "rgba(205,185,138,0.25)" }}>
            <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 12 }}>🌙</Text>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 20, color: "#FFFFFF", textAlign: "center", marginBottom: 8 }}>
              {t("home_no_session")}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 20, marginBottom: 20 }}>
              {t("home_limit_body")}
            </Text>
            <TouchableOpacity
              onPress={() => { setSessionLimitVisible(false); router.push("/(tabs)/premium"); }}
              style={{ backgroundColor: "#CDB98A", borderRadius: 14, paddingVertical: 13, alignItems: "center", marginBottom: 10 }}
            >
              <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 15, color: "#0C0B09" }}>{t("premium_cta_yearly")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSessionLimitVisible(false)} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t("home_limit_tomorrow")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pre-Review Modal */}
      <Modal transparent visible={preReviewVisible} animationType="fade" onRequestClose={handlePreReviewNo}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <View style={{ width: "100%", maxWidth: 520, backgroundColor: "#1C1A17", borderRadius: 28, padding: 24, borderWidth: 1, borderColor: "rgba(205,185,138,0.25)" }}>
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 22, color: "#FFFFFF", textAlign: "center", marginBottom: 10 }}>
              {t("pre_review_title")}
            </Text>
            <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, lineHeight: 22, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 22 }}>
              {t("pre_review_body")}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handlePreReviewNo} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#FFFFFF" }}>{t("pre_review_dismiss")}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePreReviewYes} style={{ flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: "#CDB98A", alignItems: "center" }}>
                <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#0C0B09" }}>{t("pre_review_confirm")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}