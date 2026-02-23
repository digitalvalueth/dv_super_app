"use client";

import {
  exportCountingToExcelWithImages,
  exportCountingToPDFWithImages,
} from "@/lib/export-with-images";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Filter,
  Package,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CommissionPage() {
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [allSessions, setAllSessions] = useState<CountingSession[]>([]);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");

  useEffect(() => {
    if (!userData) return;
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchRecords = async () => {
    if (!userData) return;

    try {
      const companyId = userData.companyId;

      // Fetch counting sessions from Firestore
      let sessionsQuery;
      if (companyId) {
        sessionsQuery = query(
          collection(db, "countingSessions"),
          where("companyId", "==", companyId),
        );
      } else {
        // Superadmin - fetch all
        sessionsQuery = query(collection(db, "countingSessions"));
      }

      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: CountingSession[] = [];

      sessionsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data() as any;
        // Only include completed/approved sessions — skip pending/analyzed (not yet confirmed)
        const sessionStatus = data.status;
        if (
          sessionStatus !== "completed" &&
          sessionStatus !== "approved" &&
          sessionStatus !== "paid"
        ) {
          return;
        }
        sessions.push({
          id: docSnapshot.id,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          companyId: data.companyId,
          branchId: data.branchId,
          branchName: data.branchName,
          productId: data.productId,
          productName: data.productName,
          productSKU: data.productSKU,
          imageUrl: data.imageUrl || data.imageURL,
          aiCount: data.aiCount,
          manualCount: data.manualCount,
          finalCount: data.finalCount,
          standardCount: data.standardCount,
          discrepancy: data.discrepancy,
          beforeCountQty: data.beforeCountQty,
          currentCountQty: data.currentCountQty,
          variance: data.variance,
          status: data.status,
          remarks: data.remarks,
          errorRemark: data.errorRemark,
          userReportedCount: data.userReportedCount,
          createdAt: data.createdAt?.toDate(),
        });
      });

      // Save all sessions
      setAllSessions(sessions);
    } catch (error) {
      console.error("Error fetching commission records:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  // Get unique branches
  const branches = Array.from(
    new Set(allSessions.map((s) => s.branchName).filter(Boolean) as string[]),
  );

  // Format period for display
  const formatPeriod = (period: string) => {
    try {
      const date = new Date(period + "-01");
      return format(date, "MMMM yyyy", { locale: th });
    } catch {
      return period;
    }
  };

  // Get unique periods for filter
  const periods = Array.from(
    new Set(
      allSessions
        .map((s) => (s.createdAt ? format(s.createdAt, "yyyy-MM") : null))
        .filter(Boolean) as string[],
    ),
  )
    .sort()
    .reverse();

  const handleExportExcelWithImages = async () => {
    if (allSessions.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    if (exporting) return; // Prevent double-click

    try {
      setExporting(true);
      toast.info("กำลังเตรียมไฟล์ Excel พร้อมรูปภาพ... กรุณารอสักครู่");

      // Filter sessions based on current filters
      let sessionsToExport = [...allSessions];
      if (filterPeriod !== "all") {
        sessionsToExport = sessionsToExport.filter(
          (s) => s.createdAt && format(s.createdAt, "yyyy-MM") === filterPeriod,
        );
      }
      if (filterBranch !== "all") {
        sessionsToExport = sessionsToExport.filter(
          (s) => s.branchName === filterBranch,
        );
      }

      if (sessionsToExport.length === 0) {
        toast.error("ไม่มีข้อมูลที่ตรงกับเงื่อนไข");
        setExporting(false);
        return;
      }

      const exportSessions = sessionsToExport.map((s) => ({
        id: s.id,
        userName: s.userName || "Unknown",
        userRole: userData?.role || "staff",
        branchName: s.branchName || "Unknown",
        productName: s.productName || "",
        productSKU: s.productSKU || "",
        beforeCount: s.beforeCountQty ?? s.standardCount ?? 0,
        finalCount: s.finalCount ?? s.currentCountQty ?? s.aiCount ?? 0,
        variance: s.variance ?? s.discrepancy ?? 0,
        status: s.status || "pending",
        imageUrl: s.imageUrl,
        remarks: s.remarks,
        errorRemark: s.errorRemark,
        userReportedCount: s.userReportedCount,
        createdAt: s.createdAt ? format(s.createdAt, "yyyy-MM-dd HH:mm") : "",
      }));

      // Get unique user and branch for metadata
      const firstSession = sessionsToExport[0];

      // Format role display
      const roleDisplayMap: Record<string, string> = {
        super_admin: "ผู้ดูแลระบบ",
        admin: "เจ้าของบริษัท",
        supervisor: "หัวหน้างาน",
        manager: "ผู้จัดการสาขา",
        employee: "พนักงาน",
        staff: "พนักงาน",
      };

      const metadata = {
        sellerName: firstSession?.userName || "Unknown",
        supervisorName: userData?.name || userData?.email || "Unknown",
        supervisorRole:
          roleDisplayMap[userData?.role || "staff"] ||
          userData?.role ||
          "Staff",
        location:
          filterBranch !== "all"
            ? filterBranch
            : firstSession?.branchName || "All Branches",
        date: format(new Date(), "dd/MM/yyyy", { locale: th }),
      };

      await exportCountingToExcelWithImages(
        exportSessions,
        `counting-with-images-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`,
        metadata,
      );

      toast.success("ส่งออก Excel พร้อมรูปภาพสำเร็จ");
    } catch (error) {
      console.error("Export Excel with images error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDFWithImages = async () => {
    if (allSessions.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    if (exporting) return; // Prevent double-click

    try {
      setExporting(true);
      toast.info("กำลังเตรียมไฟล์ PDF พร้อมรูปภาพ... กรุณารอสักครู่");

      // Filter sessions based on current filters
      let sessionsToExport = [...allSessions];
      if (filterPeriod !== "all") {
        sessionsToExport = sessionsToExport.filter(
          (s) => s.createdAt && format(s.createdAt, "yyyy-MM") === filterPeriod,
        );
      }
      if (filterBranch !== "all") {
        sessionsToExport = sessionsToExport.filter(
          (s) => s.branchName === filterBranch,
        );
      }

      if (sessionsToExport.length === 0) {
        toast.error("ไม่มีข้อมูลที่ตรงกับเงื่อนไข");
        setExporting(false);
        return;
      }

      const exportSessions = sessionsToExport.map((s) => ({
        id: s.id,
        userName: s.userName || "Unknown",
        userRole: userData?.role || "staff",
        branchName: s.branchName || "Unknown",
        productName: s.productName || "",
        productSKU: s.productSKU || "",
        beforeCount: s.beforeCountQty ?? s.standardCount ?? 0,
        finalCount: s.finalCount ?? s.currentCountQty ?? s.aiCount ?? 0,
        variance: s.variance ?? s.discrepancy ?? 0,
        status: s.status || "pending",
        imageUrl: s.imageUrl,
        remarks: s.remarks,
        errorRemark: s.errorRemark,
        userReportedCount: s.userReportedCount,
        createdAt: s.createdAt ? format(s.createdAt, "yyyy-MM-dd HH:mm") : "",
      }));

      // Get unique user and branch for metadata
      const firstSession = sessionsToExport[0];

      // Format role display
      const roleDisplayMapPDF: Record<string, string> = {
        super_admin: "ผู้ดูแลระบบ",
        admin: "เจ้าของบริษัท",
        supervisor: "หัวหน้างาน",
        manager: "ผู้จัดการสาขา",
        employee: "พนักงาน",
        staff: "พนักงาน",
      };

      const metadata = {
        sellerName: firstSession?.userName || "Unknown",
        supervisorName: `${userData?.name || userData?.email || "Unknown"} (${roleDisplayMapPDF[userData?.role || "staff"] || userData?.role || "Staff"})`,
        location:
          filterBranch !== "all"
            ? filterBranch
            : firstSession?.branchName || "All Branches",
        date: format(new Date(), "dd/MM/yyyy", { locale: th }),
      };

      await exportCountingToPDFWithImages(
        exportSessions,
        userData?.companyName || "All Companies",
        `counting-with-images-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`,
        metadata,
      );

      toast.success("ส่งออก PDF พร้อมรูปภาพสำเร็จ");
    } catch (error) {
      console.error("Export PDF with images error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก PDF");
    } finally {
      setExporting(false);
    }
  };

  // Compute filtered sessions for summary cards
  const filteredSessions = allSessions.filter((s) => {
    if (
      filterPeriod !== "all" &&
      (!s.createdAt || format(s.createdAt, "yyyy-MM") !== filterPeriod)
    )
      return false;
    if (filterBranch !== "all" && s.branchName !== filterBranch) return false;
    return true;
  });
  const totalQty = filteredSessions.reduce(
    (sum, s) => sum + (s.finalCount ?? s.currentCountQty ?? s.aiCount ?? 0),
    0,
  );
  const uniqueEmployees = new Set(
    filteredSessions.map((s) => s.userId).filter(Boolean),
  ).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            สรุปยอดนับสินค้า
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            รายลักษณ์การนับสินค้าที่อนุมัติแล้วแยกตามพนักงาน สาขา และสินค้า
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              เซสชันทั้งหมด
            </span>
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600">
            {filteredSessions.length.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            เซสชัน
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              จำนวนที่นับได้รวม
            </span>
            <Package className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            {totalQty.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ชิ้น</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              จำนวนพนักงาน
            </span>
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-600">
            {uniqueEmployees.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">คน</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            ตัวกรอง
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ช่วงเวลา
            </label>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              {periods.map((period) => (
                <option key={period} value={period}>
                  {formatPeriod(period)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              สาขา
            </label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Commission Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            รายละเอียดการนับสินค้า
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* Export with Images */}
            <button
              onClick={handleExportExcelWithImages}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel + รูป
            </button>
            <button
              onClick={handleExportPDFWithImages}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              PDF + รูป
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  วันที่
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  พนักงาน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สินค้า
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  จำนวนที่นับได้
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {(() => {
                const filtered = allSessions.filter((s) => {
                  if (filterPeriod !== "all" && s.createdAt) {
                    if (format(s.createdAt, "yyyy-MM") !== filterPeriod)
                      return false;
                  }
                  if (filterBranch !== "all" && s.branchName !== filterBranch)
                    return false;
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                      >
                        ไม่มีรายการที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  );
                }
                return filtered.map((session) => (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                      {session.createdAt
                        ? format(session.createdAt, "dd MMM yyyy HH:mm", {
                            locale: th,
                          })
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                      <div className="font-semibold">{session.userName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {session.userEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                      {session.branchName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                      <div>{session.productName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        SKU: {session.productSKU}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {session.finalCount ??
                          session.currentCountQty ??
                          session.aiCount ??
                          0}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        ชิ้น
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          session.status === "approved"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            : session.status === "completed"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {session.status === "approved"
                          ? "อนุมัติแล้ว"
                          : session.status === "completed"
                            ? "เสร็จสิ้น"
                            : session.status}
                      </span>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
