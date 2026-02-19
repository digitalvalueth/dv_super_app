"use client";

import {
  CommissionExportItem,
  exportCommissionToExcel,
  exportCommissionToPDF,
} from "@/lib/export-utils";
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
  DollarSign,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Settings,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Types
interface CommissionRecord {
  id: string;
  period: string; // YYYY-MM
  userId: string;
  userName: string;
  userEmail?: string;
  branchId: string;
  branchName: string;
  salesAmount: number;
  commissionRate: number;
  commissionEarned: number;
  lossCount: number;
  lossAmount: number;
  deductionRate: number; // % ที่หักจากสินค้าหาย
  deductionAmount: number;
  netPay: number;
  status: "pending" | "approved" | "paid";
  sessions?: CountingSession[]; // เก็บ sessions ดิบไว้สำหรับ export
  createdAt?: Date;
  updatedAt?: Date;
}

// Default Commission settings
const DEFAULT_COMMISSION_RATE = 5; // 5% commission rate
const DEFAULT_DEDUCTION_RATE = 50; // 50% deduction from loss amount
const DEFAULT_PRICE_PER_ITEM = 500; // ราคาเฉลี่ยต่อชิ้นสำหรับคำนวณมูลค่าสินค้าหาย

export default function CommissionPage() {
  const { userData } = useAuthStore();
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<CommissionRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false); // Loading state for export buttons
  const [selectedRecord, setSelectedRecord] = useState<CommissionRecord | null>(
    null,
  );
  const [showSettings, setShowSettings] = useState(false);

  // Commission Settings (can be adjusted)
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION_RATE);
  const [deductionRate, setDeductionRate] = useState(DEFAULT_DEDUCTION_RATE);
  const [pricePerItem, setPricePerItem] = useState(DEFAULT_PRICE_PER_ITEM);

  // Raw sessions for export with images
  const [allSessions, setAllSessions] = useState<CountingSession[]>([]);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!userData) return;
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, commissionRate, deductionRate, pricePerItem]);

  useEffect(() => {
    let filtered = [...records];

    if (filterPeriod !== "all") {
      filtered = filtered.filter((r) => r.period === filterPeriod);
    }
    if (filterBranch !== "all") {
      filtered = filtered.filter((r) => r.branchName === filterBranch);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }

    setFilteredRecords(filtered);
  }, [records, filterPeriod, filterBranch, filterStatus]);

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
          createdAt: data.createdAt?.toDate(),
        });
      });

      // Save all sessions for export with images
      setAllSessions(sessions);

      // Group sessions by user and period (month)
      const commissionMap = new Map<string, CommissionRecord>();
      const sessionsMap = new Map<string, CountingSession[]>();

      sessions.forEach((session) => {
        if (!session.createdAt || !session.userId) return;

        const period = format(session.createdAt, "yyyy-MM");
        const key = `${session.userId}-${period}`;

        // Store sessions for this key
        if (!sessionsMap.has(key)) {
          sessionsMap.set(key, []);
        }
        sessionsMap.get(key)!.push(session);

        // คำนวณ variance/discrepancy (สินค้าหาย = ค่าติดลบ)
        const variance = session.variance ?? session.discrepancy ?? 0;
        const lossCount = variance < 0 ? Math.abs(variance) : 0;
        const lossAmount = lossCount * pricePerItem;

        if (commissionMap.has(key)) {
          // อัพเดท record ที่มีอยู่
          const existing = commissionMap.get(key)!;
          existing.lossCount += lossCount;
          existing.lossAmount += lossAmount;
          existing.deductionAmount = Math.round(
            existing.lossAmount * (deductionRate / 100),
          );
          existing.netPay =
            existing.commissionEarned - existing.deductionAmount;
        } else {
          // สร้าง record ใหม่
          // สมมติยอดขาย = จำนวนสินค้าที่นับได้ * ราคาเฉลี่ย (แบบง่าย)
          const countedItems =
            session.finalCount ??
            session.currentCountQty ??
            session.aiCount ??
            0;
          const salesAmount = countedItems * pricePerItem * 10; // Estimated sales
          const commissionEarned = Math.round(
            salesAmount * (commissionRate / 100),
          );
          const deductionAmount = Math.round(
            lossAmount * (deductionRate / 100),
          );

          commissionMap.set(key, {
            id: key,
            period: period,
            userId: session.userId,
            userName: session.userName || "Unknown",
            userEmail: session.userEmail,
            branchId: session.branchId,
            branchName: session.branchName || "Unknown",
            salesAmount: salesAmount,
            commissionRate: commissionRate,
            commissionEarned: commissionEarned,
            lossCount: lossCount,
            lossAmount: lossAmount,
            deductionRate: deductionRate,
            deductionAmount: deductionAmount,
            netPay: commissionEarned - deductionAmount,
            status:
              session.status === "approved"
                ? "approved"
                : session.status === "completed"
                  ? "paid"
                  : "pending",
            createdAt: session.createdAt,
          });
        }
      });

      // Add sessions to each commission record
      commissionMap.forEach((record, key) => {
        record.sessions = sessionsMap.get(key) || [];
      });

      // Convert map to array and sort by period
      const commissionRecords = Array.from(commissionMap.values()).sort(
        (a, b) => {
          // Sort by period descending, then by userName
          if (a.period !== b.period) {
            return b.period.localeCompare(a.period);
          }
          return a.userName.localeCompare(b.userName);
        },
      );

      setRecords(commissionRecords);
    } catch (error) {
      console.error("Error fetching commission records:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalCommission = filteredRecords.reduce(
    (sum, r) => sum + r.commissionEarned,
    0,
  );
  const totalDeduction = filteredRecords.reduce(
    (sum, r) => sum + r.deductionAmount,
    0,
  );
  const totalNetPay = filteredRecords.reduce((sum, r) => sum + r.netPay, 0);

  // Get unique branches
  const branches = Array.from(new Set(records.map((r) => r.branchName)));

  // Format period for display
  const formatPeriod = (period: string) => {
    try {
      const date = new Date(period + "-01");
      return format(date, "MMMM yyyy", { locale: th });
    } catch {
      return period;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: {
        label: "รอดำเนินการ",
        className: "bg-orange-100 text-orange-800",
      },
      approved: {
        label: "อนุมัติแล้ว",
        className: "bg-blue-100 text-blue-800",
      },
      paid: { label: "จ่ายแล้ว", className: "bg-green-100 text-green-800" },
    };
    const c = config[status as keyof typeof config] || config.pending;
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${c.className}`}
      >
        {c.label}
      </span>
    );
  };

  // Get unique periods for filter
  const periods = Array.from(new Set(records.map((r) => r.period)))
    .sort()
    .reverse();

  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    try {
      toast.info("กำลังเตรียมไฟล์ Excel...");

      const exportData: CommissionExportItem[] = filteredRecords.map((r) => ({
        period: formatPeriod(r.period),
        userName: r.userName,
        userId: r.userId,
        branchName: r.branchName,
        salesAmount: r.salesAmount,
        commissionRate: r.commissionRate,
        commissionEarned: r.commissionEarned,
        lossCount: r.lossCount,
        lossAmount: r.lossAmount,
        deductionAmount: r.deductionAmount,
        netPay: r.netPay,
        status: r.status,
      }));

      exportCommissionToExcel(
        exportData,
        {
          companyName: userData?.companyName || "All Companies",
          exportDate: format(new Date(), "dd/MM/yyyy HH:mm", { locale: th }),
          filterPeriod:
            filterPeriod === "all" ? "ทั้งหมด" : formatPeriod(filterPeriod),
          filterBranch: filterBranch === "all" ? "ทั้งหมด" : filterBranch,
        },
        { totalCommission, totalDeduction, totalNetPay },
        `commission-report-${format(new Date(), "yyyyMMdd-HHmm")}.xlsx`,
      );

      toast.success("ส่งออก Excel สำเร็จ");
    } catch (error) {
      console.error("Export Excel error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก Excel");
    }
  };

  const handleExportPDF = () => {
    if (filteredRecords.length === 0) {
      toast.error("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    try {
      toast.info("กำลังเตรียมไฟล์ PDF...");

      const exportData: CommissionExportItem[] = filteredRecords.map((r) => ({
        period: formatPeriod(r.period),
        userName: r.userName,
        userId: r.userId,
        branchName: r.branchName,
        salesAmount: r.salesAmount,
        commissionRate: r.commissionRate,
        commissionEarned: r.commissionEarned,
        lossCount: r.lossCount,
        lossAmount: r.lossAmount,
        deductionAmount: r.deductionAmount,
        netPay: r.netPay,
        status: r.status,
      }));

      exportCommissionToPDF(
        exportData,
        {
          companyName: userData?.companyName || "All Companies",
          exportDate: format(new Date(), "dd/MM/yyyy HH:mm", { locale: th }),
          filterPeriod:
            filterPeriod === "all" ? "All" : formatPeriod(filterPeriod),
          filterBranch: filterBranch === "all" ? "All" : filterBranch,
        },
        { totalCommission, totalDeduction, totalNetPay },
        `commission-report-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`,
      );

      toast.success("ส่งออก PDF สำเร็จ");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งออก PDF");
    }
  };

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
            ค่าคอมมิชชั่น & การหักเงิน
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            จัดการค่าคอมมิชชั่นและการหักเงินจากสินค้าหาย
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
            showSettings
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <Settings className="h-5 w-5" />
          ตั้งค่าอัตรา
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-linear-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700 rounded-xl shadow-sm border border-blue-200 dark:border-gray-600 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              ตั้งค่าอัตราค่าคอมมิชชั่นและการหัก
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                อัตราค่าคอมมิชชั่น (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={commissionRate}
                  onChange={(e) =>
                    setCommissionRate(parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                เปอร์เซ็นต์จากยอดขาย (ค่าเริ่มต้น: {DEFAULT_COMMISSION_RATE}%)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                อัตราหักสินค้าหาย (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="5"
                  min="0"
                  max="100"
                  value={deductionRate}
                  onChange={(e) =>
                    setDeductionRate(parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  %
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                เปอร์เซ็นต์หักจากมูลค่าสินค้าหาย (ค่าเริ่มต้น:{" "}
                {DEFAULT_DEDUCTION_RATE}%)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ราคาประมาณต่อชิ้น (฿)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={pricePerItem}
                  onChange={(e) =>
                    setPricePerItem(parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  ฿
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ใช้คำนวณมูลค่าสินค้าหาย (ค่าเริ่มต้น: {DEFAULT_PRICE_PER_ITEM}฿)
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              💡 <strong>ข้อมูลจะคำนวณใหม่อัตโนมัติ</strong>{" "}
              เมื่อเปลี่ยนค่าตั้งค่า
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              ค่าคอมมิชชั่นรวม
            </span>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            ฿{totalCommission.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">บาท</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              ยอดหักรวม
            </span>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-600">
            ฿{totalDeduction.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">บาท</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              เงินสุทธิรวม
            </span>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-600">
            ฿{totalNetPay.toLocaleString()}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">บาท</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              สถานะ
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="paid">จ่ายแล้ว</option>
            </select>
          </div>
        </div>
      </div>

      {/* Commission Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            รายการค่าคอมมิชชั่น
          </h2>
          <div className="flex flex-wrap gap-2">
            {/* Basic Export */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>

            {/* Export with Images */}
            <div className="border-l border-gray-300 dark:border-gray-600 pl-2 ml-1">
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
            </div>
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
                  ช่วงเวลา
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  พนักงาน
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สาขา
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ยอดขาย
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  อัตรา
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ค่าคอม
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สินค้าหาย
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ยอดหัก
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  เงินสุทธิ
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  สถานะ
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    ไม่มีรายการที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {formatPeriod(record.period)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          {record.userName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ID: {record.userId}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {record.branchName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                      ฿{record.salesAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white">
                      {record.commissionRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-green-600">
                      ฿{record.commissionEarned.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {record.lossCount > 0 ? (
                        <div>
                          <p className="text-sm font-bold text-red-600">
                            {record.lossCount} ชิ้น
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            ฿{record.lossAmount.toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-green-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">
                      {record.deductionAmount > 0
                        ? `-฿${record.deductionAmount.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-lg text-blue-600">
                      ฿{record.netPay.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => setSelectedRecord(record)}
                        className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <CommissionDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}

// Detail Modal Component
function CommissionDetailModal({
  record,
  onClose,
}: {
  record: CommissionRecord;
  onClose: () => void;
}) {
  const formatPeriod = (period: string) => {
    try {
      const date = new Date(period + "-01");
      return format(date, "MMMM yyyy", { locale: th });
    } catch {
      return period;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      pending: {
        label: "รอดำเนินการ",
        className: "bg-orange-100 text-orange-800",
      },
      approved: {
        label: "อนุมัติแล้ว",
        className: "bg-blue-100 text-blue-800",
      },
      paid: { label: "จ่ายแล้ว", className: "bg-green-100 text-green-800" },
    };
    const c = config[status as keyof typeof config] || config.pending;
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${c.className}`}
      >
        {c.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            รายละเอียดค่าคอมมิชชั่น
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                พนักงาน
              </label>
              <p className="font-semibold text-gray-900 dark:text-white">
                {record.userName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ID: {record.userId}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                สาขา
              </label>
              <p className="font-semibold text-gray-900 dark:text-white">
                {record.branchName}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                ช่วงเวลา
              </label>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatPeriod(record.period)}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">
                สถานะ
              </label>
              <div className="mt-1">{getStatusBadge(record.status)}</div>
            </div>
          </div>

          {/* Calculation Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              สรุปการคำนวณ
            </h3>
            <div className="space-y-2 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  ยอดขายรวม:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ฿{record.salesAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  อัตราค่าคอมมิชชั่น:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {record.commissionRate}%
                </span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>ค่าคอมมิชชั่นที่ได้:</span>
                <span className="font-bold">
                  +฿{record.commissionEarned.toLocaleString()}
                </span>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    สินค้าหาย:
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {record.lossCount} ชิ้น (฿
                    {record.lossAmount.toLocaleString()})
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>ยอดหัก ({record.deductionRate}%):</span>
                  <span className="font-bold">
                    -฿{record.deductionAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 flex justify-between text-lg">
                <span className="font-bold text-gray-900 dark:text-white">
                  เงินสุทธิที่ได้รับ:
                </span>
                <span className="font-bold text-blue-600">
                  ฿{record.netPay.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
