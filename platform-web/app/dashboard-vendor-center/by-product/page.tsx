"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

type Product = {
  code: string;
  name: string;
  cat1: string;
  cat2: string;
  cat3: string;
  unitsSold: number;
  revenue: number;
  revenueLastMonth: number;
  growthMoM: number;
  revenueLastYear: number;
  growthYoY: number;
  contribution: number;
  soh: { store: string; qty: number }[];
};

const products: Product[] = [
  {
    code: "FX-NRS-30",
    name: "FITT-X Night Repair Serum 30ML",
    cat1: "Skincare",
    cat2: "Treatment",
    cat3: "Serum",
    unitsSold: 12,
    revenue: 18600,
    revenueLastMonth: 16400,
    growthMoM: 13.4,
    revenueLastYear: 14200,
    growthYoY: 31.0,
    contribution: 26.2,
    soh: [
      { store: "Siam Center", qty: 24 },
      { store: "CentralWorld", qty: 18 },
      { store: "EmQuartier", qty: 9 },
    ],
  },
  {
    code: "NM-GC-50",
    name: "NEST ME Glow Cream 50G",
    cat1: "Skincare",
    cat2: "Moisturizer",
    cat3: "Cream",
    unitsSold: 8,
    revenue: 12400,
    revenueLastMonth: 13100,
    growthMoM: -5.3,
    revenueLastYear: 9700,
    growthYoY: 27.8,
    contribution: 17.4,
    soh: [
      { store: "Siam Center", qty: 14 },
      { store: "Mega Bangna", qty: 6 },
    ],
  },
  {
    code: "PN-WT-200",
    name: "PRIMANEST White Toner 200ML",
    cat1: "Skincare",
    cat2: "Cleanser",
    cat3: "Toner",
    unitsSold: 7,
    revenue: 9870,
    revenueLastMonth: 8800,
    growthMoM: 12.2,
    revenueLastYear: 9400,
    growthYoY: 5.0,
    contribution: 13.9,
    soh: [
      { store: "Siam Center", qty: 30 },
      { store: "CentralWorld", qty: 22 },
      { store: "Iconsiam", qty: 11 },
    ],
  },
  {
    code: "FX-DM-50",
    name: "FITT-X Daily Moisturizer 50ML",
    cat1: "Skincare",
    cat2: "Moisturizer",
    cat3: "Cream",
    unitsSold: 6,
    revenue: 8200,
    revenueLastMonth: 7900,
    growthMoM: 3.8,
    revenueLastYear: 7000,
    growthYoY: 17.1,
    contribution: 11.5,
    soh: [{ store: "Siam Center", qty: 8 }],
  },
  {
    code: "NM-LT-VLV",
    name: "NEST ME Lip Tint Velvet",
    cat1: "Makeup",
    cat2: "Lip",
    cat3: "Tint",
    unitsSold: 5,
    revenue: 6500,
    revenueLastMonth: 7200,
    growthMoM: -9.7,
    revenueLastYear: 6100,
    growthYoY: 6.6,
    contribution: 9.1,
    soh: [
      { store: "Siam Center", qty: 17 },
      { store: "Terminal 21", qty: 7 },
    ],
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");
type SortKey =
  | "name"
  | "code"
  | "unitsSold"
  | "revenue"
  | "revenueLastMonth"
  | "growthMoM"
  | "revenueLastYear"
  | "growthYoY"
  | "contribution";

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
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

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
      const va = a[sortKey] as any;
      const vb = b[sortKey] as any;
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [sortKey, sortDir, q]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard-vendor-center"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-pink-600 mb-2"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard / By Product
        </h1>
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

      <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <button className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-md text-xs text-gray-700 hover:bg-gray-100 border">
          <Calendar className="w-3.5 h-3.5" />
          Yesterday
        </button>
        <select className="bg-gray-50 px-3 py-2 rounded-md text-xs text-gray-700 hover:bg-gray-100 border">
          <option>All Categories</option>
          <option>Skincare</option>
          <option>Makeup</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left w-10"></th>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Image</th>
                <Header
                  k="code"
                  label="Code"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="name"
                  label="Product"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <th className="px-4 py-3 text-left">Cat 1</th>
                <th className="px-4 py-3 text-left">Cat 2</th>
                <th className="px-4 py-3 text-left">Cat 3</th>
                <Header
                  k="unitsSold"
                  label="Unit Sold"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="revenue"
                  label="Revenue"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="growthMoM"
                  label="MoM"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="growthYoY"
                  label="YoY"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="contribution"
                  label="%Contrib"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p, i) => (
                <Fragment key={p.code}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpanded((e) => (e === p.code ? null : p.code))
                        }
                        className="text-gray-400 hover:text-pink-600"
                      >
                        {expanded === p.code ? (
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
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {p.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.cat1}</td>
                    <td className="px-4 py-3 text-gray-600">{p.cat2}</td>
                    <td className="px-4 py-3 text-gray-600">{p.cat3}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {fmt(p.unitsSold)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      ฿{fmt(p.revenue)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.growthMoM >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {p.growthMoM >= 0 ? "+" : ""}
                      {p.growthMoM.toFixed(1)}%
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        p.growthYoY >= 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {p.growthYoY >= 0 ? "+" : ""}
                      {p.growthYoY.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-12 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-pink-500"
                            style={{ width: `${p.contribution}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">
                          {p.contribution.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                  {expanded === p.code && (
                    <tr className="bg-pink-50/50">
                      <td colSpan={13} className="px-12 py-4">
                        <div className="text-xs font-bold text-pink-600 uppercase tracking-wider mb-2">
                          Stock On Hand by Store
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {p.soh.map((s) => (
                            <div
                              key={s.store}
                              className="bg-white border rounded-md px-3 py-2 flex justify-between"
                            >
                              <span className="text-xs text-gray-600">
                                {s.store}
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                {s.qty}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
