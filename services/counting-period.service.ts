import { db } from "@/config/firebase";
import type {
  CountingPeriod,
  CountingPeriodHalf,
  CountingPeriodStatus,
  UploadStatus,
} from "@/types";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

// ==================== Constants ====================
const GRACE_PERIOD_DAYS = 5;
const LOCK_DATES = [1, 16]; // วันที่ห้ามอัปโหลดทั้งวัน
const COLLECTION_NAME = "countingPeriods";

// ==================== Helper Functions ====================

/**
 * Get the last day of a month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Create a Date at midnight (00:00:00) for a specific date
 */
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if today is a lock date (1st or 16th of any month)
 */
export function isLockDate(date: Date = new Date()): boolean {
  return LOCK_DATES.includes(date.getDate());
}

/**
 * Get the current period half based on date
 */
export function getCurrentHalf(date: Date = new Date()): CountingPeriodHalf {
  const day = date.getDate();
  // วันที่ 1 = lock day (ตัดรอบก่อนหน้า) -> ถือว่าอยู่ในช่วง half 1 แต่ locked
  // วันที่ 2-15 = half 1 (เปิดถ่ายรูป)
  // วันที่ 16 = lock day (ตัดรอบ half 1) -> ถือว่าอยู่ในช่วง half 2 แต่ locked
  // วันที่ 17-31 = half 2 (เปิดถ่ายรูป)
  return day <= 15 ? 1 : 2;
}

// ==================== Core Service Functions ====================

/**
 * Get the current active counting period for a company
 */
export async function getCurrentPeriod(
  companyId: string,
): Promise<CountingPeriod | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const half = getCurrentHalf(now);

  const q = query(
    collection(db, COLLECTION_NAME),
    where("companyId", "==", companyId),
    where("year", "==", year),
    where("month", "==", month),
    where("half", "==", half),
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0];
  return { id: docSnap.id, ...docSnap.data() } as CountingPeriod;
}

/**
 * Determine upload status for a given date
 * This is the CORE logic for the lock/grace/open/closed system
 *
 * Rules:
 * - Day 1 or 16 → LOCKED (ห้ามอัปโหลดทุกรอบ)
 * - Within period dates → OPEN
 * - After endDate but within graceEndDate → GRACE (accept + tag "ส่งล่าช้า")
 * - After graceEndDate → CLOSED
 */
export function getUploadStatusForDate(
  date: Date,
  period: CountingPeriod | null,
): UploadStatus {
  // Rule 1: Lock on day 1 and 16
  if (isLockDate(date)) {
    return "locked";
  }

  // If no period found, default to open (for initial setup)
  if (!period) {
    return "open";
  }

  const dateMs = date.getTime();
  const startMs = period.startDate.toDate().getTime();
  const endMs = period.endDate.toDate().getTime();
  const graceEndMs = period.graceEndDate.toDate().getTime();

  // Rule 2: Within active period → OPEN
  if (dateMs >= startMs && dateMs <= endMs) {
    return "open";
  }

  // Rule 3: After endDate but within grace → GRACE (ลับ)
  if (dateMs > endMs && dateMs <= graceEndMs) {
    return "grace";
  }

  // Rule 4: After grace → CLOSED
  if (dateMs > graceEndMs) {
    return "closed";
  }

  // Before period start → check if it's a lock date (already handled) or closed
  return "closed";
}

/**
 * Check if a user can upload photos right now
 * Returns { canUpload, status, message }
 */
