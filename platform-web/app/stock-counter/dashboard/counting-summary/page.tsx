"use client";

import {
  exportSummaryToExcelWithImages,
  exportSummaryToPDFWithImages,
} from "@/lib/export-with-images";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { CountingSession, User } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Hash,
  MapPin,
  Package,
  Search,
  Shield,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface SummaryRow {
  userId: string;
  userName: string;
  userEmail?: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productSKU?: string;
  totalSessions: number;
  latestCount: number;
  latestDate?: Date;
  statuses: string[];
  errorRemark?: string;
  userReportedCount?: number;
}

export default function CountingSummaryPage() {
  const { userData } = useAuthStore();
  const [sessions, setSessions] = useState<CountingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");
  const [selectedSession, setSelectedSession] =
    useState<CountingSession | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExcelImageMenu, setShowExcelImageMenu] = useState(false);
  const [showPdfImageMenu, setShowPdfImageMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!userData) return;
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchSessions = async () => {
    if (!userData) return;
    try {
      const companyId = userData.companyId;
      let sessionsQuery;
      if (companyId) {
        sessionsQuery = query(
          collection(db, "countingSessions"),
          where("companyId", "==", companyId),
        );
      } else {
        sessionsQuery = query(collection(db, "countingSessions"));
      }

      const snapshot = await getDocs(sessionsQuery);
      const data: CountingSession[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data() as any;
        data.push({
          id: doc.id,
          userId: d.userId,
          userName: d.userName,
          userEmail: d.userEmail,
          companyId: d.companyId,
          branchId: d.branchId,
          branchName: d.branchName,
          productId: d.productId,
          productName: d.productName,
          productSKU: d.productSKU,
          imageUrl: d.imageUrl || d.imageURL,
          aiCount: d.aiCount ?? 0,
          manualCount: d.manualCount,
          finalCount: d.finalCount ?? d.aiCount ?? 0,
          standardCount: d.standardCount,
          discrepancy: d.discrepancy,
          status: d.status,
          remarks: d.remarks,
          adminRemarks: d.adminRemarks,
          errorRemark: d.errorRemark,
          userReportedCount: d.userReportedCount,
          createdAt: d.createdAt?.toDate(),
        });
      });

      data.sort(
        (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0),
      );
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (mode: "all" | "branch" | "employee") => {
    setExporting(true);
    setShowExportMenu(false);
    try {
      const wb = XLSX.utils.book_new();
      const completedSessions = sessions.filter(
        (s) => s.status === "completed",
      );

      const buildRows = (data: CountingSession[]) => [
        [
          "พนักงาน",
          "อีเมล",
          "สาขา",
          "สินค้า",
          "Barcode",
          "จำนวนที่นับได้",
          "AI Count",
          "วันที่เสร็จสิ้น",
          "ตำแหน่งที่อยู่",
          "พิกัด",
          "แจ้งความผิดพลาด AI",
          "พนักงานรายงาน",
        ],
        ...data.map((s) => {
          let location = "";
          let coords = "";
          try {
            const w = JSON.parse(s.remarks || "");
            location = w.location || "";
            if (w.coordinates?.lat != null && w.coordinates?.lng != null) {
              coords = `${w.coordinates.lat}, ${w.coordinates.lng}`;
            }
          } catch {
            /* not watermark JSON */
          }
          return [
            s.userName || "",
            s.userEmail || "",
            s.branchName || "",
            s.productName || "",
            s.productSKU || "",
            s.finalCount ?? s.aiCount ?? 0,
            s.aiCount ?? 0,
            s.createdAt ? format(s.createdAt, "dd/MM/yyyy HH:mm") : "",
            location,
            coords,
            s.errorRemark || "",
            s.userReportedCount != null ? s.userReportedCount : "",
          ];
        }),
      ];

      if (mode === "all") {
        const ws = XLSX.utils.aoa_to_sheet(buildRows(completedSessions));
        XLSX.utils.book_append_sheet(wb, ws, "ทุกสาขา");
      } else if (mode === "branch") {
        const branchMap = new Map<string, string>();
        completedSessions.forEach((s) => {
          if (s.branchId) branchMap.set(s.branchId, s.branchName || s.branchId);
        });
        branchMap.forEach((name, id) => {
          const data = completedSessions.filter((s) => s.branchId === id);
          if (data.length > 0) {
            const ws = XLSX.utils.aoa_to_sheet(buildRows(data));
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
          }
        });
      } else {
        const empMap = new Map<string, string>();
        completedSessions.forEach((s) => {
          if (s.userId) empMap.set(s.userId, s.userName || s.userId);
        });
        empMap.forEach((name, id) => {
          const data = completedSessions.filter((s) => s.userId === id);
          if (data.length > 0) {
            const ws = XLSX.utils.aoa_to_sheet(buildRows(data));
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
          }
        });
      }

      XLSX.writeFile(
        wb,
        `counting-summary-${mode}-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`,
      );
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Export ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  // Build export data for image exports (shared by Excel & PDF with images)
  const buildImageExportData = () => {
    let filtered = sessions.filter((s) => s.status === "completed");
    if (filterBranch !== "all")
      filtered = filtered.filter(
        (s) => s.branchName === filterBranch || s.branchId === filterBranch,
      );
    if (filterEmployee !== "all")
      filtered = filtered.filter(
        (s) => s.userName === filterEmployee || s.userId === filterEmployee,
      );
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.productName || "").toLowerCase().includes(term) ||
          (s.productSKU || "").toLowerCase().includes(term) ||
          (s.userName || "").toLowerCase().includes(term),
      );
    }
    return filtered.map((s) => ({
      id: s.id,
      productSKU: s.productSKU || "",
      productName: s.productName || "",
      branchName: s.branchName || "",
      userName: s.userName || "",
      finalCount: s.finalCount ?? s.aiCount ?? 0,
      imageUrl: s.imageUrl,
      remarks: s.remarks,
      errorRemark: s.errorRemark,
      userReportedCount: s.userReportedCount,
      createdAt: s.createdAt ? format(s.createdAt, "yyyy-MM-dd HH:mm") : "",
    }));
  };

  const handleExportExcelWithImages = async (
    mode: "all" | "branch" | "employee",
  ) => {
    setShowExcelImageMenu(false);
    const allData = buildImageExportData();
    if (allData.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    if (exporting) return;
    try {
      setExporting(true);
      toast.info("กำลังเตรียมไฟล์ Excel พร้อมรูปภาพ... กรุณารอสักครู่");
      const dateStr = format(new Date(), "yyyyMMdd-HHmm");
      const baseMeta = {
        companyName: userData?.companyName || "",
        date: format(new Date(), "dd/MM/yyyy", { locale: th }),
        exportedBy: userData?.name || userData?.email || "",
      };

      if (mode === "all") {
        await exportSummaryToExcelWithImages(
          allData,
          `counting-summary-images-${dateStr}.xlsx`,
          {
            ...baseMeta,
            location: filterBranch !== "all" ? filterBranch : "ทุกสาขา",
          },
        );
      } else if (mode === "branch") {
        const branches = [...new Set(allData.map((d) => d.branchName))].filter(
          Boolean,
        );
        for (const branch of branches) {
          const branchData = allData.filter((d) => d.branchName === branch);
          await exportSummaryToExcelWithImages(
            branchData,
            `counting-summary-${branch}-${dateStr}.xlsx`,
            { ...baseMeta, location: branch },
          );
        }
      } else {
        const employees = [...new Set(allData.map((d) => d.userName))].filter(
          Boolean,
        );
        for (const emp of employees) {
          const empData = allData.filter((d) => d.userName === emp);
          await exportSummaryToExcelWithImages(
            empData,
            `counting-summary-${emp}-${dateStr}.xlsx`,
            {
              ...baseMeta,
              location: filterBranch !== "all" ? filterBranch : "ทุกสาขา",
              exportedBy: emp,
            },
          );
        }
      }
      toast.success("ส่งออก Excel พร้อมรูปภาพสำเร็จ");
    } catch (error) {
      console.error("Export Excel with images error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก Excel");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDFWithImages = async (
    mode: "all" | "branch" | "employee",
  ) => {
    setShowPdfImageMenu(false);
    const allData = buildImageExportData();
    if (allData.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }
    if (exporting) return;
    try {
      setExporting(true);
      toast.info("กำลังเตรียมไฟล์ PDF พร้อมรูปภาพ... กรุณารอสักครู่");
      const dateStr = format(new Date(), "yyyyMMdd-HHmm");
      const baseMeta = {
        date: format(new Date(), "dd/MM/yyyy", { locale: th }),
        exportedBy: userData?.name || userData?.email || "",
      };
      const companyName = userData?.companyName || "";

      if (mode === "all") {
        await exportSummaryToPDFWithImages(
          allData,
          companyName,
          `counting-summary-images-${dateStr}.pdf`,
          {
            ...baseMeta,
            location: filterBranch !== "all" ? filterBranch : "ทุกสาขา",
          },
        );
      } else if (mode === "branch") {
        const branches = [...new Set(allData.map((d) => d.branchName))].filter(
          Boolean,
        );
        for (const branch of branches) {
          const branchData = allData.filter((d) => d.branchName === branch);
          await exportSummaryToPDFWithImages(
            branchData,
            companyName,
            `counting-summary-${branch}-${dateStr}.pdf`,
            { ...baseMeta, location: branch },
          );
        }
      } else {
        const employees = [...new Set(allData.map((d) => d.userName))].filter(
          Boolean,
        );
        for (const emp of employees) {
          const empData = allData.filter((d) => d.userName === emp);
          await exportSummaryToPDFWithImages(
            empData,
            companyName,
            `counting-summary-${emp}-${dateStr}.pdf`,
            {
              ...baseMeta,
              location: filterBranch !== "all" ? filterBranch : "ทุกสาขา",
              exportedBy: emp,
            },
          );
        }
      }
      toast.success("ส่งออก PDF พร้อมรูปภาพสำเร็จ");
    } catch (error) {
      console.error("Export PDF with images error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก PDF");
    } finally {
      setExporting(false);
    }
  };

  // Unique branches and employees for filter dropdowns
  const branches = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.branchId && s.branchName) map.set(s.branchId, s.branchName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  const employees = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      if (s.userId && s.userName) map.set(s.userId, s.userName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  // Summary: group by employee + branch + product
  const summaryRows = useMemo((): SummaryRow[] => {
    // Only show sessions with status "completed"
    const completedSessions = sessions.filter((s) => s.status === "completed");
    const map = new Map<string, SummaryRow>();

    completedSessions.forEach((s) => {
      // Apply filters
      if (filterBranch !== "all" && s.branchId !== filterBranch) return;
      if (filterEmployee !== "all" && s.userId !== filterEmployee) return;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          s.userName?.toLowerCase().includes(term) ||
          s.productName?.toLowerCase().includes(term) ||
          s.productSKU?.toLowerCase().includes(term) ||
          s.branchName?.toLowerCase().includes(term);
        if (!match) return;
      }

      const key = `${s.userId}__${s.branchId}__${s.productId}`;
      if (!map.has(key)) {
        map.set(key, {
          userId: s.userId,
          userName: s.userName || "-",
          userEmail: s.userEmail,
          branchId: s.branchId,
          branchName: s.branchName || "-",
          productId: s.productId,
          productName: s.productName || "-",
          productSKU: s.productSKU,
          totalSessions: 1,
          latestCount: s.finalCount ?? s.aiCount ?? 0,
          latestDate: s.createdAt,
          statuses: ["completed"],
          errorRemark: s.errorRemark,
          userReportedCount: s.userReportedCount,
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => (b.latestDate?.getTime() || 0) - (a.latestDate?.getTime() || 0),
    );
  }, [sessions, filterBranch, filterEmployee, searchTerm]);

  // Detail list (flat)
  const detailRows = useMemo(() => {
    return sessions.filter((s) => {
      if (filterBranch !== "all" && s.branchId !== filterBranch) return false;
      if (filterEmployee !== "all" && s.userId !== filterEmployee) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          s.userName?.toLowerCase().includes(term) ||
          s.productName?.toLowerCase().includes(term) ||
          s.productSKU?.toLowerCase().includes(term) ||
          s.branchName?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [sessions, filterBranch, filterEmployee, searchTerm]);

  // Stats cards
  const totalEmployees = useMemo(
    () => new Set(sessions.map((s) => s.userId)).size,
    [sessions],
  );
  const totalBranches = useMemo(
    () => new Set(sessions.map((s) => s.branchId)).size,
    [sessions],
  );
  const totalProducts = useMemo(
    () => new Set(sessions.map((s) => s.productId)).size,
    [sessions],
  );
  const totalSessions = sessions.length;
  const totalCompleted = sessions.filter(
    (s) => s.status === "completed",
  ).length;

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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          สรุปการนับสินค้า
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          แสดงเฉพาะรายการที่เสร็จสิ้น — พนักงานแต่ละคน / สาขา / สินค้า
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-lg">
            <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              เสร็จสิ้น
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalCompleted}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              จาก {totalSessions} รายการ
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-lg">
            <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">พนักงาน</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalEmployees}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-lg">
            <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">สาขา</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalBranches}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
            <Package className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">สินค้า</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalProducts}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-50">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ชื่อพนักงาน, สินค้า, SKU, สาขา..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Branch filter */}
          <div className="min-w-40">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              สาขา
            </label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Employee filter */}
          <div className="min-w-40">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              พนักงาน
            </label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทุกคน</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex gap-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${viewMode === "summary" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"}`}
            >
              สรุป
            </button>
            <button
              onClick={() => setViewMode("detail")}
              className={`px-3 py-2 text-sm font-medium transition-colors ${viewMode === "detail" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"}`}
            >
              รายละเอียด
            </button>
          </div>

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu((v) => !v);
                setShowExcelImageMenu(false);
                setShowPdfImageMenu(false);
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Excel
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => handleExport("all")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ทุกสาขา (1 ชีต)
                </button>
                <button
                  onClick={() => handleExport("branch")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามสาขา
                </button>
                <button
                  onClick={() => handleExport("employee")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามพนักงาน
                </button>
              </div>
            )}
          </div>

          {/* Export with images dropdowns */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExcelImageMenu((v) => !v);
                setShowPdfImageMenu(false);
                setShowExportMenu(false);
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel พร้อมรูป
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExcelImageMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => handleExportExcelWithImages("all")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ทุกสาขา
                </button>
                <button
                  onClick={() => handleExportExcelWithImages("branch")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามสาขา
                </button>
                <button
                  onClick={() => handleExportExcelWithImages("employee")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามพนักงาน
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowPdfImageMenu((v) => !v);
                setShowExcelImageMenu(false);
                setShowExportMenu(false);
              }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <FileText className="w-4 h-4" />
              PDF พร้อมรูป
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPdfImageMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                <button
                  onClick={() => handleExportPDFWithImages("all")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ทุกสาขา
                </button>
                <button
                  onClick={() => handleExportPDFWithImages("branch")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามสาขา
                </button>
                <button
                  onClick={() => handleExportPDFWithImages("employee")}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-t border-gray-100 dark:border-gray-700"
                >
                  แยกตามพนักงาน
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === "summary" ? (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
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
                    วันที่เสร็จสิ้น
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    การกระทำ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summaryRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  summaryRows.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {row.userName}
                        </div>
                        {row.userEmail && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {row.userEmail}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200">
                        {row.branchName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {row.productName}
                        </div>
                        {row.productSKU && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            SKU: {row.productSKU}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {row.latestCount}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          ชิ้น
                        </span>
                        {(row.errorRemark || row.userReportedCount) && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-medium"
                              title={row.errorRemark || ""}
                            >
                              {row.userReportedCount != null
                                ? `⚠ พนักงานรายงาน: ${row.userReportedCount}`
                                : "⚠ แจ้งความผิดพลาด"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {row.latestDate
                          ? format(row.latestDate, "dd MMM yyyy HH:mm", {
                              locale: th,
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          const session = sessions.find(
                            (s) =>
                              s.status === "completed" &&
                              s.userId === row.userId &&
                              s.branchId === row.branchId &&
                              s.productId === row.productId,
                          );
                          return session ? (
                            <button
                              onClick={() => setSelectedSession(session)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="ดูรายละเอียด"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : null;
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    การกระทำ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {detailRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  detailRows.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {s.createdAt
                          ? format(s.createdAt, "dd MMM yyyy HH:mm", {
                              locale: th,
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {s.userName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {s.userEmail}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-200 whitespace-nowrap">
                        {s.branchName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {s.productName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {s.productSKU}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {s.finalCount ?? s.aiCount ?? 0}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          ชิ้น
                        </span>
                        {(s.errorRemark || s.userReportedCount) && (
                          <div className="mt-1">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 text-xs font-medium"
                              title={s.errorRemark || ""}
                            >
                              {s.userReportedCount != null
                                ? `⚠ พนักงานรายงาน: ${s.userReportedCount}`
                                : "⚠ แจ้งความผิดพลาด"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedSession(s)}
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer row count */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          {viewMode === "summary"
            ? `แสดง ${summaryRows.length} รายการ (สถานะเสร็จสิ้น) จากทั้งหมด ${totalSessions} รายการ`
            : `แสดง ${detailRows.length} รายการ จากทั้งหมด ${totalSessions} รายการ`}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          userData={userData}
          onOverrideSuccess={(sessionId, finalCount, source) => {
            // Update local state
            setSessions((prev) =>
              prev.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      finalCount,
                      finalCountSource: source,
                      approvalStatus: "approved",
                      status: "approved",
                    }
                  : s,
              ),
            );
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}

function SessionDetailModal({
  session,
  onClose,
  userData,
  onOverrideSuccess,
}: {
  session: CountingSession;
  onClose: () => void;
  userData: User | null;
  onOverrideSuccess?: (
    sessionId: string,
    finalCount: number,
    source: "ai" | "employee" | "custom",
  ) => void;
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideSource, setOverrideSource] = useState<
    "ai" | "employee" | "custom"
  >("ai");
  const [customCount, setCustomCount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canOverride =
    userData &&
    ["super_admin", "admin", "supervisor", "manager"].includes(userData.role);
  const isAlreadyOverridden = !!session.supervisorOverride;

  const getOverrideCount = () => {
    switch (overrideSource) {
      case "ai":
        return session.aiCount ?? 0;
      case "employee":
        return session.userReportedCount ?? session.aiCount ?? 0;
      case "custom":
        return parseInt(customCount) || 0;
    }
  };

  const handleOverride = async () => {
    if (!session.id || !userData) return;
    const finalCount = getOverrideCount();
    if (
      overrideSource === "custom" &&
      (!customCount || isNaN(parseInt(customCount)))
    ) {
      toast.error("กรุณากรอกจำนวนที่ถูกต้อง");
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "countingSessions", session.id), {
        finalCount,
        finalCountSource: overrideSource,
        approvalStatus: "approved",
        status: "approved",
        supervisorOverride: {
          overriddenBy: userData.uid || userData.id,
          overriddenByName: userData.name || userData.email,
          overriddenAt: Timestamp.now(),
          aiCount: session.aiCount ?? 0,
          employeeCount: session.userReportedCount ?? 0,
          selectedCount: finalCount,
          source: overrideSource,
          ...(overrideSource === "custom" && {
            customCount: parseInt(customCount),
          }),
          ...(overrideReason && { reason: overrideReason }),
        },
        reviewedBy: userData.uid || userData.id,
        reviewedAt: Timestamp.now(),
        updatedAt: new Date(),
      });
      toast.success(`ยืนยันยอดนับ ${finalCount} ชิ้น เรียบร้อย`);
      onOverrideSuccess?.(session.id, finalCount, overrideSource);
    } catch (error) {
      console.error("Error overriding:", error);
      toast.error("ไม่สามารถบันทึกได้ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  // Parse watermark data from remarks
  const watermarkData = (() => {
    try {
      if (session.remarks) {
        const parsed = JSON.parse(session.remarks);
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
      // not watermark JSON
    }
    return null;
  })();

  const formatWatermarkTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "";
    try {
      return format(new Date(timestamp), "dd/MM/yyyy HH:mm:ss", { locale: th });
    } catch {
      return timestamp;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            รายละเอียดการนับสินค้า
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                    อีเมล:
                  </span>{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {session.userEmail || "-"}
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
                    className={`font-semibold ${(session.discrepancy ?? 0) > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {(session.discrepancy ?? 0) > 0
                      ? `-${session.discrepancy}`
                      : "0"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    สถานะ:
                  </span>{" "}
                  <StatusBadge status={session.status} />
                </div>
              </div>
            </div>
          </div>

          {session.imageUrl && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                ภาพถ่าย
              </h3>
              <div className="relative w-full h-96 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                <Image
                  src={session.imageUrl}
                  alt="Counting image"
                  fill
                  className="object-contain"
                />
                {watermarkData && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-yellow-400 p-3 font-semibold text-sm">
                    <div className="flex flex-col gap-0.5">
                      {watermarkData.timestamp && (
                        <span>
                          📅 {formatWatermarkTimestamp(watermarkData.timestamp)}
                        </span>
                      )}
                      {watermarkData.location && (
                        <span>📍 {watermarkData.location}</span>
                      )}
                      {watermarkData.coordinates?.lat != null &&
                        watermarkData.coordinates?.lng != null && (
                          <span className="text-xs text-yellow-300">
                            🌐 {watermarkData.coordinates.lat.toFixed(6)},{" "}
                            {watermarkData.coordinates.lng.toFixed(6)}
                          </span>
                        )}
                      {watermarkData.employeeName && (
                        <span>
                          👤 {watermarkData.employeeName}
                          {watermarkData.branchName || watermarkData.employeeId
                            ? ` (${watermarkData.branchName || watermarkData.employeeId})`
                            : ""}
                        </span>
                      )}
                      {watermarkData.deviceModel && (
                        <span>📱 {watermarkData.deviceModel}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {(session.errorRemark || session.userReportedCount) && (
            <div>
              <h3 className="font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2">
                ⚠ แจ้งความผิดพลาดจาก AI (จากพนักงาน)
              </h3>
              {session.userReportedCount != null && (
                <div className="flex items-center gap-4 mb-3 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-lg">
                  <div className="text-center">
                    <div className="text-xs text-gray-500">AI นับได้</div>
                    <div className="text-2xl font-bold text-red-600">
                      {session.finalCount ?? session.aiCount ?? 0}
                    </div>
                  </div>
                  <span className="text-orange-400 text-lg">&#8594;</span>
                  <div className="text-center">
                    <div className="text-xs text-gray-500">พนักงานรายงาน</div>
                    <div className="text-2xl font-bold text-green-600">
                      {session.userReportedCount}
                    </div>
                  </div>
                </div>
              )}
              {session.errorRemark && (
                <p className="text-sm text-orange-800 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 p-4 rounded-lg">
                  {session.errorRemark}
                </p>
              )}
            </div>
          )}

          {/* Existing Override Info */}
          {isAlreadyOverridden && session.supervisorOverride && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Supervisor Override
              </h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">ยอดที่ยืนยัน:</span>
                  <span className="ml-1 font-bold text-green-700 dark:text-green-300">
                    {session.supervisorOverride.selectedCount}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">แหล่งที่มา:</span>
                  <span className="ml-1 font-semibold">
                    {session.supervisorOverride.source === "ai"
                      ? "🤖 AI"
                      : session.supervisorOverride.source === "employee"
                        ? "👤 พนักงาน"
                        : "✏️ กรอกเอง"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">โดย:</span>
                  <span className="ml-1 font-semibold">
                    {session.supervisorOverride.overriddenByName}
                  </span>
                </div>
              </div>
              {session.supervisorOverride.reason && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  หมายเหตุ: {session.supervisorOverride.reason}
                </p>
              )}
            </div>
          )}

          {/* Supervisor Override Section */}
          {canOverride && !isAlreadyOverridden && (
            <div className="border border-blue-200 dark:border-blue-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowOverride(!showOverride)}
                className="w-full flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-400">
                  <Shield className="w-4 h-4" /> Override ยอดนับ (Supervisor)
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-blue-500 transition-transform ${showOverride ? "rotate-180" : ""}`}
                />
              </button>

              {showOverride && (
                <div className="p-4 space-y-4">
                  {/* Source selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setOverrideSource("ai")}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        overrideSource === "ai"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-sm text-gray-500">🤖 AI นับได้</div>
                      <div className="text-xl font-bold text-blue-600">
                        {session.aiCount ?? 0}
                      </div>
                      {overrideSource === "ai" && (
                        <Check className="w-4 h-4 text-blue-500 mt-1" />
                      )}
                    </button>

                    {session.userReportedCount != null && (
                      <button
                        onClick={() => setOverrideSource("employee")}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          overrideSource === "employee"
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "border-gray-200 dark:border-gray-600 hover:border-orange-300"
                        }`}
                      >
                        <div className="text-sm text-gray-500">
                          👤 พนักงานรายงาน
                        </div>
                        <div className="text-xl font-bold text-orange-600">
                          {session.userReportedCount}
                        </div>
                        {overrideSource === "employee" && (
                          <Check className="w-4 h-4 text-orange-500 mt-1" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setOverrideSource("custom")}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        overrideSource === "custom"
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-600 hover:border-green-300"
                      }`}
                    >
                      <div className="text-sm text-gray-500">✏️ กรอกเอง</div>
                      {overrideSource === "custom" ? (
                        <input
                          type="number"
                          value={customCount}
                          onChange={(e) => setCustomCount(e.target.value)}
                          className="mt-1 w-full px-2 py-1 border border-green-300 dark:border-green-600 rounded text-lg font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="จำนวน"
                          autoFocus
                        />
                      ) : (
                        <div className="text-xl font-bold text-gray-400">—</div>
                      )}
                      {overrideSource === "custom" && (
                        <Check className="w-4 h-4 text-green-500 mt-1" />
                      )}
                    </button>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      หมายเหตุ (ไม่บังคับ)
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="เหตุผลในการ override..."
                    />
                  </div>

                  {/* Preview & confirm */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <span className="text-sm text-gray-500">
                        ยอดที่จะยืนยัน:
                      </span>
                      <span className="ml-2 text-2xl font-bold text-green-600">
                        {getOverrideCount()} ชิ้น
                      </span>
                    </div>
                    <button
                      onClick={handleOverride}
                      disabled={submitting}
                      className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      ยืนยัน Override
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
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
      label: "วิเคราะห์แล้ว",
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
    in_progress: {
      label: "กำลังดำเนินการ",
      className:
        "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300",
    },
  };

  const c = config[status] || {
    label: status,
    className: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-semibold ${c.className}`}
    >
      {c.label}
    </span>
  );
}
