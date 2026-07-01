import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export type PeriodHalf = 1 | 2;

export interface ResolvedAssignPeriod {
  month: number;
  year: number;
  half: PeriodHalf;
  /** CountingPeriod doc id when known (from an active override), else null. */
  periodId: string | null;
  /** True when the period comes from an active "เปิดรับรูปชั่วคราว" override. */
  isTemporaryOverride: boolean;
}

/**
 * Resolves which counting period a company-wide "assign all" should target.
 *
 * When a temporary upload override (เปิดรับรูปชั่วคราว) is active, new assignments
 * MUST land on the override's target period (e.g. the reopened previous half-month),
 * because the mobile app resolves that same override-first period when listing
 * assignments (getEffectiveCountingPeriod). Stamping "today's" period instead makes
 * the freshly-assigned work invisible in the app on a period boundary (the 1st/16th).
 * Falls back to the current calendar period when no override is active.
 *
 * NOTE: the per-row "Auto-assign" button intentionally bypasses this — it already
 * targets an explicitly chosen period row.
 */
export async function resolveAssignPeriod(
  companyId: string,
  now: Date = new Date(),
): Promise<ResolvedAssignPeriod> {
  const fallback: ResolvedAssignPeriod = {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    half: now.getDate() <= 15 ? 1 : 2,
    periodId: null,
    isTemporaryOverride: false,
  };

  if (!companyId) return fallback;

  try {
    const snap = await getDoc(doc(db, "countingUploadOverrides", companyId));
    if (!snap.exists()) return fallback;

    const override = snap.data() as {
      enabled?: boolean;
      startAt?: { toDate: () => Date };
      endAt?: { toDate: () => Date };
      targetMonth?: number;
      targetYear?: number;
      targetHalf?: PeriodHalf;
      targetPeriodDocId?: string;
    };

    if (
      !override.enabled ||
      !override.endAt ||
      override.targetMonth == null ||
      override.targetYear == null ||
      override.targetHalf == null
    ) {
      return fallback;
    }

    const nowMs = now.getTime();
    const startMs = override.startAt?.toDate().getTime() ?? 0;
    const endMs = override.endAt.toDate().getTime();
    if (nowMs < startMs || nowMs > endMs) return fallback;

    return {
      month: override.targetMonth,
      year: override.targetYear,
      half: override.targetHalf,
      periodId: override.targetPeriodDocId ?? null,
      isTemporaryOverride: true,
    };
  } catch (error) {
    console.error(
      "resolveAssignPeriod failed; falling back to current period",
      error,
    );
    return fallback;
  }
}

export interface AssignPlanRow {
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  branchId: string;
  branchName: string;
  isExisting: boolean;
  existingId?: string;
}

export interface AssignPlan {
  productIds: string[];
  rows: AssignPlanRow[];
  newCount: number;
  updateCount: number;
}

interface BuildAssignPlanParams {
  companyId: string;
  month: number;
  year: number;
  half: PeriodHalf;
  /**
   * Optional branch scope. When provided, only employees whose assigned
   * branch is included in this list will be planned. When omitted (undefined),
   * all branches are included. An empty array results in no assignments.
   */
  branchIds?: string[];
}

/**
 * Builds an assignment plan (preview) without writing anything.
 * Canonical logic shared by the products page, counting-periods page and
 * the supervisor bulk-assign API so all "assign all" buttons stay in sync.
 */
export async function buildAssignPlan({
  companyId,
  month,
  year,
  half,
  branchIds,
}: BuildAssignPlanParams): Promise<AssignPlan> {
  if (!companyId) {
    throw new Error("ไม่พบ companyId");
  }

  const branchScope = Array.isArray(branchIds)
    ? new Set(branchIds.filter(Boolean))
    : null;

  // 1. Get all product IDs for this company
  const productsSnap = await getDocs(
    query(collection(db, "products"), where("companyId", "==", companyId)),
  );
  const productIds = productsSnap.docs
    .map((d) => (d.data().productId as string) || d.id)
    .filter(Boolean);

  // 2. Get all employees in this company (no status filter — match canonical)
  const usersSnap = await getDocs(
    query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "==", "employee"),
    ),
  );

  const rows: AssignPlanRow[] = [];
  let newCount = 0;
  let updateCount = 0;

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data();
    const userId = userDoc.id;

    // รองรับพนักงานหลายสาขา: ใช้ branchIds array ถ้ามี, fallback เป็น branchId เดียว
    const empBranchIds: string[] =
      user.branchIds && user.branchIds.length > 0
        ? user.branchIds
        : [user.branchId || ""];
    const empBranchNames: Record<string, string> = user.branchNames || {};

    for (const branchId of empBranchIds) {
      if (branchScope && !branchScope.has(branchId)) continue;

      // Check if assignment already exists for this month/year/half/branchId
      const existingSnap = await getDocs(
        query(
          collection(db, "assignments"),
          where("userId", "==", userId),
          where("month", "==", month),
          where("year", "==", year),
          where("half", "==", half),
          where("branchId", "==", branchId),
        ),
      );

      const isExisting = !existingSnap.empty;
      if (isExisting) {
        updateCount++;
      } else {
        newCount++;
      }

      rows.push({
        userId,
        userName:
          user.fullName || user.name || user.displayName || user.email || "",
        userEmail: user.email || "",
        companyId: user.companyId,
        branchId,
        branchName: empBranchNames[branchId] || user.branchName || "",
        isExisting,
        existingId: isExisting ? existingSnap.docs[0].id : undefined,
      });
    }
  }

  return { productIds, rows, newCount, updateCount };
}

interface CommitParams {
  month: number;
  year: number;
  half: PeriodHalf;
}

/**
 * Commits a previously-built assignment plan. Existing assignments are reset
 * (progress cleared, new round) and new ones are created with full fields.
 */
export async function commitAssignPlan(
  plan: AssignPlan,
  { month, year, half }: CommitParams,
): Promise<{ created: number; updated: number }> {
  const { productIds, rows } = plan;
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (row.isExisting && row.existingId) {
      await updateDoc(doc(db, "assignments", row.existingId), {
        productIds,
        productCount: productIds.length,
        completedProductIds: [],
        inProgressProductIds: [],
        notAvailableProductIds: [],
        completedCount: 0,
        status: "pending",
        updatedAt: serverTimestamp(),
      });
      updated++;
    } else {
      await addDoc(collection(db, "assignments"), {
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        companyId: row.companyId,
        branchId: row.branchId,
        branchName: row.branchName,
        productIds,
        productCount: productIds.length,
        month,
        year,
        half,
        status: "pending",
        completedCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
    }
  }

  return { created, updated };
}
