import { getDeliveryReceiveById } from "@/services/delivery.service";
import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { DeliveryReceive } from "@/types";
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

export default function DeliveryResultScreen() {
  const { colors, isDark } = useTheme();
  const { reset } = useDeliveryStore();

  const params = useLocalSearchParams<{
    receiveId: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [receiveData, setReceiveData] = useState<DeliveryReceive | null>(null);

  const loadReceiveData = useCallback(async () => {
    if (!params.receiveId) {
      console.warn("No receiveId provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getDeliveryReceiveById(params.receiveId);
      setReceiveData(data);
    } catch (error) {
      console.error("Error loading receive data:", error);
    } finally {
      setLoading(false);
    }
  }, [params.receiveId]);

  useEffect(() => {
    loadReceiveData();
  }, [loadReceiveData]);

  const handleDone = () => {
    reset();
    router.replace("/(mini-apps)/delivery-receive");
  };

  const handleViewHistory = () => {
    reset();
    router.replace("/(mini-apps)/delivery-receive/history");
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

  // Show success even without detailed data
  if (!receiveData) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <View style={[styles.successIcon, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text
            style={[styles.successTitle, { color: colors.text, marginTop: 16 }]}
          >
            บันทึกการรับสินค้าสำเร็จ!
          </Text>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                marginTop: 24,
                paddingHorizontal: 32,
              },
            ]}
            onPress={handleDone}
          >
            <Text style={styles.primaryButtonText}>เสร็จสิ้น</Text>
          </TouchableOpacity>
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
          <View style={[styles.successIcon, { backgroundColor: "#D1FAE5" }]}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            รับสินค้าสำเร็จ!
          </Text>
        </View>

        {/* Tracking Info */}
        <View
          style={[
            styles.trackingCard,
            {
              backgroundColor: isDark ? colors.card : colors.primary,
            },
          ]}
        >
          <Ionicons name="cube" size={24} color="#FFFFFF" />
          <Text style={styles.trackingLabel}>Tracking Number</Text>
          <Text style={styles.trackingNumber}>
            {receiveData?.trackingNumber || "-"}
          </Text>
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
            เวลารับสินค้า
          </Text>
          <Text style={[styles.timeValue, { color: colors.primary }]}>
            {formatTime(receiveData?.createdAt)}
          </Text>
          <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
            {formatDate(receiveData?.createdAt)}
          </Text>
        </View>

        {/* Products Summary */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? colors.card : "#F9FAFB",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <View style={styles.infoHeader}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              รายการสินค้า
            </Text>
            <Text style={[styles.totalItems, { color: colors.primary }]}>
              {receiveData?.totalItems} ชิ้น
            </Text>
          </View>

          {receiveData?.products.map((product, index) => (
            <View
              key={index}
              style={[
                styles.productRow,
                {
                  borderBottomColor: isDark ? colors.border : "#E5E7EB",
                  borderBottomWidth:
                    index < (receiveData?.products.length || 0) - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: colors.text }]}>
                  {product.productName}
                </Text>
              </View>
              <Text style={[styles.productQuantity, { color: colors.primary }]}>
                {product.quantity} {product.unit}
              </Text>
            </View>
          ))}
        </View>

        {/* Image Preview */}
        {receiveData?.imageUrl && (
          <View
            style={[
              styles.imageCard,
              {
                backgroundColor: isDark ? colors.card : "#F9FAFB",
                borderColor: isDark ? colors.border : "#E5E7EB",
              },
            ]}
          >
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              รูปภาพหลักฐาน
            </Text>
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: receiveData.imageUrl }}
                style={styles.receiveImage}
                resizeMode="cover"
              />
            </View>
          </View>
        )}

        {/* Watermark Info */}
        {receiveData?.watermarkData && (
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
              ข้อมูลการรับสินค้า
            </Text>

            <View style={styles.infoRow}>
              <Ionicons
                name="person-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                ผู้รับ:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {receiveData.watermarkData.employeeName ||
                  receiveData.receivedByName}
              </Text>
            </View>

            {receiveData.watermarkData.location && (
              <View style={styles.infoRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  สถานที่:
                </Text>
                <Text
                  style={[styles.infoValue, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {receiveData.watermarkData.location}
                </Text>
              </View>
            )}

            {receiveData.watermarkData.deviceModel && (
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
                  {receiveData.watermarkData.deviceModel}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Notes */}
        {receiveData?.notes && (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: isDark ? colors.card : "#FEF3C7",
                borderColor: isDark ? colors.border : "#FDE68A",
              },
            ]}
          >
            <View style={styles.notesHeader}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#F59E0B"
              />
              <Text style={[styles.notesTitle, { color: "#92400E" }]}>
                หมายเหตุ
              </Text>
            </View>
            <Text style={[styles.notesText, { color: "#92400E" }]}>
              {receiveData.notes}
            </Text>
          </View>
        )}
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
            styles.secondaryButton,
            { borderColor: colors.border },
          ]}
          onPress={handleViewHistory}
        >
          <Ionicons name="time-outline" size={20} color={colors.text} />
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            ดูประวัติ
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.primaryButton,
            { backgroundColor: colors.primary },
          ]}
          onPress={handleDone}
        >
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>เสร็จสิ้น</Text>
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
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  successContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  trackingCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  trackingLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 8,
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  timeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  dateValue: {
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  totalItems: {
    fontSize: 14,
    fontWeight: "600",
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  productInfo: {
    flex: 1,
    marginRight: 16,
  },
  productName: {
    fontSize: 14,
    fontWeight: "500",
  },
  productQuantity: {
    fontSize: 14,
    fontWeight: "600",
  },
  imageCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  receiveImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    backgroundColor: "white",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  primaryButton: {},
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
