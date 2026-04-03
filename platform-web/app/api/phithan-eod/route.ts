import { adminDb } from "@/lib/firebase-admin";
import {
  getCorsHeaders,
  handleCorsOptions,
  withApiKeyAuth,
} from "@/lib/watson/api-utils";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const COLLECTION = "phithanEodImports";

const toThaiISO = (date: Date): string => {
  const thai = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return thai.toISOString();
};

// OPTIONS /api/phithan-eod — CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return handleCorsOptions();
}

// POST /api/phithan-eod
// Body: { branchCode: string, data: object[], ...anything }
// Firestore doc ID = branchCode → POST ซ้ำ = overwrite doc เดิม
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

    const docRef = adminDb.collection(COLLECTION).doc(branchCode.trim());
    const existing = await docRef.get();
    const overwritten = existing.exists;

    const now = new Date();

    await docRef.set({
      branchCode: branchCode.trim(),
      data,
      ...rest,
      receivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      ...(overwritten ? {} : { createdAt: FieldValue.serverTimestamp() }),
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: branchCode.trim(),
          branchCode: branchCode.trim(),
          recordCount,
          receivedAt: toThaiISO(now),
          overwritten,
        },
      },
      { status: 201, headers: getCorsHeaders() },
    );
  });
}
