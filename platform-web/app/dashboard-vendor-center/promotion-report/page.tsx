"use client";

import BigCImportPreview from "@/components/watson/BigCImportPreview";
import { usePromotionUploadHistory } from "@/hooks/watson/usePromotionUploadHistory";
import { parseWatsonDate } from "@/lib/parse-watson-date";
import { getPromotionData, savePromotionData } from "@/lib/watson-firebase";
import { PromotionItem } from "@/types/watson/promotion";
import { useBrand } from "../brand-context";
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ─── Row state (with local _id for React key) ─────────────────────────
type Row = PromotionItem & { _id: string };

let _rowId = 0;
const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + "_" + String(++_rowId);

const emptyRow = (): Row => ({
  _id: nextId(),
  itemCode: "",
  barcode: "",
  itemName: "",
  promoStart: null,
  promoEnd: null,
  stdPrice: 0,
  commPrice: null,
  invoice62IncV: null,
  invoice62ExV: null,
  promoPrice: null,
  remark: "",
});

const fmtDate = (d: Date | null | undefined) => {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d as any);
  if (isNaN(dt.getTime())) return "";
  // Use local date (not UTC) so midnight local time doesn't roll back a day
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// For <input type="date"> which always yields YYYY-MM-DD
const parseDate = (s: string): Date | null => parseWatsonDate(s);

const numOrNull = (v: any): number | null => {
  const n = parseFloat(String(v ?? ""));
  return isNaN(n) ? null : n;
};

// ─── Comparison helpers (for import dedup) ─────────────────────────────
// Normalize numbers: round to 4dp to absorb float jitter; treat null/0/undefined
// as the same bucket when both sides are effectively "empty"
const cmpNum = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "";
    const n = Number(v);
    return isNaN(n) ? "" : String(Math.round(n * 10000) / 10000);
  };
  return norm(a) === norm(b);
};
// Normalize strings: trim whitespace, treat undefined/null as ""
const cmpStr = (a: unknown, b: unknown): boolean =>
  String(a ?? "").trim() === String(b ?? "").trim();

// ─── Remark type helper ─────────────────────────────────────────────
// "Buy 1" is NOT a promotion — it's a standard price label.
// Any other remark is treated as a real promotion.
const NON_PROMO_REMARKS = ["buy 1", "buy1"];
const isNonPromo = (remark: string | null | undefined): boolean =>
  NON_PROMO_REMARKS.includes(
    String(remark ?? "")
      .trim()
      .toLowerCase(),
  );

// ─── Column definitions ───────────────────────────────────────────────
const COLS: {
  key: keyof Row;
  label: string;
  w: string;
  type: "text" | "number" | "date";
  placeholder?: string;
}[] = [
  {
    key: "itemCode",
    label: "Watson Code",
    w: "min-w-[100px]",
    type: "text",
    placeholder: "294605",
  },
  {
    key: "barcode",
    label: "Barcode",
    w: "min-w-[150px]",
    type: "text",
    placeholder: "885910863120",
  },
  {
    key: "itemName",
    label: "Item Name",
    w: "min-w-[240px]",
    type: "text",
    placeholder: "Primanest Vita...",
  },
  { key: "promoStart", label: "Start", w: "min-w-[120px]", type: "date" },
  { key: "promoEnd", label: "End", w: "min-w-[120px]", type: "date" },
  {
    key: "stdPrice",
    label: "Std Price IncV",
    w: "min-w-[110px]",
    type: "number",
    placeholder: "690",
  },
  {
    key: "commPrice",
    label: "Comm Price IncV",
    w: "min-w-[120px]",
    type: "number",
    placeholder: "598",
  },
  {
    key: "invoice62IncV",
    label: "Invoice 62% IncV",
    w: "min-w-[120px]",
    type: "number",
    placeholder: "370.76",
  },
  {
    key: "invoice62ExV",
    label: "Invoice 62% ExV",
    w: "min-w-[120px]",
    type: "number",
    placeholder: "346.50",
  },
  {
    key: "remark",
    label: "Remark",
    w: "min-w-[90px]",
    type: "text",
    placeholder: "SAVE",
  },
];

const toFirestore = (r: Row): PromotionItem => ({
  itemCode: r.itemCode,
  barcode: r.barcode || undefined,
  itemName: r.itemName,
  stdPrice: Number(r.stdPrice) || 0,
  commPrice: numOrNull(r.commPrice),
  invoice62IncV: numOrNull(r.invoice62IncV),
  invoice62ExV: numOrNull(r.invoice62ExV),
  promoPrice: numOrNull(r.commPrice), // backward compat: promoPrice = commPrice
  promoStart: r.promoStart,
  promoEnd: r.promoEnd,
  remark: r.remark || undefined,
});

// ─── Excel column header → Row key mapping ────────────────────────────
const EXCEL_MAP: Record<string, keyof Row> = {
  "watson code": "itemCode",
  watson: "itemCode",
  code: "itemCode",
  barcode: "barcode",
  "item name": "itemName",
  name: "itemName",
  start: "promoStart",
  end: "promoEnd",
  "standard price incv": "stdPrice",
  "std price incv": "stdPrice",
  "std price": "stdPrice",
  "comm price incv": "commPrice",
  "comm price": "commPrice",
  "invoice62% incv": "invoice62IncV",
  "invoice 62% incv": "invoice62IncV",
  "invoice62%incv": "invoice62IncV",
  "invoice 62%incv": "invoice62IncV",
  "invoice62% inc v": "invoice62IncV",
  "invoice 62% inc v": "invoice62IncV",
  invoice62incv: "invoice62IncV",
  "invoice 62 incv": "invoice62IncV",
  "invoice 62 % incv": "invoice62IncV",
  "invoce62% incv": "invoice62IncV",
  "invoce 62% incv": "invoice62IncV",
  "invoice62% exv": "invoice62ExV",
  "invoice 62% exv": "invoice62ExV",
  "invoice62%exv": "invoice62ExV",
  "invoice 62%exv": "invoice62ExV",
  "invoice62% ex v": "invoice62ExV",
  "invoice 62% ex v": "invoice62ExV",
  invoice62exv: "invoice62ExV",
  "invoice 62 exv": "invoice62ExV",
  "invoice 62 % exv": "invoice62ExV",
  "incoice 62% exv": "invoice62ExV",
  "incoice62% exv": "invoice62ExV",
  remark: "remark",
};

