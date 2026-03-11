import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const docRef = adminDb.collection(COLLECTIONS.EXPORTS).doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return NextResponse.json(
      { success: false, error: { message: "Export not found" } },
      { status: 404 },
    );
  }

  const d = docSnap.data()!;

  const events: {
    type: "confirmed" | "unconfirmed" | "cancelled" | "restored";
    at: string;
    by?: string | null;
    reason?: string | null;
  }[] = [];

  if (d.confirmedAt) {
    events.push({
      type: "confirmed",
      at: d.confirmedAt.toDate().toISOString(),
      by: d.confirmedBy ?? null,
      reason: null,
    });
  }

  if (d.cancelledAt) {
    events.push({
      type: "cancelled",
      at: d.cancelledAt.toDate().toISOString(),
      by: d.cancelledBy ?? null,
      reason: d.cancelReason ?? null,
    });
  }

  // Sort chronologically
  events.sort((a, b) => a.at.localeCompare(b.at));

  return NextResponse.json({
    success: true,
    data: {
      exportedAt: d.exportedAt?.toDate().toISOString() ?? null,
      events,
    },
  });
}
