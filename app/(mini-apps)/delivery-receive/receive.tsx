import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeliveryReceiveDetail() {
  const { colors, isDark } = useTheme();
  const { selectedShipment } = useDeliveryStore();

  // Redirect if no shipment selected - use useFocusEffect to avoid issues
  useFocusEffect(
    useCallback(() => {
      if (!selectedShipment) {
        // Use setTimeout to avoid navigation during render
        const timeout = setTimeout(() => {
          router.back();
        }, 0);
        return () => clearTimeout(timeout);
      }
    }, [selectedShipment]),
  );

  if (!selectedShipment) {
    // Return empty view briefly while redirecting
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
      />
    );
  }

  // Format date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "in_transit":
        return { color: "#3B82F6", label: "กำลังจัดส่ง", bgColor: "#EFF6FF" };
      case "pending":
        return { color: "#F59E0B", label: "รอจัดส่ง", bgColor: "#FEF3C7" };
      case "delivered":
        return { color: "#10B981", label: "ส่งถึงแล้ว", bgColor: "#D1FAE5" };
      default:
        return { color: "#6B7280", label: status, bgColor: "#F3F4F6" };
    }
  };

  const statusInfo = getStatusInfo(selectedShipment.status);

  const handleStartReceive = () => {
    router.push("/(mini-apps)/delivery-receive/camera");
  };

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
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          รายละเอียดพัสดุ
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Tracking Card */}
        <View
          style={[
            styles.trackingCard,
            {
              backgroundColor: isDark ? colors.card : colors.primary,
            },
          ]}
        >
          <View style={styles.trackingHeader}>
            <Ionicons name="cube" size={32} color="#FFFFFF" />
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusInfo.bgColor },
              ]}
            >
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.trackingLabel}>Tracking Number</Text>
          <Text style={styles.trackingNumber}>
            {selectedShipment.trackingNumber}
          </Text>
        </View>

        {/* Delivery Info */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            ข้อมูลการจัดส่ง
          </Text>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons
                name="business"
                size={18}
                color={colors.textSecondary}
              />
              <View style={styles.infoContent}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  บริษัทขนส่ง
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedShipment.deliveryCompany || "-"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="person" size={18} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  พนักงานจัดส่ง
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedShipment.deliveryPersonName || "-"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="call" size={18} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  เบอร์โทร
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedShipment.deliveryPhone || "-"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons
                name="calendar"
                size={18}
                color={colors.textSecondary}
              />
              <View style={styles.infoContent}>
                <Text
                  style={[styles.infoLabel, { color: colors.textSecondary }]}
                >
                  คาดว่าจะถึง
                </Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {formatDate(selectedShipment.estimatedDelivery)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Products List */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.card : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <View style={styles.productsHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              รายการสินค้า
            </Text>
            <Text style={[styles.totalItems, { color: colors.primary }]}>
              {selectedShipment.totalItems} ชิ้น
            </Text>
          </View>

          {selectedShipment.products.map((product, index) => (
            <View
              key={index}
              style={[
                styles.productItem,
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
              <View style={styles.productQuantity}>
                <Text style={[styles.quantityText, { color: colors.primary }]}>
                  {product.quantity}
                </Text>
                <Text
                  style={[styles.unitText, { color: colors.textSecondary }]}
                >
                  {product.unit}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notes */}
        {selectedShipment.notes && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? colors.card : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E5E7EB",
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              หมายเหตุ
            </Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>
              {selectedShipment.notes}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Button */}
      <View
        style={[
          styles.bottomContainer,
          {
            backgroundColor: colors.background,
            borderTopColor: isDark ? colors.border : "#E5E7EB",
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.receiveButton, { backgroundColor: colors.primary }]}
          onPress={handleStartReceive}
          activeOpacity={0.8}
        >
          <Ionicons name="camera" size={24} color="#FFFFFF" />
          <Text style={styles.receiveButtonText}>ถ่ายรูปรับสินค้า</Text>
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
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  trackingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  trackingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  trackingLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  productsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalItems: {
    fontSize: 14,
    fontWeight: "600",
  },
  productItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
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
    alignItems: "flex-end",
  },
  quantityText: {
    fontSize: 18,
    fontWeight: "700",
  },
  unitText: {
    fontSize: 12,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 34,
  },
  receiveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  receiveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
