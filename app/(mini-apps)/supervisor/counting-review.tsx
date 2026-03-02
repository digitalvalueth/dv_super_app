import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { FinalCountSource } from "@/types";

interface ReviewItem {
  id: string;
  productName: string;
  productSKU: string;
  branchName: string;
  userName: string;
  imageUrl: string;
  aiCount: number;
  employeeCount: number | null; // userReportedCount
  currentCountQty: number;
  disputeRemark: string | null;
  createdAt: any;
}

export default function CountingReviewScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSource, setSelectedSource] = useState<FinalCountSource>("ai");
  const [customCount, setCustomCount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadItems = useCallback(async () => {
    if (!user?.companyId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "countingSessions"),
        where("companyId", "==", user.companyId),
        where("status", "==", "completed"),
        ...(user.branchId ? [where("branchId", "==", user.branchId)] : []),
      );
      const snap = await getDocs(q);
      const reviewItems: ReviewItem[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        // Show sessions that have a dispute OR where supervisor hasn't overridden yet
        const hasDispute = data.userReportedCount !== undefined;
        const notOverridden = !data.supervisorOverride;

        if (hasDispute && notOverridden) {
          reviewItems.push({
            id: d.id,
            productName: data.productName || data.productSKU || "Unknown",
            productSKU: data.productSKU || "",
            branchName: data.branchName || "",
            userName: data.userName || "",
            imageUrl: data.imageUrl || data.imageURL || "",
            aiCount: data.aiCount ?? data.currentCountQty ?? 0,
            employeeCount: data.userReportedCount ?? null,
            currentCountQty: data.currentCountQty ?? 0,
            disputeRemark: data.errorRemark || null,
            createdAt: data.createdAt,
          });
        }
      }

      // Sort by newest first
      reviewItems.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });

      setItems(reviewItems);
    } catch (error) {
      console.error("Error loading review items:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openReviewModal = (item: ReviewItem) => {
    setSelectedItem(item);
    setSelectedSource("ai");
    setCustomCount("");
    setReason("");
    setModalVisible(true);
  };

  const getSelectedCount = (): number => {
    if (!selectedItem) return 0;
    switch (selectedSource) {
      case "ai":
        return selectedItem.aiCount;
      case "employee":
        return selectedItem.employeeCount ?? selectedItem.aiCount;
      case "custom":
        return parseInt(customCount) || 0;
    }
  };

  const handleSubmitOverride = async () => {
    if (!selectedItem || !user?.uid) return;

    const finalCount = getSelectedCount();
    if (selectedSource === "custom" && (!customCount || isNaN(parseInt(customCount)))) {
      Alert.alert("กรุณากรอกจำนวน", "กรอกจำนวนที่ต้องการใช้");
      return;
    }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, "countingSessions", selectedItem.id), {
        finalCount,
        finalCountSource: selectedSource,
        approvalStatus: "approved",
        supervisorOverride: {
          overriddenBy: user.uid,
          overriddenByName: user.name || "",
          overriddenAt: Timestamp.now(),
          aiCount: selectedItem.aiCount,
          employeeCount: selectedItem.employeeCount ?? 0,
          selectedCount: finalCount,
          source: selectedSource,
          ...(selectedSource === "custom" && { customCount: parseInt(customCount) }),
          ...(reason && { reason }),
        },
        updatedAt: new Date(),
      });

      Alert.alert("สำเร็จ", `ยืนยันยอด ${finalCount} ชิ้น เรียบร้อย`);
      setModalVisible(false);
      // Remove from list
      setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
    } catch (error) {
      console.error("Error submitting override:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: ReviewItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => openReviewModal(item)}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.thumbnail, { backgroundColor: colors.border }]}>
          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={[styles.branchName, { color: colors.textSecondary }]}>
          {item.branchName} — {item.userName}
        </Text>
        <View style={styles.countRow}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeLabel}>🤖 AI</Text>
            <Text style={[styles.countBadgeValue, { color: "#3b82f6" }]}>
              {item.aiCount}
            </Text>
          </View>
          {item.employeeCount !== null && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeLabel}>👤 พนง.</Text>
              <Text style={[styles.countBadgeValue, { color: "#f59e0b" }]}>
                {item.employeeCount}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            ไม่มีรายการรอรีวิว
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Review Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                เลือกยอดนับ
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <>
                <Text style={[styles.modalProduct, { color: colors.text }]}>
                  {selectedItem.productName}
                </Text>
                <Text style={[styles.modalBranch, { color: colors.textSecondary }]}>
                  {selectedItem.branchName} — {selectedItem.userName}
                </Text>

                {selectedItem.disputeRemark && (
                  <View style={styles.remarkBox}>
                    <Text style={styles.remarkLabel}>หมายเหตุจากพนักงาน:</Text>
                    <Text style={styles.remarkText}>{selectedItem.disputeRemark}</Text>
                  </View>
                )}

                {/* Source Selection */}
                <View style={styles.sourceOptions}>
                  <TouchableOpacity
                    style={[
                      styles.sourceOption,
                      selectedSource === "ai" && styles.sourceOptionSelected,
                      { borderColor: selectedSource === "ai" ? "#3b82f6" : colors.border },
                    ]}
                    onPress={() => setSelectedSource("ai")}
                  >
                    <Text style={styles.sourceIcon}>🤖</Text>
                    <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>
                      AI นับได้
                    </Text>
                    <Text style={[styles.sourceCount, { color: "#3b82f6" }]}>
                      {selectedItem.aiCount}
                    </Text>
                    {selectedSource === "ai" && (
                      <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                    )}
                  </TouchableOpacity>

                  {selectedItem.employeeCount !== null && (
                    <TouchableOpacity
                      style={[
                        styles.sourceOption,
                        selectedSource === "employee" && styles.sourceOptionSelected,
                        {
                          borderColor:
                            selectedSource === "employee" ? "#f59e0b" : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedSource("employee")}
                    >
                      <Text style={styles.sourceIcon}>👤</Text>
                      <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>
                        พนักงานรายงาน
                      </Text>
                      <Text style={[styles.sourceCount, { color: "#f59e0b" }]}>
                        {selectedItem.employeeCount}
                      </Text>
                      {selectedSource === "employee" && (
                        <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.sourceOption,
                      selectedSource === "custom" && styles.sourceOptionSelected,
                      {
                        borderColor:
                          selectedSource === "custom" ? "#10b981" : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedSource("custom")}
                  >
                    <Text style={styles.sourceIcon}>✏️</Text>
                    <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>
                      กรอกเอง
                    </Text>
                    {selectedSource === "custom" && (
                      <TextInput
                        style={[styles.customInput, { color: colors.text, borderColor: colors.border }]}
                        value={customCount}
                        onChangeText={setCustomCount}
                        keyboardType="numeric"
                        placeholder="จำนวน"
                        placeholderTextColor={colors.textSecondary}
                      />
                    )}
                    {selectedSource === "custom" && (
                      <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Reason */}
                <TextInput
                  style={[
                    styles.reasonInput,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="หมายเหตุ (ไม่บังคับ)"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                />

                {/* Final Count Preview */}
                <View style={styles.finalPreview}>
                  <Text style={[styles.finalLabel, { color: colors.textSecondary }]}>
                    ยอดที่จะยืนยัน:
                  </Text>
                  <Text style={[styles.finalCount, { color: "#10b981" }]}>
                    {getSelectedCount()} ชิ้น
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn, { borderColor: colors.border }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                      ยกเลิก
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      styles.confirmBtn,
                      { backgroundColor: submitting ? "#9ca3af" : "#10b981" },
                    ]}
                    onPress={handleSubmitOverride}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmBtnText}>ยืนยัน</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 16 },
  list: { padding: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: { flex: 1 },
  productName: { fontSize: 15, fontWeight: "600" },
  branchName: { fontSize: 12, marginTop: 2 },
  countRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  countBadgeLabel: { fontSize: 11 },
  countBadgeValue: { fontSize: 14, fontWeight: "700" },
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
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalProduct: { fontSize: 16, fontWeight: "600" },
  modalBranch: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  remarkBox: {
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#f59e0b",
  },
  remarkLabel: { fontSize: 12, color: "#92400e", fontWeight: "600" },
  remarkText: { fontSize: 14, color: "#78350f", marginTop: 4 },
  sourceOptions: { gap: 8, marginBottom: 12 },
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
  },
  sourceOptionSelected: { backgroundColor: "#f0fdf4" },
  sourceIcon: { fontSize: 20 },
  sourceLabel: { flex: 1, fontSize: 14 },
  sourceCount: { fontSize: 20, fontWeight: "800" },
  customInput: {
    width: 70,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 50,
    marginBottom: 12,
  },
  finalPreview: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  finalLabel: { fontSize: 14 },
  finalCount: { fontSize: 28, fontWeight: "800" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  cancelBtn: { borderWidth: 1 },
  cancelBtnText: { fontSize: 16, fontWeight: "600" },
  confirmBtn: {},
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
