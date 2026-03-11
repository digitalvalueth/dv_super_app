import { db } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface DashboardStats {
  totalBA: number;
  checkedInToday: number;
  notCheckedIn: number;
  pendingReview: number;
  completedCounting: number;
  totalAssignments: number;
  missingCheckIn3Days: number;
}

export default function SupervisorDashboard() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalBA: 0,
    checkedInToday: 0,
    notCheckedIn: 0,
    pendingReview: 0,
    completedCounting: 0,
    totalAssignments: 0,
    missingCheckIn3Days: 0,
  });

  const loadStats = useCallback(async () => {
    if (!user?.companyId) return;

    try {
      // Fetch employees in supervisor's branch(es)
      const usersQuery = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId),
        where("role", "==", "employee"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const usersSnap = await getDocs(usersQuery);
      const totalBA = usersSnap.size;

      // Fetch today's check-ins
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkInsQuery = query(
        collection(db, "checkIns"),
        where("companyId", "==", user.companyId),
        where("type", "==", "check-in"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const checkInsSnap = await getDocs(checkInsQuery);
      const todayCheckIns = checkInsSnap.docs.filter((d) => {
        const createdAt = d.data().createdAt?.toDate?.();
        return createdAt && createdAt >= today;
      });

      // Fetch counting sessions with discrepancy (pending review)
      const sessionsQuery = query(
        collection(db, "countingSessions"),
        where("companyId", "==", user.companyId),
        where("status", "==", "completed"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      const pendingReview = sessionsSnap.docs.filter((d) => {
        const data = d.data();
        // Has dispute or discrepancy
        return (
          data.userReportedCount !== undefined ||
          (data.aiCount !== undefined &&
            data.currentCountQty !== undefined &&
            data.aiCount !== data.userReportedCount)
        );
      }).length;

      setStats({
        totalBA,
        checkedInToday: todayCheckIns.length,
        notCheckedIn: Math.max(0, totalBA - todayCheckIns.length),
        pendingReview,
        completedCounting: sessionsSnap.size,
        totalAssignments: 0,
        missingCheckIn3Days: 0,
      });
    } catch (error) {
      console.error("Error loading supervisor stats:", error);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const menuItems = [
    {
      id: "counting-review",
      title: "รีวิวยอดนับ",
      subtitle: `${stats.pendingReview} รายการรอตรวจ`,
      icon: "calculator-outline" as const,
      color: "#f59e0b",
      badge: stats.pendingReview,
      route: "/(mini-apps)/supervisor/counting-review",
    },
    {
      id: "team-status",
      title: "สถานะทีม",
      subtitle: `${stats.checkedInToday}/${stats.totalBA} เช็คอินแล้ว`,
      icon: "people-outline" as const,
      color: "#3b82f6",
      badge: stats.notCheckedIn,
      route: "/(mini-apps)/supervisor/team-status",
    },
    {
      id: "alerts",
      title: "แจ้งเตือน",
      subtitle: `${stats.missingCheckIn3Days} คนไม่เช็คอิน 3+ วัน`,
      icon: "notifications-outline" as const,
      color: "#ef4444",
      badge: stats.missingCheckIn3Days,
      route: "/(mini-apps)/supervisor/alerts",
    },
    {
      id: "supplement-review",
      title: "นับเสริม",
      subtitle: "ตรวจสอบการนับเสริมจากพนักงาน",
      icon: "layers-outline" as const,
      color: "#8b5cf6",
      badge: 0,
      route: "/(mini-apps)/supervisor/supplement-review",
    },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Supervisor Dashboard
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: colors.textSecondary }]}
          >
            {user?.branchName || "ทุกสาขา"}
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: "#3b82f6" }]}>
              {stats.totalBA}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              พนักงาน BA
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: "#10b981" }]}>
              {stats.checkedInToday}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              เช็คอินวันนี้
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: "#f59e0b" }]}>
              {stats.pendingReview}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              รอรีวิว
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.statNumber, { color: "#ef4444" }]}>
              {stats.notCheckedIn}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              ยังไม่เช็คอิน
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>เมนู</Text>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={() => router.push(item.route as any)}
          >
            <View
              style={[styles.menuIcon, { backgroundColor: item.color + "20" }]}
            >
              <Ionicons name={item.icon} size={24} color={item.color} />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text
                style={[styles.menuSubtitle, { color: colors.textSecondary }]}
              >
                {item.subtitle}
              </Text>
            </View>
            {item.badge > 0 && (
              <View style={[styles.badge, { backgroundColor: item.color }]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  headerSubtitle: { fontSize: 13 },
  content: { flex: 1 },
  contentContainer: { padding: 16, gap: 16, paddingBottom: 32 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: "47%",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statNumber: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: "600" },
  menuSubtitle: { fontSize: 13, marginTop: 2 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
