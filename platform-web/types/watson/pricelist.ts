// Types for Price List Data (from PriceList.json)

export interface PriceListItem {
  itemCode: string; // WatsonCode
  prodCode: string; // Barcode
  prodName: string; // ItemName
  priceStartDate: string; // ISO date string "2026-01-22T00:00:00"
  priceEndDate?: string; // End date (optional)
  qty: number;
  price: number; // Standard Price IncV (ราคาเต็ม)
  discamti: number; // ส่วนลด
  priceIncVat: number; // Comm Price IncV (ราคาคอม รวม VAT)
  priceExtVat: number; // Invoice 62% ExcV (ราคาไม่รวม VAT)
  priceExtVatSt: number; // ราคาไม่รวม VAT x 100
  remarki1: string; // Remark
  remarki2: string;
  // Extended fields for Watson format
  standardPriceIncV?: number; // Standard Price IncV
  commPriceIncV?: number; // Comm Price IncV
  invoice62IncV?: number; // Invoice 62% IncV
  invoice62ExcV?: number; // Invoice 62% ExcV
}

// Grouped by item code with all price periods
export interface ItemPriceHistory {
  itemCode: string;
  prodCode: string;
  prodName: string;
  periods: PricePeriod[];
}

export interface PricePeriod {
  startDate: Date;
  endDate: Date | null; // null = ถึงปัจจุบัน
  price: number;
  discamti: number;
  priceIncVat: number;
  priceExtVat: number;
  remark?: string; // Promotion remark (Buy1, 2 For 599, etc.)
}

// Result when matching invoice date
export interface PriceMatch {
  itemCode: string;
  prodCode: string;
  invoiceDate: Date;
  matchedPeriod: PricePeriod | null;
  expectedPriceExtVat: number | null;
  actualPriceExtVat: number | null;
  priceDiff: number | null;
  isMatch: boolean;
  message: string;
}

// Summary for sidebar
export interface PriceListSummary {
  totalItems: number;
  totalPeriods: number;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}
