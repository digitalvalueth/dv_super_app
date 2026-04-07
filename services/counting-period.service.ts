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
  getDoc,
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
const UPLOAD_OVERRIDE_COLLECTION = "countingUploadOverrides";

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
  targetHalf?: CountingPeriodHalf;
  targetPeriodLabel?: string;
  targetStartDate?: Timestamp;
  targetEndDate?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
  updatedByName?: string;
  createdAt?: Timestamp;
}

export interface EffectiveCountingPeriod {
  periodId: string; // e.g. 2026-03-H2
  periodMonth: string; // e.g. 2026-03
  periodHalf: CountingPeriodHalf;
  year: number;
  month: number;
  half: CountingPeriodHalf;
  label: string;
  isLateSubmission: boolean;
  isTemporaryOverride: boolean;
}

export interface UploadActorContext {
  userId?: string;
}

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

function getPeriodIdentity(
  year: number,
  month: number,
  half: CountingPeriodHalf,
): {
  periodId: string;
  periodMonth: string;
  periodHalf: CountingPeriodHalf;
} {
  const paddedMonth = String(month).padStart(2, "0");
  const periodMonth = `${year}-${paddedMonth}`;
  return {
    periodId: `${periodMonth}-H${half}`,
    periodMonth,
    periodHalf: half,
  };
}

function getPeriodIdentityFromPeriod(period: CountingPeriod) {
  return getPeriodIdentity(period.year, period.month, period.half);
}

function getPeriodLabelFromParts(
  year: number,
  month: number,
  half: CountingPeriodHalf,
): string {
  const startDay = half === 1 ? 2 : 17;
  const endDay = half === 1 ? 15 : getLastDayOfMonth(year, month);
  return `${startDay}-${endDay} ${
    [
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
    ][month]
  } ${year + 543}`;
}

function getGraceEndMs(period: CountingPeriod): number {
  return period.supervisorGraceEndDate
    ? (period.supervisorGraceEndDate as import("firebase/firestore").Timestamp)
        .toDate()
        .getTime()
    : period.graceEndDate.toDate().getTime();
}

async function getPeriodsForContext(
  companyId: string,
  date: Date = new Date(),
): Promise<CountingPeriod[]> {
  const year = date.getFullYear();
  const prevYear = date.getMonth() === 0 ? year - 1 : year;
  const yearsToQuery = year === prevYear ? [year] : [year, prevYear];

  const q = query(
    collection(db, COLLECTION_NAME),
    where("companyId", "==", companyId),
    where("year", "in", yearsToQuery),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as CountingPeriod,
  );
}

function getCurrentPeriodFromPeriods(
  periods: CountingPeriod[],
  date: Date = new Date(),
): CountingPeriod | null {
  const nowMs = date.getTime();
  let activePeriod: CountingPeriod | null = null;
  let gracePeriod: CountingPeriod | null = null;

  for (const period of periods) {
    const startMs = period.startDate.toDate().getTime();
    const endMs = period.endDate.toDate().getTime();
    const graceEndMs = getGraceEndMs(period);

    if (nowMs >= startMs && nowMs <= endMs) {
      activePeriod = period;
      break;
    }

    if (nowMs > endMs && nowMs <= graceEndMs) {
      gracePeriod = period;
    }
  }

  return activePeriod ?? gracePeriod ?? null;
}

function getDisplayPeriodFromPeriods(
  periods: CountingPeriod[],
  date: Date = new Date(),
): CountingPeriod | null {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const half = getCurrentHalf(date);

  return (
    periods.find(
      (period) =>
        period.year === year && period.month === month && period.half === half,
    ) ?? null
  );
}

function buildEffectivePeriodFromPeriod(
  period: CountingPeriod,
  options?: {
    isLateSubmission?: boolean;
    isTemporaryOverride?: boolean;
  },
): EffectiveCountingPeriod {
  const identity = getPeriodIdentityFromPeriod(period);
  return {
    ...identity,
    year: period.year,
    month: period.month,
    half: period.half,
    label: getPeriodLabel(period),
    isLateSubmission: options?.isLateSubmission ?? false,
    isTemporaryOverride: options?.isTemporaryOverride ?? false,
  };
}

function buildEffectivePeriodFromOverride(
  override: CountingUploadOverride,
): EffectiveCountingPeriod | null {
  if (
    !override.targetPeriodKey ||
    !override.targetYear ||
    !override.targetMonth ||
    !override.targetHalf
  ) {
    return null;
  }

  return {
    periodId: override.targetPeriodKey,
    periodMonth: getPeriodIdentity(
      override.targetYear,
      override.targetMonth,
      override.targetHalf,
    ).periodMonth,
    periodHalf: override.targetHalf,
    year: override.targetYear,
    month: override.targetMonth,
    half: override.targetHalf,
    label:
      override.targetPeriodLabel ||
      getPeriodLabelFromParts(
        override.targetYear,
        override.targetMonth,
        override.targetHalf,
      ),
    isLateSubmission: true,
    isTemporaryOverride: true,
  };
}