export async function canUploadPhoto(
  companyId: string,
  date: Date = new Date(),
): Promise<{
  canUpload: boolean;
  status: UploadStatus;
  message: string;
  isLateSubmission: boolean;
}> {
  const period = await getCurrentPeriod(companyId);
  const status = getUploadStatusForDate(date, period);

  switch (status) {
    case "locked":
      return {
        canUpload: false,
        status,
        message: "🔒 ระบบปิดรับรูปชั่วคราว กรุณากลับมาพรุ่งนี้",
        isLateSubmission: false,
      };

    case "open":
      return {
        canUpload: true,
        status,
        message: "",
        isLateSubmission: false,
      };

    case "grace":
      // Grace period: พนักงานเห็น "หมดเวลา" แต่ระบบยัง accept ได้
      // ห้ามแสดงว่ามี grace period — ส่งข้อความเดียวกับ closed
      return {
        canUpload: true,
        status,
        message: "⏰ หมดเวลาส่งรูปแล้ว",
        isLateSubmission: true,
      };

    case "closed":
      return {
        canUpload: false,
        status,
        message: "❌ หมดเวลาส่งรูปรอบนี้แล้ว",
        isLateSubmission: false,
      };

    default:
      return {
        canUpload: true,
        status: "open",
        message: "",
        isLateSubmission: false,
      };
  }
}

/**
 * Generate counting periods for an entire year for a company
 */
export async function generatePeriods(
  companyId: string,
  year: number,
): Promise<string[]> {
  const createdIds: string[] = [];

  for (let month = 1; month <= 12; month++) {
    const lastDay = getLastDayOfMonth(year, month);

    // Half 1: วันที่ 2-15 (วันที่ 1 = lock)
    const half1Start = createDate(year, month, 2);
    const half1End = createDate(year, month, 15);
    const half1LockDate = createDate(year, month, 1);
    const half1GraceEnd = addDays(half1End, GRACE_PERIOD_DAYS);

    const half1Doc = await addDoc(collection(db, COLLECTION_NAME), {
      companyId,
      year,
      month,
      half: 1 as CountingPeriodHalf,
      startDate: Timestamp.fromDate(half1Start),
      endDate: Timestamp.fromDate(half1End),
      lockDates: [Timestamp.fromDate(half1LockDate)],
      graceEndDate: Timestamp.fromDate(half1GraceEnd),
      status: "active" as CountingPeriodStatus,
      createdAt: Timestamp.now(),
    });
    createdIds.push(half1Doc.id);

    // Half 2: วันที่ 17-lastDay (วันที่ 16 = lock)
    const half2Start = createDate(year, month, 17);
    const half2End = createDate(year, month, lastDay);
    const half2LockDate = createDate(year, month, 16);
    const half2GraceEnd = addDays(half2End, GRACE_PERIOD_DAYS);

    const half2Doc = await addDoc(collection(db, COLLECTION_NAME), {
      companyId,
      year,
      month,
      half: 2 as CountingPeriodHalf,
      startDate: Timestamp.fromDate(half2Start),
      endDate: Timestamp.fromDate(half2End),
      lockDates: [Timestamp.fromDate(half2LockDate)],
      graceEndDate: Timestamp.fromDate(half2GraceEnd),
      status: "active" as CountingPeriodStatus,
      createdAt: Timestamp.now(),
    });
    createdIds.push(half2Doc.id);
  }

  return createdIds;
}

/**
 * Close a counting period (after grace period ends)
 */
export async function closePeriod(periodId: string): Promise<void> {
  const periodRef = doc(db, COLLECTION_NAME, periodId);
  await updateDoc(periodRef, {
    status: "closed" as CountingPeriodStatus,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get all periods for a company in a given year
 */
export async function getPeriodsForYear(
  companyId: string,
  year: number,
): Promise<CountingPeriod[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("companyId", "==", companyId),
    where("year", "==", year),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CountingPeriod)
    .sort((a, b) => {
      if (a.month !== b.month) return a.month - b.month;
      return a.half - b.half;
    });
}

/**
 * Get current period display label (e.g., "2-15 มี.ค. 2026")
 */
export function getPeriodLabel(period: CountingPeriod): string {
  const thaiMonths = [
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

  const start = period.startDate.toDate();
  const end = period.endDate.toDate();
  const monthName = thaiMonths[period.month] || "";

  return `${start.getDate()}-${end.getDate()} ${monthName} ${period.year + 543}`;
}
