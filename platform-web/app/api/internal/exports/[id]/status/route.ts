import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/internal/exports/[id]/status
 * Lightweight endpoint to check the current status of an export.
 * Used by the validator page to reconcile invoice upload records
 * when opening a previously-confirmed file.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: "Missing ID" } },
        { status: 400 },
      );
    }

    const docRef = adminDb.collection(COLLECTIONS.EXPORTS).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: { message: "Export not found" } },
        { status: 404 },
      );
    }

    const data = docSnap.data()!;

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: data.status || "draft",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/internal/exports/[id]/status:", error);
    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error ? error.message : "Internal Server Error",
        },
      },
      { status: 500 },
    );
  }
}
