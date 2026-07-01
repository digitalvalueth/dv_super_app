"use client";

import {
  ChevronRight,
  Download,
  Image as ImageIcon,
  Package,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBrand } from "../brand-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getPromotionData } from "@/lib/watson-firebase";
import { PromotionItem } from "@/types/watson/promotion";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useActivityLogger } from "@/hooks/watson/useActivityLogger";

interface DailySaleItem {
  barcode: string;
  productDescription: string;
  price: number;
  quantity: number;
  revenue: number;
  saleType: "normal" | "promotion";
}

interface DailySale {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  saleDate: string;
  items: DailySaleItem[];
  totalItems: number;
  totalRevenue: number;
}

interface Product {
  id: string;
  productId: string;
  companyId: string;
  name: string;
  barcode: string;
  status?: string;
  category?: string;
  beforeCount?: number;
}

interface CountingSession {
  id: string;
  productId: string;
  branchId: string;
  branchName: string;
  currentCountQty?: number;
  beforeCountQty?: number;
  status: string;
  createdAt?: any;
}

interface Branch {
  id: string;
  name: string;
  companyId: string;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export default function SellingProducts() {
  const { activeBrand } = useBrand();
  const { logAction } = useActivityLogger();
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawSales, setRawSales] = useState<DailySale[]>([]);
  const [rawSessions, setRawSessions] = useState<CountingSession[]>([]);
  const [rawBranches, setRawBranches] = useState<Branch[]>([]);
  const [rawPromotions, setRawPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<
    "Yesterday" | "7 Days" | "MTD" | "Last Month"
  >("Yesterday");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "TBD">(
    "All",
  );
  const [q, setQ] = useState("");
  const [stockOpen, setStockOpen] = useState<any | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Find companyId of Phithan
        const companiesSnap = await getDocs(collection(db, "companies"));
        const phithan = companiesSnap.docs.find(d => {
          const name = (d.data().name || "").toLowerCase();
          const code = (d.data().code || "").toLowerCase();
          return name.includes("phithan") || name.includes("พิธาน") || code.includes("phithan");
        });
        const targetCompanyId = phithan?.id || "";

        // Query collections
        const productsRef = collection(db, "products");
        const productsQuery = targetCompanyId
          ? query(productsRef, where("companyId", "==", targetCompanyId))
          : query(productsRef);
        const productsSnap = await getDocs(productsQuery);
        setRawProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);

