"use client";

import { Bell, ChevronRight, Check, Trash2 } from "lucide-react";
import { useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success";
};

const initial: Notification[] = [
  {
    id: "1",
    title: "Subscription renewal pending",
    body: "PRIMANEST subscription expires in 14 days. Please review and renew.",
    time: "2h ago",
    read: false,
    type: "warning",
  },
  {
    id: "2",
    title: "Daily sales report ready",
    body: "Your sales report for 2026-04-29 is ready to view.",
    time: "5h ago",
    read: false,
    type: "info",
  },
  {
    id: "3",
    title: "Promotion submitted successfully",
    body: "“NEST ME Glow B1G1” has been activated.",
    time: "Yesterday",
    read: true,
    type: "success",
  },
];

const dot = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-green-500",
};

export default function Notifications() {
  const [items, setItems] = useState(initial);

  const markAll = () => setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  const markOne = (id: string) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
  const remove = (id: string) =>
    setItems((xs) => xs.filter((x) => x.id !== id));

  const unread = items.filter((x) => !x.read).length;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
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
        {unread > 0 && (
          <button
            onClick={markAll}
            className="text-xs text-pink-600 hover:underline font-semibold"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border divide-y">
        {items.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12">
            No notifications.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start gap-3 hover:bg-gray-50 ${
                !n.read ? "bg-pink-50/30" : ""
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mt-2 ${dot[n.type]} ${
                  n.read ? "opacity-30" : ""
                }`}
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
                    <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.5 rounded">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-gray-400 mt-1">{n.time}</p>
              </div>
              <div className="flex gap-1">
                {!n.read && (
                  <button
                    onClick={() => markOne(n.id)}
                    title="Mark as read"
                    className="text-gray-400 hover:text-pink-600 p-1"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => remove(n.id)}
                  title="Delete"
                  className="text-gray-400 hover:text-red-500 p-1"
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
