import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

// GET /api/watson/promotion-upload-history - list records newest first
export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

    const snapshot = await adminDb
      .collection(COLLECTIONS.PROMOTION_UPLOAD_HISTORY)
      .orderBy("uploadedAt", "desc")
      .limit(limit)
      .get();

    const records = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        ...d,
        id: doc.id,
        uploadedAt:
          d.uploadedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("Error listing promotion upload history:", error);
    return NextResponse.json(
      { error: "Failed to list history" },
      { status: 500 },
    );
  }
}

// POST /api/watson/promotion-upload-history - create a record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, itemCount, added, updated, duplicate, uploader } = body;

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 },
      );
    }

    const docRef = adminDb
      .collection(COLLECTIONS.PROMOTION_UPLOAD_HISTORY)
      .doc();

    await docRef.set({
      fileName,
      itemCount: itemCount ?? 0,
      added: added ?? 0,
      updated: updated ?? 0,
      duplicate: duplicate ?? 0,
      uploadedAt: new Date(),
      hasFile: false,
      ...(uploader ? { uploader } : {}),
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error("Error creating promotion upload record:", error);
    return NextResponse.json(
      { error: "Failed to create record" },
      { status: 500 },
    );
  }
}
