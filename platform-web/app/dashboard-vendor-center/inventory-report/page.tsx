"use client";

import { Search, Download, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrand } from "../brand-context";
import { useActivityLogger } from "@/hooks/watson/useActivityLogger";
import { useAuthStore } from "@/stores/auth.store";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  buildInventoryRows,
  type InvEodDetailLite,
  type InvProductLite,
  type InvRow,
  type InvSaleLite,
} from "@/lib/reports/inventory-aggregate";
import * as XLSX from "xlsx";
import { toast } from "sonner";

// Loose shapes for the Firestore docs we read (only the fields we use).
interface ProductDoc {
  id: string;
  name?: string;
  sku?: string;
  productId?: string;
  barcode?: string;
}
interface SaleDoc {
  saleDate?: string;
  items?: { barcode?: string; quantity?: number }[];
}
interface EodEntry {
  details?: InvEodDetailLite[];
}

const fmt = (n: number) => n.toLocaleString("en-US");

const todayStr = () => new Date().toISOString().slice(0, 10);

const doiBadge = (doi: number, units: number) => {
  if (units === 0) return "bg-red-50 text-red-600 border-red-200";
  if (doi > 365) return "bg-amber-50 text-amber-700 border-amber-200";
  if (doi > 90) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-green-50 text-green-700 border-green-200";
};

