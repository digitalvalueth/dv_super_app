import { adminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/watson-firebase";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

// POST /api/internal/exports/[id]/confirm — confirm or unconfirm an export (no API key required)
export async function POST(
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
    const { action, confirmedBy, cancelledBy, cancelReason } = body;

    if (
      !action ||
      !["confirm", "unconfirm", "cancel", "uncancel"].includes(action)
    ) {
      return NextResponse.json(
        {
          error: {
            message:
              "Invalid action. Must be 'confirm', 'unconfirm', 'cancel', or 'uncancel'",
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
    let newStatus: string;

    if (action === "confirm") {
      update = {
        status: "confirmed",
        confirmedAt: Timestamp.now(),
        confirmedBy: confirmedBy || null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      };
      newStatus = "confirmed";
    } else if (action === "cancel") {
      update = {
        status: "cancelled",
        cancelledAt: Timestamp.now(),
        cancelledBy: cancelledBy || null,
        cancelReason: cancelReason || null,
      };
      newStatus = "cancelled";
    } else if (action === "uncancel") {
      update = {
        status: "draft",
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
      };
      newStatus = "draft";
    } else {
      // unconfirm
      update = {
        status: "draft",
        confirmedAt: null,
        confirmedBy: null,
      };
      newStatus = "draft";
    }

    await docRef.update(update);

    // Determine the corresponding invoice workflow status
    const invoiceStatus =
      newStatus === "confirmed"
        ? "confirmed"
        : newStatus === "cancelled"
          ? "cancelled"
          : "exported";

    // Sync the linked invoice upload record's status
    // Strategy: try multiple ways to find the linked invoice
    let syncedInvoiceId: string | null = null;
    try {
      const exportData = docSnap.data();

      // 1) Direct link: export doc has invoiceUploadId
      if (exportData?.invoiceUploadId) {
        const invoiceRef = adminDb
          .collection(COLLECTIONS.INVOICE_UPLOADS)
          .doc(exportData.invoiceUploadId);
        const invoiceSnap = await invoiceRef.get();
        if (invoiceSnap.exists) {
          await invoiceRef.update({ status: invoiceStatus, lastExportId: id });
          syncedInvoiceId = invoiceSnap.id;
        }
      }

      // 2) Reverse link: invoice has lastExportId pointing to this export
      if (!syncedInvoiceId) {
        const byLastExport = await adminDb
          .collection(COLLECTIONS.INVOICE_UPLOADS)
          .where("lastExportId", "==", id)
          .limit(5)
          .get();
        if (!byLastExport.empty) {
          const batch = adminDb.batch();
          byLastExport.forEach((snap) => {
            batch.update(snap.ref, { status: invoiceStatus });
            if (!syncedInvoiceId) syncedInvoiceId = snap.id;
          });
          await batch.commit();
        }
      }

      // 3) Fallback: match by fileName + supplierCode + companyId
      if (
        !syncedInvoiceId &&
        exportData?.fileName &&
        exportData?.supplierCode
      ) {
        let query = adminDb
          .collection(COLLECTIONS.INVOICE_UPLOADS)
          .where("fileName", "==", exportData.fileName)
          .where("supplierCode", "==", exportData.supplierCode);
        if (exportData.companyId) {
          query = query.where("companyId", "==", exportData.companyId);
        }
        const byName = await query.limit(3).get();
        if (!byName.empty) {
          const batch = adminDb.batch();
          byName.forEach((snap) => {
            batch.update(snap.ref, {
              status: invoiceStatus,
              lastExportId: id,
            });
            if (!syncedInvoiceId) syncedInvoiceId = snap.id;
          });
          await batch.commit();
          // Also backfill the invoiceUploadId on the export doc
          if (syncedInvoiceId) {
            await docRef.update({ invoiceUploadId: syncedInvoiceId });
          }
        }
      }
    } catch (syncErr) {
      // Non-fatal: log but don't fail the main operation
      console.warn("Failed to sync invoice upload status:", syncErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        status: newStatus,
        syncedInvoiceId,
        confirmedAt: action === "confirm" ? now : null,
        confirmedBy: action === "confirm" ? confirmedBy || null : null,
        cancelledAt: action === "cancel" ? now : null,
        cancelledBy: action === "cancel" ? cancelledBy || null : null,
        cancelReason: action === "cancel" ? cancelReason || null : null,
        message:
          action === "confirm"
            ? "Export confirmed successfully"
            : action === "cancel"
              ? "Export cancelled successfully"
              : action === "uncancel"
                ? "Export restored to draft"
                : "Export unconfirmed successfully",
      },
    });
  } catch (error) {
    console.error("Error in POST /api/internal/exports/[id]/confirm:", error);
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
