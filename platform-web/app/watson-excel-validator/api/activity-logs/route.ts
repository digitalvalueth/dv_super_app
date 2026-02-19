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
import { listActivityLogs, ActivityLogDocument } from "@/lib/watson-firebase";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity-logs
 * List activity logs with optional filtering
 *
 * Query params:
 * - start_date: string - Filter logs after this date (ISO format)
 * - end_date: string - Filter logs before this date (ISO format)
 * - action: string - Filter by action type (e.g., "export", "import", "fix")
 * - limit: number - Max results (default: 50)
 * - offset: number - Skip results for pagination
 */
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const { limit, offset } = parsePagination(request);
      const { startDate, endDate } = parseDateFilter(request);
      const action = searchParams.get("action") || undefined;

      const logs = await listActivityLogs({
        startDate,
        endDate,
        action,
        limitCount: limit + offset,
      });

      // Apply offset manually
      const paginatedLogs = logs.slice(offset, offset + limit);

      // Format logs for response
      const formattedLogs = paginatedLogs.map((log: ActivityLogDocument) => ({
        id: log.id,
        action: log.action,
        timestamp: log.timestamp.toDate().toISOString(),
        userId: log.userId,
        details: log.details,
      }));

      const response = successResponse({
        logs: formattedLogs,
        pagination: {
          limit,
          offset,
          count: formattedLogs.length,
        },
        filters: {
          startDate: startDate?.toISOString() || null,
          endDate: endDate?.toISOString() || null,
          action: action || null,
        },
      });

      // Add CORS headers
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Error listing activity logs:", error);
      return errorResponse(
        "Failed to list activity logs",
        "LIST_ACTIVITY_LOGS_ERROR",
        500,
      );
    }
  });
}

export async function OPTIONS() {
  return handleCorsOptions();
}
