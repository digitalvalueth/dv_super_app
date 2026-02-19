import { NextRequest, NextResponse } from "next/server";
import { getExport, confirmExport, unconfirmExport } from "@/lib/watson-firebase";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/internal/exports/:id/confirm
 * Internal endpoint for confirming/unconfirming exports
 * Does NOT require API key (for client-side usage)
 *
 * Body:
 * - action: "confirm" | "unconfirm"
 * - confirmedBy?: string (optional)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { action, confirmedBy } = body as {
      action: "confirm" | "unconfirm";
      confirmedBy?: string;
    };

    if (!action || !["confirm", "unconfirm"].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Invalid action. Must be 'confirm' or 'unconfirm'",
            code: "VALIDATION_ERROR",
          },
        },
        { status: 400 },
      );
    }

    // Check if export exists
    const exportDoc = await getExport(id);
    if (!exportDoc) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Export not found", code: "NOT_FOUND" },
        },
        { status: 404 },
      );
    }

    // Perform the action
    if (action === "confirm") {
      await confirmExport(id, confirmedBy);
    } else {
      await unconfirmExport(id);
    }

    // Get updated document
    const updatedExport = await getExport(id);

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: action === "confirm" ? "confirmed" : "draft",
        confirmedAt: updatedExport?.confirmedAt?.toDate().toISOString() || null,
        confirmedBy: updatedExport?.confirmedBy || null,
        message:
          action === "confirm"
            ? "Export confirmed successfully"
            : "Export reverted to draft",
      },
    });
  } catch (error) {
    console.error("Error updating export:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Failed to update export",
          code: "UPDATE_EXPORT_ERROR",
        },
      },
      { status: 500 },
    );
  }
}