export default function InventoryReport() {
  const { activeBrand } = useBrand();
  const { logAction } = useActivityLogger();
  const { user } = useAuthStore();

  const [rawProducts, setRawProducts] = useState<ProductDoc[]>([]);
  const [rawSales, setRawSales] = useState<SaleDoc[]>([]);
  const [eodDetails, setEodDetails] = useState<InvEodDetailLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [eodUnavailable, setEodUnavailable] = useState(false);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const loadData = useCallback(async () => {
    setLoading(true);
    setEodUnavailable(false);
    try {
      // Resolve the Phithan company (the vendor-center data lives under it).
      const companiesSnap = await getDocs(collection(db, "companies"));
      const phithan = companiesSnap.docs.find((d) => {
        const name = (d.data().name || "").toLowerCase();
        const code = (d.data().code || "").toLowerCase();
        return (
          name.includes("phithan") ||
          name.includes("พิธาน") ||
          code.includes("phithan")
        );
      });
      const companyId = phithan?.id || "";

      const productsRef = collection(db, "products");
      const productsSnap = await getDocs(
        companyId ? query(productsRef, where("companyId", "==", companyId)) : query(productsRef),
      );
      setRawProducts(
        productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as ProductDoc[],
      );

      const salesRef = collection(db, "dailySales");
      const salesSnap = await getDocs(
        companyId ? query(salesRef, where("companyId", "==", companyId)) : query(salesRef),
      );
      setRawSales(salesSnap.docs.map((d) => d.data()) as SaleDoc[]);

      // SOH comes from the Phithan EOD report (same source as the EOD-stock page).
      try {
        if (!user) throw new Error("no auth");
        const token = await user.getIdToken();
        const res = await fetch("/api/phithan-eod", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("eod fetch failed");
        const json = await res.json();
        const entries = (json.data ?? []) as EodEntry[];
        setEodDetails(entries.flatMap((e) => e.details ?? []));
      } catch {
        setEodDetails([]);
        setEodUnavailable(true);
      }
    } catch (err) {
      console.error("Error loading inventory report data:", err);
      toast.error("ไม่สามารถโหลดข้อมูลรายงานสินค้าได้");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
    const norm = (name || "").toLowerCase().replace(/\s+/g, "").trim();
    if (brand === "NEST ME") {
      return norm.includes("nestme") || norm.includes("fitt");
    }
    return norm.includes("primanest") || norm.includes("prima");
  };

  // All rows for the active brand (SKU/SOH/units/DOI from real data).
  const rows: InvRow[] = useMemo(() => {
    const products: InvProductLite[] = rawProducts
      .filter((p) => matchBrand(p.name || "", activeBrand))
      .map((p) => ({
        barcode: String(p.barcode ?? ""),
        sku: String(p.sku ?? p.productId ?? p.barcode ?? ""),
        name: String(p.name ?? ""),
      }));
    const sales: InvSaleLite[] = rawSales.map((s) => ({
      saleDate: String(s.saleDate ?? ""),
      items: (s.items ?? []).map((it) => ({
        barcode: String(it.barcode ?? ""),
        quantity: Number(it.quantity) || 0,
      })),
    }));
    return buildInventoryRows({
      products,
      sales,
      eod: eodDetails,
      brand: activeBrand,
      todayStr: todayStr(),
    });
  }, [rawProducts, rawSales, eodDetails, activeBrand]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.cat)))],
    [rows],
  );

  const filtered = useMemo(() => {
    let r = rows;
    if (cat !== "All") r = r.filter((x) => x.cat === cat);
    if (q)
      r = r.filter(
        (x) =>
          x.name.toLowerCase().includes(q.toLowerCase()) ||
          x.sku.toLowerCase().includes(q.toLowerCase()),
      );
    return r;
  }, [rows, q, cat]);

  const kpis = useMemo(() => {
    const totalSkus = rows.length;
    const totalStock = rows.reduce((a, r) => a + r.totalStock, 0);
    const nonMoving = rows.filter((r) => r.d30Units === 0).length;
    const withDoi = rows.filter((r) => r.d7DOI > 0);
    const avgDoi7 =
      withDoi.length === 0
        ? 0
        : Math.round(withDoi.reduce((a, r) => a + r.d7DOI, 0) / withDoi.length);
    return { totalSkus, totalStock, nonMoving, avgDoi7 };
  }, [rows]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const headers = [
      "SKU",
      "Product Name",
      "Category",
      "Total Stock (SOH)",
      "Yesterday Units",
      "Yesterday DOI",
      "7 Days Units",
      "7 Days DOI",
      "30 Days Units",
      "30 Days DOI",
    ];

    const rowsOut = filtered.map((r) => [
      r.sku,
      r.name,
      r.cat,
      r.totalStock,
      r.ydUnits,
      r.ydDOI,
      r.d7Units,
      r.d7DOI,
      r.d30Units,
      r.d30DOI,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rowsOut]);
    ws["!cols"] = [15, 35, 12, 12, 12, 12, 12, 12, 12, 12].map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Report");

    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_inventory_report_${todayStr()}.xlsx`;
    XLSX.writeFile(wb, fileName);

    logAction(
      "export_inventory",
      `ส่งออกรายงานการหมุนเวียนสินค้า (Inventory Report) (${filtered.length} รายการ)`,
      { rowCount: filtered.length, brand: activeBrand, categoryFilter: cat, fileName },
    );

    toast.success("ดาวน์โหลดไฟล์รายงานสินค้าเรียบร้อยแล้ว");
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto" />
          <p className="mt-4 text-gray-500 font-medium">กำลังโหลดรายงานสินค้า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Report</h1>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span>Vendor</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700">Inventory Report</span>
          </div>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 border bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> รีเฟรช
        </button>
      </div>

      {eodUnavailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          ดึงข้อมูลสต็อก (SOH) จาก Phithan EOD ไม่สำเร็จ — คอลัมน์ SOH/DOI จะแสดงเป็น 0
          ชั่วคราว (มักเกิดบน localhost ที่ IP ยังไม่ถูก allowlist กับ SQL)
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(kpis.totalSkus)}</p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Stock On Hand</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(kpis.totalStock)}</p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Non-moving (30d)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{fmt(kpis.nonMoving)}</p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Avg DOI (7d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(kpis.avgDoi7)} <span className="text-xs font-normal text-gray-500">days</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by SKU or product..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="bg-gray-50 px-3 py-2 rounded-md text-xs text-gray-700 hover:bg-gray-100 border"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={handleExport}
          className="ml-auto inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 rounded-md text-sm font-semibold cursor-pointer transition-colors"
        >
          <Download className="w-4 h-4" /> Export CSV/Excel
        </button>
      </div>

      {/* Grouped Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <th rowSpan={2} className="px-4 py-3 text-left border-b">SKU</th>
                <th rowSpan={2} className="px-4 py-3 text-left border-b">Product</th>
                <th rowSpan={2} className="px-4 py-3 text-left border-b">Cat</th>
                <th rowSpan={2} className="px-4 py-3 text-right border-b">SOH</th>
                <th colSpan={2} className="px-4 py-2 text-center border-b border-l bg-pink-50/60 text-pink-700">
                  Yesterday
                </th>
                <th colSpan={2} className="px-4 py-2 text-center border-b border-l bg-pink-50/40 text-pink-700">
                  Last 7 Days
                </th>
                <th colSpan={2} className="px-4 py-2 text-center border-b border-l bg-pink-50/20 text-pink-700">
                  Last 30 Days
                </th>
              </tr>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2 text-right border-b border-l">Units</th>
                <th className="px-4 py-2 text-right border-b">DOI</th>
                <th className="px-4 py-2 text-right border-b border-l">Units</th>
                <th className="px-4 py-2 text-right border-b">DOI</th>
                <th className="px-4 py-2 text-right border-b border-l">Units</th>
                <th className="px-4 py-2 text-right border-b">DOI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    ไม่พบข้อมูลสินค้าสำหรับแบรนด์ {activeBrand}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.sku} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.cat}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmt(r.totalStock)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-l">
                      {fmt(r.ydUnits)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(r.ydDOI, r.ydUnits)}`}
                      >
                        {r.ydUnits ? fmt(r.ydDOI) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-l">
                      {fmt(r.d7Units)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(r.d7DOI, r.d7Units)}`}
                      >
                        {r.d7Units ? fmt(r.d7DOI) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-l">
                      {fmt(r.d30Units)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(r.d30DOI, r.d30Units)}`}
                      >
                        {r.d30Units ? fmt(r.d30DOI) : "—"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-[11px] text-gray-500 bg-gray-50 border-t flex flex-wrap items-center gap-3">
          <Filter className="w-3 h-3" />
          SOH = Stock On Hand (Phithan EOD) · DOI = Days of Inventory (Stock ÷ Avg Daily Sales) · Cat = แบรนด์
          <span className="inline-flex items-center gap-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Healthy
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" /> Watch
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Slow
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Non-moving
          </span>
        </div>
      </div>
    </div>
  );
}
