import React from "react";
import { Platform, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "@/utils/i18n";



// Tab bar sizing: set different base heights for iOS and Android.
// The bottom safe-area inset is added automatically (important on iPhone with home indicator).
// Change only these numbers to tune the visual height per platform.
const TABBAR_HEIGHT_IOS = 53;
const TABBAR_HEIGHT_ANDROID = 58;

const TABBAR_PADDING_TOP = 8;
const TABBAR_PADDING_BOTTOM = 8;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  

  const baseHeight =
    Platform.OS === "ios" ? TABBAR_HEIGHT_IOS : TABBAR_HEIGHT_ANDROID;

  // Keep the bar above the home indicator / gesture area.
  const safeBottom = (insets.bottom || 0)

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        headerTitle: "",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#0A0A0A" },
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.10)",
          paddingTop: TABBAR_PADDING_TOP,
          paddingBottom: TABBAR_PADDING_BOTTOM + safeBottom,
          height: baseHeight + safeBottom,
        },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#6B6B6B",
        tabBarLabelPosition: "below-icon",
        tabBarShowLabel: true,
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Montserrat_500Medium",
          marginTop: 2,
          width: "100%",
          textAlign: "center",
        },
      }}
    >
      {/* 1) Weiteres (zeigt Einstellungen Screen) */}
      <Tabs.Screen
        name="einstellungen/index"
        options={{
          title: t("tab_settings"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size || 22} color={color} />
          ),
        }}
      />

      {/* 2) Bibliothek */}
      <Tabs.Screen
        name="bibliothek/index"
        options={{
          title: t("tab_library"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size || 22} color={color} />
          ),
        }}
      />

      {/* 3) Start */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size || 22} color={color} />
          ),
        }}
      />

      {/* 4) Statistik */}
      <Tabs.Screen
        name="statistik/index"
        options={{
          title: t("tab_stats"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="stats-chart-outline"
              size={size || 22}
              color={color}
            />
          ),
        }}
      />

      {/* 5) Premium */}
      <Tabs.Screen
        name="premium/index"
        options={{
          title: t("tab_premium"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}