
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { COLLECTIONS, PriceImportStorageData } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, source, data, itemCount } = body;

    if (!data || !fileName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return NextResponse.json(
        { error: "Storage bucket not configured" },
        { status: 500 }
      );
    }

    // 1. Create Firestore Document ID
    const collectionRef = adminDb.collection(COLLECTIONS.PRICE_IMPORT_HISTORY);
    const docRef = collectionRef.doc();
    const docId = docRef.id;

    // 2. Upload to Firebase Storage
    const storagePath = `watson/price-imports/${docId}.json`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    const storageData: PriceImportStorageData = { data };
    const jsonString = JSON.stringify(storageData);
    
    await file.save(jsonString, {
      contentType: "application/json",
      metadata: {
        contentType: "application/json",
      },
    });

    // 3. Get Signed URL (optional, or just store path)
    // For now we store path and construct a "virtual" URL or just use path
    // The client expects `storageUrl` but since we are proxying, we can store just path.
    // To match existing schema, we can try to generate a signed URL or just public URL if allowed.
    // But since we proxy, let's store the path and use it in GET /{id}.
    // However, existing hook code expects `storageUrl`.
    // Let's store a reference URL for compatibility.
    const storageUrl = `https://storage.googleapis.com/${bucketName}/${storagePath}`;

    // 4. Save Metadata to Firestore
    await docRef.set({
      id: docId,
      fileName,
      importedAt: Timestamp.now(),
      itemCount: itemCount || data.length,
      source: source || "excel",
      storagePath,
      storageUrl,
    });

    return NextResponse.json({ id: docId, success: true });

  } catch (error) {
    console.error("Error in /api/watson/import-price-list:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