const REQUIRED_KEYS: (keyof Row)[] = [
  "itemCode",
  "barcode",
  "itemName",
  "promoStart",
  "promoEnd",
  "stdPrice",
  "commPrice",
  "invoice62IncV",
  "invoice62ExV",
];

const isRowIncomplete = (r: Row) =>
  REQUIRED_KEYS.some((k) => {
    const v = r[k];
    return v === null || v === undefined || v === "" || v === 0;
  });

// Vendor-only: scope the master table to the brand chosen in the topbar
// switcher. (The stock-counter copy of this page has no brand switcher and
// shows every brand.)
const matchBrand = (name: string, brand: "NEST ME" | "PRIMANEST") => {
  const norm = (name || "").toLowerCase().replace(/\s+/g, "");
  return brand === "NEST ME"
    ? norm.includes("nestme")
    : norm.includes("primanest") || norm.includes("prima");
};

export default function PromotionReportPage() {
  const { activeBrand } = useBrand();
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importProgress, setImportProgress] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [importProgressResult, setImportProgressResult] = useState<{
    added: number;
    updated: number;
    duplicate: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    file: File;
    mergedRows: Row[];
    added: number;
    updated: number;
    duplicate: number;
    existingCount: number;
    updatedDetails: Array<{
      itemCode: string;
      itemName: string;
      fields: Array<{ label: string; from: string; to: string }>;
    }>;
    conflictWarnings: Array<{
      key: string;
      itemCode: string;
      itemName: string;
      discarded: Row;
      kept: Row;
    }>;
    overlapWarnings: Array<{
      itemCode: string;
      itemName: string;
      rowA: Row;
      rowB: Row;
    }>;
  } | null>(null);
  const [conflictChoices, setConflictChoices] = useState<
    Record<number, "discarded" | "kept">
  >({});
  const [showHistory, setShowHistory] = useState(false);
  const [showBigCPreview, setShowBigCPreview] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [previewShop, setPreviewShop] = useState("BigC");
  const [showImportDetails, setShowImportDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [validateIds, setValidateIds] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const {
    history: uploadHistory,
    isLoading: historyLoading,
    addRecord: addUploadRecord,
    downloadFile,
  } = usePromotionUploadHistory();

  // ── Load from Firestore ────────────────────────────────────────────
  const reloadRows = useCallback(() => {
    setLoading(true);
    getPromotionData()
      .then((items) => {
        if (items.length > 0) {
          setRows(
            items.map((it) => ({
              ...it,
              _id: nextId(),
              barcode: it.barcode ?? "",
              commPrice: it.commPrice ?? null,
              invoice62IncV: it.invoice62IncV ?? null,
              invoice62ExV: it.invoice62ExV ?? null,
              remark: it.remark ?? "",
              promoStart:
                it.promoStart instanceof Date
                  ? it.promoStart
                  : it.promoStart
                    ? new Date(it.promoStart as any)
                    : null,
              promoEnd:
                it.promoEnd instanceof Date
                  ? it.promoEnd
                  : it.promoEnd
                    ? new Date(it.promoEnd as any)
                    : null,
            })),
          );
        }
      })
      .catch((e: any) => {
        const isOffline =
          e?.code === "unavailable" || e?.message?.includes("offline");
        setError(
          isOffline
            ? "ออฟไลน์ — กำลังใช้ข้อมูลจาก cache (บันทึกใหม่ไม่ได้จนกว่าจะออนไลน์)"
            : "โหลดข้อมูลไม่สำเร็จ",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reloadRows();
  }, [reloadRows]);

  // ── Cell update ────────────────────────────────────────────────────
  const updateCell = useCallback((id: string, key: keyof Row, raw: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const col = COLS.find((c) => c.key === key)!;
        if (col.type === "date") return { ...r, [key]: parseDate(raw) };
        if (col.type === "number")
          return { ...r, [key]: raw === "" ? null : parseFloat(raw) || 0 };
        const text = key === "barcode" ? raw.replace(/\s/g, "") : raw;
        return { ...r, [key]: text };
      }),
    );
    setSaved(false);
  }, []);

  const addRow = () => {
    if (!editMode) return;
    const firstRow = rows[0];
    if (firstRow && isRowIncomplete(firstRow)) {
      setValidateIds((prev) => new Set(prev).add(firstRow._id));
      setSearch("");
      setStatusFilter("all");
      setDateFrom("");
      setDateTo("");
      return;
    }
    setRows((p) => [emptyRow(), ...p]);
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const requestDelete = (ids: string[], label: string) =>
    setDeleteConfirm({ ids, label });

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const toDelete = new Set(deleteConfirm.ids);
    setRows((p) =>
      p.length === toDelete.size
        ? [emptyRow()]
        : p.filter((r) => !toDelete.has(r._id)),
    );
    setSelectedIds(new Set());
    setDeleteConfirm(null);
    setSaved(false);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRows.length && filteredRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r._id)));
    }
  };

  // ── Save to Firestore ──────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = rows
        .filter((r) => r.itemCode || r.barcode || r.itemName)
        .map(toFirestore);
      await savePromotionData(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // ── Import Excel / CSV ─────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, {
          type: "array",
          cellDates: true,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
        });
        if (raw.length < 2) {
          setError("ไฟล์ว่างหรือไม่มี header");
          return;
        }

        const headers = (raw[0] as any[]).map((h) =>
          String(h ?? "")
            .toLowerCase()
            .trim()
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
        );

        const normalize = (s: string) =>
          s.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const normalizedMap: Record<string, keyof Row> = {};
        for (const [k, v] of Object.entries(EXCEL_MAP)) {
          normalizedMap[normalize(k)] = v;
        }

        const mappedKeys = new Set(
          headers
            .map((h) => EXCEL_MAP[h] ?? normalizedMap[normalize(h)])
            .filter(Boolean),
        );

        const REQUIRED: { key: keyof Row; label: string }[] = [
          { key: "itemCode", label: "Watson Code" },
          { key: "barcode", label: "Barcode" },
          { key: "itemName", label: "Item Name" },
          { key: "promoStart", label: "Start" },
          { key: "promoEnd", label: "End" },
          { key: "stdPrice", label: "Standard Price IncV" },
          { key: "commPrice", label: "Comm Price IncV" },
          { key: "invoice62IncV", label: "Invoice 62% IncV" },
          { key: "invoice62ExV", label: "Invoice 62% ExV" },
        ];

        const missing = REQUIRED.filter((r) => !mappedKeys.has(r.key)).map(
          (r) => r.label,
        );
        if (missing.length > 0) {
          setImportError(
            `ไฟล์ Excel มีรูปแบบคอลัมน์ไม่ถูกต้อง กรุณาตรวจสอบชื่อหัวคอลัมน์\n\nคอลัมน์ที่ไม่พบ:\n${missing.map((m) => `• ${m}`).join("\n")}`,
          );
          return;
        }

        const imported: Row[] = raw.slice(1).map((rowArr) => {
          const r = emptyRow();
          headers.forEach((h, i) => {
            const key = EXCEL_MAP[h] ?? normalizedMap[normalize(h)];
            if (!key) return;
            const val = String(rowArr[i] ?? "").trim();
            const col = COLS.find((c) => c.key === key);
            if (!col) return;
            if (col.type === "date") {
              (r as any)[key] = parseWatsonDate(val);
            } else if (col.type === "number") {
              (r as any)[key] =
                val === "" ? null : parseFloat(val.replace(/,/g, "")) || 0;
            } else {
              (r as any)[key] =
                key === "barcode" ? val.replace(/\s/g, "") : val;
            }
          });
          return r;
        });

        const filtered = imported.filter(
          (r) => r.itemCode || r.barcode || r.itemName,
        );

        const existingRows = rowsRef.current.filter(
          (r) => r.itemCode || r.barcode || r.itemName,
        );

        const rowKey = (r: Row) => {
          const code = (r.itemCode || r.barcode || "").trim();
          const start = fmtDate(r.promoStart);
          const end = fmtDate(r.promoEnd);
          const remark = String(r.remark ?? "")
            .trim()
            .toLowerCase();
          return `${code}||${start}||${end}||${remark}`;
        };

        const lastIdxByKey = new Map<string, number>();
        filtered.forEach((r, i) => lastIdxByKey.set(rowKey(r), i));
        const uniqueFiltered = filtered.filter(
          (r, i) => lastIdxByKey.get(rowKey(r)) === i,
        );

        const conflictWarnings: Array<{
          key: string;
          itemCode: string;
          itemName: string;
          discarded: Row;
          kept: Row;
        }> = [];
        const keptByKey = new Map<string, Row>();
        uniqueFiltered.forEach((r) => keptByKey.set(rowKey(r), r));
        filtered.forEach((r, i) => {
          if (lastIdxByKey.get(rowKey(r)) !== i) {
            const kept = keptByKey.get(rowKey(r));
            if (
              kept &&
              (!cmpNum(r.stdPrice, kept.stdPrice) ||
                !cmpNum(r.commPrice, kept.commPrice) ||
                !cmpNum(r.invoice62IncV, kept.invoice62IncV) ||
                !cmpNum(r.invoice62ExV, kept.invoice62ExV))
            ) {
              conflictWarnings.push({
                key: rowKey(r),
                itemCode: r.itemCode || r.barcode || "",
                itemName: r.itemName,
                discarded: r,
                kept,
              });
            }
          }
        });

        const overlapWarnings: Array<{
          itemCode: string;
          itemName: string;
          rowA: Row;
          rowB: Row;
        }> = [];
        const byWatsonCode = new Map<string, Row[]>();
        filtered.forEach((r) => {
          const code = (r.itemCode || r.barcode || "").trim();
          if (!code) return;
          if (!byWatsonCode.has(code)) byWatsonCode.set(code, []);
          byWatsonCode.get(code)!.push(r);
        });
        byWatsonCode.forEach((codeRows) => {
          for (let a = 0; a < codeRows.length; a++) {
            for (let b = a + 1; b < codeRows.length; b++) {
              const rowA = codeRows[a];
              const rowB = codeRows[b];
              if (rowKey(rowA) === rowKey(rowB)) continue;
              if (isNonPromo(rowA.remark) || isNonPromo(rowB.remark)) continue;
              if (
                rowA.promoStart &&
                rowA.promoEnd &&
                rowB.promoStart &&
                rowB.promoEnd &&
                rowA.promoStart <= rowB.promoEnd &&
                rowB.promoStart <= rowA.promoEnd
              ) {
                overlapWarnings.push({
                  itemCode: (rowA.itemCode || rowA.barcode || "").trim(),
                  itemName: rowA.itemName,
                  rowA,
                  rowB,
                });
              }
            }
          }
        });

        const existingByKey = new Map<string, number>();
        existingRows.forEach((r, i) => existingByKey.set(rowKey(r), i));

        const result = [...existingRows];
        let added = 0;
        let updated = 0;
        let duplicate = 0;
        const updatedDetails: Array<{
          itemCode: string;
          itemName: string;
          fields: Array<{ label: string; from: string; to: string }>;
        }> = [];

        for (const incoming of uniqueFiltered) {
          const key = rowKey(incoming);

          if (existingByKey.has(key)) {
            const existingIdx = existingByKey.get(key)!;
            const existing = existingRows[existingIdx];

            const diffFields: Array<{
              label: string;
              from: string;
              to: string;
            }> = [];
            const checkDate = (
              label: string,
              a: Date | null | undefined,
              b: Date | null | undefined,
            ) => {
              const fa = fmtDate(a),
                fb = fmtDate(b);
              if (fa !== fb)
                diffFields.push({ label, from: fa || "—", to: fb || "—" });
            };
            const checkNum = (label: string, a: unknown, b: unknown) => {
              if (!cmpNum(a, b)) {
                const fmt = (v: unknown) =>
                  v === null || v === undefined || v === "" ? "—" : String(v);
                diffFields.push({ label, from: fmt(a), to: fmt(b) });
              }
            };
            const checkStr = (label: string, a: unknown, b: unknown) => {
              if (!cmpStr(a, b))
                diffFields.push({
                  label,
                  from: String(a ?? "") || "—",
                  to: String(b ?? "") || "—",
                });
            };

            checkDate("Start", existing.promoStart, incoming.promoStart);
            checkDate("End", existing.promoEnd, incoming.promoEnd);
            checkNum("Std Price", existing.stdPrice, incoming.stdPrice);
            checkNum("Comm Price", existing.commPrice, incoming.commPrice);
            checkNum(
              "Invoice 62% IncV",
              existing.invoice62IncV,
              incoming.invoice62IncV,
            );
            checkNum(
              "Invoice 62% ExV",
              existing.invoice62ExV,
              incoming.invoice62ExV,
            );
            checkStr("Item Name", existing.itemName, incoming.itemName);
            checkStr("Remark", existing.remark, incoming.remark);

            if (diffFields.length > 0) {
              result[existingIdx] = {
                ...existing,
                ...incoming,
                _id: existing._id,
              };
              updatedDetails.push({
                itemCode: incoming.itemCode || existing.itemCode,
                itemName: incoming.itemName || existing.itemName,
                fields: diffFields,
              });
              updated++;
            } else {
              duplicate++;
            }
          } else {
            result.push({ ...incoming, _id: nextId() });
            added++;
          }
        }

        setPendingImport({
          file,
          mergedRows: result,
          added,
          updated,
          duplicate,
          existingCount: existingRows.length,
          updatedDetails,
          conflictWarnings,
          overlapWarnings,
        });
        setError(null);
      } catch {
        setError("ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบ format");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    const { added, updated, duplicate } = pendingImport;

    const mergedRows = [...pendingImport.mergedRows];
    pendingImport.conflictWarnings.forEach((w, i) => {
      if (conflictChoices[i] === "discarded") {
        const idx = mergedRows.findIndex((r) => {
          const code = (r.itemCode || r.barcode || "").trim();
          const start = fmtDate(r.promoStart);
          const end = fmtDate(r.promoEnd);
          const remark = String(r.remark ?? "")
            .trim()
            .toLowerCase();
          return `${code}||${start}||${end}||${remark}` === w.key;
        });
        if (idx !== -1) mergedRows[idx] = w.discarded;
      }
    });

    setRows(mergedRows);
    setConflictChoices({});
    setShowImportDetails(false);

    setImportProgress("saving");
    setError(null);
    try {
      const items = mergedRows
        .filter((r) => r.itemCode || r.barcode || r.itemName)
        .map(toFirestore);
      await savePromotionData(items);
      setImportProgressResult({ added, updated, duplicate });
      setImportProgress("success");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      setTimeout(() => {
        setPendingImport(null);
        setImportProgress("idle");
        setImportProgressResult(null);
      }, 2500);
    } catch (e: any) {
      setImportProgress("error");
      setError(e.message || "บันทึกไม่สำเร็จ");
    }
  };

  // Save history record + upload original file in background
  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const { added, updated, duplicate } = pendingImport;
    addUploadRecord(pendingImport.file, {
      itemCount: pendingImport.mergedRows.length,
      added,
      updated,
      duplicate,
    });
  };

  // ── Export Excel ───────────────────────────────────────────────────
  const handleExport = () => {
    const data = [
      [
        "Watson Code",
        "Barcode",
        "Item Name",
        "Start",
        "End",
        "Std Price IncV",
        "Comm Price IncV",
        "Invoice 62% IncV",
        "Invoice 62% ExV",
        "Remark",
      ],
      ...rows
        .filter((r) => r.itemCode || r.barcode || r.itemName)
        .map((r) => [
          r.itemCode,
          r.barcode,
          r.itemName,
          fmtDate(r.promoStart),
          fmtDate(r.promoEnd),
          r.stdPrice,
          r.commPrice,
          r.invoice62IncV,
          r.invoice62ExV,
          r.remark,
        ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [14, 18, 40, 12, 12, 14, 14, 14, 14, 10].map((w) => ({
      wch: w,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Promotion");
    XLSX.writeFile(
      wb,
      `promotion_master_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // ── Stats & filter ─────────────────────────────────────────────────
  const today = new Date();
  // Vendor view is scoped to the brand picked in the topbar (rows with no name
  // are kept so nothing is silently hidden).
  const inBrand = (r: Row) => !r.itemName || matchBrand(r.itemName, activeBrand);
  const validRows = rows.filter(
    (r) => (r.itemCode || r.barcode || r.itemName) && inBrand(r),
  );
  const activeCount = validRows.filter(
    (r) =>
      r.promoStart &&
      r.promoEnd &&
      r.promoStart <= today &&
      r.promoEnd >= today,
  ).length;

  const dateFromObj = dateFrom ? new Date(dateFrom) : null;
  const dateToObj = dateTo ? new Date(dateTo + "T23:59:59") : null;

  const filteredRows = rows.filter((r) => {
    // Scope to the brand selected in the topbar switcher.
    if (!inBrand(r)) return false;
    const isActive =
      r.promoStart &&
      r.promoEnd &&
      r.promoStart <= today &&
      r.promoEnd >= today;
    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "inactive" && isActive) return false;

    if (dateFromObj || dateToObj) {
      const start = r.promoStart;
      const end = r.promoEnd;
      if (!start || !end) return false;
      if (dateFromObj && end < dateFromObj) return false;
      if (dateToObj && start > dateToObj) return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.itemCode?.toLowerCase().includes(q) ||
      (r.barcode ?? "").toLowerCase().includes(q) ||
      r.itemName?.toLowerCase().includes(q) ||
      (r.remark ?? "").toLowerCase().includes(q)
    );
  });

  // ── Group the view by product ────────────────────────────────────────
  // A product (same barcode, or Watson code when it has no barcode) usually
  // has several promo periods/mechanics. Grouping those rows together makes
  // the master table much easier to scan. Grouping applies in VIEW mode only;
  // edit mode keeps the raw order so adding/editing rows stays predictable.
  const groupKeyOf = (r: Row) =>
    (r.barcode || "").trim() || (r.itemCode || "").trim() || "—";
  const startMs = (d: Row["promoStart"]) =>
    d instanceof Date ? d.getTime() : d ? new Date(d).getTime() : 0;
  const isRowActive = (r: Row) =>
    !!(r.promoStart && r.promoEnd && r.promoStart <= today && r.promoEnd >= today);

  const groupSizes = new Map<string, number>();
  const groupHasActive = new Map<string, boolean>();
  for (const r of filteredRows) {
    const k = groupKeyOf(r);
    groupSizes.set(k, (groupSizes.get(k) ?? 0) + 1);
    if (isRowActive(r)) groupHasActive.set(k, true);
    else if (!groupHasActive.has(k)) groupHasActive.set(k, false);
  }

  const groupedSorted = [...filteredRows].sort((a, b) => {
    const ka = groupKeyOf(a);
    const kb = groupKeyOf(b);
    // Active products first (a group is active if any of its promos is active).
    const ga = groupHasActive.get(ka) ? 0 : 1;
    const gb = groupHasActive.get(kb) ? 0 : 1;
    if (ga !== gb) return ga - gb;
    if (ka !== kb) return ka.localeCompare(kb);
    // Within a product, the active promo sits at the top of the group.
    const ra = isRowActive(a) ? 0 : 1;
    const rb = isRowActive(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return startMs(a.promoStart) - startMs(b.promoStart);
  });

  const displayRows: {
    row: Row;
    grouped: boolean;
    isFirst: boolean;
    groupIndex: number;
    groupSize: number;
  }[] = [];
  if (editMode) {
    for (const row of filteredRows)
      displayRows.push({ row, grouped: false, isFirst: true, groupIndex: 0, groupSize: 1 });
  } else {
    let prevKey: string | null = null;
    let gi = -1;
    for (const row of groupedSorted) {
      const key = groupKeyOf(row);
      const isFirst = key !== prevKey;
      if (isFirst) gi++;
      prevKey = key;
      displayRows.push({
        row,
        grouped: true,
        isFirst,
        groupIndex: gi,
        groupSize: groupSizes.get(key) ?? 1,
      });
    }
  }

  const isFiltered = search || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs text-gray-400 flex items-center gap-1 mb-1">
              <span>Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-700 font-medium">
                Promotion Master
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Promotion Master Data
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              จัดการรายการโปรโมชั่น — ข้อมูลนี้จะถูกใช้โดยระบบบันทึกยอดขาย,
              Watson, และ Dashboard ทั้งหมด
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImport}
            />
            <div className="relative">
              <button
                onClick={() => setImportMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 bg-white"
              >
                <Upload className="w-4 h-4" />
                นำเข้า Excel
                <ChevronDown className="w-4 h-4" />
              </button>
              {importMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setImportMenuOpen(false)}
                  />
                  <div className="absolute left-0 mt-1 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    <button
                      onClick={() => {
                        setImportMenuOpen(false);
                        setPreviewShop("Watson");
                        setShowBigCPreview(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      Watson (Preview)
                    </button>
                    <button
                      onClick={() => {
                        setImportMenuOpen(false);
                        setPreviewShop("BigC");
                        setShowBigCPreview(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
                    >
                      BigC (Preview)
                    </button>
                    <button
                      onClick={() => {
                        setImportMenuOpen(false);
                        fileRef.current?.click();
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                    >
                      Watson (Excel เดิม)
                    </button>
                    <button
                      disabled
                      title="ยังไม่รองรับ"
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 cursor-not-allowed"
                    >
                      Lotus (เร็ว ๆ นี้)
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showHistory
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
              }`}
            >
              <Clock className="w-4 h-4" />
              ประวัติการอัปโหลด
              {uploadHistory.length > 0 && (
                <span className="ml-0.5 text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium">
                  {uploadHistory.length}
                </span>
              )}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 bg-white"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => {
                setEditMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                editMode
                  ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {editMode ? (
                <>
                  <X className="w-4 h-4" /> ยกเลิกแก้ไข
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" /> แก้ไข
                </>
              )}
            </button>
            {editMode && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึก"}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
            {activeCount} Active วันนี้
          </span>
          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
            {isFiltered
              ? `${filteredRows.length} / ${validRows.length} รายการ`
              : `${validRows.length} รายการทั้งหมด`}
          </span>
          {error && (
            <span className="flex items-center gap-1 text-red-600 text-xs bg-red-50 px-3 py-1 rounded-full border border-red-100">
              <AlertTriangle className="w-3.5 h-3.5" />
              {error}
            </span>
          )}
        </div>
      </div>

      {/* ── BigC Import Preview (preview only — no DB write) ── */}
      {showBigCPreview && (
        <BigCImportPreview
          shop={previewShop}
          onClose={() => setShowBigCPreview(false)}
          onSaved={reloadRows}
        />
      )}

      {/* ── Upload History Panel ── */}
      {showHistory && (
        <div className="mx-4 mb-2 rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              ประวัติการอัปโหลด Excel
            </h3>
            <button
              onClick={() => setShowHistory(false)}
              className="text-blue-500 hover:text-blue-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-blue-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              กำลังโหลด...
            </div>
          ) : uploadHistory.length === 0 ? (
            <div className="text-center py-8 text-sm text-blue-400">
              ยังไม่มีประวัติการอัปโหลด
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-100 text-blue-700">
                    <th className="text-left px-4 py-2 font-medium">
                      ชื่อไฟล์
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      ผู้อัปโหลด
                    </th>
                    <th className="text-center px-3 py-2 font-medium">
                      วันที่อัปโหลด
                    </th>
                    <th className="text-center px-3 py-2 font-medium">
                      จำนวนทั้งหมด
                    </th>
                    <th className="text-center px-3 py-2 font-medium">เพิ่ม</th>
                    <th className="text-center px-3 py-2 font-medium">
                      อัปเดต
                    </th>
                    <th className="text-center px-3 py-2 font-medium">ซ้ำ</th>
                    <th className="text-center px-3 py-2 font-medium">
                      ดาวน์โหลด
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.map((rec) => (
                    <tr
                      key={rec.id}
                      className="border-t border-blue-100 hover:bg-blue-50/60 bg-white"
                    >
                      <td
                        className="px-4 py-2 text-gray-700 max-w-xs truncate"
                        title={rec.fileName}
                      >
                        {rec.fileName}
                      </td>
                      <td className="px-3 py-2 text-left">
                        {rec.uploader ? (
                          <div>
                            <p className="text-gray-700 font-medium leading-tight">
                              {rec.uploader.name}
                            </p>
                            <p className="text-gray-400 text-[11px] leading-tight">
                              {rec.uploader.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-500 whitespace-nowrap">
                        {new Date(rec.uploadedAt).toLocaleString("th-TH", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-700 font-medium">
                        {rec.itemCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center text-blue-600 font-semibold">
                        +{rec.added}
                      </td>
                      <td className="px-3 py-2 text-center text-amber-600 font-semibold">
                        {rec.updated}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-400">
                        {rec.duplicate}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {rec.hasFile ? (
                          <button
                            onClick={() => downloadFile(rec)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            ดาวน์โหลด
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">
                            ไม่มีไฟล์
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Table area ── */}
      <div className="flex-1 overflow-auto p-4">
        {/* Search + filter bar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-50 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, Barcode, ชื่อสินค้า, Remark..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
            <span className="text-xs text-gray-400 whitespace-nowrap">โปร</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs border-none outline-none bg-transparent text-gray-700 cursor-pointer"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs border-none outline-none bg-transparent text-gray-700 cursor-pointer"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-gray-400 hover:text-gray-600 text-base leading-none ml-1"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  statusFilter === f
                    ? f === "active"
                      ? "bg-green-500 text-white"
                      : f === "inactive"
                        ? "bg-gray-400 text-white"
                        : "bg-blue-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f === "all"
                  ? "ทั้งหมด"
                  : f === "active"
                    ? "Active"
                    : "หมดอายุ"}
              </button>
            ))}
          </div>

          {editMode && (
            <button
              onClick={addRow}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50/50 font-medium transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายการใหม่
            </button>
          )}
          {editMode && selectedIds.size > 0 && (
            <button
              onClick={() =>
                requestDelete(
                  [...selectedIds],
                  `${selectedIds.size} รายการที่เลือก`,
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              ลบที่เลือก ({selectedIds.size})
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-60 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">กำลังโหลดข้อมูลโปรโมชั่น...</span>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    {editMode && (
                      <th className="w-10 px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredRows.length > 0 &&
                            selectedIds.size === filteredRows.length
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300 text-red-500 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="w-10 px-2 py-3 text-center text-xs text-gray-400">
                      #
                    </th>
                    {COLS.map((c) => (
                      <th
                        key={c.key}
                        className={`${c.w} px-2 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wide whitespace-nowrap`}
                      >
                        {c.label}
                      </th>
                    ))}
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={COLS.length + 2}
                        className="py-12 text-center text-sm text-gray-400"
                      >
                        ไม่พบรายการที่ตรงกับการค้นหา
                      </td>
                    </tr>
                  )}
                  {displayRows.map(
                    ({ row, grouped, isFirst, groupIndex, groupSize }, idx) => {
                    const isActive =
                      row.promoStart &&
                      row.promoEnd &&
                      row.promoStart <= today &&
                      row.promoEnd >= today;
                    const isSelected = selectedIds.has(row._id);
                    const band =
                      grouped && groupIndex % 2 === 1 ? "bg-slate-50/60" : "";
                    return (
                      <tr
                        key={row._id}
                        className={`border-b border-gray-100 transition-colors ${
                          grouped && isFirst && idx > 0
                            ? "border-t-2 border-t-gray-200"
                            : ""
                        } ${
                          isSelected
                            ? "bg-red-50/60"
                            : isActive
                              ? "bg-blue-50/30 hover:bg-blue-50/50"
                              : `${band} hover:bg-amber-50/20`
                        }`}
                      >
                        {editMode && (
                          <td className="px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(row._id)}
                              className="rounded border-gray-300 text-red-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-2 py-1 text-center text-xs text-gray-400 select-none">
                          {grouped && isFirst && groupSize > 1 ? (
                            <span
                              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold"
                              title={`สินค้านี้มี ${groupSize} โปรโมชั่น`}
                            >
                              {groupSize}
                            </span>
                          ) : isActive ? (
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-blue-400"
                              title="Active"
                            />
                          ) : (
                            idx + 1
                          )}
                        </td>
                        {COLS.map((col) => {
                          // In the grouped view, show the product identity
                          // (barcode / Watson code / name) only on the first
                          // row of each group — continuation rows stay blank so
                          // the group reads as one product.
                          const isGroupCol =
                            col.key === "barcode" ||
                            col.key === "itemCode" ||
                            col.key === "itemName";
                          if (grouped && !isFirst && isGroupCol) {
                            return (
                              <td key={col.key} className="px-1 py-1">
                                <div className="px-2 py-1.5 text-xs text-gray-300 select-none">
                                  {col.key === "barcode" ? "↳" : ""}
                                </div>
                              </td>
                            );
                          }
                          const rawVal = row[col.key];
                          const val =
                            col.type === "date"
                              ? fmtDate(rawVal as any)
                              : col.type === "number" &&
                                  rawVal != null &&
                                  rawVal !== ""
                                ? Number(rawVal).toFixed(2)
                                : rawVal != null
                                  ? String(rawVal)
                                  : "";
                          const isEmpty =
                            rawVal === null ||
                            rawVal === undefined ||
                            rawVal === "" ||
                            rawVal === 0;
                          const isInvalid =
                            validateIds.has(row._id) &&
                            REQUIRED_KEYS.includes(col.key) &&
                            isEmpty;
                          return (
                            <td key={col.key} className="px-1 py-1">
                              <input
                                type={
                                  col.type === "date"
                                    ? "date"
                                    : col.type === "number"
                                      ? "number"
                                      : "text"
                                }
                                value={val}
                                onChange={(e) =>
                                  updateCell(row._id, col.key, e.target.value)
                                }
                                readOnly={!editMode}
                                placeholder={col.placeholder ?? ""}
                                step={
                                  col.type === "number" ? "0.01" : undefined
                                }
                                className={`w-full px-2 py-1.5 text-xs rounded border transition-all focus:outline-none focus:ring-1 ${
                                  !editMode
                                    ? "bg-transparent border-transparent cursor-default"
                                    : isInvalid
                                      ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-300 focus:bg-white"
                                      : "border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-blue-500 bg-transparent focus:bg-white"
                                } ${
                                  col.key === "remark"
                                    ? isNonPromo(row.remark)
                                      ? "text-gray-400"
                                      : "font-semibold text-pink-600"
                                    : col.key === "itemCode"
                                      ? "font-mono text-blue-700"
                                      : col.key === "barcode"
                                        ? "font-mono text-gray-600"
                                        : col.type === "number"
                                          ? "text-right tabular-nums text-gray-800"
                                          : "text-gray-800"
                                }`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 text-center">
                          {editMode && (
                            <button
                              onClick={() =>
                                requestDelete(
                                  [row._id],
                                  row.itemName || row.itemCode || "รายการนี้",
                                )
                              }
                              title="ลบแถวนี้"
                              className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer note ── */}
      <div className="px-6 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>การบันทึกจะมีผลทันที</strong> —
          ข้อมูลโปรโมชั่นที่บันทึกแล้วจะถูกใช้โดย{" "}
          <strong>บันทึกยอดขายรายวัน</strong>,{" "}
          <strong>Watson Excel Validator</strong> และ Dashboard ทั้งหมด
          โดยไม่ต้อง restart ระบบ
        </span>
      </div>

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-base">
                  ยืนยันการลบ
                </h3>
                <p className="text-red-700 text-sm mt-1">
                  ต้องการลบ <strong>{deleteConfirm.label}</strong> ใช่หรือไม่?
                </p>
                <p className="text-red-500 text-xs mt-1">
                  การกระทำนี้ไม่สามารถย้อนกลับได้ (กด บันทึก
                  เพื่อบันทึกการเปลี่ยนแปลง)
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Error Modal ── */}
      {importError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-50 px-6 py-5 flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-base">
                  รูปแบบ Excel ไม่ถูกต้อง
                </h3>
                <p className="text-red-700 text-xs mt-0.5">
                  ไม่สามารถนำเข้าได้ กรุณาแก้ไขไฟล์ก่อน
                </p>
              </div>
            </div>
            <div className="px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {importError}
              </pre>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 border border-gray-100">
                <strong className="text-gray-700">
                  ชื่อคอลัมน์ที่ต้องการ (ต้องตรงทั้งหมด):
                </strong>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    "Watson Code",
                    "Barcode",
                    "Item Name",
                    "Start",
                    "End",
                    "Standard Price IncV",
                    "Comm Price IncV",
                    "Invoice 62% IncV",
                    "Invoice 62% ExV",
                  ].map((c) => (
                    <span
                      key={c}
                      className="font-mono text-[11px] bg-white border border-gray-200 px-1.5 py-0.5 rounded"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setImportError(null)}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Import Modal ── */}
      {pendingImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-blue-50 px-6 py-5 flex items-start gap-3 shrink-0">
              <div className="shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Upload className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-blue-800 text-base">
                  ยืนยันการนำเข้า?
                </h3>
                <p className="text-blue-600 text-xs mt-0.5 truncate max-w-xs">
                  {pendingImport.file.name}
                </p>
                <p className="text-blue-400 text-xs mt-0.5">
                  เปรียบเทียบกับ {pendingImport.existingCount} รายการในระบบ
                </p>
              </div>
            </div>

            <div className="px-6 py-4 space-y-2.5 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">➕</span>
                  <span className="text-sm font-medium text-blue-800">
                    เพิ่มใหม่
                  </span>
                </div>
                <span className="font-bold text-blue-700 text-xl">
                  {pendingImport.added}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="text-base">✏️</span>
                  <span className="text-sm font-medium text-amber-800">
                    อัปเดต
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-700 text-xl">
                    {pendingImport.updated}
                  </span>
                  {pendingImport.updatedDetails.length > 0 && (
                    <button
                      onClick={() => setShowImportDetails((v) => !v)}
                      className="text-xs text-amber-600 underline hover:text-amber-800"
                    >
                      {showImportDetails ? "ซ่อน" : "ดูรายละเอียด"}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-base">⏭️</span>
                  <span className="text-sm font-medium text-gray-600">
                    ซ้ำ (ข้าม)
                  </span>
                </div>
                <span className="font-bold text-gray-500 text-xl">
                  {pendingImport.duplicate}
                </span>
              </div>

              {pendingImport.conflictWarnings.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">⚠️</span>
                    <span className="text-sm font-semibold text-orange-800">
                      Watson Code + ช่วงโปรโมชัน เหมือนกัน แต่ราคาต่างกัน (
                      {pendingImport.conflictWarnings.length} รายการ)
                    </span>
                  </div>
                  <p className="text-xs text-orange-600 mb-3">
                    กรุณาเลือกว่าจะใช้ข้อมูลจากแถวไหน (ค่าเริ่มต้น =
                    แถวสุดท้ายในไฟล์)
                  </p>
                  <div className="space-y-3">
                    {pendingImport.conflictWarnings.map((w, i) => {
                      const choice = conflictChoices[i] ?? "kept";
                      const diffFields: Array<{
                        label: string;
                        a: any;
                        b: any;
                      }> = [];
                      if (!cmpNum(w.discarded.stdPrice, w.kept.stdPrice))
                        diffFields.push({
                          label: "Std Price",
                          a: w.discarded.stdPrice,
                          b: w.kept.stdPrice,
                        });
                      if (!cmpNum(w.discarded.commPrice, w.kept.commPrice))
                        diffFields.push({
                          label: "Comm Price",
                          a: w.discarded.commPrice,
                          b: w.kept.commPrice,
                        });
                      if (
                        !cmpNum(w.discarded.invoice62IncV, w.kept.invoice62IncV)
                      )
                        diffFields.push({
                          label: "Inv62 IncV",
                          a: w.discarded.invoice62IncV,
                          b: w.kept.invoice62IncV,
                        });
                      if (
                        !cmpNum(w.discarded.invoice62ExV, w.kept.invoice62ExV)
                      )
                        diffFields.push({
                          label: "Inv62 ExV",
                          a: w.discarded.invoice62ExV,
                          b: w.kept.invoice62ExV,
                        });
                      return (
                        <div
                          key={i}
                          className="bg-white rounded-xl border border-orange-100 overflow-hidden"
                        >
                          <div className="px-3 py-2 bg-orange-50/80 border-b border-orange-100">
                            <p className="text-xs font-semibold text-gray-700">
                              <span className="font-mono">{w.itemCode}</span> —{" "}
                              {w.itemName}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              ช่วงโปรโมชัน (เหมือนกัน):{" "}
                              {fmtDate(w.kept.promoStart)} –{" "}
                              {fmtDate(w.kept.promoEnd)}
                              {w.kept.remark
                                ? ` · Remark: ${w.kept.remark}`
                                : ""}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 divide-x divide-orange-100">
                            <button
                              onClick={() =>
                                setConflictChoices((prev) => ({
                                  ...prev,
                                  [i]: "discarded",
                                }))
                              }
                              className={`text-left p-3 transition-colors ${
                                choice === "discarded"
                                  ? "bg-blue-50 ring-2 ring-inset ring-blue-400"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div
                                className={`text-[11px] font-bold mb-1.5 ${choice === "discarded" ? "text-blue-600" : "text-gray-400"}`}
                              >
                                {choice === "discarded" ? "✓ " : ""}แถวแรกในไฟล์
                              </div>
                              {diffFields.map((f, j) => (
                                <div key={j} className="text-xs text-gray-700">
                                  {f.label}:{" "}
                                  <span
                                    className={`font-semibold ${choice === "discarded" ? "text-blue-700" : ""}`}
                                  >
                                    {f.a ?? "—"}
                                  </span>
                                </div>
                              ))}
                            </button>
                            <button
                              onClick={() =>
                                setConflictChoices((prev) => ({
                                  ...prev,
                                  [i]: "kept",
                                }))
                              }
                              className={`text-left p-3 transition-colors ${
                                choice === "kept"
                                  ? "bg-blue-50 ring-2 ring-inset ring-blue-400"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <div
                                className={`text-[11px] font-bold mb-1.5 ${choice === "kept" ? "text-blue-600" : "text-gray-400"}`}
                              >
                                {choice === "kept" ? "✓ " : ""}แถวสุดท้ายในไฟล์
                              </div>
                              {diffFields.map((f, j) => (
                                <div key={j} className="text-xs text-gray-700">
                                  {f.label}:{" "}
                                  <span
                                    className={`font-semibold ${choice === "kept" ? "text-blue-700" : ""}`}
                                  >
                                    {f.b ?? "—"}
                                  </span>
                                </div>
                              ))}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingImport.overlapWarnings.length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">🔀</span>
                    <span className="text-sm font-semibold text-purple-800">
                      พบช่วงวันที่ซ้อนทับกัน (
                      {pendingImport.overlapWarnings.length} รายการ)
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 mb-3">
                    Watson Code เดียวกัน แต่ช่วงโปรโมชันซ้อนทับกัน (Remark
                    ต่างกัน) — ระบบนำเข้าทั้งสองแถว กรุณาตรวจสอบ
                  </p>
                  <div className="space-y-2">
                    {pendingImport.overlapWarnings.map((w, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-lg border border-purple-100 px-3 py-2"
                      >
                        <p className="text-xs font-semibold text-gray-700 mb-1.5">
                          <span className="font-mono">{w.itemCode}</span> —{" "}
                          {w.itemName}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-start gap-2 text-[11px] text-gray-600">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-purple-300 shrink-0" />
                            <span>
                              {fmtDate(w.rowA.promoStart)} –{" "}
                              {fmtDate(w.rowA.promoEnd)}
                              {w.rowA.remark ? (
                                <span
                                  className={`ml-1 font-medium ${isNonPromo(w.rowA.remark) ? "text-gray-400" : "text-pink-600"}`}
                                >
                                  [{w.rowA.remark}]
                                </span>
                              ) : null}
                              {isNonPromo(w.rowA.remark) && (
                                <span className="ml-1 text-gray-400 italic">
                                  (ราคาปกติ)
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-[11px] text-gray-600">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-purple-300 shrink-0" />
                            <span>
                              {fmtDate(w.rowB.promoStart)} –{" "}
                              {fmtDate(w.rowB.promoEnd)}
                              {w.rowB.remark ? (
                                <span
                                  className={`ml-1 font-medium ${isNonPromo(w.rowB.remark) ? "text-gray-400" : "text-pink-600"}`}
                                >
                                  [{w.rowB.remark}]
                                </span>
                              ) : null}
                              {isNonPromo(w.rowB.remark) && (
                                <span className="ml-1 text-gray-400 italic">
                                  (ราคาปกติ)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showImportDetails && pendingImport.updatedDetails.length > 0 && (
                <div className="mt-1 rounded-xl border border-amber-200 overflow-hidden">
                  <div className="bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 border-b border-amber-200">
                    รายการที่จะถูกอัปเดต ({pendingImport.updatedDetails.length}{" "}
                    รายการ)
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-amber-100">
                    {pendingImport.updatedDetails.map((detail, i) => (
                      <div key={i} className="px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">
                          <span className="text-amber-600 font-mono">
                            {detail.itemCode}
                          </span>{" "}
                          —{" "}
                          <span className="font-normal text-gray-500 truncate">
                            {detail.itemName}
                          </span>
                        </p>
                        <div className="space-y-0.5">
                          {detail.fields.map((f, j) => (
                            <div
                              key={j}
                              className="flex items-center gap-1 text-[11px] text-gray-600"
                            >
                              <span className="shrink-0 font-medium text-gray-500 w-28">
                                {f.label}:
                              </span>
                              <span className="line-through text-red-400">
                                {f.from}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="text-emerald-600 font-medium">
                                {f.to}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-1">
                กด &quot;ยืนยัน&quot; เพื่อรวมและบันทึกข้อมูลลง Firestore ทันที
              </p>
            </div>

            {importProgress !== "idle" && (
              <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center bg-white/95 z-10 gap-4 px-8">
                {importProgress === "saving" && (
                  <>
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <p className="text-base font-semibold text-gray-700">
                      กำลังอัปโหลดข้อมูล...
                    </p>
                    <p className="text-xs text-gray-400">
                      {pendingImport?.file.name}
                    </p>
                  </>
                )}
                {importProgress === "success" && importProgressResult && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-9 h-9 text-green-500" />
                    </div>
                    <p className="text-base font-bold text-gray-800">
                      อัปโหลดสำเร็จ!
                    </p>
                    <div className="flex gap-4 text-sm text-gray-600">
                      {importProgressResult.added > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-blue-500 font-bold">
                            +{importProgressResult.added}
                          </span>{" "}
                          เพิ่มใหม่
                        </span>
                      )}
                      {importProgressResult.updated > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-amber-500 font-bold">
                            {importProgressResult.updated}
                          </span>{" "}
                          อัปเดต
                        </span>
                      )}
                      {importProgressResult.duplicate > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400 font-bold">
                            {importProgressResult.duplicate}
                          </span>{" "}
                          ซ้ำ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      ปิดอัตโนมัติในไม่ช้า...
                    </p>
                  </>
                )}
                {importProgress === "error" && (
                  <>
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="w-9 h-9 text-red-500" />
                    </div>
                    <p className="text-base font-bold text-gray-800">
                      อัปโหลดไม่สำเร็จ
                    </p>
                    <p className="text-xs text-red-500 text-center">
                      {error || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"}
                    </p>
                    <div className="flex gap-3 w-full mt-2">
                      <button
                        onClick={() => {
                          setPendingImport(null);
                          setImportProgress("idle");
                          setImportProgressResult(null);
                        }}
                        className="flex-1 py-2 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50"
                      >
                        ปิด
                      </button>
                      <button
                        onClick={() => {
                          setImportProgress("idle");
                          confirmImport();
                        }}
                        className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                      >
                        ลองใหม่
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="px-6 pb-5 pt-3 flex gap-3 shrink-0 border-t border-gray-100">
              <button
                onClick={() => {
                  setPendingImport(null);
                  setConflictChoices({});
                  setShowImportDetails(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmImport}
                disabled={importProgress !== "idle"}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
