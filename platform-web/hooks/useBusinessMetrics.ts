"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Types (exported for use in pages) ───────────────────────────────────────

export interface DailySaleItem {
  barcode: string;
  productDescription: string;
  price: number;
  quantity: number;
  revenue: number;
  saleType: "normal" | "promotion";
}

export interface DailySale {
  id: string;
  companyId: string;
  branchId: string;
  branchName: string;
  employeeId: string;
  employeeName: string;
  supervisorId?: string;
  seller?: string;
  saleDate: string;
  items: DailySaleItem[];
  totalItems: number;
  totalRevenue: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  units: number;
}

export interface DailyPoint {
  date: string;
  revenue: number;
}

export interface BusinessMetrics {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowthPct: number;
  totalTransactionsThisMonth: number;
  totalTransactionsLastMonth: number;
  uniqueStaffThisMonth: number;
  uniqueBranchesThisMonth: number;
  topProducts: TopProduct[];
  dailyRevenue: DailyPoint[];
  promotionRevenue: number;
  normalRevenue: number;
  daysElapsed: number;
  daysInMonth: number;
  projectedRevenue: number;
  dailyAverage: number;
  seller?: string;
}

export interface AutoAlert {
  level: "critical" | "warning" | "info" | "success";
  title: string;
  detail: string;
}

// ─── Helpers (exported) ───────────────────────────────────────────────────────

export const pad = (n: number) => String(n).padStart(2, "0");

export const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `฿${(n / 1_000_000).toFixed(2)}M`
    : `฿${n.toLocaleString("th-TH")}`;

export const fmtFull = (n: number) => `฿${n.toLocaleString("th-TH")}`;

export function getMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

export function computeMetrics(sales: DailySale[], now: Date): BusinessMetrics {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;

  const thisPrefix = `${y}-${pad(m)}`;
  const lastPrefix = `${prevY}-${pad(prevM)}`;

  const thisSales = sales.filter((s) => s.saleDate.startsWith(thisPrefix));
  const lastSales = sales.filter((s) => s.saleDate.startsWith(lastPrefix));

  const revenueThisMonth = thisSales.reduce((s, r) => s + r.totalRevenue, 0);
  const revenueLastMonth = lastSales.reduce((s, r) => s + r.totalRevenue, 0);

  const uniqueStaff = new Set(thisSales.map((s) => s.employeeId)).size;
  const uniqueBranches = new Set(thisSales.map((s) => s.branchId)).size;

  const dailyMap: Record<string, number> = {};
  for (const s of thisSales) {
    dailyMap[s.saleDate] = (dailyMap[s.saleDate] ?? 0) + s.totalRevenue;
  }
  const dailyRevenue = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  const productMap: Record<string, TopProduct> = {};
  for (const s of thisSales) {
    for (const item of s.items) {
      const key = item.barcode || item.productDescription;
      if (!productMap[key]) {
        productMap[key] = {
          name: item.productDescription || item.barcode,
          revenue: 0,
          units: 0,
        };
      }
      productMap[key].revenue += item.revenue;
      productMap[key].units += item.quantity;
    }
  }
  const topProducts = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  let promotionRevenue = 0;
  let normalRevenue = 0;
  for (const s of thisSales) {
    for (const item of s.items) {
      if (item.saleType === "promotion") promotionRevenue += item.revenue;
      else normalRevenue += item.revenue;
    }
  }

  const daysElapsed = now.getDate();
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyAverage = daysElapsed > 0 ? revenueThisMonth / daysElapsed : 0;
  const projectedRevenue = dailyAverage * daysInMonth;

  const seller =
    thisSales.find((s) => s.seller)?.seller ??
    lastSales.find((s) => s.seller)?.seller;

  return {
    revenueThisMonth,
    revenueLastMonth,
    revenueGrowthPct:
      revenueLastMonth > 0
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        : 0,
    totalTransactionsThisMonth: thisSales.length,
    totalTransactionsLastMonth: lastSales.length,
    uniqueStaffThisMonth: uniqueStaff,
    uniqueBranchesThisMonth: uniqueBranches,
    topProducts,
    dailyRevenue,
    promotionRevenue,
    normalRevenue,
    daysElapsed,
    daysInMonth,
    projectedRevenue,
    dailyAverage,
    seller,
  };
}

