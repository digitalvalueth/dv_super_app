"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type Row = {
  store: string;
  type: "Online" | "Offline";
  unitsSold: number;
  revenue: number;
  revenueLastMonth: number;
  growthMoM: number;
  revenueLastYear: number;
  growthYoY: number;
  contribution: number;
};

const rows: Row[] = [
  {
    store: "EVEANDBOY Siam Center",
    type: "Offline",
    unitsSold: 18,
    revenue: 24500,
    revenueLastMonth: 22000,
    growthMoM: 11.4,
    revenueLastYear: 19500,
    growthYoY: 25.6,
    contribution: 34.5,
  },
  {
    store: "EVEANDBOY CentralWorld",
    type: "Offline",
    unitsSold: 14,
    revenue: 18900,
    revenueLastMonth: 17500,
    growthMoM: 8.0,
    revenueLastYear: 18000,
    growthYoY: 5.0,
    contribution: 26.6,
  },
  {
    store: "EVEANDBOY Online",
    type: "Online",
    unitsSold: 12,
    revenue: 12100,
    revenueLastMonth: 14200,
    growthMoM: -14.8,
    revenueLastYear: 9800,
    growthYoY: 23.5,
    contribution: 17.0,
  },
  {
    store: "EVEANDBOY EmQuartier",
    type: "Offline",
    unitsSold: 8,
    revenue: 7700,
    revenueLastMonth: 8900,
    growthMoM: -13.5,
    revenueLastYear: 7200,
    growthYoY: 6.9,
    contribution: 10.8,
  },
  {
    store: "EVEANDBOY Terminal 21",
    type: "Offline",
    unitsSold: 6,
    revenue: 4500,
    revenueLastMonth: 4100,
    growthMoM: 9.8,
    revenueLastYear: 4400,
    growthYoY: 2.3,
    contribution: 6.3,
  },
  {
    store: "EVEANDBOY Mega Bangna",
    type: "Offline",
    unitsSold: 5,
    revenue: 2200,
    revenueLastMonth: 2800,
    growthMoM: -21.4,
    revenueLastYear: 2600,
    growthYoY: -15.4,
    contribution: 3.1,
  },
  {
    store: "EVEANDBOY Iconsiam",
    type: "Offline",
    unitsSold: 4,
    revenue: 1201,
    revenueLastMonth: 1100,
    growthMoM: 9.2,
    revenueLastYear: 1400,
    growthYoY: -14.2,
    contribution: 1.7,
  },
];

const fmt = (n: number) => n.toLocaleString("en-US");

type SortKey = keyof Row;

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
  const [filter, setFilter] = useState<"ALL" | "Online" | "Offline">("ALL");

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== "ALL") r = r.filter((x) => x.type === filter);
    if (q) r = r.filter((x) => x.store.toLowerCase().includes(q.toLowerCase()));
    return [...r].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [sortKey, sortDir, q, filter]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      unitsSold: acc.unitsSold + r.unitsSold,
      revenue: acc.revenue + r.revenue,
      revenueLastMonth: acc.revenueLastMonth + r.revenueLastMonth,
      revenueLastYear: acc.revenueLastYear + r.revenueLastYear,
    }),
    { unitsSold: 0, revenue: 0, revenueLastMonth: 0, revenueLastYear: 0 },
  );

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
          Dashboard / By Store
        </h1>
        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span>Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700">By Store</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-3 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search store..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <button className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-md text-xs text-gray-700 hover:bg-gray-100 border">
            <Calendar className="w-3.5 h-3.5" />
            Yesterday
          </button>
          <button className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-md text-xs text-gray-700 hover:bg-gray-100 border">
            <Filter className="w-3.5 h-3.5" />
            More filters
          </button>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {(["ALL", "Offline", "Online"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition ${
                filter === f
                  ? "bg-white text-pink-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <Header
                  k="store"
                  label="Store"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
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
                  k="revenueLastMonth"
                  label="Rev. Last Month"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="growthMoM"
                  label="% Gr. MoM"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="revenueLastYear"
                  label="Rev. Last Year"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="growthYoY"
                  label="% Gr. YoY"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <Header
                  k="contribution"
                  label="% Contribution"
                  align="right"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r, i) => (
                <tr key={r.store} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.store}</div>
                    <span
                      className={`inline-block text-[10px] px-1.5 py-0.5 rounded mt-0.5 ${
                        r.type === "Online"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {fmt(r.unitsSold)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ฿{fmt(r.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ฿{fmt(r.revenueLastMonth)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      r.growthMoM >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {r.growthMoM >= 0 ? "+" : ""}
                    {r.growthMoM.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ฿{fmt(r.revenueLastYear)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      r.growthYoY >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {r.growthYoY >= 0 ? "+" : ""}
                    {r.growthYoY.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-pink-500"
                          style={{ width: `${r.contribution}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-10 text-right">
                        {r.contribution.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-pink-50 font-bold text-gray-900">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-right">
                  TOTAL
                </td>
                <td className="px-4 py-3 text-right">
                  {fmt(totals.unitsSold)}
                </td>
                <td className="px-4 py-3 text-right">฿{fmt(totals.revenue)}</td>
                <td className="px-4 py-3 text-right">
                  ฿{fmt(totals.revenueLastMonth)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">—</td>
                <td className="px-4 py-3 text-right">
                  ฿{fmt(totals.revenueLastYear)}
                </td>
                <td className="px-4 py-3 text-right text-gray-500">—</td>
                <td className="px-4 py-3 text-right">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
