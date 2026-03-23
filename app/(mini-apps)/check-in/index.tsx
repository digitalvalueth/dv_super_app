import { trackAppUsage } from "@/services/app-usage.service";
import {
  getAttendanceSettings,
  getTodayCheckIn,
} from "@/services/checkin.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCheckInStore } from "@/stores/checkin.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckInIndex() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const {
    todayCheckIn,
    todayCheckOut,
    setTodayCheckIn,
    setTodayCheckOut,
    loading,
    setLoading,
  } = useCheckInStore();

  const [refreshing, setRefreshing] = useState(false);
  const [workStartTime, setWorkStartTime] = useState("10:00");
  const [workEndTime, setWorkEndTime] = useState("18:00");
  const [nowTime, setNowTime] = useState(new Date());
  const lastReminderKeyRef = useRef<string | null>(null);

  const loadTodayStatus = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      // Load today's check-in and check-out
      const [checkIn, checkOut] = await Promise.all([
        getTodayCheckIn(user.uid, "check-in"),
        getTodayCheckIn(user.uid, "check-out"),
      ]);

      setTodayCheckIn(checkIn);
      setTodayCheckOut(checkOut);

      if (user.companyId) {
        const settings = await getAttendanceSettings(
          user.companyId,
          user.branchId,
        );
        if (settings?.workStartTime) {
          setWorkStartTime(settings.workStartTime);
        }
        if (settings?.workEndTime) {
          setWorkEndTime(settings.workEndTime);
        }
      }
    } catch (error) {
      console.error("Error loading today status:", error);
    } finally {
      setLoading(false);
    }
  }, [
    user?.uid,
    user?.companyId,
    user?.branchId,
    setTodayCheckIn,
    setTodayCheckOut,
    setLoading,
  ]);

  useEffect(() => {
    trackAppUsage("check-in", user?.uid);
    loadTodayStatus();
  }, [loadTodayStatus, user?.uid]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTodayStatus();
    setRefreshing(false);
  }, [loadTodayStatus]);

  const handleCheckIn = () => {
    router.push({
      pathname: "/(mini-apps)/check-in/camera",
      params: { type: "check-in" },
    });
  };

  const handleCheckOut = () => {
    router.push({
      pathname: "/(mini-apps)/check-in/camera",
      params: { type: "check-out" },
    });
  };

  const handleViewHistory = () => {
    router.push("/(mini-apps)/check-in/history");
  };

  // Format time from Timestamp
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get current date in Thai format
  const getCurrentDateThai = () => {
    const now = new Date();
    return now.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const hasCheckedIn = !!todayCheckIn;
  const hasCheckedOut = !!todayCheckOut;

  const getWorkEndDate = useCallback(() => {
    const [hour, minute] = workEndTime.split(":").map(Number);
    const endDate = new Date(nowTime);
    endDate.setHours(hour, minute, 0, 0);
    return endDate;
  }, [workEndTime, nowTime]);

  const minutesToCheckout = Math.ceil(
    (getWorkEndDate().getTime() - nowTime.getTime()) / 60000,
  );

  const shouldShowCountdown = hasCheckedIn && !hasCheckedOut;

  useEffect(() => {
    const scheduleCheckoutReminder = async () => {
      if (!shouldShowCountdown || !user?.uid) return;

      const workEndDate = getWorkEndDate();
      const reminderDate = new Date(workEndDate.getTime() - 15 * 60000);
      const dateKey = nowTime.toISOString().split("T")[0];
      const reminderKey = `${user.uid}-${dateKey}-${workEndTime}`;

      if (lastReminderKeyRef.current === reminderKey) {
        return;
      }
      lastReminderKeyRef.current = reminderKey;

      try {
        if (reminderDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "ใกล้ถึงเวลาเลิกงาน",
              body: "เหลืออีกประมาณ 15 นาที ก่อนถึงเวลาเลิกงาน",
              data: { type: "checkout-reminder" },
              sound: "default",
            },
            trigger: reminderDate as any,
          });
        }

        if (workEndDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "ถึงเวลาเลิกงานแล้ว",
              body: "คุณสามารถลงเวลาเลิกงานได้แล้ว",
              data: { type: "checkout-reminder" },
              sound: "default",
            },
            trigger: workEndDate as any,
          });
        }
      } catch (error) {
        console.error("Error scheduling checkout reminders:", error);
      }
    };

    scheduleCheckoutReminder();
  }, [getWorkEndDate, nowTime, shouldShowCountdown, user?.uid, workEndTime]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? colors.border : "#E5E7EB" },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          เช็คชื่อพนักงาน
        </Text>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleViewHistory}
        >
          <Ionicons name="time-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Date Display */}
        <View style={styles.dateContainer}>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {getCurrentDateThai()}
          </Text>
        </View>

        {/* Employee & Branch Info */}
        <View
          style={[
            styles.employeeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.employeeRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons name="person" size={22} color={colors.primary} />
            </View>
            <View style={styles.employeeInfo}>
              <Text style={[styles.employeeName, { color: colors.text }]}>
                {user?.name || "-"}
              </Text>
              <View style={styles.branchRow}>
                <Ionicons
                  name="storefront-outline"
                  size={13}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.branchName, { color: colors.textSecondary }]}
                >
                  {user?.branchName || "ไม่ระบุสาขา"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Status Card */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isDark ? colors.card : "#F9FAFB",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            สถานะวันนี้
          </Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={{ marginVertical: 20 }}
            />
          ) : (
            <View style={styles.statusGrid}>
              {/* Check-in Status */}
              <View style={styles.statusItem}>
                <View
                  style={[
                    styles.statusIcon,
                    {
                      backgroundColor: hasCheckedIn
                        ? todayCheckIn?.isLate
                          ? "#FEF3C7"
                          : "#D1FAE5"
                        : "#F3F4F6",
                    },
                  ]}
                >
                  <Ionicons
                    name={hasCheckedIn ? "checkmark-circle" : "time-outline"}
                    size={32}
                    color={
                      hasCheckedIn
                        ? todayCheckIn?.isLate
                          ? "#F59E0B"
                          : "#10B981"
                        : "#9CA3AF"
                    }
                  />
                </View>
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  เข้างาน
                </Text>
                {hasCheckedIn ? (
                  <>
                    <Text
                      style={[styles.statusTime, { color: colors.primary }]}
                    >
                      {formatTime(todayCheckIn?.createdAt)}
                    </Text>
                    {todayCheckIn?.isLate && (
                      <Text style={styles.lateText}>
                        สาย {todayCheckIn.lateMinutes} นาที
                      </Text>
                    )}
                  </>
                ) : (
                  <Text
                    style={[
                      styles.statusPending,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ยังไม่ลงเวลา
                  </Text>
                )}
              </View>

              {/* Check-out Status */}
              <View style={styles.statusItem}>
                <View
                  style={[
                    styles.statusIcon,
                    {
                      backgroundColor: hasCheckedOut ? "#D1FAE5" : "#F3F4F6",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      hasCheckedOut ? "checkmark-circle" : "log-out-outline"
                    }
                    size={32}
                    color={hasCheckedOut ? "#10B981" : "#9CA3AF"}
                  />
                </View>
                <Text style={[styles.statusLabel, { color: colors.text }]}>
                  เลิกงาน
                </Text>
                {hasCheckedOut ? (
                  <Text style={[styles.statusTime, { color: colors.primary }]}>
                    {formatTime(todayCheckOut?.createdAt)}
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.statusPending,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ยังไม่ลงเวลา
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {shouldShowCountdown && (
          <View
            style={[
              styles.countdownCard,
              {
                backgroundColor:
                  minutesToCheckout > 0
                    ? isDark
                      ? "#1F2937"
                      : "#EFF6FF"
                    : isDark
                      ? "#3F1D1D"
                      : "#FEF2F2",
                borderColor:
                  minutesToCheckout > 0
                    ? isDark
                      ? "#374151"
                      : "#BFDBFE"
                    : isDark
                      ? "#7F1D1D"
                      : "#FECACA",
              },
            ]}
          >
            <Ionicons
              name={minutesToCheckout > 0 ? "time-outline" : "alarm-outline"}
              size={22}
              color={minutesToCheckout > 0 ? "#2563EB" : "#DC2626"}
            />
            <View style={styles.countdownContent}>
              <Text
                style={[
                  styles.countdownTitle,
                  { color: minutesToCheckout > 0 ? "#1E40AF" : "#991B1B" },
                ]}
              >
                {minutesToCheckout > 0
                  ? `เหลืออีก ${minutesToCheckout} นาที ถึงเวลาเลิกงาน`
                  : "ถึงเวลาเลิกงานแล้ว"}
              </Text>
              <Text
                style={[
                  styles.countdownSubtitle,
                  { color: minutesToCheckout > 0 ? "#3B82F6" : "#DC2626" },
                ]}
              >
                เวลาเลิกงานตั้งไว้ {workEndTime} น.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actionContainer}>
          {/* Check-in Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: hasCheckedIn ? "#E5E7EB" : colors.primary,
              },
            ]}
            onPress={handleCheckIn}
            disabled={hasCheckedIn}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="log-in-outline"
                size={32}
                color={hasCheckedIn ? "#9CA3AF" : "#FFFFFF"}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  { color: hasCheckedIn ? "#9CA3AF" : "#FFFFFF" },
                ]}
              >
                {hasCheckedIn ? "ลงเวลาเข้าแล้ว" : "ลงเวลาเข้างาน"}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Check-out Button */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor:
                  !hasCheckedIn || hasCheckedOut
                    ? "#E5E7EB"
                    : isDark
                      ? "#374151"
                      : "#374151",
              },
            ]}
            onPress={handleCheckOut}
            disabled={!hasCheckedIn || hasCheckedOut}
          >
            <View style={styles.actionButtonContent}>
              <Ionicons
                name="log-out-outline"
                size={32}
                color={!hasCheckedIn || hasCheckedOut ? "#9CA3AF" : "#FFFFFF"}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  {
                    color:
                      !hasCheckedIn || hasCheckedOut ? "#9CA3AF" : "#FFFFFF",
                  },
                ]}
              >
                {hasCheckedOut
                  ? "ลงเวลาออกแล้ว"
                  : !hasCheckedIn
                    ? "ต้องเข้างานก่อน"
                    : "ลงเวลาเลิกงาน"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? colors.card : "#EFF6FF",
              borderColor: isDark ? colors.border : "#BFDBFE",
            },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color="#3B82F6"
          />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: "#1E40AF" }]}>
              เวลาทำงาน
            </Text>
            <Text style={[styles.infoText, { color: "#3B82F6" }]}>
              เข้างานก่อน {workStartTime} น. • เลิกงาน {workEndTime} น. •
              ถ่ายรูปยืนยันพร้อมบูธ
            </Text>
          </View>
        </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  historyButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  dateContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 16,
  },
  employeeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  employeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  branchName: {
    fontSize: 13,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },
  statusGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statusItem: {
    alignItems: "center",
    flex: 1,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  statusTime: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusPending: {
    fontSize: 14,
  },
  lateText: {
    fontSize: 12,
    color: "#F59E0B",
    marginTop: 2,
  },
  countdownCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  countdownContent: {
    flex: 1,
  },
  countdownTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  countdownSubtitle: {
    fontSize: 12,
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonContent: {
    alignItems: "center",
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
