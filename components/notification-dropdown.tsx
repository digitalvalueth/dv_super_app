import { db } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Notification, NotificationType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import {
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function getNotificationIcon(
  type: NotificationType,
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "company_invite":
      return "business";
    case "branch_transfer":
      return "swap-horizontal";
    case "role_change":
      return "shield-checkmark";
    case "access_approved":
      return "checkmark-circle";
    case "access_rejected":
      return "close-circle";
    default:
      return "notifications";
  }
}

function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "company_invite":
      return "#3B82F6";
    case "branch_transfer":
      return "#F59E0B";
    case "role_change":
      return "#8B5CF6";
    case "access_approved":
      return "#10B981";
    case "access_rejected":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

function formatTimeAgo(ts: any): string {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "เมื่อวาน";
  return `${days} วันที่แล้ว`;
}

export function NotificationDropdown() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Realtime listener
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification),
      );
    });
    return () => unsub();
  }, [user?.uid]);

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), {
      read: true,
      readAt: new Date(),
    });
  };

  const acceptInvite = async (notification: Notification) => {
    if (!user || !notification.data?.companyId) return;
    setLoadingAction(notification.id);
    try {
      const role = notification.data.role || "employee";
      const newBranchId = notification.data.branchId || "";
      const newBranchName = notification.data.branchName || "";
      const sellerCategory =
        notification.data.sellerCategory || notification.data.seller || "";

      const userUpdate: Record<string, any> = {
        companyId: notification.data.companyId,
        companyName: notification.data.companyName || "",
        role,
        baCode: notification.data.baCode || null,
        fullName: notification.data.fullName || null,
        seller: sellerCategory || null,
        sellerCategory: sellerCategory || null,
        updatedAt: new Date(),
      };

      if (role === "employee" && newBranchId) {
        userUpdate.branchId = newBranchId;
        userUpdate.branchName = newBranchName;
        userUpdate.branchCode = notification.data.branchCode || null;
        userUpdate.supervisorId = notification.data.supervisorId || null;
        userUpdate.supervisorName = notification.data.supervisorName || null;
        userUpdate.supervisorEmail = notification.data.supervisorEmail || null;
        userUpdate.branchIds = arrayUnion(newBranchId);
        userUpdate[`branchNames.${newBranchId}`] = newBranchName;
      } else if (notification.data.managedBranchIds?.length) {
        userUpdate.managedBranchIds = notification.data.managedBranchIds;
      }

      await updateDoc(doc(db, "users", user.uid), userUpdate);

      await updateDoc(doc(db, "notifications", notification.id), {
        read: true,
        readAt: new Date(),
        "data.status": "accepted",
        "data.actionRequired": false,
      });

      if (notification.data?.invitationId) {
        try {
          await updateDoc(
            doc(db, "invitations", notification.data.invitationId),
            {
              status: "accepted",
              acceptedAt: new Date(),
              updatedAt: new Date(),
            },
          );
        } catch {}
      }

      const updatedBranchIds = Array.from(
        new Set([
          ...(user.branchIds || []),
          ...(newBranchId ? [newBranchId] : []),
        ]),
      );
      setUser({
        ...user,
        ...userUpdate,
        companyId: notification.data.companyId,
        companyName: notification.data.companyName || "",
        branchIds: updatedBranchIds,
        branchNames: {
          ...(user.branchNames || {}),
          ...(newBranchId ? { [newBranchId]: newBranchName } : {}),
        },
        role: role as any,
      });

      Alert.alert(
        "ยอมรับแล้ว 🎉",
        newBranchName
          ? `คุณเข้าร่วมสาขา ${newBranchName} แล้ว`
          : "คุณเข้าร่วมทีมเรียบร้อยแล้ว",
        [{ text: "ตกลง" }],
      );
    } catch {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถยอมรับคำเชิญได้");
    } finally {
      setLoadingAction(null);
    }
  };

  const rejectInvite = async (notification: Notification) => {
    setLoadingAction(notification.id);
    try {
      await updateDoc(doc(db, "notifications", notification.id), {
        read: true,
        readAt: new Date(),
        "data.status": "rejected",
        "data.actionRequired": false,
      });

      if (notification.data?.invitationId) {
        try {
          await updateDoc(
            doc(db, "invitations", notification.data.invitationId),
            {
              status: "rejected",
              rejectedAt: new Date(),
              updatedAt: new Date(),
            },
          );
        } catch {}
      }

      Alert.alert("ปฏิเสธแล้ว", "คุณได้ปฏิเสธคำเชิญแล้ว");
    } catch {
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถปฏิเสธคำเชิญได้");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleItemPress = async (notification: Notification) => {
    if (!notification.read) await markRead(notification.id);

    if (
      notification.type === "company_invite" &&
      notification.data?.actionRequired &&
      notification.data?.status !== "accepted" &&
      notification.data?.status !== "rejected"
    ) {
      // Show inline confirm — handled by buttons in the card
    }
  };

  return (
    <>
      {/* Bell Button */}
      <TouchableOpacity
        style={[styles.bellButton, { backgroundColor: colors.card }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="notifications-outline" size={22} color={colors.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.dropdown,
              {
                backgroundColor: isDark ? colors.card : "#FFFFFF",
                borderColor: isDark ? colors.border : "#E5E7EB",
              },
            ]}
            onPress={() => {}}
          >
            {/* Header */}
            <View
              style={[
                styles.dropdownHeader,
                {
                  borderBottomColor: isDark ? colors.border : "#F3F4F6",
                },
              ]}
            >
              <View style={styles.dropdownHeaderLeft}>
                <Ionicons
                  name="notifications"
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                  การแจ้งเตือน
                </Text>
                {unreadCount > 0 && (
                  <View
                    style={[
                      styles.headerBadge,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={40}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    ไม่มีการแจ้งเตือน
                  </Text>
                </View>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const iconColor = getNotificationColor(n.type);
                  const isPending =
                    n.type === "company_invite" &&
                    n.data?.actionRequired &&
                    n.data?.status !== "accepted" &&
                    n.data?.status !== "rejected";
                  const isLoading = loadingAction === n.id;

                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.notifItem,
                        {
                          backgroundColor: !n.read
                            ? isDark
                              ? "rgba(59,130,246,0.08)"
                              : "#EFF6FF"
                            : "transparent",
                          borderBottomColor: isDark ? colors.border : "#F3F4F6",
                        },
                      ]}
                      onPress={() => handleItemPress(n)}
                      activeOpacity={0.7}
                    >
                      {/* Icon */}
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: iconColor + "18" },
                        ]}
                      >
                        <Ionicons
                          name={getNotificationIcon(n.type)}
                          size={18}
                          color={iconColor}
                        />
                      </View>

                      {/* Content */}
                      <View style={styles.notifContent}>
                        <Text
                          style={[styles.notifTitle, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {n.title}
                        </Text>
                        <Text
                          style={[
                            styles.notifMessage,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={2}
                        >
                          {n.message}
                        </Text>
                        <Text
                          style={[
                            styles.notifTime,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {formatTimeAgo(n.createdAt)}
                        </Text>

                        {/* Action buttons for invitation */}
                        {isPending && (
                          <View style={styles.actionRow}>
                            <TouchableOpacity
                              style={[
                                styles.actionBtn,
                                styles.rejectBtn,
                                {
                                  borderColor: isDark
                                    ? colors.border
                                    : "#E5E7EB",
                                },
                              ]}
                              onPress={() => rejectInvite(n)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#6B7280"
                                />
                              ) : (
                                <Text
                                  style={[
                                    styles.actionBtnText,
                                    { color: colors.text },
                                  ]}
                                >
                                  ปฏิเสธ
                                </Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.actionBtn,
                                styles.acceptBtn,
                                { backgroundColor: colors.primary },
                              ]}
                              onPress={() => acceptInvite(n)}
                              disabled={isLoading}
                            >
                              {isLoading ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#FFFFFF"
                                />
                              ) : (
                                <Text style={styles.acceptBtnText}>ยอมรับ</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Already actioned label */}
                        {n.type === "company_invite" &&
                          (n.data?.status === "accepted" ||
                            n.data?.status === "rejected") && (
                            <View style={styles.actionedRow}>
                              <Ionicons
                                name={
                                  n.data.status === "accepted"
                                    ? "checkmark-circle"
                                    : "close-circle"
                                }
                                size={13}
                                color={
                                  n.data.status === "accepted"
                                    ? "#10B981"
                                    : "#EF4444"
                                }
                              />
                              <Text
                                style={[
                                  styles.actionedText,
                                  {
                                    color:
                                      n.data.status === "accepted"
                                        ? "#10B981"
                                        : "#EF4444",
                                  },
                                ]}
                              >
                                {n.data.status === "accepted"
                                  ? "ยอมรับแล้ว"
                                  : "ปฏิเสธแล้ว"}
                              </Text>
                            </View>
                          )}
                      </View>

                      {/* Unread dot */}
                      {!n.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 100,
    paddingRight: 16,
  },
  dropdown: {
    width: 320,
    maxHeight: 480,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    overflow: "hidden",
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  headerBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  headerBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  list: {
    maxHeight: 400,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  notifMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 11,
    marginTop: 3,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    borderWidth: 1,
  },
  acceptBtn: {},
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  actionedText: {
    fontSize: 11,
    fontWeight: "600",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    marginTop: 6,
    flexShrink: 0,
  },
});
