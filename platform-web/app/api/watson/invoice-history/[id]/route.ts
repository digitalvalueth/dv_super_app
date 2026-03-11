import { adminDb, getAdminBucket } from "@/lib/firebase-admin";
import { COLLECTIONS, InvoiceStorageData } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

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
    const storagePath = data?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ headers: [], data: [] });
    }

    const bucket = getAdminBucket();
    const file = bucket.file(storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 },
      );
    }

    const [content] = await file.download();
    const jsonContent = JSON.parse(content.toString("utf-8"));

    return NextResponse.json(jsonContent);
  } catch (error) {
    console.error(
      `Error fetching invoice data for ${await (await params).id}:`,
      error,
    );
    return NextResponse.json(
      { error: "Failed to fetch data content" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const docRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS).doc(id);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const storagePath = data?.storagePath;

      if (storagePath) {
        try {
          const bucket = getAdminBucket();
          const file = bucket.file(storagePath);
          await file
            .delete()
            .catch((err) =>
              console.warn("Failed to delete file from storage:", err),
            );
        } catch (err) {
          console.warn("Failed to get bucket for delete:", err);
        }
      }

      await docRef.delete();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete record" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { headers, data, status, bulkAcceptedItemCodes, qtyOverrides } = body;

    const docRef = adminDb.collection(COLLECTIONS.INVOICE_UPLOADS).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists)
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    const existingData = docSnap.data();

    // Update Content if provided
    if (headers && data) {
      const storagePath = existingData?.storagePath;
      if (!storagePath)
        return NextResponse.json(
          { error: "No storage path to update" },
          { status: 400 },
        );

      const bucket = getAdminBucket();
      const file = bucket.file(storagePath);

      const storageData: InvoiceStorageData = { headers, data };
      await file.save(JSON.stringify(storageData), {
        contentType: "application/json",
        metadata: { contentType: "application/json" },
      });

      await docRef.update({ rowCount: data.length });
    }

    // Update Status if provided
    if (status) {
      const statusUpdate: Record<string, unknown> = { status };
      // Also persist lastExportId if provided alongside status
      if (body.lastExportId !== undefined) {
        statusUpdate.lastExportId = body.lastExportId;
      }
      await docRef.update(statusUpdate);
    } else if (body.lastExportId !== undefined) {
      // lastExportId provided without status change
      await docRef.update({ lastExportId: body.lastExportId });
    }

    // Update bulkAcceptedItemCodes if provided
    if (bulkAcceptedItemCodes !== undefined) {
      await docRef.update({ bulkAcceptedItemCodes });
    }

    // Update qtyOverrides if provided
    if (qtyOverrides !== undefined) {
      await docRef.update({ qtyOverrides });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update record" },
      { status: 500 },
    );
  }
}
