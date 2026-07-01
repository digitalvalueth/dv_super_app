"use client";

import { db } from "@/lib/firebase";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthStore } from "@/stores/auth.store";
import { Bell, ChevronRight, Check, Trash2, Loader2 } from "lucide-react";
import { addDoc, collection, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Notifications() {
  const { userData } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [seeding, setSeeding] = useState(false);

  // Auto-seed mock notifications if Firestore has 0 entries on first visit
  useEffect(() => {
    if (isLoading || !userData?.id || notifications.length > 0) {
      return;
    }

    const localKey = `has_seeded_notifications_${userData.id}`;
    if (localStorage.getItem(localKey)) {
      return;
    }

    const seedData = async () => {
      setSeeding(true);
      try {
        const batchPromises = [
          addDoc(collection(db, "notifications"), {
            userId: userData.id,
            type: "system",
            title: "Subscription renewal pending",
            body: "PRIMANEST subscription expires in 14 days. Please review and renew.",
            read: false,
            createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, "notifications"), {
            userId: userData.id,
            type: "system",
            title: "Daily sales report ready",
            body: "Your sales report for 2026-04-29 is ready to view.",
            read: false,
            createdAt: serverTimestamp(),
          }),
          addDoc(collection(db, "notifications"), {
            userId: userData.id,
            type: "system",
            title: "Promotion submitted successfully",
            body: "“NEST ME Glow B1G1” has been activated.",
            read: true,
            createdAt: serverTimestamp(),
          }),
        ];
        await Promise.all(batchPromises);
        localStorage.setItem(localKey, "true");
        toast.success("จัดทำประกาศจำลองในระบบเรียบร้อยแล้ว");
      } catch (err) {
        console.error("Failed to seed mock notifications:", err);
      } finally {
        setSeeding(false);
      }
    };

    seedData();
  }, [isLoading, userData?.id, notifications.length]);

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      toast.success("ลบการแจ้งเตือนแล้ว");
    } catch (err) {
      console.error("Error deleting notification:", err);
      toast.error("ลบการแจ้งเตือนล้มเหลว");
    }
  };

  const getDotColor = (type: string, title: string) => {
    const t = type.toLowerCase();
    const titleLower = title.toLowerCase();
    if (t === "branch_removed" || titleLower.includes("expire") || titleLower.includes("pending")) {
      return "bg-amber-500";
    }
    if (t === "branch_assigned" || t === "invitation_accepted" || titleLower.includes("success") || titleLower.includes("active")) {
      return "bg-green-500";
    }
    return "bg-blue-500";
  };

  const formatTime = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "เมื่อครู่นี้";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            Notifications
          </h1>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 ml-12">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span>Vendor</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700">Notifications</span>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-pink-600 hover:underline font-semibold cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border divide-y">
        {isLoading || seeding ? (
          <div className="text-center py-12 flex flex-col items-center justify-center text-sm text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-pink-500 mb-2" />
            <span>กำลังโหลดรายการแจ้งเตือน...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12">
            No notifications.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                !n.read ? "bg-pink-50/20" : ""
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mt-2 shrink-0 ${getDotColor(
                  n.type,
                  n.title
                )} ${n.read ? "opacity-30" : ""}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-sm ${
                      !n.read ? "font-bold text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {n.title}
                  </h3>
                  {!n.read && (
                    <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.5 rounded shrink-0">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {formatTime(n.createdAt)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    title="Mark as read"
                    className="text-gray-400 hover:text-pink-600 p-1 cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(n.id)}
                  title="Delete"
                  className="text-gray-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
