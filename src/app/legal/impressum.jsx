import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";

export default function ImpressumScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useStillMindTheme();
  const { t } = useI18n();
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold });
  if (!fontsLoaded) return null;

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
          {t("imprint")}
        </Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: colors.text, marginBottom: 12 }}>
            {t("legal_provider")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text, marginBottom: 16 }}>
            {"Dennis Willimsky\nKornblumenstr. 7\n76131 Karlsruhe\n"}{t("legal_country")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_500Medium", fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
            {t("legal_contact")}
          </Text>
          <Text style={{ fontFamily: "Montserrat_400Regular", fontSize: 14, color: colors.text }}>
            support@appstillmind.com
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
