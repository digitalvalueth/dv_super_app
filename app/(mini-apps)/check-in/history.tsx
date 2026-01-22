import { getUserCheckInHistory } from "@/services/checkin.service";
import { useAuthStore } from "@/stores/auth.store";
import { useCheckInStore } from "@/stores/checkin.store";
import { useTheme } from "@/stores/theme.store";
import { CheckIn } from "@/types";
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

export default function CheckInHistoryScreen() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { history, setHistory, loading, setLoading } = useCheckInStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const data = await getUserCheckInHistory(user.uid, 50);
      setHistory(data);
    } catch (error) {
      console.error("Error loading check-in history:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, setHistory, setLoading]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

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
    const groups: { [key: string]: CheckIn[] } = {};

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

  const renderItem = ({ item }: { item: CheckIn }) => {
    const isCheckIn = item.type === "check-in";

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
          <View style={styles.itemHeader}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: isCheckIn ? "#D1FAE5" : "#E0E7FF" },
              ]}
            >
              <Ionicons
                name={isCheckIn ? "log-in-outline" : "log-out-outline"}
                size={14}
                color={isCheckIn ? "#10B981" : "#6366F1"}
              />
              <Text
                style={[
                  styles.typeBadgeText,
                  { color: isCheckIn ? "#10B981" : "#6366F1" },
                ]}
              >
                {isCheckIn ? "เข้างาน" : "เลิกงาน"}
              </Text>
            </View>

            {item.isLate && isCheckIn && (
              <View style={styles.lateBadge}>
                <Text style={styles.lateText}>สาย {item.lateMinutes} นาที</Text>
              </View>
            )}
          </View>

          <Text style={[styles.itemTime, { color: colors.text }]}>
            {formatTime(item.createdAt)}
          </Text>

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

  const grouped = groupedHistory();

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
          ประวัติการเช็คชื่อ
        </Text>
        <View style={styles.placeholder} />
      </View>

      {loading && history.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="time-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            ยังไม่มีประวัติการเช็คชื่อ
          </Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View>
              {renderSectionHeader(item.date)}
              {item.items.map((checkIn) => (
                <View key={checkIn.id}>{renderItem({ item: checkIn })}</View>
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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemContainer: {
    flexDirection: "row",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  itemImage: {
    width: 80,
    height: 80,
  },
  itemContent: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  lateBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lateText: {
    color: "#F59E0B",
    fontSize: 10,
    fontWeight: "600",
  },
  itemTime: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
});
