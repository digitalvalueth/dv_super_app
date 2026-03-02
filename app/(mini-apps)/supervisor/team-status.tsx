import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";

interface TeamMember {
  uid: string;
  name: string;
  branchName?: string;
  checkedInToday: boolean;
  checkInTime?: string;
  countingSessionsToday: number;
  lastCountingTime?: string;
}

export default function TeamStatusScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTeamStatus = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      // Get BA employees
      const usersQuery = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId),
        where("role", "==", "employee"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const usersSnap = await getDocs(usersQuery);

      // Today range
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Check-ins today
      const checkInQuery = query(
        collection(db, "checkIns"),
        where("companyId", "==", user.companyId),
        where("timestamp", ">=", Timestamp.fromDate(todayStart)),
        where("timestamp", "<=", Timestamp.fromDate(todayEnd)),
      );
      const checkInsSnap = await getDocs(checkInQuery);

      const checkInMap = new Map<string, any>();
      checkInsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId) checkInMap.set(data.userId, data);
      });

      // Counting sessions today
      const countQuery = query(
        collection(db, "countingSessions"),
        where("companyId", "==", user.companyId),
        where("createdAt", ">=", Timestamp.fromDate(todayStart)),
        where("createdAt", "<=", Timestamp.fromDate(todayEnd)),
      );
      const countSnap = await getDocs(countQuery);

      const countMap = new Map<string, number>();
      const lastCountMap = new Map<string, Date>();
      countSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId) {
          countMap.set(data.userId, (countMap.get(data.userId) || 0) + 1);
          const ts = data.createdAt?.toDate?.();
          if (ts) {
            const existing = lastCountMap.get(data.userId);
            if (!existing || ts > existing) {
              lastCountMap.set(data.userId, ts);
            }
          }
        }
      });

      // Build team data
      const teamData: TeamMember[] = usersSnap.docs.map((d) => {
        const data = d.data();
        const uid = d.id;
        const checkIn = checkInMap.get(uid);
        const checkInTime = checkIn?.timestamp?.toDate?.();

        return {
          uid,
          name: data.name || data.email || "Unknown",
          branchName: data.branchName || "",
          checkedInToday: !!checkIn,
          checkInTime: checkInTime
            ? checkInTime.toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
          countingSessionsToday: countMap.get(uid) || 0,
          lastCountingTime: lastCountMap.get(uid)
            ? lastCountMap.get(uid)!.toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : undefined,
        };
      });

      // Sort: not checked in first, then by name
      teamData.sort((a, b) => {
        if (a.checkedInToday !== b.checkedInToday) {
          return a.checkedInToday ? 1 : -1;
        }
        return a.name.localeCompare(b.name, "th");
      });

      setMembers(teamData);
    } catch (error) {
      console.error("Error loading team status:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeamStatus();
  }, [loadTeamStatus]);

  const stats = {
    total: members.length,
    checkedIn: members.filter((m) => m.checkedInToday).length,
    notCheckedIn: members.filter((m) => !m.checkedInToday).length,
    withCounting: members.filter((m) => m.countingSessionsToday > 0).length,
  };

  const renderMember = ({ item }: { item: TeamMember }) => (
    <View style={[styles.memberCard, { backgroundColor: colors.card }]}>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: item.checkedInToday ? "#10b981" : "#ef4444" },
        ]}
      />
      <View style={styles.memberInfo}>
        <Text style={[styles.memberName, { color: colors.text }]}>{item.name}</Text>
        {item.branchName ? (
          <Text style={[styles.branchText, { color: colors.textSecondary }]}>
            {item.branchName}
          </Text>
        ) : null}
      </View>
      <View style={styles.memberStats}>
        {item.checkedInToday ? (
          <View style={styles.memberStatRow}>
            <Ionicons name="log-in-outline" size={14} color="#10b981" />
            <Text style={[styles.memberStatText, { color: "#10b981" }]}>
              {item.checkInTime}
            </Text>
          </View>
        ) : (
          <Text style={[styles.notCheckedIn, { color: "#ef4444" }]}>ยังไม่เช็คอิน</Text>
        )}
        <View style={styles.memberStatRow}>
          <Ionicons name="camera-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.memberStatText, { color: colors.textSecondary }]}>
            นับ {item.countingSessionsToday} รายการ
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ทั้งหมด</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: "#10b981" }]}>{stats.checkedIn}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>เช็คอิน</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: "#ef4444" }]}>{stats.notCheckedIn}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ยังไม่เช็คอิน</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statValue, { color: "#3b82f6" }]}>{stats.withCounting}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>มีนับสต็อก</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            ไม่พบข้อมูลทีม
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, marginTop: 2 },
  list: { padding: 16, paddingTop: 8 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600" },
  branchText: { fontSize: 12, marginTop: 1 },
  memberStats: { alignItems: "flex-end", gap: 4 },
  memberStatRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  memberStatText: { fontSize: 12 },
  notCheckedIn: { fontSize: 12, fontWeight: "600" },
});
