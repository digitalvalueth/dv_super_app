"use client";

import {
  AIPageHeader,
  AIResponseBox,
  AlertCard,
  KpiGrid,
} from "@/app/dashboard-vendor-center/ai-tools/_components";
import {
  fmtFull,
  fmtMoney,
  useAIStream,
  useBusinessMetrics,
} from "@/hooks/useBusinessMetrics";
import { AlertTriangle, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function AlertsPage() {
  const { metrics, loadingData, dataError, loadData, sales, autoAlerts } =
    useBusinessMetrics();
  const { aiResponse, analyzing, runAI, responseRef } = useAIStream();

  const criticalCount = autoAlerts.filter((a) => a.level === "critical").length;
  const warningCount = autoAlerts.filter((a) => a.level === "warning").length;

  // Promo vs Normal breakdown for chart
  const breakdownData = [
    {
      name: "โปรโมชัน",
      revenue: metrics.promotionRevenue,
      fill: "#5B8C3E",
    },
    {
      name: "ราคาปกติ",
      revenue: metrics.revenueThisMonth - metrics.promotionRevenue,
      fill: "#A3C96E",
    },
  ];

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <AIPageHeader
        title="Alerts"
        subtitle="ตรวจจับความผิดปกติและความเสี่ยงในธุรกิจแบบ Real-time"
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

      {/* Alert summary banner */}
      {!loadingData && autoAlerts.length > 0 && (
        <div
          className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${
            criticalCount > 0
              ? "bg-red-50 border-red-200"
              : warningCount > 0
                ? "bg-amber-50 border-amber-200"
                : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <AlertTriangle
            className={`w-6 h-6 shrink-0 ${
              criticalCount > 0
                ? "text-red-500"
                : warningCount > 0
                  ? "text-amber-500"
                  : "text-emerald-500"
            }`}
          />
          <div>
            <p className="font-semibold text-sm text-gray-900">
              พบ {autoAlerts.length} การแจ้งเตือน
              {criticalCount > 0 && (
                <span className="ml-2 text-red-600">
                  ({criticalCount} วิกฤต)
                </span>
              )}
              {warningCount > 0 && (
                <span className="ml-2 text-amber-600">
                  ({warningCount} เฝ้าระวัง)
                </span>
              )}
            </p>
            <p className="text-xs text-gray-500">
              ตรวจจับอัตโนมัติจากข้อมูล Firestore
            </p>
          </div>
        </div>
      )}

      {/* Auto alerts list */}
      {!loadingData && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            🚨 การแจ้งเตือนอัตโนมัติ
          </p>
          {autoAlerts.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 text-sm text-emerald-700">
              ✅ ไม่พบความผิดปกติ — ธุรกิจดำเนินไปได้ดี
            </div>
          ) : (
            <div className="space-y-2">
              {autoAlerts.map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}

      {loadingData && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-xl h-16 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Promo vs Normal bar chart */}
      {metrics.revenueThisMonth > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-1">
            📊 สัดส่วนรายได้: โปรโมชัน vs ราคาปกติ (เดือนนี้)
          </p>
          <p className="text-xs text-gray-400 mb-4">
            โปรโมชัน {fmtFull(metrics.promotionRevenue)} · ปกติ{" "}
            {fmtFull(metrics.revenueThisMonth - metrics.promotionRevenue)}
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={breakdownData}
              layout="vertical"
              barCategoryGap="35%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmtMoney(v as number)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "#4B5563" }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                formatter={(v) => [fmtFull(v as number), "รายได้"]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {breakdownData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI deep risk analysis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            🤖 AI Deep Risk Analysis
          </p>
          <p className="text-xs text-gray-500">
            ให้ AI วิเคราะห์ความเสี่ยง หาสาเหตุ และเสนอแผนรับมือจากข้อมูลจริง
          </p>
        </div>

        <button
          onClick={() => runAI(metrics, "alerts", "")}
          disabled={analyzing || loadingData}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{
            background: analyzing
              ? "#9CA3AF"
              : "linear-gradient(135deg, #DC2626 0%, #F97316 100%)",
          }}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังวิเคราะห์ความเสี่ยง...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              🔍 วิเคราะห์ความเสี่ยงเชิงลึก
            </>
          )}
        </button>

        <AIResponseBox
          aiResponse={aiResponse}
          analyzing={analyzing}
          responseRef={responseRef}
          headerLabel="AI Risk Analysis"
          headerIcon={ShieldAlert}
          headerBg="bg-red-50 border-red-100 text-red-800"
          borderColor="border-red-200"
        />
      </div>

      <p className="text-center text-xs text-gray-400">
        ข้อมูลดึงจาก Firestore แบบ Real-time · วิเคราะห์โดย Google Gemini AI
        {sales.length > 0 && ` · ${sales.length} รายการ (2 เดือนล่าสุด)`}
      </p>
    </div>
  );
}
