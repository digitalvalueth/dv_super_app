import { db } from "@/config/firebase";
import { usePaginationState } from "@/hooks/usePaginatedQuery";
import { subscribeToProductsWithAssignments } from "@/services/product.service";
import { useAuthStore } from "@/stores/auth.store";
import { useProductStore } from "@/stores/product.store";
import { useTheme } from "@/stores/theme.store";
import { ProductWithAssignment } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useViewMode } from "../index";

// Fix Firebase Storage URL encoding
const fixFirebaseStorageUrl = (url: string): string => {
  if (!url) return url;

  // Check if URL is already properly encoded
  if (url.includes("%2F")) return url;

  // Fix unencoded URLs by replacing / with %2F in the path segment
  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    const path = match[1];
    const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
    return url.replace(/\/o\/[^?]+/, `/o/${encodedPath}`);
  }

  return url;
};

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { products, setProducts, setLoading, loading } = useProductStore();
  const { colors } = useTheme();
  const { viewMode } = useViewMode();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination for better performance
  const pagination = usePaginationState<ProductWithAssignment>(20);

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
        pagination.setData(productsData); // Update pagination
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("❌ Products listener error:", error);
        setLoading(false);
        setRefreshing(false);
      },
      user.companyId || undefined,
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

  // ฟังก์ชันข้ามสินค้า
  const handleSkipProduct = async (product: ProductWithAssignment) => {
    Alert.alert(
      "ข้ามสินค้านี้?",
      `คุณต้องการข้ามการนับ "${product.name}" ใช่หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ข้าม",
          style: "destructive",
          onPress: async () => {
            try {
              await addDoc(collection(db, "skippedProducts"), {
                userId: user?.uid,
                userName: user?.name,
                productId: product.productId || product.sku,
                productName: product.name,
                branchId: user?.branchId,
                companyId: user?.companyId,
                reason: "user_skipped",
                skippedAt: serverTimestamp(),
              });
              Alert.alert("สำเร็จ", "ข้ามสินค้าแล้ว");
            } catch (error) {
              console.error("Error skipping product:", error);
              Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถข้ามสินค้าได้");
            }
          },
        },
      ],
    );
  };

  const handleProductPress = (product: ProductWithAssignment) => {
    if (product.status === "completed") {
      // Navigate to completed product view with history
      router.push({
        pathname: "/(mini-apps)/stock-counter/products/completed",
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
      pathname: "/(mini-apps)/stock-counter/products/details",
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "#4caf50";
      case "in_progress":
        return "#ff9800";
      default:
        return "#fbbf24"; // เปลี่ยนจากเทาเป็นเหลือง
    }
  };

  const getStatusIcon = (status?: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "in_progress":
        return "camera"; // เปลี่ยนจาก time เป็น camera
      default:
        return "time-outline"; // เปลี่ยนเป็นนาฬิกาให้ตรงกับ filter
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "completed":
        return "นับแล้ว";
      case "in_progress":
        return "แนบรูปแล้ว"; // เปลี่ยนจาก กำลังนับ
      default:
        return "รอนับ";
    }
  };

  // Filter products first, then paginate
  const filteredProducts = pagination.data.filter((product) => {
    // Status filter
    const matchesStatus =
      filter === "all"
        ? true
        : filter === "pending"
          ? !product.status || product.status === "pending"
          : product.status === filter;

    // Search filter
    if (!matchesStatus) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      product.name?.toLowerCase().includes(term) ||
      product.sku?.toLowerCase().includes(term) ||
      product.productId?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    );
  });

  // Handle load more for infinite scroll
  const handleLoadMore = () => {
    if (pagination.hasMore) {
      pagination.loadMore();
    }
  };

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
            source={{ uri: fixFirebaseStorageUrl(item.imageUrl) }}
            style={styles.listProductImage}
            contentFit="cover"
            transition={200}
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
            {item.barcode || item.sku}
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

      {/* Skip Button */}
      {item.status !== "completed" && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleSkipProduct(item)}
        >
          <Ionicons name="close-circle" size={20} color="#f59e0b" />
        </TouchableOpacity>
      )}

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
          <Image
            source={{ uri: fixFirebaseStorageUrl(item.imageUrl) }}
            style={styles.productImage}
            contentFit="cover"
            transition={200}
          />
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
          {item.barcode || item.sku}
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
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.noBranchIcon,
            { backgroundColor: colors.primary + "15" },
          ]}
        >
          <Ionicons name="business-outline" size={60} color={colors.primary} />
        </View>
        <Text style={[styles.noBranchTitle, { color: colors.text }]}>
          ยังไม่มีสาขา
        </Text>
        <Text
          style={[styles.noBranchDescription, { color: colors.textSecondary }]}
        >
          คุณยังไม่ได้เป็นสมาชิกของสาขาใดๆ{"\n"}
          กรุณารอคำเชิญจากผู้ดูแลระบบ
        </Text>

        {/* Check Inbox Button */}
        <TouchableOpacity
          style={[styles.checkInboxButton, { backgroundColor: colors.primary }]}
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
    );
  }

  if (loading && products.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          กำลังโหลดรายการสินค้า...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Section */}
      <View
        style={[
          styles.filterSection,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ค้นหาชื่อ, รหัส, บาร์โค้ด..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
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

      {/* Product List */}
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
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          pagination.hasMore && filteredProducts.length > 0 ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.loadMoreText, { color: colors.textSecondary }]}
              >
                กำลังโหลดเพิ่มเติม...
              </Text>
            </View>
          ) : null
        }
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

      {/* Floating Add Button */}
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() =>
          router.push("/(mini-apps)/stock-counter/products/add-product")
        }
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterContainer: {
    flexDirection: "row",
    gap: 8,
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
  floatingButton: {
    position: "absolute",
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  skipButton: {
    padding: 8,
    marginRight: 4,
  },
  loadMoreContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
});
