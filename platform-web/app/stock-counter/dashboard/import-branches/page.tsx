"use client";

import { db } from "@/lib/firebase";
import { addEmailsToModuleWhitelist } from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Save,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

interface BranchRow {
  rowNum: number;
  name: string;
  code?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
  seller?: string;
  supervisorEmail?: string;
  supervisorId?: string;
  supervisorName?: string;
  status: "pending" | "ok" | "error" | "duplicate";
  message?: string;
}

interface SupervisorLite {
  id: string;
  email: string;
  name: string;
}

const normalizeImportKey = (key: string) =>
  key
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]/g, "");

const buildRowGetter = (row: Record<string, unknown>) => {
  const normalized = new Map<string, unknown>();
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = normalizeImportKey(key);
    if (!normalized.has(normalizedKey)) {
      normalized.set(normalizedKey, value);
    }
  });

  return (...keys: string[]) => {
    for (const key of keys) {
      const value = normalized.get(normalizeImportKey(key));
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  };
};

export default function ImportBranchesPage() {
  const { userData } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<BranchRow[]>([]);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [supervisors, setSupervisors] = useState<SupervisorLite[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
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
        const codes = new Set<string>();
        const names = new Set<string>();
        let cName = "";
        let cCode = "";
        branchSnap.docs.forEach((d) => {
          const data = d.data() as {
            code?: string;
            name?: string;
            companyName?: string;
            companyCode?: string;
          };
          if (data.code) codes.add(data.code.trim().toLowerCase());
          if (data.name) names.add(data.name.trim().toLowerCase());
          if (!cName && data.companyName) cName = data.companyName;
          if (!cCode && data.companyCode) cCode = data.companyCode;
        });
        setExistingCodes(codes);
        setExistingNames(names);
        setCompanyName(cName);
        setCompanyCode(cCode);

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
              uid?: string;
              email?: string;
              fullName?: string;
              name?: string;
              displayName?: string;
            };
            return {
              id: data.uid || d.id,
              email: (data.email || "").toLowerCase(),
              name:
                data.fullName ||
                data.name ||
                data.displayName ||
                data.email ||
                "",
            };
          }),
        );
      } catch (err) {
        console.error(err);
        toast.error("โหลดข้อมูลสาขาไม่สำเร็จ");
      }
    })();
  }, [companyId]);

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
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      if (raw.length === 0) {
        toast.error("ไฟล์ว่าง");
        return;
      }

      const seen = new Set<string>();
      const parsed: BranchRow[] = raw.map((r, idx) => {
        const get = buildRowGetter(r);
        const name = get(
          "name",
          "branchName",
          "branch name",
          "ชื่อ",
          "ชื่อสาขา",
        );
        const code = get(
          "code",
          "branchCode",
          "branch code",
          "รหัส",
          "รหัสสาขา",
        );
        const address = get("address", "ที่อยู่");
        const latStr = get("latitude", "lat", "ละติจูด");
        const lngStr = get("longitude", "lng", "lon", "ลองจิจูด");
        const radiusStr = get(
          "radiusMeters",
          "radius",
          "radius meters",
          "รัศมี",
        );
        const seller = get(
          "seller",
          "sellerCategory",
          "seller category",
          "ร้านค้า",
        );
        const supervisorEmail = get(
          "supervisorEmail",
          "supervisor email",
          "supervisor",
          "หัวหน้า",
          "อีเมลหัวหน้า",
        ).toLowerCase();

        const errors: string[] = [];
        if (!name) errors.push("ต้องมีชื่อสาขา");

        let lat: number | null = null;
        let lng: number | null = null;
        if (latStr) {
          lat = parseFloat(latStr);
          if (isNaN(lat)) errors.push("latitude ไม่ใช่ตัวเลข");
        }
        if (lngStr) {
          lng = parseFloat(lngStr);
          if (isNaN(lng)) errors.push("longitude ไม่ใช่ตัวเลข");
        }
        let radius = 200;
        if (radiusStr) {
          const r2 = parseInt(radiusStr, 10);
          if (isNaN(r2)) errors.push("radiusMeters ไม่ใช่ตัวเลข");
          else radius = r2;
        }

        const row: BranchRow = {
          rowNum: idx + 2,
          name,
          code: code || undefined,
          address: address || undefined,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
          seller: seller || undefined,
          supervisorEmail: supervisorEmail || undefined,
          status: "pending",
        };

        if (supervisorEmail) {
          const supervisor = supervisorByEmail.get(supervisorEmail);
          if (supervisor) {
            row.supervisorId = supervisor.id;
            row.supervisorName = supervisor.name;
          }
        }

        // Duplicate within file
        const key = (code || name).toLowerCase();
        if (seen.has(key)) {
          row.status = "error";
          row.message = "ซ้ำในไฟล์";
        } else {
          seen.add(key);
        }

        // Duplicate vs DB
        if (row.status === "pending") {
          if (code && existingCodes.has(code.toLowerCase())) {
            row.status = "duplicate";
            row.message = `รหัส "${code}" มีอยู่แล้ว`;
          } else if (existingNames.has(name.toLowerCase())) {
            row.status = "duplicate";
            row.message = `ชื่อ "${name}" มีอยู่แล้ว`;
          }
        }

        if (errors.length > 0) {
          row.status = "error";
          row.message = errors.join(", ");
        }
        return row;
      });

      setRows(parsed);
      const okCount = parsed.filter((p) => p.status === "pending").length;
      toast.success(`อ่านสำเร็จ ${parsed.length} แถว (พร้อมเพิ่ม ${okCount})`);
    } catch (err) {
      console.error(err);
      toast.error("อ่านไฟล์ไม่สำเร็จ");
    }
  };

  const handleSaveAll = async () => {
    if (!companyId) {
      toast.error("ไม่พบบริษัท");
      return;
    }
    const ok = rows.filter((r) => r.status === "pending");
    if (ok.length === 0) {
      toast.error("ไม่มีแถวให้บันทึก");
      return;
    }
    setIsSaving(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];
      if (r.status !== "pending") continue;
      try {
        await addDoc(collection(db, "branches"), {
          companyId,
          companyName,
          companyCode,
          name: r.name,
          code: r.code || null,
          address: r.address || null,
          latitude: r.latitude,
          longitude: r.longitude,
          radiusMeters: r.radiusMeters || 200,
          sellerCategory: r.seller || null,
          seller: r.seller || null,
          supervisorEmail: r.supervisorEmail || null,
          supervisorId: r.supervisorId || null,
          supervisorName: r.supervisorName || null,
          createdAt: serverTimestamp(),
        });
        updated[i] = { ...r, status: "ok", message: "เพิ่มแล้ว" };
        success++;
      } catch (err) {
        updated[i] = {
          ...r,
          status: "error",
          message: err instanceof Error ? err.message : "Error",
        };
        failed++;
      }
      setRows([...updated]);
      setProgress(Math.round(((i + 1) / updated.length) * 100));
    }
    setIsSaving(false);

    // Pre-register supervisor emails that had no matching user yet:
    // add them to the company's stock-counter module whitelist so they
    // get auto-assigned access the first time they log in.
    const unresolvedEmails = ok
      .filter((r) => r.supervisorEmail && !r.supervisorId)
      .map((r) => r.supervisorEmail!);

    if (unresolvedEmails.length > 0) {
      try {
        await addEmailsToModuleWhitelist(
          companyId,
          "stock-counter",
          unresolvedEmails,
        );
        toast.success(
          `Pre-registered ${unresolvedEmails.length} supervisor email(s) — จะเห็น module เมื่อ login`,
        );
      } catch (err) {
        console.error("Failed to pre-register supervisor emails:", err);
      }
    }

    toast.success(`เสร็จสิ้น: เพิ่ม ${success} • ล้มเหลว ${failed}`);
  };

  const downloadTemplate = () => {
    const sample = [
      {
        name: "สาขากรุงเทพฯ",
        code: "BKK01",
        address: "123 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพฯ 10110",
        latitude: 13.7563,
        longitude: 100.5018,
        radiusMeters: 200,
        seller: "Watson's",
        supervisorEmail: "supervisor@example.com",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    XLSX.writeFile(wb, "branches_import_template.xlsx");
  };

  const counts = useMemo(
    () => ({
      ready: rows.filter((r) => r.status === "pending").length,
      ok: rows.filter((r) => r.status === "ok").length,
      dup: rows.filter((r) => r.status === "duplicate").length,
      err: rows.filter((r) => r.status === "error").length,
    }),
    [rows],
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/stock-counter/dashboard/branches"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            นำเข้าสาขาจากไฟล์ Excel/CSV
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3">
            1. ดาวน์โหลดเทมเพลต
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            คอลัมน์:{" "}
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              name, code, address, latitude, longitude, radiusMeters, seller,
              supervisorEmail
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
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  รวม {rows.length} • พร้อม {counts.ready} • ซ้ำ {counts.dup} •
                  ผิดพลาด {counts.err} • สำเร็จ {counts.ok}
                </span>
              </div>
              <button
                onClick={handleSaveAll}
                disabled={isSaving || counts.ready === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? `บันทึก... ${progress}%` : "3. บันทึกสาขาทั้งหมด"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">ชื่อ</th>
                    <th className="px-3 py-2 text-left">รหัส</th>
                    <th className="px-3 py-2 text-left">ที่อยู่</th>
                    <th className="px-3 py-2 text-left">Lat</th>
                    <th className="px-3 py-2 text-left">Lng</th>
                    <th className="px-3 py-2 text-left">รัศมี</th>
                    <th className="px-3 py-2 text-left">Seller</th>
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
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.code || "-"}</td>
                      <td
                        className="px-3 py-2 max-w-xs truncate"
                        title={r.address}
                      >
                        {r.address || "-"}
                      </td>
                      <td className="px-3 py-2">{r.latitude ?? "-"}</td>
                      <td className="px-3 py-2">{r.longitude ?? "-"}</td>
                      <td className="px-3 py-2">{r.radiusMeters || 200}</td>
                      <td className="px-3 py-2">{r.seller || "-"}</td>
                      <td className="px-3 py-2">
                        {r.supervisorName || r.supervisorEmail || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {r.status === "ok" && (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {r.message}
                          </span>
                        )}
                        {r.status === "duplicate" && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            ⚠ {r.message}
                          </span>
                        )}
                        {r.status === "error" && (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {r.message}
                          </span>
                        )}
                        {r.status === "pending" && (
                          <span className="text-gray-500">รอบันทึก</span>
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
