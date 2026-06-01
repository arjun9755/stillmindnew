import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";

const PRIVACY_URL = "https://appstillmind.com/privacy.html";
const TERMS_URL   = "https://appstillmind.com/terms.html";
const RC_URL      = "https://www.revenuecat.com/privacy/";

export default function DatenschutzScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();
  const { t } = useI18n();
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });
  if (!fontsLoaded) return null;

  const H2 = ({ children }) => (
    <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 16, color: colors.text, marginBottom: 10, marginTop: 4 }}>
      {children}
    </Text>
  );
  const Body = ({ children, mb = 18 }) => (
    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: mb, lineHeight: 22 }}>
      {children}
    </Text>
  );
  const Link = ({ url, label }) => (
    <Text onPress={() => Linking.openURL(url)} style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.primary, textDecorationLine: "underline", marginBottom: 6 }}>
      {label}
    </Text>
  );
  const Bullet = ({ children }) => (
    <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 }}>
      {"• "}{children}
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
          {t("privacy")}
        </Text>

        {/* Quick Links Box */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text, marginBottom: 10 }}>
            {t("legal_privacy_docs_title")}
          </Text>
          <Body mb={12}>{t("legal_privacy_docs_body")}</Body>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
            {"• "}{t("legal_privacy_extern_policy")}{" "}
            <Text onPress={() => Linking.openURL(PRIVACY_URL)} style={{ color: colors.primary, textDecorationLine: "underline" }}>
              {PRIVACY_URL}
            </Text>
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
            {"• "}{t("legal_privacy_extern_terms")}{" "}
            <Text onPress={() => Linking.openURL(TERMS_URL)} style={{ color: colors.primary, textDecorationLine: "underline" }}>
              {TERMS_URL}
            </Text>
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
            {"• "}{t("legal_privacy_extern_revenuecat")}{" "}
            <Text onPress={() => Linking.openURL(RC_URL)} style={{ color: colors.primary, textDecorationLine: "underline" }}>
              {RC_URL}
            </Text>
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
            {t("legal_privacy_docs_hint")}
          </Text>
        </View>

        <H2>{t("legal_privacy_section1_title")}</H2>
        <Body>{t("legal_privacy_section1_p1")}</Body>
        <Body>{t("legal_privacy_section1_p2")}</Body>
        <Body mb={6}>{t("legal_privacy_section1_p3")}</Body>
        <Bullet>{t("legal_privacy_local_1")}</Bullet>
        <Bullet>{t("legal_privacy_local_2")}</Bullet>
        <Bullet>{t("legal_privacy_local_3")}</Bullet>
        <View style={{ height: 18 }} />

        <H2>{t("legal_privacy_section2_title")}</H2>
        <Body>{t("legal_privacy_section2_body")}</Body>

        <H2>{t("legal_privacy_revenuecat_title")}</H2>
        <Body>{t("legal_privacy_revenuecat_body")}</Body>

        <H2>{t("legal_privacy_notif_title")}</H2>
        <Body>{t("legal_privacy_notif_body")}</Body>

        <H2>{t("legal_privacy_audio_title")}</H2>
        <Body>{t("legal_privacy_audio_body")}</Body>

        <H2>{t("legal_privacy_no_medical_title")}</H2>
        <Body>{t("legal_privacy_no_medical_body")}</Body>

        <H2>{t("legal_privacy_terms_title")}</H2>
        <Body>{t("legal_privacy_terms_body")}</Body>

        <H2>{t("legal_privacy_contact_title")}</H2>
        <Body mb={4}>{t("legal_privacy_contact_body")}</Body>
        <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text }}>
          support@appstillmind.com
        </Text>

      </ScrollView>
    </View>
  );
}
