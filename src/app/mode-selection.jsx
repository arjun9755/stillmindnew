import React, { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/utils/i18n";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { Sparkles, X, Star, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import {
  getSettings,
  saveSettings,
  getUserPlan,
  getFavoriteFocusModes,
  toggleFavoriteFocusMode,
} from "@/utils/storage";
import MinutesBubble from "@/components/MinutesBubble";


const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const fmtMMSS = (totalSeconds) => {
  const s = Math.max(0, totalSeconds | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export default function ModeSelection() {
  const { t } = useI18n();
  const FOCUS_OPTIONS = useMemo(() => [
    { id: "calm", emoji: "🧘", label: t("mode_calm") },
    { id: "sleep", emoji: "🌙", label: t("mode_sleep") },
    { id: "focus", emoji: "🎯", label: t("mode_focus") },
    { id: "emotion", emoji: "💙", label: t("mode_emotion") },
    { id: "parent", emoji: "👨‍👩‍👧", label: t("mode_parent") },
    { id: "work", emoji: "💼", label: t("mode_work") },
    { id: "thoughts", emoji: "🛑", label: t("mode_thoughts") },
  ], [t]);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();

  const [isLifetime, setIsLifetime] = useState(false);
  const [isProOrHigher, setIsProOrHigher] = useState(false);
  const [customSeconds, setCustomSeconds] = useState(60);

  const [favorites, setFavorites] = useState([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMinutes, setPickerMinutes] = useState(1);
  const [pickerSeconds, setPickerSeconds] = useState(0);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const load = async () => {
    try {
      const plan = await getUserPlan();
      const lifetime = plan === "lifetime";
      const proOrHigher = plan === "pro" || plan === "lifetime";
      setIsLifetime(lifetime);
      setIsProOrHigher(proOrHigher);

      const favs = await getFavoriteFocusModes();
      setFavorites(Array.isArray(favs) ? favs : []);

      const settings = (await getSettings()) || {};
      const saved =
        typeof settings.premiumLifeSeconds === "number"
          ? settings.premiumLifeSeconds
          : 60;

      const clamped = clamp(saved, 60, 600);
      setCustomSeconds(clamped);

      const m = Math.floor(clamped / 60);
      const s = clamped % 60;
      setPickerMinutes(clamp(m, 1, 10));
      setPickerSeconds(clamp(s, 0, 59));
    } catch (_e) {
      setIsLifetime(false);
      setIsProOrHigher(false);
      setCustomSeconds(60);
      setFavorites([]);
      setPickerMinutes(1);
      setPickerSeconds(0);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const durationLabel = useMemo(() => fmtMMSS(customSeconds), [customSeconds]);

  const persistSeconds = async (total) => {
    const next = clamp(total, 60, 600);
    setCustomSeconds(next);

    const current = (await getSettings()) || {};
    await saveSettings({ ...current, premiumLifeSeconds: next });
  };

  const openPicker = () => {
    if (!isProOrHigher) return;
    setPickerMinutes(clamp(Math.floor(customSeconds / 60), 1, 10));
    setPickerSeconds(clamp(customSeconds % 60, 0, 59));
    setPickerOpen(true);
  };

  const applyPicker = async () => {
    const total = clamp(pickerMinutes * 60 + pickerSeconds, 60, 600);
    await persistSeconds(total);
    setPickerOpen(false);
  };

  const handleSelectMode = (modeId) => {
    const secondsParam = isProOrHigher ? `&seconds=${customSeconds}` : "";
    router.push(`/session-run/quick?mode=${modeId}${secondsParam}`);
  };

  const onToggleFavorite = async (modeId) => {
    const next = await toggleFavoriteFocusMode(modeId);
    setFavorites(Array.isArray(next) ? next : []);
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* ✅ Zurück-Pfeil (oben links) -> Startseite */}
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)")}
        activeOpacity={0.85}
        style={{
          position: "absolute",
          top: insets.top + 12,
          left: 16,
          width: 42,
          height: 42,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 50,
        }}
      >
        <ArrowLeft size={20} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "flex-end", marginBottom: 16 }}>
          <MinutesBubble floating={false} />
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 28,
              color: colors.text,
              marginBottom: 8,
            }}
          >
            {t("mode_sel_title")}
          </Text>
          <Text
            style={{
              fontFamily: "Montserrat_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            {t("mode_sel_sub")}
          </Text>
        </View>

        {isProOrHigher ? (
          <TouchableOpacity
            onPress={openPicker}
            activeOpacity={0.9}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 16,
              marginBottom: 18,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Sparkles size={18} color={colors.primary} />
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  {t("mode_sel_dur_banner")}
                </Text>
              </View>

              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 16,
                  color: colors.primary,
                }}
              >
                {durationLabel}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 12,
                color: colors.textSecondary,
                lineHeight: 18,
              }}
            >
              {t("mode_sel_dur_hint")}
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ gap: 12 }}>
          {FOCUS_OPTIONS.map((option) => {
            const isFav = favorites.includes(option.id);

            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleSelectMode(option.id)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 20,
                  padding: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 22, marginRight: 14 }}>
                  {option.emoji}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Montserrat_600SemiBold",
                      fontSize: 16,
                      color: colors.text,
                    }}
                  >
                    {option.label}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => onToggleFavorite(option.id)}
                  activeOpacity={0.85}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Star
                    size={18}
                    color={isFav ? colors.primary : colors.textSecondary}
                    fill={isFav ? colors.primary : "none"}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 16,
                  color: colors.text,
                }}
              >
                {t("mode_sel_dur_modal_title")}
              </Text>

              <TouchableOpacity
                onPress={() => setPickerOpen(false)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 14,
              }}
            >
              {t("mode_sel_range")}
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t("picker_minutes")}
                </Text>

                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    padding: 8,
                  }}
                >
                  <ScrollView
                    style={{ maxHeight: 220 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((m) => {
                      const active = m === pickerMinutes;
                      return (
                        <TouchableOpacity
                          key={`m-${m}`}
                          onPress={() => setPickerMinutes(m)}
                          style={{
                            paddingVertical: 12,
                            borderRadius: 14,
                            alignItems: "center",
                            backgroundColor: active
                              ? "rgba(255,255,255,0.10)"
                              : "transparent",
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={{
                              fontFamily: "Montserrat_600SemiBold",
                              fontSize: 16,
                              color: colors.text,
                              opacity: active ? 1 : 0.75,
                            }}
                          >
                            {String(m).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {t("picker_seconds")}
                </Text>

                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    borderRadius: 16,
                    padding: 8,
                  }}
                >
                  <ScrollView
                    style={{ maxHeight: 220 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((s) => {
                      const active = s === pickerSeconds;
                      return (
                        <TouchableOpacity
                          key={`s-${s}`}
                          onPress={() => setPickerSeconds(s)}
                          style={{
                            paddingVertical: 12,
                            borderRadius: 14,
                            alignItems: "center",
                            backgroundColor: active
                              ? "rgba(255,255,255,0.10)"
                              : "transparent",
                          }}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={{
                              fontFamily: "Montserrat_600SemiBold",
                              fontSize: 16,
                              color: colors.text,
                              opacity: active ? 1 : 0.75,
                            }}
                          >
                            {String(s).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>

            <View style={{ alignItems: "center", marginTop: 14 }}>
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 18,
                  color: colors.primary,
                  marginBottom: 12,
                }}
              >
                {fmtMMSS(clamp(pickerMinutes * 60 + pickerSeconds, 60, 600))}
              </Text>

              <TouchableOpacity
                onPress={applyPicker}
                style={{
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 16,
                  width: "100%",
                  alignItems: "center",
                }}
                activeOpacity={0.9}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 14,
                    color: "#fff",
                  }}
                >
                  {t("picker_confirm")}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
