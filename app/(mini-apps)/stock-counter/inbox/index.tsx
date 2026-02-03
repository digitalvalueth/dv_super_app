import { db } from "@/config/firebase";
import { usePaginationState } from "@/hooks/usePaginatedQuery";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface PendingSession {
  id: string;
  productId: string;
  productName: string;
  productSKU: string;
  imageUrl?: string;
  imageURL?: string;
  beforeCountQty: number;
  currentCountQty: number;
  finalCount: number;
  variance: number;
  status: string;
  userId: string;
  userName?: string;
  createdAt: Timestamp;
  branchName?: string;
}

// Fix Firebase Storage URL encoding
const fixFirebaseStorageUrl = (url: string): string => {
  if (!url) return url;
  if (url.includes("%2F")) return url;
  const match = url.match(/\/o\/([^?]+)/);
  if (match) {
    const path = match[1];
    const encodedPath = path.split("/").map(encodeURIComponent).join("%2F");
    return url.replace(/\/o\/[^?]+/, `/o/${encodedPath}`);
  }
  return url;
};

export default function InboxScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination for better performance (20 items per page)
  const pagination = usePaginationState<PendingSession>(20);

  useEffect(() => {
    // Use branchId instead of companyId for better performance
    if (!user?.branchId) {
      setLoading(false);
      return;
    }

    // Listen to pending/pending-review counting sessions for this branch only
    const q = query(
      collection(db, "countingSessions"),
      where("branchId", "==", user.branchId), // Filter by branch instead of company
      where("status", "in", ["pending", "pending-review"]),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PendingSession[];

        console.log(`📬 Inbox updated: ${sessions.length} pending items`);
        pagination.setData(sessions); // Update pagination
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("❌ Inbox listener error:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.branchId]); // Changed dependency to branchId

  const handleRefresh = () => {
    setRefreshing(true);
    // onSnapshot will auto-refresh
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "เมื่อสักครู่";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชม.ที่แล้ว`;
    if (diffDays === 1) return "เมื่อวาน";
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    });
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return colors.textSecondary;
    return variance > 0 ? "#10b981" : "#ef4444";
  };

  const renderItem = ({ item }: { item: PendingSession }) => (
    <TouchableOpacity
      style={[styles.inboxCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl || item.imageURL ? (
            <Image
              source={{
                uri: fixFirebaseStorageUrl(item.imageUrl || item.imageURL!),
              }}
              style={styles.productImage}
              contentFit="cover"
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
                size={24}
                color={colors.textSecondary}
              />
            </View>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={[styles.productSKU, { color: colors.primary }]}>
            {item.productSKU}
          </Text>
          <Text
            style={[styles.productName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.productName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusBadge, { backgroundColor: "#fbbf2420" }]}
            >
              <Ionicons name="time" size={12} color="#f59e0b" />
              <Text style={[styles.statusText, { color: "#f59e0b" }]}>
                รอตรวจสอบ
              </Text>
            </View>
            <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.countInfo}>
        <View style={styles.countItem}>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            ก่อนนับ
          </Text>
          <Text style={[styles.countValue, { color: colors.text }]}>
            {item.beforeCountQty || 0}
          </Text>
        </View>

        <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />

        <View style={styles.countItem}>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            นับได้
          </Text>
          <Text style={[styles.countValue, { color: colors.text }]}>
            {item.finalCount ?? item.currentCountQty ?? 0}
          </Text>
        </View>

        <View
          style={[
            styles.varianceBadge,
            { backgroundColor: getVarianceColor(item.variance) + "15" },
          ]}
        >
          <Ionicons
            name={item.variance >= 0 ? "trending-up" : "trending-down"}
            size={14}
            color={getVarianceColor(item.variance)}
          />
          <Text
            style={[
              styles.varianceText,
              { color: getVarianceColor(item.variance) },
            ]}
          >
            {item.variance > 0 ? "+" : ""}
            {item.variance}
          </Text>
        </View>
      </View>

      {item.userName && (
        <View style={styles.footer}>
          <Ionicons
            name="person-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={[styles.reporterText, { color: colors.textSecondary }]}>
            โดย {item.userName}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Handle load more for pagination
  const handleLoadMore = () => {
    if (pagination.hasMore) {
      pagination.loadMore();
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          กำลังโหลด...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={pagination.data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          pagination.data.length === 0
            ? styles.emptyContainer
            : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          pagination.hasMore && pagination.data.length > 0 ? (
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
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <Ionicons
                name="checkmark-circle-outline"
                size={60}
                color="#10b981"
              />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              ไม่มีรายการรอตรวจสอบ
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              รายการนับที่รอการตรวจสอบจะแสดงที่นี่
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
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
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
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
  inboxCard: {
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
  },
  imageContainer: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productSKU: {
    fontSize: 12,
    fontWeight: "600",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 11,
  },
  countInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  countItem: {
    alignItems: "center",
    gap: 2,
  },
  countLabel: {
    fontSize: 11,
  },
  countValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  varianceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  varianceText: {
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  reporterText: {
    fontSize: 12,
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
});
