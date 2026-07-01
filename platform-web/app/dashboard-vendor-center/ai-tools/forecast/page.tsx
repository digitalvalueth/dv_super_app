"use client";

import {
  AIPageHeader,
  AIResponseBox,
  KpiGrid,
} from "@/app/dashboard-vendor-center/ai-tools/_components";
import {
  fmtFull,
  fmtMoney,
  useAIStream,
  useBusinessMetrics,
} from "@/hooks/useBusinessMetrics";
import { Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ForecastPage() {
  const { metrics, loadingData, dataError, loadData, sales } =
    useBusinessMetrics();
  const { aiResponse, analyzing, runAI, responseRef } = useAIStream();

  // Projection scenarios
  const pessimistic = metrics.projectedRevenue * 0.85;
  const optimistic = metrics.projectedRevenue * 1.15;
  const growthPositive = metrics.revenueGrowthPct >= 0;

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <AIPageHeader
        title="Forecasting"
        subtitle="พยากรณ์ยอดขายและแนวโน้มรายได้ด้วย AI"
        onRefresh={loadData}
        loading={loadingData}
        salesCount={sales.length}
      />

      {dataError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          ⚠️ {dataError}
        </div>
      )}

      <KpiGrid metrics={metrics} loading={loadingData} />

      {/* Projection cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">
              Pessimistic (-15%)
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmtMoney(pessimistic)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            กรณีแย่ — ยอดต่ำกว่าปกติ 15%
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-300 shadow-md p-5 ring-2 ring-indigo-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700">
              Base Case
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmtFull(metrics.projectedRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            อ้างอิงจากค่าเฉลี่ย {metrics.daysElapsed} วันที่ผ่านมา
          </p>
          <div
            className={`mt-2 text-xs font-medium ${growthPositive ? "text-emerald-600" : "text-rose-600"}`}
          >
            {growthPositive ? "↑" : "↓"} MoM {growthPositive ? "+" : ""}
            {metrics.revenueGrowthPct.toFixed(1)}% vs เดือนก่อน
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700">
              Optimistic (+15%)
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {fmtMoney(optimistic)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            กรณีดีที่สุด — ยอดสูงกว่าปกติ 15%
          </p>
        </div>
      </div>

      {/* Daily bar chart */}
      {metrics.dailyRevenue.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">
            📈 ยอดขายรายวัน (เดือนนี้ vs เดือนก่อน)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={metrics.dailyRevenue} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtMoney(v as number)}
              />
              <Tooltip
                formatter={(v) => [fmtFull(v as number), "รายได้"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="thisMonth"
                name="เดือนนี้"
                fill="#5B8C3E"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="lastMonth"
                name="เดือนก่อน"
                fill="#D1FAE5"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Forecast button */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            🤖 AI Deep Forecast Analysis
          </p>
          <p className="text-xs text-gray-500">
            ให้ AI วิเคราะห์แนวโน้ม ปัจจัยเสี่ยง และโอกาสเติบโตจากข้อมูลจริง
          </p>
        </div>

        <button
          onClick={() => runAI(metrics, "forecast", "")}
          disabled={analyzing || loadingData}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{
            background: analyzing
              ? "#9CA3AF"
              : "linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)",
          }}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังพยากรณ์...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              🔮 พยากรณ์ด้วย AI
            </>
          )}
        </button>

        <AIResponseBox
          aiResponse={aiResponse}
          analyzing={analyzing}
          responseRef={responseRef}
          headerLabel="AI Sales Forecast"
          headerIcon={TrendingUp}
          headerBg="bg-indigo-50 border-indigo-100 text-indigo-800"
          borderColor="border-indigo-200"
        />
      </div>

      <p className="text-center text-xs text-gray-400">
        ข้อมูลดึงจาก Firestore แบบ Real-time · วิเคราะห์โดย Google Gemini AI
        {sales.length > 0 && ` · ${sales.length} รายการ (2 เดือนล่าสุด)`}
      </p>
    </div>
  );
}
