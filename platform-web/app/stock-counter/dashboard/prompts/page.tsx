"use client";

import { db } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Activity,
  Check,
  Clock,
  Code,
  Copy,
  Edit3,
  Eye,
  FlaskConical,
  Plus,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  modelId: string;
  version: number;
  isActive: boolean;
  platform: "mobile" | "web" | "all";
  category: "counting" | "barcode" | "product_detection";
  variables: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

const CATEGORIES = [
  { value: "counting", label: "นับสินค้า", icon: "📦" },
  { value: "barcode", label: "บาร์โค้ด", icon: "📊" },
  { value: "product_detection", label: "ตรวจจับสินค้า", icon: "🔍" },
];

const PLATFORMS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "mobile", label: "Mobile" },
  { value: "web", label: "Web" },
];

// Mobile functions that use prompts — configurable mapping
const MOBILE_FUNCTIONS = [
  {
    key: "barcode_scanner",
    label: "สแกนบาร์โค้ด",
    fn: "countBarcodesInImage()",
    desc: "สแกนบาร์โค้ดจากรูปภาพ (ทั้งมีและไม่มี expected)",
  },
  {
    key: "product_counter",
    label: "นับสินค้า",
    fn: "countProductsInImage()",
    desc: "นับจำนวนสินค้าจากรูปภาพ",
  },
];

// Default mapping
const DEFAULT_MAPPING: Record<string, string> = {
  barcode_scanner: "barcode_scanner",
  product_counter: "product_counter",
};

interface UsageStats {
  promptId: string;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  lastUsedAt: Date | null;
  avgResponseTime: number;
}

