import { adminDb, getAdminBucket } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

// POST /api/exports — create a new export record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      supplierCode,
      supplierName,
      reportDate,
      fileName,
      headers,
      data,
      summary,
      passedCount,
      lowConfidenceCount,
      metadata,
      companyId,
      companyName,
    } = body;

    if (!supplierCode || !headers || !data) {
      return NextResponse.json(
        {
          error: {
            message: "Missing required fields: supplierCode, headers, data",
          },
        },
        { status: 400 },
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: { message: "Storage bucket not configured" } },
        { status: 500 },
      );
    }

    // 1. Create Firestore doc ref to get ID
    const collectionRef = adminDb.collection(COLLECTIONS.EXPORTS);
    const docRef = collectionRef.doc();
    const docId = docRef.id;

    // 2. Convert array-of-arrays to array-of-objects for storage
    const rowObjects: Record<string, unknown>[] = (
      data as (string | number | null)[][]
    ).map((row) => {
      const obj: Record<string, unknown> = {};
      (headers as string[]).forEach((header, i) => {
        obj[header] = row[i] ?? null;
      });
      return obj;
    });

    // 3. Upload data to Firebase Storage
    const storagePath = `watson/exports/${docId}.json`;
    const bucket = getAdminBucket();
    const file = bucket.file(storagePath);

    await file.save(JSON.stringify({ headers, data: rowObjects }), {
      contentType: "application/json",
      metadata: { contentType: "application/json" },
    });

    const storageUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

    // 4. Save metadata to Firestore
    const now = Timestamp.now();
    await docRef.set({
      id: docId,
      supplierCode: String(supplierCode),
      supplierName: supplierName || String(supplierCode),
      fileName: fileName || null,
      reportDate: reportDate || null,
      exportedAt: now,
      status: "draft",
      confirmedAt: null,
      confirmedBy: null,
      rowCount: (data as unknown[]).length,
      passedCount: passedCount ?? (data as unknown[]).length,
      lowConfidenceCount: lowConfidenceCount ?? 0,
      summary: summary || {},
      headers,
      metadata: metadata || null,
      storagePath,
      storageUrl,
      companyId: companyId || null,
      companyName: companyName || null,
    });

    return NextResponse.json({ success: true, data: { id: docId } });
  } catch (error) {
    console.error("Error in POST /api/exports:", error);
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

// GET /api/exports — list exports with optional filters
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const supplierCode = searchParams.get("supplier_code");
    const status = searchParams.get("status");
    const confirmedStart = searchParams.get("confirmed_start_date");
    const confirmedEnd = searchParams.get("confirmed_end_date");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100,
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const companyIdFilter = searchParams.get("companyId");

    let query = adminDb
      .collection(COLLECTIONS.EXPORTS)
      .orderBy("exportedAt", "desc") as FirebaseFirestore.Query;

    if (companyIdFilter) {
      query = query.where("companyId", "==", companyIdFilter);
    }
    if (supplierCode) {
      query = query.where("supplierCode", "==", supplierCode);
    }
    if (status) {
      query = query.where("status", "==", status);
    }
    if (confirmedStart) {
      query = query.where(
        "confirmedAt",
        ">=",
        Timestamp.fromDate(new Date(confirmedStart)),
      );
    }
    if (confirmedEnd) {
      query = query.where(
        "confirmedAt",
        "<=",
        Timestamp.fromDate(new Date(confirmedEnd)),
      );
    }
    if (startDate) {
      query = query.where(
        "exportedAt",
        ">=",
        Timestamp.fromDate(new Date(startDate)),
      );
    }
    if (endDate) {
      query = query.where(
        "exportedAt",
        "<=",
        Timestamp.fromDate(new Date(endDate)),
      );
    }

    const countSnap = await query.count().get();
    const total = countSnap.data().count;

    const snap = await query.limit(limit).offset(offset).get();

    const records = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        ...d,
        id: doc.id,
        exportedAt: d.exportedAt?.toDate?.().toISOString() || null,
        confirmedAt: d.confirmedAt?.toDate?.().toISOString() || null,
        // Omit data/storagePath from list response
        data: undefined,
        storagePath: undefined,
        storageUrl: undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: records,
      meta: { total, limit, offset },
    });
  } catch (error) {
    console.error("Error in GET /api/exports:", error);
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
