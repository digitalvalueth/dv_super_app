"use client";

// Self-contained PREVIEW-ONLY panel for a shop's promotion file (currently the
// BigC .xlsb/.xlsx form). The target shop is chosen by the parent (page-level
// dropdown) and passed in as `shop`. Shows the mapped rows in the STANDARD
// promotion columns. Does NOT write to Firestore this round (preview only).

import { getPromotionData } from "@/lib/watson-firebase";
import {
  parsePromoForShop,
  type PromoPreview,
  type Shop,
} from "@/lib/watson/promo-import";
import { promoKey } from "@/lib/watson/promo-merge";
import { saveImportedPromotions } from "@/lib/watson/promo-save";
import {
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
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
  /** Called after a successful save so the parent can refresh its list. */
  onSaved?: () => void;
}

export default function BigCImportPreview({
  shop = "BigC",
  onClose,
  onSaved,
}: BigCImportPreviewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PromoPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** promoKey set of items already in the store — to flag new vs duplicate. */
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  /** Distinct remarks already used in the store — seeds the remark suggestions. */
  const [existingRemarks, setExistingRemarks] = useState<string[]>([]);
  /** Per-row remark overrides (rowIndex → remark). */
  const [editedRemarks, setEditedRemarks] = useState<Record<number, string>>({});

  /** Saving is wired for Watson (writes the shared promotion store). */
  const canSave = !!result && result.items.length > 0 && shop === "Watson";

  const doSave = useCallback(async () => {
    if (!result) return;
    setConfirmOpen(false);
    setSaving(true);
    setSaveMsg("");
    setError("");
    try {
      // Apply the user's per-row remark edits before saving.
      const itemsToSave = result.items.map((it, i) => ({
        ...it,
        remark: (editedRemarks[i] ?? it.remark ?? "").trim(),
      }));
      const r = await saveImportedPromotions(shop as Shop, itemsToSave);
      setSaveMsg(
        `บันทึกสำเร็จ — เพิ่มใหม่ ${r.added} รายการ, อัปเดต ${r.updated} รายการ (รวมในระบบ ${r.total})`,
      );
      onSaved?.(); // refresh the parent list immediately
      // Show the success, then close the modal automatically.
      setTimeout(() => onClose?.(), 1800);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "บันทึกไม่สำเร็จ — กรุณาลองใหม่",
      );
    } finally {
      setSaving(false);
    }
  }, [result, shop, onSaved, onClose, editedRemarks]);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Allow re-selecting the same file.
      e.target.value = "";
      if (!file) return;

      setFileName(file.name);
      setError("");
      setResult(null);
      setSaveMsg("");
      setEditedRemarks({});
      setExistingKeys(new Set());
      setExistingRemarks([]);
      setLoading(true);
      try {
        const res = await parsePromoForShop(shop as Shop, file);
        setResult(res);
        // Flag new vs duplicate against what's already stored (Watson), and
        // collect the remarks already in use to seed the suggestions.
        if (shop === "Watson") {
          try {
            const existing = await getPromotionData();
            setExistingKeys(new Set(existing.map((it) => promoKey(it))));
            setExistingRemarks(
              existing.map((it) => (it.remark ?? "").trim()).filter(Boolean),
            );
          } catch {
            // classification is best-effort; ignore load errors
          }
        }
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

  // Effective remark for a row (edit override → original).
  const remarkOf = (i: number) =>
    editedRemarks[i] ?? items[i]?.remark ?? "";
  const isDup = (i: number) =>
    existingKeys.has(promoKey({ ...items[i], remark: remarkOf(i) }));
  const dupCount = items.filter((_, i) => isDup(i)).length;
  const newCount = items.length - dupCount;
  const emptyRemarkCount = items.filter((_, i) => !remarkOf(i).trim()).length;

  // Remark suggestions: distinct, derived from the remarks already in the store
  // plus the remarks in the imported file (and any the user typed) — no
  // hardcoded list, so it scales with however many mechanics exist.
  const remarkOptions = Array.from(
    new Set(
      [
        ...existingRemarks,
        ...items.map((it) => it.remark ?? ""),
        ...Object.values(editedRemarks),
      ]
        .map((r) => r.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const setRemark = (i: number, v: string) =>
    setEditedRemarks((prev) => ({ ...prev, [i]: v }));
  const fillEmptyRemarks = (v: string) =>
    setEditedRemarks((prev) => {
      const next = { ...prev };
      items.forEach((_, i) => {
        if (!remarkOf(i).trim()) next[i] = v;
      });
      return next;
    });

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

        {/* Banner */}
        <div className="mx-5 mt-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          {shop === "Watson"
            ? "🔍 ตรวจสอบรายการก่อน แล้วกด “บันทึกเข้าระบบ” — barcode + ช่วงเวลาตรงกับของเดิมจะอัปเดต, ช่วงเวลาใหม่จะเพิ่มเข้าไป"
            : "🔍 Preview เท่านั้น — ยังไม่รองรับการบันทึกของร้านนี้"}
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
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mb-3">
              {error}
            </div>
          )}
          {saveMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-800 mb-3 flex items-center gap-1.5 font-medium">
              <CheckCircle className="w-4 h-4" />
              {saveMsg} · กำลังปิดหน้าต่าง…
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

              {/* New vs duplicate + empty-remark status */}
              {shop === "Watson" && items.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4 text-sm">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ใหม่ {newCount}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    ซ้ำ (จะอัปเดต) {dupCount}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${
                      emptyRemarkCount > 0
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}
                  >
                    Remark ว่าง {emptyRemarkCount}
                  </span>
                  {emptyRemarkCount > 0 && (
                    <button
                      onClick={() => fillEmptyRemarks("Buy 1")}
                      className="px-2 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50"
                    >
                      ตั้ง Remark ว่าง → “Buy 1”
                    </button>
                  )}
                </div>
              )}

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
                      {shop === "Watson" && (
                        <th className="px-3 py-2 text-left font-medium">
                          สถานะ
                        </th>
                      )}
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
                        {shop === "Watson" && (
                          <td className="px-3 py-2">
                            {isDup(i) ? (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                                ซ้ำ
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ใหม่
                              </span>
                            )}
                          </td>
                        )}
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
                        <td className="px-3 py-2">
                          <input
                            list="promo-remark-options"
                            value={remarkOf(i)}
                            onChange={(e) => setRemark(i, e.target.value)}
                            placeholder="— เลือก/พิมพ์ —"
                            className={`w-44 px-2 py-1 text-sm rounded border ${
                              remarkOf(i).trim()
                                ? "border-gray-200"
                                : "border-amber-300 bg-amber-50"
                            }`}
                          />
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={shop === "Watson" ? 12 : 11}
                          className="px-3 py-6 text-center text-gray-400"
                        >
                          ไม่พบรายการสินค้าในไฟล์
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <datalist id="promo-remark-options">
                  {remarkOptions.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
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
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-100">
          <div className="text-sm">
            {saveMsg && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                {saveMsg}
              </span>
            )}
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSave || saving}
            title={
              shop === "Watson"
                ? "บันทึก/อัปเดตเข้าระบบ"
                : `ยังไม่รองรับการบันทึกของร้าน ${shop}`
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังบันทึก…
              </>
            ) : shop === "Watson" ? (
              "บันทึกเข้าระบบ"
            ) : (
              "บันทึกเข้าระบบ (เร็ว ๆ นี้)"
            )}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-gray-900">
                ยืนยันบันทึกเข้าระบบ
              </h3>
            </div>
            <p className="text-sm text-gray-600">
              บันทึกโปรโมชั่น <b>{result?.items.length ?? 0}</b> รายการของร้าน{" "}
              <b>{shop}</b> เข้าระบบ?
            </p>
            <ul className="mt-2 text-sm text-gray-500 list-disc list-inside space-y-0.5">
              <li>
                barcode + ช่วงเวลา <b>ตรงกับของเดิม</b> → อัปเดตทับ
              </li>
              <li>
                ช่วงเวลา <b>ใหม่</b> → เพิ่มรายการใหม่ (ของเดิมไม่ถูกลบ)
              </li>
            </ul>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={doSave}
                className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                ยืนยันบันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