        const salesRef = collection(db, "dailySales");
        const salesQuery = targetCompanyId 
          ? query(salesRef, where("companyId", "==", targetCompanyId))
          : query(salesRef);
        const salesSnap = await getDocs(salesQuery);
        setRawSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DailySale[]);

        const sessionsRef = collection(db, "countingSessions");
        const sessionsQuery = targetCompanyId
          ? query(sessionsRef, where("companyId", "==", targetCompanyId))
          : query(sessionsRef);
        const sessionsSnap = await getDocs(sessionsQuery);
        setRawSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CountingSession[]);

        const branchesRef = collection(db, "branches");
        const branchesQuery = targetCompanyId
          ? query(branchesRef, where("companyId", "==", targetCompanyId))
          : query(branchesRef);
        const branchesSnap = await getDocs(branchesQuery);
        setRawBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Branch[]);

        // Query shared promotions
        const promos = await getPromotionData();
        setRawPromotions(promos || []);
      } catch (err) {
        console.error("Error loading vendor products data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
    const norm = (name || "").toLowerCase().replace(/\s+/g, "").trim();
    if (brand === "NEST ME") {
      return norm.includes("nestme") || norm.includes("nest me");
    } else {
      return norm.includes("primanest") || norm.includes("prima");
    }
  };

  const brandProducts = useMemo(() => {
    return rawProducts.filter(p => matchBrand(p.name || "", activeBrand));
  }, [rawProducts, activeBrand]);

  const brandSales = useMemo(() => {
    return rawSales.map(sale => {
      const brandItems = (sale.items || []).filter(item => matchBrand(item.productDescription || "", activeBrand));
      if (brandItems.length === 0) return null;
      const totalRevenue = brandItems.reduce((sum, item) => sum + (item.revenue || 0), 0);
      const totalUnits = brandItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return {
        ...sale,
        items: brandItems,
        totalRevenue,
        totalUnits,
        totalItems: brandItems.length
      };
    }).filter(Boolean) as any[];
  }, [rawSales, activeBrand]);

  const sortedDates = useMemo(() => {
    const dates = brandSales.map(s => s.saleDate).filter(Boolean);
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [brandSales]);

  const latestDate = sortedDates[0] || "";

  const periodDates = useMemo(() => {
    if (!latestDate) return [];
    if (period === "Yesterday") {
      return [latestDate];
    }
    if (period === "7 Days") {
      return sortedDates.slice(0, 7);
    }
    if (period === "MTD") {
      const prefix = latestDate.substring(0, 7);
      return sortedDates.filter(d => d.startsWith(prefix));
    }
    if (period === "Last Month") {
      const parts = latestDate.split("-");
      let year = Number(parts[0]);
      let month = Number(parts[1]) - 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
      const prefix = `${year}-${String(month).padStart(2, "0")}`;
      return sortedDates.filter(d => d.startsWith(prefix));
    }
    return [];
  }, [period, latestDate, sortedDates]);

  const periodSales = useMemo(() => {
    if (periodDates.length === 0) return [];
    const dateSet = new Set(periodDates);
    return brandSales.filter(s => dateSet.has(s.saleDate));
  }, [brandSales, periodDates]);

  const totalPeriodRevenue = useMemo(() => {
    return periodSales.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
  }, [periodSales]);

  const getProductBranchSoh = (productId: string, branchId: string) => {
    const sessions = rawSessions
      .filter(s => s.productId === productId && s.branchId === branchId && s.status === "completed")
      .sort((a, b) => {
        const tA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const tB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return tB - tA;
      });
    const latestSession = sessions[0];
    if (latestSession) {
      return latestSession.currentCountQty ?? latestSession.beforeCountQty ?? 0;
    }
    return null;
  };

  const getProductTotalStock = (product: Product) => {
    let total = 0;
    let hasSession = false;
    for (const branch of rawBranches) {
      const soh = getProductBranchSoh(product.productId, branch.id);
      if (soh !== null) {
        total += soh;
        hasSession = true;
      }
    }
    if (!hasSession && product.beforeCount) {
      return product.beforeCount;
    }
    return total;
  };

  const getProductPeriodRevenue = (barcode: string) => {
    let total = 0;
    for (const sale of periodSales) {
      for (const item of sale.items) {
        if (item.barcode === barcode) {
          total += item.revenue || 0;
        }
      }
    }
    return total;
  };

  const getProductPeriodUnits = (barcode: string) => {
    let total = 0;
    for (const sale of periodSales) {
      for (const item of sale.items) {
        if (item.barcode === barcode) {
          total += item.quantity || 0;
        }
      }
    }
    return total;
  };

  const getProductRsp = (barcode: string) => {
    const sales = rawSales.flatMap(s => s.items).filter(item => item.barcode === barcode);
    if (sales.length > 0) {
      return Math.max(...sales.map(s => s.price || 0));
    }
    const promo = rawPromotions.find(p => p.barcode === barcode);
    if (promo && promo.stdPrice) return promo.stdPrice;
    return 0;
  };

  const mappedProducts = useMemo(() => {
    return brandProducts.map(p => {
      const revenue = getProductPeriodRevenue(p.barcode);
      const totalStock = getProductTotalStock(p);
      const units = getProductPeriodUnits(p.barcode);
      const rsp = getProductRsp(p.barcode);
      const contribution = totalPeriodRevenue > 0 ? (revenue / totalPeriodRevenue) * 100 : 0;
      const status = (p.status || "ACTIVE").toUpperCase() as "ACTIVE" | "TBD";
      
      return {
        id: p.id,
        productId: p.productId,
        code: p.productId,
        barcode: p.barcode || "—",
        name: p.name || "สินค้าไม่ระบุชื่อ",
        cat1: (p.category || "SKINCARE").toUpperCase(),
        cat2: "GENERAL",
        rsp,
        totalStock,
        revenue,
        contribution,
        status,
        unitsSold: units,
        beforeCount: p.beforeCount || 0,
      };
    });
  }, [brandProducts, periodSales, totalPeriodRevenue, rawSessions, rawBranches, rawPromotions, rawSales]);

  const filtered = useMemo(() => {
    let r = mappedProducts;
    if (statusFilter !== "All") {
      r = r.filter((p) =>
        statusFilter === "Active" ? p.status === "ACTIVE" : p.status === "TBD",
      );
    }
    if (q) {
      const queryLower = q.toLowerCase();
      r = r.filter(
        (p) =>
          p.code.toLowerCase().includes(queryLower) ||
          p.name.toLowerCase().includes(queryLower) ||
          p.barcode.includes(q),
      );
    }
    return r;
  }, [mappedProducts, statusFilter, q]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const headers = [
      "Product Code",
      "Barcode",
      "Product Name",
      "Category",
      "Status",
      "RSP (THB)",
      "Stock On Hand",
      "Units Sold",
      "Revenue (THB)",
      "Revenue Share (%)"
    ];

    const rows = filtered.map((p) => [
      p.code,
      p.barcode,
      p.name,
      p.cat1,
      p.status,
      p.rsp,
      p.totalStock,
      p.unitsSold,
      p.revenue,
      parseFloat(p.contribution.toFixed(2))
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [15, 18, 35, 12, 10, 12, 15, 12, 14, 18].map((w) => ({ wch: w }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    
    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_products_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    logAction("export_products", `ส่งออกรายงานสินค้าทั้งหมด (${filtered.length} รายการ)`, {
      rowCount: filtered.length,
      brand: activeBrand,
      period,
      statusFilter,
      fileName
    });
    
    toast.success("ดาวน์โหลดไฟล์รายงานสินค้าเรียบร้อยแล้ว");
  };

  const totals = filtered.reduce(
    (a, p) => ({
      stock: a.stock + p.totalStock,
      revenue: a.revenue + p.revenue,
    }),
    { stock: 0, revenue: 0 },
  );

  const daysElapsed = latestDate ? Number(latestDate.split("-")[2]) : 28;

  // Dialog-specific stock data
  const dialogStockByStore = useMemo(() => {
    if (!stockOpen) return [];
    
    const uniqueBranchIds = new Set(rawBranches.map(b => b.id));
    const allBranches = [...rawBranches];
    for (const sale of rawSales) {
      if (sale.branchId && !uniqueBranchIds.has(sale.branchId)) {
        uniqueBranchIds.add(sale.branchId);
        allBranches.push({ id: sale.branchId, name: sale.branchName, companyId: sale.companyId } as any);
      }
    }

    const currentMonthPrefix = latestDate ? latestDate.substring(0, 7) : "";
    const getPrevMonthPrefix = (monthsAgo: number) => {
      if (!latestDate) return "";
      const parts = latestDate.split("-");
      let year = Number(parts[0]);
      let month = Number(parts[1]) - monthsAgo;
      while (month <= 0) {
        month += 12;
        year -= 1;
      }
      return `${year}-${String(month).padStart(2, "0")}`;
    };
    const month1Prefix = getPrevMonthPrefix(1);
    const month2Prefix = getPrevMonthPrefix(2);

    const hasAnySession = allBranches.some(b => getProductBranchSoh(stockOpen.productId, b.id) !== null);

    if (!hasAnySession && stockOpen.beforeCount > 0) {
      return [
        {
          store: "ALL STORES (BEFORE COUNT)",
          soh: stockOpen.beforeCount,
          doi: 0,
          mtd: 0,
          m1: 0,
          m2: 0
        }
      ];
    }

    return allBranches.map(branch => {
      const branchSohVal = getProductBranchSoh(stockOpen.productId, branch.id);
      const soh = branchSohVal !== null ? branchSohVal : 0;

      const getBranchMonthSales = (monthPrefix: string) => {
        const branchMonthSales = brandSales.filter(s => s.branchId === branch.id && s.saleDate.startsWith(monthPrefix));
        return branchMonthSales.reduce((sum, s) => {
          const items = s.items.filter(item => item.barcode === stockOpen.barcode);
          return sum + items.reduce((iSum, item) => iSum + (item.quantity || 0), 0);
        }, 0);
      };

      const mtd = getBranchMonthSales(currentMonthPrefix);
      const m1 = getBranchMonthSales(month1Prefix);
      const m2 = getBranchMonthSales(month2Prefix);

      const ads = mtd / daysElapsed;
      const doi = ads > 0 ? Math.round(soh / ads) : soh;

      return {
        store: branch.name || `Branch ${branch.id}`,
        soh,
        doi,
        mtd,
        m1,
        m2
      };
    }).filter(s => s.soh > 0 || s.mtd > 0 || s.m1 > 0 || s.m2 > 0);
  }, [stockOpen, rawBranches, rawSales, rawSessions, brandSales, latestDate, daysElapsed]);

  const dialogTotals = useMemo(() => {
    const soh = dialogStockByStore.reduce((sum, s) => sum + s.soh, 0);
    const mtd = dialogStockByStore.reduce((sum, s) => sum + s.mtd, 0);
    const m1 = dialogStockByStore.reduce((sum, s) => sum + s.m1, 0);
    const m2 = dialogStockByStore.reduce((sum, s) => sum + s.m2, 0);
    const ads = mtd / daysElapsed;
    const doi = ads > 0 ? Math.round(soh / ads) : soh;
    return { soh, doi, mtd, m1, m2 };
  }, [dialogStockByStore, daysElapsed]);

  const getPrevMonthPrefix = (monthsAgo: number) => {
    if (!latestDate) return "";
    const parts = latestDate.split("-");
    let year = Number(parts[0]);
    let month = Number(parts[1]) - monthsAgo;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, "0")}`;
  };

  const getMonthLabel = (offset: number) => {
    const prefix = getPrevMonthPrefix(offset);
    if (!prefix) return "";
    const m = Number(prefix.split("-")[1]);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[m - 1] || "";
  };

  const month1Label = getMonthLabel(1) || "Prev Month 1";
  const month2Label = getMonthLabel(2) || "Prev Month 2";

  // Dialog AVG Price Row
  const dialogAvgPrice = useMemo(() => {
    if (!stockOpen) return { mtd: 0, m1: 0, m2: 0 };
    const getMonthAvgPrice = (monthPrefix: string) => {
      const monthSales = brandSales.filter(s => s.saleDate.startsWith(monthPrefix));
      let totalRevenue = 0;
      let totalQty = 0;
      for (const s of monthSales) {
        for (const item of s.items) {
          if (item.barcode === stockOpen.barcode) {
            totalRevenue += item.revenue || 0;
            totalQty += item.quantity || 0;
          }
        }
      }
      return totalQty > 0 ? Math.round(totalRevenue / totalQty) : stockOpen.rsp || 0;
    };

    return {
      mtd: getMonthAvgPrice(latestDate ? latestDate.substring(0, 7) : ""),
      m1: getMonthAvgPrice(getPrevMonthPrefix(1)),
      m2: getMonthAvgPrice(getPrevMonthPrefix(2))
    };
  }, [stockOpen, brandSales, latestDate]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">กำลังโหลดข้อมูลสินค้า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Selling Products</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">Products</span>
        </div>
      </div>

      {/* Period Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-600">
            Revenue Period:
          </label>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(["Yesterday", "7 Days", "MTD", "Last Month"] as const).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                    period === p
                      ? "bg-pink-500 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Header and Search */}
      <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-4 rounded-xl shadow-sm border gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Selling Products</h2>
            <p className="text-xs text-gray-500">
              {mappedProducts.length} Products (Active:{" "}
              {mappedProducts.filter((p) => p.status === "ACTIVE").length} | TBD:{" "}
              {mappedProducts.filter((p) => p.status === "TBD").length})
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {(["All", "Active", "TBD"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  statusFilter === s
                    ? "bg-pink-500 text-white"
                    : "text-gray-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="text"
              placeholder="Search products code..."
              className="pl-9 pr-4 py-1.5 border rounded-lg text-sm w-[250px] outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
            />
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-pink-50 text-pink-800 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Image</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category 1</th>
                <th className="px-6 py-4">Category 2</th>
                <th className="px-6 py-4 text-right">RSP</th>
                <th className="px-6 py-4 text-right">Total Stock</th>
                <th className="px-6 py-4 text-right">Revenue</th>
                <th className="px-6 py-4 text-right">% Contribution</th>
              </tr>
              <tr className="bg-gray-50 border-b">
                <th colSpan={5} className="px-6 py-3 font-bold text-gray-900">
                  Total
                </th>
                <th className="px-6 py-3 font-bold text-gray-900 text-right">
                  {fmt(totals.stock)}
                </th>
                <th className="px-6 py-3 font-bold text-gray-900 text-right">
                  ฿{fmt(totals.revenue)}
                </th>
                <th className="px-6 py-3 font-bold text-gray-900 text-right">
                  100%
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.code} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-pink-600 font-medium">
                        {p.barcode}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                          p.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{p.cat1}</td>
                  <td className="px-6 py-4 text-gray-600">{p.cat2}</td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {p.rsp ? `฿${fmt(p.rsp)}` : "—"}
                  </td>
                  <td
                    onClick={() => setStockOpen(p)}
                    className="px-6 py-4 text-right font-medium text-pink-600 cursor-pointer hover:underline"
                  >
                    {fmt(p.totalStock)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-800 font-semibold">
                    ฿{fmt(p.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {p.contribution.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock On Hand Dialog */}
      {stockOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col relative">
            {/* Close Button (Absolute Top Right) */}
            <button
              onClick={() => setStockOpen(null)}
              className="absolute top-4 right-4 text-pink-500 bg-white border border-pink-500 hover:bg-pink-50 p-1 rounded-md z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="px-6 py-6 border-b flex items-center gap-6 relative">
              {/* Image Placeholder */}
              <div className="w-24 h-32 bg-[#eaf4ff] rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                <ImageIcon className="w-10 h-10 text-blue-200" />
                <div className="absolute top-2 left-2 text-[8px] font-bold text-blue-400">
                  {activeBrand.toLowerCase().replace(/\s+/g, "")}
                </div>
              </div>

              {/* Header Text (Centered) */}
              <div className="flex-1 text-center pr-12 space-y-1.5">
                <h3 className="font-bold text-gray-500 uppercase tracking-wider text-[15px]">
                  Stock On Hand By Store
                </h3>
                <div className="text-gray-700 font-medium text-[15px]">
                  {stockOpen.barcode}
                </div>
                <div className="text-gray-500 text-[15px]">
                  {stockOpen.name}
                </div>
                <div className="text-gray-500 text-[15px] pt-1">
                  RSP:{" "}
                  <span className="font-bold text-gray-900">
                    ฿{fmt(stockOpen.rsp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Table */}
            <div className="px-6 pb-6 overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full text-sm text-center relative border-collapse">
                <thead className="sticky top-0 z-20 shadow-sm bg-white outline outline-1 outline-white">
                  {/* Top Header Labels */}
                  <tr className="bg-white text-gray-500 font-bold text-[13px]">
                    <th className="px-4 py-3 text-left"></th>
                    <th className="px-4 py-3 w-24">
                      <span className="border-b-[1.5px] border-dotted border-gray-400 pb-0.5">
                        DOI
                      </span>
                    </th>
                    <th className="px-4 py-3">SOH</th>
                    <th className="px-4 py-3">MTD</th>
                    <th className="px-4 py-3">{month1Label}</th>
                    <th className="px-4 py-3">{month2Label}</th>
                  </tr>
                  {/* Total Row */}
                  <tr className="bg-[#fff5f8] text-gray-900 border-b border-white">
                    <td className="px-4 py-3 text-left font-bold text-[13px]">
                      Total (Unit Sold)
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded-full bg-[#d4e8c8] text-[#4A7830] font-bold">
                        {fmt(dialogTotals.doi)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-[15px]">{fmt(dialogTotals.soh)}</td>
                    <td className="px-4 py-3 font-bold text-[15px]">{fmt(dialogTotals.mtd)}</td>
                    <td className="px-4 py-3 font-bold text-[15px]">{fmt(dialogTotals.m1)}</td>
                    <td className="px-4 py-3 font-bold text-[15px]">{fmt(dialogTotals.m2)}</td>
                  </tr>
                  {/* AVG Selling Price Row */}
                  <tr className="bg-[#fffafd] text-gray-900 border-b border-gray-100">
                    <td className="px-4 py-3 text-left font-bold text-[13px]">
                      AVG Selling Price
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 font-bold text-[15px]">{dialogAvgPrice.mtd ? `฿${fmt(dialogAvgPrice.mtd)}` : "—"}</td>
                    <td className="px-4 py-3 font-bold text-[15px]">{dialogAvgPrice.m1 ? `฿${fmt(dialogAvgPrice.m1)}` : "—"}</td>
                    <td className="px-4 py-3 font-bold text-[15px]">{dialogAvgPrice.m2 ? `฿${fmt(dialogAvgPrice.m2)}` : "—"}</td>
                  </tr>
                  {/* Column Sub-Headers */}
                  <tr className="bg-white text-[13px] text-gray-500 shadow-[0_1px_2px_rgba(0,0,0,0.06)] relative z-10">
                    <th className="px-4 py-4 text-left font-bold text-gray-700 bg-white">
                      Store
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-600 bg-white">
                      DOI
                      <br />
                      <span className="text-[11px] font-normal opacity-80">
                        Days
                      </span>
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-600 bg-white">
                      SOH
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-400 bg-white">
                      MTD
                      <br />
                      <span className="text-[11px] font-normal">Unit Sold</span>
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-400 bg-white">
                      {month1Label}
                      <br />
                      <span className="text-[11px] font-normal">Unit Sold</span>
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-400 bg-white">
                      {month2Label}
                      <br />
                      <span className="text-[11px] font-normal">Unit Sold</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dialogStockByStore.map((s) => (
                    <tr
                      key={s.store}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-gray-800 font-medium text-left">
                        {s.store}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {s.doi > 0 ? (
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              s.doi > 100
                                ? "bg-[#d4e8c8] text-[#4A7830]"
                                : s.doi < 10
                                  ? "bg-[#ffe4e6] text-pink-600"
                                  : s.doi < 50
                                    ? "bg-[#fff4d1] text-orange-600"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {fmt(s.doi)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-800 font-medium">
                        {fmt(s.soh)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {fmt(s.mtd)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {fmt(s.m1)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {fmt(s.m2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
