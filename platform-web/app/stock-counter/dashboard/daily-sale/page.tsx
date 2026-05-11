"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface DailySaleItem {
  barcode: string;
  productDescription: string;
  price: number;
  quantity: number;
  revenue: number;
  hasFreebie: boolean;
  freebieBarcode?: string;
  freebieDescription?: string;
}

interface DailySale {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  baCode?: string;
  employeeName: string;
  supervisorId?: string;
  supervisorName?: string;
  seller?: string;
  saleDate: string;
  saleType: "normal" | "promotion";
  workDescription?: string;
  items: DailySaleItem[];
  totalItems: number;
  totalRevenue: number;
  createdAt: { seconds: number };
}

interface BranchSummary {
  branchId: string;
  branchName: string;
  totalItems: number;
  totalRevenue: number;
  recordCount: number;
  employees: Record<string, EmployeeSummary>;
}

interface EmployeeSummary {
  employeeId: string;
  employeeName: string;
  baCode?: string;
  seller?: string;
  totalItems: number;
  totalRevenue: number;
  recordCount: number;
}

const getDateRange = (preset: string) => {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "today") {
    const t = fmt(today);
    return { start: t, end: t };
  }
  if (preset === "week") {
    const day = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - day));
    return { start: fmt(start), end: fmt(end) };
  }
  if (preset === "month") {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return {
      start: `${y}-${pad(m)}-01`,
      end: `${y}-${pad(m)}-${pad(lastDay)}`,
    };
  }
  return { start: fmt(today), end: fmt(today) };
};

