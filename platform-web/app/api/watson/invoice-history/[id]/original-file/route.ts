import { adminDb, getAdminBucket } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_EXTENSIONS = ["xls", "xlsx"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get("originalFile");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing originalFile" },
        { status: 400 },
      );
    }

    // Validate extension from name
    const fileName = file instanceof File ? file.name : "upload.xlsx";
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    // Verify record exists
    const docRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalStoragePath = `watson/invoice-uploads/${id}_original.${ext}`;
    const bucket = getAdminBucket();
    const storageFile = bucket.file(originalStoragePath);

    const contentType =
      ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";

    await storageFile.save(buffer, {
      contentType,
      metadata: { contentType },
    });

    // Save path to Firestore
    await docRef.update({ originalStoragePath, originalFileName: fileName });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving original file:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const docRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const data = docSnap.data();
    const originalStoragePath = data?.originalStoragePath;
    const originalFileName = data?.originalFileName ?? `invoice_${id}.xlsx`;

    if (!originalStoragePath) {
      return NextResponse.json(
        { error: "Original file not available" },
        { status: 404 },
      );
    }

    const bucket = getAdminBucket();
    const storageFile = bucket.file(originalStoragePath);
    const [exists] = await storageFile.exists();
    if (!exists) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }

    const [content] = await storageFile.download();
    const ext = originalStoragePath.split(".").pop()?.toLowerCase() ?? "xlsx";
    const contentType =
      ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.ms-excel";

    return new NextResponse(content as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(originalFileName)}"`,
        "Content-Length": String(content.length),
      },
    });
  } catch (error) {
    console.error("Error downloading original file:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
