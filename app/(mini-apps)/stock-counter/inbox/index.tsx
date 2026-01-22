import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface InboxItem {
  id: string;
  productName: string;
  productSKU: string;
  reportedBy: string;
  aiCount: number;
  actualCount: number;
  message: string;
  imageUrl?: string;
  timestamp: Date;
  status: "pending" | "approved" | "rejected";
}

export default function InboxScreen() {
  const { colors } = useTheme();
  const [loading] = useState(false);
  const [items] = useState<InboxItem[]>([
    // Mock data - จะต้องดึงจาก Firebase ภายหลัง
  ]);

  const renderItem = ({ item }: { item: InboxItem }) => (
    <TouchableOpacity
      style={[styles.inboxCard, { backgroundColor: colors.card }]}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.productInfo}>
          <Text style={[styles.productSKU, { color: colors.primary }]}>
            {item.productSKU}
          </Text>
          <Text style={[styles.productName, { color: colors.text }]}>
            {item.productName}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "pending"
                  ? "#fbbf24"
                  : item.status === "approved"
                    ? "#10b981"
                    : "#ef4444",
            },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status === "pending"
              ? "รอตรวจสอบ"
              : item.status === "approved"
                ? "อนุมัติ"
                : "ปฏิเสธ"}
          </Text>
        </View>
      </View>

      <View style={styles.countInfo}>
        <View style={styles.countItem}>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            AI นับได้
          </Text>
          <Text style={[styles.countValue, { color: colors.text }]}>
            {item.aiCount}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.textSecondary} />
        <View style={styles.countItem}>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            แจ้งปรับเป็น
          </Text>
          <Text style={[styles.countValue, { color: "#ef4444" }]}>
            {item.actualCount}
          </Text>
        </View>
      </View>

      <Text style={[styles.message, { color: colors.textSecondary }]}>
        💬 {item.message}
      </Text>

      <View style={styles.footer}>
        <View style={styles.reporterInfo}>
          <Ionicons name="person" size={14} color={colors.textSecondary} />
          <Text style={[styles.reporterText, { color: colors.textSecondary }]}>
            {item.reportedBy}
          </Text>
        </View>
        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
          {item.timestamp.toLocaleDateString("th-TH")}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons
              name="mail-outline"
              size={80}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              ไม่มีรายการแจ้งปัญหา
            </Text>
            <Text
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              เมื่อพนักงานแจ้งปัญหาจะแสดงที่นี่
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
  inboxCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productSKU: {
    fontSize: 12,
    fontWeight: "600",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  countInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  countItem: {
    alignItems: "center",
    gap: 4,
  },
  countLabel: {
    fontSize: 12,
  },
  countValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reporterInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reporterText: {
    fontSize: 13,
  },
  timestamp: {
    fontSize: 12,
  },
});
