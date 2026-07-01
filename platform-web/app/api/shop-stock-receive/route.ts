import { adminDb } from "@/lib/firebase-admin";
import {
  getCorsHeaders,
  handleCorsOptions,
  withApiKeyAuth,
} from "@/lib/watson/api-utils";
import { NextRequest, NextResponse } from "next/server";

function tsToISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

export async function OPTIONS(): Promise<NextResponse> {
  return handleCorsOptions();
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return withApiKeyAuth(req, async () => {
    try {
      const url = new URL(req.url);
      const p = (k: string) => url.searchParams.get(k) || undefined;

      const companyId = p("company_id");
      const branchId = p("branch_id");
      const branchCode = p("branch_code");
      const transferNumber = p("transfer_number");
      const startDateStr = p("start_date");
      const endDateStr = p("end_date");

      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
        200,
      );
      const offset = Math.max(
        parseInt(url.searchParams.get("offset") || "0", 10),
        0,
      );

      let q: FirebaseFirestore.Query = adminDb.collection("shopStockReceives");
      if (companyId) q = q.where("companyId", "==", companyId);
      if (branchId) q = q.where("branchId", "==", branchId);
      if (branchCode) q = q.where("branchCode", "==", branchCode);
      if (transferNumber) q = q.where("transferNumber", "==", transferNumber);

      const startDate = startDateStr ? new Date(startDateStr) : null;
      const endDate = endDateStr ? new Date(endDateStr) : null;
      if (startDate && !isNaN(startDate.getTime()))
        q = q.where("receivedAt", ">=", startDate);
      if (endDate && !isNaN(endDate.getTime()))
        q = q.where("receivedAt", "<=", endDate);

      q = q.orderBy("receivedAt", "desc");

      const snapshot = await q.get();
      const total = snapshot.docs.length;
      const paged = snapshot.docs.slice(offset, offset + limit);

      const data = paged.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          transferNumber: d.transferNumber ?? null,
          branchCode: d.branchCode ?? null,
          branchId: d.branchId ?? null,
          branchName: d.branchName ?? null,
          companyId: d.companyId ?? null,
          receiver: {
            userId: d.receivedBy ?? null,
            name: d.receivedByName ?? null,
            email: d.receivedByEmail ?? null,
          },
          items: Array.isArray(d.items)
            ? d.items.map((it: Record<string, unknown>) => ({
                barcode: it.barcode ?? null,
                sku: it.sku ?? null,
                productName: it.productName ?? null,
                salesQty: it.salesQty ?? 0,
                testQty: it.testQty ?? 0,
                mktQty: it.mktQty ?? 0,
              }))
            : [],
          totalItems: d.totalItems ?? 0,
          imageUrl: d.imageUrl ?? null,
          watermark: d.watermarkData ?? null,
          notes: d.notes ?? null,
          syncStatus: d.syncStatus ?? null,
          receivedAt: tsToISO(d.receivedAt),
          createdAt: tsToISO(d.createdAt),
        };
      });

      return NextResponse.json(
        { success: true, data, meta: { total, limit, offset, returned: data.length } },
        { headers: getCorsHeaders() },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[shop-stock-receive][GET]", message);
      return NextResponse.json(
        { success: false, error: { error: "Internal Server Error", message, code: "INTERNAL_ERROR" } },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  });
}