// ==================== Core Service Functions ====================

/**
 * Get the current active counting period for a company
 * Also checks if we're within the grace period of the previous period
 */
export async function getCurrentPeriod(
  companyId: string,
  date: Date = new Date(),
): Promise<CountingPeriod | null> {
  const periods = await getPeriodsForContext(companyId, date);
  return getCurrentPeriodFromPeriods(periods, date);
}

export async function getDisplayPeriod(
  companyId: string,
  date: Date = new Date(),
): Promise<CountingPeriod | null> {
  const periods = await getPeriodsForContext(companyId, date);
  return getDisplayPeriodFromPeriods(periods, date);
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
  // Supervisor can extend grace period beyond default 5 days
  const graceEndMs = (period.supervisorGraceEndDate as
    | import("firebase/firestore").Timestamp
    | undefined)
    ? (period.supervisorGraceEndDate as import("firebase/firestore").Timestamp)
        .toDate()
        .getTime()
    : period.graceEndDate.toDate().getTime();

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

async function getActiveUploadOverride(
  companyId: string,
  date: Date = new Date(),
  actorContext?: UploadActorContext,
): Promise<CountingUploadOverride | null> {
  const overrideRef = doc(db, UPLOAD_OVERRIDE_COLLECTION, companyId);
  const overrideSnap = await getDoc(overrideRef);

  if (!overrideSnap.exists()) {
    return null;
  }

  const override = overrideSnap.data() as CountingUploadOverride;

  if (!override.enabled || !override.endAt) {
    return null;
  }

  const nowMs = date.getTime();
  const startMs = override.startAt?.toDate().getTime() ?? 0;
  const endMs = override.endAt.toDate().getTime();

  if (nowMs < startMs || nowMs > endMs) {
    return null;
  }

  if (
    override.allowedUserIds?.length &&
    (!actorContext?.userId ||
      !override.allowedUserIds.includes(actorContext.userId))
  ) {
    return null;
  }

  return override;
}

function formatUploadOverrideMessage(override: CountingUploadOverride): string {
  const parts: string[] = [];

  if (override.endAt) {
    parts.push(
      `🟢 เปิดรับรูปชั่วคราวถึง ${override.endAt
        .toDate()
        .toLocaleString("th-TH", {
          dateStyle: "short",
          timeStyle: "short",
        })}`,
    );
  }

  if (override.reason?.trim()) {
    parts.push(`เหตุผล: ${override.reason.trim()}`);
  }

  return parts.join(" • ");
}

/**
 * Check if a user can upload photos right now
 * Returns { canUpload, status, message }
 */
export async function canUploadPhoto(
  companyId: string,
  date: Date = new Date(),
  actorContext?: UploadActorContext,
): Promise<{
  canUpload: boolean;
  status: UploadStatus;
  message: string;
  isLateSubmission: boolean;
  isTemporaryOverride?: boolean;
}> {
  const [period, uploadOverride] = await Promise.all([
    getCurrentPeriod(companyId, date),
    getActiveUploadOverride(companyId, date, actorContext),
  ]);
  const status = getUploadStatusForDate(date, period);

  if (uploadOverride) {
    return {
      canUpload: true,
      status: "open",
      message: formatUploadOverrideMessage(uploadOverride),
      isLateSubmission: status !== "open",
      isTemporaryOverride: true,
    };
  }

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

export async function getEffectiveCountingPeriod(
  companyId: string,
  date: Date = new Date(),
  actorContext?: UploadActorContext,
): Promise<EffectiveCountingPeriod | null> {
  const [periods, uploadOverride] = await Promise.all([
    getPeriodsForContext(companyId, date),
    getActiveUploadOverride(companyId, date, actorContext),
  ]);

  const overridePeriod = uploadOverride
    ? buildEffectivePeriodFromOverride(uploadOverride)
    : null;
  if (overridePeriod) {
    return overridePeriod;
  }

  const currentPeriod = getCurrentPeriodFromPeriods(periods, date);
  const uploadStatus = getUploadStatusForDate(date, currentPeriod);

  if (uploadStatus === "grace" && currentPeriod) {
    return buildEffectivePeriodFromPeriod(currentPeriod, {
      isLateSubmission: true,
      isTemporaryOverride: false,
    });
  }

  const displayPeriod = getDisplayPeriodFromPeriods(periods, date);
  if (displayPeriod) {
    return buildEffectivePeriodFromPeriod(displayPeriod, {
      isLateSubmission: false,
      isTemporaryOverride: false,
    });
  }

  if (currentPeriod) {
    return buildEffectivePeriodFromPeriod(currentPeriod, {
      isLateSubmission: uploadStatus !== "open",
      isTemporaryOverride: false,
    });
  }

  return null;
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
