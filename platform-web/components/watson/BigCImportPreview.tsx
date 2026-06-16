"use client";

// Self-contained PREVIEW-ONLY panel for a shop's promotion file (currently the
// BigC .xlsb/.xlsx form). The target shop is chosen by the parent (page-level
// dropdown) and passed in as `shop`. Shows the mapped rows in the STANDARD
// promotion columns. Does NOT write to Firestore this round (preview only).

import {
  parsePromoForShop,
  type PromoPreview,
  type Shop,
} from "@/lib/watson/promo-import";
import { AlertTriangle, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const fmtDate = (d: Date | null): string => {
  if (!d) return "—";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtPrice = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : n.toLocaleString("th-TH");

const periodSourceLabel = (s: PromoPreview["periodSource"]): string => {
  switch (s) {
    case "sheet":
      return "จากไฟล์";
    case "filename":
      return "จากชื่อไฟล์";
    default:
      return "ไม่พบ";
  }
};

export interface BigCImportPreviewProps {
  /** Target shop (chosen by the page dropdown). Labels the code column. */
  shop?: string;
  /** Called by a parent close control (renders as a modal/panel). */
  onClose?: () => void;
}

export default function BigCImportPreview({
  shop = "BigC",
  onClose,
}: BigCImportPreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PromoPreview | null>(null);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Allow re-selecting the same file.
      e.target.value = "";
      if (!file) return;

      setFileName(file.name);
      setError("");
      setResult(null);
      setLoading(true);
      try {
        const res = await parsePromoForShop(shop as Shop, file);
        setResult(res);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "ไม่สามารถอ่านไฟล์ได้ — กรุณาตรวจสอบรูปแบบไฟล์",
        );
      } finally {
        setLoading(false);
      }
    },
    [shop],
  );

  const items = result?.items ?? [];
  const codeLabel = `${shop} Code`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">
              นำเข้าโปรโมชั่น (Preview)
              <span className="ml-2 text-sm font-medium text-emerald-700">
                · ร้าน: {shop}
              </span>
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label="ปิด"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Preview-only banner */}
        <div className="mx-5 mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          🔍 Preview เท่านั้น — ยังไม่บันทึกลงระบบ
        </div>

        {/* File input */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsb,.xlsx,.xls"
              className="hidden"
              onChange={handleSelect}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              เลือกไฟล์ {shop} (.xlsb / .xlsx)
            </button>
            {fileName && (
              <span className="text-sm text-gray-600 truncate max-w-xs">
                {fileName}
              </span>
            )}
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังอ่านไฟล์…
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <div className="text-xs text-gray-400">ช่วงโปรโมชั่น</div>
                  <div className="text-sm font-medium text-gray-900">
                    {fmtDate(result.period.start)} → {fmtDate(result.period.end)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    ที่มา: {periodSourceLabel(result.periodSource)}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <div className="text-xs text-gray-400">จำนวนรายการ</div>
                  <div className="text-sm font-medium text-gray-900">
                    {items.length} รายการ
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <div className="text-xs text-gray-400">สาขาที่ร่วมรายการ</div>
                  <div className="text-sm font-medium text-gray-900">
                    {result.branches.length ? result.branches.join(", ") : "—"}
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-amber-800 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    คำเตือน ({result.warnings.length})
                  </div>
                  <ul className="list-disc list-inside text-sm text-amber-700 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mapped rows — standard promotion columns (per-shop code) */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">
                        {codeLabel}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Barcode</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Item Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Start</th>
                      <th className="px-3 py-2 text-left font-medium">End</th>
                      <th className="px-3 py-2 text-right font-medium">
                        Std Price IncV
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Comm Price IncV
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Invoice 62% IncV
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        Invoice 62% ExV
                      </th>
                      <th className="px-3 py-2 text-left font-medium">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((it, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {it.itemCode || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {it.barcode || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-900 whitespace-normal max-w-xs">
                          {it.itemName || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {fmtDate(it.promoStart)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {fmtDate(it.promoEnd)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {fmtPrice(it.stdPrice)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                          {fmtPrice(it.commPrice)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {fmtPrice(it.invoice62IncV)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {fmtPrice(it.invoice62ExV)}
                        </td>
                        <td className="px-3 py-2 text-gray-600 whitespace-normal">
                          {it.remark || "—"}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={11}
                          className="px-3 py-6 text-center text-gray-400"
                        >
                          ไม่พบรายการสินค้าในไฟล์
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!result && !error && !loading && (
            <div className="text-center text-gray-400 py-10 text-sm">
              เลือกไฟล์ {shop} เพื่อดูตัวอย่างข้อมูลที่จะนำเข้า
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button
            disabled
            title="ยังไม่เปิดใช้งานในรอบนี้"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            บันทึกเข้าระบบ (เร็ว ๆ นี้)
          </button>
        </div>
      </div>
    </div>
  );
}
