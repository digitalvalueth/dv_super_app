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

        // Fetch users count
        const usersSnapshot = await getDocs(
          query(collection(db, "users"), where("companyId", "==", companyId))
        );
        const totalUsers = usersSnapshot.size;

        // Fetch branches count
        const branchesSnapshot = await getDocs(
          query(collection(db, "branches"), where("companyId", "==", companyId))
        );
        const totalBranches = branchesSnapshot.size;

        // Fetch products count
        const productsSnapshot = await getDocs(
          query(collection(db, "products"), where("companyId", "==", companyId))
        );
        const totalProducts = productsSnapshot.size;

        // Fetch counting sessions
        const sessionsSnapshot = await getDocs(
          query(
            collection(db, "countingSessions"),
            where("companyId", "==", companyId)
          )
        );

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
            imageURL: data.imageURL,
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
          totalDiscrepancy += session.discrepancy;

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">แดชบอร์ด</h1>
        <p className="text-gray-600 mt-1">ภาพรวมระบบนับสินค้า Super Fitt</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="ผู้ใช้งานทั้งหมด"
          value={stats?.totalUsers || 0}
          icon={<Users className="w-6 h-6" />}
          color="bg-blue-500"
        />
        <StatCard
          title="สาขาทั้งหมด"
          value={stats?.totalBranches || 0}
          icon={<Building2 className="w-6 h-6" />}
          color="bg-green-500"
        />
        <StatCard
          title="สินค้าทั้งหมด"
          value={stats?.totalProducts || 0}
          icon={<Package className="w-6 h-6" />}
          color="bg-purple-500"
        />
        <StatCard
          title="การนับทั้งหมด"
          value={stats?.totalSessions || 0}
          icon={<BarChart3 className="w-6 h-6" />}
          color="bg-orange-500"
        />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500 rounded-lg text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-900">ของหายรวม</h3>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {stats?.totalDiscrepancy || 0} ชิ้น
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500 rounded-lg text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">
                รอตรวจสอบ
              </h3>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats?.pendingSessions || 0} รายการ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">การนับล่าสุด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  วันที่
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ผู้นับ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สินค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  จำนวนนับ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ส่วนต่าง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats?.recentSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.createdAt
                      ? format(session.createdAt, "dd MMM yyyy HH:mm", {
                          locale: th,
                        })
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.userName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.branchName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>{session.productName}</div>
                    <div className="text-xs text-gray-500">
                      {session.productSKU}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {session.finalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`font-semibold ${
                        session.discrepancy > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {session.discrepancy > 0
                        ? `-${session.discrepancy}`
                        : "0"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-lg text-white`}>{icon}</div>
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
