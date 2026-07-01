"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Store,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useBrand } from "../brand-context";
import { db } from "@/lib/firebase";
import {
  collection,
  documentId,
  getDoc,
  getDocs,
  doc as fsDoc,
  query,
  where,
} from "firebase/firestore";
import { useAuthStore } from "@/stores/auth.store";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  resolveScopedBranchIds,
  type SupervisorDoc,
} from "@/lib/reports/supervisor-scope";
import {
  aggregateByEmployee,
  aggregateTeamByBranch,
  teamSummary as computeTeamSummary,
} from "@/lib/reports/aggregate";
import type { DailySale as ReportDailySale } from "@/lib/reports/types";

// Cache for Thai font base64 (Google Sans) used in PDF export
let thaiFontBase64Cache: string | null = null;

async function loadThaiFontBase64(): Promise<string | null> {
  if (thaiFontBase64Cache) return thaiFontBase64Cache;
  try {
    const response = await fetch("/GoogleSans-VariableFont.ttf");
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    thaiFontBase64Cache = btoa(binary);
    return thaiFontBase64Cache;
  } catch {
    return null;
  }
}

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

const fmt = (n: number) => n.toLocaleString("en-US");

const ELEVATED_ROLES = ["supervisor", "manager", "admin", "super_admin"];

