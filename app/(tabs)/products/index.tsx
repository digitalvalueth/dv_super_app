import { subscribeToProductsWithAssignments } from "@/services/product.service";
import { useAuthStore } from "@/stores/auth.store";
import { useProductStore } from "@/stores/product.store";
import { useTheme } from "@/stores/theme.store";
import { ProductWithAssignment } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { products, setProducts, setLoading, loading } = useProductStore();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("all");

  // Setup realtime listener for products
  useEffect(() => {
    if (!user?.uid) return;

    console.log("🔔 Setting up realtime products listener...");
    setLoading(true);

    const unsubscribe = subscribeToProductsWithAssignments(
      user.uid,
      (productsData) => {
        console.log(`✅ Products updated: ${productsData.length} items`);
        setProducts(productsData);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("❌ Products listener error:", error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    // Cleanup on unmount
    return () => {
      console.log("🚧 Cleaning up products listener");
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Realtime listener will automatically update
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleProductPress = (product: ProductWithAssignment) => {
    if (product.status === "completed") {
      // Show completed status
      alert("คุณนับสินค้านี้เรียบร้อยแล้ว");
      return;
    }

    // Navigate to product details
    router.push({
      pathname: "/(tabs)/products/details",
      params: {
        productId: product.id,
        productName: product.name,
        productSKU: product.sku,
        productImage: product.imageUrl || "",
        beforeQty: product.beforeCountQty?.toString() || "0",
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#4caf50";
      case "in_progress":
        return "#ff9800";
      default:
        return "#999";
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "in_progress":
        return "time";
      default:
        return "ellipse-outline";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "นับแล้ว";
      case "in_progress":
        return "กำลังนับ";
      default:
        return "รอนับ";
    }
  };

  const filteredProducts = products.filter((product) => {
    if (filter === "all") return true;
    if (filter === "pending")
      return !product.status || product.status === "pending";
    return product.status === filter;
  });

  const filters = [
    {
      key: "all" as const,
      label: "ทั้งหมด",
      icon: "grid" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "pending" as const,
      label: "รอนับ",
      icon: "ellipse-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "in_progress" as const,
      label: "กำลังนับ",
      icon: "time" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "completed" as const,
      label: "นับแล้ว",
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    },
  ];

  const renderProduct = ({ item }: { item: ProductWithAssignment }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.card }]}
      onPress={() => handleProductPress(item)}
      disabled={item.status === "completed"}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.productImage} />
        ) : (
          <View
            style={[
              styles.placeholderImage,
              { backgroundColor: colors.border },
            ]}
          >
            <Ionicons
              name="cube-outline"
              size={40}
              color={colors.textSecondary}
            />
          </View>
        )}

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Ionicons name={getStatusIcon(item.status)} size={14} color="#fff" />
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <Text style={styles.productSKU} numberOfLines={1}>
          {item.sku}
        </Text>

        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Ionicons
              name="cube-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.metricText, { color: colors.textSecondary }]}>
              {item.beforeCountQty || 0}
            </Text>
          </View>

          {item.variance !== undefined && (
            <View style={styles.metricItem}>
              <Ionicons
                name={item.variance >= 0 ? "trending-up" : "trending-down"}
                size={14}
                color={item.variance >= 0 ? "#4caf50" : "#f44336"}
              />
              <Text
                style={[
                  styles.metricText,
                  { color: item.variance >= 0 ? "#4caf50" : "#f44336" },
                ]}
              >
                {item.variance > 0 ? "+" : ""}
                {item.variance}
              </Text>
            </View>
          )}
        </View>

        <Text
          style={[styles.statusText, { color: getStatusColor(item.status) }]}
        >
          {getStatusText(item.status)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Show message for users without company/branch
  if (!user?.companyId || !user?.branchId) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.card }]}
        edges={["top"]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.card}
        />
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            รายการสินค้า
          </Text>
        </View>
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.noBranchIcon,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Ionicons
              name="business-outline"
              size={60}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.noBranchTitle, { color: colors.text }]}>
            ยังไม่มีสาขา
          </Text>
          <Text
            style={[
              styles.noBranchDescription,
              { color: colors.textSecondary },
            ]}
          >
            คุณยังไม่ได้เป็นสมาชิกของสาขาใดๆ{"\n"}
            กรุณารอคำเชิญจากผู้ดูแลระบบ
          </Text>

          {/* Check Inbox Button */}
          <TouchableOpacity
            style={[
              styles.checkInboxButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => router.push("/(tabs)/settings/inbox")}
          >
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text style={styles.checkInboxText}>ตรวจสอบข้อความ</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              เมื่อได้รับคำเชิญ คุณจะเห็นในหน้า &quot;ข้อความ&quot;{"\n"}
              สามารถยอมรับหรือปฏิเสธได้ที่นั่น
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && products.length === 0) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.card }]}
        edges={["top"]}
      >
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.card}
        />
        <View
          style={[
            styles.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            รายการสินค้า
          </Text>
        </View>
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            กำลังโหลดรายการสินค้า...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.card }]}
      edges={["top"]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.card}
      />
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          รายการสินค้า
        </Text>

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    filter === f.key ? colors.primary : colors.background,
                  borderColor:
                    filter === f.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons
                name={f.icon}
                size={16}
                color={filter === f.key ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f.key ? "#fff" : colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={
            filteredProducts.length === 0
              ? styles.emptyContainer
              : [styles.listContent, { paddingBottom: 110 }]
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.centered}>
                <Ionicons
                  name="cube-outline"
                  size={80}
                  color={colors.textSecondary}
                />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  {filter === "all"
                    ? "ไม่มีรายการสินค้า"
                    : `ไม่มีสินค้า${
                        filters.find((f) => f.key === filter)?.label
                      }`}
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textSecondary }]}
                >
                  ลากลงเพื่อรีเฟรช
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  listContent: {
    padding: 8,
  },
  row: {
    gap: 8,
    paddingHorizontal: 8,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },

  // Product Card - Grid View
  productCard: {
    flex: 1,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: "100%",
    height: 120,
    backgroundColor: "#f0f0f0",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },

  // Product Info
  productInfo: {
    padding: 12,
  },
  productSKU: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4285f4",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    lineHeight: 18,
    height: 36,
  },

  // Metrics
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },

  // No Branch State
  noBranchIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  noBranchTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  noBranchDescription: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  checkInboxButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  checkInboxText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
});
