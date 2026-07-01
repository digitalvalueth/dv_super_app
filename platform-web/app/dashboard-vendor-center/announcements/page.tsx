"use client";

import {
  ChevronRight,
  Megaphone,
  Pin,
  AlertCircle,
  Info,
  Clock,
} from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  date: string;
  type: "Pinned" | "Urgent" | "Important" | "Info";
};

const items: Announcement[] = [
  {
    id: "A3",
    title: "อัปเดตระบบ: เชื่อมต่อฐานข้อมูลสต็อกและยอดขายจริง (Live Data Connected)",
    body: "ระบบ Vendor Center ได้เสร็จสิ้นการอัปเกรดเชื่อมต่อข้อมูลโดยตรงกับระบบนับสต็อก (Stock Counter) และรายงานการขายจริงของพนักงานหน้าร้านผ่านฐานข้อมูล Firestore ช่วยให้การติดตามยอดคงคลัง (SOH), ยอดขาย MTD/YTD แยกรายสาขาของแบรนด์ NEST ME และ PRIMANEST เป็นไปอย่างแม่นยำและเรียลไทม์",
    date: "9 Jun 2026",
    type: "Urgent",
  },
  {
    id: "A4",
    title: "ซิงก์ข้อมูลโปรโมชั่นวัตสัน (Watson Promotion Synced)",
    body: "ระบบรายงานโปรโมชั่นในฝั่ง Vendor Center ได้รับการจัดรูปแบบและเชื่อมต่อฐานข้อมูลร่วม (Shared Database) กับโมดูลโปรโมชั่นฝั่งผู้ดูแลระบบ Stock Counter เพื่อป้องกันความคลาดเคลื่อนในการนำเข้าข้อมูลโปรโมชั่นเรียบร้อยแล้ว",
    date: "9 Jun 2026",
    type: "Info",
  },
  {
    id: "A1",
    title: "การใช้งานข้อมูล Vendor Centor เฟส1",
    body: "ข้อมูลชุดนี้คัดเลือกใช้สำหรับการวิเคราะห์และประเมินแนวโน้มการขายเบื้องต้นเท่านั้น ข้อมูลอาจมีความคลาดเคลื่อนจากช่วงเวลาการประมวลผลครั้งบรรพกาที่ช่วงทาง และไม่ใช่ข้อมูลแบบ Real-Time ดังนั้น จึงไม่สามารถนำไปใช้อ้างอิงทางบัญชี การตรวจสอบบัญชีทางเหนือ (Audit) ณ จุดต่างๆ ๆ หรือใช้เป็นจำนวนเพื่อยืนยอดอย่างจริงจังในทางบัญชีได้ หากต้องการข้อมูลยืนยันจำนวนสินค้าหรือยอดขายอย่างเป็นทางการๆ กรุณาตรวจสอบอย่างเป็นทางการได้ที่",
    date: "16 Mar 2026",
    type: "Pinned",
  },
  {
    id: "A2",
    title: "คำอธิบายการอ่านข้อมูล (Dashboard Guide)",
    body: "เอกสารแนะนำคำจำกัดความวงจรง่าย เพื่อให้ทำความเข้าใจการใช้งานเอกสารข้อมูลผ่านระบบ Vendor Center ได้อย่างถูกต้อง บริษัทฯ ขอ...",
    date: "16 Mar 2026",
    type: "Important",
  },
];

const typeConfig = {
  Pinned: { icon: Pin, badge: "bg-pink-100 text-pink-700 border-pink-300", border: "border-l-pink-500" },
  Urgent: { icon: AlertCircle, badge: "bg-red-100 text-red-700 border-red-300", border: "border-l-red-500" },
  Important: { icon: AlertCircle, badge: "bg-amber-100 text-amber-700 border-amber-300", border: "border-l-amber-500" },
  Info: { icon: Info, badge: "bg-blue-100 text-blue-700 border-blue-300", border: "border-l-blue-500" },
} as const;

export default function Announcements() {
  return (
    <div className="p-6 md:p-8 w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5" />
            </div>
            Announcements
          </h1>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 ml-12">
            <span>Home</span>
            <ChevronRight className="w-3 h-3" />
            <span>Vendor</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-700">Announcements</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">{items.length} announcements</p>
      </div>

      {/* Announcement Cards */}
      <div className="space-y-4">
        {items.map((a) => {
          const cfg = typeConfig[a.type];
          const Icon = cfg.icon;
          return (
            <div
              key={a.id}
              className={`bg-white rounded-xl shadow-sm border border-l-4 ${cfg.border} p-5`}
            >
              <div className="flex items-center gap-2 mb-2">
                {a.type === "Pinned" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 bg-pink-100 px-2 py-0.5 rounded">
                    <Pin className="w-3 h-3" /> Pinned
                  </span>
                )}
                {a.type === "Urgent" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                    <AlertCircle className="w-3 h-3" /> Urgent
                  </span>
                )}
                {a.type === "Important" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    <Icon className="w-3 h-3" /> Important
                  </span>
                )}
                {a.type === "Info" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    <Icon className="w-3 h-3" /> Info
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{a.title}</h3>
              <div className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                <Clock className="w-3 h-3" />
                {a.date}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{a.body}</p>
            </div>
          );
        })}
      </div>

      <div className="text-center py-4">
        <button className="text-sm text-pink-600 hover:underline font-semibold">
          ↓ More announcements
        </button>
      </div>
    </div>
  );
}
