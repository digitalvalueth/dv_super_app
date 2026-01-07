import { db } from "@/config/firebase";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AccessRequest = {
  id: string;
  userId: string;
  userEmail: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: {
    seconds: number;
    nanoseconds: number;
  };
  updatedAt: {
    seconds: number;
    nanoseconds: number;
  };
};

export default function AccessRequestsScreen() {
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccessRequests();
  }, []);

  const loadAccessRequests = async () => {
    try {
      setLoading(true);
      const requestsRef = collection(db, "access_requests");
      const q = query(
        requestsRef,
        where("status", "==", "pending"),
        orderBy("requestedAt", "desc")
      );
      const snapshot = await getDocs(q);

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AccessRequest[];

      setRequests(data);
    } catch (error) {
      console.error("Error loading access requests:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถโหลดคำขอเข้าถึงได้");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request: AccessRequest) => {
    Alert.alert(
      "อนุมัติคำขอ",
      `คุณต้องการอนุมัติให้ ${request.userEmail} เข้าใช้งานหรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "อนุมัติ",
          style: "default",
          onPress: () => showCompanyBranchSelector(request),
        },
      ]
    );
  };

  const showCompanyBranchSelector = (request: AccessRequest) => {
    // For now, just approve with default company/branch
    // TODO: Add company/branch selector UI
    Alert.prompt(
      "กำหนดบริษัท",
      "กรุณาใส่ Company ID และ Branch ID (คั่นด้วยเครื่องหมายจุลภาค)",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async (input?: string) => {
            if (!input) return;

            const [companyId, branchId] = input
              .split(",")
              .map((s: string) => s.trim());

            if (!companyId || !branchId) {
              Alert.alert(
                "ข้อมูลไม่ครบ",
                "กรุณาใส่ Company ID และ Branch ID ให้ครบถ้วน"
              );
              return;
            }

            await approveRequest(request, companyId, branchId);
          },
        },
      ],
      "plain-text",
      "company-001, branch-001"
    );
  };

  const approveRequest = async (
    request: AccessRequest,
    companyId: string,
    branchId: string
  ) => {
    try {
      // Update user with company/branch/role
      const userRef = doc(db, "users", request.userId);
      await updateDoc(userRef, {
        companyId,
        branchId,
        role: "employee",
        updatedAt: new Date(),
      });

      // Update access request status
      const requestRef = doc(db, "access_requests", request.id);
      await updateDoc(requestRef, {
        status: "approved",
        updatedAt: new Date(),
      });

      Alert.alert("สำเร็จ", "อนุมัติคำขอเรียบร้อยแล้ว");
      loadAccessRequests(); // Reload list
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถอนุมัติคำขอได้");
    }
  };

  const handleReject = async (request: AccessRequest) => {
    Alert.alert(
      "ปฏิเสธคำขอ",
      `คุณต้องการปฏิเสธคำขอจาก ${request.userEmail} หรือไม่?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ปฏิเสธ",
          style: "destructive",
          onPress: async () => {
            try {
              const requestRef = doc(db, "access_requests", request.id);
              await updateDoc(requestRef, {
                status: "rejected",
                updatedAt: new Date(),
              });

              Alert.alert("สำเร็จ", "ปฏิเสธคำขอเรียบร้อยแล้ว");
              loadAccessRequests();
            } catch (error) {
              console.error("Error rejecting request:", error);
              Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถปฏิเสธคำขอได้");
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderRequest = ({ item }: { item: AccessRequest }) => (
    <View
      style={[
        styles.requestCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.requestHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primary + "20" },
          ]}
        >
          <Ionicons name="person-add" size={24} color={colors.primary} />
        </View>
        <View style={styles.requestInfo}>
          <Text style={[styles.userEmail, { color: colors.text }]}>
            {item.userEmail}
          </Text>
          <Text style={[styles.requestDate, { color: colors.textSecondary }]}>
            {formatDate(item.requestedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: colors.border }]}
          onPress={() => handleReject(item)}
        >
          <Ionicons name="close-circle" size={20} color="#ef4444" />
          <Text style={[styles.rejectText]}>ปฏิเสธ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.approveButton,
            { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => handleApprove(item)}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          <Text style={[styles.approveText, { color: colors.primary }]}>
            อนุมัติ
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          คำขอเข้าใช้งาน
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadAccessRequests}
        >
          <Ionicons name="refresh" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              กำลังโหลดข้อมูล...
            </Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-done-circle"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              ไม่มีคำขอที่รอการอนุมัติ
            </Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
  },
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 16,
  },
  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  requestInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  rejectText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
  },
  approveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  approveText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
