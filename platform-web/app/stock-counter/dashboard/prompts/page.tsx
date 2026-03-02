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
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  Check,
  Code,
  Copy,
  Edit3,
  Eye,
  Layers,
  Plus,
  Search,
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

export default function PromptsPage() {
  const { userData } = useAuthStore();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
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

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formModelId, setFormModelId] = useState("gemini-2.0-flash");
  const [formCategory, setFormCategory] = useState<string>("counting");
  const [formPlatform, setFormPlatform] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userData) return;
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

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
        // Deactivate all others in the same category+platform
        const sameCategory = prompts.filter(
          (p) =>
            p.id !== prompt.id &&
            p.category === prompt.category &&
            (p.platform === prompt.platform || p.platform === "all") &&
            p.isActive,
        );
        for (const p of sameCategory) {
          await updateDoc(doc(db, "promptTemplates", p.id), {
            isActive: false,
          });
        }
      }

      await updateDoc(doc(db, "promptTemplates", prompt.id), {
        isActive: !prompt.isActive,
        updatedAt: Timestamp.now(),
      });
      toast.success(
        prompt.isActive ? "ปิดใช้งาน Prompt" : "เปิดใช้งาน Prompt",
      );
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

  const canManage =
    userData &&
    ["super_admin", "admin"].includes(userData.role);

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
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            สร้าง Prompt ใหม่
          </button>
        )}
      </div>

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
            <p className="text-gray-500 dark:text-gray-400">ไม่พบ Prompt</p>
          </div>
        ) : (
          filteredPrompts.map((prompt) => {
            const catInfo = CATEGORIES.find((c) => c.value === prompt.category);
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
                        v{prompt.version} · {prompt.platform} ·{" "}
                        {prompt.modelId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {prompt.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <Zap className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                </div>

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
                        title={
                          prompt.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"
                        }
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
    </div>
  );
}
