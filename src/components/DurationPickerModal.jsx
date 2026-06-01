import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { Clock, Check } from "lucide-react-native";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n } from "@/utils/i18n";

const DURATION_OPTIONS_KEYS = [
  { value: 60,  key: "dur_opt_1" },
  { value: 120, key: "dur_opt_2" },
  { value: 300, key: "dur_opt_5" },
  { value: 600, key: "dur_opt_10" },
];

export default function DurationPickerModal({
  visible,
  onClose,
  initialDuration = 60,
  onDurationSelect,
}) {
  const { colors } = useStillMindTheme();
  const { t } = useI18n();
  const [selectedDuration, setSelectedDuration] = useState(initialDuration);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const handleConfirm = () => {
    onDurationSelect(selectedDuration);
    onClose();
  };

  if (!fontsLoaded) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: 20,
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primaryLight,
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Clock size={24} color={colors.primary} />
            </View>
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 18,
                color: colors.text,
                textAlign: "center",
              }}
            >
              {t("dur_pick_title")}
            </Text>
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 12,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {t("dur_pick_subtitle")}
            </Text>
          </View>

          {/* Duration Options */}
          <View style={{ marginBottom: 16 }}>
            {DURATION_OPTIONS_KEYS.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSelectedDuration(option.value)}
                style={{
                  backgroundColor:
                    selectedDuration === option.value
                      ? colors.primary
                      : colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: index < DURATION_OPTIONS.length - 1 ? 8 : 0,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Montserrat_600SemiBold",
                    fontSize: 16,
                    color:
                      selectedDuration === option.value
                        ? "#FFFFFF"
                        : colors.text,
                  }}
                >
                  {t(option.key)}
                </Text>
                {selectedDuration === option.value && (
                  <Check size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View
            style={{
              backgroundColor: colors.primaryLight,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 4,
              }}
            >
              {t("dur_pick_selected")}
            </Text>
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 28,
                color: colors.primary,
              }}
            >
              {t(DURATION_OPTIONS_KEYS.find((o) => o.value === selectedDuration)?.key || "dur_opt_1")}
            </Text>
          </View>

          {/* Buttons */}
          <TouchableOpacity
            onPress={handleConfirm}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            <Check size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 16,
                color: "#FFFFFF",
              }}
            >
              {t("dur_pick_confirm")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              {t("dur_pick_cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
