/**
 * API Route: GET /api/employee-photos
 *
 * Open API สำหรับให้ระบบภายนอกดึงข้อมูลรูปถ่ายจากพนักงาน (countingSessions)
 * Authentication: X-API-Key header (เหมือน phithan-eod)
 *
 * Query Params:
 *   branch_code, branch_id, branch_name, user_id, user_name,
 *   product_id, barcode, status, start_date, end_date,
 *   period_id, limit, offset
 */

import { adminDb } from "@/lib/firebase-admin";
import {
  getCorsHeaders,
  handleCorsOptions,
  withApiKeyAuth,
} from "@/lib/watson/api-utils";
import { NextRequest, NextResponse } from "next/server";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Parse watermark/location data from the `remarks` JSON string */
function parseLocationFromRemarks(remarks: unknown): {
  address?: string;
  latitude?: number;
  longitude?: number;
} | null {
  if (typeof remarks !== "string" || !remarks) return null;
  try {
    const parsed = JSON.parse(remarks);
    if (parsed.location || parsed.coordinates) {
      return {
        address: parsed.location ?? undefined,
        latitude: parsed.coordinates?.latitude ?? parsed.coordinates?.lat ?? undefined,
        longitude: parsed.coordinates?.longitude ?? parsed.coordinates?.lng ?? undefined,
      };
    }
  } catch {
    // Not JSON — ignore
  }
  return null;
}

/** Convert Firestore timestamp to ISO string */
function tsToISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

// ────────────────────────────────────────────────────────────
// OPTIONS — CORS preflight
// ────────────────────────────────────────────────────────────
export async function OPTIONS(): Promise<NextResponse> {
  return handleCorsOptions();
}

