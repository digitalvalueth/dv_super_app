import { getTodayCheckIn } from "@/services/checkin.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCheckInStore } from "@/stores/checkin.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
    } catch (error) {
      console.error("Error loading today status:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, setTodayCheckIn, setTodayCheckOut, setLoading]);

  useEffect(() => {
    loadTodayStatus();
  }, [loadTodayStatus]);

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
              เข้างานก่อน 10:00 น. • ถ่ายรูปยืนยันพร้อมบูธ
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
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
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
