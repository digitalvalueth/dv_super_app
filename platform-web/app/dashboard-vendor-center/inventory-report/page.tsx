"use client";

import { Search, Download, ChevronRight, Filter } from "lucide-react";
import { useMemo, useState } from "react";

type Row = {
  sku: string;
  name: string;
  cat: string;
  totalStock: number;
  ydUnits: number;
  d7Units: number;
  d30Units: number;
  ydDOI: number;
  d7DOI: number;
  d30DOI: number;
};

const data: Row[] = [
  { sku: "FX-NRS-30", name: "FITT-X Night Repair Serum 30ML", cat: "Skincare", totalStock: 8011, ydUnits: 12, d7Units: 84, d30Units: 320, ydDOI: 668, d7DOI: 668, d30DOI: 751 },
  { sku: "NM-GC-50", name: "NEST ME Glow Cream 50G", cat: "Skincare", totalStock: 5421, ydUnits: 8, d7Units: 60, d30Units: 245, ydDOI: 678, d7DOI: 632, d30DOI: 663 },
  { sku: "PN-WT-200", name: "PRIMANEST White Toner 200ML", cat: "Skincare", totalStock: 9802, ydUnits: 7, d7Units: 52, d30Units: 198, ydDOI: 1400, d7DOI: 1320, d30DOI: 1485 },
  { sku: "FX-DM-50", name: "FITT-X Daily Moisturizer 50ML", cat: "Skincare", totalStock: 6210, ydUnits: 6, d7Units: 41, d30Units: 152, ydDOI: 1035, d7DOI: 1060, d30DOI: 1226 },
  { sku: "NM-LT-VLV", name: "NEST ME Lip Tint Velvet", cat: "Makeup", totalStock: 4112, ydUnits: 5, d7Units: 35, d30Units: 122, ydDOI: 822, d7DOI: 822, d30DOI: 1011 },
  { sku: "NM-BHB", name: "NEST ME Birdnest Hydro Boost Mask", cat: "Skincare", totalStock: 7922, ydUnits: 4, d7Units: 28, d30Units: 90, ydDOI: 1980, d7DOI: 1981, d30DOI: 2641 },
  { sku: "PN-NEW-001", name: "PRIMANEST Vitamin C Serum", cat: "Skincare", totalStock: 2800, ydUnits: 0, d7Units: 0, d30Units: 0, ydDOI: 0, d7DOI: 0, d30DOI: 0 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

const doiBadge = (doi: number, units: number) => {
  if (units === 0) return "bg-red-50 text-red-600 border-red-200";
  if (doi > 365) return "bg-amber-50 text-amber-700 border-amber-200";
  if (doi > 90) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-green-50 text-green-700 border-green-200";
};

export default function InventoryReport() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");

  const filtered = useMemo(() => {
    let r = data;
    if (cat !== "All") r = r.filter((x) => x.cat === cat);
    if (q)
      r = r.filter(
        (x) =>
          x.name.toLowerCase().includes(q.toLowerCase()) ||
          x.sku.toLowerCase().includes(q.toLowerCase())
      );
    return r;
  }, [q, cat]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
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

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(data.length)}
          </p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Total Stock On Hand</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {fmt(data.reduce((a, r) => a + r.totalStock, 0))}
          </p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Non-moving (30d)</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {data.filter((r) => r.d30Units === 0).length}
          </p>
        </div>
        <div className="bg-white border rounded-xl shadow-sm p-5">
          <p className="text-xs text-gray-500">Avg DOI (7d)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {Math.round(
              data
                .filter((r) => r.d7DOI > 0)
                .reduce((a, r) => a + r.d7DOI, 0) /
                Math.max(1, data.filter((r) => r.d7DOI > 0).length)
            )}{" "}
            <span className="text-xs font-normal text-gray-500">days</span>
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
          <option>All</option>
          <option>Skincare</option>
          <option>Makeup</option>
        </select>
        <button className="ml-auto inline-flex items-center gap-1.5 bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 rounded-md text-sm font-semibold">
          <Download className="w-4 h-4" /> Export CSV
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
              {filtered.map((r) => (
                <tr key={r.sku} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {r.sku}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.cat}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmt(r.totalStock)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 border-l">
                    {fmt(r.ydUnits)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(
                        r.ydDOI,
                        r.ydUnits
                      )}`}
                    >
                      {r.ydUnits ? fmt(r.ydDOI) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 border-l">
                    {fmt(r.d7Units)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(
                        r.d7DOI,
                        r.d7Units
                      )}`}
                    >
                      {r.d7Units ? fmt(r.d7DOI) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 border-l">
                    {fmt(r.d30Units)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${doiBadge(
                        r.d30DOI,
                        r.d30Units
                      )}`}
                    >
                      {r.d30Units ? fmt(r.d30DOI) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-[11px] text-gray-500 bg-gray-50 border-t flex items-center gap-3">
          <Filter className="w-3 h-3" />
          DOI = Days of Inventory (Stock ÷ Avg Daily Sales).
          <span className="inline-flex items-center gap-1 ml-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Healthy
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Watch
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Slow
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Non-moving
          </span>
        </div>
      </div>
    </div>
  );
}
