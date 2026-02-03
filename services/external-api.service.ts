/**
 * External API Service
 * สำหรับเชื่อมต่อกับ API ภายนอก (ERP/POS) เพื่อดึงข้อมูลสต็อกมาเปรียบเทียบ
 */

// Types สำหรับ External API
export interface ExternalStockData {
  productId: string;
  barcode: string;
  productName?: string;
  externalQty: number; // จำนวนจากระบบ ERP ภายนอก
  lastUpdated: Date;
}

export interface StockComparison {
  productId: string;
  productName: string;
  barcode: string;
  ourQty: number; // จำนวนที่นับได้ในระบบเรา
  externalQty: number; // จำนวนจากระบบ ERP
  difference: number; // ค่าความต่าง (externalQty - ourQty)
  status: "match" | "over" | "short";
  lastCounted?: Date;
}

export interface ExternalApiConfig {
  baseUrl: string;
  apiKey?: string;
  authMethod: "api-key" | "bearer" | "basic" | "none";
  headers?: Record<string, string>;
}

// Default config - ต้องตั้งค่าจากลูกค้า
let apiConfig: ExternalApiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_EXTERNAL_API_URL || "",
  apiKey: process.env.EXPO_PUBLIC_EXTERNAL_API_KEY || "",
  authMethod: "api-key",
};

/**
 * Set External API Configuration
 */
export const setExternalApiConfig = (config: Partial<ExternalApiConfig>) => {
  apiConfig = { ...apiConfig, ...config };
};

/**
 * Get Authorization Headers
 */
const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...apiConfig.headers,
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
    case "basic":
      if (apiConfig.apiKey) {
        headers["Authorization"] = `Basic ${apiConfig.apiKey}`;
      }
      break;
  }

  return headers;
};

/**
 * Fetch stock data from external API by barcode
 */
export const fetchExternalStock = async (
  barcode: string,
): Promise<ExternalStockData | null> => {
  if (!apiConfig.baseUrl) {
    console.warn("External API URL not configured");
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
      console.error(`External API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      productId: data.productId || data.product_id || barcode,
      barcode: data.barcode || barcode,
      productName: data.productName || data.product_name,
      externalQty: data.quantity || data.qty || data.stock || 0,
      lastUpdated: new Date(data.lastUpdated || data.updated_at || Date.now()),
    };
  } catch (error) {
    console.error("Error fetching external stock:", error);
    return null;
  }
};

/**
 * Fetch all stock data from external API
 */
export const fetchAllExternalStock = async (): Promise<ExternalStockData[]> => {
  if (!apiConfig.baseUrl) {
    console.warn("External API URL not configured");
    return [];
  }

  try {
    const response = await fetch(`${apiConfig.baseUrl}/stock`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    // Handle different API response formats
    const items = Array.isArray(data) ? data : data.items || data.data || [];

    return items.map((item: any) => ({
      productId: item.productId || item.product_id,
      barcode: item.barcode,
      productName: item.productName || item.product_name,
      externalQty: item.quantity || item.qty || item.stock || 0,
      lastUpdated: new Date(item.lastUpdated || item.updated_at || Date.now()),
    }));
  } catch (error) {
    console.error("Error fetching all external stock:", error);
    return [];
  }
};

/**
 * Compare our stock with external stock
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
    status = "short"; // เรานับได้น้อยกว่าระบบ (ของหาย)
  } else if (difference < 0) {
    status = "over"; // เรานับได้มากกว่าระบบ (มีของเกิน)
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
 * Mock data for testing (ใช้ทดสอบก่อนมี API จริง)
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
    {
      productId: "SK-C-252",
      barcode: "8859109897057",
      productName: "สินค้าตัวอย่าง C",
      externalQty: 75,
      lastUpdated: new Date(),
    },
  ];
};
