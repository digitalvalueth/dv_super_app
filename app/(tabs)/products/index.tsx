import { getProductsWithAssignments } from "@/services/product.service";
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

  useEffect(() => {
    loadProducts();
  }, [user]);

  const loadProducts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const productsWithAssignments = await getProductsWithAssignments(
        user.uid
      );
      setProducts(productsWithAssignments);
    } catch (error) {
      console.error("Error loading products:", error);
      alert("ไม่สามารถโหลดรายการสินค้าได้");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleProductPress = (product: ProductWithAssignment) => {
    if (product.status === "completed") {
      // Show completed status
      alert("คุณนับสินค้านี้เรียบร้อยแล้ว");
      return;
    }

    // Navigate to camera
    router.push({
      pathname: "/",
      params: {
        productId: product.id,
        productName: product.name,
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

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "✅ นับแล้ว";
      case "in_progress":
        return "⏳ กำลังนับ";
      default:
        return "⚪ รอนับ";
    }
  };

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
              size={48}
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
          <Text style={styles.statusBadgeText}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.productInfo}>
        <View style={styles.productHeader}>
          <Text style={styles.productSKU}>{item.sku}</Text>
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>

        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        {/* Metrics */}
        <View style={styles.metricsContainer}>
          <View style={[styles.metric, { backgroundColor: colors.background }]}>
            <Ionicons
              name="cube-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              จำนวนเดิม
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {item.beforeCountQty || 0}
            </Text>
          </View>

          {item.variance !== undefined && (
            <View
              style={[styles.metric, { backgroundColor: colors.background }]}
            >
              <Ionicons
                name={item.variance >= 0 ? "trending-up" : "trending-down"}
                size={16}
                color={item.variance >= 0 ? "#4caf50" : "#f44336"}
              />
              <Text
                style={[styles.metricLabel, { color: colors.textSecondary }]}
              >
                ส่วนต่าง
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  item.variance > 0 && styles.variancePositive,
                  item.variance < 0 && styles.varianceNegative,
                ]}
              >
                {item.variance > 0 ? "+" : ""}
                {item.variance}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

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
      </View>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            products.length === 0
              ? styles.emptyContainer
              : [styles.listContent, { paddingBottom: 110 }]
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.centered}>
                <Text style={styles.emptyEmoji}>📦</Text>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  ไม่มีรายการสินค้าที่ต้องนับ
                </Text>
                <Text
                  style={[styles.emptySubtext, { color: colors.textSecondary }]}
                >
                  ลากลงเพื่อรีเฟรช หรือติดต่อผู้ดูแลระบบเพื่อมอบหมายงาน
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
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
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },

  // Product Card - AllTrails inspired
  productCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    width: "100%",
    height: 200,
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
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Product Info
  productInfo: {
    padding: 16,
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  productSKU: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285f4",
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: "#f0f4ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    color: "#4285f4",
    fontWeight: "500",
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    lineHeight: 22,
  },

  // Metrics
  metricsContainer: {
    flexDirection: "row",
    gap: 16,
  },
  metric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    marginLeft: "auto",
  },
  variancePositive: {
    color: "#4caf50",
  },
  varianceNegative: {
    color: "#f44336",
  },
});
