import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

// POST /api/internal/exports/[id]/confirm — confirm or unconfirm an export (no API key required)
export async function POST(
  req: NextRequest,
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

    const body = await req.json();
    const { action, confirmedBy, cancelledBy, cancelReason } = body;

    if (
      !action ||
      !["confirm", "unconfirm", "cancel", "uncancel"].includes(action)
    ) {
      return NextResponse.json(
        {
          error: {
            message:
              "Invalid action. Must be 'confirm', 'unconfirm', 'cancel', or 'uncancel'",
          },
        },
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

    const now = new Date().toISOString();
    let update: Record<string, unknown>;
    let newStatus: string;

    if (action === "confirm") {
      update = {
        status: "confirmed",
        confirmedAt: Timestamp.now(),
        confirmedBy: confirmedBy || null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      };
      newStatus = "confirmed";
    } else if (action === "cancel") {
      update = {
        status: "cancelled",
        cancelledAt: Timestamp.now(),
        cancelledBy: cancelledBy || null,
        cancelReason: cancelReason || null,
      };
      newStatus = "cancelled";
    } else if (action === "uncancel") {
      update = {
        status: "draft",
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      };
      newStatus = "draft";
    } else {
      // unconfirm
      update = {
        status: "draft",
        confirmedAt: null,
        confirmedBy: null,
      };
      newStatus = "draft";
    }

    await docRef.update(update);

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: newStatus,
        confirmedAt: action === "confirm" ? now : null,
        confirmedBy: action === "confirm" ? confirmedBy || null : null,
        cancelledAt: action === "cancel" ? now : null,
        cancelledBy: action === "cancel" ? cancelledBy || null : null,
        cancelReason: action === "cancel" ? cancelReason || null : null,
        message:
          action === "confirm"
            ? "Export confirmed successfully"
            : action === "cancel"
              ? "Export cancelled successfully"
              : action === "uncancel"
                ? "Export restored to draft"
                : "Export unconfirmed successfully",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/internal/exports/[id]/confirm:", error);
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
