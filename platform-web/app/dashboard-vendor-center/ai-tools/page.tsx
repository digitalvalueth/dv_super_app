"use client";

import {
  AIPageHeader,
  AIResponseBox,
  KpiGrid,
} from "@/app/dashboard-vendor-center/ai-tools/_components";
import {
  fmtFull,
  useAIStream,
  useBusinessMetrics,
} from "@/hooks/useBusinessMetrics";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

export default function AIInsightsPage() {
  const { metrics, loadingData, dataError, loadData, sales } =
    useBusinessMetrics();
  const { aiResponse, analyzing, runAI, responseRef } = useAIStream();
  const [challenge, setChallenge] = useState("");

  const growthPositive = metrics.revenueGrowthPct >= 0;
  const promoRatio =
    metrics.revenueThisMonth > 0
      ? ((metrics.promotionRevenue / metrics.revenueThisMonth) * 100).toFixed(0)
      : "0";

  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <AIPageHeader
        title="AI Insights"
        subtitle="วิเคราะห์ปัญหาและให้คำแนะนำเชิงกลยุทธ์จากข้อมูลจริง"
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
        {/* Context summary */}
        <div className="bg-linear-to-br from-[#f0f7ec] to-[#e8f5e0] rounded-xl p-4">
          <p className="text-xs font-bold text-[#4A7830] uppercase tracking-wide mb-3">
            📊 ข้อมูลที่ AI จะใช้วิเคราะห์ (ดึงจาก Firestore อัตโนมัติ)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">รายได้เดือนนี้</span>
              <p className="font-bold text-gray-900">
                {fmtFull(metrics.revenueThisMonth)}
              </p>
            </div>
            <div>
              <span className="text-gray-500">การเติบโต MoM</span>
              <p
                className={`font-bold ${growthPositive ? "text-emerald-700" : "text-rose-700"}`}
              >
                {growthPositive ? "+" : ""}
                {metrics.revenueGrowthPct.toFixed(1)}%
              </p>
            </div>
            <div>
              <span className="text-gray-500">สัดส่วนโปรโมชัน</span>
              <p className="font-bold text-gray-900">{promoRatio}%</p>
            </div>
            <div>
              <span className="text-gray-500">Top Product</span>
              <p className="font-bold text-gray-900 truncate">
                {metrics.topProducts[0]?.name?.slice(0, 20) ?? "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Challenge input */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            ปัญหา / ความท้าทายหลักตอนนี้ <span className="text-red-500">*</span>
          </label>
          <textarea
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="เช่น ยอดขายสาขา X ลดลงต่อเนื่อง 3 เดือน, พนักงานหลายคนลาออก, ต้นทุนสูงขึ้นแต่รายได้ไม่เพิ่ม, ลูกค้าเก่าไม่กลับมาซื้อซ้ำ..."
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B8C3E]/30 focus:border-[#5B8C3E] resize-none leading-relaxed"
          />
          <p className="mt-1.5 text-xs text-gray-400">
            ยิ่งอธิบายรายละเอียดมาก AI จะวิเคราะห์ได้แม่นยำยิ่งขึ้น
          </p>
        </div>

        {/* Analyze button */}
        <button
          onClick={() => runAI(metrics, "insights", challenge)}
          disabled={analyzing || !challenge.trim() || loadingData}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{
            background: analyzing
              ? "#9CA3AF"
              : "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
          }}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังวิเคราะห์...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />✨ วิเคราะห์ด้วย AI ทันที
            </>
          )}
        </button>

        <AIResponseBox
          aiResponse={aiResponse}
          analyzing={analyzing}
          responseRef={responseRef}
          headerLabel="AI Business Insights"
          headerIcon={Brain}
          headerBg="bg-violet-50 border-violet-100 text-violet-800"
          borderColor="border-violet-200"
        />

        {/* Top products table */}
        {metrics.topProducts.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              🏆 สินค้าขายดีสุดเดือนนี้
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 w-8">
                      #
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">
                      ชื่อสินค้า
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                      รายได้
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">
                      จำนวน
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topProducts.slice(0, 8).map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-gray-50 transition"
                    >
                      <td className="py-2 px-3 text-gray-400 text-xs">
                        {i + 1}
                      </td>
                      <td className="py-2 px-3 text-gray-800 max-w-65 truncate">
                        {p.name}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
                        {fmtFull(p.revenue)}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-500">
                        {p.units} ชิ้น
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400">
        ข้อมูลดึงจาก Firestore แบบ Real-time · วิเคราะห์โดย Google Gemini AI
        {sales.length > 0 && ` · ${sales.length} รายการ (2 เดือนล่าสุด)`}
      </p>
    </div>
  );
}
