"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  Database,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Types ───

interface StockComparison {
  barcode: string;
  productName: string;
  ourQty: number;
  reorderQty: number;
  difference: number;
  status: "match" | "over" | "short";
  lastCounted?: string;
  transferNumber?: string;
  location?: string;
}

interface ComparisonSummary {
  total: number;
  match: number;
  short: number;
  over: number;
  totalDifference: number;
}

type DataSource = "phithan" | "mock";

// ─── Mock Data ───

const MOCK_EXTERNAL_STOCK = [
  {
    barcode: "8859109897033",
    productName: "สินค้าตัวอย่าง A",
    reorderQty: 100,
  },
  {
    barcode: "8859109897040",
    productName: "สินค้าตัวอย่าง B",
    reorderQty: 50,
  },
  {
    barcode: "8859109898023",
    productName: "สินค้าตัวอย่าง C",
    reorderQty: 200,
  },
];

// ─── Component ───

export default function StockComparisonPage() {
  const { userData, user } = useAuthStore();
  const [comparisons, setComparisons] = useState<StockComparison[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary>({
    total: 0,
    match: 0,
    short: 0,
    over: 0,
    totalDifference: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dataSource, setDataSource] = useState<DataSource>("mock");
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    if (!userData) return;
    checkPhithanConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  useEffect(() => {
    if (!userData || dbConnected === null) return;
    fetchComparisonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, dataSource, dbConnected]);

  // ─── Check Phithan DB connectivity ───
  const checkPhithanConnection = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/phithan/explore", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setDbConnected(true);
        setServerTime(data.serverTime);
        setDataSource("phithan");
        toast.success("เชื่อมต่อ Phithan DB สำเร็จ");
      } else {
        const err = await res.json();
        setDbConnected(false);
        setDbError(err.details || err.error || "Connection failed");
        setDataSource("mock");
      }
    } catch {
      setDbConnected(false);
      setDbError("Network error");
      setDataSource("mock");
    }
  };

  // ─── Fetch comparison data ───
  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      if (dataSource === "phithan") {
        await fetchFromPhithan();
      } else {
        await fetchFromMock();
      }
    } catch (error) {
      console.error("Error fetching comparison data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  // ─── Real: Phithan SQL Server ───
  const fetchFromPhithan = async () => {
    const token = await user?.getIdToken();
    if (!token) return;

    const res = await fetch("/api/phithan/stock-comparison", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(`เชื่อมต่อ DB ไม่ได้: ${err.error}`);
      setDataSource("mock");
      return;
    }

    const data = await res.json();
    setComparisons(data.comparisons);
    setSummary(data.summary);
    setServerTime(data.serverTime);
    toast.success(
      `โหลดข้อมูลจาก Phithan DB สำเร็จ (${data.reorderRecordCount} records)`,
    );
  };

  // ─── Mock fallback ───
  const fetchFromMock = async () => {
    const companyId = userData?.companyId;

    let sessionsQuery;
    if (companyId) {
      sessionsQuery = query(
        collection(db, "countingSessions"),
        where("companyId", "==", companyId),
        where("status", "==", "completed"),
      );
    } else {
      sessionsQuery = query(
        collection(db, "countingSessions"),
        where("status", "==", "completed"),
      );
    }

    const sessionsSnapshot = await getDocs(sessionsQuery);

    const productCountMap = new Map<
      string,
      { qty: number; lastCounted: Date; productName: string; barcode: string }
    >();

    sessionsSnapshot.forEach((doc) => {
      const data = doc.data() as any;
      const productId = data.productId;
      const existing = productCountMap.get(productId);
      const createdAt = data.createdAt?.toDate();

      if (!existing || (createdAt && createdAt > existing.lastCounted)) {
        productCountMap.set(productId, {
          qty: data.finalCount || data.currentCountQty || 0,
          lastCounted: createdAt || new Date(),
          productName: data.productName || "ไม่ระบุ",
          barcode: data.productSKU || productId,
        });
      }
    });

    const results: StockComparison[] = [];
    const matchedBarcodes = new Set<string>();

    for (const external of MOCK_EXTERNAL_STOCK) {
      const ours = Array.from(productCountMap.values()).find(
        (p) => p.barcode === external.barcode,
      );
      const ourQty = ours?.qty || 0;
      const diff = external.reorderQty - ourQty;

      results.push({
        barcode: external.barcode,
        productName: ours?.productName || external.productName,
        ourQty,
        reorderQty: external.reorderQty,
        difference: diff,
        status: diff === 0 ? "match" : diff > 0 ? "short" : "over",
        lastCounted: ours?.lastCounted?.toISOString(),
      });
      matchedBarcodes.add(external.barcode);
    }

    productCountMap.forEach((ours) => {
      if (!matchedBarcodes.has(ours.barcode)) {
        results.push({
          barcode: ours.barcode,
          productName: ours.productName,
          ourQty: ours.qty,
          reorderQty: 0,
          difference: -ours.qty,
          status: "over",
          lastCounted: ours.lastCounted.toISOString(),
        });
      }
    });

    results.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    setComparisons(results);
    setSummary({
      total: results.length,
      match: results.filter((c) => c.status === "match").length,
      short: results.filter((c) => c.status === "short").length,
      over: results.filter((c) => c.status === "over").length,
      totalDifference: results.reduce(
        (sum, c) => sum + Math.abs(c.difference),
        0,
      ),
    });
  };

  // ─── Filtered list ───
  const filteredComparisons = comparisons.filter((c) => {
    const matchesSearch =
      c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.transferNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // ─── Export ───
  const handleExportCSV = () => {
    const headers = [
      "บาร์โค้ด",
      "ชื่อสินค้า",
      "จำนวน (เรา)",
      "จำนวน (Reorder)",
      "ผลต่าง",
      "สถานะ",
      "Transfer#",
      "สาขา",
    ];
    const rows = filteredComparisons.map((c) => [
      c.barcode,
      c.productName,
      c.ourQty,
      c.reorderQty,
      c.difference,
      c.status === "match" ? "ตรง" : c.status === "short" ? "ขาด" : "เกิน",
      c.transferNumber || "",
      c.location || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-comparison-phithan-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Export CSV สำเร็จ");
  };

  // ─── Status badge ───
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "short":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm">
            <ArrowDown className="w-3 h-3" />
            ขาด
          </span>
        );
      case "over":
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            <ArrowUp className="w-3 h-3" />
            เกิน
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
            <CheckCircle className="w-3 h-3" />
            ตรง
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
          <p className="mt-4 text-gray-600">
            กำลังเปรียบเทียบข้อมูล
            {dataSource === "phithan" ? " (Phithan DB)" : " (Mock Data)"}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/stock-counter/dashboard/reports"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              เปรียบเทียบสต็อก
            </h1>
            <p className="text-gray-600 mt-1">
              เปรียบเทียบจำนวนสต็อกระหว่างระบบเรากับ Phithan ERP (Reorder)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              checkPhithanConnection();
              fetchComparisonData();
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            รีเฟรช
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* DB Connection Status */}
      <div
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          dbConnected === true
            ? "bg-green-50 border-green-200"
            : dbConnected === false
              ? "bg-red-50 border-red-200"
              : "bg-gray-50 border-gray-200"
        }`}
      >
        {dbConnected === true ? (
          <>
            <Wifi className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">
                เชื่อมต่อ Phithan DB สำเร็จ
              </p>
              <p className="text-sm text-green-700 mt-1">
                Server: phithandata.database.windows.net
                {serverTime &&
                  ` | Server Time: ${new Date(serverTime).toLocaleString("th-TH")}`}
              </p>
            </div>
          </>
        ) : dbConnected === false ? (
          <>
            <WifiOff className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800">
                ไม่สามารถเชื่อมต่อ Phithan DB ได้
              </p>
              <p className="text-sm text-red-700 mt-1">{dbError}</p>
              <p className="text-sm text-red-600 mt-2">
                กรุณาติดต่อ ITP เพื่อ whitelist IP ใน Azure SQL Firewall ·
                กำลังใช้ Mock Data แทน
              </p>
              <button
                onClick={checkPhithanConnection}
                className="mt-2 text-sm px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                ลองเชื่อมต่อใหม่
              </button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 text-gray-500 mt-0.5 animate-spin" />
            <p className="text-gray-600">กำลังตรวจสอบการเชื่อมต่อ...</p>
          </>
        )}
      </div>

      {/* Data Source Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              แหล่งข้อมูล:
            </span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDataSource("phithan")}
                disabled={!dbConnected}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  dataSource === "phithan"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                Phithan DB (จริง)
              </button>
              <button
                onClick={() => setDataSource("mock")}
                className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                  dataSource === "mock"
                    ? "bg-yellow-500 text-white shadow"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                Mock Data (ทดสอบ)
              </button>
            </div>
          </div>
          {dataSource === "mock" && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
              ข้อมูลทดสอบ
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Server className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {summary.total}
              </p>
              <p className="text-xs text-gray-500">สินค้าทั้งหมด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {summary.match}
              </p>
              <p className="text-xs text-gray-500">ตรงกัน</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.short}</p>
              <p className="text-xs text-gray-500">ขาด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ArrowUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{summary.over}</p>
              <p className="text-xs text-gray-500">เกิน</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {summary.totalDifference}
              </p>
              <p className="text-xs text-gray-500">ผลต่างรวม</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, บาร์โค้ด, Transfer#..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="short">ขาด</option>
            <option value="over">เกิน</option>
            <option value="match">ตรงกัน</option>
          </select>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  สินค้า
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  บาร์โค้ด
                </th>
                {dataSource === "phithan" && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Transfer#
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      สาขา
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  นับได้ (เรา)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Reorder (ERP)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  ผลต่าง
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredComparisons.map((comparison, idx) => (
                <tr
                  key={`${comparison.barcode}-${idx}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {comparison.productName}
                    </p>
                    {comparison.lastCounted && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        นับล่าสุด:{" "}
                        {new Date(comparison.lastCounted).toLocaleDateString(
                          "th-TH",
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {comparison.barcode}
                  </td>
                  {dataSource === "phithan" && (
                    <>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {comparison.transferNumber || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {comparison.location || "-"}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {comparison.ourQty}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-blue-600">
                    {comparison.reorderQty}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-semibold ${
                        comparison.difference > 0
                          ? "text-red-600"
                          : comparison.difference < 0
                            ? "text-blue-600"
                            : "text-green-600"
                      }`}
                    >
                      {comparison.difference > 0 ? "+" : ""}
                      {comparison.difference}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(comparison.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredComparisons.length === 0 && (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">ไม่พบข้อมูลเปรียบเทียบ</p>
            {dataSource === "mock" && (
              <p className="text-sm text-gray-400 mt-2">
                ข้อมูล Mock มีจำกัด — เชื่อมต่อ Phithan DB เพื่อดูข้อมูลจริง
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
