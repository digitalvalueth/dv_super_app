import { adminDb, getAdminBucket } from "@/lib/firebase-admin";
import { COLLECTIONS, InvoiceStorageData } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, headers, data, meta } = body;

    if (!data || !fileName || !headers) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Create Firestore Document ID
    const collectionRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS);
    const docRef = collectionRef.doc();
    const docId = docRef.id;

    // 2. Upload to Firebase Storage
    const storagePath = `watson/invoice-uploads/${docId}.json`;
    const bucket = getAdminBucket();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;
    const file = bucket.file(storagePath);

    const storageData: InvoiceStorageData = {
      headers: headers,
      data: data,
    };
    const jsonString = JSON.stringify(storageData);

    await file.save(jsonString, {
      contentType: "application/json",
      metadata: {
        contentType: "application/json",
      },
    });

    const storageUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

    // 3. Save Metadata to Firestore
    await docRef.set({
      id: docId,
      fileName,
      uploadedAt: Timestamp.now(),
      rowCount: data.length,
      status: "uploaded", // Initial status
      storagePath,
      storageUrl,
      supplierCode: meta?.supplierCode || null,
      supplierName: meta?.supplierName || null,
      reportDate: meta?.reportDate || null,
      uploader: meta?.uploader || null,
    });

    return NextResponse.json({ id: docId, success: true });
  } catch (error) {
    console.error("Error in /api/watson/invoice-upload:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
