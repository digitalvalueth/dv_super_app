import {
  approveSupplementSession,
  getCompanySupplements,
  rejectSupplementSession,
} from "@/services/supplement.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import type { SupplementSession } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SupplementCountScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [supplements, setSupplements] = useState<SupplementSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [selectedItem, setSelectedItem] = useState<SupplementSession | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const loadSupplements = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const data = await getCompanySupplements(
        user.companyId,
        filterStatus === "all" ? undefined : filterStatus,
      );

      // Sort by newest first
      data.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime?.() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });

      setSupplements(data);
    } catch (error) {
      console.error("Error loading supplements:", error);
    } finally {
      setLoading(false);
    }
  }, [user, filterStatus]);

  useEffect(() => {
    loadSupplements();
  }, [loadSupplements]);

  const handleApprove = async (item: SupplementSession) => {
    if (!user?.uid) return;
    Alert.alert(
      "อนุมัตินับเสริม",
      `ยืนยันอนุมัติ +${item.additionalCount} ชิ้น สำหรับ ${item.productName}?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "อนุมัติ",
          onPress: async () => {
            setSubmitting(true);
            try {
              await approveSupplementSession(item.id, user.uid);
              setSupplements((prev) =>
                prev.map((s) =>
                  s.id === item.id ? { ...s, status: "approved" } : s,
                ),
              );
              setSelectedItem(null);
              Alert.alert("สำเร็จ", "อนุมัติเรียบร้อย");
            } catch {
              Alert.alert("เกิดข้อผิดพลาด", "กรุณาลองใหม่");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = async (item: SupplementSession) => {
    if (!user?.uid) return;
    Alert.alert("ปฏิเสธ", `ปฏิเสธการนับเสริม ${item.productName}?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ปฏิเสธ",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          try {
            await rejectSupplementSession(item.id, user.uid);
            setSupplements((prev) =>
              prev.map((s) =>
                s.id === item.id ? { ...s, status: "rejected" } : s,
              ),
            );
            setSelectedItem(null);
          } catch {
            Alert.alert("เกิดข้อผิดพลาด", "กรุณาลองใหม่");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const statusConfig = {
    pending: {
      label: "รออนุมัติ",
      color: "#f59e0b",
      icon: "time-outline" as const,
    },
    approved: {
      label: "อนุมัติ",
      color: "#10b981",
      icon: "checkmark-circle-outline" as const,
    },
    rejected: {
      label: "ปฏิเสธ",
      color: "#ef4444",
      icon: "close-circle-outline" as const,
    },
  };

  const renderItem = ({ item }: { item: SupplementSession }) => {
    const config = statusConfig[item.status] || statusConfig.pending;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => setSelectedItem(item)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.productName, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.productName || "Unknown"}
            </Text>
            <Text style={[styles.userName, { color: colors.textSecondary }]}>
              {item.userName}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: config.color + "20" },
            ]}
          >
            <Ionicons name={config.icon} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <View style={styles.countRow}>
          <View style={styles.countItem}>
            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              AI นับได้
            </Text>
            <Text style={[styles.countValue, { color: "#3b82f6" }]}>
              {item.aiCount}
            </Text>
          </View>
          <Ionicons name="add" size={20} color={colors.textSecondary} />
          <View style={styles.countItem}>
            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
              นับเสริม
            </Text>
            <Text style={[styles.countValue, { color: "#10b981" }]}>
              +{item.additionalCount}
            </Text>
          </View>
        </View>

        {item.reason ? (
          <Text
            style={[styles.reason, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            เหตุผล: {item.reason}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  const filterOptions: { key: typeof filterStatus; label: string }[] = [
    { key: "pending", label: "รออนุมัติ" },
    { key: "approved", label: "อนุมัติ" },
    { key: "rejected", label: "ปฏิเสธ" },
    { key: "all", label: "ทั้งหมด" },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={[]}
    >
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filterOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.filterTab,
              filterStatus === opt.key && { backgroundColor: colors.primary },
              filterStatus !== opt.key && { backgroundColor: colors.card },
            ]}
            onPress={() => setFilterStatus(opt.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color:
                    filterStatus === opt.key ? "#fff" : colors.textSecondary,
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : supplements.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="layers-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            ไม่มีรายการนับเสริม
          </Text>
        </View>
      ) : (
        <FlatList
          data={supplements}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <Modal visible animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  รายละเอียดนับเสริม
                </Text>
                <TouchableOpacity onPress={() => setSelectedItem(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={[styles.modalProduct, { color: colors.text }]}>
                  {selectedItem.productName}
                </Text>
                <Text
                  style={[styles.modalUser, { color: colors.textSecondary }]}
                >
                  โดย: {selectedItem.userName}
                </Text>

                <View style={styles.modalCountGrid}>
                  <View style={styles.modalCountBox}>
                    <Text
                      style={[
                        styles.modalCountLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      🤖 AI นับได้
                    </Text>
                    <Text
                      style={[styles.modalCountValue, { color: "#3b82f6" }]}
                    >
                      {selectedItem.aiCount}
                    </Text>
                  </View>
                  <View style={styles.modalCountBox}>
                    <Text
                      style={[
                        styles.modalCountLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      ➕ นับเสริม
                    </Text>
                    <Text
                      style={[styles.modalCountValue, { color: "#10b981" }]}
                    >
                      +{selectedItem.additionalCount}
                    </Text>
                  </View>
                </View>

                {selectedItem.reason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonBoxLabel}>เหตุผล:</Text>
                    <Text style={styles.reasonBoxText}>
                      {selectedItem.reason}
                    </Text>
                  </View>
                ) : null}

                {/* Action buttons only for pending items */}
                {selectedItem.status === "pending" && (
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn]}
                      onPress={() => handleReject(selectedItem)}
                      disabled={submitting}
                    >
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                      <Text style={styles.rejectBtnText}>ปฏิเสธ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn]}
                      onPress={() => handleApprove(selectedItem)}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color="#fff"
                          />
                          <Text style={styles.approveBtnText}>อนุมัติ</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  filterTabText: { fontSize: 13, fontWeight: "600" },
  list: { padding: 16, paddingTop: 4 },
  card: { borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  productName: { fontSize: 15, fontWeight: "700" },
  userName: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  countItem: { alignItems: "center" },
  countLabel: { fontSize: 11 },
  countValue: { fontSize: 22, fontWeight: "800" },
  reason: { fontSize: 12, marginTop: 8, fontStyle: "italic" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { gap: 12 },
  modalProduct: { fontSize: 18, fontWeight: "700" },
  modalUser: { fontSize: 14 },
  modalCountGrid: { flexDirection: "row", gap: 12, marginTop: 8 },
  modalCountBox: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  modalCountLabel: { fontSize: 12 },
  modalCountValue: { fontSize: 28, fontWeight: "800", marginTop: 4 },
  reasonBox: {
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  reasonBoxLabel: { fontSize: 12, color: "#92400e", fontWeight: "600" },
  reasonBoxText: { fontSize: 14, color: "#78350f", marginTop: 4 },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  rejectBtnText: { color: "#ef4444", fontSize: 16, fontWeight: "600" },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#10b981",
  },
  approveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
