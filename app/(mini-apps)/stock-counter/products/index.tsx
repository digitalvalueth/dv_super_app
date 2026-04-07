import { usePaginationState } from "@/hooks/usePaginatedQuery";
import { subscribeToProductsWithAssignments } from "@/services/product.service";
import { useAuthStore } from "@/stores/auth.store";
import { useProductStore } from "@/stores/product.store";
import { useTheme } from "@/stores/theme.store";
import { ProductWithAssignment } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  const { viewMode, uploadStatus, periodMessage } = useViewMode();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "completed" | "not_available"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Pagination for better performance
  const pagination = usePaginationState<ProductWithAssignment>(20);

  // Derive branch tabs: prefer user.branchIds (authoritative) over product-derived ids
  const branchTabs = useMemo(() => {
    // If user explicitly has multiple branches, show all of them
    const userBranchIds = user?.branchIds;
    if (userBranchIds && userBranchIds.length > 1) {
      return userBranchIds.map((id) => ({
        id,
        name: user?.branchNames?.[id] || user?.branchName || id,
      }));
    }
    // Fallback: derive from loaded products
    const branchIds = Array.from(
      new Set(
        products.map((p) => p.assignmentBranchId).filter(Boolean) as string[],
      ),
    );
    if (branchIds.length <= 1) return [];
    return branchIds.map((id) => ({
      id,
      name: user?.branchNames?.[id] || id,
    }));
  }, [products, user?.branchIds, user?.branchNames, user?.branchName]);

  // Reset branch selection when tabs change
  useEffect(() => {
    if (branchTabs.length > 0 && !selectedBranchId) {
      // Default to user's primary branchId if it's in the tabs, else first tab
      const defaultId =
        user?.branchId && branchTabs.find((t) => t.id === user.branchId)
          ? user.branchId
          : branchTabs[0].id;
      setSelectedBranchId(defaultId);
    }
    if (branchTabs.length === 0) {
      setSelectedBranchId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchTabs.length]);

  // Products filtered by selected branch (if multi-branch)
  // Match on assignmentBranchId (from assignment doc) or fallback to product's branchId
  const branchFilteredProducts = useMemo(() => {
    if (!selectedBranchId) return products;
    return products.filter(
      (p) =>
        (p.assignmentBranchId && p.assignmentBranchId === selectedBranchId) ||
        (!p.assignmentBranchId && p.branchId === selectedBranchId),
    );
  }, [products, selectedBranchId]);

  // Calculate counts for filter badges (scoped to selected branch)
  const counts = {
    all: branchFilteredProducts.length,
    pending: branchFilteredProducts.filter(
      (p) => !p.status || p.status === "pending",
    ).length,
    in_progress: branchFilteredProducts.filter(
      (p) => p.status === "in_progress",
    ).length,
    completed: branchFilteredProducts.filter((p) => p.status === "completed")
      .length,
    not_available: branchFilteredProducts.filter(
      (p) => p.status === "not_available",
    ).length,
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

  const handleProductPress = (product: ProductWithAssignment) => {
    // บล็อคเมื่อสถานะ locked หรือ closed (ไม่ใช่ completed ที่ดูประวัติได้เสมอ)
    if (
      product.status !== "completed" &&
      (uploadStatus === "locked" || uploadStatus === "closed")
    ) {
      Alert.alert(
        uploadStatus === "locked" ? "🔒 ระบบปิดชั่วคราว" : "❌ หมดเวลาส่งรูป",
        periodMessage ||
          (uploadStatus === "locked"
            ? "ระบบปิดรับรูปชั่วคราว กรุณากลับมาพรุ่งนี้"
            : "หมดเวลาส่งรูปรอบนี้แล้ว"),
        [{ text: "ตกลง" }],
      );
      return;
    }

    if (product.status === "not_available") {
      // ไม่มีในสาขา → ไม่ให้กดเข้าไป
      return;
    }

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
          productBarcode: product.barcode || "",
          assignmentId: product.assignment?.id || "",
          assignmentBranchId:
            product.assignmentBranchId || selectedBranchId || "",
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
        assignmentBranchId:
          product.assignmentBranchId || selectedBranchId || "",
      },
    });
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed":
        return "#4caf50";
      case "in_progress":
        return "#ff9800";
      case "not_available":
        return "#9ca3af";
      default:
        return "#fbbf24";
    }
  };

  const getStatusIcon = (status?: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case "completed":
        return "checkmark-circle";
      case "in_progress":
        return "camera";
      case "not_available":
        return "close-circle";
      default:
        return "time-outline";
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "completed":
        return "นับแล้ว";
      case "in_progress":
        return "แนบรูปแล้ว";
      case "not_available":
        return "ไม่มีในสาขา";
      default:
        return "รอนับ";
    }
  };

  // Re-paginate when branch selection or products change
  useEffect(() => {
    pagination.setData(branchFilteredProducts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilteredProducts]);

  // Filter products first, then paginate
  // When searching, scan all data; otherwise use the paginated slice for performance
  const sourceData = searchTerm.trim() ? pagination.allData : pagination.data;
  const filteredProducts = sourceData.filter((product) => {
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
      icon: "time-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "in_progress" as const,
      label: "แนบรูปแล้ว",
      icon: "camera" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "completed" as const,
      label: "นับแล้ว",
      icon: "checkmark-circle" as keyof typeof Ionicons.glyphMap,
    },
    {
      key: "not_available" as const,
      label: "ไม่มีในสาขา",
      icon: "close-circle" as keyof typeof Ionicons.glyphMap,
    },
  ];

  const renderProductList = ({ item }: { item: ProductWithAssignment }) => (
    <TouchableOpacity
      style={[
        styles.productListCard,
        { backgroundColor: colors.card },
        item.status === "not_available" && { opacity: 0.5 },
      ]}
      onPress={() => handleProductPress(item)}
      activeOpacity={0.7}
      disabled={item.status === "not_available"}
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

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderProduct = ({ item }: { item: ProductWithAssignment }) => (
    <View
      style={[
        styles.productCard,
        { backgroundColor: colors.card },
        item.status === "not_available" && { opacity: 0.5 },
      ]}
    >
      <TouchableOpacity
        onPress={() => handleProductPress(item)}
        activeOpacity={0.7}
        disabled={item.status === "not_available"}
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
            <Ionicons
              name={getStatusIcon(item.status)}
              size={14}
              color="#fff"
            />
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
              <Text
                style={[styles.metricText, { color: colors.textSecondary }]}
              >
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
    </View>
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

        {/* Branch Tabs — only shown when user has products from multiple branches */}
        {branchTabs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              gap: 8,
              flexDirection: "row",
            }}
          >
            {branchTabs.map((branch) => (
              <TouchableOpacity
                key={branch.id}
                style={[
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1.5,
                    backgroundColor:
                      selectedBranchId === branch.id
                        ? colors.primary
                        : colors.background,
                    borderColor:
                      selectedBranchId === branch.id
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => setSelectedBranchId(branch.id)}
              >
                <Text
                  style={{
                    color:
                      selectedBranchId === branch.id
                        ? "#fff"
                        : colors.textSecondary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  🏪 {branch.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

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
          pagination.hasMore &&
          filteredProducts.length > 0 &&
          filteredProducts.length < (counts[filter] ?? counts.all) ? (
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
