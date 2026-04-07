import { adminAuth, adminDb } from "@/lib/firebase-admin";
import {
  getCorsHeaders,
  handleCorsOptions,
  withApiKeyAuth,
} from "@/lib/watson/api-utils";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const COLLECTION = "phithanEodImports";

const normalizeSourceBranchCode = (value?: string | null): string =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeBranchCode = (value?: string | null): string => {
  const raw = (value || "").trim();
  const digitsOnly = raw.replace(/\D+/g, "");
  return digitsOnly || raw.replace(/\s+/g, "").toUpperCase();
};

const getEodDetails = (rawData: unknown): Record<string, unknown>[] => {
  if (Array.isArray(rawData)) {
    return rawData.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    );
  }

  if (typeof rawData === "object" && rawData !== null) {
    const details = (rawData as { details?: unknown }).details;
    if (Array.isArray(details)) {
      return details.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      );
    }
  }

  return [];
};

const normalizePayloadLocationId = (
  data: unknown,
): Record<string, unknown> | unknown => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return data;
  }

  const payload = { ...(data as Record<string, unknown>) };
  if (typeof payload.LocationID === "string") {
    payload.LocationID = normalizeBranchCode(payload.LocationID);
  }
  return payload;
};

const toThaiISO = (date: Date): string => {
  const thai = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return thai.toISOString();
};

// OPTIONS /api/phithan-eod — CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return handleCorsOptions();
}

// GET /api/phithan-eod
// Auth: Firebase Bearer token from platform-web
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: getCorsHeaders() },
      );
    }

    const token = authHeader.slice("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(token);
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
    const managedBranchIds = Array.isArray(userData.managedBranchIds)
      ? userData.managedBranchIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    const userBranchId =
      typeof userData.branchId === "string" ? userData.branchId : "";

    let branchesQuery = adminDb.collection("branches");
    if (companyId) {
      branchesQuery = branchesQuery.where("companyId", "==", companyId);
    }

    const branchesSnapshot = await branchesQuery.get();
    const allowedBranchIds =
      role === "manager" || role === "supervisor"
        ? new Set(
            managedBranchIds.length > 0
              ? managedBranchIds
              : userBranchId
                ? [userBranchId]
                : [],
          )
        : null;

    const branchCodeSet = new Set<string>();
    branchesSnapshot.forEach((branchDoc) => {
      if (allowedBranchIds && !allowedBranchIds.has(branchDoc.id)) return;

      const branchData = branchDoc.data();
      const normalizedCode = normalizeBranchCode(
        typeof branchData.code === "string" ? branchData.code : "",
      );
      if (normalizedCode) {
        branchCodeSet.add(normalizedCode);
      }
    });

    if (branchCodeSet.size === 0) {
      return NextResponse.json(
        { success: true, data: [] },
        { headers: getCorsHeaders() },
      );
    }

    const eodSnapshot = await adminDb.collection(COLLECTION).get();
    const data = eodSnapshot.docs
      .map((docSnap) => {
        const docData = docSnap.data();
        const rawBranchCode = String(
          docData.branchCode || docSnap.id || "",
        ).trim();
        const normalizedBranchCode = normalizeBranchCode(rawBranchCode);
        const normalizedCode = normalizeBranchCode(rawBranchCode);
        if (!branchCodeSet.has(normalizedCode)) return null;

        const payload = docData.data;
        const payloadRecord =
          typeof payload === "object" && payload !== null
            ? (payload as Record<string, unknown>)
            : undefined;

        return {
          id: docSnap.id,
          branchCode: normalizedBranchCode,
          location:
            typeof payloadRecord?.Location === "string"
              ? payloadRecord.Location
              : undefined,
          locationId:
            typeof payloadRecord?.LocationID === "string"
              ? normalizeBranchCode(payloadRecord.LocationID)
              : undefined,
          eodDateMax:
            typeof payloadRecord?.EOD_Date_MAX === "string"
              ? payloadRecord.EOD_Date_MAX
              : undefined,
          details: getEodDetails(payload),
          createdAt: docData.createdAt?.toDate?.()?.toISOString?.() ?? null,
          updatedAt: docData.updatedAt?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return NextResponse.json(
      { success: true, data },
      { headers: getCorsHeaders() },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[phithan-eod][GET]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: getCorsHeaders() },
    );
  }
}

// POST /api/phithan-eod
// Body: { branchCode: string, data: object[], ...anything }
// Firestore doc ID = source branchCode (e.g. "WL 3191")
// branchCode field inside the document = normalized numeric code (e.g. "3191")
export async function POST(req: NextRequest): Promise<NextResponse> {
  return withApiKeyAuth(req, async () => {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: "Bad Request",
            message: "Invalid JSON body.",
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    const { branchCode, data, ...rest } = body;

    if (!branchCode || typeof branchCode !== "string" || !branchCode.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: "Bad Request",
            message: "`branchCode` is required.",
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    if (!data || (typeof data !== "object" && !Array.isArray(data))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: "Bad Request",
            message: "`data` is required (object or array).",
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    // คำนวณ recordCount — รองรับทั้ง array และ object ที่มี details array
    const recordCount = Array.isArray(data)
      ? data.length
      : Array.isArray((data as Record<string, unknown>).details)
        ? ((data as Record<string, unknown>).details as unknown[]).length
        : 1;

    const rawBranchCode = normalizeSourceBranchCode(branchCode);
    const normalizedBranchCode = normalizeBranchCode(rawBranchCode);
    const normalizedData = normalizePayloadLocationId(data);

    const docRef = adminDb.collection(COLLECTION).doc(rawBranchCode);
    const existing = await docRef.get();
    const overwritten = existing.exists;

    const now = new Date();

    await docRef.set({
      branchCode: normalizedBranchCode,
      sourceBranchCode: rawBranchCode,
      data: normalizedData,
      ...rest,
      receivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(overwritten ? {} : { createdAt: FieldValue.serverTimestamp() }),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rawBranchCode,
          branchCode: normalizedBranchCode,
          sourceBranchCode: rawBranchCode,
          recordCount,
          receivedAt: toThaiISO(now),
          overwritten,
        },
      },
      { status: 201, headers: getCorsHeaders() },
    );
  });
}
