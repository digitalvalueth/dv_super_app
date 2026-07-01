import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCorsHeaders } from "@/lib/watson/api-utils";
import { NextRequest, NextResponse } from "next/server";

function tsToISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() },
      );
    }
    let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decoded = await adminAuth.verifyIdToken(
        authHeader.slice("Bearer ".length),
      );
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401, headers: getCorsHeaders() },
      );
    }
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404, headers: getCorsHeaders() },
      );
    }
    const userData = userDoc.data() || {};
    const companyId =
      typeof userData.companyId === "string" ? userData.companyId : "";
    const role = typeof userData.role === "string" ? userData.role : "employee";
    const userBranchId =
      typeof userData.branchId === "string" ? userData.branchId : "";
    const managedBranchIds = Array.isArray(userData.managedBranchIds)
      ? userData.managedBranchIds.filter((v): v is string => typeof v === "string")
      : [];

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "No company scope" },
        { status: 403, headers: getCorsHeaders() },
      );
    }

    let q: FirebaseFirestore.Query = adminDb
      .collection("shopStockReceives")
      .where("companyId", "==", companyId)
      .orderBy("receivedAt", "desc");

    const url = new URL(req.url);
    const branchCode = url.searchParams.get("branch_code") || undefined;
    if (branchCode) q = q.where("branchCode", "==", branchCode);

    const snapshot = await q.get();

    // branch-scope สำหรับ manager/supervisor
    const allowed =
      role === "manager" || role === "supervisor"
        ? new Set(
            managedBranchIds.length > 0
              ? managedBranchIds
              : userBranchId
                ? [userBranchId]
                : [],
          )
        : null;

    const data = snapshot.docs
      .map((docSnap) => {
        const d = docSnap.data();
        if (allowed && !allowed.has(d.branchId)) return null;
        return {
          id: docSnap.id,
          transferNumber: d.transferNumber ?? null,
          branchCode: d.branchCode ?? null,
          branchName: d.branchName ?? null,
          receiverName: d.receivedByName ?? null,
          totalItems: d.totalItems ?? 0,
          imageUrl: d.imageUrl ?? null,
          syncStatus: d.syncStatus ?? null,
          items: d.items ?? [],
          receivedAt: tsToISO(d.receivedAt),
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json(
      { success: true, data },
      { headers: getCorsHeaders() },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/shop-stock-receive][GET]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}
