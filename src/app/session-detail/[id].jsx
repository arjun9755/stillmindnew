// apps/mobile/src/app/session-detail/[id].jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { ChevronLeft, Play, Info } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { getModeById } from "@/data/mode-quotes";
import MinutesBubble from "@/components/MinutesBubble";
import { canStartSession } from "@/utils/storage";

export default function SessionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();
  const { id } = useLocalSearchParams();

  const [sessionStatus, setSessionStatus] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const mode = useMemo(() => {
    if (!id || typeof id !== "string") return null;
    return getModeById(id);
  }, [id]);

  const loadStatus = useCallback(async () => {
    try {
      const status = await canStartSession();
      setSessionStatus(status);
    } catch (_e) {
      setSessionStatus(null);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const availabilityText = useMemo(() => {
    if (!sessionStatus) return "…";

    if (sessionStatus.reason === "unlimited") return "Unbegrenzt";
    if (sessionStatus.reason === "start-bonus") {
      return `${sessionStatus.remaining} Sessions verfügbar`;
    }
    if (sessionStatus.reason === "daily-free") {
      return "1 Session verfügbar";
    }
    if (
      sessionStatus.reason === "pro-plan" ||
      sessionStatus.reason === "pro-light-plan"
    ) {
      return `${sessionStatus.remaining} Sessions verfügbar`;
    }

    return "0 Sessions verfügbar";
  }, [sessionStatus]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  if (!mode) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View
          style={{
            paddingTop: insets.top + 18,
            paddingHorizontal: 24,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <ChevronLeft size={20} color={colors.text} />
            <Text
              style={{
                marginLeft: 6,
                fontFamily: "Montserrat_500Medium",
                fontSize: 14,
                color: colors.text,
              }}
            >
              Zurück
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              marginTop: 14,
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 18,
              color: colors.text,
            }}
          >
            Modus nicht gefunden
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View
        style={{
          paddingTop: insets.top + 18,
          paddingHorizontal: 24,
          paddingBottom: 18,
        }}
      >
        {/* Header: Zurück + Bubble (nicht starr über Content) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <ChevronLeft size={20} color={colors.text} />
            <Text
              style={{
                marginLeft: 6,
                fontFamily: "Montserrat_500Medium",
                fontSize: 14,
                color: colors.text,
                opacity: 0.85,
              }}
            >
              Zurück
            </Text>
          </TouchableOpacity>
          <MinutesBubble floating={false} />
        </View>

        <Text
          style={{
            marginTop: 14,
            fontFamily: "Montserrat_600SemiBold",
            fontSize: 28,
            color: colors.text,
            marginBottom: 10,
          }}
        >
          {mode.label}
        </Text>

        <Text
          style={{
            fontFamily: "Montserrat_400Regular",
            fontSize: 14,
            color: colors.text,
            opacity: 0.7,
            lineHeight: 20,
            marginBottom: 14,
          }}
        >
          {mode.quote}
        </Text>

        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 16,
            backgroundColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.06)",
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Montserrat_500Medium",
              fontSize: 13,
              color: colors.text,
              opacity: 0.85,
            }}
          >
            ✨
          </Text>
          <Text
            style={{
              flex: 1,
              fontFamily: "Montserrat_500Medium",
              fontSize: 13,
              color: colors.text,
              opacity: 0.85,
            }}
          >
            {availabilityText}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push(`/session-run/${mode.id}?mode=${mode.id}`)}
          style={{
            backgroundColor: colors.primaryLight,
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <Play size={18} color={colors.text} />
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 16,
              color: colors.text,
            }}
          >
            Jetzt starten
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowInfo(true)}
          style={{
            marginTop: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: 0.9,
          }}
        >
          <Info size={18} color={colors.text} />
          <Text
            style={{
              fontFamily: "Montserrat_500Medium",
              fontSize: 14,
              color: colors.text,
              opacity: 0.85,
            }}
          >
            Erklärung anzeigen
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Modal */}
      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 16,
                color: colors.text,
                marginBottom: 10,
              }}
            >
              {t("run_disclaimer_title")}
            </Text>
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 13,
                color: colors.text,
                opacity: 0.78,
                lineHeight: 18,
              }}
            >
              {t("run_disclaimer_text")}
            </Text>

            <TouchableOpacity
              onPress={() => setShowInfo(false)}
              style={{
                marginTop: 14,
                alignSelf: "flex-end",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
              }}
            >
              <Text
                style={{
                  fontFamily: "Montserrat_600SemiBold",
                  fontSize: 13,
                  color: colors.text,
                }}
              >
                {t("understood")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}