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
  ScrollView,
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Calculate counts for filter badges
  const counts = {
    all: products.length,
    pending: products.filter((p) => !p.status || p.status === "pending").length,
    in_progress: products.filter((p) => p.status === "in_progress").length,
    completed: products.filter((p) => p.status === "completed").length,
  };

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
      // Navigate to completed product view with history
      router.push({
        pathname: "/(tabs)/products/completed",
        params: {
          productId: product.productId || product.sku || product.id,
          productName: product.name,
          productSKU: product.sku,
          productImage: product.imageUrl || "",
          beforeQty: product.beforeCountQty?.toString() || "0",
        },
      });
      return;
    }

    // Navigate to product details
    // Use productId (product code like SK-CD-136) not document ID
    router.push({
      pathname: "/(tabs)/products/details",
      params: {
        productId: product.productId || product.sku || product.id, // Product code (SK-CD-136)
        productName: product.name,
        productSKU: product.sku,
        productImage: product.imageUrl || "",
        beforeQty: product.beforeCountQty?.toString() || "0",
        assignmentId: product.assignment?.id || "",
        productBarcode: product.barcode || "",
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
        return "#fbbf24"; // เปลี่ยนจากเทาเป็นเหลือง
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "in_progress":
        return "camera"; // เปลี่ยนจาก time เป็น camera
      default:
        return "time-outline"; // เปลี่ยนเป็นนาฬิกาให้ตรงกับ filter
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "นับแล้ว";
      case "in_progress":
        return "แนบรูปแล้ว"; // เปลี่ยนจาก กำลังนับ
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
      icon: "time-outline" as keyof typeof Ionicons.glyphMap, // เปลี่ยนเป็นนาฬิกา
    },
    {
      key: "in_progress" as const,
      label: "แนบรูปแล้ว", // เปลี่ยนจาก กำลังนับ
      icon: "camera" as keyof typeof Ionicons.glyphMap, // เปลี่ยนจาก time
    },
    {
      key: "completed" as const,
      label: "นับแล้ว",
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    },
  ];

  const renderProductList = ({ item }: { item: ProductWithAssignment }) => (
    <TouchableOpacity
      style={[styles.productListCard, { backgroundColor: colors.card }]}
      onPress={() => handleProductPress(item)}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.listImageContainer}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.listProductImage}
          />
        ) : (
          <View
            style={[
              styles.listPlaceholderImage,
              { backgroundColor: colors.border },
            ]}
          >
            <Ionicons
              name="cube-outline"
              size={32}
              color={colors.textSecondary}
            />
          </View>
        )}

        {/* Status Badge */}
        <View
          style={[
            styles.listStatusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Ionicons name={getStatusIcon(item.status)} size={12} color="#fff" />
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.listProductInfo}>
        <View style={styles.listProductHeader}>
          <Text style={styles.productSKU} numberOfLines={1}>
            {item.sku}
          </Text>
          <Text
            style={[
              styles.listStatusText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {getStatusText(item.status)}
          </Text>
        </View>

        <Text
          style={[styles.listProductName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* Metrics */}
        <View style={styles.listMetricsRow}>
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
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderProduct = ({ item }: { item: ProductWithAssignment }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.card }]}
      onPress={() => handleProductPress(item)}
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
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            รายการสินค้า
          </Text>

          {/* View Mode Toggle */}
          <TouchableOpacity
            style={[
              styles.viewToggle,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            <Ionicons
              name={viewMode === "grid" ? "list" : "grid"}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {/* Filter Buttons */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
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
                {f.label} ({counts[f.key]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={filteredProducts}
          renderItem={viewMode === "grid" ? renderProduct : renderProductList}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === "grid" ? 2 : 1}
          key={viewMode}
          columnWrapperStyle={viewMode === "grid" ? styles.row : undefined}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  viewToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
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

  // List View Styles
  productListCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 8,
    marginHorizontal: 8,
    padding: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  listProductImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  listPlaceholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  listStatusBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  listProductInfo: {
    flex: 1,
    gap: 4,
  },
  listProductHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listProductName: {
    fontSize: 15,
    fontWeight: "600",
  },
  listStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listMetricsRow: {
    flexDirection: "row",
    gap: 12,
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
