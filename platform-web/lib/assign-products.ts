import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export type PeriodHalf = 1 | 2;

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
