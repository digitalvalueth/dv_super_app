"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Check, Eye, MapPin, Phone, Search, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CountingPage() {
  const { userData } = useAuthStore();
  const [sessions, setSessions] = useState<CountingSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<CountingSession[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] =
    useState<CountingSession | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState<number>(
    new Date().getMonth() + 1,
  );
  const [filterYear, setFilterYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [filterHalf, setFilterHalf] = useState<"all" | "1" | "2">(
    new Date().getDate() <= 15 ? "1" : "2",
  );

  useEffect(() => {
    if (!userData) return;
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, filterStatus, searchTerm, filterMonth, filterYear, filterHalf]);

  const fetchSessions = async () => {
    if (!userData) return;

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

      const sessionsSnapshot = await getDocs(sessionsQuery);

      const sessionsData: CountingSession[] = [];
      sessionsSnapshot.forEach((doc) => {
        const data = doc.data() as any;
        sessionsData.push({
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

      sessionsData.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
      );
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sessions];

    // Filter by month/year
    filtered = filtered.filter((s) => {
      if (!s.createdAt) return false;
      const d = s.createdAt;
      const matchesMonth =
        d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
      const matchesHalf =
        filterHalf === "all" ||
        (filterHalf === "1" ? d.getDate() <= 15 : d.getDate() >= 16);
      return matchesMonth && matchesHalf;
    });

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.userName?.toLowerCase().includes(term) ||
          s.productName?.toLowerCase().includes(term) ||
          s.productSKU?.toLowerCase().includes(term) ||
          s.branchName?.toLowerCase().includes(term),
      );
    }

    setFilteredSessions(filtered);
  };

  const handleApprove = async (sessionId: string) => {
    if (!confirm("ต้องการอนุมัติรายการนี้?")) return;

    try {
      await updateDoc(doc(db, "countingSessions", sessionId), {
        status: "approved",
        reviewedBy: userData?.id,
        reviewedAt: new Date(),
      });

      toast.success("อนุมัติสำเร็จ");
      fetchSessions();
      setSelectedSession(null);
    } catch (error) {
      console.error("Error approving session:", error);
      toast.error("อนุมัติไม่สำเร็จ");
    }
  };

  const handleReject = async (sessionId: string, remarks: string) => {
    if (!remarks) {
      toast.error("กรุณาระบุเหตุผลในการปฏิเสธ");
      return;
    }

    try {
      await updateDoc(doc(db, "countingSessions", sessionId), {
        status: "rejected",
        adminRemarks: remarks,
        reviewedBy: userData?.id,
        reviewedAt: new Date(),
      });

      toast.success("ปฏิเสธสำเร็จ");
      fetchSessions();
      setSelectedSession(null);
    } catch (error) {
      console.error("Error rejecting session:", error);
      toast.error("ปฏิเสธไม่สำเร็จ");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          จัดการข้อมูลการนับ
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          ตรวจสอบและอนุมัติข้อมูลการนับสินค้า
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Month filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              เดือน
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1, 1).toLocaleDateString("th-TH", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>
          {/* Year filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ปี
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {[filterYear - 1, filterYear, filterYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y + 543}
                </option>
              ))}
            </select>
          </div>
          {/* Half filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              รอบ
            </label>
            <select
              value={filterHalf}
              onChange={(e) =>
                setFilterHalf(e.target.value as "all" | "1" | "2")
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทั้งเดือน</option>
              <option value="1">รอบ 1 (วันที่ 1-15)</option>
              <option value="2">รอบ 2 (วันที่ 16-สิ้นเดือน)</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อพนักงาน, สินค้า, SKU, สาขา..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              สถานะ
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="pending-review">รอตรวจสอบ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ป๏ิเสธแล้ว</option>
              <option value="completed">เสร็จสิ้น</option>
              <option value="analyzed">วิเคราะห์แล้ว (ยังไม่ยืนยัน)</option>
              <option value="mismatch">บาร์โค้ดไม่ตรง</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "all" ? "ring-2 ring-gray-400" : ""} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200`}
          >
            <span className="font-semibold">ทั้งหมด:</span> {sessions.length}
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "pending" ? "ring-2 ring-blue-400" : ""} bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300`}
          >
            <span className="font-semibold">รอดำเนินการ:</span>{" "}
            {sessions.filter((s) => s.status === "pending").length}
          </button>
          <button
            onClick={() => setFilterStatus("pending-review")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "pending-review" ? "ring-2 ring-yellow-400" : ""} bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300`}
          >
            <span className="font-semibold">รอตรวจสอบ:</span>{" "}
            {sessions.filter((s) => s.status === "pending-review").length}
          </button>
          <button
            onClick={() => setFilterStatus("approved")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "approved" ? "ring-2 ring-green-400" : ""} bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300`}
          >
            <span className="font-semibold">อนุมัติแล้ว:</span>{" "}
            {sessions.filter((s) => s.status === "approved").length}
          </button>
          <button
            onClick={() => setFilterStatus("completed")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "completed" ? "ring-2 ring-gray-500" : ""} bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200`}
          >
            <span className="font-semibold">เสร็จสิ้น:</span>{" "}
            {sessions.filter((s) => s.status === "completed").length}
          </button>
          <button
            onClick={() => setFilterStatus("analyzed")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "analyzed" ? "ring-2 ring-orange-400" : ""} bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300`}
          >
            <span className="font-semibold">ยังไม่ยืนยัน:</span>{" "}
            {sessions.filter((s) => s.status === "analyzed").length}
          </button>
          <button
            onClick={() => setFilterStatus("mismatch")}
            className={`px-4 py-2 rounded-lg text-sm cursor-pointer transition-all ${filterStatus === "mismatch" ? "ring-2 ring-red-400" : ""} bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300`}
          >
            <span className="font-semibold">บาร์โค้ดไม่ตรง:</span>{" "}
            {sessions.filter((s) => s.status === "mismatch").length}
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  วันที่
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ผู้นับ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สินค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AI Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Final Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ส่วนต่าง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSessions.map((session) => (
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
                    <div>{session.userName}</div>
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
                      Barcode: {session.productSKU}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    {session.aiCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-200">
                    {session.finalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`font-semibold ${
                        (session.discrepancy ?? 0) > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {(session.discrepancy ?? 0) > 0
                        ? `-${session.discrepancy}`
                        : "0"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={session.status} />
                      {session.isLate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                          ⏰ ส่งล่าช้า
                        </span>
                      )}
                      {session.isSupplemental && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                          📎 รูปเพิ่มเติม
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => setSelectedSession(session)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      ดูรายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

function SessionDetailModal({
  session,
  onClose,
  onApprove,
  onReject,
}: {
  session: CountingSession;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState("");

  // Parse watermark data from remarks
  const watermarkData = (() => {
    try {
      if (session.remarks) {
        const parsed = JSON.parse(session.remarks);
        // Check if it's watermark metadata (has location or timestamp)
        if (parsed.location || parsed.timestamp || parsed.employeeName) {
          return parsed as {
            location?: string;
            coordinates?: { lat: number; lng: number };
            timestamp?: string;
            employeeName?: string;
            employeeId?: string;
            branchName?: string;
            deviceModel?: string;
          };
        }
      }
    } catch {
      // Not JSON or not watermark data
    }
    return null;
  })();

  // Format timestamp for display
  const formatWatermarkTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      return format(date, "dd/MM/yyyy HH:mm:ss", { locale: th });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            รายละเอียดการนับสินค้า
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                ข้อมูลทั่วไป
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    วันที่:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.createdAt
                      ? format(session.createdAt, "dd MMM yyyy HH:mm", {
                          locale: th,
                        })
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    ผู้นับ:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.userName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    สาขา:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.branchName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    สินค้า:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.productName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">SKU:</span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.productSKU}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                ข้อมูลการนับ
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    AI Count:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.aiCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Manual Count:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.manualCount || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Final Count:
                  </span>{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {session.finalCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Standard Count:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.standardCount || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    ส่วนต่าง:
                  </span>{" "}
                  <span
                    className={`font-semibold ${
                      (session.discrepancy ?? 0) > 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {(session.discrepancy ?? 0) > 0
                      ? `-${session.discrepancy}`
                      : "0"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">สถานะ:</span>{" "}
                  <StatusBadge status={session.status} />
                  {session.isLate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium ml-2">
                      ⏰ ส่งล่าช้า
                    </span>
                  )}
                  {session.isSupplemental && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium ml-2">
                      📎 รูปเพิ่มเติม
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {session.imageUrl && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                ภาพถ่าย
              </h3>
              <div className="relative w-full h-96 bg-white rounded-lg overflow-hidden">
                <Image
                  src={session.imageUrl}
                  alt="Counting image"
                  fill
                  className="object-contain"
                />
                {/* Watermark Overlay for Admin */}
                {watermarkData && (
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4">
                    <div className="text-white text-sm space-y-1">
                      {watermarkData.employeeName && (
                        <p className="font-semibold">
                          {watermarkData.employeeName}
                          {watermarkData.branchName
                            ? ` · ${watermarkData.branchName}`
                            : ""}
                        </p>
                      )}
                      {watermarkData.timestamp && (
                        <p className="text-xs opacity-80">
                          {formatWatermarkTimestamp(watermarkData.timestamp)}
                        </p>
                      )}
                      {watermarkData.location && (
                        <p className="text-xs opacity-80 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {watermarkData.location}
                        </p>
                      )}
                      {watermarkData.deviceModel && (
                        <p className="text-xs opacity-80 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {watermarkData.deviceModel}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Only show remarks if it's not watermark data */}
          {session.remarks && !watermarkData && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                หมายเหตุจากพนักงาน
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                {session.remarks}
              </p>
            </div>
          )}

          {session.adminRemarks && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                หมายเหตุจาก Admin
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
                {session.adminRemarks}
              </p>
            </div>
          )}

          {session.status === "pending-review" && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                หมายเหตุ (สำหรับปฏิเสธ)
              </h3>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="ระบุเหตุผลในการปฏิเสธ..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          {session.status === "pending-review" && (
            <>
              <button
                onClick={() => onApprove(session.id)}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                อนุมัติ
              </button>
              <button
                onClick={() => onReject(session.id, remarks)}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                ปฏิเสธ
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    completed: {
      label: "เสร็จสิ้น",
      className:
        "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
    },
    "pending-review": {
      label: "รอตรวจสอบ",
      className:
        "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300",
    },
    approved: {
      label: "อนุมัติ",
      className:
        "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300",
    },
    rejected: {
      label: "ปฏิเสธ",
      className: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300",
    },
    analyzed: {
      label: "วิเคราะห์แล้ว (ยังไม่ยืนยัน)",
      className:
        "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300",
    },
    mismatch: {
      label: "บาร์โค้ดไม่ตรง",
      className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    },
    pending: {
      label: "รอดำเนินการ",
      className:
        "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300",
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    className: "bg-gray-100 text-gray-600",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}
