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

export default function TimePickerModal({
  visible,
  onClose,
  initialTime = "12:30",
  onTimeSelect,
}) {
  const { colors } = useStillMindTheme();
  const { t } = useI18n();
  const [selectedHour, setSelectedHour] = useState(
    parseInt(initialTime.split(":")[0]),
  );
  const [selectedMinute, setSelectedMinute] = useState(
    parseInt(initialTime.split(":")[1]),
  );

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = [0, 15, 30, 45];

  const handleConfirm = () => {
    const timeString = `${selectedHour.toString().padStart(2, "0")}:${selectedMinute.toString().padStart(2, "0")}`;
    onTimeSelect(timeString);
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
              }}
            >
              {t("time_pick_title")}
            </Text>
          </View>

          {/* Time Selection */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            {/* Hours */}
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={{
                  fontFamily: "Montserrat_500Medium",
                  fontSize: 12,
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {t("time_pick_hour")}
              </Text>
              <ScrollView
                style={{
                  maxHeight: 200,
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                }}
                contentContainerStyle={{ padding: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => setSelectedHour(hour)}
                    style={{
                      backgroundColor:
                        selectedHour === hour
                          ? colors.primary
                          : colors.background,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 4,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Montserrat_600SemiBold",
                        fontSize: 16,
                        color: selectedHour === hour ? "#FFFFFF" : colors.text,
                      }}
                    >
                      {hour.toString().padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minutes */}
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text
                style={{
                  fontFamily: "Montserrat_500Medium",
                  fontSize: 12,
                  color: colors.textSecondary,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                {t("time_pick_minute")}
              </Text>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 8,
                }}
              >
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    onPress={() => setSelectedMinute(minute)}
                    style={{
                      backgroundColor:
                        selectedMinute === minute
                          ? colors.primary
                          : colors.background,
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 4,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Montserrat_600SemiBold",
                        fontSize: 16,
                        color:
                          selectedMinute === minute ? "#FFFFFF" : colors.text,
                      }}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
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
              {t("time_pick_selected")}
            </Text>
            <Text
              style={{
                fontFamily: "Montserrat_600SemiBold",
                fontSize: 28,
                color: colors.primary,
              }}
            >
              {selectedHour.toString().padStart(2, "0")}:
              {selectedMinute.toString().padStart(2, "0")}
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
              {t("time_pick_confirm")}
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
              {t("time_pick_cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
