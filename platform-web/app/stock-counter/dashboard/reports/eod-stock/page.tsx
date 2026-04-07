"use client";

import { useAuthStore } from "@/stores/auth.store";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Types ───

interface EodDetail {
  Barcode?: string;
  Item?: string;
  EOD_Qty?: number;
  EOD_Date?: string;
  ID?: number;
  [key: string]: unknown;
}

interface EodEntry {
  id: string;
  branchCode: string;
  location?: string;
  locationId?: string;
  eodDateMax?: string;
  details: EodDetail[];
  createdAt?: string;
  updatedAt?: string;
}

interface BranchGroup {
  branchCode: string;
  docId: string;
  location: string;
  eodDateMax: string;
  totalItems: number;
  totalQty: number;
  details: EodDetail[];
}

// ─── Component ───

export default function EodStockReportPage() {
  const { user } = useAuthStore();
  const [eodEntries, setEodEntries] = useState<EodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );

  // ─── Fetch EOD data ───

  const fetchEodData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/phithan-eod", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch EOD data");
      const json = await res.json();
      setEodEntries(json.data ?? []);
    } catch (err) {
      console.error("Error fetching EOD data:", err);
      toast.error("ไม่สามารถโหลดข้อมูล EOD ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchEodData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── Group by branch ───

  const branchGroups = useMemo<BranchGroup[]>(() => {
    return eodEntries
      .map((entry) => {
        const totalQty = entry.details.reduce(
          (sum, d) => sum + (Number(d.EOD_Qty) || 0),
          0,
        );
        return {
          branchCode: entry.branchCode,
          docId: entry.id,
          location: entry.location || entry.id || "-",
          eodDateMax: entry.eodDateMax || "-",
          totalItems: entry.details.length,
          totalQty,
          details: entry.details,
        };
      })
      .sort((a, b) => a.branchCode.localeCompare(b.branchCode, "th"));
  }, [eodEntries]);

  // ─── Filter ───

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return branchGroups;
    const term = searchTerm.toLowerCase();
    return branchGroups.filter(
      (g) =>
        g.branchCode.toLowerCase().includes(term) ||
        g.docId.toLowerCase().includes(term) ||
        g.location.toLowerCase().includes(term) ||
        g.details.some(
          (d) =>
            d.Barcode?.toLowerCase().includes(term) ||
            d.Item?.toLowerCase().includes(term),
        ),
    );
  }, [branchGroups, searchTerm]);

  // ─── Summary stats ───

  const stats = useMemo(() => {
    const totalBranches = filteredGroups.length;
    const totalItems = filteredGroups.reduce((s, g) => s + g.totalItems, 0);
    const totalQty = filteredGroups.reduce((s, g) => s + g.totalQty, 0);
    return { totalBranches, totalItems, totalQty };
  }, [filteredGroups]);

  // ─── Toggle branch expand ───

  const toggleBranch = (code: string) => {
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedBranches(new Set(filteredGroups.map((g) => g.docId)));
  };

  const collapseAll = () => {
    setExpandedBranches(new Set());
  };

  // ─── Export CSV ───

  const exportCsv = () => {
    const rows: string[] = [
      [
        "รหัสสาขา",
        "ชื่อสาขา/Location",
        "Barcode",
        "สินค้า (Item)",
        "จำนวน EOD",
        "วันที่ EOD",
      ].join(","),
    ];

    for (const group of filteredGroups) {
      for (const detail of group.details) {
        rows.push(
          [
            group.branchCode,
            `"${group.location.replace(/"/g, '""')}"`,
            detail.Barcode ?? "",
            `"${(detail.Item ?? "").replace(/"/g, '""')}"`,
            detail.EOD_Qty ?? 0,
            detail.EOD_Date ?? "",
          ].join(","),
        );
      }
    }

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eod-stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ดาวน์โหลด CSV สำเร็จ");
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล EOD...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/stock-counter/dashboard/reports"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              รายงานสินค้าตามสาขา (EOD)
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-7">
            แสดงจำนวนสินค้าแต่ละรายการของแต่ละสาขา จากข้อมูล EOD
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchEodData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </button>
          <button
            onClick={exportCsv}
            disabled={filteredGroups.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-lg text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                จำนวนสาขา
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalBranches.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500 rounded-lg text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                รายการสินค้าทั้งหมด
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalItems.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500 rounded-lg text-white">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                จำนวนสินค้ารวม (EOD Qty)
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalQty.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาสาขา, Barcode, สินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ขยายทั้งหมด
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ย่อทั้งหมด
          </button>
        </div>
      </div>

      {/* Branch Groups */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            ไม่พบข้อมูล EOD
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedBranches.has(group.docId);
            return (
              <div
                key={group.docId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Branch Header */}
                <button
                  onClick={() => toggleBranch(group.docId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          สาขา {group.branchCode}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {group.docId}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {group.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-gray-500 dark:text-gray-400">รายการ</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {group.totalItems.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-500 dark:text-gray-400">
                        จำนวนรวม
                      </p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {group.totalQty.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-gray-500 dark:text-gray-400">
                        วันที่ EOD
                      </p>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        {group.eodDateMax}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Product Details Table */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              #
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Barcode
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              สินค้า (Item)
                            </th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              จำนวน EOD
                            </th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              วันที่ EOD
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {group.details.map((detail, idx) => (
                            <tr
                              key={`${group.docId}-${idx}`}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            >
                              <td className="px-4 py-2 text-gray-400">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">
                                {detail.Barcode ?? "-"}
                              </td>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">
                                {detail.Item ?? "-"}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                                {(detail.EOD_Qty ?? 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                {detail.EOD_Date ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600">
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300"
                            >
                              รวมทั้งหมด
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {group.totalQty.toLocaleString()}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