export default function DailySalePage() {
  const { userData } = useAuthStore();

  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState("month");
  const [startDate, setStartDate] = useState(() => getDateRange("month").start);
  const [endDate, setEndDate] = useState(() => getDateRange("month").end);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
    new Set(),
  );

  const fetchSales = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      const ref = collection(db, "dailySales");
      let q;

      if (userData.role === "supervisor") {
        q = query(
          ref,
          where("supervisorId", "==", userData.uid),
          where("saleDate", ">=", startDate),
          where("saleDate", "<=", endDate),
          orderBy("saleDate", "desc"),
        );
      } else if (
        userData.role === "admin" ||
        userData.role === "manager" ||
        userData.role === "super_admin"
      ) {
        q = query(
          ref,
          where("companyId", "==", userData.companyId || ""),
          where("saleDate", ">=", startDate),
          where("saleDate", "<=", endDate),
          orderBy("saleDate", "desc"),
        );
      } else {
        q = query(
          ref,
          where("employeeId", "==", userData.uid),
          where("saleDate", ">=", startDate),
          where("saleDate", "<=", endDate),
          orderBy("saleDate", "desc"),
        );
      }

      const snap = await getDocs(q);
      setSales(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as DailySale));
    } catch (e) {
      console.error(e);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, startDate, endDate]);

  const applyPreset = (p: string) => {
    setPreset(p);
    const { start, end } = getDateRange(p);
    setStartDate(start);
    setEndDate(end);
  };

  // Build branch summaries
  const branchMap: Record<string, BranchSummary> = {};
  for (const sale of sales) {
    if (!branchMap[sale.branchId]) {
      branchMap[sale.branchId] = {
        branchId: sale.branchId,
        branchName: sale.branchName || sale.branchId,
        totalItems: 0,
        totalRevenue: 0,
        recordCount: 0,
        employees: {},
      };
    }
    const branch = branchMap[sale.branchId];
    branch.totalItems += sale.totalItems;
    branch.totalRevenue += sale.totalRevenue;
    branch.recordCount += 1;

    if (!branch.employees[sale.employeeId]) {
      branch.employees[sale.employeeId] = {
        employeeId: sale.employeeId,
        employeeName: sale.employeeName,
        baCode: sale.baCode,
        seller: sale.seller,
        totalItems: 0,
        totalRevenue: 0,
        recordCount: 0,
      };
    }
    const emp = branch.employees[sale.employeeId];
    emp.totalItems += sale.totalItems;
    emp.totalRevenue += sale.totalRevenue;
    emp.recordCount += 1;
  }
  const branches = Object.values(branchMap).sort((a, b) =>
    a.branchName.localeCompare(b.branchName),
  );

  const totalItems = sales.reduce((s, r) => s + r.totalItems, 0);
  const totalRevenue = sales.reduce((s, r) => s + r.totalRevenue, 0);
  const uniqueEmployees = new Set(sales.map((s) => s.employeeId)).size;

  const toggleBranch = (id: string) =>
    setExpandedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const exportCsv = () => {
    const rows: string[][] = [
      [
        "วันที่",
        "สาขา",
        "รหัส BA",
        "ชื่อพนักงาน",
        "Seller",
        "ประเภท",
        "บาร์โค้ด",
        "ชื่อสินค้า",
        "ราคา",
        "จำนวน",
        "ยอดขาย",
        "มีของแถม",
      ],
    ];
    for (const sale of sales) {
      for (const item of sale.items) {
        rows.push([
          sale.saleDate,
          sale.branchName,
          sale.baCode || "",
          sale.employeeName,
          sale.seller || "",
          sale.saleType === "promotion" ? "โปรโมชั่น" : "ปกติ",
          item.barcode,
          item.productDescription,
          String(item.price),
          String(item.quantity),
          String(item.revenue),
          item.hasFreebie ? "ใช่" : "ไม่",
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-sales-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-500" />
            ยอดขายรายวัน
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            ภาพรวมยอดขายของทีม เพื่อเทียบกับรายงาน Watsons
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-500 shrink-0" />
          <div className="flex gap-2">
            {[
              { label: "วันนี้", value: "today" },
              { label: "สัปดาห์นี้", value: "week" },
              { label: "เดือนนี้", value: "month" },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => applyPreset(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  preset === p.value
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreset("custom");
              }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreset("custom");
              }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "ยอดขายรวม (฿)",
            value: totalRevenue.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            }),
            icon: TrendingUp,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-900/20",
          },
          {
            label: "ชิ้นรวม",
            value: totalItems.toLocaleString(),
            icon: Package,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
          },
          {
            label: "พนักงาน",
            value: uniqueEmployees,
            icon: Users,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-900/20",
          },
          {
            label: "บันทึกทั้งหมด",
            value: sales.length,
            icon: BarChart3,
            color: "text-purple-600",
            bg: "bg-purple-50 dark:bg-purple-900/20",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-2`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Branch table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-800 dark:text-white text-sm">
            สรุปตามสาขา
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16 text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full mr-3" />
            กำลังโหลด...
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            ไม่มีข้อมูลในช่วงวันที่เลือก
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left">สาขา / พนักงาน</th>
                <th className="px-4 py-3 text-right">บันทึก</th>
                <th className="px-4 py-3 text-right">ชิ้น</th>
                <th className="px-4 py-3 text-right">ยอดขาย (฿)</th>
                <th className="px-4 py-3 text-right">เฉลี่ย/วัน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {branches.map((branch) => {
                const isExpanded = expandedBranches.has(branch.branchId);
                const employees = Object.values(branch.employees);
                return (
                  <>
                    <tr
                      key={branch.branchId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                      onClick={() => toggleBranch(branch.branchId)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          {branch.branchName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {branch.recordCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">
                        {branch.totalItems.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        {branch.totalRevenue.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs">
                        —
                      </td>
                    </tr>
                    {isExpanded &&
                      employees.map((emp) => (
                        <tr
                          key={emp.employeeId}
                          className="bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <td className="pl-12 pr-5 py-2.5">
                            <div className="text-gray-700 dark:text-gray-300">
                              {emp.employeeName}
                            </div>
                            <div className="flex gap-3 mt-0.5">
                              {emp.baCode && (
                                <span className="text-xs text-blue-600 font-mono">
                                  #{emp.baCode}
                                </span>
                              )}
                              {emp.seller && (
                                <span className="text-xs text-purple-500">
                                  {emp.seller}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                            {emp.recordCount}
                          </td>
                          <td className="px-4 py-2.5 text-right text-amber-500 text-sm">
                            {emp.totalItems.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right text-blue-500 text-sm">
                            {emp.totalRevenue.toLocaleString("th-TH", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 text-xs">
                            {emp.recordCount > 0
                              ? (
                                  emp.totalRevenue / emp.recordCount
                                ).toLocaleString("th-TH", {
                                  maximumFractionDigits: 0,
                                })
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Raw records */}
      {sales.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="font-semibold text-gray-800 dark:text-white text-sm">
              รายการล่าสุด ({sales.length} รายการ)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-750">
                <tr className="text-gray-500 dark:text-gray-400 text-xs uppercase">
                  <th className="px-5 py-3 text-left">วันที่</th>
                  <th className="px-4 py-3 text-left">พนักงาน</th>
                  <th className="px-4 py-3 text-left">สาขา</th>
                  <th className="px-4 py-3 text-left">ประเภท</th>
                  <th className="px-4 py-3 text-right">ชิ้น</th>
                  <th className="px-4 py-3 text-right">ยอดขาย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sales.slice(0, 50).map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      {sale.saleDate}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800 dark:text-gray-200">
                        {sale.employeeName}
                      </div>
                      {sale.baCode && (
                        <div className="text-xs text-blue-600 font-mono">
                          #{sale.baCode}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {sale.branchName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          sale.saleType === "promotion"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {sale.saleType === "promotion" ? "โปรโมชั่น" : "ปกติ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                      {sale.totalItems}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">
                      ฿
                      {sale.totalRevenue.toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
