"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Plus,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ---- Types ----
type PeriodStatus = "active" | "locked" | "grace" | "closed";
type PeriodHalf = 1 | 2;

interface CountingPeriod {
  id: string;
  companyId: string;
  year: number;
  month: number;
  half: PeriodHalf;
  startDate: Timestamp;
  endDate: Timestamp;
  lockDates: Timestamp[];
  graceEndDate: Timestamp;
  status: PeriodStatus;
  createdAt?: Timestamp;
}

// ---- Helpers ----
const THAI_MONTHS = [
  "",
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function getPeriodLabel(period: CountingPeriod) {
  const start = period.startDate.toDate();
  const end = period.endDate.toDate();
  return `${start.getDate()}–${end.getDate()} ${THAI_MONTHS[period.month]} ${period.year + 543}`;
}

function computeStatus(period: CountingPeriod): PeriodStatus {
  const now = new Date();
  const day = now.getDate();

  // lock days (1 and 16)
  if (day === 1 || day === 16) return "locked";

  const nowMs = now.getTime();
  const endMs = period.endDate.toDate().getTime();
  const graceMs = period.graceEndDate.toDate().getTime();
  const startMs = period.startDate.toDate().getTime();

  if (nowMs < startMs) return "closed"; // before start
  if (nowMs <= endMs) return "active"; // in active window
  if (nowMs <= graceMs) return "grace"; // in grace (secret)
  return "closed";
}

function getStatusBadge(status: PeriodStatus) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
          <CheckCircle className="w-3 h-3" /> เปิด
        </span>
      );
    case "locked":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400">
          <Lock className="w-3 h-3" /> ล็อค
        </span>
      );
    case "grace":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400">
          <Clock className="w-3 h-3" /> Grace (ลับ)
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          <XCircle className="w-3 h-3" /> ปิดแล้ว
        </span>
      );
  }
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function mkDate(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ---- Component ----
export default function CountingPeriodsPage() {
  const { userData } = useAuthStore();
  const [periods, setPeriods] = useState<CountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [assigningPeriodId, setAssigningPeriodId] = useState<string | null>(
    null,
  );
  const [globalAssigning, setGlobalAssigning] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(
    new Date().getMonth() + 1,
  ); // default เดือนปัจจุบัน

  const companyId = userData?.companyId ?? "";
  const isSuperAdmin = userData?.role === "super_admin";
  const isAdminOrAbove =
    userData?.role === "admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "manager" ||
    userData?.role === "supervisor";

  useEffect(() => {
    if (!companyId && !isSuperAdmin) return;
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedYear]);

  async function fetchPeriods() {
    setLoading(true);
    try {
      let q;
      if (isSuperAdmin && !companyId) {
        q = query(
          collection(db, "countingPeriods"),
          where("year", "==", selectedYear),
        );
      } else {
        q = query(
          collection(db, "countingPeriods"),
          where("companyId", "==", companyId),
          where("year", "==", selectedYear),
        );
      }

      const snap = await getDocs(q);
      const result: CountingPeriod[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<CountingPeriod, "id">) }))
        .sort((a, b) => {
          if (a.month !== b.month) return a.month - b.month;
          return a.half - b.half;
        });

      setPeriods(result);
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateYear() {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }

    // Check if already exists
    if (periods.length > 0) {
      const confirmed = window.confirm(
        `ปีนี้มีรอบอยู่แล้ว ${periods.length} รอบ ต้องการสร้างใหม่ทับหรือไม่?`,
      );
      if (!confirmed) return;
    }

    setGenerating(true);
    try {
      let created = 0;
      for (let month = 1; month <= 12; month++) {
        const lastDay = getLastDayOfMonth(selectedYear, month);

        // Half 1: 2–15
        await addDoc(collection(db, "countingPeriods"), {
          companyId,
          year: selectedYear,
          month,
          half: 1,
          startDate: Timestamp.fromDate(mkDate(selectedYear, month, 2)),
          endDate: Timestamp.fromDate(mkDate(selectedYear, month, 15)),
          lockDates: [Timestamp.fromDate(mkDate(selectedYear, month, 1))],
          graceEndDate: Timestamp.fromDate(
            addDays(mkDate(selectedYear, month, 15), 5),
          ),
          status: "active",
          createdAt: Timestamp.now(),
        });
        created++;

        // Half 2: 17–lastDay
        await addDoc(collection(db, "countingPeriods"), {
          companyId,
          year: selectedYear,
          month,
          half: 2,
          startDate: Timestamp.fromDate(mkDate(selectedYear, month, 17)),
          endDate: Timestamp.fromDate(mkDate(selectedYear, month, lastDay)),
          lockDates: [Timestamp.fromDate(mkDate(selectedYear, month, 16))],
          graceEndDate: Timestamp.fromDate(
            addDays(mkDate(selectedYear, month, lastDay), 5),
          ),
          status: "active",
          createdAt: Timestamp.now(),
        });
        created++;
      }

      toast.success(
        `สร้างรอบการนับ ${created} รอบสำเร็จ (ทั้งปี ${selectedYear})`,
      );
      fetchPeriods();
    } catch (err) {
      console.error(err);
      toast.error("สร้างรอบไม่สำเร็จ");
    } finally {
      setGenerating(false);
    }
  }

  async function handleClosePeriod(period: CountingPeriod) {
    try {
      await updateDoc(doc(db, "countingPeriods", period.id), {
        status: "closed",
        updatedAt: Timestamp.now(),
      });
      toast.success("ปิดรอบสำเร็จ");
      fetchPeriods();
    } catch {
      toast.error("ปิดรอบไม่สำเร็จ");
    }
  }

  async function handleAutoAssign(period: CountingPeriod) {
    await runAutoAssign(period.month, period.year, period.id);
  }

  async function handleGlobalAutoAssign() {
    const now = new Date();
    await runAutoAssign(now.getMonth() + 1, now.getFullYear(), null);
  }

  async function runAutoAssign(
    month: number,
    year: number,
    periodId: string | null,
  ) {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }
    const confirmed = window.confirm(
      `มอบหมายสินค้าทั้งหมดให้พนักงานทุกคน สำหรับเดือน ${THAI_MONTHS[month]}/${year} ใช่หรือไม่?`,
    );
    if (!confirmed) return;

    if (periodId) {
      setAssigningPeriodId(periodId);
    } else {
      setGlobalAssigning(true);
    }
    try {
      // 1. Get all product IDs for this company
      const productsSnap = await getDocs(
        query(collection(db, "products"), where("companyId", "==", companyId)),
      );
      const allProductIds = productsSnap.docs
        .map((d) => d.data().productId as string)
        .filter(Boolean);

      if (allProductIds.length === 0) {
        toast.error("ไม่พบรายการสินค้า");
        return;
      }

      // 2. Get all active employees in this company
      const usersSnap = await getDocs(
        query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "==", "employee"),
        ),
      );

      if (usersSnap.empty) {
        toast.error("ไม่พบพนักงานในระบบ");
        return;
      }

      let assignedCount = 0;
      let skippedCount = 0;

      for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        const userId = userDoc.id;

        // Check if assignment already exists for this month/year
        const existingSnap = await getDocs(
          query(
            collection(db, "assignments"),
            where("userId", "==", userId),
            where("month", "==", month),
            where("year", "==", year),
          ),
        );

        if (!existingSnap.empty) {
          // Reset progress — เริ่มรอบใหม่ พนักงานนับสต็อกใหม่ทั้งหมด
          await updateDoc(doc(db, "assignments", existingSnap.docs[0].id), {
            productIds: allProductIds,
            productCount: allProductIds.length,
            completedProductIds: [],
            inProgressProductIds: [],
            notAvailableProductIds: [],
            completedCount: 0,
            status: "pending",
            updatedAt: serverTimestamp(),
          });
          skippedCount++;
        } else {
          // Create new assignment
          await addDoc(collection(db, "assignments"), {
            userId,
            userName: user.name || user.displayName || "",
            userEmail: user.email || "",
            companyId: user.companyId,
            branchId: user.branchId || "",
            branchName: user.branchName || "",
            productIds: allProductIds,
            productCount: allProductIds.length,
            month,
            year,
            status: "pending",
            completedCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          assignedCount++;
        }
      }

      toast.success(
        `มอบหมายสำเร็จ! สร้างใหม่ ${assignedCount} คน, อัปเดต ${skippedCount} คน (สินค้า ${allProductIds.length} รายการ)`,
      );
    } catch (err) {
      console.error(err);
      toast.error("มอบหมายไม่สำเร็จ");
    } finally {
      setAssigningPeriodId(null);
      setGlobalAssigning(false);
    }
  }

  // ---- Current period highlight ----
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentHalf: PeriodHalf = currentDay <= 15 ? 1 : 2;
  const isLockDay = currentDay === 1 || currentDay === 16;

  const filteredPeriods = selectedMonth
    ? periods.filter((p) => p.month === selectedMonth)
    : periods;

  // Stats
  const activePeriods = periods.filter((p) => computeStatus(p) === "active");
  const gracePeriods = periods.filter((p) => computeStatus(p) === "grace");
  const closedPeriods = periods.filter((p) => computeStatus(p) === "closed");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            รอบการนับสต็อก
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            จัดการรอบการนับ 2 ครั้งต่อเดือน (วันที่ 1–15 และ 16–สิ้นเดือน)
          </p>
        </div>
        {isAdminOrAbove && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Global Auto-assign button */}
            <button
              onClick={handleGlobalAutoAssign}
              disabled={globalAssigning}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {globalAssigning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              {globalAssigning ? "กำลังมอบ..." : "Auto-assign เดือนนี้"}
            </button>
            {/* Generate year button */}
            <button
              onClick={handleGenerateYear}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {generating ? "กำลังสร้าง..." : `สร้างรอบทั้งปี ${selectedYear}`}
            </button>
          </div>
        )}
      </div>

      {/* Current Period Indicator */}
      <div
        className={`flex items-center gap-3 p-4 border rounded-xl ${
          isLockDay
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        }`}
      >
        <Calendar
          className={`w-5 h-5 shrink-0 ${isLockDay ? "text-red-600" : "text-blue-600"}`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${isLockDay ? "text-red-800 dark:text-red-300" : "text-blue-800 dark:text-blue-300"}`}
          >
            📅 วันนี้:{" "}
            {now.toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p
            className={`text-xs mt-0.5 ${isLockDay ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}
          >
            {isLockDay
              ? `🔒 วันล็อค — ระบบไม่รับรูปภาพทุกรอบในวันนี้`
              : `📸 รอบที่ ${currentHalf} ของเดือน (${currentHalf === 1 ? "วันที่ 2–15" : "วันที่ 17–สิ้นเดือน"}) — เปิดรับรูป`}
          </p>
        </div>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
            isLockDay
              ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          }`}
        >
          {isLockDay ? "🔒 ล็อค" : `รอบ ${currentHalf}`}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">รอบทั้งหมด</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {periods.length}
          </p>
          <p className="text-xs text-gray-400">ปี {selectedYear + 543}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            เปิดอยู่ตอนนี้
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {activePeriods.length}
          </p>
          <p className="text-xs text-gray-400">รอบ</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Grace Period (ลับ)
          </p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {gracePeriods.length}
          </p>
          <p className="text-xs text-gray-400">รอบ</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">ปิดแล้ว</p>
          <p className="text-2xl font-bold text-gray-400 mt-1">
            {closedPeriods.length}
          </p>
          <p className="text-xs text-gray-400">รอบ</p>
        </div>
      </div>

      {/* Year/Month Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Year Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white min-w-20 text-center">
            ปี {selectedYear + 543}
          </span>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setSelectedMonth(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedMonth === null
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            ทุกเดือน
          </button>
          {THAI_MONTHS.slice(1).map((m, i) => (
            <button
              key={i + 1}
              onClick={() =>
                setSelectedMonth(selectedMonth === i + 1 ? null : i + 1)
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedMonth === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={fetchPeriods}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          รีเฟรช
        </button>
      </div>

      {/* Period Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">กำลังโหลด...</span>
        </div>
      ) : periods.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500 dark:text-gray-400">
            ยังไม่มีรอบการนับสำหรับปี {selectedYear + 543}
          </p>
          {isAdminOrAbove && (
            <button
              onClick={handleGenerateYear}
              disabled={generating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {generating ? "กำลังสร้าง..." : "สร้างรอบทั้งปี"}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  รอบ
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  ช่วงเวลา
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  วันล็อค
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Grace ถึง
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  สถานะ
                </th>
                {isAdminOrAbove && (
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                    การดำเนินการ
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredPeriods.map((period) => {
                const liveStatus = computeStatus(period);
                const isCurrent =
                  period.month === currentMonth &&
                  period.half === currentHalf &&
                  period.year === now.getFullYear();

                return (
                  <tr
                    key={period.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                      isCurrent ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {THAI_MONTHS[period.month]} รอบ {period.half}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {getPeriodLabel(period)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {period.lockDates?.[0]
                        ? format(period.lockDates[0].toDate(), "d MMM", {
                            locale: th,
                          })
                        : "–"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {period.graceEndDate
                        ? format(period.graceEndDate.toDate(), "d MMM", {
                            locale: th,
                          })
                        : "–"}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(liveStatus)}</td>
                    {isAdminOrAbove && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Auto-assign button */}
                          {liveStatus !== "closed" && (
                            <button
                              onClick={() => handleAutoAssign(period)}
                              disabled={assigningPeriodId === period.id}
                              className="text-xs px-2 py-1 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {assigningPeriodId === period.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Users className="w-3.5 h-3.5" />
                              )}
                              {assigningPeriodId === period.id
                                ? "กำลังมอบ..."
                                : "Auto-assign"}
                            </button>
                          )}
                          {/* Close period button */}
                          {liveStatus !== "closed" && (
                            <button
                              onClick={() => handleClosePeriod(period)}
                              className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5 inline mr-1" />
                              ปิดรอบ
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> ตรรกะการล็อครอบ
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-700 dark:text-blue-400">
          <div className="space-y-1">
            <p>
              <span className="font-medium">🔒 วันที่ 1 ของเดือน</span> —
              ล็อคทั้งวัน ห้ามส่งรูปทุกรอบ (ตัดรอบ 2 เดือนก่อน)
            </p>
            <p>
              <span className="font-medium">📸 วันที่ 2–15</span> —
              เปิดให้ถ่ายรูปรอบ 1
            </p>
            <p>
              <span className="font-medium">🔒 วันที่ 16</span> — ล็อคทั้งวัน
              ห้ามส่งรูปทุกรอบ (ตัดรอบ 1)
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="font-medium">📸 วันที่ 17–สิ้นเดือน</span> —
              เปิดให้ถ่ายรูปรอบ 2
            </p>
            <p>
              <span className="font-medium">⏰ Grace Period (+5 วัน, ลับ)</span>{" "}
              — พนักงานเห็น &quot;หมดเวลา&quot; แต่ระบบยัง accept + tag
              &quot;ส่งล่าช้า&quot;
            </p>
            <p>
              <span className="font-medium">❌ หลัง Grace</span> — ปิดจริง
              ส่งไม่ได้แล้ว
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
