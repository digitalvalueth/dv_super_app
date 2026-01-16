"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession, DashboardStats } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const { userData } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;

    const fetchDashboardData = async () => {
      try {
        const companyId = userData.companyId;

        // ถ้าเป็น superadmin (ไม่มี companyId) ดึงทั้งหมด
        let usersQuery, branchesQuery, productsQuery, sessionsQuery;

        if (companyId) {
          usersQuery = query(
            collection(db, "users"),
            where("companyId", "==", companyId)
          );
          branchesQuery = query(
            collection(db, "branches"),
            where("companyId", "==", companyId)
          );
          productsQuery = query(
            collection(db, "products"),
            where("companyId", "==", companyId)
          );
          sessionsQuery = query(
            collection(db, "countingSessions"),
            where("companyId", "==", companyId)
          );
        } else {
          // Superadmin - ดึงทั้งหมด
          usersQuery = query(collection(db, "users"));
          branchesQuery = query(collection(db, "branches"));
          productsQuery = query(collection(db, "products"));
          sessionsQuery = query(collection(db, "countingSessions"));
        }

        // Fetch users count
        const usersSnapshot = await getDocs(usersQuery);
        const totalUsers = usersSnapshot.size;

        // Fetch branches count
        const branchesSnapshot = await getDocs(branchesQuery);
        const totalBranches = branchesSnapshot.size;

        // Fetch products count
        const productsSnapshot = await getDocs(productsQuery);
        const totalProducts = productsSnapshot.size;

        // Fetch counting sessions
        const sessionsSnapshot = await getDocs(sessionsQuery);

        let totalDiscrepancy = 0;
        let pendingSessions = 0;
        const sessions: CountingSession[] = [];

        sessionsSnapshot.forEach((doc) => {
          const data = doc.data();
          const session: CountingSession = {
            id: doc.id,
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
            companyId: data.companyId,
            branchId: data.branchId,
            branchName: data.branchName,
            productId: data.productId,
            productName: data.productName,
            productSKU: data.productSKU,
            // Support both imageUrl and imageURL for backward compatibility
            imageUrl: data.imageUrl || data.imageURL,
            aiCount: data.aiCount,
            manualCount: data.manualCount,
            finalCount: data.finalCount,
            standardCount: data.standardCount,
            discrepancy: Math.abs(data.discrepancy || 0),
            status: data.status,
            remarks: data.remarks,
            adminRemarks: data.adminRemarks,
            createdAt: data.createdAt?.toDate(),
            reviewedAt: data.reviewedAt?.toDate(),
            reviewedBy: data.reviewedBy,
          };

          sessions.push(session);
          totalDiscrepancy += session.discrepancy ?? 0;

          if (session.status === "pending-review") {
            pendingSessions++;
          }
        });

        // Sort sessions by date (most recent first)
        sessions.sort(
          (a, b) =>
            (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
        );
        const recentSessions = sessions.slice(0, 5);

        setStats({
          totalUsers,
          totalBranches,
          totalProducts,
          totalSessions: sessions.length,
          pendingSessions,
          totalDiscrepancy,
          recentSessions,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [userData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          แดชบอร์ด
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          ภาพรวมระบบนับสินค้า Super Fitt
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        <StatCard
          title="ผู้ใช้งานทั้งหมด"
          value={stats?.totalUsers || 0}
          icon={<Users className="w-5 h-5 lg:w-6 lg:h-6" />}
          color="bg-blue-500"
        />
        <StatCard
          title="สาขาทั้งหมด"
          value={stats?.totalBranches || 0}
          icon={<Building2 className="w-5 h-5 lg:w-6 lg:h-6" />}
          color="bg-green-500"
        />
        <StatCard
          title="สินค้าทั้งหมด"
          value={stats?.totalProducts || 0}
          icon={<Package className="w-5 h-5 lg:w-6 lg:h-6" />}
          color="bg-purple-500"
        />
        <StatCard
          title="การนับทั้งหมด"
          value={stats?.totalSessions || 0}
          icon={<BarChart3 className="w-5 h-5 lg:w-6 lg:h-6" />}
          color="bg-orange-500"
        />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 lg:p-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 bg-red-500 rounded-lg text-white shrink-0">
              <AlertTriangle className="w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <div>
              <h3 className="text-base lg:text-lg font-semibold text-red-900 dark:text-red-100">
                ของหายรวม
              </h3>
              <p className="text-2xl lg:text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats?.totalDiscrepancy || 0} ชิ้น
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 lg:p-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="p-2 lg:p-3 bg-yellow-500 rounded-lg text-white shrink-0">
              <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <div>
              <h3 className="text-base lg:text-lg font-semibold text-yellow-900 dark:text-yellow-100">
                รอตรวจสอบ
              </h3>
              <p className="text-2xl lg:text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {stats?.pendingSessions || 0} รายการ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
            การนับล่าสุด
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  วันที่
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ผู้นับ
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สินค้า
                </th>
                <th className="hidden sm:table-cell px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  จำนวนนับ
                </th>
                <th className="px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ส่วนต่าง
                </th>
                <th className="hidden md:table-cell px-3 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {stats?.recentSessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-xs lg:text-sm text-gray-900 dark:text-gray-100">
                    {session.createdAt
                      ? format(session.createdAt, "dd MMM yyyy HH:mm", {
                          locale: th,
                        })
                      : "-"}
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-xs lg:text-sm text-gray-900 dark:text-gray-100">
                    {session.userName}
                  </td>
                  <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {session.branchName}
                  </td>
                  <td className="px-3 lg:px-6 py-4 text-xs lg:text-sm text-gray-900 dark:text-gray-100">
                    <div className="max-w-37.5 lg:max-w-none truncate">
                      {session.productName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {session.productSKU}
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 lg:px-6 py-4 whitespace-nowrap text-xs lg:text-sm text-gray-900 dark:text-gray-100">
                    {session.finalCount}
                  </td>
                  <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-xs lg:text-sm">
                    <span
                      className={`font-semibold ${
                        (session.discrepancy ?? 0) > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {(session.discrepancy ?? 0) > 0
                        ? `-${session.discrepancy}`
                        : "0"}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-3 lg:px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={session.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 truncate">
            {title}
          </p>
          <p className="text-xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1 lg:mt-2">
            {value}
          </p>
        </div>
        <div
          className={`${color} p-2 lg:p-3 rounded-lg text-white shrink-0 ml-2`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    completed: { label: "เสร็จสิ้น", className: "bg-gray-100 text-gray-800" },
    "pending-review": {
      label: "รอตรวจสอบ",
      className: "bg-yellow-100 text-yellow-800",
    },
    approved: { label: "อนุมัติ", className: "bg-green-100 text-green-800" },
    rejected: { label: "ปฏิเสธ", className: "bg-red-100 text-red-800" },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
