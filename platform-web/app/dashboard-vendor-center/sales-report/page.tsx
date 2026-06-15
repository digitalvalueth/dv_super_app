"use client";

import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useBrand } from "../brand-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getPromotionData } from "@/lib/watson-firebase";
import { PromotionItem } from "@/types/watson/promotion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { useActivityLogger } from "@/hooks/watson/useActivityLogger";
import {
  flattenToItemRows,
  distinctBillCount,
  computeTotals,
} from "@/lib/reports/sales-filter";
import type { DailySale as ReportDailySale } from "@/lib/reports/types";

// Cache for Thai font base64 (Google Sans) used in PDF export
let thaiFontBase64Cache: string | null = null;

async function loadThaiFontBase64(): Promise<string | null> {
  if (thaiFontBase64Cache) return thaiFontBase64Cache;
  try {
    const response = await fetch("/GoogleSans-VariableFont.ttf");
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    thaiFontBase64Cache = btoa(binary);
    return thaiFontBase64Cache;
  } catch {
    return null;
  }
}

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

export default function SalesReport() {
  const { activeBrand } = useBrand();
  const { logAction } = useActivityLogger();
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawSales, setRawSales] = useState<DailySale[]>([]);
  const [rawSessions, setRawSessions] = useState<CountingSession[]>([]);
  const [rawBranches, setRawBranches] = useState<Branch[]>([]);
  const [rawPromotions, setRawPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [storeFilter, setStoreFilter] = useState("All Stores");
  const [employeeFilter, setEmployeeFilter] = useState("All Salespersons");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [q, setQ] = useState("");
  const [activePeriodBtn, setActivePeriodBtn] = useState("Yesterday");
  const [promoOpen, setPromoOpen] = useState<any | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<string>("date");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

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
        console.error("Error loading sales report data:", err);
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

  // Available months list for select filter
  const availableMonths = useMemo(() => {
    const prefixes = Array.from(new Set(sortedDates.map(d => d.substring(0, 7))));
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return prefixes.map(p => {
      const parts = p.split("-");
      const y = parts[0];
      const m = Number(parts[1]);
      return {
        value: p,
        label: `${months[m - 1]} ${y}`
      };
    });
  }, [sortedDates]);

  useEffect(() => {
    if (latestDate) {
      setStartDate(latestDate);
      setEndDate(latestDate);
      setActivePeriodBtn("Yesterday");
    }
  }, [latestDate]);

  const formatDateToYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const setPeriodFilter = (p: string) => {
    if (!latestDate) return;
    setActivePeriodBtn(p);
    
    const parts = latestDate.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    
    if (p === "Yesterday") {
      setStartDate(latestDate);
      setEndDate(latestDate);
    } else if (p === "7 Days") {
      const d = new Date(year, month - 1, day - 6);
      setStartDate(formatDateToYmd(d));
      setEndDate(latestDate);
    } else if (p === "MTD") {
      setStartDate(`${year}-${String(month).padStart(2, "0")}-01`);
      setEndDate(latestDate);
    } else if (p === "Last Month") {
      let lm = month - 1;
      let ly = year;
      if (lm === 0) {
        lm = 12;
        ly -= 1;
      }
      const firstDay = `${ly}-${String(lm).padStart(2, "0")}-01`;
      const lastDayDate = new Date(ly, lm, 0);
      setStartDate(firstDay);
      setEndDate(formatDateToYmd(lastDayDate));
    } else if (p === "YTD") {
      setStartDate(`${year}-01-01`);
      setEndDate(latestDate);
    } else if (p === "Last Year") {
      setStartDate(`${year - 1}-01-01`);
      setEndDate(`${year - 1}-12-31`);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${parts[2]} ${months[d.getMonth()]} ${parts[0]}`;
  };

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

  const getProductTotalStock = (productId: string, beforeCountVal?: number) => {
    let total = 0;
    let hasSession = false;
    for (const branch of rawBranches) {
      const soh = getProductBranchSoh(productId, branch.id);
      if (soh !== null) {
        total += soh;
        hasSession = true;
      }
    }
    if (!hasSession && beforeCountVal) {
      return beforeCountVal;
    }
    return total;
  };

  const storeNames = useMemo(() => {
    const names = Array.from(new Set(rawSales.map(s => s.branchName).filter(Boolean)));
    return ["All Stores", ...names];
  }, [rawSales]);

  const employeeNames = useMemo(() => {
    const names = Array.from(new Set(rawSales.map(s => s.employeeName).filter(Boolean)));
    return ["All Salespersons", ...names];
  }, [rawSales]);

  // Flatten and filter daily sales items.
  // Also collect the set of distinct sale (bill) doc ids that survive the filters,
  // so the transaction/bill count metric stays in sync with the filtered dataset.
  const { rows: salesRows, billCount } = useMemo(() => {
    // The pure filter pipeline (store / employee / date / search) and the
    // distinct-bill count live in lib/reports/sales-filter; the per-row
    // enrichment (RSP lookup, date formatting, brand) stays here because it
    // depends on Firestore-loaded products/sales and the active brand.
    const filters = {
      startDate,
      endDate,
      branch: storeFilter,
      employee: employeeFilter,
      query: q,
    };

    const rows = flattenToItemRows(
      brandSales as ReportDailySale[],
      filters,
    ).map(({ sale, item }) => {
      const prod = brandProducts.find(p => p.barcode === item.barcode);
      const productRsp = prod?.beforeCount ? Math.max(...rawSales.flatMap(s => s.items).filter(i => i.barcode === item.barcode).map(i => i.price || 0)) : item.price;

      return {
        date: formatDateString(sale.saleDate),
        rawDate: sale.saleDate,
        brand: activeBrand,
        store: sale.branchName,
        employee: sale.employeeName || "—",
        code: item.barcode || "—",
        name: item.productDescription || "สินค้าไม่ระบุชื่อ",
        status: (prod?.status || "ACTIVE").toUpperCase(),
        rsp: productRsp || item.price,
        units: item.quantity || 0,
        revenue: item.revenue || 0,
        unitSellingPrice: item.quantity > 0 ? (item.revenue / item.quantity) : item.price,
        productId: prod?.productId || ""
      };
    });

    return {
      rows,
      billCount: distinctBillCount(brandSales as ReportDailySale[], filters),
    };
  }, [brandSales, storeFilter, employeeFilter, startDate, endDate, q, brandProducts, activeBrand]);

  const handleExport = () => {
    if (salesRows.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const headers = [
      "Date",
      "Brand",
      "Store",
      "Product Code",
      "Product Name",
      "Status",
      "RSP (THB)",
      "Units Sold",
      "Revenue (THB)",
      "Unit Selling Price (THB)"
    ];

    const rows = sortedRows.map((r) => [
      r.date,
      r.brand,
      r.store,
      r.code,
      r.name,
      r.status,
      r.rsp,
      r.units,
      r.revenue,
      Math.round(r.unitSellingPrice)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [15, 12, 25, 15, 35, 10, 12, 12, 14, 18].map((w) => ({ wch: w }));
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    
    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_sales_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    logAction("export_sales", `ส่งออกรายงานยอดขายย้อนหลังสัปดาห์/เดือน (${sortedRows.length} รายการ)`, {
      rowCount: sortedRows.length,
      brand: activeBrand,
      startDate: startDate || "All Time",
      endDate: endDate || "All Time",
      store: storeFilter,
      fileName
    });
    
    toast.success("ดาวน์โหลดไฟล์รายงานยอดขายเรียบร้อยแล้ว");
  };

  const handleExportPdf = async () => {
    if (salesRows.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Register Thai font (Google Sans). If it fails, fall back to helvetica;
    // Thai glyphs may not render with the fallback but numeric/code columns stay intact.
    let fontName = "helvetica";
    try {
      const fontBase64 = await loadThaiFontBase64();
      if (fontBase64) {
        doc.addFileToVFS("GoogleSans.ttf", fontBase64);
        doc.addFont("GoogleSans.ttf", "GoogleSans", "normal");
        fontName = "GoogleSans";
      }
    } catch {
      fontName = "helvetica";
    }

    // Title
    doc.setFont(fontName, "normal");
    doc.setFontSize(16);
    doc.text("Sales Report", pageWidth / 2, 15, { align: "center" });

    // Active filter summary (date range, branch, salesperson)
    const dateRange =
      startDate && endDate
        ? `${formatDateString(startDate)} - ${formatDateString(endDate)}`
        : "All Time";
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    const summaryLine1 = `Brand: ${activeBrand}    Date: ${dateRange}`;
    const summaryLine2 = `Store: ${storeFilter}    Salesperson: ${employeeFilter}`;
    doc.text(summaryLine1, 14, 23);
    doc.text(summaryLine2, 14, 28);
    doc.text(
      `Bills: ${fmt(billCount)}    Units Sold: ${fmt(totalUnits)}    Revenue: ${fmt(totalRevenue)} THB`,
      14,
      33,
    );
    doc.setTextColor(0, 0, 0);

    const head = [[
      "Date",
      "Brand",
      "Store",
      "Product Code",
      "Product Name",
      "Status",
      "RSP (THB)",
      "Units Sold",
      "Revenue (THB)",
      "Unit Selling Price (THB)",
    ]];

    const body = sortedRows.map((r) => [
      r.date,
      r.brand,
      r.store,
      r.code,
      r.name,
      r.status,
      fmt(r.rsp),
      fmt(r.units),
      fmt(r.revenue),
      fmt(Math.round(r.unitSellingPrice)),
    ]);

    autoTable(doc, {
      startY: 38,
      head,
      body,
      theme: "striped",
      headStyles: { fillColor: [229, 0, 126], fontSize: 7, font: fontName },
      styles: { fontSize: 7, cellPadding: 1.5, font: fontName, overflow: "linebreak" },
      columnStyles: {
        4: { cellWidth: 50 },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "right" },
        9: { halign: "right" },
      },
    });

    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_sales_report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);

    logAction("export_sales", `ส่งออกรายงานยอดขาย (PDF, ${sortedRows.length} รายการ)`, {
      rowCount: sortedRows.length,
      brand: activeBrand,
      startDate: startDate || "All Time",
      endDate: endDate || "All Time",
      store: storeFilter,
      employee: employeeFilter,
      fileName,
      format: "pdf",
    });

    toast.success("ดาวน์โหลดไฟล์ PDF รายงานยอดขายเรียบร้อยแล้ว");
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedRows = useMemo(() => {
    const r = [...salesRows];
    r.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a];
      let valB: any = b[sortField as keyof typeof b];

      if (sortField === "date") {
        valA = a.rawDate;
        valB = b.rawDate;
      }

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });
    return r;
  }, [salesRows, sortField, sortAsc]);

  // Summary totals for the currently-filtered dataset
  const { revenue: totalRevenue, units: totalUnits } = useMemo(
    () => computeTotals(salesRows),
    [salesRows]
  );

  function HeaderLabel({ label, field }: { label: string; field: string }) {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className="px-4 py-4 text-center cursor-pointer select-none hover:text-pink-600 font-bold whitespace-nowrap"
      >
        <div className="flex items-center justify-center gap-1">
          {label}{" "}
          <span className="text-[10px] text-gray-400">
            {isSorted ? (sortAsc ? "▲" : "▼") : "↑↓"}
          </span>
        </div>
      </th>
    );
  }

  // Active Promo Details for the Modal
  const modalPromoDetails = useMemo(() => {
    if (!promoOpen) return null;
    const barcode = promoOpen.code;
    
    // Find active promotion
    const activePromo = rawPromotions.find(p => p.barcode === barcode);
    const prod = brandProducts.find(p => p.barcode === barcode);
    
    const soh = prod ? getProductTotalStock(prod.productId, prod.beforeCount) : 0;

    // Calculate product total revenue in selected period
    const revenue = salesRows.filter(r => r.code === barcode).reduce((sum, r) => sum + r.revenue, 0);

    if (activePromo) {
      const discountPct = activePromo.stdPrice > 0 && activePromo.commPrice 
        ? ((activePromo.stdPrice - activePromo.commPrice) / activePromo.stdPrice) * 100 
        : 0;

      return {
        id: activePromo.remark || `${activeBrand.toUpperCase()}-PROMO-${activePromo.itemCode || "01"}`,
        name: activePromo.itemName || promoOpen.name,
        barcode: activePromo.barcode || barcode,
        promoStart: activePromo.promoStart ? formatDateString(formatDateToYmd(activePromo.promoStart)) : "—",
        promoEnd: activePromo.promoEnd ? formatDateString(formatDateToYmd(activePromo.promoEnd)) : "—",
        promoPrice: activePromo.commPrice || promoOpen.unitSellingPrice,
        stdPrice: activePromo.stdPrice || promoOpen.rsp,
        discount: discountPct > 0 ? `-${discountPct.toFixed(1)}%` : "0%",
        soh,
        revenue,
        remark: activePromo.remark || "Saving"
      };
    }

    return {
      id: "STANDARD PRICE",
      name: promoOpen.name,
      barcode: barcode,
      promoStart: "—",
      promoEnd: "—",
      promoPrice: promoOpen.unitSellingPrice,
      stdPrice: promoOpen.rsp,
      discount: "0%",
      soh,
      revenue,
      remark: "Standard"
    };
  }, [promoOpen, rawPromotions, brandProducts, salesRows, activeBrand]);

  // Promotions List for active brand inside Modal
  const dialogPromotionsList = useMemo(() => {
    if (!promoOpen) return [];
    
    return rawPromotions.filter(p => matchBrand(p.itemName || "", activeBrand)).map(item => {
      const discountPct = item.stdPrice > 0 && item.commPrice 
        ? ((item.stdPrice - item.commPrice) / item.stdPrice) * 100 
        : 0;

      const prod = brandProducts.find(p => p.barcode === item.barcode);
      const soh = prod ? getProductTotalStock(prod.productId, prod.beforeCount) : 0;
      
      const revenue = salesRows.filter(r => r.code === item.barcode).reduce((sum, r) => sum + r.revenue, 0);

      return {
        name: item.itemName,
        barcode: item.barcode || "—",
        promoPrice: item.commPrice || 0,
        rsp: item.stdPrice || 0,
        discount: discountPct > 0 ? `-${discountPct.toFixed(1)}%` : "0%",
        revenue,
        soh
      };
    });
  }, [promoOpen, rawPromotions, brandProducts, salesRows, activeBrand]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">กำลังโหลดรายงานยอดขาย...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Report</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span className="cursor-pointer hover:underline">Home</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Reports</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">Sales</span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        {/* Row 1: Revenue Period */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-[13px] font-semibold text-gray-700">
            Revenue Period:
          </label>
          <div className="relative">
            <select 
              onChange={(e) => {
                if (e.target.value) {
                  setStartDate(`${e.target.value}-01`);
                  const parts = e.target.value.split("-");
                  const lastDay = new Date(Number(parts[0]), Number(parts[1]), 0);
                  setEndDate(formatDateToYmd(lastDay));
                  setActivePeriodBtn("");
                }
              }}
              className="appearance-none pl-3 pr-8 py-1.5 border rounded-md text-sm text-gray-700 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 cursor-pointer"
            >
              <option value="">Select Month</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {startDate && endDate && (
            <span className="text-sm text-gray-500">
              {formatDateString(startDate)} - {formatDateString(endDate)}
            </span>
          )}
        </div>

        {/* Row 2: Period Buttons */}
        <div className="flex flex-wrap gap-2">
          {["Yesterday", "7 Days", "MTD", "Last Month", "YTD", "Last Year"].map(
            (p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-4 py-1.5 text-[13px] rounded-full font-semibold transition-colors ${
                  activePeriodBtn === p
                    ? "bg-[#E5007E] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Row 3: Date Selectors & Store */}
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Start Date:
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePeriodBtn("");
                }}
                className="pl-3 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              End Date:
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePeriodBtn("");
                }}
                className="pl-3 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500 cursor-pointer"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Store:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
                className="w-40 px-3 py-1.5 border border-pink-500 rounded-md text-sm focus:outline-none cursor-pointer"
              >
                {storeNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setStoreFilter("All Stores");
                  setEmployeeFilter("All Salespersons");
                  setQ("");
                  if (latestDate) {
                    setStartDate(latestDate);
                    setEndDate(latestDate);
                    setActivePeriodBtn("Yesterday");
                  }
                }}
                className="p-1.5 border rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              พนักงานขาย:
            </label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-44 px-3 py-1.5 border border-pink-500 rounded-md text-sm focus:outline-none cursor-pointer"
            >
              {employeeNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Search:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Product name/code..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-3 py-1.5 border rounded-md text-sm w-[200px] focus:outline-none focus:border-pink-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">จำนวนบิล/รายการขาย</p>
          <p className="mt-1 text-2xl font-bold text-[#E5007E]">{fmt(billCount)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">Units Sold</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{fmt(totalUnits)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">Total Revenue (THB)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">฿{fmt(totalRevenue)}</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/50 border-b flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Daily sales data</h3>
            <p className="text-xs text-gray-500">{salesRows.length} Records</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="bg-pink-50 text-gray-700 text-[11px] uppercase tracking-wider">
              <tr>
                <HeaderLabel label="Date" field="date" />
                <HeaderLabel label="Brand" field="brand" />
                <HeaderLabel label="Store" field="store" />
                <HeaderLabel label="Product Code" field="code" />
                <th 
                  onClick={() => handleSort("name")}
                  className="px-4 py-4 text-left cursor-pointer select-none hover:text-pink-600 font-bold"
                >
                  <div className="flex items-center gap-1">
                    Product Name{" "}
                    <span className="text-[10px] text-gray-400">
                      {sortField === "name" ? (sortAsc ? "▲" : "▼") : "↑↓"}
                    </span>
                  </div>
                </th>
                <HeaderLabel label="Status" field="status" />
                <HeaderLabel label="RSP" field="rsp" />
                <HeaderLabel label="Units Sold" field="units" />
                <HeaderLabel label="Revenue (THB)" field="revenue" />
                <HeaderLabel label="Unit Selling Price" field="unitSellingPrice" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRows.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 text-gray-800 whitespace-nowrap">
                    {t.date}
                  </td>
                  <td className="px-4 py-4 text-gray-600">{t.brand}</td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    {t.store}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      onClick={() => setPromoOpen(t)}
                      className="inline-flex items-center gap-1.5 text-[#E5007E] font-medium cursor-pointer hover:underline"
                    >
                      {t.code} <Tag className="w-3.5 h-3.5" />
                    </span>
                  </td>
                  <td className="px-4 py-4 text-left text-gray-800">
                    {t.name}
                  </td>
                  <td className="px-4 py-4 text-gray-600">{t.status}</td>
                  <td className="px-4 py-4 text-gray-800">฿{fmt(t.rsp)}</td>
                  <td className="px-4 py-4 text-gray-800">{fmt(t.units)}</td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    {fmt(t.revenue)}
                  </td>
                  <td className="px-4 py-4 text-gray-800 font-medium">
                    ฿{fmt(Math.round(t.unitSellingPrice))}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400 font-medium">
                    ไม่พบข้อมูลยอดขายในช่วงที่กำหนด
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Promotions Dialog */}
      {promoOpen && modalPromoDetails && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col relative">
            <button
              onClick={() => setPromoOpen(null)}
              className="absolute top-4 right-4 text-[#E5007E] bg-white border border-[#E5007E] hover:bg-pink-50 p-1 rounded-md z-10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="px-8 py-8 border-b flex flex-col relative bg-white">
              {/* Badges */}
              <div className="absolute top-8 right-16 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E5007E] text-white flex flex-col items-center justify-center text-[10px] font-bold leading-tight shadow-sm">
                  <span className="text-sm">1</span>
                  SAVING
                </div>
                <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 text-gray-500 flex flex-col items-center justify-center text-[10px] font-bold leading-tight shadow-sm">
                  <span className="text-sm">2</span>
                  BMSM
                </div>
              </div>

              <div className="flex w-full items-start gap-8">
                {/* Image Placeholder */}
                <div className="w-28 h-36 bg-[#eaf4ff] rounded-xl flex items-center justify-center shrink-0 relative overflow-hidden border border-gray-100 shadow-sm">
                  <ImageIcon className="w-10 h-10 text-blue-200" />
                  <div className="absolute top-3 left-3 text-[10px] font-bold text-blue-400">
                    {activeBrand.toLowerCase().replace(/\s+/g, "")}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 pr-24 pt-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-3">
                    Product Promotions
                  </h3>
                  <div className="text-[#E5007E] font-bold text-sm mb-1.5 tracking-wide">
                    {modalPromoDetails.id}{" "}
                    <span className="text-gray-500">({modalPromoDetails.barcode})</span>
                  </div>
                  <div className="text-gray-800 text-[15px] mb-3 font-medium">
                    {modalPromoDetails.name}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div>{modalPromoDetails.promoStart} - {modalPromoDetails.promoEnd}</div>
                    <div className="uppercase tracking-wider font-semibold text-gray-600">
                      {modalPromoDetails.remark}
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[#E5007E] font-extrabold text-2xl">
                        ฿{fmt(Math.round(modalPromoDetails.promoPrice))}
                      </span>
                      {modalPromoDetails.stdPrice > 0 && (
                        <>
                          <span className="text-gray-400 line-through text-[15px]">
                            ฿{fmt(Math.round(modalPromoDetails.stdPrice))}
                          </span>
                          <span className="bg-pink-100 text-[#E5007E] text-xs font-bold px-2 py-0.5 rounded-md">
                            {modalPromoDetails.discount}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1.5">
                      SOH:{" "}
                      <span className="font-bold text-[#E5007E]">{fmt(modalPromoDetails.soh)}</span>{" "}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="text-sm">
                      Revenue:{" "}
                      <span className="font-bold text-gray-900">฿{fmt(modalPromoDetails.revenue)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex">
              <button className="flex-1 py-3.5 text-center border-b-2 border-gray-900 text-gray-900 font-bold text-sm bg-white tracking-wide">
                Related Products
              </button>
              <button className="flex-1 py-3.5 text-center border-b-2 border-transparent text-gray-400 font-medium text-sm hover:text-gray-600 bg-gray-50/50 tracking-wide">
                Free Gifts
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto custom-scrollbar flex-1 bg-white p-2">
              <div className="divide-y divide-gray-100">
                {dialogPromotionsList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center p-4 hover:bg-gray-50 transition-colors rounded-xl"
                  >
                    {/* Small Image */}
                    <div className="w-12 h-16 bg-[#eaf4ff] rounded border border-gray-100 flex items-center justify-center shrink-0 mr-5 relative">
                      <ImageIcon className="w-5 h-5 text-blue-200" />
                      <div className="absolute top-1 left-0 right-0 text-center text-[6px] font-bold text-blue-400">
                        {activeBrand.toLowerCase().replace(/\s+/g, "")}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="text-gray-800 text-sm font-semibold leading-tight mb-1 truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {item.barcode}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="text-right shrink-0 min-w-32.5">
                      <div className="text-xs text-gray-500 mb-1">
                        Promo Price:{" "}
                        <span className="text-[#E5007E] font-bold text-[15px]">
                          ฿{fmt(Math.round(item.promoPrice))}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mb-1">
                        RSP:{" "}
                        <span className="line-through text-gray-800 font-semibold mr-1.5">
                          ฿{fmt(Math.round(item.rsp))}
                        </span>
                        <span className="font-bold text-gray-800">
                          {item.discount}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-1">
                        Revenue:{" "}
                        <span className="font-bold text-gray-800">
                          ฿{fmt(item.revenue)}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center justify-end gap-1.5">
                        SOH:{" "}
                        <span className="font-bold text-[#E5007E]">
                          {fmt(item.soh)}
                        </span>{" "}
                      </div>
                    </div>
                  </div>
                ))}
                {dialogPromotionsList.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    ไม่มีโปรโมชั่นอื่นในแบรนด์นี้
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
