"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Send,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

interface ImportRow {
  rowNum: number;
  email: string;
  fullName?: string;
  baCode?: string;
  role: string;
  branchCode?: string;
  branchId?: string;
  branchName?: string;
  supervisorEmail?: string;
  supervisorId?: string;
  seller?: string;
  status: "pending" | "ok" | "error";
  message?: string;
}

interface BranchLite {
  id: string;
  name: string;
  code?: string;
}

interface SupervisorLite {
  id: string;
  email: string;
  name: string;
}

const VALID_ROLES = ["employee", "supervisor", "manager", "admin"];

export default function ImportUsersPage() {
  const { userData } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorLite[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);

  const companyId = userData?.companyId;

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      try {
        const branchSnap = await getDocs(
          query(
            collection(db, "branches"),
            where("companyId", "==", companyId),
          ),
        );
        setBranches(
          branchSnap.docs.map((d) => ({
            id: d.id,
            name: (d.data() as { name?: string }).name || "",
            code: (d.data() as { code?: string }).code,
          })),
        );

        const userSnap = await getDocs(
          query(
            collection(db, "users"),
            where("companyId", "==", companyId),
            where("role", "in", ["supervisor", "manager", "admin"]),
          ),
        );
        setSupervisors(
          userSnap.docs.map((d) => {
            const data = d.data() as {
              email?: string;
              fullName?: string;
              name?: string;
            };
            return {
              id: d.id,
              email: data.email || "",
              name: data.fullName || data.name || data.email || "",
            };
          }),
        );
      } catch (err) {
        console.error("Error loading lookups:", err);
        toast.error("โหลดข้อมูลสาขา/หัวหน้าไม่สำเร็จ");
      }
    })();
  }, [companyId]);

  const branchByCode = useMemo(() => {
    const m = new Map<string, BranchLite>();
    branches.forEach((b) => {
      if (b.code) m.set(b.code.trim().toLowerCase(), b);
      m.set(b.name.trim().toLowerCase(), b);
    });
    return m;
  }, [branches]);

  const supervisorByEmail = useMemo(() => {
    const m = new Map<string, SupervisorLite>();
    supervisors.forEach((s) => {
      if (s.email) m.set(s.email.trim().toLowerCase(), s);
    });
    return m;
  }, [supervisors]);

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: "",
        },
      );

      if (raw.length === 0) {
        toast.error("ไฟล์ว่าง");
        return;
      }

      const parsed: ImportRow[] = raw.map((r, idx) => {
        const get = (k: string) => {
          const v = r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()];
          return v == null ? "" : String(v).trim();
        };
        const email = get("email");
        const fullName = get("fullName") || get("name");
        const role = get("role").toLowerCase() || "employee";
        const branchCode = get("branchCode") || get("branch");
        const supervisorEmail = get("supervisorEmail") || get("supervisor");

        const row: ImportRow = {
          rowNum: idx + 2, // +1 for header, +1 for 1-based
          email,
          fullName,
          baCode: get("baCode") || get("BACode") || get("ba_code"),
          role,
          branchCode,
          supervisorEmail,
          seller: get("seller"),
          status: "pending",
        };

        const errors: string[] = [];
        if (!email || !email.includes("@")) errors.push("อีเมลไม่ถูกต้อง");
        if (!VALID_ROLES.includes(role))
          errors.push(`role ต้องเป็น ${VALID_ROLES.join("/")}`);

        if (branchCode) {
          const b = branchByCode.get(branchCode.toLowerCase());
          if (b) {
            row.branchId = b.id;
            row.branchName = b.name;
          } else {
            errors.push(`ไม่พบสาขา "${branchCode}"`);
          }
        }

        if (supervisorEmail) {
          const sv = supervisorByEmail.get(supervisorEmail.toLowerCase());
          if (sv) {
            row.supervisorId = sv.id;
          } else {
            errors.push(`ไม่พบหัวหน้า "${supervisorEmail}"`);
          }
        }

        if (errors.length > 0) {
          row.status = "error";
          row.message = errors.join(", ");
        }
        return row;
      });

      setRows(parsed);
      const okCount = parsed.filter((p) => p.status !== "error").length;
      toast.success(
        `อ่านไฟล์สำเร็จ ${parsed.length} แถว (พร้อมส่ง ${okCount})`,
      );
    } catch (err) {
      console.error(err);
      toast.error("อ่านไฟล์ไม่สำเร็จ");
    }
  };

  const handleSendAll = async () => {
    const validRows = rows.filter((r) => r.status !== "error");
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

    setIsSending(true);
    setProgress(0);

    let success = 0;
    let failed = 0;
    const updated = [...rows];

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      if (r.status === "error") continue;

      try {
        const res = await fetch("/api/invitations/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: r.email,
            name: r.fullName || r.email.split("@")[0],
            role: r.role,
            branchId: r.branchId || undefined,
            companyId,
            baCode: r.baCode || undefined,
            fullName: r.fullName || undefined,
            seller: r.seller || undefined,
            supervisorId: r.supervisorId || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          updated[i] = {
            ...r,
            status: "error",
            message: data.error || `HTTP ${res.status}`,
          };
          failed++;
        } else {
          updated[i] = { ...r, status: "ok", message: "ส่งสำเร็จ" };
          success++;
        }
      } catch (err) {
        updated[i] = {
          ...r,
          status: "error",
          message: err instanceof Error ? err.message : "Network error",
        };
        failed++;
      }

      setRows([...updated]);
      setProgress(Math.round(((i + 1) / updated.length) * 100));
    }

    setIsSending(false);
    toast.success(`เสร็จสิ้น: ส่งสำเร็จ ${success} • ล้มเหลว ${failed}`);
  };

  const downloadTemplate = () => {
    const sample = [
      {
        email: "ba.somchai@example.com",
        fullName: "สมชาย ใจดี",
        baCode: "BA001",
        role: "employee",
        branchCode: "BKK01",
        supervisorEmail: "supervisor@example.com",
        seller: "Phithan",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "users_import_template.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/stock-counter/dashboard/invitations"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            นำเข้าผู้ใช้จากไฟล์ Excel/CSV
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            1. ดาวน์โหลดเทมเพลต
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            คอลัมน์ที่รองรับ:{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              email, fullName, baCode, role, branchCode, supervisorEmail, seller
            </code>
          </p>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm"
          >
            <Download className="w-4 h-4" />
            ดาวน์โหลดเทมเพลต .xlsx
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            2. อัปโหลดไฟล์
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            เลือกไฟล์ Excel/CSV
          </button>
        </div>

        {rows.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-gray-500" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {rows.length} แถว — พร้อมส่ง{" "}
                  {rows.filter((r) => r.status !== "error").length} • ผิดพลาด{" "}
                  {rows.filter((r) => r.status === "error").length}
                </span>
              </div>
              <button
                onClick={handleSendAll}
                disabled={isSending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isSending ? `ส่ง... ${progress}%` : "3. ส่งคำเชิญทั้งหมด"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">ชื่อ</th>
                    <th className="px-3 py-2 text-left">BA</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">สาขา</th>
                    <th className="px-3 py-2 text-left">Supervisor</th>
                    <th className="px-3 py-2 text-left">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.rowNum}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-3 py-2 text-gray-500">{r.rowNum}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.fullName || "-"}</td>
                      <td className="px-3 py-2">{r.baCode || "-"}</td>
                      <td className="px-3 py-2">{r.role}</td>
                      <td className="px-3 py-2">
                        {r.branchName || r.branchCode || "-"}
                      </td>
                      <td className="px-3 py-2">{r.supervisorEmail || "-"}</td>
                      <td className="px-3 py-2">
                        {r.status === "ok" && (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {r.message}
                          </span>
                        )}
                        {r.status === "error" && (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {r.message}
                          </span>
                        )}
                        {r.status === "pending" && (
                          <span className="text-gray-500">รอส่ง</span>
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
    </div>
  );
}