export default function SupervisorSalesReport() {
  const { activeBrand } = useBrand();
  const { userData } = useAuthStore();

  const [rawSales, setRawSales] = useState<DailySale[]>([]);
  // null => no branch restriction (admin/super_admin); array => restricted scope
  const [scopedBranchIds, setScopedBranchIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePeriodBtn, setActivePeriodBtn] = useState("Yesterday");

  // View toggle
  const [view, setView] = useState<"branch" | "employee">("branch");

  // Sorting (by-branch table)
  const [branchSortField, setBranchSortField] = useState<string>("revenue");
  const [branchSortAsc, setBranchSortAsc] = useState<boolean>(false);

  // Sorting (by-employee table)
  const [empSortField, setEmpSortField] = useState<string>("revenue");
  const [empSortAsc, setEmpSortAsc] = useState<boolean>(false);

  const isAuthorized = userData ? ELEVATED_ROLES.includes(userData.role) : false;

  useEffect(() => {
    if (!userData) return;
    if (!ELEVATED_ROLES.includes(userData.role)) {
      setLoading(false);
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        // Find companyId of Phithan
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
        const targetCompanyId = phithan?.id || "";

        // Load daily sales for the company
        const salesRef = collection(db, "dailySales");
        const salesQuery = targetCompanyId
          ? query(salesRef, where("companyId", "==", targetCompanyId))
          : query(salesRef);
        const salesSnap = await getDocs(salesQuery);
        setRawSales(
          salesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as DailySale[],
        );

        // Resolve the team/branch scope (mirror attendance page logic).
        // The Firestore reads (fetching the manager's supervisors) stay here;
        // the pure scope decision is delegated to resolveScopedBranchIds.
        const role = userData!.role;
        let supervisorDocs: SupervisorDoc[] = [];
        if (role === "manager") {
          // Managers manage branches indirectly through their supervisors;
          // read managedSupervisorIds from the live user doc to be safe (the
          // auth store may not hydrate this field), then fetch their branches.
          let supervisorIds: string[] = userData!.managedSupervisorIds || [];
          if (!supervisorIds.length && userData!.uid) {
            try {
              const meSnap = await getDoc(fsDoc(db, "users", userData!.uid));
              supervisorIds =
                (meSnap.data()?.managedSupervisorIds as string[]) || [];
            } catch {
              supervisorIds = [];
            }
          }
          supervisorIds = supervisorIds.slice(0, 30);
          if (supervisorIds.length > 0) {
            const supervisorsSnap = await getDocs(
              query(
                collection(db, "users"),
                where(documentId(), "in", supervisorIds),
              ),
            );
            supervisorDocs = supervisorsSnap.docs.map(
              (d) => d.data() as SupervisorDoc,
            );
          }
        }

        setScopedBranchIds(resolveScopedBranchIds(userData!, supervisorDocs));
      } catch (err) {
        console.error("Error loading supervisor sales report data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userData]);

  const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
    const norm = (name || "").toLowerCase().replace(/\s+/g, "").trim();
    if (brand === "NEST ME") {
      return norm.includes("nestme") || norm.includes("nest me");
    } else {
      return norm.includes("primanest") || norm.includes("prima");
    }
  };

  // Sales matching the active brand (items filtered + revenue/units recomputed).
  const brandSales = useMemo(() => {
    return rawSales
      .map((sale) => {
        const brandItems = (sale.items || []).filter((item) =>
          matchBrand(item.productDescription || "", activeBrand),
        );
        if (brandItems.length === 0) return null;
        const totalRevenue = brandItems.reduce(
          (sum, item) => sum + (item.revenue || 0),
          0,
        );
        const totalUnits = brandItems.reduce(
          (sum, item) => sum + (item.quantity || 0),
          0,
        );
        return {
          ...sale,
          items: brandItems,
          totalRevenue,
          totalUnits,
          totalItems: brandItems.length,
        };
      })
      .filter(Boolean) as (DailySale & { totalUnits: number })[];
  }, [rawSales, activeBrand]);

  // Apply the team/branch scope.
  const teamSales = useMemo(() => {
    if (scopedBranchIds === null) return brandSales; // admin/super_admin
    if (scopedBranchIds.length === 0) return []; // supervisor/manager w/ no branches
    const set = new Set(scopedBranchIds);
    return brandSales.filter((s) => set.has(s.branchId));
  }, [brandSales, scopedBranchIds]);

  const sortedDates = useMemo(() => {
    const dates = teamSales.map((s) => s.saleDate).filter(Boolean);
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [teamSales]);

  const latestDate = sortedDates[0] || "";

  const availableMonths = useMemo(() => {
    const prefixes = Array.from(new Set(sortedDates.map((d) => d.substring(0, 7))));
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return prefixes.map((p) => {
      const parts = p.split("-");
      const y = parts[0];
      const m = Number(parts[1]);
      return { value: p, label: `${months[m - 1]} ${y}` };
    });
  }, [sortedDates]);

  useEffect(() => {
    if (latestDate) {
      setStartDate(latestDate);
      setEndDate(latestDate);
      setActivePeriodBtn("Yesterday");
    }
  }, [latestDate]);

  const formatDateToYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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
    } else if (p === "Last Year") {
      setStartDate(`${year - 1}-01-01`);
      setEndDate(`${year - 1}-12-31`);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${parts[2]} ${months[d.getMonth()]} ${parts[0]}`;
  };

  // Sales within the selected date range (team scope already applied).
  const periodSales = useMemo(() => {
    return teamSales.filter((s) => {
      if (startDate && s.saleDate < startDate) return false;
      if (endDate && s.saleDate > endDate) return false;
      return true;
    });
  }, [teamSales, startDate, endDate]);

  // Team-level summary (4b: team total).
  const teamSummary = useMemo(
    () => computeTeamSummary(periodSales as ReportDailySale[]),
    [periodSales],
  );

  // Per-branch breakdown (4b stats + 4c cross-branch comparison).
  const branchRows = useMemo(
    () =>
      aggregateTeamByBranch(
        periodSales as ReportDailySale[],
        teamSummary.revenue || 0,
      ),
    [periodSales, teamSummary.revenue],
  );

  const sortedBranchRows = useMemo(() => {
    const r = [...branchRows];
    r.sort((a, b) => {
      const valA: any = a[branchSortField as keyof typeof a];
      const valB: any = b[branchSortField as keyof typeof b];
      if (typeof valA === "string") {
        return branchSortAsc
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return branchSortAsc ? valA - valB : valB - valA;
    });
    return r;
  }, [branchRows, branchSortField, branchSortAsc]);

  // Per-employee breakdown (4a by employee).
  const employeeRows = useMemo(
    () => aggregateByEmployee(periodSales as ReportDailySale[]),
    [periodSales],
  );

  const sortedEmployeeRows = useMemo(() => {
    const r = [...employeeRows];
    r.sort((a, b) => {
      const valA: any = a[empSortField as keyof typeof a];
      const valB: any = b[empSortField as keyof typeof b];
      if (typeof valA === "string") {
        return empSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return empSortAsc ? valA - valB : valB - valA;
    });
    return r;
  }, [employeeRows, empSortField, empSortAsc]);

  const maxBranchRevenue = useMemo(
    () => Math.max(0, ...branchRows.map((b) => b.revenue)),
    [branchRows],
  );

  const handleBranchSort = (field: string) => {
    if (branchSortField === field) setBranchSortAsc(!branchSortAsc);
    else {
      setBranchSortField(field);
      setBranchSortAsc(true);
    }
  };

  const handleEmpSort = (field: string) => {
    if (empSortField === field) setEmpSortAsc(!empSortAsc);
    else {
      setEmpSortField(field);
      setEmpSortAsc(true);
    }
  };

  const dateRangeLabel =
    startDate && endDate
      ? `${formatDateString(startDate)} - ${formatDateString(endDate)}`
      : "All Time";

  // ---- Excel export (branch + employee breakdown) ----
  const handleExport = () => {
    if (periodSales.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const wb = XLSX.utils.book_new();

    // Branch sheet
    const branchHeaders = [
      "Branch",
      "Revenue (THB)",
      "Units Sold",
      "Bills",
      "% of Team Revenue",
    ];
    const branchData = sortedBranchRows.map((b) => [
      b.branchName,
      b.revenue,
      b.units,
      b.bills,
      `${b.share.toFixed(1)}%`,
    ]);
    branchData.push([
      "TEAM TOTAL",
      teamSummary.revenue,
      teamSummary.units,
      teamSummary.bills,
      "100%",
    ]);
    const wsBranch = XLSX.utils.aoa_to_sheet([branchHeaders, ...branchData]);
    wsBranch["!cols"] = [30, 16, 12, 10, 18].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsBranch, "By Branch");

    // Employee sheet
    const empHeaders = [
      "Employee",
      "Branch",
      "Revenue (THB)",
      "Units Sold",
      "Bills",
    ];
    const empData = sortedEmployeeRows.map((e) => [
      e.employeeName,
      e.branchName,
      e.revenue,
      e.units,
      e.bills,
    ]);
    const wsEmp = XLSX.utils.aoa_to_sheet([empHeaders, ...empData]);
    wsEmp["!cols"] = [28, 28, 16, 12, 10].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, wsEmp, "By Employee");

    const fileName = `${activeBrand
      .toLowerCase()
      .replace(/\s+/g, "_")}_team_sales_report_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success("ดาวน์โหลดไฟล์รายงานยอดขายทีมเรียบร้อยแล้ว");
  };

  // ---- PDF export (branch + employee breakdown) ----
  const handleExportPdf = async () => {
    if (periodSales.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออก");
      return;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    let fontName = "helvetica";
    try {
      const fontBase64 = await loadThaiFontBase64();
      if (fontBase64) {
        doc.addFileToVFS("GoogleSans.ttf", fontBase64);
        doc.addFont("GoogleSans.ttf", "GoogleSans", "normal");
        fontName = "GoogleSans";
      }
    } catch {
      fontName = "helvetica";
    }

    doc.setFont(fontName, "normal");
    doc.setFontSize(16);
    doc.text("Team Sales Report", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Brand: ${activeBrand}    Date: ${dateRangeLabel}`, 14, 23);
    doc.text(
      `Branches: ${fmt(teamSummary.branches)}    Employees: ${fmt(
        teamSummary.employees,
      )}    Bills: ${fmt(teamSummary.bills)}`,
      14,
      28,
    );
    doc.text(
      `Team Units: ${fmt(teamSummary.units)}    Team Revenue: ${fmt(
        teamSummary.revenue,
      )} THB`,
      14,
      33,
    );
    doc.setTextColor(0, 0, 0);

    // By-branch table (cross-branch comparison)
    doc.setFontSize(11);
    doc.text("By Branch", 14, 41);
    autoTable(doc, {
      startY: 44,
      head: [["Branch", "Revenue (THB)", "Units", "Bills", "% of Team"]],
      body: [
        ...sortedBranchRows.map((b) => [
          b.branchName,
          fmt(b.revenue),
          fmt(b.units),
          fmt(b.bills),
          `${b.share.toFixed(1)}%`,
        ]),
        [
          "TEAM TOTAL",
          fmt(teamSummary.revenue),
          fmt(teamSummary.units),
          fmt(teamSummary.bills),
          "100%",
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [74, 120, 48], fontSize: 8, font: fontName },
      styles: { fontSize: 8, cellPadding: 1.5, font: fontName, overflow: "linebreak" },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    // By-employee table
    const afterBranchY =
      (doc as any).lastAutoTable?.finalY != null
        ? (doc as any).lastAutoTable.finalY + 8
        : 44;
    doc.setFontSize(11);
    doc.text("By Employee", 14, afterBranchY);
    autoTable(doc, {
      startY: afterBranchY + 3,
      head: [["Employee", "Branch", "Revenue (THB)", "Units", "Bills"]],
      body: sortedEmployeeRows.map((e) => [
        e.employeeName,
        e.branchName,
        fmt(e.revenue),
        fmt(e.units),
        fmt(e.bills),
      ]),
      theme: "striped",
      headStyles: { fillColor: [74, 120, 48], fontSize: 8, font: fontName },
      styles: { fontSize: 8, cellPadding: 1.5, font: fontName, overflow: "linebreak" },
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    const fileName = `${activeBrand
      .toLowerCase()
      .replace(/\s+/g, "_")}_team_sales_report_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    doc.save(fileName);

    toast.success("ดาวน์โหลดไฟล์ PDF รายงานยอดขายทีมเรียบร้อยแล้ว");
  };

  function BranchHeader({ label, field, align = "center" }: { label: string; field: string; align?: "left" | "center" }) {
    const isSorted = branchSortField === field;
    return (
      <th
        onClick={() => handleBranchSort(field)}
        className={`px-4 py-4 ${align === "left" ? "text-left" : "text-center"} cursor-pointer select-none hover:text-[#4A7830] font-bold whitespace-nowrap`}
      >
        <div className={`flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
          {label}{" "}
          <span className="text-[10px] text-gray-400">
            {isSorted ? (branchSortAsc ? "▲" : "▼") : "↑↓"}
          </span>
        </div>
      </th>
    );
  }

  function EmpHeader({ label, field, align = "center" }: { label: string; field: string; align?: "left" | "center" }) {
    const isSorted = empSortField === field;
    return (
      <th
        onClick={() => handleEmpSort(field)}
        className={`px-4 py-4 ${align === "left" ? "text-left" : "text-center"} cursor-pointer select-none hover:text-[#4A7830] font-bold whitespace-nowrap`}
      >
        <div className={`flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
          {label}{" "}
          <span className="text-[10px] text-gray-400">
            {isSorted ? (empSortAsc ? "▲" : "▼") : "↑↓"}
          </span>
        </div>
      </th>
    );
  }

  // ---- Role gate ----
  if (userData && !isAuthorized) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            ไม่มีสิทธิ์เข้าถึง
          </h2>
          <p className="text-sm text-gray-500">
            รายงานยอดขายทีมนี้สำหรับหัวหน้าทีม (Supervisor),
            ผู้จัดการ (Manager) และผู้ดูแลระบบเท่านั้น
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B8C3E] mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">
            กำลังโหลดรายงานยอดขายทีม...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          รายงานยอดขายทีม (Team Sales Report)
        </h1>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span className="cursor-pointer hover:underline">Home</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Vendor</span>
          <ChevronRight className="w-3 h-3" />
          <span className="cursor-pointer hover:underline">Reports</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-900 font-medium">Team Sales</span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-[13px] font-semibold text-gray-700">
            Revenue Period:
          </label>
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  setStartDate(`${e.target.value}-01`);
                  const parts = e.target.value.split("-");
                  const lastDay = new Date(Number(parts[0]), Number(parts[1]), 0);
                  setEndDate(formatDateToYmd(lastDay));
                  setActivePeriodBtn("");
                }
              }}
              className="appearance-none pl-3 pr-8 py-1.5 border rounded-md text-sm text-gray-700 focus:outline-none focus:border-[#5B8C3E] focus:ring-1 focus:ring-[#5B8C3E] cursor-pointer"
            >
              <option value="">Select Month</option>
              {availableMonths.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {startDate && endDate && (
            <span className="text-sm text-gray-500">
              {formatDateString(startDate)} - {formatDateString(endDate)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {["Yesterday", "7 Days", "MTD", "Last Month", "YTD", "Last Year"].map(
            (p) => (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`px-4 py-1.5 text-[13px] rounded-full font-semibold transition-colors ${
                  activePeriodBtn === p
                    ? "bg-[#5B8C3E] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              Start Date:
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePeriodBtn("");
              }}
              className="pl-3 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-[#5B8C3E] cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[13px] font-semibold text-gray-700">
              End Date:
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePeriodBtn("");
              }}
              className="pl-3 pr-3 py-1.5 border rounded-md text-sm focus:outline-none focus:border-[#5B8C3E] cursor-pointer"
            />
          </div>
          <button
            onClick={() => {
              if (latestDate) {
                setStartDate(latestDate);
                setEndDate(latestDate);
                setActivePeriodBtn("Yesterday");
              }
            }}
            className="p-1.5 border rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            title="Reset"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Team Summary Cards (4b) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">
            ยอดขายทีมรวม (THB)
          </p>
          <p className="mt-1 text-2xl font-bold text-[#4A7830]">
            ฿{fmt(teamSummary.revenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">Units Sold</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {fmt(teamSummary.units)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">
            จำนวนบิล/รายการขาย
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {fmt(teamSummary.bills)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">จำนวนสาขา</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {fmt(teamSummary.branches)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs font-semibold text-gray-500">จำนวนพนักงาน</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {fmt(teamSummary.employees)}
          </p>
        </div>
      </div>

      {/* View toggle + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border bg-white p-1 shadow-sm">
          <button
            onClick={() => setView("branch")}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              view === "branch"
                ? "bg-[#5B8C3E] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Store className="w-4 h-4" /> ตามสาขา
          </button>
          <button
            onClick={() => setView("employee")}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              view === "employee"
                ? "bg-[#5B8C3E] text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4" /> ตามพนักงาน
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 bg-[#5B8C3E] hover:bg-[#4A7830] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* By-branch table (4b + 4c) */}
      {view === "branch" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 bg-gray-50/50 border-b">
            <h3 className="text-sm font-bold text-gray-900">
              ยอดขายตามสาขา (เปรียบเทียบระหว่างสาขา)
            </h3>
            <p className="text-xs text-gray-500">{branchRows.length} สาขา</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead className="bg-[#f0f7ec] text-gray-700 text-[11px] uppercase tracking-wider">
                <tr>
                  <BranchHeader label="สาขา / Branch" field="branchName" align="left" />
                  <BranchHeader label="Revenue (THB)" field="revenue" />
                  <BranchHeader label="Units Sold" field="units" />
                  <BranchHeader label="Bills" field="bills" />
                  <BranchHeader label="% ของทีม" field="share" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedBranchRows.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-left text-gray-800 font-medium">
                      {b.branchName}
                    </td>
                    <td className="px-4 py-4 text-gray-900 font-semibold">
                      ฿{fmt(b.revenue)}
                    </td>
                    <td className="px-4 py-4 text-gray-800">{fmt(b.units)}</td>
                    <td className="px-4 py-4 text-gray-800">{fmt(b.bills)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#5B8C3E] rounded-full"
                            style={{
                              width: `${
                                maxBranchRevenue > 0
                                  ? (b.revenue / maxBranchRevenue) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-gray-700 font-medium w-12 text-right">
                          {b.share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedBranchRows.length > 0 && (
                  <tr className="bg-[#f0f7ec]/60 font-bold border-t-2 border-[#5B8C3E]/30">
                    <td className="px-4 py-4 text-left text-[#4A7830]">
                      TEAM TOTAL
                    </td>
                    <td className="px-4 py-4 text-[#4A7830]">
                      ฿{fmt(teamSummary.revenue)}
                    </td>
                    <td className="px-4 py-4 text-[#4A7830]">
                      {fmt(teamSummary.units)}
                    </td>
                    <td className="px-4 py-4 text-[#4A7830]">
                      {fmt(teamSummary.bills)}
                    </td>
                    <td className="px-4 py-4 text-[#4A7830]">100%</td>
                  </tr>
                )}
                {sortedBranchRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-gray-400 font-medium"
                    >
                      ไม่พบข้อมูลยอดขายในช่วงที่กำหนด
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By-employee table (4a) */}
      {view === "employee" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 bg-gray-50/50 border-b">
            <h3 className="text-sm font-bold text-gray-900">ยอดขายตามพนักงาน</h3>
            <p className="text-xs text-gray-500">
              {employeeRows.length} รายการ
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center">
              <thead className="bg-[#f0f7ec] text-gray-700 text-[11px] uppercase tracking-wider">
                <tr>
                  <EmpHeader label="พนักงาน / Employee" field="employeeName" align="left" />
                  <EmpHeader label="สาขา / Branch" field="branchName" align="left" />
                  <EmpHeader label="Revenue (THB)" field="revenue" />
                  <EmpHeader label="Units Sold" field="units" />
                  <EmpHeader label="Bills" field="bills" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedEmployeeRows.map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4 text-left text-gray-800 font-medium">
                      {e.employeeName}
                    </td>
                    <td className="px-4 py-4 text-left text-gray-700">
                      {e.branchName}
                    </td>
                    <td className="px-4 py-4 text-gray-900 font-semibold">
                      ฿{fmt(e.revenue)}
                    </td>
                    <td className="px-4 py-4 text-gray-800">{fmt(e.units)}</td>
                    <td className="px-4 py-4 text-gray-800">{fmt(e.bills)}</td>
                  </tr>
                ))}
                {sortedEmployeeRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-gray-400 font-medium"
                    >
                      ไม่พบข้อมูลยอดขายในช่วงที่กำหนด
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
