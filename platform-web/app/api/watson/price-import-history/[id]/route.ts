
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

// GET /api/watson/price-import-history/[id] - Returns the DATA content (JSON)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const docRef = adminDb.collection(COLLECTIONS.PRICE_IMPORT_HISTORY).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const data = docSnap.data();
    const storagePath = data?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: "No storage path found" }, { status: 404 });
    }

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new Error("Storage bucket not configured");

    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
       return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    const [content] = await file.download();
    const jsonContent = JSON.parse(content.toString("utf-8"));
    
    // Return the data array from the wrapped content { data: [...] }
    return NextResponse.json(jsonContent.data || []);

  } catch (error) {
    console.error(`Error fetching data for ${await (await params).id}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch data content" },
      { status: 500 }
    );
  }
}

// DELETE /api/watson/price-import-history/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const docRef = adminDb.collection(COLLECTIONS.PRICE_IMPORT_HISTORY).doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const storagePath = data?.storagePath;

      if (storagePath) {
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
         if (bucketName) {
            const bucket = adminStorage.bucket(bucketName);
            const file = bucket.file(storagePath);
            await file.delete().catch(err => console.warn("Failed to delete file from storage:", err));
         }
      }
      
      await docRef.delete();
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting record:", error);
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 }
    );
  }
}
