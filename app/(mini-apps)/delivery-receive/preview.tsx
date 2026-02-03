import { useAuthStore } from "@/stores/auth.store";
import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { formatTimestamp, WatermarkData } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeliveryPreviewScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuthStore();
  const { selectedShipment, confirmReceive, setWatermarkData } =
    useDeliveryStore();

  const params = useLocalSearchParams<{
    imageUri: string;
    imageBase64: string;
    watermarkData: string;
  }>();

  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

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

      // Store watermark data before confirming
      if (watermarkData) {
        setWatermarkData(watermarkData);
      }

      // Confirm receive
      const receiveId = await confirmReceive(
        user.uid,
        user.name || "",
        user.branchId || "",
        user.branchName || "",
        notes || undefined,
      );

      // Navigate to result
      router.replace({
        pathname: "/(mini-apps)/delivery-receive/result",
        params: {
          receiveId: receiveId,
        },
      });
    } catch (error) {
      console.error("Error confirming delivery:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกการรับสินค้าได้");
    } finally {
      setIsProcessing(false);
    }
  }, [
    user,
    params,
    watermarkData,
    notes,
    isProcessing,
    confirmReceive,
    setWatermarkData,
  ]);

  // Redirect if no shipment selected
  useFocusEffect(
    useCallback(() => {
      if (!selectedShipment) {
        const timeout = setTimeout(() => {
          router.back();
        }, 0);
        return () => clearTimeout(timeout);
      }
    }, [selectedShipment]),
  );

  if (!selectedShipment) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      />
    );
  }

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
        keyboardShouldPersistTaps="handled"
      >
        {/* Image Preview */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: params.imageUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          {/* Tracking Badge */}
          <View
            style={[styles.trackingBadge, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="cube" size={16} color="#FFFFFF" />
            <Text style={styles.trackingBadgeText}>
              {selectedShipment.trackingNumber}
            </Text>
          </View>
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
              รายการสินค้าที่รับ
            </Text>
            <Text style={[styles.totalItems, { color: colors.primary }]}>
              {selectedShipment.totalItems} ชิ้น
            </Text>
          </View>

          {selectedShipment.products.map((product, index) => (
            <View
              key={index}
              style={[
                styles.productRow,
                {
                  borderBottomColor: isDark ? colors.border : "#E5E7EB",
                  borderBottomWidth:
                    index < selectedShipment.products.length - 1 ? 1 : 0,
                },
              ]}
            >
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: colors.text }]}>
                  {product.productName}
                </Text>
                {product.productSKU && (
                  <Text
                    style={[styles.productSKU, { color: colors.textSecondary }]}
                  >
                    SKU: {product.productSKU}
                  </Text>
                )}
              </View>
              <Text style={[styles.productQuantity, { color: colors.primary }]}>
                {product.quantity} {product.unit}
              </Text>
            </View>
          ))}
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
                ผู้รับ:
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

        {/* Notes */}
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
            หมายเหตุ (ถ้ามี)
          </Text>
          <TextInput
            style={[
              styles.notesInput,
              {
                backgroundColor: isDark ? colors.background : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E5E7EB",
                color: colors.text,
              },
            ]}
            placeholder="เช่น กล่องชำรุด, สินค้าไม่ครบ..."
            placeholderTextColor={colors.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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
              <Text style={styles.confirmButtonText}>ยืนยันรับสินค้า</Text>
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
    paddingBottom: 120,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  trackingBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  trackingBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
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
  productSKU: {
    fontSize: 12,
    marginTop: 2,
  },
  productQuantity: {
    fontSize: 14,
    fontWeight: "600",
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
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
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
  retakeButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmButton: {},
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
