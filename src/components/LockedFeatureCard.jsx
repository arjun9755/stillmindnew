import { useI18n } from "@/utils/i18n";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useStillMindTheme } from "@/utils/stillmind-theme";

/**
 * Minimal, elegant lock overlay.
 *
 * Props:
 * - title: string
 * - subtitle: string (e.g. t("locked_pro_available"))
 * - primaryLabel: string
 * - secondaryLabel: string
 * - onPrimary: () => void
 * - onSecondary: () => void
 */
export default function LockedFeatureCard({
  title,
  subtitle = t("locked_pro_available"),
  primaryLabel,
  secondaryLabel = t("locked_compare_plans"),
  onPrimary,
  onSecondary,
}) {
  const { t } = useI18n();
  const _title = (title || t("unlock_btn"))
  const _primaryLabel = (primaryLabel || t("unlock_btn"))
  const { colors } = useStillMindTheme();

  return (
    <View
      style={{
        width: "100%",
        maxWidth: 460,
        borderRadius: 18,
        padding: 16,
        backgroundColor: "rgba(20,20,22,0.92)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <Text
        style={{
          fontFamily: "Montserrat_600SemiBold",
          color: "#F4F4F5",
          fontSize: 16,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 6,
          fontFamily: "Montserrat_400Regular",
          color: "rgba(244,244,245,0.82)",
          fontSize: 13,
          lineHeight: 18,
        }}
      >
        {subtitle}
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <TouchableOpacity
          onPress={onPrimary}
          activeOpacity={0.9}
          style={{
            flex: 1,
            borderRadius: 14,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: colors.accent || "#E7D19C",
          }}
        >
          <Text
            style={{
              fontFamily: "Montserrat_700Bold",
              color: "#0B0B0C",
              fontSize: 13,
            }}
          >
            {primaryLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSecondary}
          activeOpacity={0.85}
          style={{
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 14,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(231,209,156,0.55)",
            backgroundColor: "transparent",
          }}
        >
          <Text
            style={{
              fontFamily: "Montserrat_600SemiBold",
              color: "rgba(231,209,156,0.92)",
              fontSize: 12,
            }}
          >
            {secondaryLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
