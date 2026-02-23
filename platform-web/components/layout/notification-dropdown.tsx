"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { AppNotification, NotificationType } from "@/types/notification";
import { Timestamp } from "firebase/firestore";
import {
  Bell,
  Building2,
  CheckCheck,
  Info,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case "branch_assigned":
      return <Building2 className="w-4 h-4 text-blue-600" />;
    case "branch_removed":
      return <Building2 className="w-4 h-4 text-orange-500" />;
    case "role_changed":
      return <ShieldCheck className="w-4 h-4 text-purple-600" />;
    case "invitation_accepted":
      return <UserCheck className="w-4 h-4 text-green-600" />;
    default:
      return <Info className="w-4 h-4 text-gray-500" />;
  }
}

function getTypeBg(type: NotificationType) {
  switch (type) {
    case "branch_assigned":
      return "bg-blue-100 dark:bg-blue-900/30";
    case "branch_removed":
      return "bg-orange-100 dark:bg-orange-900/30";
    case "role_changed":
      return "bg-purple-100 dark:bg-purple-900/30";
    case "invitation_accepted":
      return "bg-green-100 dark:bg-green-900/30";
    default:
      return "bg-gray-100 dark:bg-gray-700";
  }
}

function formatTime(createdAt: Timestamp | undefined): string {
  if (!createdAt) return "";
  const date = createdAt.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "เมื่อกี้";
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
        !notification.read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
      }`}
      onClick={() => !notification.read && onRead(notification.id)}
    >
      {/* Icon */}
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${getTypeBg(notification.type)}`}
      >
        {getTypeIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white leading-snug">
          {notification.title}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
          {notification.body}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
          {formatTime(notification.createdAt)}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />
      )}
    </div>
  );
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative hidden sm:block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative transition-colors"
        title="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                การแจ้งเตือน
              </span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="อ่านทั้งหมด"
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                <Bell className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={markAsRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