export function generateAutoAlerts(m: BusinessMetrics): AutoAlert[] {
  const alerts: AutoAlert[] = [];

  if (m.revenueGrowthPct < -20) {
    alerts.push({
      level: "critical",
      title: "รายได้ลดลงรุนแรง",
      detail: `รายได้เดือนนี้ลดลง ${Math.abs(m.revenueGrowthPct).toFixed(1)}% จากเดือนก่อน (${fmtFull(m.revenueLastMonth)} → ${fmtFull(m.revenueThisMonth)})`,
    });
  } else if (m.revenueGrowthPct < -5) {
    alerts.push({
      level: "warning",
      title: "รายได้ลดลงจากเดือนก่อน",
      detail: `ลดลง ${Math.abs(m.revenueGrowthPct).toFixed(1)}% — ควรตรวจสอบสาเหตุ`,
    });
  } else if (m.revenueGrowthPct > 10) {
    alerts.push({
      level: "success",
      title: "รายได้เติบโตดีเยี่ยม",
      detail: `เพิ่มขึ้น ${m.revenueGrowthPct.toFixed(1)}% จากเดือนก่อน — ควรรักษา momentum นี้ไว้`,
    });
  }

  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const recordedDays = new Set(m.dailyRevenue.map((d) => d.date));
  const missingDays: string[] = [];
  for (let day = 1; day < now.getDate(); day++) {
    const d = `${y}-${pad(mo)}-${pad(day)}`;
    if (!recordedDays.has(d)) missingDays.push(d);
  }
  if (missingDays.length >= 3) {
    alerts.push({
      level: "warning",
      title: `พบ ${missingDays.length} วันที่ไม่มีข้อมูลยอดขาย`,
      detail: `วันที่ขาดข้อมูล: ${missingDays.slice(0, 5).join(", ")}${missingDays.length > 5 ? " ..." : ""} — อาจมีการบันทึกไม่สมบูรณ์`,
    });
  }

  if (m.revenueThisMonth > 0) {
    const promoRatio = m.promotionRevenue / m.revenueThisMonth;
    if (promoRatio > 0.6) {
      alerts.push({
        level: "warning",
        title: "พึ่งพาโปรโมชันมากเกินไป",
        detail: `${(promoRatio * 100).toFixed(0)}% ของรายได้มาจากโปรโมชัน — ความเสี่ยงสูงถ้าโปรโมชันสิ้นสุด`,
      });
    }
  }

  if (m.projectedRevenue > m.revenueLastMonth * 1.1 && m.revenueLastMonth > 0) {
    alerts.push({
      level: "success",
      title: "แนวโน้มสิ้นเดือนดีกว่าเดือนก่อน",
      detail: `คาดว่าจะได้ ${fmtFull(m.projectedRevenue)} ซึ่งสูงกว่าเดือนก่อน ${((m.projectedRevenue / m.revenueLastMonth - 1) * 100).toFixed(1)}%`,
    });
  }

  if (m.uniqueStaffThisMonth === 0) {
    alerts.push({
      level: "critical",
      title: "ไม่พบข้อมูลการบันทึกยอดขาย",
      detail: "ยังไม่มีข้อมูลจากพนักงานเลย — ตรวจสอบการเชื่อมต่อระบบ",
    });
  } else if (m.uniqueStaffThisMonth < 3) {
    alerts.push({
      level: "info",
      title: "พนักงานที่ส่งข้อมูลน้อย",
      detail: `มีเพียง ${m.uniqueStaffThisMonth} คนที่บันทึกยอดขายเดือนนี้`,
    });
  }

  const weekdayRevenues = m.dailyRevenue.map((d) => d.revenue);
  if (weekdayRevenues.length >= 3) {
    const avg =
      weekdayRevenues.reduce((a, b) => a + b, 0) / weekdayRevenues.length;
    const lastDay = weekdayRevenues[weekdayRevenues.length - 1];
    if (lastDay < avg * 0.4) {
      alerts.push({
        level: "warning",
        title: "ยอดขายวันล่าสุดต่ำกว่าค่าเฉลี่ยมาก",
        detail: `ยอดขายล่าสุด ${fmtFull(lastDay)} ต่ำกว่าค่าเฉลี่ยรายวัน ${fmtFull(avg)} ถึง ${(((avg - lastDay) / avg) * 100).toFixed(0)}%`,
      });
    }
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      title: "ระบบปกติ",
      detail: "ไม่พบความผิดปกติในข้อมูลปัจจุบัน",
    });
  }

  return alerts;
}

// ─── useBusinessMetrics hook ──────────────────────────────────────────────────

export function useBusinessMetrics() {
  const { userData } = useAuthStore();
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");

  const loadData = useCallback(async () => {
    if (!userData) return;
    setLoadingData(true);
    setDataError("");

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const prevY = m === 1 ? y - 1 : y;
    const prevM = m === 1 ? 12 : m - 1;

    const start = getMonthRange(prevY, prevM).start;
    const end = getMonthRange(y, m).end;

    try {
      const ref = collection(db, "dailySales");
      let q;

      if (userData.role === "admin" || userData.role === "super_admin") {
        q = query(
          ref,
          where("companyId", "==", userData.companyId ?? ""),
          where("saleDate", ">=", start),
          where("saleDate", "<=", end),
          orderBy("saleDate", "asc"),
        );
      } else if (userData.role === "supervisor") {
        q = query(
          ref,
          where("supervisorId", "==", userData.uid),
          where("saleDate", ">=", start),
          where("saleDate", "<=", end),
          orderBy("saleDate", "asc"),
        );
      } else {
        q = query(
          ref,
          where("employeeId", "==", userData.uid),
          where("saleDate", ">=", start),
          where("saleDate", "<=", end),
          orderBy("saleDate", "asc"),
        );
      }

      const snap = await getDocs(q);
      setSales(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DailySale, "id">),
        })),
      );
    } catch (e) {
      console.error(e);
      setDataError("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setLoadingData(false);
    }
  }, [userData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const metrics = useMemo(() => computeMetrics(sales, new Date()), [sales]);
  const autoAlerts = useMemo(() => generateAutoAlerts(metrics), [metrics]);

  return { sales, metrics, autoAlerts, loadingData, dataError, loadData };
}

// ─── useAIStream hook ─────────────────────────────────────────────────────────

export function useAIStream() {
  const [aiResponse, setAiResponse] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);

  const runAI = useCallback(
    async (
      metrics: BusinessMetrics,
      mode: "insights" | "forecast" | "alerts",
      challenge = "",
    ) => {
      if (mode === "insights" && !challenge.trim()) return;
      setAnalyzing(true);
      setAiResponse("");

      try {
        const res = await fetch("/api/ai-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metrics, challenge: challenge.trim(), mode }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          setAiResponse(`❌ ${err.error || "เกิดข้อผิดพลาด"}`);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setAiResponse(acc);
          responseRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      } catch (e) {
        setAiResponse(
          `❌ เกิดข้อผิดพลาด: ${e instanceof Error ? e.message : "Unknown"}`,
        );
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  return { aiResponse, analyzing, runAI, responseRef };
}
