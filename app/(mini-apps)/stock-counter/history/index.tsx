import { db } from "@/config/firebase";
import { usePaginationState } from "@/hooks/usePaginatedQuery";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { CountingSession } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

// Group sessions by time periods
const groupSessionsByTime = (sessions: CountingSession[]) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: { [key: string]: CountingSession[] } = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  sessions.forEach((session) => {
    const sessionDate = session.createdAt.toDate();
    const sessionDay = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate(),
    );

    if (sessionDay.getTime() === today.getTime()) {
      groups.today.push(session);
    } else if (sessionDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(session);
    } else if (sessionDate >= thisWeekStart && sessionDate < today) {
      groups.thisWeek.push(session);
    } else if (sessionDate >= thisMonthStart && sessionDate < thisWeekStart) {
      groups.thisMonth.push(session);
    } else {
      groups.older.push(session);
    }
  });

  return groups;
};

export default function HistoryScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [sessions, setSessions] = useState<CountingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination for better performance (20 items per page)
  const pagination = usePaginationState<CountingSession>(20);

  useEffect(() => {
    if (!user?.uid || !user?.companyId || !user?.branchId) {
      setLoading(false);
      return;
    }

    console.log("🔔 Setting up history listener...");
    const q = query(
      collection(db, "countingSessions"),
      where("userId", "==", user.uid),
      where("branchId", "==", user.branchId), // Use branchId only for better performance
      where("status", "==", "completed"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const sessionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as CountingSession[];

        console.log(`✅ History updated: ${sessionsData.length} sessions`);
        setSessions(sessionsData);
        pagination.setData(sessionsData); // Update pagination
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("❌ History listener error:", error);
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => {
      console.log("🚧 Cleaning up history listener");
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.branchId]); // Removed companyId dependency

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleSessionPress = (session: CountingSession) => {
    router.push({
      pathname: "/(mini-apps)/stock-counter/products/completed",
      params: {
        productId: session.productId,
        productName: session.productName || "",
        productSKU: session.productSKU || "",
        productImage: session.imageUrl || session.imageURL || "",
        beforeQty: session.beforeCountQty?.toString() || "0",
      },
    });
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return colors.textSecondary;
    return variance > 0 ? "#4caf50" : "#f44336";
  };

  const renderSession = (session: CountingSession) => (
    <TouchableOpacity
      key={session.id}
      style={[styles.sessionCard, { backgroundColor: colors.card }]}
      onPress={() => handleSessionPress(session)}
      activeOpacity={0.7}
    >
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {session.imageUrl || session.imageURL ? (
          <Image
            source={{
              uri: fixFirebaseStorageUrl(session.imageUrl || session.imageURL!),
            }}
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
              size={32}
              color={colors.textSecondary}
            />
          </View>
        )}
      </View>

      {/* Session Info */}
      <View style={styles.sessionInfo}>
        <View style={styles.sessionHeader}>
          <Text style={styles.productSKU} numberOfLines={1}>
            {session.productSKU}
          </Text>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatTime(session.createdAt)}
          </Text>
        </View>

        <Text
          style={[styles.productName, { color: colors.text }]}
          numberOfLines={1}
        >
          {session.productName}
        </Text>

        {/* Count Details */}
        <View style={styles.countRow}>
          <View style={styles.countItem}>
            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              ก่อนนับ
            </Text>
            <Text style={[styles.countValue, { color: colors.text }]}>
              {session.beforeCountQty || 0}
            </Text>
          </View>

          <Ionicons
            name="arrow-forward"
            size={16}
            color={colors.textSecondary}
          />

          <View style={styles.countItem}>
            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              หลังนับ
            </Text>
            <Text style={[styles.countValue, { color: colors.text }]}>
              {session.finalCount ?? session.currentCountQty ?? 0}
            </Text>
          </View>

          <View
            style={[
              styles.varianceBadge,
              { backgroundColor: getVarianceColor(session.variance) + "15" },
            ]}
          >
            <Ionicons
              name={session.variance >= 0 ? "trending-up" : "trending-down"}
              size={14}
              color={getVarianceColor(session.variance)}
            />
            <Text
              style={[
                styles.varianceText,
                { color: getVarianceColor(session.variance) },
              ]}
            >
              {session.variance > 0 ? "+" : session.variance < 0 ? "" : ""}
              {session.variance}
            </Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  // No company/branch
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
          คุณต้องเป็นสมาชิกของสาขาก่อน{"\n"}
          จึงจะดูประวัติการนับได้
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          กำลังโหลดประวัติ...
        </Text>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Ionicons name="time-outline" size={80} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          ยังไม่มีประวัติการนับ
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          เมื่อคุณนับสินค้าเสร็จแล้ว{"\n"}
          ประวัติจะแสดงที่นี่
        </Text>
      </ScrollView>
    );
  }

  // Use paginated data for display
  const groupedSessions = groupSessionsByTime(pagination.data);
  const sections = [
    { title: "วันนี้", data: groupedSessions.today },
    { title: "เมื่อวาน", data: groupedSessions.yesterday },
    { title: "สัปดาห์นี้", data: groupedSessions.thisWeek },
    { title: "เดือนนี้", data: groupedSessions.thisMonth },
    { title: "เก่ากว่านี้", data: groupedSessions.older },
  ].filter((section) => section.data.length > 0);

  // Handle load more
  const handleLoadMore = () => {
    if (pagination.hasMore) {
      pagination.loadMore();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderSession(item)}
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {title}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        stickySectionHeadersEnabled={true}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  columnHeaderLeft: {
    flex: 1,
  },
  columnHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  columnHeaderText: {
    fontSize: 13,
    fontWeight: "600",
  },
  columnHeaderTextSmall: {
    fontSize: 11,
    fontWeight: "500",
    width: 50,
    textAlign: "center",
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
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
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
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
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productSKU: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4285f4",
    letterSpacing: 0.3,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  countItem: {
    alignItems: "center",
  },
  countLabel: {
    fontSize: 10,
    fontWeight: "500",
  },
  countValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  varianceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: "auto",
  },
  varianceText: {
    fontSize: 13,
    fontWeight: "700",
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
