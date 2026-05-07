"use client";

import {
  ChevronRight,
  Image as ImageIcon,
  Package,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type Product = {
  code: string;
  barcode: string;
  name: string;
  cat1: string;
  cat2: string;
  rsp: number;
  totalStock: number;
  revenue: number;
  contribution: number;
  status: "ACTIVE" | "TBD";
};

const products: Product[] = [
  {
    code: "NM-BHB",
    barcode: "8859109895121",
    name: "NEST ME Birdnest Hydro Boost Mask",
    cat1: "SKINCARE",
    cat2: "MASK AND BLACK HEAD",
    rsp: 139,
    totalStock: 7922,
    revenue: 5069,
    contribution: 7.1,
    status: "ACTIVE",
  },
  {
    code: "NM-GLW",
    barcode: "8859109895138",
    name: "NEST ME Glow Cream 50G",
    cat1: "SKINCARE",
    cat2: "MOISTURIZER",
    rsp: 590,
    totalStock: 5421,
    revenue: 12400,
    contribution: 17.4,
    status: "ACTIVE",
  },
  {
    code: "NM-LIP-VLV",
    barcode: "8859109895145",
    name: "NEST ME Lip Tint Velvet",
    cat1: "MAKEUP",
    cat2: "LIP",
    rsp: 320,
    totalStock: 4112,
    revenue: 6500,
    contribution: 9.1,
    status: "ACTIVE",
  },
  {
    code: "FX-NRS-30",
    barcode: "8859109895152",
    name: "FITT-X Night Repair Serum 30ML",
    cat1: "SKINCARE",
    cat2: "TREATMENT",
    rsp: 1290,
    totalStock: 8011,
    revenue: 18600,
    contribution: 26.2,
    status: "ACTIVE",
  },
  {
    code: "FX-DM-50",
    barcode: "8859109895169",
    name: "FITT-X Daily Moisturizer 50ML",
    cat1: "SKINCARE",
    cat2: "MOISTURIZER",
    rsp: 690,
    totalStock: 6210,
    revenue: 8200,
    contribution: 11.5,
    status: "ACTIVE",
  },
  {
    code: "PN-WT-200",
    barcode: "8859109895176",
    name: "PRIMANEST White Toner 200ML",
    cat1: "SKINCARE",
    cat2: "CLEANSER",
    rsp: 490,
    totalStock: 9802,
    revenue: 9870,
    contribution: 13.9,
    status: "ACTIVE",
  },
  {
    code: "PN-NEW-001",
    barcode: "—",
    name: "PRIMANEST Vitamin C Serum (TBD)",
    cat1: "SKINCARE",
    cat2: "TREATMENT",
    rsp: 0,
    totalStock: 2800,
    revenue: 0,
    contribution: 0,
    status: "TBD",
  },
];

const stockByStore = [
  { store: "02_KKU", soh: 2, doi: 3, mtd: 146, mar: 269, feb: 188 },
  { store: "05_ZPL", soh: 10, doi: 46, mtd: 136, mar: 346, feb: 2 },
  { store: "06_MGB", soh: 32, doi: 230, mtd: 155, mar: 278, feb: 1083 },
  { store: "07_KRT", soh: 460, doi: 20, mtd: 1279, mar: 763, feb: 106 },
  { store: "08_SQ1", soh: 53, doi: 31, mtd: 20, mar: 132, feb: 22 },
  { store: "09_M08", soh: 530, doi: 22, mtd: 10, mar: 182, feb: 93 },
  { store: "10_M07", soh: 146, doi: 19, mtd: 46, mar: 249, feb: 941 },
  { store: "11_FSH", soh: 136, doi: 51, mtd: 16, mar: 726, feb: 12 },
  { store: "12_ASK", soh: 155, doi: 0, mtd: 295, mar: 1, feb: 11 },
  { store: "13_PTY", soh: 1279, doi: 0, mtd: 22, mar: 6, feb: 52 },
  { store: "14_MYA", soh: 20, doi: 533, mtd: 669, mar: 718, feb: 4 },
  { store: "15_SPO", soh: 10, doi: 1283, mtd: 440, mar: 329, feb: 557 },
  { store: "16_SMT", soh: 46, doi: 110, mtd: 0, mar: 315, feb: 292 },
  { store: "ONLINE", soh: 5043, doi: 42, mtd: 1966, mar: 374, feb: 1619 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

export default function SellingProducts() {
  const [period, setPeriod] = useState<
    "Yesterday" | "7 Days" | "MTD" | "Last Month"
  >("Yesterday");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "TBD">(
    "All",
  );
  const [q, setQ] = useState("");
  const [stockOpen, setStockOpen] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    let r = products;
    if (statusFilter !== "All") {
      r = r.filter((p) =>
        statusFilter === "Active" ? p.status === "ACTIVE" : p.status === "TBD",
      );
    }
    if (q) {
      r = r.filter(
        (p) =>
          p.code.toLowerCase().includes(q.toLowerCase()) ||
          p.name.toLowerCase().includes(q.toLowerCase()) ||
          p.barcode.includes(q),
      );
    }
    return r;
  }, [statusFilter, q]);

  const totals = filtered.reduce(
    (a, p) => ({
      stock: a.stock + p.totalStock,
      revenue: a.revenue + p.revenue,
    }),
    { stock: 0, revenue: 0 },
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
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
              {products.length} Products (Active:{" "}
              {products.filter((p) => p.status === "ACTIVE").length} | TBD:{" "}
              {products.filter((p) => p.status === "TBD").length})
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
                  nestme
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
                    <th className="px-4 py-3">Mar</th>
                    <th className="px-4 py-3">Feb</th>
                  </tr>
                  {/* Total Row */}
                  <tr className="bg-[#fff5f8] text-gray-900 border-b border-white">
                    <td className="px-4 py-3 text-left font-bold text-[13px]">
                      Total (Unit Sold)
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-3 py-1 rounded-full bg-[#d4e8c8] text-[#4A7830] font-bold">
                        43
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-[15px]">7,922</td>
                    <td className="px-4 py-3 font-bold text-[15px]">5,200</td>
                    <td className="px-4 py-3 font-bold text-[15px]">4,688</td>
                    <td className="px-4 py-3 font-bold text-[15px]">4,983</td>
                  </tr>
                  {/* AVG Selling Price Row */}
                  <tr className="bg-[#fffafd] text-gray-900 border-b border-gray-100">
                    <td className="px-4 py-3 text-left font-bold text-[13px]">
                      AVG Selling Price
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 font-bold text-[15px]">56</td>
                    <td className="px-4 py-3 font-bold text-[15px]">56</td>
                    <td className="px-4 py-3 font-bold text-[15px]">56</td>
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
                      Mar
                      <br />
                      <span className="text-[11px] font-normal">Unit Sold</span>
                    </th>
                    <th className="px-4 py-4 font-bold text-gray-400 bg-white">
                      Feb
                      <br />
                      <span className="text-[11px] font-normal">Unit Sold</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stockByStore.map((s) => (
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
                        {fmt(s.mar)}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-700">
                        {fmt(s.feb)}
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
