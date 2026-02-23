import { NextRequest } from "next/server";
import {
  withApiKeyAuth,
  successResponse,
  errorResponse,
  parsePagination,
  parseDateFilter,
  getCorsHeaders,
  handleCorsOptions,
} from "@/lib/watson/api-utils";
import { listExports, saveExport, ExportStatus } from "@/lib/watson-firebase";

export const dynamic = "force-dynamic";

/**
 * GET /api/exports
 * List all exports with optional filtering
 *
 * Query Parameters:
 * - supplier_code: Filter by supplier code
 * - status: Filter by status ("draft" | "confirmed")
 * - start_date: Filter exports after this date (ISO format) - based on exportedAt
 * - end_date: Filter exports before this date (ISO format) - based on exportedAt
 * - confirmed_start_date: Filter by confirmedAt after this date (ISO format)
 * - confirmed_end_date: Filter by confirmedAt before this date (ISO format)
 * - limit: Number of results (default: 50, max: 100)
 * - offset: Offset for pagination
 */
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async () => {
    try {
      const url = new URL(request.url);
      const supplierCode = url.searchParams.get("supplier_code") || undefined;
      const statusParam = url.searchParams.get("status");
      const status =
        statusParam === "confirmed" || statusParam === "draft"
          ? (statusParam as ExportStatus)
          : undefined;
      const { limit, offset } = parsePagination(request);
      const { startDate, endDate, confirmedStartDate, confirmedEndDate } =
        parseDateFilter(request);

      const exports = await listExports({
        supplierCode,
        status,
        startDate,
        endDate,
        confirmedStartDate,
        confirmedEndDate,
        limitCount: limit + offset, // Fetch enough for pagination
      });

      // Apply offset manually (Firestore doesn't support native offset)
      const paginatedExports = exports.slice(offset, offset + limit);

      // Return without full data array for list view
      const exportSummaries = paginatedExports.map((exp) => ({
        id: exp.id,
        supplierCode: exp.supplierCode,
        supplierName: exp.supplierName,
        reportDate: exp.reportDate,
        exportedAt: exp.exportedAt.toDate().toISOString(),
        status: exp.status || "draft", // Default to draft for backward compatibility
        confirmedAt: exp.confirmedAt?.toDate().toISOString() || null,
        rowCount: exp.rowCount,
        passedCount: exp.passedCount,
        lowConfidenceCount: exp.lowConfidenceCount,
        summary: exp.summary,
      }));

      const response = successResponse(exportSummaries, {
        total: exports.length,
        limit,
        offset,
      });

      // Add CORS headers
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Error listing exports:", error);
      return errorResponse("Failed to list exports", "LIST_EXPORTS_ERROR", 500);
    }
  });
}

/**
 * POST /api/exports
 * Save a new export to Firestore
 *
 * Body:
 * - supplierCode: string
 * - supplierName: string
 * - reportDate: string
 * - headers: string[]
 * - data: any[][]
 * - summary: object
 * - passedCount: number
 * - lowConfidenceCount: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ["supplierCode", "data"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return errorResponse(
          `Missing required field: ${field}`,
          "VALIDATION_ERROR",
          400,
        );
      }
    }

    // Support both formats:
    // New format: data is array of {header: value} objects (no separate headers)
    // Legacy format: headers[] + data[][] (array of arrays)
    let headers: string[] = body.headers || [];
    let data: unknown[] = body.data || [];

    if (
      !body.headers &&
      Array.isArray(body.data) &&
      body.data.length > 0 &&
      typeof body.data[0] === "object" &&
      !Array.isArray(body.data[0])
    ) {
      // New format: extract headers from object keys
      headers = Object.keys(body.data[0]);
      // Convert objects to arrays for storage
      data = body.data.map((row: Record<string, unknown>) =>
        headers.map((h: string) => row[h] ?? null),
      );
    }

    const exportId = await saveExport({
      supplierCode: body.supplierCode,
      supplierName: body.supplierName || "",
      reportDate: body.reportDate || "",
      headers,
      data: data as Record<string, unknown>[],
      summary: body.summary || {},
      rowCount: body.data?.length || 0,
      passedCount: body.passedCount || 0,
      lowConfidenceCount: body.lowConfidenceCount || 0,
      metadata: body.metadata || {},
    });

    const response = successResponse({
      id: exportId,
      message: "Export saved successfully",
    });

    Object.entries(getCorsHeaders()).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error("Error saving export:", error);
    // Log more details for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
    });
    return errorResponse(
      `Failed to save export: ${errorMessage}`,
      "SAVE_EXPORT_ERROR",
      500,
    );
  }
}

export async function OPTIONS() {
  return handleCorsOptions();
}
