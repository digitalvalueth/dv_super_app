"use client";

import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SpeechToTextScreen() {
  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Coming Soon Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={[styles.comingSoonCard, { backgroundColor: colors.card }]}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="mic" size={64} color="#8B5CF6" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Speech to Text
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            แปลงเสียงพูดเป็นข้อความอัตโนมัติ{"\n"}
            สำหรับบันทึกข้อมูลและจดบันทึก
          </Text>

          <View style={styles.featureList}>
            <FeatureItem
              icon="checkmark-circle"
              text="รองรับภาษาไทยและอังกฤษ"
              color={colors}
            />
            <FeatureItem
              icon="checkmark-circle"
              text="แปลงเสียงแบบ Real-time"
              color={colors}
            />
            <FeatureItem
              icon="checkmark-circle"
              text="Export เป็นข้อความ"
              color={colors}
            />
          </View>

          <View style={styles.comingSoonBadge}>
            <Ionicons name="time-outline" size={20} color="#F59E0B" />
            <Text style={styles.comingSoonText}>Coming Soon</Text>
          </View>
        </Animated.View>

        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.card }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            กลับหน้าหลัก
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({
  icon,
  text,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: any;
}) {
  return (
    <View style={styles.featureItem}>
      <Ionicons name={icon} size={20} color="#10B981" />
      <Text style={[styles.featureText, { color: color.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: "center",
  },
  comingSoonCard: {
    width: "100%",
    padding: 32,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#8B5CF620",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  featureList: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureText: {
    fontSize: 15,
  },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  comingSoonText: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
