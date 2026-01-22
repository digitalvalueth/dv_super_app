import { getCheckInById } from "@/services/checkin.service";
import { useCheckInStore } from "@/stores/checkin.store";
import { useTheme } from "@/stores/theme.store";
import { CheckIn } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckInResultScreen() {
  const { colors, isDark } = useTheme();
  const { setTodayCheckIn, setTodayCheckOut } = useCheckInStore();

  const params = useLocalSearchParams<{
    checkInId: string;
    type: string;
  }>();

  const checkInType = (params.type as "check-in" | "check-out") || "check-in";
  const isCheckIn = checkInType === "check-in";

  const [loading, setLoading] = useState(true);
  const [checkInData, setCheckInData] = useState<CheckIn | null>(null);

  const loadCheckInData = useCallback(async () => {
    if (!params.checkInId) return;

    try {
      setLoading(true);
      const data = await getCheckInById(params.checkInId);
      setCheckInData(data);

      // Update store
      if (data) {
        if (data.type === "check-in") {
          setTodayCheckIn(data);
        } else {
          setTodayCheckOut(data);
        }
      }
    } catch (error) {
      console.error("Error loading check-in data:", error);
    } finally {
      setLoading(false);
    }
  }, [params.checkInId, setTodayCheckIn, setTodayCheckOut]);

  useEffect(() => {
    loadCheckInData();
  }, [loadCheckInData]);

  const handleDone = () => {
    router.replace("/(mini-apps)/check-in");
  };

  // Format time from Timestamp
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format date from Timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            กำลังโหลด...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Success Icon */}
        <View style={styles.successContainer}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: isCheckIn ? "#D1FAE5" : "#E0E7FF" },
            ]}
          >
            <Ionicons
              name={isCheckIn ? "checkmark-circle" : "log-out"}
              size={64}
              color={isCheckIn ? "#10B981" : "#6366F1"}
            />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {isCheckIn ? "ลงเวลาเข้างานสำเร็จ!" : "ลงเวลาเลิกงานสำเร็จ!"}
          </Text>
          {checkInData?.isLate && isCheckIn && (
            <View style={styles.lateBadge}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.lateText}>
                มาสาย {checkInData.lateMinutes} นาที
              </Text>
            </View>
          )}
        </View>

        {/* Time Display */}
        <View
          style={[
            styles.timeCard,
            {
              backgroundColor: isDark ? colors.card : "#F9FAFB",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
            {isCheckIn ? "เวลาเข้างาน" : "เวลาเลิกงาน"}
          </Text>
          <Text style={[styles.timeValue, { color: colors.primary }]}>
            {formatTime(checkInData?.createdAt)}
          </Text>
          <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
            {formatDate(checkInData?.createdAt)}
          </Text>
        </View>

        {/* Image Preview */}
        {checkInData?.imageUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: checkInData.imageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Info Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? colors.card : "#F9FAFB",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            รายละเอียด
          </Text>

          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              พนักงาน:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {checkInData?.userName || "-"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="business-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              บริษัท:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {checkInData?.companyName || "-"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="storefront-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              สาขา:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {checkInData?.branchName || "-"}
            </Text>
          </View>

          {checkInData?.watermarkData?.location && (
            <View style={styles.infoRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                สถานที่:
              </Text>
              <Text
                style={[styles.infoValue, { color: colors.text }]}
                numberOfLines={2}
              >
                {checkInData.watermarkData.location}
              </Text>
            </View>
          )}

          {checkInData?.watermarkData?.deviceModel && (
            <View style={styles.infoRow}>
              <Ionicons
                name="phone-portrait-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                อุปกรณ์:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {checkInData.watermarkData.deviceModel}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Done Button */}
      <View
        style={[
          styles.footer,
          { borderTopColor: isDark ? colors.border : "#E5E7EB" },
        ]}
      >
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary }]}
          onPress={handleDone}
        >
          <Text style={styles.doneButtonText}>เสร็จสิ้น</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  successContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  lateBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FEF3C7",
    borderRadius: 16,
    gap: 4,
  },
  lateText: {
    color: "#F59E0B",
    fontSize: 14,
    fontWeight: "600",
  },
  timeCard: {
    alignItems: "center",
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    minWidth: 70,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  doneButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
