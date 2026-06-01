import { useI18n } from "@/utils/i18n";
import React from "react";
import { View, Text, Modal, Pressable, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Zap, Lock, BarChart2, BookOpen, Settings2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";

export default function UpgradePopup({ visible, onClose, reason = "credits" }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
  });

  const handleUpgrade = () => {
    onClose();
    router.push("/premium");
  };

  if (!fontsLoaded) return null;

  const config = {
    credits: {
      title: t("upgrade_no_credits_title"),
      message: t("upgrade_no_credits_msg"),
      icon: <Zap size={28} color="#B9AC98" />,
      accent: "#B9AC98",
    },
    starts: {
      title: t("upgrade_no_starts_title"),
      message: t("upgrade_no_starts_msg"),
      icon: <Zap size={28} color="#B9AC98" />,
      accent: "#B9AC98",
    },
    color_scheme: {
      title: t("locked_color_scheme_title"),
      message: t("locked_color_scheme_msg"),
      icon: <Settings2 size={28} color="#CDB98A" />,
      accent: "#CDB98A",
    },
    bib_sessions: {
      title: t("locked_bib_sessions_title"),
      message: t("locked_bib_sessions_msg"),
      icon: <BookOpen size={28} color="#CDB98A" />,
      accent: "#CDB98A",
    },
    bib_breathing: {
      title: t("locked_bib_breathing_title"),
      message: t("locked_bib_breathing_msg"),
      icon: <Lock size={28} color="#CDB98A" />,
      accent: "#CDB98A",
    },
    bib_programs: {
      title: t("locked_bib_programs_title"),
      message: t("locked_bib_programs_msg"),
      icon: <Lock size={28} color="#CDB98A" />,
      accent: "#CDB98A",
    },
    stats: {
      title: t("locked_stats_title"),
      message: t("locked_stats_msg"),
      icon: <BarChart2 size={28} color="#8B5CF6" />,
      accent: "#8B5CF6",
    },
    stats_insights: {
      title: t("locked_stats_insights_title"),
      message: t("locked_stats_insights_msg"),
      icon: <BarChart2 size={28} color="#8B5CF6" />,
      accent: "#8B5CF6",
    },
  };

  const { title, message, icon, accent } = config[reason] || {
    title: t("premium_required"),
    message: t("upgrade_generic_msg"),
    icon: <Lock size={28} color="#B9AC98" />,
    accent: "#B9AC98",
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.80)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: "#141414",
            borderRadius: 28,
            padding: 28,
            marginHorizontal: 24,
            width: "88%",
            maxWidth: 400,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.07)",
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>

          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 18,
              backgroundColor: accent + "18",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
              borderWidth: 1,
              borderColor: accent + "30",
            }}
          >
            {icon}
          </View>

          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              fontSize: 20,
              color: "#FFFFFF",
              marginBottom: 10,
              paddingRight: 36,
            }}
          >
            {title}
          </Text>

          <Text
            style={{
              fontFamily: "Montserrat_400Regular",
              fontSize: 14,
              color: "rgba(255,255,255,0.60)",
              lineHeight: 21,
              marginBottom: 26,
            }}
          >
            {message}
          </Text>

          <TouchableOpacity
            onPress={handleUpgrade}
            style={{
              backgroundColor: accent,
              borderRadius: 16,
              paddingVertical: 15,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 15,
                color: accent === "#8B5CF6" ? "#FFFFFF" : "#0C0B09",
              }}
            >
              {t("locked_popup_cta")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={{
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 13,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {t("locked_popup_dismiss")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
