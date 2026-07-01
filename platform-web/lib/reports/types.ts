// Shared, framework-free types for the report logic modules.
// These mirror the shapes used by the dashboard-vendor-center report pages,
// but live here so the pure logic can be imported into node-env tests
// without pulling in next/react/firebase.

export interface DailySaleItem {
  barcode: string;
  productDescription: string;
  price: number;
  quantity: number;
  revenue: number;
  saleType?: "normal" | "promotion";
}

export interface DailySale {
  id: string;
  companyId?: string;
  branchId: string;
  branchName: string;
  employeeId?: string;
  employeeName: string;
  saleDate: string;
  items: DailySaleItem[];
  totalItems?: number;
  totalRevenue?: number;
  // Recomputed for the active brand on some pages.
  totalUnits?: number;
}
