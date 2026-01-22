import { createCheckIn, uploadCheckInImage } from "@/services/checkin.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCheckInStore } from "@/stores/checkin.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CheckInPreviewScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const { setTodayCheckIn, setTodayCheckOut, setSubmitting, submitting } =
    useCheckInStore();

  const params = useLocalSearchParams<{
    imageUri: string;
    imageBase64: string;
    watermarkData: string;
    type: string; // "check-in" or "check-out"
  }>();

  const checkInType = (params.type as "check-in" | "check-out") || "check-in";
  const isCheckIn = checkInType === "check-in";

  const [isProcessing, setIsProcessing] = useState(false);

  // Parse watermark data
  const watermarkData: WatermarkData | null = useMemo(() => {
    try {
      return params.watermarkData ? JSON.parse(params.watermarkData) : null;
    } catch {
      return null;
    }
  }, [params.watermarkData]);

  const handleRetake = () => {
    router.back();
  };

  const handleConfirm = useCallback(async () => {
    if (!user || !params.imageUri || isProcessing) return;

    try {
      setIsProcessing(true);
      setSubmitting(true);

      // 1. Upload image to Firebase Storage
      const checkInIdTemp = `checkin_${Date.now()}`;
      const imageUrl = await uploadCheckInImage(
        user.uid,
        checkInIdTemp,
        params.imageUri,
      );

      // 2. Create check-in record
      const checkInId = await createCheckIn({
        userId: user.uid,
        userName: user.name || "",
        userEmail: user.email || "",
        companyId: user.companyId || "",
        companyName: user.companyName || "",
        branchId: user.branchId || "",
        branchName: user.branchName || "",
        type: checkInType,
        imageUrl: imageUrl,
        watermarkData: {
          timestamp: watermarkData?.timestamp
            ? formatTimestamp(new Date(watermarkData.timestamp))
            : formatTimestamp(new Date()),
          location: watermarkData?.location || "",
          coordinates: watermarkData?.coordinates,
          employeeName: watermarkData?.employeeName || user.name || "",
          employeeId: watermarkData?.employeeId || user.uid,
          deviceModel: watermarkData?.deviceModel,
          deviceName: watermarkData?.deviceName,
        },
      });

      // 3. Navigate to result
      router.replace({
        pathname: "/(mini-apps)/check-in/result",
        params: {
          checkInId: checkInId,
          type: checkInType,
        },
      });
    } catch (error) {
      console.error("Error confirming check-in:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกการเช็คชื่อได้");
    } finally {
      setIsProcessing(false);
      setSubmitting(false);
    }
  }, [user, params, watermarkData, checkInType, isProcessing, setSubmitting]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top", "bottom"]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: isDark ? colors.border : "#E5E7EB" },
        ]}
      >
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ตรวจสอบภาพ
        </Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Image Preview */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: params.imageUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* Type Badge */}
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: isCheckIn ? "#10B981" : "#6366F1" },
            ]}
          >
            <Ionicons
              name={isCheckIn ? "log-in-outline" : "log-out-outline"}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.typeBadgeText}>
              {isCheckIn ? "เข้างาน" : "เลิกงาน"}
            </Text>
          </View>
        </View>

        {/* Watermark Info */}
        {watermarkData && (
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
              ข้อมูลที่จะบันทึก
            </Text>

            <View style={styles.infoRow}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                พนักงาน:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {watermarkData.employeeName}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                เวลา:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {watermarkData.timestamp
                  ? formatTimestamp(new Date(watermarkData.timestamp))
                  : "-"}
              </Text>
            </View>

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
                {watermarkData.location || "ไม่ทราบตำแหน่ง"}
              </Text>
            </View>

            {watermarkData.deviceModel && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  อุปกรณ์:
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {watermarkData.deviceModel}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* User Info */}
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
            ข้อมูลพนักงาน
          </Text>

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
              {user?.companyName || "-"}
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
              {user?.branchName || "-"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View
        style={[
          styles.footer,
          { borderTopColor: isDark ? colors.border : "#E5E7EB" },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.retakeButton,
            { borderColor: colors.border },
          ]}
          onPress={handleRetake}
          disabled={isProcessing}
        >
          <Ionicons name="camera-outline" size={20} color={colors.text} />
          <Text style={[styles.actionButtonText, { color: colors.text }]}>
            ถ่ายใหม่
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.confirmButton,
            {
              backgroundColor: isProcessing ? "#9CA3AF" : colors.primary,
            },
          ]}
          onPress={handleConfirm}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#FFFFFF"
              />
              <Text style={styles.confirmButtonText}>ยืนยัน</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 16,
  },
  typeBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
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
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retakeButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {},
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
