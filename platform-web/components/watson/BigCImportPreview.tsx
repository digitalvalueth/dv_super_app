"use client";

// Self-contained PREVIEW-ONLY panel for BigC promotion .xlsb/.xlsx files.
// Parses the file client-side and shows the mapped rows + warnings. It does
// NOT write anything to Firestore this round (preview only).

import {
  parseBigCFile,
  type BigCParseResult,
} from "@/lib/watson/bigc-promo-parser";
import { AlertTriangle, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const fmtDate = (d: Date | null): string => {
  if (!d) return "—";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtPrice = (n: number | null): string =>
  n === null ? "—" : n.toLocaleString("th-TH");

const periodSourceLabel = (s: BigCParseResult["periodSource"]): string => {
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
  /** Called by a parent close control (renders as a modal/panel). */
  onClose?: () => void;
}

export default function BigCImportPreview({ onClose }: BigCImportPreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<BigCParseResult | null>(null);

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
        const res = await parseBigCFile(file);
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
    [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-gray-900">
              นำเข้า BigC (Preview)
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
          <input
            ref={fileRef}
            type="file"
            accept=".xlsb,.xlsx"
            className="hidden"
            onChange={handleSelect}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <FileSpreadsheet className="w-4 h-4" />
              เลือกไฟล์ BigC (.xlsb / .xlsx)
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
                    {result.items.length} รายการ
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 px-3 py-2">
                  <div className="text-xs text-gray-400">สาขาที่ร่วมรายการ</div>
                  <div className="text-sm font-medium text-gray-900">
                    {result.branches.length
                      ? result.branches.join(", ")
                      : "—"}
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

              {/* Mapped rows table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">No</th>
                      <th className="px-3 py-2 text-left font-medium">Barcode</th>
                      <th className="px-3 py-2 text-left font-medium">
                        ชื่อสินค้า
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        ราคาปกติ
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        ราคาโปร
                      </th>
                      <th className="px-3 py-2 text-left font-medium">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.items.map((it, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{it.no || "—"}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">
                          {it.barcode || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-900">
                          {it.itemName || "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {fmtPrice(it.stdPrice)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700 font-medium">
                          {fmtPrice(it.commPrice)}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {it.remark || "—"}
                        </td>
                      </tr>
                    ))}
                    {result.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
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
              เลือกไฟล์ BigC เพื่อดูตัวอย่างข้อมูลที่จะนำเข้า
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
