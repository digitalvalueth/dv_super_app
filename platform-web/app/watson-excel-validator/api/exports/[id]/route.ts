import { NextRequest } from "next/server";
import {
  withApiKeyAuth,
  successResponse,
  errorResponse,
  notFoundResponse,
  getCorsHeaders,
  handleCorsOptions,
} from "@/lib/watson/api-utils";
import { getExport, confirmExport, unconfirmExport } from "@/lib/watson-firebase";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/exports/:id
 * Get a specific export by ID
 */
export async function GET(request: NextRequest, { params }: Params) {
  return withApiKeyAuth(request, async () => {
    try {
      const { id } = await params;
      const exportDoc = await getExport(id);

      if (!exportDoc) {
        return notFoundResponse("Export");
      }

      // Merge headers + data into array of {header: value} objects
      const headers = exportDoc.headers || [];
      const rawData = (exportDoc.data || []) as unknown as unknown[][];
      const mergedData = rawData.map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] ?? null;
        });
        return obj;
      });

      // Format the response
      const formattedExport = {
        id: exportDoc.id,
        supplierCode: exportDoc.supplierCode,
        supplierName: exportDoc.supplierName,
        reportDate: exportDoc.reportDate,
        exportedAt: exportDoc.exportedAt.toDate().toISOString(),
        status: exportDoc.status || "draft", // Default to draft for backward compatibility
        confirmedAt: exportDoc.confirmedAt?.toDate().toISOString() || null,
        confirmedBy: exportDoc.confirmedBy || null,
        rowCount: exportDoc.rowCount,
        passedCount: exportDoc.passedCount,
        lowConfidenceCount: exportDoc.lowConfidenceCount,
        summary: exportDoc.summary,
        data: mergedData,
        metadata: exportDoc.metadata,
      };

      const response = successResponse(formattedExport);

      // Add CORS headers
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Error getting export:", error);
      return errorResponse("Failed to get export", "GET_EXPORT_ERROR", 500);
    }
  });
}

/**
 * PATCH /api/exports/:id
 * Update export status (confirm or unconfirm)
 *
 * Body:
 * - action: "confirm" | "unconfirm"
 * - confirmedBy?: string (optional, only for confirm action)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  return withApiKeyAuth(request, async () => {
    try {
      const { id } = await params;
      const body = await request.json();

      const { action, confirmedBy } = body as {
        action: "confirm" | "unconfirm";
        confirmedBy?: string;
      };

      if (!action || !["confirm", "unconfirm"].includes(action)) {
        return errorResponse(
          "Invalid action. Must be 'confirm' or 'unconfirm'",
          "VALIDATION_ERROR",
          400,
        );
      }

      // Check if export exists
      const exportDoc = await getExport(id);
      if (!exportDoc) {
        return notFoundResponse("Export");
      }

      // Perform the action
      if (action === "confirm") {
        await confirmExport(id, confirmedBy);
      } else {
        await unconfirmExport(id);
      }

      // Get updated document
      const updatedExport = await getExport(id);

      const response = successResponse({
        id,
        status: action === "confirm" ? "confirmed" : "draft",
        confirmedAt: updatedExport?.confirmedAt?.toDate().toISOString() || null,
        confirmedBy: updatedExport?.confirmedBy || null,
        message:
          action === "confirm"
            ? "Export confirmed successfully"
            : "Export reverted to draft",
      });

      // Add CORS headers
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Error updating export:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Failed to update export",
        "UPDATE_EXPORT_ERROR",
        500,
      );
    }
  });
}

export async function OPTIONS() {
  return handleCorsOptions();
}
