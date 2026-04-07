"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession, DiscrepancyReport } from "@/types";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowRight,
  Building2,
  FileBarChart2,
  Package,
  TrendingDown,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ReportsPage() {
  const { userData } = useAuthStore();
  const [allSessions, setAllSessions] = useState<CountingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [filterHalf, setFilterHalf] = useState<"all" | "1" | "2">(
    new Date().getDate() <= 15 ? "1" : "2",
  );

  const report = useMemo((): DiscrepancyReport | null => {
    const sessions = allSessions.filter((s) => {
      if (!s.createdAt) return false;
      const d = s.createdAt;
      const matchesMonth =
        d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
      const matchesHalf =
        filterHalf === "all" ||
        (filterHalf === "1" ? d.getDate() <= 15 : d.getDate() >= 16);
      return matchesMonth && matchesHalf;
    });
    if (sessions.length === 0) return null;

    const totalSessions = sessions.length;
    const totalDiscrepancy = sessions.reduce(
      (sum, s) => sum + (s.discrepancy ?? 0),
      0,
    );
    const averageDiscrepancy =
      totalSessions > 0 ? totalDiscrepancy / totalSessions : 0;

    const userMap = new Map<
      string,
      { userName: string; totalDiscrepancy: number; sessionCount: number }
    >();
    sessions.forEach((session) => {
      const existing = userMap.get(session.userId);
      if (existing) {
        existing.totalDiscrepancy += session.discrepancy ?? 0;
        existing.sessionCount += 1;
      } else {
        userMap.set(session.userId, {
          userName: session.userName ?? "ไม่ระบุ",
          totalDiscrepancy: session.discrepancy ?? 0,
          sessionCount: 1,
        });
      }
    });
    const topDiscrepancyUsers = Array.from(userMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalDiscrepancy - a.totalDiscrepancy)
      .slice(0, 10);

    const branchMap = new Map<
      string,
      { branchName: string; totalDiscrepancy: number; sessionCount: number }
    >();
    sessions.forEach((session) => {
      const existing = branchMap.get(session.branchId);
      if (existing) {
        existing.totalDiscrepancy += session.discrepancy ?? 0;
        existing.sessionCount += 1;
      } else {
        branchMap.set(session.branchId, {
          branchName: session.branchName ?? "ไม่ระบุ",
          totalDiscrepancy: session.discrepancy ?? 0,
          sessionCount: 1,
        });
      }
    });
    const topDiscrepancyBranches = Array.from(branchMap.entries())
      .map(([branchId, data]) => ({ branchId, ...data }))
      .sort((a, b) => b.totalDiscrepancy - a.totalDiscrepancy)
      .slice(0, 10);

    const productMap = new Map<
      string,
      {
        productName: string;
        productSKU: string;
        totalDiscrepancy: number;
        sessionCount: number;
      }
    >();
    sessions.forEach((session) => {
      const existing = productMap.get(session.productId);
      if (existing) {
        existing.totalDiscrepancy += session.discrepancy ?? 0;
        existing.sessionCount += 1;
      } else {
        productMap.set(session.productId, {
          productName: session.productName ?? "ไม่ระบุ",
          productSKU: session.productSKU ?? "-",
          totalDiscrepancy: session.discrepancy ?? 0,
          sessionCount: 1,
        });
      }
    });
    const topDiscrepancyProducts = Array.from(productMap.entries())
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.totalDiscrepancy - a.totalDiscrepancy)
      .slice(0, 10);

    return {
      totalSessions,
      totalDiscrepancy,
      averageDiscrepancy,
      topDiscrepancyUsers,
      topDiscrepancyBranches,
      topDiscrepancyProducts,
    };
  }, [allSessions, filterMonth, filterYear, filterHalf]);

  useEffect(() => {
    if (!userData) return;

    const fetchReportData = async () => {
      try {
        const companyId = userData.companyId;

        // ถ้าเป็น superadmin (ไม่มี companyId) ดึงทั้งหมด
        let sessionsQuery;
        if (companyId) {
          sessionsQuery = query(
            collection(db, "countingSessions"),
            where("companyId", "==", companyId),
          );
        } else {
          sessionsQuery = query(collection(db, "countingSessions"));
        }

        // Fetch all counting sessions
        const sessionsSnapshot = await getDocs(sessionsQuery);

        const sessions: CountingSession[] = [];
        sessionsSnapshot.forEach((doc) => {
          const data = doc.data() as any;
          sessions.push({
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
          });
        });

        setAllSessions(sessions);
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
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
        <h1 className="text-3xl font-bold text-gray-900">รายงาน</h1>
        <p className="text-gray-600 mt-1">รายงานและการวิเคราะห์ข้อมูลต่างๆ</p>
      </div>

      {/* Quick Links to Sub-Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/stock-counter/dashboard/reports/employee-behavior"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-purple-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500 rounded-lg text-white">
                <UserCog className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-purple-600">
                  พฤติกรรมพนักงาน
                </h3>
                <p className="text-sm text-gray-500">
                  วิเคราะห์ location และความเสี่ยง
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>

        <Link
          href="/stock-counter/dashboard/reports/stock-comparison"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-teal-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-teal-500 rounded-lg text-white">
                <FileBarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-teal-600">
                  เปรียบเทียบสต็อก
                </h3>
                <p className="text-sm text-gray-500">เทียบกับระบบ ERP ภายนอก</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors" />
          </div>
        </Link>

        <Link
          href="/stock-counter/dashboard/reports/eod-stock"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-lg text-white">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                  สินค้าตามสาขา (EOD)
                </h3>
                <p className="text-sm text-gray-500">
                  จำนวนสินค้าแต่ละรายการของแต่ละสาขา
                </p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500 rounded-lg text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">รายงานของหาย</h3>
              <p className="text-sm text-gray-500">หน้านี้ (ดูด้านล่าง)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Discrepancy Report Header */}
      <div className="border-t pt-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">รายงานของหาย</h2>
            <p className="text-gray-600 mt-1">
              วิเคราะห์ความคลาดเคลื่อนของสินค้า
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleDateString("th-TH", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              {[filterYear - 1, filterYear, filterYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y + 543}
                </option>
              ))}
            </select>
            <select
              value={filterHalf}
              onChange={(e) =>
                setFilterHalf(e.target.value as "all" | "1" | "2")
              }
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งเดือน</option>
              <option value="1">รอบ 1 (1–15)</option>
              <option value="2">รอบ 2 (16–สิ้นเดือน)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500 rounded-lg text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">ของหายรวม</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {report?.totalDiscrepancy || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500 rounded-lg text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">เฉลี่ยต่อครั้ง</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {report?.averageDiscrepancy.toFixed(1) || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-lg text-white">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">จำนวนการนับ</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {report?.totalSessions || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              พนักงานที่ทำหายเยอะสุด (Top 10)
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report?.topDiscrepancyUsers || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="userName"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalDiscrepancy" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Branches Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              สาขาที่หายเยอะสุด (Top 10)
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report?.topDiscrepancyBranches || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="branchName"
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalDiscrepancy" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Products Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            สินค้าที่หายเยอะสุด (Top 10)
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={report?.topDiscrepancyProducts || []}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="productName" type="category" width={200} />
            <Tooltip />
            <Bar dataKey="totalDiscrepancy" fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">รายละเอียดพนักงาน</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    ชื่อ
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    หาย
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    ครั้ง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report?.topDiscrepancyUsers.map((user, index) => (
                  <tr
                    key={`user-${user.userId}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">
                      <span className="font-semibold text-gray-900">
                        {index + 1}.
                      </span>{" "}
                      {user.userName}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {user.totalDiscrepancy}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {user.sessionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Branches Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">รายละเอียดสาขา</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    สาขา
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    หาย
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    ครั้ง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report?.topDiscrepancyBranches.map((branch, index) => (
                  <tr
                    key={`branch-${branch.branchId}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">
                      <span className="font-semibold text-gray-900">
                        {index + 1}.
                      </span>{" "}
                      {branch.branchName}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {branch.totalDiscrepancy}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {branch.sessionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">รายละเอียดสินค้า</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    สินค้า
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    หาย
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">
                    ครั้ง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report?.topDiscrepancyProducts.map((product, index) => (
                  <tr
                    key={`product-${product.productId}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">
                      <div>
                        <span className="font-semibold text-gray-900">
                          {index + 1}.
                        </span>{" "}
                        {product.productName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {product.productSKU}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">
                      {product.totalDiscrepancy}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {product.sessionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