// ────────────────────────────────────────────────────────────
// GET /api/employee-photos
// ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  return withApiKeyAuth(req, async () => {
    try {
      const url = new URL(req.url);
      const p = (key: string) => url.searchParams.get(key) || undefined;

      // ── Parse query params ──────────────────────────────
      const branchCode = p("branch_code");
      const branchId = p("branch_id");
      const branchName = p("branch_name");
      const userId = p("user_id");
      const userName = p("user_name");
      const productId = p("product_id");
      const barcode = p("barcode");
      const status = p("status");
      const startDateStr = p("start_date");
      const endDateStr = p("end_date");
      const dateField = p("date_field") === "updatedAt" ? "updatedAt" : "createdAt";
      const periodId = p("period_id");

      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
        200,
      );
      const offset = Math.max(
        parseInt(url.searchParams.get("offset") || "0", 10),
        0,
      );

      // ── Resolve branch_code → branchId(s) ──────────────
      let resolvedBranchIds: string[] | null = null;

      if (branchCode) {
        const branchSnap = await adminDb
          .collection("branches")
          .where("code", "==", branchCode)
          .get();
        if (branchSnap.empty) {
          return NextResponse.json(
            {
              success: true,
              data: [],
              meta: { total: 0, limit, offset, returned: 0 },
            },
            { headers: getCorsHeaders() },
          );
        }
        resolvedBranchIds = branchSnap.docs.map((d) => d.id);
      }

      // ── Build Firestore query ───────────────────────────
      // Firestore allows max 1 inequality + limited compound queries,
      // so we apply what we can server-side and filter the rest in JS.
      let fsQuery: FirebaseFirestore.Query = adminDb.collection("countingSessions");

      // branchId filter (exact or resolved from code)
      const targetBranchId = branchId || (resolvedBranchIds?.length === 1 ? resolvedBranchIds[0] : null);
      if (targetBranchId) {
        fsQuery = fsQuery.where("branchId", "==", targetBranchId);
      } else if (resolvedBranchIds && resolvedBranchIds.length > 1) {
        // Firestore `in` supports up to 30 values
        fsQuery = fsQuery.where("branchId", "in", resolvedBranchIds.slice(0, 30));
      }

      if (userId) {
        fsQuery = fsQuery.where("userId", "==", userId);
      }

      if (productId) {
        fsQuery = fsQuery.where("productId", "==", productId);
      }

      if (barcode) {
        fsQuery = fsQuery.where("productSKU", "==", barcode);
      }

      if (status) {
        fsQuery = fsQuery.where("status", "==", status);
      }

      if (periodId) {
        fsQuery = fsQuery.where("periodId", "==", periodId);
      }

      // Date range
      const startDate = startDateStr ? new Date(startDateStr) : null;
      const endDate = endDateStr ? new Date(endDateStr) : null;

      if (startDate && !isNaN(startDate.getTime())) {
        fsQuery = fsQuery.where(dateField, ">=", startDate);
      }
      if (endDate && !isNaN(endDate.getTime())) {
        fsQuery = fsQuery.where(dateField, "<=", endDate);
      }

      // Order by chosen date field desc
      fsQuery = fsQuery.orderBy(dateField, "desc");

      // ── Execute query ───────────────────────────────────
      const snapshot = await fsQuery.get();

      // ── In-memory filters (branch_name, user_name — partial match) ──
      let docs = snapshot.docs;

      if (branchName) {
        const term = branchName.toLowerCase();
        docs = docs.filter((d) => {
          const bn = d.data().branchName;
          return typeof bn === "string" && bn.toLowerCase().includes(term);
        });
      }

      if (userName) {
        const term = userName.toLowerCase();
        docs = docs.filter((d) => {
          const un = d.data().userName;
          return typeof un === "string" && un.toLowerCase().includes(term);
        });
      }

      const total = docs.length;

      // ── Paginate ────────────────────────────────────────
      const paged = docs.slice(offset, offset + limit);

      // ── Batch-lookup user fullName + baCode ─────────────
      const uniqueUserIds = [...new Set(paged.map((d) => d.data().userId as string).filter(Boolean))];
      const userMap = new Map<string, { fullName?: string; baCode?: string }>();

      // Firestore `in` max 30 — batch if needed
      for (let i = 0; i < uniqueUserIds.length; i += 30) {
        const batch = uniqueUserIds.slice(i, i + 30);
        const usersSnap = await adminDb
          .collection("users")
          .where("uid", "in", batch)
          .get();
        usersSnap.forEach((u) => {
          const ud = u.data();
          const uid = (ud.uid as string) || u.id;
          userMap.set(uid, {
            fullName: typeof ud.fullName === "string" ? ud.fullName : undefined,
            baCode: typeof ud.baCode === "string" ? ud.baCode : undefined,
          });
        });
      }

      // ── Batch-lookup branch codes ───────────────────────
      const uniqueBranchIds = [...new Set(paged.map((d) => d.data().branchId as string).filter(Boolean))];
      const branchMap = new Map<string, { code?: string }>();

      for (let i = 0; i < uniqueBranchIds.length; i += 30) {
        const batch = uniqueBranchIds.slice(i, i + 30);
        // Use doc IDs directly
        const branchDocs = await Promise.all(
          batch.map((id) => adminDb.collection("branches").doc(id).get()),
        );
        branchDocs.forEach((bd) => {
          if (bd.exists) {
            const data = bd.data()!;
            branchMap.set(bd.id, {
              code: typeof data.code === "string" ? data.code : undefined,
            });
          }
        });
      }

      // ── Map results ─────────────────────────────────────
      const data = paged.map((docSnap) => {
        const d = docSnap.data();
        const uid = d.userId as string;
        const bid = d.branchId as string;
        const userInfo = userMap.get(uid);
        const branchInfo = branchMap.get(bid);
        const location = parseLocationFromRemarks(d.remarks);

        return {
          id: docSnap.id,
          imageUrl: d.imageUrl || d.imageURL || null,

          employee: {
            userId: uid,
            userName: d.userName ?? null,
            userEmail: d.userEmail ?? null,
            fullName: userInfo?.fullName ?? null,
            baCode: userInfo?.baCode ?? null,
          },

          branch: {
            branchId: bid,
            branchCode: branchInfo?.code ?? null,
            branchName: d.branchName ?? null,
            companyId: d.companyId ?? null,
          },

          product: {
            productId: d.productId ?? null,
            productName: d.productName ?? null,
            barcode: d.productSKU ?? null,
          },

          counting: {
            aiCount: d.aiCount ?? null,
            aiConfidence: d.aiConfidence ?? null,
            aiModel: d.aiModel ?? null,
            manualCount: d.manualCount ?? null,
            finalCount: d.finalCount ?? null,
            standardCount: d.standardCount ?? null,
            beforeCountQty: d.beforeCountQty ?? null,
            currentCountQty: d.currentCountQty ?? null,
            discrepancy: d.discrepancy ?? null,
            variance: d.variance ?? null,
            userReportedCount: d.userReportedCount ?? null,
            processingTime: d.processingTime ?? null,
          },

          detection: {
            barcodeMatch: d.barcodeMatch ?? null,
            matchedBarcode: d.matchedBarcode ?? null,
            detectedBarcodes: Array.isArray(d.detectedBarcodes)
              ? d.detectedBarcodes
              : null,
          },

          metadata: {
            status: d.status ?? null,
            periodId: d.periodId ?? null,
            periodMonth: d.periodMonth ?? null,
            periodHalf: d.periodHalf ?? null,
            isLate: d.isLate ?? false,
            isSupplemental: d.isSupplemental ?? false,
            deviceInfo: d.deviceInfo ?? null,
            appVersion: d.appVersion ?? null,
            assignmentId: d.assignmentId ?? null,
          },

          location: location ?? null,

          timestamps: {
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          },
        };
      });

      return NextResponse.json(
        {
          success: true,
          data,
          meta: {
            total,
            limit,
            offset,
            returned: data.length,
          },
        },
        { headers: getCorsHeaders() },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[employee-photos][GET]", message);
      return NextResponse.json(
        {
          success: false,
          error: {
            error: "Internal Server Error",
            message,
            code: "INTERNAL_ERROR",
          },
        },
        { status: 500, headers: getCorsHeaders() },
      );
    }
  });
}
