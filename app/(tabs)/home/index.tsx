"use client";

import { NotificationDropdown } from "@/components/notification-dropdown";
import { db } from "@/config/firebase";

import {
  ALL_MINI_APPS,
  DEFAULT_PINNED_IDS,
  MiniApp,
  PIN_STORAGE_KEY,
  PINNABLE_APPS,
} from "@/constants/mini-apps";
import {
  CacheKeys,
  CacheTTL,
  getOrFetch,
  removeCache,
} from "@/services/cache.service";
import { getEffectiveCountingPeriod } from "@/services/counting-period.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface DashboardStats {
  totalCounted: number;
  completedToday: number;
  pendingReview: number;
  totalProducts: number;
  discrepancy: number;
}

// Activity interface
interface RecentActivity {
  id: string;
  productName: string;
  branchName: string;
  status: string;
  finalCount: number;
  discrepancy: number;
  createdAt: Date | string; // may be string when restored from JSON cache
}

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalCounted: 0,
    completedToday: 0,
    pendingReview: 0,
    totalProducts: 0,
    discrepancy: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    [],
  );
  const [pinnedIds, setPinnedIds] = useState<string[]>(DEFAULT_PINNED_IDS);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user?.branchId ?? "",
  );
  const [selectedBranchName, setSelectedBranchName] = useState<string>(
    user?.branchName ?? "",
  );

  // Load pinned apps from storage
  useEffect(() => {
    AsyncStorage.getItem(PIN_STORAGE_KEY).then((val) => {
      if (val) {
        try {
          const ids = JSON.parse(val) as string[];
          if (ids.length > 0) setPinnedIds(ids);
        } catch {}
      }
    });
  }, []);

  const savePinned = useCallback((ids: string[]) => {
    setPinnedIds(ids);
    AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const unpinApp = useCallback(
    (appId: string) => {
      Alert.alert("เอาออกจากแอปด่วน?", "กดยืนยันเพื่อเอาออก", [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "เอาออก",
          style: "destructive",
          onPress: () => savePinned(pinnedIds.filter((id) => id !== appId)),
        },
      ]);
    },
    [pinnedIds, savePinned],
  );

  const pinApp = useCallback(
    (appId: string) => {
      if (!pinnedIds.includes(appId)) {
        savePinned([...pinnedIds, appId]);
      }
      setShowPinPicker(false);
    },
    [pinnedIds, savePinned],
  );

  // Sync selectedBranchId when user data first loads (e.g. after cold start)
  useEffect(() => {
    if (user?.branchId && !selectedBranchId) {
      setSelectedBranchId(user.branchId);
      setSelectedBranchName(user.branchName ?? "");
    }
  }, [user?.branchId]);

  const handleSelectBranch = useCallback(
    (bId: string, bName: string) => {
      if (bId === selectedBranchId) return;
      // Clear old data immediately so stale stats don't show
      setStats({
        totalCounted: 0,
        completedToday: 0,
        pendingReview: 0,
        totalProducts: 0,
        discrepancy: 0,
      });
      setRecentActivities([]);
      setSelectedBranchId(bId);
      setSelectedBranchName(bName);
    },
    [selectedBranchId],
  );

  const fetchDashboardData = useCallback(
    async (forceRefresh = false) => {
      if (!user?.companyId || !user?.branchId || !user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const branchId = selectedBranchId || user.branchId;
        const userId = user.uid;
        const cacheKey = CacheKeys.dashboardStats(branchId);

        // Use cache with 5 minute TTL
        const cachedStats = await getOrFetch(
          cacheKey,
          async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const now = new Date();
            const fallbackMonth = now.getMonth() + 1; // 1-12
            const fallbackYear = now.getFullYear();
            const fallbackHalf: 1 | 2 = now.getDate() <= 15 ? 1 : 2;

            const effectivePeriod = await getEffectiveCountingPeriod(
              user.companyId,
              now,
              { userId },
            );
            const targetMonth = effectivePeriod?.month ?? fallbackMonth;
            const targetYear = effectivePeriod?.year ?? fallbackYear;
            const targetHalf = effectivePeriod?.half ?? fallbackHalf;
            const periodMonth = `${targetYear}-${String(targetMonth).padStart(2, "0")}`;

            // ── 1. Assignment data (source of truth for products + counted) ──
            // NOTE: branchId filter is applied client-side to avoid composite index
            const assignmentsQuery = query(
              collection(db, "assignments"),
              where("userId", "==", userId),
              where("month", "==", targetMonth),
              where("year", "==", targetYear),
              where("half", "==", targetHalf),
            );
            const assignmentsSnapshot = await getDocs(assignmentsQuery);

            let totalProducts = 0;
            let totalCounted = 0;
            assignmentsSnapshot.forEach((doc) => {
              const d = doc.data();
              // Filter by selected branch client-side
              if (d.branchId && d.branchId !== branchId) return;
              totalProducts += (d.productIds || []).length;
              totalCounted += (d.completedProductIds || []).length;
            });

            // ── 2. Sessions for pending-review count + today activity ──
            const sessionsQuery = query(
              collection(db, "countingSessions"),
              where("userId", "==", userId),
              where("branchId", "==", branchId),
              orderBy("createdAt", "desc"),
              limit(50),
            );
            const sessionsSnapshot = await getDocs(sessionsQuery);

            let completedToday = 0;
            let pendingReview = 0;
            let totalDiscrepancy = 0;
            const activities: RecentActivity[] = [];

            sessionsSnapshot.forEach((doc) => {
              const data = doc.data();
              // Skip sessions from other periods (if periodMonth exists on doc)
              if (data.periodMonth && data.periodMonth !== periodMonth) return;

              const createdAt = data.createdAt?.toDate();

              if (createdAt && createdAt >= today) {
                if (data.status === "completed" || data.status === "approved") {
                  completedToday++;
                }
              }

              if (data.status === "pending-review") {
                pendingReview++;
              }

              totalDiscrepancy += Math.abs(data.discrepancy || 0);

              if (activities.length < 5) {
                activities.push({
                  id: doc.id,
                  productName: data.productName || "ไม่ระบุ",
                  branchName: data.branchName || "ไม่ระบุ",
                  status: data.status,
                  finalCount: data.finalCount || 0,
                  discrepancy: data.discrepancy || 0,
                  createdAt: createdAt || new Date(),
                });
              }
            });

            return {
              stats: {
                totalCounted,
                completedToday,
                pendingReview,
                totalProducts,
                discrepancy: totalDiscrepancy,
              },
              activities,
            };
          },
          CacheTTL.MEDIUM,
          forceRefresh,
        );

        setStats(cachedStats.stats);
        setRecentActivities(cachedStats.activities);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.companyId, user?.branchId, user?.uid, selectedBranchId],
  );

  useEffect(() => {
    // Force refresh when branch changes so cache from old branch isn't reused
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Force refresh - bypass cache
    const cacheTargetBranch = selectedBranchId || user?.branchId;
    if (cacheTargetBranch) {
      removeCache(CacheKeys.dashboardStats(cacheTargetBranch));
    }
    fetchDashboardData(true);
  }, [fetchDashboardData, user?.branchId]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "สวัสดีตอนเช้า";
    if (hour < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
        return { label: "สำเร็จ", color: "#10B981", icon: "checkmark-circle" };
      case "pending-review":
      case "pending":
        return { label: "รอตรวจสอบ", color: "#F59E0B", icon: "time" };
      case "rejected":
        return { label: "ถูกปฏิเสธ", color: "#EF4444", icon: "close-circle" };
      default:
        return { label: status, color: "#6B7280", icon: "help-circle" };
    }
  };

  const formatTimeAgo = (date: Date | string | undefined | null) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "เมื่อสักครู่";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
    if (diffDays === 1) return "เมื่อวาน";
    return `${diffDays} วันที่แล้ว`;
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            กำลังโหลดข้อมูล...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={[styles.appName, { color: colors.text }]}>FITT BSA</Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationDropdown />
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* User Banner with Gradient */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={isDark ? ["#1E40AF", "#3B82F6"] : ["#3B82F6", "#60A5FA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBanner}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerTextContainer}>
                <Text style={styles.greeting}>{greeting()} 👋</Text>
                <Text style={styles.userName}>
                  {user?.name || user?.email?.split("@")[0] || "ผู้ใช้"}
                </Text>
                <View style={styles.companyBadge}>
                  <Ionicons name="business-outline" size={14} color="#fff" />
                  <Text style={styles.companyName}>
                    {user?.companyName || "ยังไม่ได้เลือกบริษัท"}
                  </Text>
                </View>
              </View>
              <View style={styles.bannerAvatar}>
                {user?.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={32} color="#fff" />
                  </View>
                )}
              </View>
            </View>

            {/* Branch selector chips — visible only for multi-branch users */}
            {(user?.branchIds?.length ?? 0) > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.branchChipsRow}
                style={{ marginTop: 12, marginBottom: 4 }}
              >
                {user!.branchIds!.map((bId) => {
                  const bName = user?.branchNames?.[bId] ?? bId;
                  const isActive = bId === selectedBranchId;
                  return (
                    <TouchableOpacity
                      key={bId}
                      activeOpacity={0.75}
                      style={[
                        styles.branchChip,
                        isActive && styles.branchChipActive,
                      ]}
                      onPress={() => handleSelectBranch(bId, bName)}
                    >
                      <Ionicons
                        name="business-outline"
                        size={11}
                        color={isActive ? "#1D4ED8" : "rgba(255,255,255,0.85)"}
                      />
                      <Text
                        style={[
                          styles.branchChipText,
                          isActive && styles.branchChipTextActive,
                        ]}
                      >
                        {bName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Quick Stats in Banner */}
            <View style={styles.bannerStats}>
              <View style={styles.bannerStatItem}>
                <Text style={styles.bannerStatValue}>
                  {stats.totalProducts}
                </Text>
                <Text style={styles.bannerStatLabel}>สินค้า</Text>
              </View>
              <View style={styles.bannerStatDivider} />
              <View style={styles.bannerStatItem}>
                <Text style={styles.bannerStatValue}>{stats.totalCounted}</Text>
                <Text style={styles.bannerStatLabel}>นับแล้ว</Text>
              </View>
              <View style={styles.bannerStatDivider} />
              <View style={styles.bannerStatItem}>
                <Text style={styles.bannerStatValue}>
                  {stats.pendingReview}
                </Text>
                <Text style={styles.bannerStatLabel}>รอตรวจ</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Apps (Pinned) */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              แอปด่วน
            </Text>
            <TouchableOpacity
              onPress={() => setShowPinPicker(true)}
              style={[
                styles.pinAddBtn,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={[styles.pinAddText, { color: colors.primary }]}>
                เพิ่ม
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickAppsGrid}>
            {pinnedIds
              .map((id) => ALL_MINI_APPS.find((a) => a.id === id))
              .filter((app): app is MiniApp => !!app)
              .map((app, index) => (
                <Animated.View
                  key={app.id}
                  entering={FadeInUp.delay(200 + 60 * index).duration(400)}
                  style={styles.quickAppCell}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => router.push(app.route as any)}
                    onLongPress={() => unpinApp(app.id)}
                    delayLongPress={500}
                    style={styles.quickAppItem}
                  >
                    <View style={styles.quickAppIconWrap}>
                      <LinearGradient
                        colors={app.gradientColors}
                        style={styles.quickAppIcon}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name={app.icon} size={26} color="#fff" />
                      </LinearGradient>
                    </View>
                    <Text
                      style={[styles.quickAppName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {app.name}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            {/* + slot when fewer than 8 pinned */}
            {pinnedIds.length < 8 && (
              <View style={styles.quickAppCell}>
                <TouchableOpacity
                  style={styles.quickAppItem}
                  activeOpacity={0.7}
                  onPress={() => setShowPinPicker(true)}
                >
                  <View
                    style={[
                      styles.quickAppIcon,
                      styles.quickAppAddSlot,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name="add"
                      size={26}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text
                    style={[
                      styles.quickAppName,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    เพิ่ม
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={[styles.pinHint, { color: colors.textSecondary }]}>
            กดค้างที่ไอคอนเพื่อเอาออก
          </Text>
        </Animated.View>

        {/* Pin Picker Modal */}
        <Modal
          visible={showPinPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPinPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPinPicker(false)}
          />
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View
              style={[styles.modalHandle, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              เลือกแอปที่ต้องการปัก
            </Text>
            <ScrollView>
              {PINNABLE_APPS.map((app) => {
                const isPinned = pinnedIds.includes(app.id);
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={[
                      styles.modalRow,
                      { borderBottomColor: colors.border },
                      isPinned && { opacity: 0.4 },
                    ]}
                    activeOpacity={isPinned ? 1 : 0.7}
                    onPress={() => !isPinned && pinApp(app.id)}
                  >
                    <LinearGradient
                      colors={app.gradientColors}
                      style={styles.modalAppIcon}
                    >
                      <Ionicons name={app.icon} size={22} color="#fff" />
                    </LinearGradient>
                    <Text style={[styles.modalAppName, { color: colors.text }]}>
                      {app.name}
                    </Text>
                    {isPinned ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.primary}
                      />
                    ) : (
                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color={colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Today's Stats */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(500)}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            สถิติวันนี้
          </Text>
          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: isDark ? colors.card : "#EFF6FF" },
              ]}
            >
              <View
                style={[styles.statIconBg, { backgroundColor: "#3B82F620" }]}
              >
                <Ionicons name="cube" size={22} color="#3B82F6" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.completedToday}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                นับวันนี้
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: isDark ? colors.card : "#ECFDF5" },
              ]}
            >
              <View
                style={[styles.statIconBg, { backgroundColor: "#10B98120" }]}
              >
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.totalCounted}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                นับทั้งหมด
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: isDark ? colors.card : "#FEF3C7" },
              ]}
            >
              <View
                style={[styles.statIconBg, { backgroundColor: "#F59E0B20" }]}
              >
                <Ionicons name="time" size={22} color="#F59E0B" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.pendingReview}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                รอตรวจสอบ
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: isDark ? colors.card : "#FEE2E2" },
              ]}
            >
              <View
                style={[styles.statIconBg, { backgroundColor: "#EF444420" }]}
              >
                <Ionicons name="trending-down" size={22} color="#EF4444" />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.discrepancy}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                ของหาย
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Recent Activity Section */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(500)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              กิจกรรมล่าสุด
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(mini-apps)/stock-counter")}
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>
                ดูทั้งหมด
              </Text>
            </TouchableOpacity>
          </View>

          {recentActivities.length > 0 ? (
            <View style={styles.activitiesContainer}>
              {recentActivities.map((activity, index) => {
                const statusInfo = getStatusInfo(activity.status);
                return (
                  <Animated.View
                    key={activity.id}
                    entering={FadeInRight.delay(600 + 80 * index).duration(400)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.activityCard,
                        { backgroundColor: colors.card },
                      ]}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.activityIcon,
                          { backgroundColor: statusInfo.color + "15" },
                        ]}
                      >
                        <Ionicons
                          name={statusInfo.icon as any}
                          size={22}
                          color={statusInfo.color}
                        />
                      </View>
                      <View style={styles.activityContent}>
                        <Text
                          style={[styles.activityTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {activity.productName}
                        </Text>
                        <Text
                          style={[
                            styles.activitySubtitle,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {activity.branchName} • นับได้ {activity.finalCount}{" "}
                          ชิ้น
                        </Text>
                      </View>
                      <View style={styles.activityMeta}>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusInfo.color + "15" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              { color: statusInfo.color },
                            ]}
                          >
                            {statusInfo.label}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.activityTime,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {formatTimeAgo(activity.createdAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
              <View style={styles.emptyIconContainer}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color={colors.textSecondary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                ยังไม่มีกิจกรรม
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                เริ่มนับสต็อกเพื่อดูกิจกรรมที่นี่
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push("/(mini-apps)/stock-counter")}
              >
                <LinearGradient
                  colors={["#3B82F6", "#1D4ED8"]}
                  style={styles.emptyButtonGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.emptyButtonText}>เริ่มนับสต็อก</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
    gap: 10,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 10,
    borderRadius: 12,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: "hidden",
  },
  bannerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bannerTextContainer: {
    flex: 1,
  },
  greeting: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  companyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  companyName: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "500",
  },
  bannerAvatar: {
    marginLeft: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  bannerStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  bannerStatItem: {
    alignItems: "center",
  },
  bannerStatValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  bannerStatLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    marginTop: 2,
  },
  bannerStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  branchChipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  branchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginRight: 8,
  },
  branchChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  branchChipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  branchChipTextActive: {
    color: "#1D4ED8",
    fontWeight: "700",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
  },
  quickAccessGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    paddingVertical: 8,
  },
  quickAccessItem: {
    alignItems: "center",
    width: 72,
  },
  quickAccessIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickAccessIconDisabled: {
    opacity: 0.6,
  },
  quickAccessName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  miniAppsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  miniAppWrapper: {
    width: CARD_WIDTH,
  },
  miniAppCard: {
    padding: 16,
    borderRadius: 16,
    position: "relative",
    minHeight: 130,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconGradient: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  miniAppName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  miniAppDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  comingSoonBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#6B7280",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  comingSoonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    width: (width - 54) / 2,
    padding: 16,
    borderRadius: 16,
    alignItems: "flex-start",
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  activitiesContainer: {
    gap: 10,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
  },
  activityIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
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
    marginBottom: 3,
  },
  activitySubtitle: {
    fontSize: 13,
  },
  activityMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activityTime: {
    fontSize: 11,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(107, 114, 128, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  emptyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // Pin add button
  pinAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  pinAddText: {
    fontSize: 13,
    fontWeight: "600",
  },
  pinHint: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: "65%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  modalAppIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  modalAppName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  // Quick Apps
  quickAppsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  quickAppCell: {
    width: (width - 32) / 4,
    alignItems: "center",
    paddingVertical: 8,
  },
  quickAppItem: {
    alignItems: "center",
    width: "100%",
  },
  quickAppIconWrap: {
    position: "relative",
    marginBottom: 6,
  },
  quickAppIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  quickAppAddSlot: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  quickAppBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#6B7280",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  quickAppBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  quickAppName: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
});
