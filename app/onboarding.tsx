import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Step = {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => Promise<boolean>;
};

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();

  const steps: Step[] = [
    {
      title: "กล้องถ่ายรูป",
      description: "ใช้กล้องเพื่อถ่ายรูปสินค้าสำหรับนับจำนวนอัตโนมัติด้วย AI",
      icon: "camera",
      action: async () => {
        const result = await requestCameraPermission();
        return result.granted;
      },
    },
    {
      title: "ตำแหน่งที่อยู่",
      description: "บันทึกตำแหน่งที่นับสินค้าเพื่อความถูกต้องและตรวจสอบได้",
      icon: "location",
      action: async () => {
        const result = await Location.requestForegroundPermissionsAsync();
        return result.granted;
      },
    },
  ];

  const handleNext = async () => {
    setIsLoading(true);
    try {
      const granted = await steps[currentStep].action();

      if (granted) {
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          // Save onboarding completed
          await AsyncStorage.setItem("onboarding_completed", "true");
          router.replace("/(tabs)/home");
        }
      } else {
        // User denied permission, show alert
        Alert.alert(
          "ต้องการสิทธิ์นี้",
          `แอปต้องการสิทธิ์${steps[currentStep].title}เพื่อใช้งานอย่างเต็มรูปแบบ`,
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("onboarding_completed", "true");
    router.replace("/(tabs)/home");
  };

  const currentStepData = steps[currentStep];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Gradient Background */}
      <LinearGradient
        colors={
          isDark
            ? ["#000000", "#1a1a1a", "#000000"]
            : ["#ffffff", "#f8f9fa", "#ffffff"]
        }
        style={styles.gradient}
      />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {steps.map((_, index) => (
          <View
            key={index}
            style={[
              styles.progressBar,
              {
                backgroundColor:
                  index <= currentStep ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Step Counter */}
        <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>
          {currentStep + 1} / {steps.length}
        </Text>

        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Ionicons
            name={currentStepData.icon}
            size={80}
            color={colors.primary}
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          {currentStepData.title}
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {currentStepData.description}
        </Text>

        {/* Features List */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.featureText, { color: colors.text }]}>
              {currentStep === 0
                ? "นับสินค้าอัตโนมัติด้วย AI"
                : "บันทึกตำแหน่งที่แม่นยำ"}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.featureText, { color: colors.text }]}>
              {currentStep === 0
                ? "ถ่ายรูปง่ายๆ ได้ผลทันที"
                : "ตรวจสอบย้อนหลังได้"}
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.featureText, { color: colors.text }]}>
              {currentStep === 0
                ? "รองรับหลายรูปแบบสินค้า"
                : "ปลอดภัย ไว้วางใจได้"}
            </Text>
          </View>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleNext}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>
            {isLoading
              ? "กำลังตรวจสอบ..."
              : currentStep === steps.length - 1
                ? "เริ่มใช้งาน"
                : "อนุญาต"}
          </Text>
          {!isLoading && (
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.skipButton]}
          onPress={handleSkip}
          disabled={isLoading}
        >
          <Text
            style={[styles.skipButtonText, { color: colors.textSecondary }]}
          >
            ข้ามไปก่อน
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  stepCounter: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  featuresList: {
    width: "100%",
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
    shadowColor: "#4285f4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
