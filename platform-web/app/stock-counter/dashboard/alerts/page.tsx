"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { format, subDays } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  addDoc,
} from "firebase/firestore";
import {
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Eye,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AlertItem {
  uid: string;
  name: string;
  email: string;
  branchName: string;
  consecutiveMissingDays: number;
  lastCheckInDate: Date | null;
  alertStatus: "new" | "acknowledged" | "resolved";
  alertDocId?: string;
}

export default function AlertsPage() {
  const { userData } = useAuthStore();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!userData) return;
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const loadAlerts = async () => {
    if (!userData?.companyId) return;
    setLoading(true);
    try {
      // Get all BA employees
      const usersQuery = query(
        collection(db, "users"),
        where("companyId", "==", userData.companyId),
        where("role", "==", "employee"),
      );
      const usersSnap = await getDocs(usersQuery);

      // Get check-ins from last 10 days
      const tenDaysAgo = subDays(new Date(), 10);
      const checkInQuery = query(
        collection(db, "checkIns"),
        where("companyId", "==", userData.companyId),
        where("createdAt", ">=", Timestamp.fromDate(tenDaysAgo)),
      );
      const checkInsSnap = await getDocs(checkInQuery);

      // Group check-ins by user by date
      const userCheckInDays = new Map<string, Set<string>>();
      checkInsSnap.docs.forEach((d) => {
        const data = d.data();
        const ts = data.createdAt?.toDate?.() || data.timestamp?.toDate?.();
        if (data.userId && ts) {
          const dateStr = format(ts, "yyyy-MM-dd");
          if (!userCheckInDays.has(data.userId)) {
            userCheckInDays.set(data.userId, new Set());
          }
          userCheckInDays.get(data.userId)!.add(dateStr);
        }
      });

      // Get existing alerts
      const alertsQuery = query(
        collection(db, "missingCheckInAlerts"),
        where("companyId", "==", userData.companyId),
      );
      const alertsSnap = await getDocs(alertsQuery);
      const existingAlerts = new Map<
        string,
        { id: string; status: string }
      >();
      alertsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId && data.status !== "resolved") {
          existingAlerts.set(data.userId, { id: d.id, status: data.status });
        }
      });

      // Calculate consecutive missing days
      const alertItems: AlertItem[] = [];
      const today = new Date();

      usersSnap.docs.forEach((d) => {
        const data = d.data();
        const uid = d.id;
        const userDays = userCheckInDays.get(uid) || new Set();

        let consecutiveMissing = 0;
        let lastCheckInDate: Date | null = null;

        for (let i = 1; i <= 10; i++) {
          const checkDate = subDays(today, i);
          const day = checkDate.getDay();
          // Skip weekends
          if (day === 0 || day === 6) continue;

          const dateStr = format(checkDate, "yyyy-MM-dd");
          if (!userDays.has(dateStr)) {
            consecutiveMissing++;
          } else {
            if (!lastCheckInDate) lastCheckInDate = checkDate;
            break;
          }
        }

        if (consecutiveMissing >= 3) {
          const existing = existingAlerts.get(uid);
          alertItems.push({
            uid,
            name: data.name || data.email || "Unknown",
            email: data.email || "",
            branchName: data.branchName || "",
            consecutiveMissingDays: consecutiveMissing,
            lastCheckInDate,
            alertStatus: (existing?.status as any) || "new",
            alertDocId: existing?.id,
          });
        }
      });

      alertItems.sort(
        (a, b) => b.consecutiveMissingDays - a.consecutiveMissingDays,
      );
      setAlerts(alertItems);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (item: AlertItem) => {
    try {
      if (item.alertDocId) {
        await updateDoc(doc(db, "missingCheckInAlerts", item.alertDocId), {
          status: "acknowledged",
          acknowledgedBy: userData?.uid || userData?.id,
          acknowledgedByName: userData?.name || userData?.email,
          acknowledgedAt: Timestamp.now(),
        });
      } else {
        const ref = await addDoc(collection(db, "missingCheckInAlerts"), {
          userId: item.uid,
          userName: item.name,
          userEmail: item.email,
          branchName: item.branchName,
          companyId: userData?.companyId,
          consecutiveMissingDays: item.consecutiveMissingDays,
          status: "acknowledged",
          acknowledgedBy: userData?.uid || userData?.id,
          acknowledgedByName: userData?.name || userData?.email,
          acknowledgedAt: Timestamp.now(),
          createdAt: Timestamp.now(),
        });
        item.alertDocId = ref.id;
      }
      setAlerts((prev) =>
        prev.map((a) =>
          a.uid === item.uid ? { ...a, alertStatus: "acknowledged" } : a,
        ),
      );
      toast.success(`รับทราบการแจ้งเตือนสำหรับ ${item.name}`);
    } catch (error) {
      console.error("Error acknowledging:", error);
      toast.error("เกิดข้อผิดพลาด");
    }
  };

  const handleResolve = async (item: AlertItem) => {
    if (!item.alertDocId) return;
    try {
      await updateDoc(doc(db, "missingCheckInAlerts", item.alertDocId), {
        status: "resolved",
        resolvedBy: userData?.uid || userData?.id,
        resolvedByName: userData?.name || userData?.email,
        resolvedAt: Timestamp.now(),
      });
      setAlerts((prev) => prev.filter((a) => a.uid !== item.uid));
      toast.success(`ปิดการแจ้งเตือนสำหรับ ${item.name}`);
    } catch (error) {
      console.error("Error resolving:", error);
      toast.error("เกิดข้อผิดพลาด");
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterStatus !== "all" && a.alertStatus !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        a.name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        a.branchName.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const stats = {
    total: alerts.length,
    new: alerts.filter((a) => a.alertStatus === "new").length,
    acknowledged: alerts.filter((a) => a.alertStatus === "acknowledged").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังวิเคราะห์ข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          แจ้งเตือนพนักงานขาดเช็คอิน
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          แสดงพนักงานที่ไม่เช็คอิน 3 วันทำการติดต่อกันขึ้นไป
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                รวมทั้งหมด
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.new}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">ใหม่</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Eye className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.acknowledged}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                รับทราบแล้ว
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              สถานะ
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทั้งหมด</option>
              <option value="new">ใหม่</option>
              <option value="acknowledged">รับทราบแล้ว</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล, สาขา..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  พนักงาน
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  สาขา
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  วันที่ขาด
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  เช็คอินล่าสุด
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  สถานะ
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">
                  ดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <Shield className="w-12 h-12 mx-auto text-green-400 mb-4" />
                    <p className="text-lg font-medium">
                      ไม่มีการแจ้งเตือน
                    </p>
                    <p className="text-sm">ทุกคนเช็คอินสม่ำเสมอ</p>
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={alert.uid}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {alert.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {alert.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {alert.branchName || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Clock className="w-3.5 h-3.5" />
                        {alert.consecutiveMissingDays} วัน
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                      {alert.lastCheckInDate
                        ? format(alert.lastCheckInDate, "d MMM yyyy", {
                            locale: th,
                          })
                        : "ไม่มีข้อมูล"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          alert.alertStatus === "new"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {alert.alertStatus === "new" ? "ใหม่" : "รับทราบ"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {alert.alertStatus === "new" && (
                          <button
                            onClick={() => handleAcknowledge(alert)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium transition-colors"
                            title="รับทราบ"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            รับทราบ
                          </button>
                        )}
                        {alert.alertStatus === "acknowledged" && (
                          <button
                            onClick={() => handleResolve(alert)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium transition-colors"
                            title="ปิดแจ้งเตือน"
                          >
                            <Check className="w-3.5 h-3.5" />
                            ปิด
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          แสดง {filteredAlerts.length} จาก {alerts.length} รายการ
        </div>
      </div>
    </div>
  );
}
