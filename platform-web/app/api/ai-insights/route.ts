import { adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DailyPoint {
  date: string;
  revenue: number;
}

export interface TopProduct {
  name: string;
  revenue: number;
  units: number;
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

// ─── Gemini Key ──────────────────────────────────────────────────────────────

async function getGeminiApiKey(): Promise<string> {
  try {
    const snap = await adminDb.collection("appConfig").doc("gemini").get();
    if (snap.exists) {
      const key = snap.data()?.apiKey as string | undefined;
      if (key) return key;
    }
  } catch {
    // fall through
  }
  return (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || ""
  );
}

// ─── Prompt Builders ─────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("th-TH");
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function metricsBlock(m: BusinessMetrics): string {
  const promoRatio =
    m.revenueThisMonth > 0
      ? ((m.promotionRevenue / m.revenueThisMonth) * 100).toFixed(1)
      : "0";
  const normalRatio =
    m.revenueThisMonth > 0
      ? ((m.normalRevenue / m.revenueThisMonth) * 100).toFixed(1)
      : "0";
  const topLines = m.topProducts
    .slice(0, 8)
    .map(
      (p, i) => `  ${i + 1}. ${p.name} — ฿${fmt(p.revenue)} (${p.units} ชิ้น)`,
    )
    .join("\n");
  const dailyLines = m.dailyRevenue
    .slice(-7)
    .map((d) => `  ${d.date}: ฿${fmt(d.revenue)}`)
    .join("\n");

  return `
=== ข้อมูลธุรกิจ (ดึงจาก Firestore อัตโนมัติ) ===
• รายได้เดือนนี้        : ฿${fmt(m.revenueThisMonth)}
• รายได้เดือนก่อน       : ฿${fmt(m.revenueLastMonth)}
• การเติบโต MoM        : ${pct(m.revenueGrowthPct)}
• จำนวน transactions   : ${m.totalTransactionsThisMonth} รายการ (เดือนก่อน ${m.totalTransactionsLastMonth})
• พนักงานที่ active     : ${m.uniqueStaffThisMonth} คน
• สาขาที่ active        : ${m.uniqueBranchesThisMonth} สาขา
• ยอดเฉลี่ยต่อวัน       : ฿${fmt(m.dailyAverage)} (ผ่านมา ${m.daysElapsed}/${m.daysInMonth} วัน)
• คาดการณ์สิ้นเดือน    : ฿${fmt(m.projectedRevenue)}
• ยอดขายปกติ           : ฿${fmt(m.normalRevenue)} (${normalRatio}%)
• ยอดขายโปรโมชัน       : ฿${fmt(m.promotionRevenue)} (${promoRatio}%)
${m.seller ? `• Seller/Brand         : ${m.seller}` : ""}

TOP PRODUCTS เดือนนี้:
${topLines || "  (ยังไม่มีข้อมูล)"}

รายได้ 7 วันล่าสุด:
${dailyLines || "  (ยังไม่มีข้อมูล)"}
`.trim();
}

function buildInsightsPrompt(m: BusinessMetrics, challenge: string): string {
  return `คุณคือที่ปรึกษาธุรกิจอาวุโสระดับ McKinsey ที่เชี่ยวชาญด้าน FMCG, Retail และ Beauty Distribution ในประเทศไทย
คุณมีข้อมูลธุรกิจจริงจาก Firestore และต้องวิเคราะห์อย่างลึกซึ้งและให้คำแนะนำที่ปฏิบัติได้จริง

${metricsBlock(m)}

=== ปัญหา / ความท้าทายที่ต้องการให้วิเคราะห์ ===
"${challenge}"

=== สิ่งที่ต้องตอบ (ตอบเป็นภาษาไทย) ===

## 1. 📊 วิเคราะห์สถานการณ์ธุรกิจปัจจุบัน
วิเคราะห์ตัวเลขทั้งหมดข้างต้นว่าธุรกิจอยู่ในสถานะใด สัญญาณเตือน และจุดแข็งที่มี

## 2. 🎯 Root Cause Analysis ของปัญหา
วิเคราะห์สาเหตุที่แท้จริงของปัญหาที่ระบุ โดยอ้างอิงจากตัวเลขธุรกิจ

## 3. ⚡ Quick Wins (ทำได้ภายใน 7 วัน)
รายการสิ่งที่ทำได้ทันทีเพื่อแก้ปัญหาเฉพาะหน้า อย่างน้อย 3 ข้อ

## 4. 🚀 Strategic Recommendations (1-3 เดือน)
คำแนะนำเชิงกลยุทธ์ที่ลึกซึ้ง พร้อม metrics ที่ต้องวัด อย่างน้อย 3 ข้อ

## 5. ⚠️ ความเสี่ยงที่ต้องระวัง
ความเสี่ยงหลัก 2-3 ข้อที่อาจเกิดขึ้นและวิธีป้องกัน

## 6. 📈 KPI ที่ควร Track
ตัวชี้วัด 5 ตัวที่สำคัญที่สุดสำหรับธุรกิจนี้ในช่วง 30 วันข้างหน้า

ตอบให้ละเอียด เป็นรูปธรรม อ้างอิงตัวเลขจริง ไม่พูดกว้างๆ`;
}

function buildForecastPrompt(m: BusinessMetrics): string {
  const dailyLines = m.dailyRevenue
    .map((d) => `${d.date}: ฿${fmt(d.revenue)}`)
    .join("\n");
  const growthRate =
    m.revenueLastMonth > 0
      ? (
          ((m.revenueThisMonth - m.revenueLastMonth) / m.revenueLastMonth) *
          100
        ).toFixed(1)
      : "N/A";

  return `คุณคือนักวิเคราะห์ข้อมูลอาวุโสที่เชี่ยวชาญด้าน Revenue Forecasting สำหรับธุรกิจ FMCG ในไทย

${metricsBlock(m)}

ข้อมูลรายได้รายวันทั้งหมด:
${dailyLines || "(ยังไม่มีข้อมูล)"}

Growth Rate MoM: ${growthRate}%

=== วิเคราะห์และพยากรณ์รายได้ (ตอบเป็นภาษาไทย) ===

## 1. 📈 การพยากรณ์รายได้สิ้นเดือน
- ประมาณการรายได้สิ้นเดือนตาม 3 สถานการณ์: Pessimistic / Base / Optimistic
- อธิบายสมมติฐานของแต่ละสถานการณ์

## 2. 🔍 Pattern ที่น่าสนใจในข้อมูลรายวัน
- วันไหนขายดี/ขายแย่ที่สุด และทำไม
- แนวโน้มช่วงต้นเดือน vs ปลายเดือน
- Weekday vs Weekend pattern (ถ้ามีข้อมูลพอ)

## 3. 🎯 เป้าหมายรายวันที่แนะนำ
- ถ้าต้องการให้สิ้นเดือนได้รายได้เพิ่ม 20% จากปัจจุบัน ต้องทำวันละเท่าไหร่
- กลยุทธ์การกระจายยอดขายตลอดเดือน

## 4. ⚡ Action Items เร่งด่วน
สิ่งที่ควรทำทันทีเพื่อให้ยอดขายส่วนที่เหลือของเดือนดีขึ้น

ตอบโดยอ้างอิงตัวเลขจริง ให้เป็น range ที่สมเหตุสมผล`;
}

function buildAlertsPrompt(m: BusinessMetrics): string {
  return `คุณคือผู้เชี่ยวชาญด้าน Business Intelligence และ Early Warning System สำหรับธุรกิจ FMCG Retail

${metricsBlock(m)}

=== วิเคราะห์ Alert และความเสี่ยง (ตอบเป็นภาษาไทย) ===

## 🔴 Critical Alerts (ต้องแก้ทันที)
ระบุปัญหาเร่งด่วนจากตัวเลขที่น่ากังวลสูงสุด

## 🟡 Warning Alerts (ต้องติดตาม)
สัญญาณเตือนที่ควรให้ความสนใจใน 7-14 วันข้างหน้า

## 🟢 Positive Signals (ทำต่อ)
สิ่งที่ดำเนินไปได้ดีและควรขยายผล

## 📊 Anomaly Detection
ตัวเลขผิดปกติที่พบในข้อมูล และการตีความ

## 🎯 Priority Action Plan (3 ข้อสำคัญที่สุด)
ลำดับความสำคัญของสิ่งที่ต้องทำทันที

วิเคราะห์เชิงลึก อ้างอิงตัวเลขจริง`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    metrics: BusinessMetrics;
    challenge?: string;
    mode: "insights" | "forecast" | "alerts";
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { metrics, challenge = "", mode } = body;

  if (mode === "insights" && !challenge.trim()) {
    return Response.json(
      { error: "กรุณาระบุปัญหา/ความท้าทายก่อนวิเคราะห์" },
      { status: 400 },
    );
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "Gemini API key not configured" },
      { status: 500 },
    );
  }

  let prompt: string;
  switch (mode) {
    case "forecast":
      prompt = buildForecastPrompt(metrics);
      break;
    case "alerts":
      prompt = buildAlertsPrompt(metrics);
      break;
    default:
      prompt = buildInsightsPrompt(metrics, challenge);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: "gemini-2.0-flash-exp" },
    { apiVersion: "v1beta" },
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await model.generateContentStream(prompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `\n\n⚠️ เกิดข้อผิดพลาด: ${err instanceof Error ? err.message : "Unknown error"}`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
