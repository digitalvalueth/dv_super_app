import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

// GET /api/exports/[id] — fetch export detail including all row data
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

    const d = docSnap.data()!;

    // Load row data from storage
    let rowData: Record<string, unknown>[] = [];
    if (d.storagePath) {
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (bucketName) {
        try {
          const bucket = adminStorage.bucket(bucketName);
          const file = bucket.file(d.storagePath);
          const [exists] = await file.exists();
          if (exists) {
            const [content] = await file.download();
            const parsed = JSON.parse(content.toString("utf-8"));
            rowData = parsed.data || [];
          }
        } catch (err) {
          console.warn("Failed to load export data from storage:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...d,
        id: docSnap.id,
        exportedAt: d.exportedAt?.toDate?.().toISOString() || null,
        confirmedAt: d.confirmedAt?.toDate?.().toISOString() || null,
        data: rowData,
        storagePath: undefined,
        storageUrl: undefined,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/exports/[id]:", error);
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

// PATCH /api/exports/[id] — confirm or unconfirm an export
export async function PATCH(
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
    const { action, confirmedBy } = body;

    if (!action || !["confirm", "unconfirm"].includes(action)) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid action. Must be 'confirm' or 'unconfirm'",
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

    if (action === "confirm") {
      update = {
        status: "confirmed",
        confirmedAt: Timestamp.now(),
        confirmedBy: confirmedBy || null,
      };
    } else {
      update = {
        status: "draft",
        confirmedAt: null,
        confirmedBy: null,
      };
    }

    await docRef.update(update);

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: action === "confirm" ? "confirmed" : "draft",
        confirmedAt: action === "confirm" ? now : null,
        confirmedBy: action === "confirm" ? confirmedBy || null : null,
        message:
          action === "confirm"
            ? "Export confirmed successfully"
            : "Export unconfirmed successfully",
      },
    });
  } catch (error) {
    console.error("Error in PATCH /api/exports/[id]:", error);
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
