import { validateApiKey } from "@/lib/watson-firebase";
import { NextRequest, NextResponse } from "next/server";

export interface ApiError {
  error: string;
  message: string;
  code: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

/**
 * Validate API Key from request headers
 * Header format: X-API-Key: wv_xxxxx
 */
export async function withApiKeyAuth(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const apiKey = request.headers.get("X-API-Key");

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: {
          error: "Unauthorized",
          message: "Missing API Key. Please provide X-API-Key header.",
          code: "AUTH_MISSING_KEY",
        },
      } as ApiResponse<never>,
      { status: 401 },
    );
  }

  try {
    const isValid = await validateApiKey(apiKey);

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: "Unauthorized",
            message: "Invalid or inactive API Key.",
            code: "AUTH_INVALID_KEY",
          },
        } as ApiResponse<never>,
        { status: 401 },
      );
    }

    return handler();
  } catch (error) {
    console.error("API Key validation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          error: "Internal Server Error",
          message: "Failed to validate API Key.",
          code: "AUTH_VALIDATION_ERROR",
        },
      } as ApiResponse<never>,
      { status: 500 },
    );
  }
}

/**
 * Parse query parameters for pagination
 */
export function parsePagination(request: NextRequest): {
  limit: number;
  offset: number;
} {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1),
    100,
  );
  const offset = Math.max(
    parseInt(url.searchParams.get("offset") || "0", 10),
    0,
  );

  return { limit, offset };
}

/**
 * Parse date filter from query parameters
 */
export function parseDateFilter(request: NextRequest): {
  startDate?: Date;
  endDate?: Date;
  confirmedStartDate?: Date;
  confirmedEndDate?: Date;
} {
  const url = new URL(request.url);
  const startDateStr = url.searchParams.get("start_date");
  const endDateStr = url.searchParams.get("end_date");
  const confirmedStartDateStr = url.searchParams.get("confirmed_start_date");
  const confirmedEndDateStr = url.searchParams.get("confirmed_end_date");

  return {
    startDate: startDateStr ? new Date(startDateStr) : undefined,
    endDate: endDateStr ? new Date(endDateStr) : undefined,
    confirmedStartDate: confirmedStartDateStr
      ? new Date(confirmedStartDateStr)
      : undefined,
    confirmedEndDate: confirmedEndDateStr
      ? new Date(confirmedEndDateStr)
      : undefined,
  };
}

/**
 * Create success response
 */
export function successResponse<T>(
  data: T,
  meta?: ApiResponse<T>["meta"],
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    meta,
  } as ApiResponse<T>);
}

/**
 * Create error response
 */
export function errorResponse(
  message: string,
  code: string,
  status: number = 400,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        error: status >= 500 ? "Internal Server Error" : "Bad Request",
        message,
        code,
      },
    } as ApiResponse<never>,
    { status },
  );
}

/**
 * Create not found response
 */
export function notFoundResponse(resource: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        error: "Not Found",
        message: `${resource} not found.`,
        code: "NOT_FOUND",
      },
    } as ApiResponse<never>,
    { status: 404 },
  );
}

/**
 * CORS headers for API responses
 */
export function getCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  };
}

/**
 * Handle OPTIONS request for CORS
 */
export function handleCorsOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
