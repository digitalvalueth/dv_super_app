import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";

interface AlertItem {
  uid: string;
  name: string;
  branchName: string;
  consecutiveMissingDays: number;
  lastCheckIn: Date | null;
  alertStatus: "new" | "acknowledged" | "resolved";
  alertDocId?: string;
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      // Get all BA employees
      const usersQuery = query(
        collection(db, "users"),
        where("companyId", "==", user.companyId),
        where("role", "==", "employee"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const usersSnap = await getDocs(usersQuery);

      // Get check-ins from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const checkInQuery = query(
        collection(db, "checkIns"),
        where("companyId", "==", user.companyId),
        where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
      );
      const checkInsSnap = await getDocs(checkInQuery);

      // Group check-ins by user by date
      const userCheckInDays = new Map<string, Set<string>>();
      checkInsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId) {
          const dateStr = data.timestamp?.toDate?.()?.toISOString()?.split("T")[0];
          if (dateStr) {
            if (!userCheckInDays.has(data.userId)) {
              userCheckInDays.set(data.userId, new Set());
            }
            userCheckInDays.get(data.userId)!.add(dateStr);
          }
        }
      });

      // Get existing alerts
      const alertsQuery = query(
        collection(db, "missingCheckInAlerts"),
        where("companyId", "==", user.companyId),
        where("status", "in", ["new", "acknowledged"]),
      );
      const alertsSnap = await getDocs(alertsQuery);
      const existingAlerts = new Map<string, { id: string; status: string }>();
      alertsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId) {
          existingAlerts.set(data.userId, { id: d.id, status: data.status });
        }
      });

      // Calculate consecutive missing days (count back from today)
      const alertItems: AlertItem[] = [];
      const today = new Date();

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const uid = d.id;
        const userDays = userCheckInDays.get(uid) || new Set();

        let consecutiveMissing = 0;
        let lastCheckInDate: Date | null = null;

        // Check each day from today backwards (skip today since day may not be over)
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(today.getDate() - i);
          // Skip weekends (Saturday = 6, Sunday = 0)
          if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;

          const dateStr = checkDate.toISOString().split("T")[0];
          if (!userDays.has(dateStr)) {
            consecutiveMissing++;
          } else {
            if (!lastCheckInDate) lastCheckInDate = checkDate;
            break;
          }
        }

        // Alert threshold: 3+ consecutive missing workdays
        if (consecutiveMissing >= 3) {
          const existing = existingAlerts.get(uid);
          alertItems.push({
            uid,
            name: data.name || data.email || "Unknown",
            branchName: data.branchName || "",
            consecutiveMissingDays: consecutiveMissing,
            lastCheckIn: lastCheckInDate,
            alertStatus: (existing?.status as any) || "new",
            alertDocId: existing?.id,
          });
        }
      });

      // Sort by most missing days first
      alertItems.sort((a, b) => b.consecutiveMissingDays - a.consecutiveMissingDays);
      setAlerts(alertItems);
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (item: AlertItem) => {
    if (!item.alertDocId) {
      // Create alert doc
      try {
        const { addDoc } = await import("firebase/firestore");
        const ref = await addDoc(collection(db, "missingCheckInAlerts"), {
          userId: item.uid,
          userName: item.name,
          branchName: item.branchName,
          companyId: user?.companyId,
          consecutiveMissingDays: item.consecutiveMissingDays,
          status: "acknowledged",
          acknowledgedBy: user?.uid,
          acknowledgedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        });
        setAlerts((prev) =>
          prev.map((a) =>
            a.uid === item.uid
              ? { ...a, alertStatus: "acknowledged", alertDocId: ref.id }
              : a,
          ),
        );
      } catch (error) {
        console.error("Error creating alert:", error);
      }
    } else {
      try {
        await updateDoc(doc(db, "missingCheckInAlerts", item.alertDocId), {
          status: "acknowledged",
          acknowledgedBy: user?.uid,
          acknowledgedAt: Timestamp.now(),
        });
        setAlerts((prev) =>
          prev.map((a) =>
            a.uid === item.uid ? { ...a, alertStatus: "acknowledged" } : a,
          ),
        );
      } catch (error) {
        console.error("Error acknowledging:", error);
      }
    }
  };

  const handleResolve = (item: AlertItem) => {
    Alert.alert(
      "ปิดการแจ้งเตือน",
      `ยืนยันปิดการแจ้งเตือนสำหรับ ${item.name}?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            if (item.alertDocId) {
              try {
                await updateDoc(doc(db, "missingCheckInAlerts", item.alertDocId), {
                  status: "resolved",
                  resolvedBy: user?.uid,
                  resolvedAt: Timestamp.now(),
                });
                setAlerts((prev) => prev.filter((a) => a.uid !== item.uid));
              } catch (error) {
                console.error("Error resolving:", error);
              }
            }
          },
        },
      ],
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "new":
        return "#ef4444";
      case "acknowledged":
        return "#f59e0b";
      default:
        return "#10b981";
    }
  };

  const renderAlert = ({ item }: { item: AlertItem }) => (
    <View style={[styles.alertCard, { backgroundColor: colors.card }]}>
      <View style={styles.alertHeader}>
        <View style={styles.alertInfo}>
          <View style={styles.alertNameRow}>
            <Ionicons name="warning" size={18} color={statusColor(item.alertStatus)} />
            <Text style={[styles.alertName, { color: colors.text }]}>{item.name}</Text>
          </View>
          {item.branchName ? (
            <Text style={[styles.alertBranch, { color: colors.textSecondary }]}>
              {item.branchName}
            </Text>
          ) : null}
        </View>
        <View
          style={[styles.badge, { backgroundColor: statusColor(item.alertStatus) + "20" }]}
        >
          <Text style={[styles.badgeText, { color: statusColor(item.alertStatus) }]}>
            {item.alertStatus === "new" ? "ใหม่" : "รับทราบ"}
          </Text>
        </View>
      </View>

      <View style={styles.alertDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={14} color="#ef4444" />
          <Text style={[styles.detailText, { color: "#ef4444" }]}>
            ไม่เช็คอิน {item.consecutiveMissingDays} วันทำการติดต่อกัน
          </Text>
        </View>
        {item.lastCheckIn && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              เช็คอินล่าสุด:{" "}
              {item.lastCheckIn.toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.alertActions}>
        {item.alertStatus === "new" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#f59e0b" }]}
            onPress={() => handleAcknowledge(item)}
          >
            <Ionicons name="eye-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>รับทราบ</Text>
          </TouchableOpacity>
        )}
        {item.alertStatus === "acknowledged" && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
            onPress={() => handleResolve(item)}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>ปิดแจ้งเตือน</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      {/* Header info */}
      <View style={[styles.infoCard, { backgroundColor: "#fef2f2" }]}>
        <Ionicons name="information-circle" size={20} color="#ef4444" />
        <Text style={styles.infoText}>
          แสดงพนักงานที่ไม่เช็คอินติดต่อกัน 3 วันทำการขึ้นไป
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark" size={64} color="#10b981" />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            ไม่มีการแจ้งเตือน
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            ทุกคนเช็คอินสม่ำเสมอ
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(i) => i.uid}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 14 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
  },
  infoText: { fontSize: 13, color: "#991b1b", flex: 1 },
  list: { padding: 16, paddingTop: 8 },
  alertCard: {
    borderRadius: 12,
    padding: 14,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  alertInfo: { flex: 1 },
  alertNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  alertName: { fontSize: 16, fontWeight: "700" },
  alertBranch: { fontSize: 12, marginTop: 2, marginLeft: 24 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  alertDetails: { marginTop: 10, gap: 4 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13 },
  alertActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
