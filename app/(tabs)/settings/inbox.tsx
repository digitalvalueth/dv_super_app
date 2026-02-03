import { db } from "@/config/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Notification, NotificationType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InboxScreen() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Setup realtime listener for notifications
  useEffect(() => {
    if (!user) return;

    console.log("🔔 Setting up realtime notifications listener...");

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];

        console.log(`✅ Notifications updated: ${data.length} items`);
        setNotifications(data);
        setLoading(false);
      },
      (error) => {
        console.error("❌ Error in notifications listener:", error);
        setLoading(false);
      },
    );

    // Cleanup listener on unmount
    return () => {
      console.log("🚧 Cleaning up notifications listener");
      unsubscribe();
    };
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Notifications are realtime, just stop loading indicator
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date(),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Handle action based on type
    if (notification.data?.actionRequired) {
      handleAction(notification);
    }
  };

  const handleAction = (notification: Notification) => {
    // Check if already actioned
    if (notification.data?.status === "accepted") {
      Alert.alert("ดำเนินการแล้ว", "คุณได้ยอมรับคำเชิญนี้แล้ว");
      return;
    }
    if (notification.data?.status === "rejected") {
      Alert.alert("ดำเนินการแล้ว", "คุณได้ปฏิเสธคำเชิญนี้แล้ว");
      return;
    }

    switch (notification.type) {
      case "company_invite":
        Alert.alert(
          "คำเชิญเข้าสาขา",
          `คุณได้รับคำเชิญเข้าร่วมสาขา ${
            notification.data?.branchName || "ไม่ระบุ"
          }`,
          [
            {
              text: "ปฏิเสธ",
              style: "destructive",
              onPress: () => rejectInvite(notification),
            },
            { text: "ยอมรับ", onPress: () => acceptInvite(notification) },
          ],
        );
        break;
      case "branch_transfer":
        Alert.alert(
          "แจ้งย้ายสาขา",
          `คุณถูกย้ายจาก ${notification.data?.fromBranchName} ไป ${notification.data?.toBranchName}`,
          [{ text: "รับทราบ" }],
        );
        break;
      default:
        break;
    }
  };

  const acceptInvite = async (notification: Notification) => {
    try {
      if (
        !user ||
        !notification.data?.companyId ||
        !notification.data?.branchId
      )
        return;

      // Update user with company/branch
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        companyId: notification.data.companyId,
        branchId: notification.data.branchId,
        branchName: notification.data.branchName || "",
        companyName: notification.data.companyName || "",
        role: notification.data.role || "employee",
        updatedAt: new Date(),
      });

      // Update notification status
      const notificationRef = doc(db, "notifications", notification.id);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date(),
        "data.status": "accepted",
        "data.actionRequired": false,
      });

      // Update local state
      setNotifications((prev) =>
        prev?.map((n) =>
          n.id === notification.id
            ? {
                ...n,
                read: true,
                data: { ...n.data, status: "accepted", actionRequired: false },
              }
            : n,
        ),
      );

      // Update auth store with new user data
      setUser({
        ...user,
        companyId: notification.data.companyId,
        branchId: notification.data.branchId,
        branchName: notification.data.branchName || "",
        companyName: notification.data.companyName || "",
        role:
          (notification.data.role as
            | "employee"
            | "admin"
            | "supervisor"
            | "super_admin") || "employee",
      });

      // Update access_requests status to approved
      try {
        const accessRequestRef = doc(db, "access_requests", user.uid);
        await updateDoc(accessRequestRef, {
          status: "approved",
          approvedAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (accessError) {
        // access_request may not exist, ignore error
        console.log("No access_request to update:", accessError);
      }

      // Update invitation status to accepted (for admin tracking)
      if (notification.data?.invitationId) {
        try {
          const invitationRef = doc(
            db,
            "invitations",
            notification.data.invitationId,
          );
          await updateDoc(invitationRef, {
            status: "accepted",
            acceptedAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (inviteError) {
          console.log("No invitation to update:", inviteError);
        }
      }

      Alert.alert(
        "สำเร็จ",
        `คุณได้เข้าร่วมสาขา ${notification.data.branchName || ""} แล้ว`,
        [{ text: "ตกลง" }],
      );
    } catch (error) {
      console.error("Error accepting invite:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถยอมรับคำเชิญได้");
    }
  };

  const rejectInvite = async (notification: Notification) => {
    try {
      // Update notification status
      const notificationRef = doc(db, "notifications", notification.id);
      await updateDoc(notificationRef, {
        read: true,
        readAt: new Date(),
        "data.status": "rejected",
        "data.actionRequired": false,
      });

      // Update invitation status to rejected (for admin tracking)
      if (notification.data?.invitationId) {
        try {
          const invitationRef = doc(
            db,
            "invitations",
            notification.data.invitationId,
          );
          await updateDoc(invitationRef, {
            status: "rejected",
            rejectedAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (inviteError) {
          console.log("No invitation to update:", inviteError);
        }
      }

      // Update local state
      setNotifications((prev) =>
        prev?.map((n) =>
          n.id === notification.id
            ? {
                ...n,
                read: true,
                data: { ...n.data, status: "rejected", actionRequired: false },
              }
            : n,
        ),
      );

      Alert.alert("ปฏิเสธแล้ว", "คุณได้ปฏิเสธคำเชิญแล้ว");
    } catch (error) {
      console.error("Error rejecting invite:", error);
    }
  };

  const getNotificationIcon = (
    type: NotificationType,
  ): keyof typeof Ionicons.glyphMap => {
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
      case "system":
      default:
        return "notifications";
    }
  };

  const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
      case "company_invite":
        return "#4285f4";
      case "branch_transfer":
        return "#ff9800";
      case "role_change":
        return "#9c27b0";
      case "access_approved":
        return "#4caf50";
      case "access_rejected":
        return "#f44336";
      case "system":
      default:
        return "#607d8b";
    }
  };

  const formatDate = (timestamp: { seconds: number; nanoseconds: number }) => {
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return "เมื่อสักครู่";
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    if (days < 7) return `${days} วันที่แล้ว`;

    return date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconColor = getNotificationColor(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          {
            backgroundColor: item.read ? colors.card : colors.primary + "10",
            borderColor: item.read ? colors.border : colors.primary + "30",
          },
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: iconColor + "20" },
            ]}
          >
            <Ionicons
              name={getNotificationIcon(item.type)}
              size={24}
              color={iconColor}
            />
          </View>
          <View style={styles.notificationContent}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.notificationTitle,
                  { color: colors.text },
                  !item.read && { fontWeight: "700" },
                ]}
              >
                {item.title}
              </Text>
              {!item.read && (
                <View
                  style={[
                    styles.unreadDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.notificationMessage,
                { color: colors.textSecondary },
              ]}
              numberOfLines={2}
            >
              {item.message}
            </Text>
            <Text
              style={[styles.notificationTime, { color: colors.textSecondary }]}
            >
              {formatDate(item.createdAt as any)}
            </Text>

            {/* Status badge for actioned notifications */}
            {item.data?.status && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.data.status === "accepted"
                        ? "#4caf50" + "20"
                        : "#f44336" + "20",
                  },
                ]}
              >
                <Ionicons
                  name={
                    item.data.status === "accepted"
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={14}
                  color={
                    item.data.status === "accepted" ? "#4caf50" : "#f44336"
                  }
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        item.data.status === "accepted" ? "#4caf50" : "#f44336",
                    },
                  ]}
                >
                  {item.data.status === "accepted"
                    ? "ยอมรับแล้ว"
                    : "ปฏิเสธแล้ว"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Show action buttons only if not yet actioned */}
        {item.data?.actionRequired && !item.data?.status && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.rejectButton,
                { borderColor: colors.border },
              ]}
              onPress={() => rejectInvite(item)}
            >
              <Text style={styles.rejectButtonText}>ปฏิเสธ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.acceptButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => acceptInvite(item)}
            >
              <Text style={styles.acceptButtonText}>ยอมรับ</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
          กล่องข้อความ
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              กำลังโหลด...
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="mail-open-outline"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              ไม่มีข้อความ
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    width: 40,
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
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  notificationHeader: {
    flexDirection: "row",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  rejectButton: {
    borderWidth: 1,
  },
  rejectButtonText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  acceptButton: {},
  acceptButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
