import { getProductsWithAssignments } from "@/services/product.service";
import { useAuthStore } from "@/stores/auth.store";
import { useProductStore } from "@/stores/product.store";
import { ProductWithAssignment } from "@/types";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { products, setProducts, setLoading, loading } = useProductStore();
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
      pathname: "/(app)/camera",
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
      style={[
        styles.productCard,
        item.status === "completed" && styles.productCardCompleted,
      ]}
      onPress={() => handleProductPress(item)}
      disabled={item.status === "completed"}
    >
      <View style={styles.productHeader}>
        <Text style={styles.productSKU}>{item.sku}</Text>
        <Text style={[styles.status, { color: getStatusColor(item.status) }]}>
          {getStatusText(item.status)}
        </Text>
      </View>

      <Text style={styles.productName} numberOfLines={2}>
        {item.name}
      </Text>

      <View style={styles.productFooter}>
        <View style={styles.countInfo}>
          <Text style={styles.countLabel}>จำนวนเดิม:</Text>
          <Text style={styles.countValue}>{item.beforeCountQty || 0}</Text>
        </View>

        {item.variance !== undefined && (
          <View style={styles.varianceInfo}>
            <Text style={styles.countLabel}>ส่วนต่าง:</Text>
            <Text
              style={[
                styles.varianceValue,
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
    </TouchableOpacity>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4285f4" />
        <Text style={styles.loadingText}>กำลังโหลดรายการสินค้า...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>📦</Text>
        <Text style={styles.emptyText}>ไม่มีรายการสินค้าที่ต้องนับ</Text>
        <Text style={styles.emptySubtext}>
          กรุณาติดต่อผู้ดูแลระบบเพื่อมอบหมายงาน
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    padding: 16,
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
    color: "#666",
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productCardCompleted: {
    opacity: 0.6,
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
  },
  status: {
    fontSize: 14,
    fontWeight: "600",
  },
  productName: {
    fontSize: 16,
    color: "#333",
    marginBottom: 12,
    lineHeight: 22,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  countInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  countLabel: {
    fontSize: 14,
    color: "#999",
    marginRight: 8,
  },
  countValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  varianceInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  varianceValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  variancePositive: {
    color: "#4caf50",
  },
  varianceNegative: {
    color: "#f44336",
  },
});
