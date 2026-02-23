"use client";

import {
  compareStock,
  ExternalStockData,
  getMockExternalStock,
  isExternalApiConfigured,
  StockComparison,
} from "@/lib/external-api";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle,
  Download,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function StockComparisonPage() {
  const { userData } = useAuthStore();
  const [comparisons, setComparisons] = useState<StockComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [useMockData, setUseMockData] = useState(true);

  useEffect(() => {
    if (!userData) return;
    fetchComparisonData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      const companyId = userData?.companyId;

      // 1. Fetch our counting sessions (latest for each product)
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

      // Group by product and get latest count
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

      // 2. Fetch external stock data
      let externalStock: ExternalStockData[] = [];

      if (isExternalApiConfigured()) {
        // TODO: Implement actual API call when configured
        toast.info("กำลังเชื่อมต่อ External API...");
      } else {
        // Use mock data for demonstration
        setUseMockData(true);
        externalStock = getMockExternalStock();
      }

      // 3. Compare stocks
      const comparisonResults: StockComparison[] = [];

      // Match our products with external data
      productCountMap.forEach((ourData, productId) => {
        const external = externalStock.find(
          (e) => e.productId === productId || e.barcode === ourData.barcode,
        );

        if (external) {
          comparisonResults.push(
            compareStock(
              ourData.qty,
              external.externalQty,
              productId,
              ourData.productName,
              ourData.barcode,
              ourData.lastCounted,
            ),
          );
        } else {
          // Product exists in our system but not in external
          comparisonResults.push({
            productId,
            productName: ourData.productName,
            barcode: ourData.barcode,
            ourQty: ourData.qty,
            externalQty: 0,
            difference: -ourData.qty,
            status: "over",
            lastCounted: ourData.lastCounted,
          });
        }
      });

      // Add external products not in our system
      externalStock.forEach((external) => {
        if (!productCountMap.has(external.productId)) {
          comparisonResults.push({
            productId: external.productId,
            productName: external.productName || "ไม่ระบุ",
            barcode: external.barcode,
            ourQty: 0,
            externalQty: external.externalQty,
            difference: external.externalQty,
            status: "short",
            lastCounted: undefined,
          });
        }
      });

      // Sort by difference (highest discrepancy first)
      comparisonResults.sort(
        (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
      );

      setComparisons(comparisonResults);
    } catch (error) {
      console.error("Error fetching comparison data:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const filteredComparisons = comparisons.filter((c) => {
    const matchesSearch =
      c.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.productId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || c.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

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

  // Summary stats
  const shortCount = comparisons.filter((c) => c.status === "short").length;
  const overCount = comparisons.filter((c) => c.status === "over").length;
  const matchCount = comparisons.filter((c) => c.status === "match").length;
  const totalDifference = comparisons.reduce(
    (sum, c) => sum + Math.abs(c.difference),
    0,
  );

  const handleExportCSV = () => {
    const headers = [
      "รหัสสินค้า",
      "ชื่อสินค้า",
      "บาร์โค้ด",
      "จำนวน (เรา)",
      "จำนวน (ระบบ)",
      "ผลต่าง",
      "สถานะ",
    ];
    const rows = filteredComparisons.map((c) => [
      c.productId,
      c.productName,
      c.barcode,
      c.ourQty,
      c.externalQty,
      c.difference,
      c.status === "match" ? "ตรง" : c.status === "short" ? "ขาด" : "เกิน",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stock-comparison-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังเปรียบเทียบข้อมูล...</p>
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
              เปรียบเทียบจำนวนสต็อกระหว่างระบบเรากับระบบ ERP ภายนอก
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchComparisonData}
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

      {/* API Status */}
      {useMockData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">
              ใช้ข้อมูลทดสอบ (Mock Data)
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              ยังไม่ได้ตั้งค่า External API
              กรุณาติดต่อทีมพัฒนาเพื่อเชื่อมต่อกับระบบ ERP/POS ของคุณ
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Server className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {comparisons.length}
              </p>
              <p className="text-sm text-gray-500">สินค้าทั้งหมด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{matchCount}</p>
              <p className="text-sm text-gray-500">ตรงกัน</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <ArrowDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{shortCount}</p>
              <p className="text-sm text-gray-500">ขาด</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {totalDifference}
              </p>
              <p className="text-sm text-gray-500">ผลต่างรวม (ชิ้น)</p>
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
              placeholder="ค้นหาชื่อ, รหัส, บาร์โค้ด..."
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  จำนวน (เรา)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  จำนวน (ระบบ ERP)
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
              {filteredComparisons.map((comparison) => (
                <tr key={comparison.productId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {comparison.productName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {comparison.productId}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">
                    {comparison.barcode}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {comparison.ourQty}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-blue-600">
                    {comparison.externalQty}
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
          </div>
        )}
      </div>
    </div>
  );
}
