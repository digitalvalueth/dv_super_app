"use client";

import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

// Service categories
interface ServiceCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const CATEGORIES: ServiceCategory[] = [
  { id: "all", name: "ทั้งหมด", icon: "apps", color: "#6B7280" },
  { id: "inventory", name: "คลังสินค้า", icon: "cube", color: "#3B82F6" },
  { id: "tools", name: "เครื่องมือ", icon: "construct", color: "#8B5CF6" },
  { id: "reports", name: "รายงาน", icon: "bar-chart", color: "#10B981" },
];

// All Mini Apps
interface MiniApp {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  category: string;
  comingSoon?: boolean;
}

const ALL_MINI_APPS: MiniApp[] = [
  {
    id: "check-in",
    name: "เช็คชื่อพนักงาน",
    description: "ลงเวลาเข้า-ออกงาน",
    icon: "person-circle-outline",
    color: "#10B981",
    bgColor: "#D1FAE5",
    route: "/(mini-apps)/check-in",
    category: "tools",
  },
  {
    id: "stock-counter",
    name: "นับสต็อก",
    description: "นับสินค้าด้วย AI Camera",
    icon: "cube-outline",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    route: "/(mini-apps)/stock-counter",
    category: "inventory",
  },
  {
    id: "history",
    name: "ประวัติการนับ",
    description: "ดูประวัติการนับสต็อก",
    icon: "time-outline",
    color: "#0EA5E9",
    bgColor: "#F0F9FF",
    route: "/(mini-apps)/stock-counter/history",
    category: "inventory",
  },
  {
    id: "speech-to-text",
    name: "Speech to Text",
    description: "แปลงเสียงเป็นข้อความ",
    icon: "mic-outline",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
    route: "/(mini-apps)/speech-to-text",
    category: "tools",
    comingSoon: true,
  },
  {
    id: "scanner",
    name: "Barcode Scanner",
    description: "สแกนบาร์โค้ดสินค้า",
    icon: "barcode-outline",
    color: "#EC4899",
    bgColor: "#FDF2F8",
    route: "/(mini-apps)/scanner",
    category: "tools",
    comingSoon: true,
  },
  {
    id: "reports",
    name: "รายงานสรุป",
    description: "ดูสถิติและรายงาน",
    icon: "bar-chart-outline",
    color: "#10B981",
    bgColor: "#ECFDF5",
    route: "/(mini-apps)/reports",
    category: "reports",
    comingSoon: true,
  },
  {
    id: "export",
    name: "ส่งออกข้อมูล",
    description: "Export เป็น Excel/PDF",
    icon: "download-outline",
    color: "#F59E0B",
    bgColor: "#FFFBEB",
    route: "/(mini-apps)/export",
    category: "reports",
    comingSoon: true,
  },
];

export default function ServicesScreen() {
  const { colors, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = React.useState("all");

  const filteredApps =
    selectedCategory === "all"
      ? ALL_MINI_APPS
      : ALL_MINI_APPS.filter((app) => app.category === selectedCategory);

  const handleMiniAppPress = (app: MiniApp) => {
    if (app.comingSoon) {
      // Show coming soon alert
      return;
    }
    router.push(app.route as any);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>บริการ</Text>
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor:
                  selectedCategory === category.id
                    ? colors.primary
                    : isDark
                      ? colors.card
                      : "#F3F4F6",
              },
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons
              name={category.icon}
              size={16}
              color={selectedCategory === category.id ? "#fff" : category.color}
            />
            <Text
              style={[
                styles.categoryText,
                {
                  color:
                    selectedCategory === category.id
                      ? "#fff"
                      : isDark
                        ? colors.text
                        : "#4B5563",
                },
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mini Apps Grid */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.miniAppsGrid}>
          {filteredApps.map((app, index) => (
            <Animated.View
              key={app.id}
              entering={FadeInDown.delay(50 * index).duration(300)}
            >
              <TouchableOpacity
                style={[
                  styles.miniAppCard,
                  { backgroundColor: isDark ? colors.card : app.bgColor },
                  app.comingSoon && styles.comingSoonCard,
                ]}
                onPress={() => handleMiniAppPress(app)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: app.color + "20" },
                  ]}
                >
                  <Ionicons name={app.icon} size={32} color={app.color} />
                </View>
                <Text
                  style={[
                    styles.miniAppName,
                    { color: isDark ? colors.text : "#1F2937" },
                  ]}
                  numberOfLines={1}
                >
                  {app.name}
                </Text>
                <Text
                  style={[styles.miniAppDesc, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {app.description}
                </Text>
                {app.comingSoon && (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>เร็วๆ นี้</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  searchButton: {
    padding: 8,
  },
  categoriesContainer: {
    maxHeight: 50,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  miniAppsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  miniAppCard: {
    width: CARD_WIDTH,
    padding: 16,
    borderRadius: 16,
    position: "relative",
    minHeight: 140,
  },
  comingSoonCard: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  miniAppName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  miniAppDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  comingSoonBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#6B7280",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  comingSoonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
});
