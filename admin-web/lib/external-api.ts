/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * External API Service for Admin Web
 * สำหรับเชื่อมต่อกับ API ภายนอก (ERP/POS) เพื่อดึงข้อมูลสต็อกมาเปรียบเทียบ
 */

// Types สำหรับ External API
export interface ExternalStockData {
  productId: string;
  barcode: string;
  productName?: string;
  externalQty: number;
  lastUpdated: Date;
}

export interface StockComparison {
  productId: string;
  productName: string;
  barcode: string;
  ourQty: number;
  externalQty: number;
  difference: number;
  status: "match" | "over" | "short";
  lastCounted?: Date;
}

export interface ExternalApiConfig {
  baseUrl: string;
  apiKey?: string;
  authMethod: "api-key" | "bearer" | "basic" | "none";
}

// Config from environment
const apiConfig: ExternalApiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_EXTERNAL_API_URL || "",
  apiKey: process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || "",
  authMethod: "api-key",
};

/**
 * Get Authorization Headers
 */
const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (apiConfig.authMethod) {
    case "api-key":
      if (apiConfig.apiKey) {
        headers["X-API-Key"] = apiConfig.apiKey;
      }
      break;
    case "bearer":
      if (apiConfig.apiKey) {
        headers["Authorization"] = `Bearer ${apiConfig.apiKey}`;
      }
      break;
  }

  return headers;
};

/**
 * Fetch stock from external API
 */
export const fetchExternalStock = async (
  barcode: string,
): Promise<ExternalStockData | null> => {
  if (!apiConfig.baseUrl) {
    return null;
  }

  try {
    const response = await fetch(
      `${apiConfig.baseUrl}/stock/${encodeURIComponent(barcode)}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      productId: data.productId || barcode,
      barcode: data.barcode || barcode,
      productName: data.productName,
      externalQty: data.quantity || data.stock || 0,
      lastUpdated: new Date(data.lastUpdated || Date.now()),
    };
  } catch (error) {
    console.error("Error fetching external stock:", error);
    return null;
  }
};

/**
 * Fetch all stock
 */
export const fetchAllExternalStock = async (): Promise<ExternalStockData[]> => {
  if (!apiConfig.baseUrl) {
    return [];
  }

  try {
    const response = await fetch(`${apiConfig.baseUrl}/stock`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : data.items || data.data || [];

    return items.map((item: any) => ({
      productId: item.productId || item.product_id,
      barcode: item.barcode,
      productName: item.productName || item.product_name,
      externalQty: item.quantity || item.stock || 0,
      lastUpdated: new Date(item.lastUpdated || Date.now()),
    }));
  } catch (error) {
    console.error("Error fetching all external stock:", error);
    return [];
  }
};

/**
 * Compare stock
 */
export const compareStock = (
  ourQty: number,
  externalQty: number,
  productId: string,
  productName: string,
  barcode: string,
  lastCounted?: Date,
): StockComparison => {
  const difference = externalQty - ourQty;
  let status: "match" | "over" | "short" = "match";

  if (difference > 0) {
    status = "short";
  } else if (difference < 0) {
    status = "over";
  }

  return {
    productId,
    productName,
    barcode,
    ourQty,
    externalQty,
    difference,
    status,
    lastCounted,
  };
};

/**
 * Mock data for testing
 */
export const getMockExternalStock = (): ExternalStockData[] => {
  return [
    {
      productId: "SK-C-250",
      barcode: "8859109897033",
      productName: "สินค้าตัวอย่าง A",
      externalQty: 100,
      lastUpdated: new Date(),
    },
    {
      productId: "SK-C-251",
      barcode: "8859109897040",
      productName: "สินค้าตัวอย่าง B",
      externalQty: 50,
      lastUpdated: new Date(),
    },
  ];
};

/**
 * Check if external API is configured
 */
export const isExternalApiConfigured = (): boolean => {
  return !!apiConfig.baseUrl;
};
