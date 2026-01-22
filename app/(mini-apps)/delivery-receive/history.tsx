import { useAuthStore } from "@/stores/auth.store";
import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { DeliveryReceive } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DeliveryHistoryScreen() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { history, loadHistory, isLoadingHistory } = useDeliveryStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.uid) return;
    await loadHistory(user.uid);
  }, [user?.uid, loadHistory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Format time from Timestamp
  const formatTime = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format date from Timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Group history by date
  const groupedHistory = useCallback(() => {
    const groups: { [key: string]: DeliveryReceive[] } = {};

    history.forEach((item) => {
      const date = item.createdAt?.toDate
        ? item.createdAt.toDate()
        : new Date(item.createdAt as any);
      const dateKey = date.toISOString().split("T")[0];

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    return Object.entries(groups)
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => {
          const dateA = a.createdAt?.toDate
            ? a.createdAt.toDate()
            : new Date(a.createdAt as any);
          const dateB = b.createdAt?.toDate
            ? b.createdAt.toDate()
            : new Date(b.createdAt as any);
          return dateB.getTime() - dateA.getTime();
        }),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [history]);

  const renderItem = ({ item }: { item: DeliveryReceive }) => {
    return (
      <View
        style={[
          styles.itemContainer,
          {
            backgroundColor: isDark ? colors.card : "#FFFFFF",
            borderColor: isDark ? colors.border : "#E5E7EB",
          },
        ]}
      >
        {/* Image */}
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.itemImage}
            resizeMode="cover"
          />
        )}

        {/* Content */}
        <View style={styles.itemContent}>
          {/* Header */}
          <View style={styles.itemHeader}>
            <View
              style={[styles.trackingBadge, { backgroundColor: "#EFF6FF" }]}
            >
              <Ionicons name="cube-outline" size={14} color="#3B82F6" />
              <Text style={styles.trackingText} numberOfLines={1}>
                {item.trackingNumber}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: "#D1FAE5" }]}>
              <Text style={styles.statusText}>รับแล้ว</Text>
            </View>
          </View>

          {/* Time */}
          <Text style={[styles.itemTime, { color: colors.text }]}>
            {formatTime(item.createdAt)}
          </Text>

          {/* Products summary */}
          <View style={styles.productsRow}>
            <Ionicons
              name="layers-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.productsText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.products.length} รายการ • {item.totalItems} ชิ้น
            </Text>
          </View>

          {/* Location */}
          {item.watermarkData?.location && (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.locationText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.watermarkData.location}
              </Text>
            </View>
          )}

          {/* Notes indicator */}
          {item.notes && (
            <View style={styles.notesRow}>
              <Ionicons
                name="document-text-outline"
                size={14}
                color="#F59E0B"
              />
              <Text style={styles.notesIndicator}>มีหมายเหตุ</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderSectionHeader = (date: string) => {
    const dateObj = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let displayDate = "";
    if (dateObj.toDateString() === today.toDateString()) {
      displayDate = "วันนี้";
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      displayDate = "เมื่อวาน";
    } else {
      displayDate = formatDate({ toDate: () => dateObj });
    }

    return (
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionHeaderText, { color: colors.textSecondary }]}
        >
          {displayDate}
        </Text>
      </View>
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
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ประวัติการรับสินค้า
        </Text>
        <View style={styles.placeholder} />
      </View>

      {isLoadingHistory ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            กำลังโหลด...
          </Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            ยังไม่มีประวัติ
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            เมื่อคุณรับสินค้าแล้วจะแสดงที่นี่
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedHistory()}
          keyExtractor={(item) => item.date}
          renderItem={({ item: group }) => (
            <View>
              {renderSectionHeader(group.date)}
              {group.items.map((item) => (
                <View key={item.id} style={styles.itemWrapper}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
          )}
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemWrapper: {
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemImage: {
    width: 80,
    height: "100%",
    minHeight: 100,
  },
  itemContent: {
    flex: 1,
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  trackingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flex: 1,
  },
  trackingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },
  itemTime: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  productsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  productsText: {
    fontSize: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
  notesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  notesIndicator: {
    fontSize: 11,
    color: "#F59E0B",
    fontWeight: "500",
  },
});