export default function PromptsPage() {
  const { userData } = useAuthStore();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, UsageStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showEditor, setShowEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(
    null,
  );
  const [previewPrompt, setPreviewPrompt] = useState<PromptTemplate | null>(
    null,
  );

  // Test prompt state
  const [testingPrompt, setTestingPrompt] = useState<PromptTemplate | null>(
    null,
  );
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testImagePreview, setTestImagePreview] = useState<string | null>(null);
  const [testMimeType, setTestMimeType] = useState("image/jpeg");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    rawResponse?: string;
    parsedResponse?: unknown;
    processingTime?: number;
    promptTextUsed?: string;
    error?: string;
  } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formModelId, setFormModelId] = useState("gemini-2.0-flash");
  const [formCategory, setFormCategory] = useState<string>("counting");
  const [formPlatform, setFormPlatform] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  // Prompt mapping state
  const [promptMapping, setPromptMapping] = useState<Record<string, string>>({
    ...DEFAULT_MAPPING,
  });
  const [savingMapping, setSavingMapping] = useState(false);

  useEffect(() => {
    if (!userData) return;
    fetchPrompts();
    fetchUsageStats();
    fetchPromptMapping();
  }, [userData]);

  const fetchPromptMapping = async () => {
    try {
      const mappingDoc = await getDoc(doc(db, "appConfig", "promptMapping"));
      if (mappingDoc.exists()) {
        setPromptMapping({ ...DEFAULT_MAPPING, ...mappingDoc.data() });
      }
    } catch (error) {
      console.error("Error fetching mapping:", error);
    }
  };

  const handleSaveMapping = async () => {
    setSavingMapping(true);
    try {
      await setDoc(doc(db, "appConfig", "promptMapping"), promptMapping, {
        merge: true,
      });
      // Signal mobile to invalidate cache
      await setDoc(
        doc(db, "appConfig", "prompts"),
        {
          lastModified: Timestamp.now(),
          lastModifiedBy: userData?.name || userData?.email || "",
          lastModifiedPrompt: "mapping_changed",
        },
        { merge: true },
      );
      toast.success("บันทึก Mapping สำเร็จ — Mobile จะอัปเดตภายใน ~1 นาที");
    } catch (error) {
      console.error("Error saving mapping:", error);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSavingMapping(false);
    }
  };

  const fetchPrompts = async () => {
    try {
      const q = query(
        collection(db, "promptTemplates"),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      const data: PromptTemplate[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name || "",
          description: raw.description || "",
          prompt: raw.prompt || "",
          modelId: raw.modelId || "",
          version: raw.version || 1,
          isActive: raw.isActive ?? false,
          platform: raw.platform || "all",
          category: raw.category || "counting",
          variables: raw.variables || [],
          createdBy: raw.createdBy || "",
          createdByName: raw.createdByName,
          createdAt: raw.createdAt?.toDate?.() || new Date(),
          updatedAt: raw.updatedAt?.toDate?.(),
        };
      });
      setPrompts(data);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async () => {
    try {
      // Get usage logs from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const q = query(
        collection(db, "promptUsageLogs"),
        where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);

      const statsMap: Record<string, UsageStats> = {};

      snap.docs.forEach((d) => {
        const data = d.data();
        const pid = data.promptId as string;
        if (!pid) return;

        if (!statsMap[pid]) {
          statsMap[pid] = {
            promptId: pid,
            totalCalls: 0,
            successCalls: 0,
            failureCalls: 0,
            lastUsedAt: null,
            avgResponseTime: 0,
          };
        }

        const stats = statsMap[pid];
        stats.totalCalls++;
        if (data.result === "success") stats.successCalls++;
        else stats.failureCalls++;

        const logTime = data.createdAt?.toDate?.();
        if (logTime && (!stats.lastUsedAt || logTime > stats.lastUsedAt)) {
          stats.lastUsedAt = logTime;
        }

        // Running average
        const rt = data.responseTime || 0;
        stats.avgResponseTime =
          stats.avgResponseTime +
          (rt - stats.avgResponseTime) / stats.totalCalls;
      });

      setUsageMap(statsMap);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      // Non-critical — don't show error toast
    }
  };

  const openEditor = (prompt?: PromptTemplate) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormName(prompt.name);
      setFormDescription(prompt.description);
      setFormPrompt(prompt.prompt);
      setFormModelId(prompt.modelId);
      setFormCategory(prompt.category);
      setFormPlatform(prompt.platform);
    } else {
      setEditingPrompt(null);
      setFormName("");
      setFormDescription("");
      setFormPrompt("");
      setFormModelId("gemini-2.0-flash");
      setFormCategory("counting");
      setFormPlatform("all");
    }
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!formName || !formPrompt) {
      toast.error("กรุณากรอกชื่อและ Prompt");
      return;
    }

    // Extract variables from prompt ({{variable}})
    const variables = Array.from(
      formPrompt.matchAll(/\{\{(\w+)\}\}/g),
      (m) => m[1],
    );

    setSaving(true);
    try {
      if (editingPrompt) {
        await updateDoc(doc(db, "promptTemplates", editingPrompt.id), {
          name: formName,
          description: formDescription,
          prompt: formPrompt,
          modelId: formModelId,
          category: formCategory,
          platform: formPlatform,
          variables,
          version: editingPrompt.version + 1,
          updatedAt: Timestamp.now(),
        });
        // Signal mobile to invalidate cache
        await setDoc(
          doc(db, "appConfig", "prompts"),
          {
            lastModified: Timestamp.now(),
            lastModifiedBy: userData?.name || userData?.email || "",
            lastModifiedPrompt: formName,
          },
          { merge: true },
        );
        toast.success("อัปเดต Prompt สำเร็จ");
      } else {
        await addDoc(collection(db, "promptTemplates"), {
          name: formName,
          description: formDescription,
          prompt: formPrompt,
          modelId: formModelId,
          category: formCategory,
          platform: formPlatform,
          variables,
          version: 1,
          isActive: false,
          createdBy: userData?.uid || userData?.id || "",
          createdByName: userData?.name || userData?.email || "",
          createdAt: Timestamp.now(),
        });
        toast.success("สร้าง Prompt สำเร็จ");
      }
      setShowEditor(false);
      fetchPrompts();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (prompt: PromptTemplate) => {
    try {
      if (!prompt.isActive) {
        // Deactivate only OTHER VERSIONS of the SAME prompt name
        // (ไม่ปิด prompt ชื่ออื่นใน category เดียวกัน เพราะ mobile ใช้หลาย prompt พร้อมกัน)
        const sameName = prompts.filter(
          (p) => p.id !== prompt.id && p.name === prompt.name && p.isActive,
        );
        for (const p of sameName) {
          await updateDoc(doc(db, "promptTemplates", p.id), {
            isActive: false,
            updatedAt: Timestamp.now(),
          });
        }
      }

      await updateDoc(doc(db, "promptTemplates", prompt.id), {
        isActive: !prompt.isActive,
        updatedAt: Timestamp.now(),
      });
      // Signal mobile to invalidate cache
      await setDoc(
        doc(db, "appConfig", "prompts"),
        {
          lastModified: Timestamp.now(),
          lastModifiedBy: userData?.name || userData?.email || "",
          lastModifiedPrompt: prompt.name,
        },
        { merge: true },
      );
      toast.success(prompt.isActive ? "ปิดใช้งาน Prompt" : "เปิดใช้งาน Prompt");
      fetchPrompts();
    } catch (error) {
      console.error("Error toggling:", error);
      toast.error("เกิดข้อผิดพลาด");
    }
  };

  const handleDelete = async (prompt: PromptTemplate) => {
    if (!confirm(`ลบ "${prompt.name}"?`)) return;
    try {
      await deleteDoc(doc(db, "promptTemplates", prompt.id));
      toast.success("ลบ Prompt สำเร็จ");
      setPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("เกิดข้อผิดพลาด");
    }
  };

  const openTest = (prompt: PromptTemplate) => {
    setTestingPrompt(prompt);
    // Prefill variables with placeholder values
    const vars: Record<string, string> = {};
    for (const v of prompt.variables) {
      vars[v] = "";
    }
    setTestVars(vars);
    setTestImage(null);
    setTestImagePreview(null);
    setTestResult(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTestMimeType(file.type || "image/jpeg");

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setTestImagePreview(dataUrl);
      // Strip data:image/xxx;base64, prefix
      const base64 = dataUrl.split(",")[1];
      setTestImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleTestPrompt = async () => {
    if (!testingPrompt || !testImage) {
      toast.error("กรุณาเลือกรูปภาพ");
      return;
    }

    setTestRunning(true);
    setTestResult(null);

    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }

      const res = await fetch("/api/prompts/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptId: testingPrompt.id,
          variables: testVars,
          imageBase64: testImage,
          mimeType: testMimeType,
        }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.success) {
        toast.success(`ทดสอบสำเร็จ — ${data.processingTime}ms`);
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Test error:", error);
      toast.error("เกิดข้อผิดพลาดในการทดสอบ");
    } finally {
      setTestRunning(false);
    }
  };

  const filteredPrompts = prompts.filter((p) => {
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.prompt.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const [seeding, setSeeding] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<{
    healthy: boolean;
    summary: { total: number; active: number; missing: number; error: number };
    results: { name: string; status: string; version?: number }[];
  } | null>(null);

  const handleDiagnose = async () => {
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      const res = await fetch("/api/prompts/diagnose", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDiagResult(data);
        if (data.healthy) {
          toast.success(
            `✅ ระบบ Prompt ปกติ — ${data.summary.active}/${data.summary.total} active`,
          );
        } else {
          toast.error(
            `⚠️ พบปัญหา — active: ${data.summary.active}, missing: ${data.summary.missing}, error: ${data.summary.error}`,
          );
        }
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Diagnose error:", error);
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบ");
    } finally {
      setDiagnosing(false);
    }
  };

  const handleSeedPrompts = async () => {
    setSeeding(true);
    try {
      const { getAuth } = await import("firebase/auth");
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error("กรุณาเข้าสู่ระบบใหม่");
        return;
      }
      const res = await fetch("/api/prompts/seed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchPrompts();
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (error) {
      console.error("Seed error:", error);
      toast.error("เกิดข้อผิดพลาดในการ seed");
    } finally {
      setSeeding(false);
    }
  };

  const canManage =
    userData && ["super_admin", "admin"].includes(userData.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            กำลังโหลดข้อมูล...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-500" />
            จัดการ AI Prompts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            จัดการ Prompt templates สำหรับระบบ AI
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiagnose}
              disabled={diagnosing}
              className="flex items-center gap-2 px-4 py-2 border border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Shield className="w-4 h-4" />
              {diagnosing ? "กำลังตรวจ..." : "ตรวจสอบระบบ"}
            </button>
            <button
              onClick={() => openEditor()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              สร้าง Prompt ใหม่
            </button>
          </div>
        )}
      </div>

      {/* Diagnose Result Panel */}
      {diagResult && (
        <div
          className={`rounded-xl border-2 p-4 ${diagResult.healthy ? "border-green-400 bg-green-50 dark:bg-green-900/20" : "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"}`}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              ผลการตรวจสอบระบบ Prompt
              {diagResult.healthy ? (
                <span className="text-green-600 text-sm font-normal ml-2">
                  ✅ ปกติ
                </span>
              ) : (
                <span className="text-yellow-600 text-sm font-normal ml-2">
                  ⚠️ พบปัญหา
                </span>
              )}
            </h3>
            <button
              onClick={() => setDiagResult(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕ ปิด
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {diagResult.results.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700"
              >
                <span>
                  {r.status === "active"
                    ? "🟢"
                    : r.status === "missing"
                      ? "🔴"
                      : "🟡"}
                </span>
                <span className="font-mono text-xs">{r.name}</span>
                {r.version && (
                  <span className="text-gray-400 text-xs ml-auto">
                    v{r.version}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Mapping Config */}
      {canManage && prompts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-indigo-200 dark:border-indigo-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Prompt Mapping — Mobile ใช้ Prompt ไหน?
              </h2>
            </div>
            <button
              onClick={handleSaveMapping}
              disabled={savingMapping}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Check className="w-4 h-4" />
              {savingMapping ? "กำลังบันทึก..." : "บันทึก Mapping"}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            เลือกว่าแต่ละฟังก์ชันบน Mobile จะใช้ Prompt ตัวไหน —
            เปลี่ยนได้ทันทีไม่ต้อง deploy app ใหม่
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOBILE_FUNCTIONS.map((mf) => {
              const activePrompts = prompts.filter((p) => p.isActive);
              return (
                <div
                  key={mf.key}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                      {mf.label}
                    </span>
                    <code className="text-xs text-gray-400 font-mono">
                      {mf.fn}
                    </code>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {mf.desc}
                  </p>
                  <select
                    value={promptMapping[mf.key] || ""}
                    onChange={(e) =>
                      setPromptMapping((prev) => ({
                        ...prev,
                        [mf.key]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">— ไม่เลือก (ใช้ hardcoded) —</option>
                    {activePrompts.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} (v{p.version} · {p.category})
                      </option>
                    ))}
                  </select>
                  {promptMapping[mf.key] && (
                    <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      ใช้ prompt:{" "}
                      <code className="font-mono font-semibold">
                        {promptMapping[mf.key]}
                      </code>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              หมวดหมู่
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">ทั้งหมด</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหา prompt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredPrompts.length === 0 ? (
          <div className="col-span-2 text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <Code className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              ไม่พบ Prompt
            </p>
            {canManage && prompts.length === 0 && (
              <button
                onClick={handleSeedPrompts}
                disabled={seeding}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                <Zap className="w-4 h-4" />
                {seeding
                  ? "กำลังสร้าง..."
                  : "นำเข้า Prompt จากระบบ (Default Prompt)"}
              </button>
            )}
          </div>
        ) : (
          filteredPrompts.map((prompt) => {
            const catInfo = CATEGORIES.find((c) => c.value === prompt.category);
            const usage = usageMap[prompt.id];
            return (
              <div
                key={prompt.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 p-5 ${
                  prompt.isActive
                    ? "border-green-400 dark:border-green-500"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{catInfo?.icon || "📄"}</span>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">
                        {prompt.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        v{prompt.version} · {prompt.platform} · {prompt.modelId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {prompt.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Zap className="w-3 h-3" /> กำลังใช้งาน
                      </span>
                    )}
                  </div>
                </div>

                {/* แสดงว่า mobile ฟังก์ชันไหนดึง prompt นี้ (จาก mapping) */}
                {(() => {
                  const mappedFns = MOBILE_FUNCTIONS.filter(
                    (mf) => promptMapping[mf.key] === prompt.name,
                  );
                  if (mappedFns.length === 0) return null;
                  return mappedFns.map((mf) => (
                    <div
                      key={mf.key}
                      className="flex items-center gap-2 mb-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <Smartphone className="w-3 h-3" />
                        ใช้โดย:{" "}
                        <code className="font-mono font-semibold">{mf.fn}</code>
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">
                        {mf.desc}
                      </span>
                    </div>
                  ));
                })()}

                {/* Usage Stats — แสดงว่า mobile ใช้จริงหรือไม่ */}
                {usage ? (
                  <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">
                        Mobile ใช้งานจริง
                      </span>
                    </div>
                    <div className="flex items-center gap-3 ml-auto text-xs text-blue-600 dark:text-blue-400">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {usage.totalCalls} ครั้ง
                        {usage.failureCalls > 0 && (
                          <span className="text-red-500">
                            ({usage.failureCalls} fail)
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {usage.lastUsedAt
                          ? format(usage.lastUsedAt, "d MMM HH:mm", {
                              locale: th,
                            })
                          : "-"}
                      </span>
                      <span className="text-blue-400 dark:text-blue-500">
                        ~{Math.round(usage.avgResponseTime / 1000)}s avg
                      </span>
                    </div>
                  </div>
                ) : prompt.isActive ? (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      ยังไม่มีการใช้งานจาก Mobile (30 วันล่าสุด)
                    </span>
                  </div>
                ) : null}

                {prompt.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {prompt.description}
                  </p>
                )}

                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                    {prompt.prompt.slice(0, 300)}
                    {prompt.prompt.length > 300 ? "..." : ""}
                  </pre>
                </div>

                {prompt.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {prompt.variables.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-mono"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400">
                    by {prompt.createdByName || prompt.createdBy}
                    {prompt.createdAt &&
                      ` · ${format(prompt.createdAt, "d MMM yyyy", { locale: th })}`}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openTest(prompt)}
                        className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        title="ทดสอบ Prompt"
                      >
                        <FlaskConical className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewPrompt(prompt)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="ดู Prompt เต็ม"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(prompt)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          prompt.isActive
                            ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        }`}
                        title={prompt.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditor(prompt)}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(prompt)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditor(false);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingPrompt ? "แก้ไข Prompt" : "สร้าง Prompt ใหม่"}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ชื่อ Prompt *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. Barcode Counting v2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Model ID
                  </label>
                  <input
                    type="text"
                    value={formModelId}
                    onChange={(e) => setFormModelId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="gemini-2.0-flash"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Platform
                  </label>
                  <select
                    value={formPlatform}
                    onChange={(e) => setFormPlatform(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  คำอธิบาย
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="อธิบายว่า prompt นี้ใช้ทำอะไร"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Prompt Text *{" "}
                  <span className="text-xs text-gray-400">
                    (ใช้ {"{{variable}}"} สำหรับตัวแปร)
                  </span>
                </label>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                  placeholder={`You are a product counting assistant.\n\nCount the number of {{productName}} items visible in the image.\nProduct barcode: {{barcode}}\n\nRespond with JSON: {"count": number}`}
                />
                {formPrompt && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Array.from(
                      formPrompt.matchAll(/\{\{(\w+)\}\}/g),
                      (m) => m[1],
                    ).map((v, i) => (
                      <span
                        key={`${v}-${i}`}
                        className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs font-mono"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingPrompt ? "อัปเดต" : "สร้าง"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPrompt && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewPrompt(null);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {previewPrompt.name}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewPrompt.prompt);
                    toast.success("คัดลอกแล้ว");
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  title="คัดลอก"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPreviewPrompt(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                {previewPrompt.prompt}
              </pre>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Model:</span>{" "}
                  <span className="font-mono">{previewPrompt.modelId}</span>
                </div>
                <div>
                  <span className="text-gray-500">Version:</span>{" "}
                  <span className="font-bold">v{previewPrompt.version}</span>
                </div>
                <div>
                  <span className="text-gray-500">Platform:</span>{" "}
                  <span>{previewPrompt.platform}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Prompt Modal */}
      {testingPrompt && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTestingPrompt(null);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-orange-500" />
                  ทดสอบ Prompt
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {testingPrompt.name} · v{testingPrompt.version} ·{" "}
                  {testingPrompt.modelId}
                </p>
              </div>
              <button
                onClick={() => setTestingPrompt(null)}
                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Variables Input */}
              {testingPrompt.variables.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    ตัวแปร (Variables)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {testingPrompt.variables.map((v) => (
                      <div key={v}>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">
                          {`{{${v}}}`}
                        </label>
                        <input
                          type="text"
                          value={testVars[v] || ""}
                          onChange={(e) =>
                            setTestVars((prev) => ({
                              ...prev,
                              [v]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          placeholder={`ใส่ค่า ${v}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  รูปภาพทดสอบ *
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {testImagePreview ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={testImagePreview}
                          alt="Test"
                          className="max-h-36 max-w-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          <Eye className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">
                            คลิกเพื่อเลือกรูป
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            JPG, PNG, WebP
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Run Button */}
              <button
                onClick={handleTestPrompt}
                disabled={testRunning || !testImage}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl font-bold text-lg transition-colors"
              >
                {testRunning ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังส่งไป Gemini...
                  </>
                ) : (
                  <>
                    <FlaskConical className="w-5 h-5" />
                    ทดสอบ Prompt
                  </>
                )}
              </button>

              {/* Result */}
              {testResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      ผลลัพธ์
                    </h3>
                    {testResult.success ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Check className="w-3 h-3" /> สำเร็จ ·{" "}
                        {testResult.processingTime
                          ? `${(testResult.processingTime / 1000).toFixed(1)}s`
                          : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <X className="w-3 h-3" /> ผิดพลาด
                      </span>
                    )}
                  </div>

                  {/* Parsed JSON Response */}
                  {testResult.parsedResponse ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                        Parsed JSON:
                      </p>
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <pre className="text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap font-mono">
                          {JSON.stringify(testResult.parsedResponse, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}

                  {/* Quick summary for barcode results */}
                  {testResult.parsedResponse &&
                  typeof testResult.parsedResponse === "object" &&
                  Array.isArray(
                    (testResult.parsedResponse as Record<string, unknown>)
                      .detectedBarcodes,
                  ) ? (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-bold text-gray-900 dark:text-white">
                        สรุป:
                      </span>
                      <span>
                        นับได้{" "}
                        <strong className="text-lg text-orange-600">
                          {
                            (
                              (
                                testResult.parsedResponse as Record<
                                  string,
                                  unknown
                                >
                              ).detectedBarcodes as string[]
                            ).length
                          }
                        </strong>{" "}
                        บาร์โค้ด
                      </span>
                      <span>
                        Match:{" "}
                        <strong>
                          {(
                            testResult.parsedResponse as Record<string, unknown>
                          ).barcodeMatch
                            ? "✅ ตรงกัน"
                            : "❌ ไม่ตรง"}
                        </strong>
                      </span>
                    </div>
                  ) : null}

                  {/* Raw Response */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      Raw AI Response:
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                        {testResult.rawResponse ||
                          testResult.error ||
                          "No response"}
                      </pre>
                    </div>
                  </div>

                  {/* Prompt Text Used */}
                  {testResult.promptTextUsed && (
                    <details className="group">
                      <summary className="text-xs font-semibold text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700">
                        ดู Prompt ที่ส่งจริง (หลังแทนตัวแปร)
                      </summary>
                      <div className="mt-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-xs text-purple-800 dark:text-purple-200 whitespace-pre-wrap font-mono">
                          {testResult.promptTextUsed}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
