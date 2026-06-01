import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, KeyboardAvoidingView, Platform, DeviceEventEmitter } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
} from "@expo-google-fonts/montserrat";
import { router } from "expo-router";
import { Check } from "lucide-react-native";
import { useStillMindTheme } from "@/utils/stillmind-theme";
import { useI18n, setLanguage, getLanguage, SUPPORTED_LANGUAGES } from "@/utils/i18n";
import {
  saveUserPreferences,
  setOnboardingCompleted,
  setLocalDataConsent,
  saveUserName,
  setUserPlan,
} from "@/utils/storage";
import TrialWelcomeModal from "@/components/TrialWelcomeModal";
import { usePurchases } from "@/utils/usePurchases";
import { PRODUCT_IDS } from "@/utils/revenuecat";

// ✅ Remote-Logo (kein Asset nötig)
const STILLMIND_LOGO = require("../../assets/brand/stillmind-logo-transparent.png");

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors, isDark } = useStillMindTheme();

  const { purchase, getPackageByProductId, processing: purchaseProcessing } = usePurchases();

  const [step, setStep] = useState(0);
  const [selectedLang, setSelectedLang] = useState(getLanguage());
  const [userName, setUserName] = useState("");
  const [selectedPreferences, setSelectedPreferences] = useState([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showTrial, setShowTrial] = useState(false);

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
  });

  const preferences = useMemo(
    () => [
      t("onb_pref_stress"),
      t("onb_pref_sleep"),
      t("onb_pref_focus"),
      t("onb_pref_emotion"),
    ],
    [t]
  );

  const togglePreference = (pref) => {
    setSelectedPreferences((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  };

  const handleContinue = async () => {
    // Step 0 → Brand screen, just advance
    if (step === 0) { setStep(1); return; }

    // Step 1 → Language selection, just advance (setLanguage already called on tap)
    if (step === 1) { setStep(2); return; }

    // Step 2 → Name input
    if (step === 2) {
      if (userName.trim()) {
        try { await saveUserName(userName.trim()); } catch (_) {}
      }
      setStep(3);
      return;
    }

    // Step 3 → Preferences
    if (step === 3) {
      await saveUserPreferences(selectedPreferences);
      setStep(4);
      return;
    }

    // Step 4 → Anleitung, just advance
    if (step === 4) { setStep(5); return; }

    // Step 5 → Consent
    if (step === 5) {
      if (!consentChecked) return;
      await setLocalDataConsent(true);
      await setOnboardingCompleted();
      setShowTrial(true);
      return;
    }

    setStep(step + 1);
  };

  const disabled =
    (step === 3 && selectedPreferences.length === 0) ||
    (step === 5 && !consentChecked);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // ======================
  // UI Helpers
  // ======================
  const Title = ({ children, mb = 10 }) => (
    <Text
      style={{
        fontFamily: "Montserrat_600SemiBold",
        fontSize: 34,
        color: colors.text,
        marginBottom: mb,
        lineHeight: 40,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </Text>
  );

  const Subtitle = ({ children, mb = 22 }) => (
    <Text
      style={{
        fontFamily: "Montserrat_400Regular",
        fontSize: 16,
        color: colors.textSecondary,
        lineHeight: 26,
        marginBottom: mb,
      }}
    >
      {children}
    </Text>
  );

  const Eyebrow = ({ children, mt = 0, mb = 14 }) => (
    <Text
      style={{
        marginTop: mt,
        marginBottom: mb,
        fontFamily: "Montserrat_500Medium",
        fontSize: 11,
        letterSpacing: 1.6,
        color: colors.textSecondary,
        opacity: 0.85,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );

  const Hairline = ({ mt = 12, mb = 12 }) => (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.22,
        marginTop: mt,
        marginBottom: mb,
      }}
    />
  );

  const StepRow = ({ n, text }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 10,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          marginRight: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
        }}
      >
        <Text
          style={{
            fontFamily: "Montserrat_600SemiBold",
            fontSize: 12,
            color: colors.text,
            opacity: 0.9,
          }}
        >
          {n}
        </Text>
      </View>

      <Text
        style={{
          fontFamily: "Montserrat_500Medium",
          fontSize: 15.5,
          color: colors.text,
          opacity: 0.94,
          lineHeight: 23,
          flex: 1,
          marginTop: 2,
        }}
      >
        {text}
      </Text>
    </View>
  );

  const NoteInline = ({ children }) => (
    <View
      style={{
        marginTop: 16,
        paddingLeft: 12,
        borderLeftWidth: 3,
        borderLeftColor: "rgba(255,255,255,0.22)",
      }}
    >
      <Text
        style={{
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 13,
          color: colors.text,
          opacity: 0.92,
          lineHeight: 18,
        }}
      >
        {children}
      </Text>
    </View>
  );

  const PrimaryButton = ({ label, onPress, disabled }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "rgba(255,255,255,0.10)" : colors.primary,
        borderRadius: 18,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 26,
        borderWidth: disabled ? 1 : 0,
        borderColor: disabled ? "rgba(255,255,255,0.10)" : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: "Montserrat_600SemiBold",
          fontSize: 16,
          color: disabled ? "rgba(255,255,255,0.55)" : "#FFFFFF",
          letterSpacing: 0.25,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const Dots = () => (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 14,
        gap: 8,
      }}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 22 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor:
              i === step ? colors.primary : "rgba(255,255,255,0.18)",
          }}
        />
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <TrialWelcomeModal
        visible={showTrial}
        purchasing={purchaseProcessing}
        onStartChallenge={async () => {
          try {
            const pkg = getPackageByProductId(PRODUCT_IDS.PRO_MONTHLY);
            if (pkg) {
              const result = await purchase(pkg);
              if (result && result.success) {
                DeviceEventEmitter.emit("stillmind:planChanged");
              }
            }
          } catch (_) {}
          setShowTrial(false);
          router.replace("/mode-selection");
        }}
        onClose={() => { setShowTrial(false); router.replace("/mode-selection"); }}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 30,
          paddingBottom: insets.bottom + 18,
          paddingHorizontal: 24,
        }}
      >
        {/* ======================
            STEP 0 — Brand (Divider exakt mittig + gleiche Abstände)
           ====================== */}
        {step === 0 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <View style={{ alignItems: "center", width: "100%" }}>
              <Image
                source={STILLMIND_LOGO}
                resizeMode="contain"
                style={{
                  width: 340,
                  height: 340,
                  opacity: 0.98,
                }}
              />

              {/* ✅ EXAKT gleiche Abstände oben/unten */}
              <View style={{ height: 24 }} />

              <View
                style={{
                  width: 86, // minimal länger, wirkt optisch zentrierter,
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  alignSelf: "center",
                }}
              />

              <View style={{ height: 24 }} />

              <Text
                style={{
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 17,
                  color: colors.text,
                  opacity: 0.82,
                  lineHeight: 26,
                  textAlign: "center",
                  paddingHorizontal: 18,
                }}
              >
                60 Sekunden Ruhe{"\n"}ohne Anmeldung, ohne Werbung.
              </Text>
            </View>
          </View>
        )}

        {/* ======================
            STEP 1 — Sprache wählen
           ====================== */}
        {step === 1 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title mb={10}>{t("language")}</Title>
            <Subtitle mb={28}>{t("language_sub")}</Subtitle>

            {SUPPORTED_LANGUAGES.map((lang) => {
              const selected = selectedLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    setLanguage(lang.code);
                    setSelectedLang(lang.code);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: selected ? colors.primary : "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : "rgba(255,255,255,0.10)",
                    borderRadius: 18,
                    paddingVertical: 18,
                    paddingHorizontal: 20,
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 14 }}>{lang.flag}</Text>
                  <Text
                    style={{
                      fontFamily: "Montserrat_500Medium",
                      fontSize: 17,
                      color: selected ? "#FFFFFF" : colors.text,
                      letterSpacing: 0.15,
                      flex: 1,
                    }}
                  >
                    {lang.label}
                  </Text>
                  {selected && <Check size={20} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}

            <PrimaryButton label={t("continue")} onPress={handleContinue} disabled={false} />
          </View>
        )}

        {/* ======================
            STEP 2 — Name eingeben
           ====================== */}
        {step === 2 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title mb={10}>{t("onb_name_title")}</Title>
            <Subtitle mb={28}>{t("onb_name_sub")}</Subtitle>
            <TextInput
              value={userName}
              onChangeText={setUserName}
              placeholder={t("onb_name_placeholder")}
              placeholderTextColor="rgba(255,255,255,0.30)"
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={40}
              style={{
                fontFamily: "Montserrat_500Medium",
                fontSize: 18,
                color: colors.text,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: userName.trim()
                  ? colors.primary
                  : "rgba(255,255,255,0.12)",
                borderRadius: 16,
                paddingVertical: 18,
                paddingHorizontal: 20,
              }}
              autoFocus
            />
            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 12,
                color: "rgba(255,255,255,0.35)",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {t("onb_name_skip")}
            </Text>
          </View>
        )}

        {/* ======================
            STEP 2 — Preferences
           ====================== */}
        {step === 3 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title mb={14}>{t("onb_pref_title")}</Title>
            <Subtitle mb={26}>{t("onb_pref_sub")}</Subtitle>

            {preferences.map((pref) => {
              const selected = selectedPreferences.includes(pref);
              return (
                <TouchableOpacity
                  key={pref}
                  onPress={() => togglePreference(pref)}
                  style={{
                    backgroundColor: selected
                      ? colors.primary
                      : "rgba(255,255,255,0.06)",
                    borderWidth: 1,
                    borderColor: selected
                      ? colors.primary
                      : "rgba(255,255,255,0.10)",
                    borderRadius: 18,
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Montserrat_500Medium",
                      fontSize: 16,
                      color: selected ? "#FFFFFF" : colors.text,
                      letterSpacing: 0.15,
                    }}
                  >
                    {pref}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ======================
            STEP 3 — Anleitung (ausführlich)
           ====================== */}
        {step === 4 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title mb={12}>{t("onb_how_title")}</Title>
            <Eyebrow>{t("onb_how_eyebrow")}</Eyebrow>

            <StepRow
              n="1"
              text={t("onb_how_step1")}
            />
            <Hairline mt={10} mb={10} />
            <StepRow
              n="2"
              text={t("onb_how_step2")}
            />
            <Hairline mt={10} mb={10} />
            <StepRow
              n="3"
              text={t("onb_how_step3")}
            />

            <Hairline mt={22} mb={18} />

            <Eyebrow>{t("onb_session_eyebrow")}</Eyebrow>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 15.5,
                color: colors.text,
                opacity: 0.92,
                lineHeight: 24,
                marginBottom: 14,
              }}
            >
              {t("onb_session_ring")}
            </Text>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 15.5,
                color: colors.text,
                opacity: 0.92,
                lineHeight: 24,
              }}
            >
              {t("onb_session_pause")}
            </Text>

            <NoteInline>
              {t("onb_session_note")}
            </NoteInline>
          </View>
        )}

        {/* ======================
            STEP 4 — Consent
           ====================== */}
        {step === 5 && (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Title mb={14}>{t("onb_consent_title")}</Title>

            <Text
              style={{
                fontFamily: "Montserrat_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                lineHeight: 26,
                marginBottom: 26,
              }}
            >
              {t("onb_consent_body")}
            </Text>

            <TouchableOpacity
              onPress={() => setConsentChecked(!consentChecked)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
              }}
              activeOpacity={0.9}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: consentChecked
                    ? colors.primary
                    : "rgba(255,255,255,0.18)",
                  backgroundColor: consentChecked
                    ? colors.primary
                    : "transparent",
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                {consentChecked && <Check size={16} color="#FFFFFF" />}
              </View>

              <Text
                style={{
                  fontFamily: "Montserrat_400Regular",
                  fontSize: 14,
                  color: colors.text,
                  lineHeight: 22,
                  flex: 1,
                }}
              >
                {t("onb_consent_check")}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step !== 1 && (
          <PrimaryButton
            label={step === 5 ? t("agree_continue") : t("continue")}
            onPress={handleContinue}
            disabled={disabled}
          />
        )}

        <Dots />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}