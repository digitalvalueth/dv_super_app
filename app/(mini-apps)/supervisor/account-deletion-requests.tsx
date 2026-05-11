import { db } from "@/config/firebase";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processed"
  | "failed";

interface DeletionRequest {
  id: string;
  uid: string;
  email: string;
  requestedAt: Timestamp | null;
  processedAt?: Timestamp | null;
  status: RequestStatus;
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว (กำลังลบ)",
  rejected: "ปฏิเสธ",
  processed: "ลบเสร็จแล้ว",
  failed: "ล้มเหลว",
};

const STATUS_COLOR: Record<RequestStatus, string> = {
  pending: "#D97706",
  approved: "#2563EB",
  rejected: "#6B7280",
  processed: "#16A34A",
  failed: "#DC2626",
};

const STATUS_BG: Record<RequestStatus, { light: string; dark: string }> = {
  pending: { light: "#FFFBEB", dark: "#451A03" },
  approved: { light: "#EFF6FF", dark: "#1E3A5F" },
  rejected: { light: "#F9FAFB", dark: "#1F2937" },
  processed: { light: "#F0FDF4", dark: "#052E16" },
  failed: { light: "#FFF1F2", dark: "#2A0A0A" },
};

function fmtDate(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  const d = ts.toDate();
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function AccountDeletionRequestsScreen() {
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null); // requestId being actioned

  useEffect(() => {
    const q = query(
      collection(db, "account_deletion_requests"),
      orderBy("requestedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({
            id: d.id,
            uid: d.data().uid ?? "",
            email: d.data().email ?? "",
            requestedAt: d.data().requestedAt ?? null,
            processedAt: d.data().processedAt ?? null,
            status: (d.data().status as RequestStatus) ?? "pending",
          })),
        );
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      },
    );
    return unsub;
  }, []);

  const handleApprove = (item: DeletionRequest) => {
    Alert.alert(
      "อนุมัติการลบบัญชี",
      `คุณแน่ใจว่าต้องการลบบัญชีของ\n${item.email}\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "อนุมัติ & ลบ",
          style: "destructive",
          onPress: async () => {
            setActing(item.id);
            try {
              await updateDoc(doc(db, "account_deletion_requests", item.id), {
                status: "approved",
              });
              // Cloud Function picks up the "approved" status and deletes the account
            } catch {
              Alert.alert("ข้อผิดพลาด", "ไม่สามารถอนุมัติคำขอได้ กรุณาลองใหม่");
            } finally {
              setActing(null);
            }
          },
        },
      ],
    );
  };

  const handleReject = (item: DeletionRequest) => {
    Alert.alert("ปฏิเสธคำขอ", `ปฏิเสธคำขอลบบัญชีของ\n${item.email}`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ปฏิเสธ",
        style: "destructive",
        onPress: async () => {
          setActing(item.id);
          try {
            await updateDoc(doc(db, "account_deletion_requests", item.id), {
              status: "rejected",
            });
          } catch {
            Alert.alert("ข้อผิดพลาด", "ไม่สามารถปฏิเสธคำขอได้ กรุณาลองใหม่");
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: DeletionRequest }) => {
    const isActing = acting === item.id;
    const bg = isDark
      ? STATUS_BG[item.status].dark
      : STATUS_BG[item.status].light;

    return (
      <View
        style={{
          backgroundColor: bg,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: isDark ? "#2A2A2A" : "#E5E7EB",
        }}
      >
        {/* Email + status badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.text,
              flex: 1,
              marginRight: 8,
            }}
            numberOfLines={1}
          >
            {item.email || "(ไม่มีอีเมล)"}
          </Text>
          <View
            style={{
              backgroundColor: STATUS_COLOR[item.status] + "22",
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: STATUS_COLOR[item.status],
              }}
            >
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        {/* UID */}
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}
        >
          UID: {item.uid}
        </Text>

        {/* Dates */}
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginBottom: item.status === "pending" ? 12 : 0,
          }}
        >
          ส่งคำขอ: {fmtDate(item.requestedAt)}
          {item.processedAt
            ? `  •  ดำเนินการ: ${fmtDate(item.processedAt)}`
            : ""}
        </Text>

        {/* Action buttons — only for pending */}
        {item.status === "pending" && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              disabled={isActing}
              onPress={() => handleReject(item)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 9,
                borderRadius: 8,
                borderWidth: 1.5,
                borderColor: "#6B7280",
                backgroundColor: isDark ? "#374151" : "#F3F4F6",
                opacity: isActing ? 0.5 : 1,
              }}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#6B7280" />
              ) : (
                <>
                  <Ionicons
                    name="close-circle-outline"
                    size={16}
                    color="#6B7280"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: "#6B7280",
                    }}
                  >
                    ปฏิเสธ
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              disabled={isActing}
              onPress={() => handleApprove(item)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 9,
                borderRadius: 8,
                backgroundColor: "#DC2626",
                opacity: isActing ? 0.5 : 1,
              }}
            >
              {isActing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                  <Text
                    style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}
                  >
                    อนุมัติ & ลบ
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Retry button for failed */}
        {item.status === "failed" && (
          <TouchableOpacity
            disabled={isActing}
            onPress={() => handleApprove(item)}
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 9,
              borderRadius: 8,
              backgroundColor: "#DC2626",
              opacity: isActing ? 0.5 : 1,
            }}
          >
            {isActing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}
                >
                  ลองใหม่
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const pending = requests.filter((r) => r.status === "pending");
  const others = requests.filter((r) => r.status !== "pending");

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top"]}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? "#2A2A2A" : "#E5E5E5",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "#FEE2E2",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Ionicons name="person-remove-outline" size={20} color="#DC2626" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
            คำขอลบบัญชี
          </Text>
          {pending.length > 0 && (
            <Text style={{ fontSize: 12, color: "#D97706" }}>
              {pending.length} รายการรอพิจารณา
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={52}
            color={isDark ? "#374151" : "#D1FAE5"}
          />
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: colors.textSecondary,
              marginTop: 12,
            }}
          >
            ไม่มีคำขอในขณะนี้
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...pending, ...others]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            pending.length > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: isDark ? "#451A03" : "#FFFBEB",
                  borderRadius: 10,
                  padding: 12,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: isDark ? "#92400E" : "#FCD34D",
                }}
              >
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text
                  style={{
                    fontSize: 13,
                    color: "#D97706",
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  มี {pending.length} คำขอรอการพิจารณา
                  การอนุมัติจะลบข้อมูลทั้งหมดอย่างถาวร
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
