import { db } from "@/config/firebase";
import { Notification, NotificationData, NotificationType } from "@/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

/**
 * Create a new notification for a user
 */
export const createNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: NotificationData,
): Promise<string> => {
  try {
    const notificationsRef = collection(db, "notifications");
    const notification = {
      userId,
      type,
      title,
      message,
      data: data || {},
      read: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(notificationsRef, notification);
    console.log("📬 Notification created:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Get all notifications for a user
 */
export const getUserNotifications = async (
  userId: string,
): Promise<Notification[]> => {
  try {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
  } catch (error) {
    console.error("Error getting notifications:", error);
    throw error;
  }
};

/**
 * Get unread notifications count for a user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false),
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (
  notificationId: string,
): Promise<void> => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: Timestamp.now(),
    });
    console.log("✅ Notification marked as read:", notificationId);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false),
    );

    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map((doc) =>
      updateDoc(doc.ref, {
        read: true,
        readAt: Timestamp.now(),
      }),
    );

    await Promise.all(updates);
    console.log("✅ All notifications marked as read");
  } catch (error) {
    console.error("Error marking all as read:", error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (
  notificationId: string,
): Promise<void> => {
  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await deleteDoc(notificationRef);
    console.log("🗑️ Notification deleted:", notificationId);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

// ========================================
// Notification Creation Helpers
// ========================================

/**
 * Send company invite notification to a user
 */
export const sendCompanyInvite = async (
  userId: string,
  companyId: string,
  companyName: string,
  branchId: string,
  branchName: string,
): Promise<string> => {
  return createNotification(
    userId,
    "company_invite",
    "คำเชิญเข้าร่วมบริษัท",
    `คุณได้รับคำเชิญให้เข้าร่วม ${companyName} สาขา ${branchName}`,
    {
      companyId,
      companyName,
      branchId,
      branchName,
      actionRequired: true,
      actionType: "accept_reject",
    },
  );
};

/**
 * Send branch transfer notification to a user
 */
export const sendBranchTransfer = async (
  userId: string,
  fromBranchId: string,
  fromBranchName: string,
  toBranchId: string,
  toBranchName: string,
): Promise<string> => {
  return createNotification(
    userId,
    "branch_transfer",
    "แจ้งย้ายสาขา",
    `คุณถูกย้ายจากสาขา ${fromBranchName} ไปยังสาขา ${toBranchName}`,
    {
      fromBranchId,
      fromBranchName,
      toBranchId,
      toBranchName,
      actionRequired: false,
    },
  );
};

/**
 * Send access approved notification
 */
export const sendAccessApproved = async (
  userId: string,
  companyName: string,
  branchName: string,
): Promise<string> => {
  return createNotification(
    userId,
    "access_approved",
    "คำขอได้รับการอนุมัติ",
    `คำขอเข้าใช้งานของคุณได้รับการอนุมัติแล้ว คุณสามารถเข้าถึง ${companyName} - ${branchName} ได้แล้ว`,
    {
      companyName,
      branchName,
      actionRequired: false,
    },
  );
};

/**
 * Send access rejected notification
 */
export const sendAccessRejected = async (
  userId: string,
  reason?: string,
): Promise<string> => {
  return createNotification(
    userId,
    "access_rejected",
    "คำขอถูกปฏิเสธ",
    reason || "คำขอเข้าใช้งานของคุณถูกปฏิเสธ กรุณาติดต่อผู้ดูแลระบบ",
    {
      actionRequired: false,
    },
  );
};

/**
 * Send role change notification
 */
export const sendRoleChange = async (
  userId: string,
  newRole: string,
): Promise<string> => {
  const roleNames: Record<string, string> = {
    employee: "Staff",
    admin: "Admin",
    super_admin: "Super Admin",
    supervisor: "Branch Admin",
    manager: "Manager",
  };

  return createNotification(
    userId,
    "role_change",
    "เปลี่ยนตำแหน่ง",
    `ตำแหน่งของคุณถูกเปลี่ยนเป็น ${roleNames[newRole] || newRole}`,
    {
      newRole,
      actionRequired: false,
    },
  );
};

/**
 * Send system notification
 */
export const sendSystemNotification = async (
  userId: string,
  title: string,
  message: string,
): Promise<string> => {
  return createNotification(userId, "system", title, message, {
    actionRequired: false,
  });
};
