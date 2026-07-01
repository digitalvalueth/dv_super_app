"use client";

import AssignPreviewModal from "@/components/stock-counter/assign-preview-modal";
import {
  buildAssignPlan,
  commitAssignPlan,
  resolveAssignPeriod,
  type AssignPlan,
} from "@/lib/assign-products";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  Building2,
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

interface CountingUploadOverride {
  companyId: string;
  enabled?: boolean;
  startAt?: Timestamp;
  endAt?: Timestamp;
  reason?: string;
  allowedUserIds?: string[];
  targetPeriodDocId?: string;
  targetPeriodKey?: string;
  targetYear?: number;
  targetMonth?: number;
  targetHalf?: PeriodHalf;
  targetPeriodLabel?: string;
  targetStartDate?: Timestamp;
  targetEndDate?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  updatedByName?: string;
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

function getPeriodKey(period: Pick<CountingPeriod, "year" | "month" | "half">) {
  const paddedMonth = String(period.month).padStart(2, "0");
  return `${period.year}-${paddedMonth}-H${period.half}`;
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

function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultTemporaryOpenUntil(): string {
  const end = new Date();
  end.setHours(end.getHours() + 4, 0, 0, 0);
  return toDateTimeLocalValue(end);
}

function formatOverrideDateTime(timestamp?: Timestamp): string {
  if (!timestamp) return "-";
  return format(timestamp.toDate(), "d MMM yyyy HH:mm", { locale: th });
}

function isTemporaryOpenActive(
  override: CountingUploadOverride | null,
  now: Date = new Date(),
): boolean {
  if (!override?.enabled || !override.endAt) {
    return false;
  }

  const nowMs = now.getTime();
  const startMs = override.startAt?.toDate().getTime() ?? 0;
  const endMs = override.endAt.toDate().getTime();

  return nowMs >= startMs && nowMs <= endMs;
}

function getOverrideTargetLabel(
  override: CountingUploadOverride | null,
  fallbackPeriod: CountingPeriod | null,
): string | null {
  if (override?.targetPeriodLabel) {
    return override.targetPeriodLabel;
  }

  if (fallbackPeriod) {
    return getPeriodLabel(fallbackPeriod);
  }

  return null;
}

function getUserIdentifier(user: User): string {
  return user.uid || user.id;
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
  const [uploadOverride, setUploadOverride] =
    useState<CountingUploadOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [temporaryOpenUntil, setTemporaryOpenUntil] = useState(
    getDefaultTemporaryOpenUntil(),
  );
  const [temporaryOpenReason, setTemporaryOpenReason] = useState("");
  const [suggestedTargetPeriod, setSuggestedTargetPeriod] =
    useState<CountingPeriod | null>(null);
  // Past periods a manager can reopen for late submission (latest first).
  const [pastPeriods, setPastPeriods] = useState<CountingPeriod[]>([]);
  // Manager's chosen reopen target; null = fall back to override/suggested default.
  const [selectedTargetPeriodId, setSelectedTargetPeriodId] = useState<
    string | null
  >(null);
  const [companyEmployees, setCompanyEmployees] = useState<User[]>([]);
  const [restrictToSelectedUsers, setRestrictToSelectedUsers] = useState(false);
  const [selectedLateUserIds, setSelectedLateUserIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPlan, setAssignPlan] = useState<AssignPlan | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignCommitting, setAssignCommitting] = useState(false);
  const [assignContext, setAssignContext] = useState<{
    month: number;
    year: number;
    half: PeriodHalf;
    periodId: string | null;
    label: string;
  } | null>(null);
  const [managedBranches, setManagedBranches] = useState<
    { id: string; name: string }[]
  >([]);

  const companyId = userData?.companyId ?? "";
  const isSuperAdmin = userData?.role === "super_admin";
  // Supervisor / Manager มอบหมายได้เฉพาะสาขาที่ตนดูแล
  const isBranchScoped =
    userData?.role === "supervisor" || userData?.role === "manager";
  const isAdminOrAbove =
    userData?.role === "admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "manager" ||
    userData?.role === "supervisor";
  const canManageTemporaryOpen =
    userData?.role === "admin" ||
    userData?.role === "super_admin" ||
    userData?.role === "manager";

  useEffect(() => {
    if (!companyId && !isSuperAdmin) return;
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, selectedYear]);

  useEffect(() => {
    if (!companyId) {
      setUploadOverride(null);
      setTemporaryOpenUntil(getDefaultTemporaryOpenUntil());
      setTemporaryOpenReason("");
      setCompanyEmployees([]);
      setRestrictToSelectedUsers(false);
      setSelectedLateUserIds([]);
      setSelectedTargetPeriodId(null);
      setOverrideLoading(false);
      return;
    }

    setSelectedTargetPeriodId(null);
    void loadUploadOverride(companyId);
    void loadSuggestedTargetPeriod(companyId);
    void loadCompanyEmployees(companyId);
  }, [companyId]);

  // โหลดสาขาที่ Supervisor / Manager ดูแล (ใช้จำกัดขอบเขตการมอบหมาย)
  useEffect(() => {
    if (!userData || !isBranchScoped) {
      setManagedBranches([]);
      return;
    }
    void loadManagedBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, isBranchScoped]);

  async function loadManagedBranches() {
    if (!userData) return;
    try {
      let managedIds: string[] = userData.managedBranchIds?.length
        ? [...userData.managedBranchIds]
        : userData.branchId
          ? [userData.branchId]
          : [];

      // Manager: รวมสาขาจาก Supervisor ที่ตนดูแลด้วย
      if (userData.role === "manager") {
        const supervisorIds = (userData.managedSupervisorIds || []).slice(
          0,
          30,
        );
        if (supervisorIds.length > 0) {
          const supervisorsSnap = await getDocs(
            query(
              collection(db, "users"),
              where(documentId(), "in", supervisorIds),
            ),
          );
          const branchSet = new Set<string>(managedIds);
          supervisorsSnap.forEach((d) => {
            const supData = d.data() as Partial<User>;
            (supData.managedBranchIds || []).forEach((id) => branchSet.add(id));
          });
          managedIds = [...branchSet];
        }
      }

      managedIds = managedIds.filter(Boolean);
      if (managedIds.length === 0) {
        setManagedBranches([]);
        return;
      }

      // ดึงชื่อสาขา (Firestore "in" รองรับสูงสุด 30 ค่า)
      const branches: { id: string; name: string }[] = [];
      for (let i = 0; i < managedIds.length; i += 30) {
        const chunk = managedIds.slice(i, i + 30);
        const branchesSnap = await getDocs(
          query(collection(db, "branches"), where(documentId(), "in", chunk)),
        );
        branchesSnap.forEach((d) => {
          const data = d.data() as { name?: string };
          branches.push({ id: d.id, name: data.name || d.id });
        });
      }
      branches.sort((a, b) => a.name.localeCompare(b.name, "th"));
      setManagedBranches(branches);
    } catch (err) {
      console.error("Error loading managed branches:", err);
      setManagedBranches([]);
    }
  }

  async function loadCompanyEmployees(targetCompanyId: string) {
    try {
      const usersSnap = await getDocs(
        query(
          collection(db, "users"),
          where("companyId", "==", targetCompanyId),
        ),
      );

      const employees = usersSnap.docs
        .map((userDoc) => {
          const userData = userDoc.data() as Partial<User>;
          return {
            id: userDoc.id,
            uid: userData.uid || userDoc.id,
            email: userData.email || "",
            ...userData,
          } as User;
        })
        .filter((employee) => employee.role === "employee")
        .sort((left, right) =>
          (left.name || left.displayName || left.email).localeCompare(
            right.name || right.displayName || right.email,
            "th",
          ),
        );

      setCompanyEmployees(employees);
    } catch (err) {
      console.error(err);
      setCompanyEmployees([]);
    }
  }

  async function loadSuggestedTargetPeriod(targetCompanyId: string) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const prevYear = now.getMonth() === 0 ? year - 1 : year;
      const yearsToQuery = year === prevYear ? [year] : [year, prevYear];

      const periodsSnap = await getDocs(
        query(
          collection(db, "countingPeriods"),
          where("companyId", "==", targetCompanyId),
          where("year", "in", yearsToQuery),
        ),
      );

      const sortedPastPeriods = periodsSnap.docs
        .map(
          (periodDoc) =>
            ({
              id: periodDoc.id,
              ...(periodDoc.data() as Omit<CountingPeriod, "id">),
            }) as CountingPeriod,
        )
        .filter((period) => period.endDate.toDate().getTime() < now.getTime())
        .sort(
          (left, right) =>
            right.endDate.toDate().getTime() - left.endDate.toDate().getTime(),
        );

      setPastPeriods(sortedPastPeriods);
      setSuggestedTargetPeriod(sortedPastPeriods[0] ?? null);
    } catch (err) {
      console.error(err);
      setPastPeriods([]);
      setSuggestedTargetPeriod(null);
    }
  }

  async function loadUploadOverride(targetCompanyId: string) {
    try {
      setOverrideLoading(true);
      const overrideSnap = await getDoc(
        doc(db, "countingUploadOverrides", targetCompanyId),
      );

      if (!overrideSnap.exists()) {
        setUploadOverride(null);
        setTemporaryOpenUntil(getDefaultTemporaryOpenUntil());
        setTemporaryOpenReason("");
        setRestrictToSelectedUsers(false);
        setSelectedLateUserIds([]);
        return;
      }

      const overrideData = overrideSnap.data() as CountingUploadOverride;
      setUploadOverride(overrideData);
      setTemporaryOpenUntil(
        overrideData.endAt
          ? toDateTimeLocalValue(overrideData.endAt.toDate())
          : getDefaultTemporaryOpenUntil(),
      );
      setTemporaryOpenReason(overrideData.reason || "");
      setSelectedLateUserIds(overrideData.allowedUserIds || []);
      setRestrictToSelectedUsers(
        (overrideData.allowedUserIds?.length ?? 0) > 0,
      );
    } catch (err) {
      console.error(err);
      toast.error("โหลดสถานะเปิดรับรูปชั่วคราวไม่สำเร็จ");
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleEnableTemporaryOpen() {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }

    const targetPeriod =
      pastPeriods.find((period) => period.id === selectedTargetPeriodId) ??
      suggestedTargetPeriod;
    if (!targetPeriod) {
      toast.error("ไม่พบรอบย้อนหลังสำหรับเปิดรับรูปชั่วคราว");
      return;
    }

    if (restrictToSelectedUsers && selectedLateUserIds.length === 0) {
      toast.error("กรุณาเลือกพนักงานอย่างน้อย 1 คน");
      return;
    }

    const endAt = new Date(temporaryOpenUntil);
    if (Number.isNaN(endAt.getTime())) {
      toast.error("กรุณาระบุวันเวลาให้ถูกต้อง");
      return;
    }

    if (endAt.getTime() <= Date.now()) {
      toast.error("เวลาสิ้นสุดต้องมากกว่าปัจจุบัน");
      return;
    }

    try {
      setOverrideSaving(true);
      await setDoc(
        doc(db, "countingUploadOverrides", companyId),
        {
          companyId,
          enabled: true,
          startAt: Timestamp.now(),
          endAt: Timestamp.fromDate(endAt),
          reason: temporaryOpenReason.trim(),
          allowedUserIds: restrictToSelectedUsers ? selectedLateUserIds : [],
          targetPeriodDocId: targetPeriod.id,
          targetPeriodKey: getPeriodKey(targetPeriod),
          targetYear: targetPeriod.year,
          targetMonth: targetPeriod.month,
          targetHalf: targetPeriod.half,
          targetPeriodLabel: getPeriodLabel(targetPeriod),
          targetStartDate: targetPeriod.startDate,
          targetEndDate: targetPeriod.endDate,
          updatedAt: serverTimestamp(),
          updatedBy: userData?.uid || userData?.id || "",
          updatedByName:
            userData?.name || userData?.displayName || userData?.email || "",
          ...(uploadOverride?.createdAt
            ? {}
            : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );
      toast.success("เปิดรับรูปชั่วคราวเรียบร้อยแล้ว");
      await loadUploadOverride(companyId);
    } catch (err) {
      console.error(err);
      toast.error("เปิดรับรูปชั่วคราวไม่สำเร็จ");
    } finally {
      setOverrideSaving(false);
    }
  }

  async function handleDisableTemporaryOpen() {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }

    try {
      setOverrideSaving(true);
      await setDoc(
        doc(db, "countingUploadOverrides", companyId),
        {
          companyId,
          enabled: false,
          endAt: Timestamp.now(),
          updatedAt: serverTimestamp(),
          updatedBy: userData?.uid || userData?.id || "",
          updatedByName:
            userData?.name || userData?.displayName || userData?.email || "",
        },
        { merge: true },
      );
      toast.success("ปิดการเปิดรับรูปชั่วคราวแล้ว");
      await loadUploadOverride(companyId);
    } catch (err) {
      console.error(err);
      toast.error("ปิดการเปิดรับรูปชั่วคราวไม่สำเร็จ");
    } finally {
      setOverrideSaving(false);
    }
  }

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

    // Block if already exists
    if (periods.length > 0) {
      toast.error(
        `ปี ${selectedYear} มีรอบการนับอยู่แล้ว ${periods.length} รอบ ไม่สามารถสร้างซ้ำได้`,
      );
      return;
    }

    setGenerating(true);
    try {
      let created = 0;
      for (let month = 1; month <= 12; month++) {
        const lastDay = getLastDayOfMonth(selectedYear, month);

        // Half 1: 2–15 — use deterministic ID to prevent duplicates
        const h1Id = `${companyId}_${selectedYear}_${month}_H1`;
        await setDoc(doc(db, "countingPeriods", h1Id), {
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

        // Half 2: 17–lastDay — use deterministic ID to prevent duplicates
        const h2Id = `${companyId}_${selectedYear}_${month}_H2`;
        await setDoc(doc(db, "countingPeriods", h2Id), {
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
    await openAssignPreview(
      period.month,
      period.year,
      period.id,
      period.half,
      `เดือน ${THAI_MONTHS[period.month]}/${period.year} รอบ ${period.half}`,
    );
  }

  async function handleGlobalAutoAssign() {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }
    // When "เปิดรับรูปชั่วคราว" is active, assign into the reopened round (the
    // override target) so the work appears in the app, which resolves the same
    // period. Otherwise use the current calendar period.
    const resolved = await resolveAssignPeriod(companyId);
    const baseLabel = `เดือน ${THAI_MONTHS[resolved.month]}/${resolved.year} รอบ ${resolved.half}`;
    await openAssignPreview(
      resolved.month,
      resolved.year,
      resolved.periodId,
      resolved.half,
      resolved.isTemporaryOverride
        ? `${baseLabel} • เปิดรับรูปชั่วคราว (ส่งล่าช้า)`
        : baseLabel,
    );
  }

  async function openAssignPreview(
    month: number,
    year: number,
    periodId: string | null,
    half: PeriodHalf,
    label: string,
  ) {
    if (!companyId) {
      toast.error("ไม่พบ companyId");
      return;
    }
    setAssignContext({ month, year, half, periodId, label });
    setAssignPlan(null);
    setShowAssignModal(true);
    setAssignLoading(true);
    if (periodId) {
      setAssigningPeriodId(periodId);
    } else {
      setGlobalAssigning(true);
    }
    try {
      const plan = await buildAssignPlan({
        companyId,
        month,
        year,
        half,
        // Supervisor / Manager มอบหมายเฉพาะสาขาที่ตนดูแล
        branchIds: isBranchScoped
          ? managedBranches.map((b) => b.id)
          : undefined,
      });
      setAssignPlan(plan);
    } catch (err) {
      console.error(err);
      toast.error("ไม่สามารถเตรียมข้อมูลการมอบหมายได้");
      setShowAssignModal(false);
    } finally {
      setAssignLoading(false);
      setAssigningPeriodId(null);
      setGlobalAssigning(false);
    }
  }

  async function handleConfirmAssign() {
    if (!assignPlan || !assignContext) return;
    setAssignCommitting(true);
    try {
      const { created, updated } = await commitAssignPlan(assignPlan, {
        month: assignContext.month,
        year: assignContext.year,
        half: assignContext.half,
      });
      toast.success(
        `มอบหมายสำเร็จ! รอบ ${assignContext.half} สร้างใหม่ ${created} คน, อัปเดต ${updated} คน (สินค้า ${assignPlan.productIds.length} รายการ)`,
      );
      setShowAssignModal(false);
      setAssignPlan(null);
      setAssignContext(null);
    } catch (err) {
      console.error(err);
      toast.error("มอบหมายไม่สำเร็จ");
    } finally {
      setAssignCommitting(false);
    }
  }

  // ---- Current period highlight ----
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const currentHalf: PeriodHalf = currentDay <= 15 ? 1 : 2;
  const isLockDay = currentDay === 1 || currentDay === 16;
  const temporaryOpenActive = isTemporaryOpenActive(uploadOverride, now);
  const overrideTargetLabel = getOverrideTargetLabel(
    uploadOverride,
    suggestedTargetPeriod,
  );
  const overrideUserNames = (uploadOverride?.allowedUserIds || [])
    .map(
      (userId) =>
        companyEmployees.find(
          (employee) => getUserIdentifier(employee) === userId,
        )?.name ||
        companyEmployees.find(
          (employee) => getUserIdentifier(employee) === userId,
        )?.displayName ||
        companyEmployees.find(
          (employee) => getUserIdentifier(employee) === userId,
        )?.email ||
        userId,
    )
    .filter(Boolean);
  const overrideScopeLabel = uploadOverride?.allowedUserIds?.length
    ? `เฉพาะ ${uploadOverride.allowedUserIds.length} คน`
    : "ทั้งบริษัท";

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
              disabled={
                globalAssigning ||
                (isBranchScoped && managedBranches.length === 0)
              }
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {globalAssigning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              {globalAssigning
                ? "กำลังมอบ..."
                : `Auto-assign รอบ ${currentHalf} เดือนนี้`}
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

      {/* สรุปสาขาที่ดูแล (สำหรับ Supervisor / Manager) */}
      {isBranchScoped && (
        <div className="flex items-start gap-3 p-4 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
          <Building2 className="w-5 h-5 shrink-0 text-indigo-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
              คุณดูแล {managedBranches.length} สาขา
            </p>
            {managedBranches.length > 0 ? (
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                การมอบหมายสินค้าจะส่งให้พนักงานเฉพาะสาขาเหล่านี้:{" "}
                {managedBranches.map((b) => b.name).join(", ")}
              </p>
            ) : (
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                ยังไม่มีสาขาที่อยู่ในความดูแล จึงยังมอบหมายสินค้าไม่ได้
              </p>
            )}
          </div>
        </div>
      )}

      {/* Current Period Indicator */}
      <div
        className={`flex items-center gap-3 p-4 border rounded-xl ${
          temporaryOpenActive
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : isLockDay
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
        }`}
      >
        <Calendar
          className={`w-5 h-5 shrink-0 ${
            temporaryOpenActive
              ? "text-green-600"
              : isLockDay
                ? "text-red-600"
                : "text-blue-600"
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              temporaryOpenActive
                ? "text-green-800 dark:text-green-300"
                : isLockDay
                  ? "text-red-800 dark:text-red-300"
                  : "text-blue-800 dark:text-blue-300"
            }`}
          >
            📅 วันนี้:{" "}
            {now.toLocaleDateString("th-TH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              temporaryOpenActive
                ? "text-green-600 dark:text-green-400"
                : isLockDay
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {temporaryOpenActive
              ? `🟢 เปิดรับรูปชั่วคราวถึง ${formatOverrideDateTime(uploadOverride?.endAt)}`
              : isLockDay
                ? `🔒 วันล็อค — ระบบไม่รับรูปภาพทุกรอบในวันนี้`
                : `📸 รอบที่ ${currentHalf} ของเดือน (${currentHalf === 1 ? "วันที่ 2–15" : "วันที่ 17–สิ้นเดือน"}) — เปิดรับรูป`}
          </p>
          {temporaryOpenActive && overrideTargetLabel && (
            <p className="text-xs mt-1 text-green-700 dark:text-green-300">
              ผูกการส่งล่าช้ากับรอบ {overrideTargetLabel}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
            temporaryOpenActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
              : isLockDay
                ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          }`}
        >
          {temporaryOpenActive
            ? "เปิดชั่วคราว"
            : isLockDay
              ? "🔒 ล็อค"
              : `รอบ ${currentHalf}`}
        </span>
      </div>

      {/* Temporary upload override */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              เปิดรับรูปชั่วคราว
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ใช้ในกรณีวันล็อคหรือหมดเวลาส่งรูป
              แต่ต้องการให้มือถืออัปโหลดรูปได้ชั่วคราว
            </p>
          </div>
          {overrideLoading ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> โหลดสถานะ...
            </span>
          ) : temporaryOpenActive ? (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
              <CheckCircle className="w-3.5 h-3.5" /> กำลังเปิดรับรูปชั่วคราว
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Lock className="w-3.5 h-3.5" /> ยังไม่มี override ที่ใช้งานอยู่
            </span>
          )}
        </div>

        {!companyId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            ต้องอยู่ใน company context ก่อน จึงจะตั้งค่าเปิดรับรูปชั่วคราวได้
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  เปิดตั้งแต่
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatOverrideDateTime(uploadOverride?.startAt)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  เปิดถึง
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {formatOverrideDateTime(uploadOverride?.endAt)}
                </p>
              </div>
            </div>

            {uploadOverride?.reason ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  เหตุผลล่าสุด
                </p>
                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                  {uploadOverride.reason}
                </p>
                {uploadOverride.updatedByName && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    แก้ไขโดย {uploadOverride.updatedByName}
                  </p>
                )}
              </div>
            ) : null}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                รอบที่เปิดรับชั่วคราว
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {overrideTargetLabel || "ยังไม่กำหนด"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                พนักงานจะไม่เห็นชื่อรอบนี้ในมือถือ แต่ระบบจะผูก session
                และรายงานไว้กับรอบนี้
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ขอบเขตการเปิดรับชั่วคราว
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {overrideScopeLabel}
              </p>
              {overrideUserNames.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {overrideUserNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  เปิดสิทธิ์ให้ทุกคนในบริษัทส่งล่าช้าได้ ถ้าอยู่ในช่วงเวลา
                  override
                </p>
              )}
            </div>

            {canManageTemporaryOpen && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    เลือกรอบที่จะเปิดรับ (ส่งล่าช้า)
                  </label>
                  <select
                    value={
                      selectedTargetPeriodId ??
                      uploadOverride?.targetPeriodDocId ??
                      suggestedTargetPeriod?.id ??
                      ""
                    }
                    onChange={(e) => setSelectedTargetPeriodId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {pastPeriods.length === 0 && (
                      <option value="">ไม่พบรอบย้อนหลัง</option>
                    )}
                    {pastPeriods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {getPeriodLabel(period)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    เลือกให้ตรงกับรอบที่พนักงานมีงานค้าง —
                    งานที่มอบหมายไว้คนละรอบจะไม่แสดงในมือถือ
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      เปิดรับรูปถึงวันเวลา
                    </label>
                    <input
                      type="datetime-local"
                      value={temporaryOpenUntil}
                      onChange={(e) => setTemporaryOpenUntil(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      เหตุผล (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      value={temporaryOpenReason}
                      onChange={(e) => setTemporaryOpenReason(e.target.value)}
                      placeholder="เช่น เปิดเพิ่มสำหรับสรุปรอบค้าง"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      เปิดให้ใครบ้าง
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      ถ้าเลือกเฉพาะพนักงาน
                      ระบบจะเปิดสิทธิ์ส่งล่าช้าแค่คนที่เลือกเท่านั้น
                      คนอื่นยังถูกบล็อกตามปกติ
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRestrictToSelectedUsers(false)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!restrictToSelectedUsers ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
                    >
                      ทั้งบริษัท
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestrictToSelectedUsers(true)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${restrictToSelectedUsers ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
                    >
                      เฉพาะพนักงานที่เลือก
                    </button>
                  </div>

                  {restrictToSelectedUsers && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        เลือกพนักงานที่อนุญาตให้ส่งล่าช้าได้ในรอบนี้
                      </p>
                      {companyEmployees.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          ไม่พบรายชื่อพนักงานในบริษัทนี้
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto grid gap-2 pr-1">
                          {companyEmployees.map((employee) => {
                            const userKey = getUserIdentifier(employee);
                            const isChecked =
                              selectedLateUserIds.includes(userKey);
                            return (
                              <label
                                key={userKey}
                                className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    setSelectedLateUserIds((current) =>
                                      current.includes(userKey)
                                        ? current.filter((id) => id !== userKey)
                                        : [...current, userKey],
                                    )
                                  }
                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                    {employee.name ||
                                      employee.displayName ||
                                      employee.email}
                                  </span>
                                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                                    {employee.branchName || "ไม่ระบุสาขา"}
                                    {employee.email
                                      ? ` • ${employee.email}`
                                      : ""}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 lg:justify-end">
                  <button
                    onClick={handleEnableTemporaryOpen}
                    disabled={overrideSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {overrideSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                    เปิดชั่วคราว
                  </button>

                  <button
                    onClick={handleDisableTemporaryOpen}
                    disabled={overrideSaving || !uploadOverride?.enabled}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    ปิดทันที
                  </button>
                </div>
              </div>
            )}
          </>
        )}
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
                              disabled={
                                assigningPeriodId === period.id ||
                                (isBranchScoped && managedBranches.length === 0)
                              }
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

      {showAssignModal && (
        <AssignPreviewModal
          open={showAssignModal}
          title="มอบหมายสินค้าทั้งหมดให้พนักงานทุกคน"
          subtitle={assignContext?.label}
          loading={assignLoading}
          committing={assignCommitting}
          plan={assignPlan}
          onConfirm={handleConfirmAssign}
          onClose={() => {
            if (assignCommitting) return;
            setShowAssignModal(false);
            setAssignPlan(null);
            setAssignContext(null);
          }}
        />
      )}
    </div>
  );
}
