import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { ChevronLeft, AlertCircle } from "lucide-react-native";
import { router } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";

export default function HaftungScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();
  const { t } = useI18n();
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });
  if (!fontsLoaded) return null;

  const H2 = ({ children }) => (
    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: colors.text, marginBottom: 12 }}>
      {children}
    </Text>
  );
  const Body = ({ children, mb = 24 }) => (
    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: mb, lineHeight: 22 }}>
      {children}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 24, color: colors.text, marginBottom: 24 }}>
          {t("legal_haftung_title")}
        </Text>

        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderLeftWidth: 4, borderLeftColor: colors.warning }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <AlertCircle size={20} color={colors.warning} style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text }}>
              {t("legal_haftung_notice_title")}
            </Text>
          </View>
          <Body mb={0}>{t("legal_haftung_notice_body")}</Body>
        </View>

        <H2>{t("legal_haftung_no_medical_title")}</H2>
        <Body>{t("legal_haftung_no_medical_body")}</Body>

        <H2>{t("legal_haftung_crisis_title")}</H2>
        <Body>{t("legal_haftung_crisis_body")}</Body>

        <H2>{t("legal_haftung_disclaimer_title")}</H2>
        <Body mb={0}>{t("legal_haftung_disclaimer_body")}</Body>
      </ScrollView>
    </View>
  );
}
