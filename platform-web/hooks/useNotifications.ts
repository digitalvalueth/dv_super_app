"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { AppNotification } from "@/types/notification";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";

const NOTIFICATIONS_COLLECTION = "notifications";
const MAX_NOTIFICATIONS = 30;

export function useNotifications() {
  const { userData } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userData?.id) {
      return;
    }

    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userId", "==", userData.id),
      orderBy("createdAt", "desc"),
      limit(MAX_NOTIFICATIONS),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: AppNotification[] = snapshot.docs.map((d) => ({
          ...(d.data() as Omit<AppNotification, "id">),
          id: d.id,
        }));
        setNotifications(notifs);
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to notifications:", error);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userData?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /** Mark a single notification as read */
  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
        read: true,
      });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  /** Mark all unread notifications as read */
  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, NOTIFICATIONS_COLLECTION, n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
}
