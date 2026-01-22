import { useAuthStore } from "@/stores/auth.store";
import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { Shipment } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeliveryReceiveIndex() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const {
    pendingShipments,
    isLoadingShipments,
    loadPendingShipments,
    selectShipment,
    searchByTracking,
  } = useDeliveryStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.branchId) return;
    try {
      await loadPendingShipments(user.branchId);
    } catch (error) {
      console.error("Error loading shipments:", error);
    }
  }, [user?.branchId, loadPendingShipments]);

  useEffect(() => {
    loadData();
    // Don't call reset in cleanup - it causes navigation issues
    // Reset should only be called explicitly when user completes an action
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSelectShipment = (shipment: Shipment) => {
    selectShipment(shipment);
    router.push("/(mini-apps)/delivery-receive/receive");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const shipment = await searchByTracking(searchQuery.trim());
      if (shipment) {
        router.push("/(mini-apps)/delivery-receive/receive");
      } else {
        alert("ไม่พบพัสดุที่ค้นหา");
      }
    } catch (error) {
      console.error("Error searching:", error);
      alert("เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewHistory = () => {
    router.push("/(mini-apps)/delivery-receive/history");
  };

  // Format date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status color and label
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "in_transit":
        return { color: "#3B82F6", label: "กำลังจัดส่ง", bgColor: "#EFF6FF" };
      case "pending":
        return { color: "#F59E0B", label: "รอจัดส่ง", bgColor: "#FEF3C7" };
      case "delivered":
        return { color: "#10B981", label: "ส่งถึงแล้ว", bgColor: "#D1FAE5" };
      case "received":
        return { color: "#059669", label: "รับแล้ว", bgColor: "#A7F3D0" };
      default:
        return { color: "#6B7280", label: status, bgColor: "#F3F4F6" };
    }
  };

  const renderShipmentItem = ({ item }: { item: Shipment }) => {
    const statusInfo = getStatusInfo(item.status);

    return (
      <TouchableOpacity
        style={[
          styles.shipmentCard,
          {
            backgroundColor: isDark ? colors.card : "#FFFFFF",
            borderColor: isDark ? colors.border : "#E5E7EB",
          },
        ]}
        onPress={() => handleSelectShipment(item)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.shipmentHeader}>
          <View style={styles.trackingContainer}>
            <Ionicons name="cube-outline" size={20} color={colors.primary} />
            <Text style={[styles.trackingNumber, { color: colors.text }]}>
              {item.trackingNumber}
            </Text>
          </View>
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

        {/* Products Summary */}
        <View style={styles.productsContainer}>
          <Text style={[styles.productsLabel, { color: colors.textSecondary }]}>
            รายการสินค้า ({item.products.length} รายการ)
          </Text>
          {item.products.slice(0, 2).map((product, index) => (
            <Text
              key={index}
              style={[styles.productItem, { color: colors.text }]}
              numberOfLines={1}
            >
              • {product.productName} x{product.quantity} {product.unit}
            </Text>
          ))}
          {item.products.length > 2 && (
            <Text
              style={[styles.moreProducts, { color: colors.textSecondary }]}
            >
              +{item.products.length - 2} รายการอื่น
            </Text>
          )}
        </View>

        {/* Footer */}
        <View style={styles.shipmentFooter}>
          <View style={styles.deliveryInfo}>
            <Ionicons
              name="person-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.deliveryText, { color: colors.textSecondary }]}
            >
              {item.deliveryPersonName || item.deliveryCompany}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
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
          onPress={() => router.replace("/(tabs)/services")}
        >
          <Ionicons name="home-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          รับสินค้า
        </Text>
        <TouchableOpacity
          style={styles.historyButton}
          onPress={handleViewHistory}
        >
          <Ionicons name="time-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: isDark ? colors.card : "#F9FAFB",
            borderColor: isDark ? colors.border : "#E5E7EB",
          },
        ]}
      >
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: isDark ? colors.background : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E5E7EB",
            },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ค้นหาเลข Tracking..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="search" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Pending Shipments List */}
      <View style={styles.listContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          พัสดุที่รอรับ
        </Text>

        {isLoadingShipments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              กำลังโหลด...
            </Text>
          </View>
        ) : pendingShipments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              ไม่มีพัสดุที่รอรับ
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              เมื่อมีพัสดุที่จะจัดส่งมาจะแสดงที่นี่
            </Text>
          </View>
        ) : (
          <FlatList
            data={pendingShipments}
            keyExtractor={(item) => item.id!}
            renderItem={renderShipmentItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
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
  historyButton: {
    padding: 8,
    marginRight: -8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  shipmentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    position: "relative",
  },
  shipmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  trackingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trackingNumber: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  productsContainer: {
    marginBottom: 12,
  },
  productsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  productItem: {
    fontSize: 14,
    marginLeft: 4,
    marginBottom: 2,
  },
  moreProducts: {
    fontSize: 12,
    fontStyle: "italic",
    marginLeft: 4,
    marginTop: 4,
  },
  shipmentFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 24,
  },
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveryText: {
    fontSize: 12,
  },
  dateText: {
    fontSize: 12,
  },
  arrowContainer: {
    position: "absolute",
    right: 12,
    top: "50%",
    marginTop: -12,
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
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
});
