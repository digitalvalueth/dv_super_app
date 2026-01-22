"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

// Mini App definitions
interface MiniApp {
  id: string;
  name: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  badge?: number;
  comingSoon?: boolean;
}

const MINI_APPS: MiniApp[] = [
  {
    id: "stock-counter",
    name: "นับสต็อก",
    description: "นับสินค้าด้วย AI",
    icon: "cube-outline",
    color: "#3B82F6",
    bgColor: "#EFF6FF",
    route: "/(mini-apps)/stock-counter",
  },
  {
    id: "speech-to-text",
    name: "Speech to Text",
    description: "แปลงเสียงเป็นข้อความ",
    icon: "mic-outline",
    color: "#8B5CF6",
    bgColor: "#F5F3FF",
    route: "/(mini-apps)/speech-to-text",
    comingSoon: true,
  },
  {
    id: "reports",
    name: "รายงาน",
    description: "ดูสถิติและรายงาน",
    icon: "bar-chart-outline",
    color: "#10B981",
    bgColor: "#ECFDF5",
    route: "/(mini-apps)/reports",
    comingSoon: true,
  },
  {
    id: "more",
    name: "เพิ่มเติม",
    description: "บริการอื่นๆ",
    icon: "apps-outline",
    color: "#6B7280",
    bgColor: "#F3F4F6",
    route: "/(tabs)/services",
  },
];

// Recent activity mock data
interface RecentActivity {
  id: string;
  miniAppId: string;
  title: string;
  subtitle: string;
  timestamp: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { colors, isDark } = useTheme();
  const [recentActivities] = useState<RecentActivity[]>([
    {
      id: "1",
      miniAppId: "stock-counter",
      title: "นับสต็อกสำเร็จ",
      subtitle: "สาขากรุงเทพฯ • 15 รายการ",
      timestamp: "2 ชม.ที่แล้ว",
      icon: "cube-outline",
      color: "#3B82F6",
    },
    {
      id: "2",
      miniAppId: "stock-counter",
      title: "รอตรวจสอบ",
      subtitle: "สาขาเชียงใหม่ • 8 รายการ",
      timestamp: "วานนี้",
      icon: "time-outline",
      color: "#F59E0B",
    },
  ]);

  const handleMiniAppPress = (app: MiniApp) => {
    console.log("🎯 Mini App pressed:", app.name, "Route:", app.route);

    if (app.comingSoon) {
      Alert.alert("เร็วๆ นี้", `${app.name} กำลังอยู่ระหว่างการพัฒนา`);
      return;
    }

    console.log("🚀 Navigating to:", app.route);

    // Use href with Link or router.replace for tab navigation
    try {
      router.replace(app.route as any);
    } catch (error) {
      console.error("Navigation error:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเปิดหน้านี้ได้");
    }
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "สวัสดีตอนเช้า";
    if (hour < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.appName, { color: colors.text }]}>
            Super Fitt
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.text}
            />
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Banner */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={[styles.userBanner, { backgroundColor: colors.primary }]}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.greeting}>{greeting()} 👋</Text>
              <Text style={styles.userName}>
                {user?.name || user?.email?.split("@")[0] || "ผู้ใช้"}
              </Text>
              <Text style={styles.companyName}>
                {user?.companyName || "ยังไม่ได้เลือกบริษัท"}
              </Text>
            </View>
            <View style={styles.bannerAvatar}>
              <Ionicons
                name="person-circle"
                size={60}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </View>
        </Animated.View>

        {/* Mini Apps Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              บริการของเรา
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/services")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                ดูทั้งหมด
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.miniAppsGrid}>
            {MINI_APPS.map((app, index) => (
              <Animated.View
                key={app.id}
                entering={FadeInRight.delay(150 * index).duration(400)}
              >
                {app.comingSoon ? (
                  <TouchableOpacity
                    style={[
                      styles.miniAppCard,
                      { backgroundColor: isDark ? colors.card : app.bgColor },
                      styles.comingSoonCard,
                    ]}
                    onPress={() =>
                      Alert.alert(
                        "เร็วๆ นี้",
                        `${app.name} กำลังอยู่ระหว่างการพัฒนา`,
                      )
                    }
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: app.color + "20" },
                      ]}
                    >
                      <Ionicons name={app.icon} size={28} color={app.color} />
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
                      style={[
                        styles.miniAppDesc,
                        { color: colors.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {app.description}
                    </Text>
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>เร็วๆ นี้</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <Link href={app.route as any} asChild>
                    <TouchableOpacity
                      style={[
                        styles.miniAppCard,
                        { backgroundColor: isDark ? colors.card : app.bgColor },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          { backgroundColor: app.color + "20" },
                        ]}
                      >
                        <Ionicons name={app.icon} size={28} color={app.color} />
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
                        style={[
                          styles.miniAppDesc,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {app.description}
                      </Text>
                      {app.badge && (
                        <View
                          style={[
                            styles.appBadge,
                            { backgroundColor: app.color },
                          ]}
                        >
                          <Text style={styles.appBadgeText}>{app.badge}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Link>
                )}
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              กิจกรรมล่าสุด
            </Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                ดูทั้งหมด
              </Text>
            </TouchableOpacity>
          </View>

          {recentActivities.map((activity, index) => (
            <Animated.View
              key={activity.id}
              entering={FadeInDown.delay(300 + 100 * index).duration(400)}
            >
              <TouchableOpacity
                style={[styles.activityCard, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: activity.color + "20" },
                  ]}
                >
                  <Ionicons
                    name={activity.icon}
                    size={24}
                    color={activity.color}
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityTitle, { color: colors.text }]}>
                    {activity.title}
                  </Text>
                  <Text
                    style={[
                      styles.activitySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {activity.subtitle}
                  </Text>
                </View>
                <Text
                  style={[styles.activityTime, { color: colors.textSecondary }]}
                >
                  {activity.timestamp}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}

          {recentActivities.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <Ionicons
                name="time-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                ยังไม่มีกิจกรรมล่าสุด
              </Text>
            </View>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            สถิติวันนี้
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons name="cube" size={24} color="#3B82F6" />
              <Text style={styles.statValue}>24</Text>
              <Text style={styles.statLabel}>รายการนับ</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#ECFDF5" }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text style={styles.statValue}>18</Text>
              <Text style={styles.statLabel}>สำเร็จ</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="time" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>6</Text>
              <Text style={styles.statLabel}>รอตรวจ</Text>
            </View>
          </View>
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
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appName: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  userBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  bannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bannerTextContainer: {
    flex: 1,
  },
  greeting: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  userName: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  companyName: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: 4,
  },
  bannerAvatar: {
    marginLeft: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "500",
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
  },
  comingSoonCard: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
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
  appBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  appBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 13,
  },
  activityTime: {
    fontSize: 12,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
});
