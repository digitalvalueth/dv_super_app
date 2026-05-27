"use client";

import { useAuthStore } from "@/stores/auth.store";
import { getAuth } from "firebase/auth";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

interface UpdateRow {
  rowNum: number;
  email: string;
  fullName: string;
  baCode: string;
  status: "pending" | "updated" | "not_found" | "skipped" | "error";
  message?: string;
}

const normalizeKey = (key: string) =>
  key
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]/g, "");

const buildRowGetter = (row: Record<string, unknown>) => {
  const normalized = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => {
    const nk = normalizeKey(k);
    if (!normalized.has(nk)) normalized.set(nk, v);
  });
  return (...keys: string[]) => {
    for (const k of keys) {
      const v = normalized.get(normalizeKey(k));
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return "";
  };
};

export default function UpdateUsersPage() {
  const { userData } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellText: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: "",
        raw: false,
      });

      if (raw.length === 0) {
        toast.error("ไฟล์ว่าง");
        return;
      }

      const parsed: UpdateRow[] = raw.map((r, idx) => {
        const get = buildRowGetter(r);
        const email = get("email", "e-mail", "mail", "อีเมล").toLowerCase();
        const fullName = get(
          "fullName",
          "full name",
          "name",
          "ชื่อ",
          "ชื่อสกุล",
          "ชื่อ-นามสกุล",
        );
        const baCode = get(
          "baCode",
          "BACode",
          "ba_code",
          "ba code",
          "รหัสพนักงาน",
        );

        const errors: string[] = [];
        if (!email || !email.includes("@")) errors.push("อีเมลไม่ถูกต้อง");
        if (!fullName && !baCode)
          errors.push("ต้องมีชื่อหรือรหัสพนักงานอย่างน้อย 1 อย่าง");

        return {
          rowNum: idx + 2,
          email,
          fullName,
          baCode,
          status: errors.length > 0 ? "error" : "pending",
          message: errors.join(", ") || undefined,
        };
      });

      setRows(parsed);
      const ok = parsed.filter((p) => p.status === "pending").length;
      toast.success(`อ่านไฟล์สำเร็จ ${parsed.length} แถว (พร้อมอัปเดต ${ok})`);
    } catch (err) {
      console.error(err);
      toast.error("อ่านไฟล์ไม่สำเร็จ");
    }
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter((r) => r.status === "pending");
    if (validRows.length === 0) {
      toast.error("ไม่มีแถวที่ถูกต้อง");
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบใหม่");
      return;
    }
    const token = await user.getIdToken();

    setIsSaving(true);
    setProgress(0);

    // Send in batches of 50
    const BATCH = 50;
    const updated = [...rows];
    let saved = 0;
    let failed = 0;

    for (let start = 0; start < validRows.length; start += BATCH) {
      const batch = validRows.slice(start, start + BATCH);
      try {
        const res = await fetch("/api/users/update-profiles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rows: batch.map((r) => ({
              email: r.email,
              fullName: r.fullName || undefined,
              baCode: r.baCode || undefined,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          // Mark entire batch as error
          batch.forEach((r) => {
            const idx = updated.findIndex(
              (u) => u.email === r.email && u.rowNum === r.rowNum,
            );
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                status: "error",
                message: data.error || `HTTP ${res.status}`,
              };
              failed++;
            }
          });
        } else {
          // Map per-row results back
          (
            data.results as Array<{
              email: string;
              status: string;
              message?: string;
            }>
          ).forEach((result) => {
            const idx = updated.findIndex(
              (u) => u.email === result.email && u.status === "pending",
            );
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                status: result.status as UpdateRow["status"],
                message: result.message,
              };
              if (result.status === "updated") saved++;
              else failed++;
            }
          });
        }
      } catch (err) {
        batch.forEach((r) => {
          const idx = updated.findIndex(
            (u) => u.email === r.email && u.rowNum === r.rowNum,
          );
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              status: "error",
              message: "Network error",
            };
            failed++;
          }
        });
      }

      setRows([...updated]);
      setProgress(
        Math.round(((start + batch.length) / validRows.length) * 100),
      );
    }

    setIsSaving(false);
    toast.success(`เสร็จสิ้น: อัปเดตสำเร็จ ${saved} • ล้มเหลว ${failed}`);
  };

  const downloadTemplate = () => {
    const sample = [
      { email: "employee@example.com", fullName: "สมชาย ใจดี", baCode: "0087" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UpdateUsers");
    XLSX.writeFile(wb, "update-users-template.xlsx");
  };

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const updatedCount = rows.filter((r) => r.status === "updated").length;
  const errorCount = rows.filter(
    (r) => r.status === "error" || r.status === "not_found",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/stock-counter/dashboard"
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            อัปเดตชื่อ &amp; รหัสพนักงาน
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            อัปเดต fullName และ BA Code ของผู้ใช้ที่มีอยู่แล้วตาม email
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
            1. อัปโหลดไฟล์ Excel / CSV
          </h2>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลด Template
          </button>
        </div>

        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">
            คลิกหรือลากไฟล์มาวางที่นี่
          </p>
          <p className="text-xs text-gray-400 mt-1">
            รองรับ .xlsx, .xls, .csv — คอลัมน์:{" "}
            <span className="font-mono">email, fullName, baCode</span>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Preview & Send */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
              2. ตรวจสอบและอัปเดต
            </h2>
            {/* Stats */}
            <div className="flex gap-3 text-sm">
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">
                รอ {pendingCount}
              </span>
              {updatedCount > 0 && (
                <span className="px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                  สำเร็จ {updatedCount}
                </span>
              )}
              {errorCount > 0 && (
                <span className="px-3 py-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium">
                  ผิดพลาด {errorCount}
                </span>
              )}
            </div>

            {isSaving ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังบันทึก {progress}%
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRows([]);
                    setProgress(0);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  ล้าง
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={pendingCount === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                >
                  <Upload className="w-4 h-4" />
                  อัปเดต {pendingCount} รายการ
                </button>
              </div>
            )}

            {isSaving && (
              <div className="w-full mt-1">
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ชื่อ (fullName)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    BA Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.rowNum}
                    className={
                      row.status === "error" || row.status === "not_found"
                        ? "bg-red-50/50 dark:bg-red-900/10"
                        : row.status === "updated"
                          ? "bg-green-50/50 dark:bg-green-900/10"
                          : ""
                    }
                  >
                    <td className="px-4 py-3 text-gray-400">{row.rowNum}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-mono text-xs">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {row.fullName || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400">
                      {row.baCode || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          รอ
                        </span>
                      )}
                      {row.status === "updated" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          อัปเดตแล้ว
                        </span>
                      )}
                      {row.status === "not_found" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          ไม่พบผู้ใช้
                        </span>
                      )}
                      {row.status === "skipped" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500">
                          ข้ามแล้ว
                        </span>
                      )}
                      {row.status === "error" && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          title={row.message}
                        >
                          <XCircle className="w-3 h-3" />
                          {row.message || "ผิดพลาด"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
