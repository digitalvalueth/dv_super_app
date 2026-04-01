import { adminDb, getAdminBucket } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

// Return a Date shifted to Thai time (UTC+7), keeping Z suffix for plain timestamp display
const toThaiISO = (date: Date): string => {
  const thai = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return thai.toISOString();
};

// Normalize slash-format date strings to DD/MM/YYYY
// Handles: "1/3/26" → "01/03/2026", already "01/03/2026" → unchanged
// Other formats (e.g. "08-JAN-0026") are returned as-is
function normalizeDateStr(val: unknown): unknown {
  if (typeof val !== "string") return val;
  const s = val.trim();

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

  // D/M/YY or D/M/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, "0");
    const mm = slashMatch[2].padStart(2, "0");
    let yyyy = parseInt(slashMatch[3], 10);
    if (yyyy < 100) yyyy += 2000;
    return `${dd}/${mm}/${yyyy}`;
  }

  return val;
}

function normalizeDatesInRows(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const dateKey = Object.keys(row).find((k) => k.toLowerCase() === "date");
    if (!dateKey) return row;
    return { ...row, [dateKey]: normalizeDateStr(row[dateKey]) };
  });
}

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
      try {
        const bucket = getAdminBucket();
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

    return NextResponse.json({
      success: true,
      data: {
        ...d,
        id: docSnap.id,
        exportedAt: d.exportedAt?.toDate?.().toISOString() || null,
        confirmedAt: d.confirmedAt ? toThaiISO(d.confirmedAt.toDate()) : null,
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

    const now = toThaiISO(new Date());
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
