"use client";

import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Layers,
  MapPin,
  ShoppingBag,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  ComposedChart,
  Line,
  Area,
} from "recharts";

// Monthly revenue data for the bar chart
import { useEffect, useState, useMemo } from "react";
import { useBrand } from "./brand-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

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

interface Product {
  id: string;
  productId: string;
  companyId: string;
  name: string;
  barcode: string;
  status?: string;
  category?: string;
  beforeCount?: number;
}

interface CountingSession {
  id: string;
  productId: string;
  currentCountQty?: number;
  beforeCountQty?: number;
  status: string;
  createdAt?: any;
}

export default function DashboardOverview() {
  const { activeBrand } = useBrand();
  const [rawSales, setRawSales] = useState<DailySale[]>([]);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [rawSessions, setRawSessions] = useState<CountingSession[]>([]);
  const [totalBranchesCount, setTotalBranchesCount] = useState(71);
  const [loading, setLoading] = useState(true);

  const [revenueTab, setRevenueTab] = useState("YTD");
  const [rankingPeriod, setRankingPeriod] = useState("Yesterday");
  const [rankingSku, setRankingSku] = useState("Top 20 SKU");
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const companiesSnap = await getDocs(collection(db, "companies"));
        const phithan = companiesSnap.docs.find(d => {
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
        setRawSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as DailySale[]);

        const productsRef = collection(db, "products");
        const productsQuery = targetCompanyId
          ? query(productsRef, where("companyId", "==", targetCompanyId))
          : query(productsRef);
        const productsSnap = await getDocs(productsQuery);
        setRawProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[]);

        const sessionsRef = collection(db, "countingSessions");
        const sessionsQuery = targetCompanyId
          ? query(sessionsRef, where("companyId", "==", targetCompanyId))
          : query(sessionsRef);
        const sessionsSnap = await getDocs(sessionsQuery);
        setRawSessions(sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CountingSession[]);

        const branchesRef = collection(db, "branches");
        const branchesQuery = targetCompanyId
          ? query(branchesRef, where("companyId", "==", targetCompanyId))
          : query(branchesRef);
        const branchesSnap = await getDocs(branchesQuery);
        setTotalBranchesCount(branchesSnap.size || 71);
      } catch (err) {
        console.error("Error fetching vendor center dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
    const norm = (name || "").toLowerCase().replace(/\s+/g, "").trim();
    if (brand === "NEST ME") {
      return norm.includes("nestme") || norm.includes("nest me");
    } else {
      return norm.includes("primanest") || norm.includes("prima");
    }
  };

  const brandProducts = useMemo(() => {
    return rawProducts.filter(p => matchBrand(p.name || "", activeBrand));
  }, [rawProducts, activeBrand]);

  const brandSales = useMemo(() => {
    return rawSales.map(sale => {
      const brandItems = (sale.items || []).filter(item => matchBrand(item.productDescription || "", activeBrand));
      if (brandItems.length === 0) return null;
      const totalRevenue = brandItems.reduce((sum, item) => sum + (item.revenue || 0), 0);
      const totalUnits = brandItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      return {
        ...sale,
        items: brandItems,
        totalRevenue,
        totalUnits,
        totalItems: brandItems.length
      };
    }).filter(Boolean) as any[];
  }, [rawSales, activeBrand]);

  const sortedDates = useMemo(() => {
    const dates = brandSales.map(s => s.saleDate).filter(Boolean);
    return Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));
  }, [brandSales]);

  const latestDate = sortedDates[0] || "";
  const prevDate = sortedDates[1] || "";

  const latestDateLabel = useMemo(() => {
    if (!latestDate) return "—";
    const parts = latestDate.split("-");
    if (parts.length !== 3) return latestDate;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    return `${parts[2]} ${months[d.getMonth()]} ${parts[0]} (${days[d.getDay()]})`;
  }, [latestDate]);

  const getProductSoh = (productId: string) => {
    const sessions = rawSessions
      .filter(s => s.productId === productId && s.status === "completed")
      .sort((a, b) => {
        const tA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const tB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return tB - tA;
      });
    const latestSession = sessions[0];
    if (!latestSession) return 0;
    return latestSession.currentCountQty ?? latestSession.beforeCountQty ?? 0;
  };

  const yesterdaySales = brandSales.filter(s => s.saleDate === latestDate);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const yesterdayUnits = yesterdaySales.reduce((sum, s) => sum + s.totalUnits, 0);
  const yesterdayTransactions = yesterdaySales.length;
  const yesterdayUPT = yesterdayTransactions > 0 ? (yesterdayUnits / yesterdayTransactions) : 0;
  const yesterdayATV = yesterdayTransactions > 0 ? (yesterdayRevenue / yesterdayTransactions) : 0;
  const yesterdaySkus = new Set(yesterdaySales.flatMap(s => s.items.map(item => item.barcode))).size;

  const prevSales = brandSales.filter(s => s.saleDate === prevDate);
  const prevRevenue = prevSales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const prevUnits = prevSales.reduce((sum, s) => sum + s.totalUnits, 0);
  const prevTransactions = prevSales.length;
  const prevUPT = prevTransactions > 0 ? (prevUnits / prevTransactions) : 0;
  const prevATV = prevTransactions > 0 ? (prevRevenue / prevTransactions) : 0;

  const yesterdayRevenueGrowth = prevRevenue > 0 ? ((yesterdayRevenue - prevRevenue) / prevRevenue) * 100 : -6.1;
  const yesterdayUnitsGrowth = prevUnits > 0 ? ((yesterdayUnits - prevUnits) / prevUnits) * 100 : 1.9;
  const yesterdayTransactionsGrowth = prevTransactions > 0 ? ((yesterdayTransactions - prevTransactions) / prevTransactions) * 100 : -4.2;
  const yesterdayUPTGrowth = prevUPT > 0 ? ((yesterdayUPT - prevUPT) / prevUPT) * 100 : 7.4;
  const yesterdayATVGrowth = prevATV > 0 ? ((yesterdayATV - prevATV) / prevATV) * 100 : -2.0;

  const currentMonthPrefix = latestDate ? latestDate.substring(0, 7) : "";
  const mtdSales = brandSales.filter(s => s.saleDate.startsWith(currentMonthPrefix));
  const mtdRevenue = mtdSales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const mtdUnits = mtdSales.reduce((sum, s) => sum + s.totalUnits, 0);
  const mtdTransactions = mtdSales.length;
  const mtdUPT = mtdTransactions > 0 ? mtdUnits / mtdTransactions : 0;
  const mtdATV = mtdTransactions > 0 ? mtdRevenue / mtdTransactions : 0;
  const mtdSkusCount = new Set(mtdSales.flatMap(s => s.items.map(item => item.barcode))).size;

  const prevYearMonthPrefix = latestDate ? `${Number(latestDate.substring(0, 4)) - 1}${latestDate.substring(4, 7)}` : "";
  const prevMtdSales = brandSales.filter(s => s.saleDate.startsWith(prevYearMonthPrefix));
  const prevMtdRevenue = prevMtdSales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const prevMtdUnits = prevMtdSales.reduce((sum, s) => sum + s.totalUnits, 0);
  const prevMtdTransactions = prevMtdSales.length;

  const mtdRevenueGrowth = prevMtdRevenue > 0 ? ((mtdRevenue - prevMtdRevenue) / prevMtdRevenue) * 100 : 130.3;
  const mtdUnitsGrowth = prevMtdUnits > 0 ? ((mtdUnits - prevMtdUnits) / prevMtdUnits) * 100 : 172.1;
  const mtdTransactionsGrowth = prevMtdTransactions > 0 ? ((mtdTransactions - prevMtdTransactions) / prevMtdTransactions) * 100 : 50.5;

  const daysElapsed = latestDate ? Number(latestDate.split("-")[2]) : 28;
  const parts = latestDate ? latestDate.split("-") : [];
  const daysInMonth = latestDate ? new Date(Number(parts[0]), Number(parts[1]), 0).getDate() : 30;
  const daysLeft = daysInMonth - daysElapsed;
  const elapsedPercentage = Math.round((daysElapsed / daysInMonth) * 1000) / 10;

  const storesSellingCount = new Set(mtdSales.map(s => s.branchId)).size;

  const monthIdx = latestDate ? Number(latestDate.split("-")[1]) : 4;
  const remainingMonths = 12 - monthIdx;
  const ytdMonthsLabel = `${monthIdx} Months`;
  const remainingMonthsLabel = `${remainingMonths} Months Remaining`;
  const currentYear = latestDate ? latestDate.substring(0, 4) : "2026";
  const prevYear = latestDate ? String(Number(latestDate.substring(0, 4)) - 1) : "2025";
  
  const ytdSales = brandSales.filter(s => s.saleDate.startsWith(currentYear));
  const ytdRevenue = ytdSales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const ytdUnits = ytdSales.reduce((sum, s) => sum + s.totalUnits, 0);
  const ytdTransactions = ytdSales.length;
  const ytdSkusCount = new Set(ytdSales.flatMap(s => s.items.map(item => item.barcode))).size;
  const ytdUPT = ytdTransactions > 0 ? ytdUnits / ytdTransactions : 0;
  const ytdATV = ytdTransactions > 0 ? ytdRevenue / ytdTransactions : 0;

  const prevYearPrefix = prevYear;
  const prevYtdSales = brandSales.filter(s => {
    if (!s.saleDate.startsWith(prevYearPrefix)) return false;
    const m = Number(s.saleDate.split("-")[1]);
    return m <= monthIdx;
  });
  const prevYtdRevenue = prevYtdSales.reduce((sum, s) => sum + s.totalRevenue, 0) || 19690236;
  const prevYtdUnits = prevYtdSales.reduce((sum, s) => sum + s.totalUnits, 0) || 30000;
  const prevYtdTransactions = prevYtdSales.length || 10000;

  const ytdRevenueGrowth = prevYtdRevenue > 0 ? ((ytdRevenue - prevYtdRevenue) / prevYtdRevenue) * 100 : 52;
  const ytdUnitsGrowth = prevYtdUnits > 0 ? ((ytdUnits - prevYtdUnits) / prevYtdUnits) * 100 : 186.2;
  const ytdTransactionsGrowth = prevYtdTransactions > 0 ? ((ytdTransactions - prevYtdTransactions) / prevYtdTransactions) * 100 : 76.2;

  const ytdTarget = 30000000;
  const ytdAchievedPct = ytdTarget > 0 ? Math.round((ytdRevenue / ytdTarget) * 100) : 0;
  const targetToHit = Math.max(0, ytdTarget - ytdRevenue);
  const targetPerRemainingMonth = remainingMonths > 0 ? Math.round(targetToHit / remainingMonths) : 0;
  const projectedYtdAchieved = ytdTarget > 0 ? ((ytdRevenue + targetToHit) / ytdTarget * 100).toFixed(1) : "0";

  const nonMovingData = useMemo(() => {
    const date30DaysAgo = latestDate 
      ? new Date(new Date(latestDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : "";
    const soldBarcodes = new Set(brandSales.filter(s => s.saleDate >= date30DaysAgo).flatMap(s => s.items.map(item => item.barcode)));
    const nonMoving = brandProducts.filter(p => p.barcode && !soldBarcodes.has(p.barcode));
    const totalSoh = nonMoving.reduce((sum, p) => sum + (getProductSoh(p.productId) || p.beforeCount || 0), 0);
    return {
      count: nonMoving.length,
      totalSoh
    };
  }, [brandProducts, brandSales, latestDate, rawSessions]);

  const monthlyData = useMemo(() => {
    const year = latestDate ? latestDate.substring(0, 4) : "2026";
    const yearShort = year.substring(2);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return months.map((monthName, idx) => {
      const monthNum = String(idx + 1).padStart(2, "0");
      const thisYearPrefix = `${year}-${monthNum}`;
      const prevYearPrefix = `${Number(year) - 1}-${monthNum}`;
      
      const thisSales = brandSales.filter(s => s.saleDate.startsWith(thisYearPrefix));
      const prevSales = brandSales.filter(s => s.saleDate.startsWith(prevYearPrefix));
      
      const thisRevenue = thisSales.reduce((sum, s) => sum + s.totalRevenue, 0) / 1000000;
      const prevRevenue = prevSales.reduce((sum, s) => sum + s.totalRevenue, 0) / 1000000;
      
      const mockTargets = [2.8, 2.2, 2.3, 2.0, 2.2, 2.5, 2.5, 2.6, 2.4, 2.4, 3.0, 3.1];
      const target = mockTargets[idx];
      
      return {
        month: `${monthName}${yearShort}`,
        target,
        thisYear: thisRevenue || 0,
        prevYear: prevRevenue || 0,
      };
    });
  }, [brandSales, latestDate]);

  const ytdCumulativeData = useMemo(() => {
    let accumThisYear = 0;
    let accumPrevYear = 0;
    let accumTarget = 0;
    
    return monthlyData.map((data, idx) => {
      accumThisYear += data.thisYear * 1000000;
      accumPrevYear += data.prevYear * 1000000;
      accumTarget += data.target * 1000000;
      
      const latestMonthIdx = latestDate ? Number(latestDate.split("-")[1]) - 1 : 3;
      
      return {
        month: data.month,
        thisYear: idx <= latestMonthIdx ? accumThisYear : null,
        prevYear: accumPrevYear,
        target: accumTarget,
      };
    });
  }, [monthlyData, latestDate]);

  const productRankingData = useMemo(() => {
    let periodSales: any[] = [];
    if (rankingPeriod === "Yesterday") {
      periodSales = brandSales.filter(s => s.saleDate === latestDate);
    } else if (rankingPeriod === "MTD") {
      const prefix = latestDate ? latestDate.substring(0, 7) : "";
      periodSales = brandSales.filter(s => s.saleDate.startsWith(prefix));
    } else {
      const prefix = latestDate ? latestDate.substring(0, 4) : "";
      periodSales = brandSales.filter(s => s.saleDate.startsWith(prefix));
    }
    
    const totalPeriodRevenue = periodSales.reduce((sum, s) => sum + s.totalRevenue, 0);
    
    const agg: Record<string, { barcode: string, name: string, unitsSold: number, revenue: number }> = {};
    for (const sale of periodSales) {
      for (const item of sale.items) {
        const barcode = item.barcode || "unknown";
        if (!agg[barcode]) {
          agg[barcode] = {
            barcode,
            name: item.productDescription || "สินค้าไม่ระบุชื่อ",
            unitsSold: 0,
            revenue: 0,
          };
        }
        agg[barcode].unitsSold += item.quantity || 0;
        agg[barcode].revenue += item.revenue || 0;
      }
    }
    
    const list = Object.values(agg).map(item => {
      const prod = brandProducts.find(p => p.barcode === item.barcode);
      const status = prod?.status?.toUpperCase() || "ACTIVE";
      const category = prod?.category || "SKINCARE";
      const soh = prod ? (getProductSoh(prod.productId) || prod.beforeCount || 0) : 0;
      
      let days = 1;
      if (rankingPeriod === "MTD") {
        days = latestDate ? Number(latestDate.split("-")[2]) : 28;
      } else if (rankingPeriod === "YTD") {
        days = latestDate ? Math.min(365, Math.ceil((new Date(latestDate).getTime() - new Date(new Date(latestDate).getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000))) : 120;
      }
      const ads = Math.round((item.unitsSold / days) * 10) / 10;
      const doi = ads > 0 ? Math.round(soh / ads) : soh;
      
      return {
        name: item.name,
        barcode: item.barcode,
        status,
        category,
        revenue: item.revenue,
        contribution: totalPeriodRevenue > 0 ? Math.round((item.revenue / totalPeriodRevenue) * 1000) / 10 : 0,
        unitsSold: item.unitsSold,
        ads,
        soh,
        doi,
      };
    });
    
    return list.sort((a, b) => b.revenue - a.revenue).map((item, idx) => ({
      rank: idx + 1,
      ...item
    }));
  }, [brandSales, rankingPeriod, latestDate, brandProducts, rawSessions]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B8C3E] mx-auto"></div>
          <p className="mt-4 text-gray-500 font-medium">กำลังโหลดข้อมูลระบบผู้ขาย...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          Dashboard
        </h1>
        <div className="flex items-center text-sm text-gray-500 gap-2 mb-8">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span>Home</span>
          <span>&gt;</span>
          <span>Vendor</span>
          <span>&gt;</span>
          <span className="text-gray-900 font-medium">Dashboard</span>
        </div>

        <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
          <div className="w-16 h-16 bg-[#5B8C3E] rounded-2xl flex items-center justify-center text-white shadow-sm">
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-none mb-2">
              Overview
            </h2>
            <p className="text-gray-500 text-sm">
              Daily Sales, MTD, YTD &amp; Non-Moving Inventory
            </p>
          </div>
        </div>
      </div>

      {/* Top Filters */}
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            defaultChecked
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-900">ALL</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Offline
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="mode"
            className="w-4 h-4 text-[#4A7830] border-gray-300 focus:ring-[#5B8C3E]"
          />
          <span className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Online
          </span>
        </label>
      </div>

      {/* Header Info */}
      <div className="text-sm text-gray-700 mb-6">
        Company:{" "}
        <span className="font-bold text-gray-900">บริษัท พิธานไลฟ์ จำกัด</span>{" "}
        <span className="mx-3 text-gray-300">|</span> Brand:{" "}
        <span className="font-bold text-gray-900">{activeBrand}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ========================================================== */}
        {/* Left Card: Daily Sales */}
        {/* ========================================================== */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Daily Sales:</h2>
            <span className="text-sm text-gray-500">{latestDateLabel}</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <button className="bg-[#5B8C3E] text-white px-5 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-[#4A7830] transition-colors">
              Yesterday
            </button>
            <span className="text-gray-300">|</span>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> Start Date
            </button>
            <span className="text-gray-400">:</span>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> End Date
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
            {/* Left part: Revenue */}
            <div className="w-full md:w-2/5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                REVENUE (THB)
              </h3>
              <div className="flex items-end gap-3 mb-1">
                <span className="text-[40px] leading-none font-extrabold text-[#4A7830]">
                  {yesterdayRevenue.toLocaleString()}
                </span>
                <span className={`flex items-center text-sm font-bold mb-1 ${yesterdayRevenueGrowth >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {yesterdayRevenueGrowth >= 0 ? (
                    <TrendingUp strokeWidth={3} size={16} className="mr-1" />
                  ) : (
                    <TrendingDown strokeWidth={3} size={16} className="mr-1" />
                  )}
                  {yesterdayRevenueGrowth >= 0 ? "+" : ""}{yesterdayRevenueGrowth.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-6">previous day: {prevRevenue.toLocaleString()}</p>

              <h3 className="text-xs text-gray-500 mb-1">Daily Target</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">68,158</span>
                <span className="text-xs text-[#4A7830] font-medium">
                  (Achieved {(68158 > 0 ? (yesterdayRevenue / 68158) * 100 : 0).toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Right part: Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-[55%]">
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">{yesterdayUnits}</span>
                </div>
                <div className={`text-[10px] font-bold flex items-center ${yesterdayUnitsGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                  {yesterdayUnitsGrowth >= 0 ? (
                    <TrendingUp size={12} strokeWidth={3} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} strokeWidth={3} className="mr-1" />
                  )}
                  {yesterdayUnitsGrowth >= 0 ? "+" : ""}{yesterdayUnitsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  SKU
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={16} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-xl font-bold text-gray-900">{yesterdaySkus}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {brandProducts.length > 0 ? Math.round((yesterdaySkus / brandProducts.length) * 100) : 0}% of Selling SKU
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">{yesterdayTransactions}</span>
                </div>
                <div className={`text-[10px] font-bold flex items-center ${yesterdayTransactionsGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                  {yesterdayTransactionsGrowth >= 0 ? (
                    <TrendingUp size={12} strokeWidth={3} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} strokeWidth={3} className="mr-1" />
                  )}
                  {yesterdayTransactionsGrowth >= 0 ? "+" : ""}{yesterdayTransactionsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Layers
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      {yesterdayUPT.toFixed(1)}
                    </span>
                  </div>
                  <div className={`text-[10px] font-bold flex items-center ${yesterdayUPTGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                    {yesterdayUPTGrowth >= 0 ? (
                      <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />
                    ) : (
                      <TrendingDown size={10} strokeWidth={3} className="mr-0.5" />
                    )}
                    {yesterdayUPTGrowth >= 0 ? "+" : ""}{yesterdayUPTGrowth.toFixed(1)}%
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Wallet
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      {Math.round(yesterdayATV).toLocaleString()}
                    </span>
                  </div>
                  <div className={`text-[10px] font-bold flex items-center ${yesterdayATVGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                    {yesterdayATVGrowth >= 0 ? (
                      <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />
                    ) : (
                      <TrendingDown size={10} strokeWidth={3} className="mr-0.5" />
                    )}
                    {yesterdayATVGrowth >= 0 ? "+" : ""}{yesterdayATVGrowth.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={16} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={16} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 sm:text-right space-y-1.5">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Growth vs Previous
                Day
              </div>
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Selling SKU =
                Active + TBD
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* Right Card: Month-To-Date                                */}
        {/* ========================================================== */}
        <div className="bg-white border rounded-xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Month-To-Date {latestDate ? latestDate.substring(0, 7) : ""}
            </h2>
            <span className="text-xs text-red-500 font-bold italic">
              Time Elapsed: {elapsedPercentage}%
            </span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs text-gray-500">
              as of {latestDateLabel}
            </span>
            <span className="px-3 py-1 bg-[#f0f7ec] text-[#4A7830] rounded-full text-xs font-bold border border-[#d4e8c8]">
              {daysElapsed} Days
            </span>
            <span className="px-3 py-1 bg-red-50 text-red-500 rounded-full text-xs font-bold border border-red-100">
              {daysLeft} Days Left
            </span>
          </div>

          <div className="flex items-center gap-3 mb-8">
            <button className="bg-[#5B8C3E] text-white px-5 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-[#4A7830] transition-colors">
              MTD
            </button>
            <button className="border px-4 py-1.5 rounded-md text-sm text-gray-700 flex items-center gap-2 hover:bg-gray-50">
              <Calendar size={14} /> Select Month
            </button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
            {/* Left part: Charts & Target */}
            <div className="flex gap-6 w-full md:w-1/2">
              <div className="flex flex-col items-center">
                <div className="relative w-28 h-28 flex flex-col items-center justify-center">
                  <svg
                    viewBox="0 0 36 36"
                    className="w-full h-full transform -rotate-90"
                  >
                    <path
                      className="text-gray-100"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#5B8C3E]"
                      strokeDasharray="100, 100"
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {Math.round((mtdRevenue / 2044728) * 100)}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold">
                      Achieved
                    </span>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className="text-xs text-gray-500">To</div>
                  <div className="text-xs text-gray-500 mb-0.5">
                    Target
                  </div>
                  <div className="font-bold text-sm text-gray-900 flex items-center justify-center gap-1">
                    2,044,728
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Prev Year:{" "}
                    <span className="font-semibold text-gray-800">
                      {prevMtdRevenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-start gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#5B8C3E]"></div>
                    <span className="text-sm font-bold text-gray-600">
                      Revenue (THB)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] leading-none font-bold text-[#4A7830]">
                      {mtdRevenue.toLocaleString()}
                    </span>
                    <span className={`text-xs font-bold flex items-center ${mtdRevenueGrowth >= 0 ? "text-[#5B8C3E]" : "text-red-500"}`}>
                      {mtdRevenueGrowth >= 0 ? (
                        <TrendingUp size={12} strokeWidth={3} />
                      ) : (
                        <TrendingDown size={12} strokeWidth={3} />
                      )}
                      {mtdRevenueGrowth >= 0 ? "+" : ""}{mtdRevenueGrowth.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Previous Year : {prevMtdRevenue.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-[#a8d49a]"></div>
                    <span className="text-[11px] font-medium text-gray-500">
                      Remaining days:
                    </span>
                  </div>
                  <div className="text-lg font-bold text-gray-900 pl-4">{daysLeft} Days</div>
                </div>
              </div>
            </div>

            {/* Right part: Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 w-full md:w-[48%]">
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">
                    {mtdUnits.toLocaleString()}
                  </span>
                </div>
                <div className={`text-[10px] font-bold flex items-center ${mtdUnitsGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                  {mtdUnitsGrowth >= 0 ? (
                    <TrendingUp size={12} strokeWidth={3} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} strokeWidth={3} className="mr-1" />
                  )}
                  {mtdUnitsGrowth >= 0 ? "+" : ""}{mtdUnitsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  SKU
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag size={16} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-xl font-bold text-gray-900">{mtdSkusCount}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {brandProducts.length > 0 ? Math.round((mtdSkusCount / brandProducts.length) * 100) : 0}% of Selling SKU
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText
                    size={16}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-xl font-bold text-gray-900">{mtdTransactions.toLocaleString()}</span>
                </div>
                <div className={`text-[10px] font-bold flex items-center ${mtdTransactionsGrowth >= 0 ? "text-[#4A7830]" : "text-red-500"}`}>
                  {mtdTransactionsGrowth >= 0 ? (
                    <TrendingUp size={12} strokeWidth={3} className="mr-1" />
                  ) : (
                    <TrendingDown size={12} strokeWidth={3} className="mr-1" />
                  )}
                  {mtdTransactionsGrowth >= 0 ? "+" : ""}{mtdTransactionsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Layers
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      {mtdUPT.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-2.5 flex-1 bg-white flex flex-col justify-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Wallet
                      size={14}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-base font-bold text-gray-900">
                      {Math.round(mtdATV).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto flex flex-col sm:flex-row sm:justify-between items-start sm:items-end gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={16} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={16} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 sm:text-right space-y-1.5">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Info size={12} className="text-gray-300" /> Growth vs Previous
                Year
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Row 2: Selling Products | Non-Moving Inventory | Year-To-Date    */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-12 gap-6">
        {/* Selling Products */}
        <div className="xl:col-span-2 bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Selling Products
            </h3>
            <Link
              href="/dashboard-vendor-center/products"
              className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 hover:text-[#4A7830]"
            >
              See all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#f0f7ec] flex items-center justify-center">
              <ShoppingBag className="text-[#5B8C3E]" size={22} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-gray-900">
                  {brandProducts.length}
                </span>
                <span className="text-sm text-gray-500">SKUs</span>
              </div>
              <div className="text-xs text-gray-400">
                Act: <span className="font-bold text-gray-700">{brandProducts.filter(p => p.status !== 'TBD').length}</span> | TBD:{" "}
                <span className="font-bold text-gray-700">{brandProducts.filter(p => p.status === 'TBD').length}</span>
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-gray-900">
                Stores Selling
              </h4>
              <Link
                href="/dashboard-vendor-center/store-locations"
                className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 hover:text-[#4A7830]"
              >
                Details <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f0f7ec] flex items-center justify-center">
                <MapPin className="text-[#5B8C3E]" size={18} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-gray-900">
                  {storesSellingCount}
                </span>
                <span className="text-lg text-gray-400">/{totalBranchesCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Non-Moving Inventory */}
        <div className="xl:col-span-3 bg-white border rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900">
              Non-Moving Inventory
            </h3>
            <span className="text-xs text-gray-400">(Past 30 Days)</span>
          </div>
          <Link
            href="/dashboard-vendor-center/inventory-report"
            className="text-[#5B8C3E] text-xs font-semibold flex items-center gap-0.5 mb-4 hover:text-[#4A7830]"
          >
            View products <ArrowRight size={12} />
          </Link>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              NON-MOVEMENT SKU
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#d4e8c8] flex items-center justify-center">
                <Tag className="text-[#5B8C3E]" size={16} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-gray-900">{nonMovingData.count}</span>
                <span className="text-sm text-gray-500">SKU</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            TOTAL ON HAND
          </div>
          <div className="mb-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              UNITS
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{nonMovingData.totalSoh.toLocaleString()}</span>
            </div>
          </div>
          <div className="mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              VALUE (RSP)
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{(nonMovingData.totalSoh * 500).toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-auto text-[10px] text-gray-400 flex items-center gap-1">
            <Info size={10} /> Non-Movement Products over 30 Days (as of {latestDateLabel})
          </div>
        </div>


        {/* Year-To-Date */}
        <div className="lg:col-span-2 xl:col-span-7 bg-white border rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Year-To-Date as of {latestDate ? latestDate.substring(0, 7) : ""}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">as of {latestDateLabel}</span>
                <span className="px-2 py-0.5 bg-[#f0f7ec] text-[#4A7830] rounded-full text-[10px] font-bold border border-[#d4e8c8]">
                  {ytdMonthsLabel}
                </span>
                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                  {remainingMonthsLabel}
                </span>
              </div>
            </div>
            <span className="text-xs text-[#5B8C3E] font-bold italic">
              Time Elapsed: {(Math.round((monthIdx / 12) * 1000) / 10).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <button className="bg-[#5B8C3E] text-white px-4 py-1 rounded-md text-xs font-medium">
              {currentYear}
            </button>
            <button className="border px-3 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-50">
              {prevYear}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Donut + Revenue */}
            <div className="flex gap-4 lg:w-3/5">
              <div className="flex flex-col items-center shrink-0">
                <div className="relative w-24 h-24">
                  <svg
                    viewBox="0 0 36 36"
                    className="w-full h-full transform -rotate-90"
                  >
                    <path
                      className="text-gray-100"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-[#5B8C3E]"
                      strokeDasharray={`${ytdAchievedPct}, 100`}
                      strokeWidth="4"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#4A7830]">
                      {ytdAchievedPct}%
                    </span>
                    <span className="text-[9px] text-gray-500 font-bold">
                      Achieved
                    </span>
                  </div>
                </div>
                <div className="text-center mt-2 text-[10px] text-gray-500">
                  <div>To</div>
                  <div>{currentYear} Target</div>
                  <div className="font-bold text-xs text-gray-900">
                    {ytdTarget.toLocaleString()} <span className="text-[#5B8C3E]">~{ytdRevenueGrowth >= 0 ? "+" : ""}{ytdRevenueGrowth.toFixed(1)}%</span>
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    {prevYear}:{" "}
                    <span className="font-semibold text-gray-700">
                      {prevYtdRevenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-[#5B8C3E]"></div>
                    <span className="text-xs font-bold text-gray-600">
                      Revenue (THB)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#4A7830]">
                      {ytdRevenue.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-[#5B8C3E] flex items-center">
                      <TrendingUp size={12} strokeWidth={3} /> ~{ytdRevenueGrowth >= 0 ? "+" : ""}{ytdRevenueGrowth.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Previous Year : {prevYtdRevenue.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {monthIdx} Months Target: {Math.round((ytdTarget / 12) * monthIdx).toLocaleString()}{" "}
                    <span className="text-[#5B8C3E] font-bold">({ytdRevenue > 0 ? ((ytdRevenue / ((ytdTarget / 12) * monthIdx)) * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Gap to Target: <span className="font-bold">{(ytdRevenue >= ((ytdTarget / 12) * monthIdx) ? "—" : Math.round(((ytdTarget / 12) * monthIdx) - ytdRevenue).toLocaleString())}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-[11px] text-gray-500">
                      {remainingMonths} Months to Hit Target ({targetPerRemainingMonth.toLocaleString()} / Month)
                    </span>
                  </div>
                  <div className="text-xl font-bold text-gray-900 pl-3.5">
                    {targetToHit.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-[11px] text-gray-500">
                      YTD ({monthIdx} Months) + Target ({remainingMonths} Months Remaining)
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 pl-3.5">
                    <span className="text-xl font-bold text-gray-900">
                      {(ytdRevenue + targetToHit).toLocaleString()}
                    </span>
                    <span className="text-xs text-[#5B8C3E] font-bold">
                      (Achieved {projectedYtdAchieved}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 lg:w-2/5">
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  UNITS SOLD
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag
                    size={14}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-lg font-bold text-gray-900">
                    {ytdUnits.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                  <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                  ~{ytdUnitsGrowth >= 0 ? "+" : ""}{ytdUnitsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  SKU
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag size={14} className="text-[#5B8C3E]" strokeWidth={2.5} />
                  <span className="text-lg font-bold text-gray-900">{ytdSkusCount}</span>
                </div>
                <div className="text-[10px] text-gray-400">
                  {brandProducts.length > 0 ? Math.round((ytdSkusCount / brandProducts.length) * 100) : 0}% of Selling SKU
                </div>
              </div>
              <div className="border rounded-xl p-3 bg-white">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                  TRANSACTIONS
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText
                    size={14}
                    className="text-[#5B8C3E]"
                    strokeWidth={2.5}
                  />
                  <span className="text-lg font-bold text-gray-900">
                    {ytdTransactions.toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                  <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                  ~{ytdTransactionsGrowth >= 0 ? "+" : ""}{ytdTransactionsGrowth.toFixed(1)}%
                </div>
              </div>
              <div className="flex gap-2">
                <div className="border rounded-xl p-2 flex-1 bg-white">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    UPT
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Layers
                      size={12}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-sm font-bold text-gray-900">{ytdUPT.toFixed(1)}</span>
                  </div>
                </div>
                <div className="border rounded-xl p-2 flex-1 bg-white">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    ATV
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    <Wallet
                      size={12}
                      className="text-[#5B8C3E]"
                      strokeWidth={2.5}
                    />
                    <span className="text-sm font-bold text-gray-900">{Math.round(ytdATV).toLocaleString()}</span>
                  </div>
                  <div className="text-[10px] text-[#5B8C3E] font-bold flex items-center">
                    <TrendingUp size={10} strokeWidth={3} className="mr-0.5" />{" "}
                    ~+53.4%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-3 sm:gap-0 border-t pt-4">
            <div className="flex gap-4">
              <Link
                href="/dashboard-vendor-center/by-store"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Store <ArrowRight size={14} />
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                href="/dashboard-vendor-center/by-product"
                className="text-[#5B8C3E] hover:text-[#4A7830] text-sm font-semibold flex items-center gap-1"
              >
                by Product <ArrowRight size={14} />
              </Link>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-1">
              <Info size={12} className="text-gray-300" /> Growth vs Previous
              Year
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Revenue Performance Overview                                     */}
      {/* ================================================================ */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5B8C3E] flex items-center justify-center">
              <BarChart3 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Revenue Performance Overview
              </h2>
            </div>
          </div>
          <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
            <ExternalLink size={14} /> Go to <ChevronDown size={14} />
          </button>
        </div>

        {/* Tabs + Store Filter */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
          {["YTD", "Last12Month", "Quarterly", "LastYear"].map((tab) => (
            <button
              key={tab}
              onClick={() => setRevenueTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                revenueTab === tab
                  ? "bg-[#5B8C3E] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
          <select className="ml-3 border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white">
            <option>All Store</option>
          </select>
        </div>

        {/* Monthly Revenue Bar Chart — Recharts */}
        <div className="p-6">
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">
            Monthly Revenue (as of 28 Apr 2026)
          </h3>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: "#5B8C3E" }}
              ></div>
              <span className="text-xs text-gray-500">Target</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: "#a8d49a" }}
              ></div>
              <span className="text-xs text-gray-500">This Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span className="text-xs text-gray-500">Previous Year</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={monthlyData}
              barGap={2}
              barCategoryGap="20%"
              margin={{ top: 35, right: 0, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1 ? v + "M" : v * 1000 + "K"
                }
                domain={[0, 3.5]}
              />
              <RechartsTooltip
                cursor={{ fill: "rgba(91,140,62,0.06)" }}
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0]?.payload;
                  return (
                    <div className="bg-white border rounded-xl shadow-lg p-3 min-w-45">
                      <div className="font-bold text-gray-900 text-sm mb-2">
                        {label}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: "#5B8C3E" }}
                        />
                        <span className="text-xs text-gray-500 flex-1">
                          Target
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿{(data.target * 1000000).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: "#a8d49a" }}
                        />
                        <span className="text-xs text-gray-500 flex-1">
                          This Year
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿
                          {data.thisYear > 0
                            ? (data.thisYear * 1000000).toLocaleString()
                            : "0"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-500 flex-1">
                          Previous Year
                        </span>
                        <span className="text-xs font-bold text-gray-900">
                          ฿{(data.prevYear * 1000000).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />

              {/* MAX highlight — covers the max month bar group */}
              <ReferenceArea
                x1={monthlyData.reduce((maxM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const maxVal = Math.max(...withData.map((x) => x.thisYear));
                  return d.thisYear === maxVal ? d.month : maxM;
                }, monthlyData[0].month)}
                x2={monthlyData.reduce((maxM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const maxVal = Math.max(...withData.map((x) => x.thisYear));
                  return d.thisYear === maxVal ? d.month : maxM;
                }, monthlyData[0].month)}
                fill="#f0fdf4"
                fillOpacity={1}
                stroke="none"
                rx={8}
                ry={8}
                label={({ viewBox }: any) => {
                  if (!viewBox) return null;
                  const { x, y, width } = viewBox;
                  return (
                    <g>
                      <line
                        x1={x + 4}
                        y1={y}
                        x2={x + width - 4}
                        y2={y}
                        stroke="#059669"
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <rect
                        x={x + width / 2 - 32}
                        y={y - 28}
                        width={64}
                        height={20}
                        rx={10}
                        fill="#059669"
                      />
                      <text
                        x={x + width / 2}
                        y={y - 14}
                        fill="white"
                        fontSize={11}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ▲ MAX
                      </text>
                    </g>
                  );
                }}
              />

              {/* MIN highlight — covers the min month bar group */}
              <ReferenceArea
                x1={monthlyData.reduce((minM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const minVal = Math.min(...withData.map((x) => x.thisYear));
                  return d.thisYear === minVal ? d.month : minM;
                }, monthlyData[0].month)}
                x2={monthlyData.reduce((minM, d, i, arr) => {
                  const withData = arr.filter((x) => x.thisYear > 0);
                  const minVal = Math.min(...withData.map((x) => x.thisYear));
                  return d.thisYear === minVal ? d.month : minM;
                }, monthlyData[0].month)}
                fill="#fef2f2"
                fillOpacity={1}
                stroke="none"
                rx={8}
                ry={8}
                label={({ viewBox }: any) => {
                  if (!viewBox) return null;
                  const { x, y, width } = viewBox;
                  return (
                    <g>
                      <line
                        x1={x + 4}
                        y1={y}
                        x2={x + width - 4}
                        y2={y}
                        stroke="#dc2626"
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                      <rect
                        x={x + width / 2 - 32}
                        y={y - 28}
                        width={64}
                        height={20}
                        rx={10}
                        fill="#dc2626"
                      />
                      <text
                        x={x + width / 2}
                        y={y - 14}
                        fill="white"
                        fontSize={11}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        ▼ MIN
                      </text>
                    </g>
                  );
                }}
              />

              <Bar
                dataKey="target"
                fill="#5B8C3E"
                radius={[3, 3, 0, 0]}
                name="Target"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v >= 1 ? v + "M" : (v * 1000).toFixed(0) + "K",
                }}
              />
              <Bar
                dataKey="thisYear"
                fill="#a8d49a"
                radius={[3, 3, 0, 0]}
                name="This Year"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v > 0
                      ? v >= 1
                        ? v + "M"
                        : (v * 1000).toFixed(0) + "K"
                      : "",
                }}
              />
              <Bar
                dataKey="prevYear"
                fill="#d1d5db"
                radius={[3, 3, 0, 0]}
                name="Previous Year"
                label={{
                  position: "top",
                  fontSize: 8,
                  fill: "#6b7280",
                  formatter: (v: any) =>
                    v >= 1 ? v + "M" : (v * 1000).toFixed(0) + "K",
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Year-to-Date Revenue Line Chart — Recharts */}
        <div className="p-6 border-t">
          <h3 className="text-center text-base font-bold text-gray-900 mb-3">
            Year-to-Date Revenue (as of 28 Apr 2026)
          </h3>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5"
                style={{ background: "#5B8C3E" }}
              ></div>
              <span className="text-xs text-gray-500">This Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-teal-400"></div>
              <span className="text-xs text-gray-500">Previous Year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-0.5 bg-orange-400"
                style={{ borderTop: "2px dashed #f97316" }}
              ></div>
              <span className="text-xs text-gray-500">Target</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={ytdCumulativeData}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={{ stroke: "#d1d5db" }}
                tickLine={false}
                tickFormatter={(v: number) => (v / 1000000).toFixed(1) + "M"}
                domain={[0, 32000000]}
              />
              <RechartsTooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-white border rounded-xl shadow-lg p-3 min-w-45">
                      <div className="font-bold text-gray-900 text-sm mb-2">
                        {label}
                      </div>
                      {payload.map((p: any, index: number) => (
                        <div
                          key={`${p.dataKey}-${index}`}
                          className="flex items-center gap-2 mb-1"
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: p.color }}
                          />
                          <span className="text-xs text-gray-500 flex-1">
                            {p.name}
                          </span>
                          <span className="text-xs font-bold text-gray-900">
                            ฿{p.value?.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <ReferenceLine
                x="Apr26"
                stroke="#5B8C3E"
                strokeDasharray="4 3"
                strokeOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="thisYear"
                fill="#5B8C3E"
                fillOpacity={0.1}
                stroke="none"
                name="This Year"
              />
              <Line
                type="monotone"
                dataKey="thisYear"
                stroke="#5B8C3E"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#5B8C3E", stroke: "white", strokeWidth: 2 }}
                name="This Year"
              />
              <Line
                type="monotone"
                dataKey="prevYear"
                stroke="#2dd4bf"
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: "#2dd4bf",
                  stroke: "white",
                  strokeWidth: 1.5,
                }}
                name="Previous Year"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#f97316"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={{
                  r: 3,
                  fill: "#f97316",
                  stroke: "white",
                  strokeWidth: 1.5,
                }}
                name="Target"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================================================================ */}
      {/* Product Ranking                                                  */}
      {/* ================================================================ */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <ShoppingBag className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Product Ranking
              </h2>
              <p className="text-xs text-gray-400">
                Best-Selling Products by Revenue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 border rounded-lg px-3 py-1.5">
              <ExternalLink size={14} /> Go to <ChevronDown size={14} />
            </button>
            <Link
              href="/dashboard-vendor-center/products"
              className="text-[#5B8C3E] text-xs font-semibold hover:text-[#4A7830]"
            >
              by category →
            </Link>
          </div>
        </div>

        <div className="border-t border-[#a8d49a]"></div>

        {/* Filters */}
        <div className="p-6 pb-2 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600 font-medium">Revenue Period:</span>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
              <option>Select Month</option>
            </select>
            <span className="text-gray-400 text-xs">
              28/04/2026 - 28/04/2026
            </span>
          </div>

          <div className="flex items-center gap-2">
            {["Yesterday", "7 Days", "MTD", "LastMonth", "YTD", "LastYear"].map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setRankingPeriod(p)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    rankingPeriod === p
                      ? "bg-[#5B8C3E] text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <div className="flex items-center gap-2">
            {["Top 20 SKU", "Top 50 SKU", "All SKU", "Top 80%"].map((s) => (
              <button
                key={s}
                onClick={() => setRankingSku(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  rankingSku === s
                    ? "bg-[#5B8C3E] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s}
              </button>
            ))}
            <span className="text-sm text-gray-600 ml-3">Store:</span>
            <select className="border rounded-lg px-3 py-1.5 text-sm bg-white text-gray-700">
              <option>All Store</option>
            </select>
          </div>
        </div>

        {/* Summary Badge */}
        <div className="mx-6 mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#5B8C3E] flex items-center justify-center">
            <ShoppingBag className="text-white" size={16} />
          </div>
          <span className="text-sm font-bold text-gray-900">
            80.1% of Revenue: 13 SKUs (48% of Selling SKUs)
          </span>
        </div>

        {/* Table */}
        <div className="px-6 pb-6 overflow-x-auto">
          <div className="text-right text-[10px] text-gray-400 italic mb-1">
            Base on last 30Days of Sales
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#5B8C3E] text-white">
                <th className="text-left px-3 py-2.5 rounded-tl-lg font-semibold w-8">
                  #
                </th>
                <th className="text-left px-3 py-2.5 font-semibold">
                  Product Name
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  Revenue (THB)
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  % Contribution
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">
                  Units Sold
                </th>
                <th className="text-right px-3 py-2.5 font-semibold">ADS</th>
                <th className="text-right px-3 py-2.5 font-semibold">SOH</th>
                <th className="text-right px-3 py-2.5 rounded-tr-lg font-semibold">
                  DOI
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Total Row */}
              <tr
                onClick={() => router.push("/dashboard-vendor-center/products")}
                className="bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition"
              >
                <td className="px-3 py-2.5" colSpan={2}>
                  Total{" "}
                  <span className="text-gray-400 font-normal">({productRankingData.length} SKUs)</span>
                </td>
                <td className="text-right px-3 py-2.5">
                  {productRankingData.reduce((sum, p) => sum + p.revenue, 0).toLocaleString()}
                </td>
                <td className="text-right px-3 py-2.5">
                  {productRankingData.reduce((sum, p) => sum + p.contribution, 0).toFixed(1)}%
                </td>
                <td className="text-right px-3 py-2.5">
                  {productRankingData.reduce((sum, p) => sum + p.unitsSold, 0).toLocaleString()}
                </td>
                <td className="text-right px-3 py-2.5">
                  {Math.round(productRankingData.reduce((sum, p) => sum + p.ads, 0) * 10) / 10}
                </td>
                <td className="text-right px-3 py-2.5">
                  {productRankingData.reduce((sum, p) => sum + p.soh, 0).toLocaleString()}
                </td>
                <td className="text-right px-3 py-2.5"></td>
              </tr>
              {productRankingData.map((p) => (
                <tr
                  key={p.rank}
                  className="border-b hover:bg-[#f0f7ec]/30 transition-colors"
                >
                  <td className="px-3 py-3 text-gray-500 font-bold">
                    {p.rank}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 shrink-0">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {p.barcode} ({p.status}) ⊕
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {p.category}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right px-3 py-3 font-semibold text-gray-900">
                    {p.revenue.toLocaleString()}
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.contribution}%
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.unitsSold}
                  </td>
                  <td className="text-right px-3 py-3 text-gray-700">
                    {p.ads}
                  </td>
                  <td className="text-right px-3 py-3">
                    <span className="text-[#5B8C3E] font-semibold">
                      {p.soh.toLocaleString()}{" "}
                      <ExternalLink size={10} className="inline" />
                    </span>
                  </td>
                  <td className="text-right px-3 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                        p.doi > 100
                          ? "bg-[#d4e8c8] text-[#4A7830]"
                          : p.doi > 50
                            ? "bg-orange-100 text-orange-600"
                            : "bg-red-100 text-red-600"
                      }`}
                    >
                      {p.doi}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
