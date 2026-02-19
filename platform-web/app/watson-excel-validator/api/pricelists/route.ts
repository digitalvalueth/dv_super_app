import { NextRequest } from "next/server";
import {
  withApiKeyAuth,
  successResponse,
  errorResponse,
  notFoundResponse,
  parsePagination,
  getCorsHeaders,
  handleCorsOptions,
} from "@/lib/watson/api-utils";
import {
  listPriceLists,
  getPriceList,
  PriceListDocument,
} from "@/lib/watson-firebase";

export const dynamic = "force-dynamic";

/**
 * GET /api/pricelists
 * List price lists or get a specific price list by query param
 *
 * Query params:
 * - id: string - Get specific price list by ID
 * - supplier_code: string - Filter by supplier code
 * - limit: number - Max results (default: 50)
 * - offset: number - Skip results for pagination
 */
export async function GET(request: NextRequest) {
  return withApiKeyAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");

      // If ID is provided, get specific price list
      if (id) {
        const priceList = await getPriceList(id);

        if (!priceList) {
          return notFoundResponse("Price list");
        }

        const formattedPriceList = {
          id: priceList.id,
          name: priceList.name,
          importedAt: priceList.importedAt.toDate().toISOString(),
          itemCount: priceList.itemCount,
          dateRange: priceList.dateRange,
          items: priceList.items,
        };

        const response = successResponse(formattedPriceList);
        Object.entries(getCorsHeaders()).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }

      // List price lists
      const { limit, offset } = parsePagination(request);

      const priceLists = await listPriceLists({ limitCount: limit + offset });

      // Apply offset manually
      const paginatedLists = priceLists.slice(offset, offset + limit);

      // Format for summary view (without items)
      const formattedLists = paginatedLists.map((pl: PriceListDocument) => ({
        id: pl.id,
        name: pl.name,
        importedAt: pl.importedAt.toDate().toISOString(),
        itemCount: pl.itemCount,
        dateRange: pl.dateRange,
      }));

      const response = successResponse({
        pricelists: formattedLists,
        pagination: {
          limit,
          offset,
          count: formattedLists.length,
        },
      });

      // Add CORS headers
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error("Error listing price lists:", error);
      return errorResponse(
        "Failed to list price lists",
        "LIST_PRICELISTS_ERROR",
        500,
      );
    }
  });
}

export async function OPTIONS() {
  return handleCorsOptions();
}
