"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useBrand } from "../brand-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { previousPeriodRange } from "@/lib/reports/period";
import { aggregateByProduct } from "@/lib/reports/aggregate";

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

type Product = {
  code: string;
  name: string;
  unitsSold: number;
  revenue: number;
  revenuePrev: number;
  growth: number;
  contribution: number;
  byStore: { store: string; units: number; revenue: number }[];
};

const fmt = (n: number) => n.toLocaleString("en-US");

type SortKey =
  | "name"
  | "code"
  | "unitsSold"
  | "revenue"
  | "revenuePrev"
  | "growth"
  | "contribution";

const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
  const norm = (name || "").toLowerCase().replace(/\s+/g, "").trim();
  if (brand === "NEST ME") {
    return norm.includes("nestme") || norm.includes("nest me");
  }
  return norm.includes("primanest") || norm.includes("prima");
};

const formatDateToYmd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDateString = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parts[2]} ${months[d.getMonth()]} ${parts[0]}`;
};

async function registerThaiFont(doc: jsPDF): Promise<boolean> {
  try {
    const response = await fetch("/GoogleSans-VariableFont.ttf");
    if (!response.ok) return false;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    doc.addFileToVFS("GoogleSans.ttf", base64);
    doc.addFont("GoogleSans.ttf", "GoogleSans", "normal");
    return true;
  } catch {
    return false;
  }
}

function Header({
  k,
  label,
  align = "left",
  sortKey,
  sortDir,
  onSort,
}: {
  k: SortKey;
  label: string;
  align?: "left" | "right";
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      className={`px-4 py-3 text-${align} cursor-pointer select-none hover:text-pink-600`}
      onClick={() => onSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k &&
          (sortDir === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          ))}
      </span>
    </th>
  );
}

export default function Page() {
  const { activeBrand } = useBrand();
  const [rawSales, setRawSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePeriodBtn, setActivePeriodBtn] = useState("7 Days");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const companiesSnap = await getDocs(collection(db, "companies"));
        const phithan = companiesSnap.docs.find((d) => {
          const name = (d.data().name || "").toLowerCase();
          const code = (d.data().code || "").toLowerCase();
          return name.includes("phithan") || name.includes("พิธาน") || code.includes("phithan");
        });
        const targetCompanyId = phithan?.id || "";

        const salesRef = collection(db, "dailySales");
        const salesQuery = targetCompanyId
          ? query(salesRef, where("companyId", "==", targetCompanyId))
          : query(salesRef);
        const salesSnap = await getDocs(salesQuery);
        setRawSales(salesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as DailySale[]);
      } catch (err) {
        console.error("Error loading by-product data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const brandSales = useMemo(() => {
    return rawSales
      .map((sale) => {
        const brandItems = (sale.items || []).filter((item) =>
          matchBrand(item.productDescription || "", activeBrand),
        );
        if (brandItems.length === 0) return null;
        return { ...sale, items: brandItems };
      })
      .filter(Boolean) as DailySale[];
  }, [rawSales, activeBrand]);

  const sortedDates = useMemo(() => {
    const dates = brandSales.map((s) => s.saleDate).filter(Boolean);
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [brandSales]);

  const latestDate = sortedDates[0] || "";

  useEffect(() => {
    if (latestDate) {
      const parts = latestDate.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 6);
      setStartDate(formatDateToYmd(d));
      setEndDate(latestDate);
      setActivePeriodBtn("7 Days");
    }
  }, [latestDate]);

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
    }
  };

  const prevWindow = useMemo(
    () => previousPeriodRange(startDate, endDate),
    [startDate, endDate],
  );

  const products = useMemo<Product[]>(
    () =>
      aggregateByProduct(
        brandSales,
        { start: startDate, end: endDate },
        prevWindow,
      ),
    [brandSales, startDate, endDate, prevWindow],
  );

  const filtered = useMemo(() => {
    let r = products;
    if (q) {
      r = r.filter(
        (x) =>
          x.name.toLowerCase().includes(q.toLowerCase()) ||
          x.code.toLowerCase().includes(q.toLowerCase()),
      );
    }
    return [...r].sort((a, b) => {
      const va = a[sortKey] as string | number;
      const vb = b[sortKey] as string | number;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [products, sortKey, sortDir, q]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const totals = filtered.reduce(
    (acc, p) => ({
      unitsSold: acc.unitsSold + p.unitsSold,
      revenue: acc.revenue + p.revenue,
      revenuePrev: acc.revenuePrev + p.revenuePrev,
    }),
    { unitsSold: 0, revenue: 0, revenuePrev: 0 },
  );

  const periodLabel =
    startDate && endDate ? `${formatDateString(startDate)} - ${formatDateString(endDate)}` : "";

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }
    const headers = [
      "#",
      "Code",
      "Product",
      "Units Sold",
      "Revenue (THB)",
      "Prev Period (THB)",
      "% Growth",
      "% Contribution",
    ];
    const body = filtered.map((p, i) => [
      i + 1,
      p.code,
      p.name,
      p.unitsSold,
      Math.round(p.revenue),
      Math.round(p.revenuePrev),
      `${p.growth >= 0 ? "+" : ""}${p.growth.toFixed(1)}%`,
      `${p.contribution.toFixed(1)}%`,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [`By Product - ${activeBrand} - ${periodLabel}`],
      [],
      headers,
      ...body,
    ]);
    ws["!cols"] = [6, 18, 38, 12, 16, 16, 12, 14].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "By Product");
    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_by_product_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("ดาวน์โหลดไฟล์ Excel เรียบร้อยแล้ว");
  };

  const handleExportPDF = async () => {
    if (filtered.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }
    const doc = new jsPDF();
    const hasThai = await registerThaiFont(doc);
    const fontName = hasThai ? "GoogleSans" : "helvetica";
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont(fontName, "normal");
    doc.setFontSize(16);
    doc.text("By Product Sales Report", pageWidth / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text(`${activeBrand}  |  ${periodLabel}`, pageWidth / 2, 25, { align: "center" });

    autoTable(doc, {
      startY: 32,
      head: [["#", "Code", "Product", "Units", "Revenue", "Prev Period", "% Growth", "% Contrib"]],
      body: filtered.map((p, i) => [
        (i + 1).toString(),
        p.code,
        p.name,
        fmt(p.unitsSold),
        fmt(Math.round(p.revenue)),
        fmt(Math.round(p.revenuePrev)),
        `${p.growth >= 0 ? "+" : ""}${p.growth.toFixed(1)}%`,
        `${p.contribution.toFixed(1)}%`,
      ]),
      foot: [
        [
          "",
          "",
          "TOTAL",
          fmt(totals.unitsSold),
          fmt(Math.round(totals.revenue)),
          fmt(Math.round(totals.revenuePrev)),
          "",
          "100.0%",
        ],
      ],
      theme: "striped",
      styles: { font: fontName, fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [229, 0, 126], font: fontName, fontSize: 7 },
      footStyles: { fillColor: [252, 231, 243], textColor: [0, 0, 0], font: fontName, fontStyle: "normal" },
      columnStyles: { 2: { cellWidth: 50 } },
    });

    const fileName = `${activeBrand.toLowerCase().replace(/\s+/g, "_")}_by_product_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
    if (!hasThai) {
      toast.warning("ส่งออก PDF แล้ว (ฟอนต์ไทยไม่พร้อมใช้งาน ข้อความไทยอาจแสดงไม่ถูกต้อง)");
    } else {
      toast.success("ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">กำลังโหลดข้อมูลยอดขายตามสินค้า...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <Link
          href="/dashboard-vendor-center"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-pink-600 mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard / By Product</h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">By Product</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {["Yesterday", "7 Days", "MTD", "Last Month", "YTD"].map((p) => (
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
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[13px] font-semibold text-gray-700">Start:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePeriodBtn("");
              }}
              className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[13px] font-semibold text-gray-700">End:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePeriodBtn("");
              }}
              className="px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-pink-500"
            />
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
        {periodLabel && (
          <div className="text-xs text-gray-500">
            แสดงยอดขายแบรนด์ <span className="font-semibold text-gray-700">{activeBrand}</span> ช่วง{" "}
            {periodLabel} (เทียบกับช่วงก่อนหน้า {prevWindow.prevStart && formatDateString(prevWindow.prevStart)} -{" "}
            {prevWindow.prevEnd && formatDateString(prevWindow.prevEnd)})
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left w-10"></th>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Image</th>
                <Header k="code" label="Code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="name" label="Product" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="unitsSold" label="Unit Sold" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="revenue" label="Revenue" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="revenuePrev" label="Prev Period" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="growth" label="% Growth" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Header k="contribution" label="%Contrib" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p, i) => (
                <Fragment key={p.code + p.name}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded((e) => (e === p.code + p.name ? null : p.code + p.name))}
                        className="text-gray-400 hover:text-pink-600"
                      >
                        {expanded === p.code + p.name ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(p.unitsSold)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">฿{fmt(Math.round(p.revenue))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">฿{fmt(Math.round(p.revenuePrev))}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.revenuePrev === 0 ? "text-gray-400" : p.growth >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {p.revenuePrev === 0 ? "—" : `${p.growth >= 0 ? "+" : ""}${p.growth.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full bg-pink-500" style={{ width: `${p.contribution}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">
                          {p.contribution.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expanded === p.code + p.name && (
                    <tr className="bg-pink-50/50">
                      <td colSpan={10} className="px-12 py-4">
                        <div className="text-xs font-bold text-pink-600 uppercase tracking-wider mb-2">
                          Sales by Store
                        </div>
                        {p.byStore.length === 0 ? (
                          <div className="text-xs text-gray-400">ไม่มียอดขายตามสาขาในช่วงนี้</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {p.byStore.map((s) => (
                              <div
                                key={s.store}
                                className="bg-white border rounded-md px-3 py-2 flex justify-between items-center"
                              >
                                <span className="text-xs text-gray-600">{s.store}</span>
                                <span className="text-xs text-gray-500">
                                  {fmt(s.units)} ชิ้น /{" "}
                                  <span className="font-bold text-gray-900">฿{fmt(Math.round(s.revenue))}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400 font-medium">
                    ไม่พบข้อมูลยอดขายในช่วงที่กำหนด
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-pink-50 font-bold text-gray-900">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right">{fmt(totals.unitsSold)}</td>
                  <td className="px-4 py-3 text-right">฿{fmt(Math.round(totals.revenue))}</td>
                  <td className="px-4 py-3 text-right">฿{fmt(Math.round(totals.revenuePrev))}</td>
                  <td className="px-4 py-3 text-right text-gray-500">—</td>
                  <td className="px-4 py-3 text-right">100.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
