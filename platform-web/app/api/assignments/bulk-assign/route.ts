import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

interface PlanRow {
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  branchId: string;
  branchName: string;
  isExisting: boolean;
  existingId?: string;
}

/**
 * POST /api/assignments/bulk-assign
 * Assign all products to all employees in a company, scoped by branch.
 *
 * Body: { month, year, half, companyId, branchIds?, dryRun? }
 * - branchIds: optional branch scope. When provided, only employees whose
 *   assigned branch is in the list are planned. Omit for all branches; an
 *   empty array results in no assignments.
 * - dryRun: when true, returns the plan without writing anything (preview).
 *
 * Logic kept in sync with platform-web/lib/assign-products.ts so all
 * "assign all" buttons produce identical results.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year, half, companyId, branchIds, dryRun } = body;

    if (!month || !year || !half) {
      return NextResponse.json(
        { error: "Month, year, and half are required" },
        { status: 400 },
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 },
      );
    }

    const db = adminDb;
    const branchScope = Array.isArray(branchIds)
      ? new Set<string>((branchIds as string[]).filter(Boolean))
      : null;

    // 1. Get all product IDs for this company
    const productsSnapshot = await db
      .collection("products")
      .where("companyId", "==", companyId)
      .get();
    const productIds = productsSnapshot.docs
      .map((doc) => (doc.data().productId as string) || doc.id)
      .filter(Boolean);

    // 2. Get all employees in this company (no status filter — match canonical)
    const employeesSnapshot = await db
      .collection("users")
      .where("companyId", "==", companyId)
      .where("role", "==", "employee")
      .get();

    const rows: PlanRow[] = [];
    let newCount = 0;
    let updateCount = 0;

    for (const userDoc of employeesSnapshot.docs) {
      const user = userDoc.data() as any;
      const userId = userDoc.id;

      const empBranchIds: string[] =
        user.branchIds && user.branchIds.length > 0
          ? user.branchIds
          : [user.branchId || ""];
      const empBranchNames: Record<string, string> = user.branchNames || {};

      for (const branchId of empBranchIds) {
        if (branchScope && !branchScope.has(branchId)) continue;

        const existingSnap = await db
          .collection("assignments")
          .where("userId", "==", userId)
          .where("month", "==", month)
          .where("year", "==", year)
          .where("half", "==", half)
          .where("branchId", "==", branchId)
          .limit(1)
          .get();

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

    // Preview only
    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          plan: { productIds, rows, newCount, updateCount },
        },
        { status: 200 },
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: "No employees to assign for the given branch scope",
          created: 0,
          updated: 0,
          productCount: productIds.length,
        },
        { status: 200 },
      );
    }

    // 3. Commit in chunks (Firestore batch limit is 500)
    const CHUNK = 400;
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = db.batch();
      const chunk = rows.slice(i, i + CHUNK);

      for (const row of chunk) {
        if (row.isExisting && row.existingId) {
          const ref = db.collection("assignments").doc(row.existingId);
          batch.update(ref, {
            productIds,
            productCount: productIds.length,
            completedProductIds: [],
            inProgressProductIds: [],
            notAvailableProductIds: [],
            completedCount: 0,
            status: "pending",
            updatedAt: FieldValue.serverTimestamp(),
          });
          updated++;
        } else {
          const ref = db.collection("assignments").doc();
          batch.set(ref, {
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
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          created++;
        }
      }

      await batch.commit();
    }

    return NextResponse.json(
      {
        success: true,
        message: `Created ${created}, updated ${updated} assignments`,
        created,
        updated,
        productCount: productIds.length,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error creating bulk assignments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create bulk assignments" },
      { status: 500 },
    );
  }
}
