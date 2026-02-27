"use client";

import React from "react";

import { auth } from "@/lib/firebase";
import {
  addUserToCompany,
  createCompany,
  createModule,
  deleteModule,
  getAllCompanies,
  getAllUsers,
  getCompanyUsers,
  getModules,
  getModuleWhitelist,
  ModuleInfo,
  seedInitialModules,
  setModuleWhitelist,
  updateCompanyEnabledModules,
  updateModule,
  updateUserModuleAccess,
  updateUserRole,
} from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import { Company, User } from "@/types";
import { signOut } from "firebase/auth";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  Layers,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type TabId = "modules" | "companies" | "users";

export default function SuperAdminPage() {
  const { userData } = useAuthStore();
  const router = useRouter();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [companies, setCompanies] = useState<(Company & { id: string })[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("modules");

  const isSuperAdmin = userData?.role === "super_admin";
  const isCompanyAdmin = userData?.role === "admin";

  useEffect(() => {
    if (userData && !isSuperAdmin && !isCompanyAdmin) {
      toast.error("ไม่มีสิทธิ์เข้าถึงหน้านี้");
      router.push("/");
    }
  }, [userData, isSuperAdmin, isCompanyAdmin, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const mods = await getModules();
      setModules(mods);

      if (isSuperAdmin) {
        const [comps, allUsers] = await Promise.all([
          getAllCompanies(),
          getAllUsers(),
        ]);
        setCompanies(comps);
        setUsers(allUsers);
      } else if (isCompanyAdmin && userData?.companyId) {
        const companyUsers = await getCompanyUsers(userData.companyId);
        setUsers(companyUsers);
        setActiveTab("users");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, isCompanyAdmin, userData?.companyId]);

  useEffect(() => {
    if (isSuperAdmin || isCompanyAdmin) loadData();
  }, [isSuperAdmin, isCompanyAdmin, loadData]);

  // ==================== Company Module Toggle ====================
  const handleToggleCompanyModule = async (
    companyId: string,
    currentModules: string[],
    moduleId: string,
  ) => {
    const newModules = currentModules.includes(moduleId)
      ? currentModules.filter((m) => m !== moduleId)
      : [...currentModules, moduleId];

    try {
      await updateCompanyEnabledModules(companyId, newModules);
      toast.success("อัปเดตสำเร็จ");
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  // ==================== User Module Toggle ====================
  const handleToggleUserModule = async (
    userId: string,
    currentModules: string[],
    moduleId: string,
  ) => {
    const newModules = currentModules.includes(moduleId)
      ? currentModules.filter((m) => m !== moduleId)
      : [...currentModules, moduleId];

    try {
      await updateUserModuleAccess(userId, newModules);
      toast.success("อัปเดตสำเร็จ");
      loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("อัปเดตไม่สำเร็จ");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!isSuperAdmin && !isCompanyAdmin) return null;

  const activeModules = modules.filter((m) => m.status === "active");
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] =
    isSuperAdmin
      ? [
          {
            id: "modules",
            label: "จัดการ Modules",
            icon: <Layers className="w-4 h-4" />,
          },
          {
            id: "companies",
            label: "บริษัท ↔ Modules",
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            id: "users",
            label: "ผู้ใช้ ↔ Modules",
            icon: <Users className="w-4 h-4" />,
          },
        ]
      : [
          {
            id: "users" as TabId,
            label: "ผู้ใช้ ↔ Modules",
            icon: <Users className="w-4 h-4" />,
          },
        ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!isSuperAdmin && (
              <Link
                href="/"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSuperAdmin ? "bg-amber-500" : "bg-blue-500"}`}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isSuperAdmin ? "Super Admin" : "Company Admin"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isSuperAdmin
                    ? "จัดการ Modules, บริษัท และสิทธิ์ผู้ใช้"
                    : `จัดการสิทธิ์ผู้ใช้ — ${userData?.companyName || ""}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              รีเฟรช
            </button>
            {isSuperAdmin && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-gray-500">กำลังโหลด...</span>
          </div>
        ) : (
          <>
            {activeTab === "modules" && isSuperAdmin && (
              <ModulesTab modules={modules} onRefresh={loadData} />
            )}

            {activeTab === "companies" && isSuperAdmin && (
              <CompaniesTab
                companies={companies}
                activeModules={activeModules}
                users={users}
                onToggle={handleToggleCompanyModule}
                onRefresh={loadData}
              />
            )}

            {activeTab === "users" && (
              <UsersTab
                users={users}
                modules={activeModules}
                companies={companies}
                isSuperAdmin={isSuperAdmin}
                onToggleModule={handleToggleUserModule}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ==================== Modules Tab ====================

function ModulesTab({
  modules,
  onRefresh,
}: {
  modules: ModuleInfo[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleInfo | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    icon: "📦",
    path: "",
    color: "#3B82F6",
    status: "active" as ModuleInfo["status"],
    order: 1,
  });

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      description: "",
      icon: "📦",
      path: "",
      color: "#3B82F6",
      status: "active",
      order: modules.length + 1,
    });
    setEditingModule(null);
    setShowForm(false);
  };

  const handleEdit = (mod: ModuleInfo) => {
    setForm({
      id: mod.id,
      name: mod.name,
      description: mod.description,
      icon: mod.icon,
      path: mod.path,
      color: mod.color,
      status: mod.status,
      order: mod.order,
    });
    setEditingModule(mod);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.id || !form.name || !form.path) {
      toast.error("กรุณากรอกข้อมูลให้ครบ (ID, ชื่อ, Path)");
      return;
    }

    try {
      if (editingModule) {
        await updateModule(editingModule.id, {
          name: form.name,
          description: form.description,
          icon: form.icon,
          path: form.path,
          color: form.color,
          status: form.status,
          order: form.order,
        });
        toast.success("อัปเดต module สำเร็จ");
      } else {
        await createModule(form as ModuleInfo);
        toast.success("สร้าง module สำเร็จ");
      }
      resetForm();
      onRefresh();
    } catch (error) {
      console.error("Error saving module:", error);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const handleDelete = async (mod: ModuleInfo) => {
    if (!confirm(`ยืนยันลบ module "${mod.name}"?`)) return;
    try {
      await deleteModule(mod.id);
      toast.success("ลบสำเร็จ");
      onRefresh();
    } catch (error) {
      console.error("Error:", error);
      toast.error("ลบไม่สำเร็จ");
    }
  };

  const handleSeed = async () => {
    try {
      await seedInitialModules();
      toast.success("Seed modules สำเร็จ");
      onRefresh();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Seed ไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          จัดการ Modules ({modules.length})
        </h2>
        <div className="flex gap-2">
          {modules.length === 0 && (
            <button
              onClick={handleSeed}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Seed ค่าเริ่มต้น
            </button>
          )}
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            เพิ่ม Module
          </button>
        </div>
      </div>

      {/* Module Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {editingModule
                ? `แก้ไข: ${editingModule.name}`
                : "สร้าง Module ใหม่"}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Module ID *
              </label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                disabled={!!editingModule}
                placeholder="stock-counter"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ชื่อ Module *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Stock Counter"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Path *
              </label>
              <input
                type="text"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="/stock-counter"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                คำอธิบาย
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="โปรแกรมนับ Stock สินค้า"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                สี
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  สถานะ
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as ModuleInfo["status"],
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="active">เปิดใช้งาน</option>
                  <option value="coming_soon">เร็วๆ นี้</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ลำดับ
                </label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm({ ...form, order: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              {editingModule ? "อัปเดต" : "สร้าง"}
            </button>
          </div>
        </div>
      )}

      {/* Module List */}
      <div className="grid gap-4">
        {modules.map((mod) => (
          <div
            key={mod.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ backgroundColor: mod.color + "20" }}
            >
              {mod.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {mod.name}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    mod.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : mod.status === "coming_soon"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {mod.status === "active"
                    ? "เปิดใช้งาน"
                    : mod.status === "coming_soon"
                      ? "เร็วๆ นี้"
                      : "ปิดใช้งาน"}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {mod.description}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                ID: {mod.id} · Path: {mod.path} · Order: {mod.order}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {mod.status === "active" && (
                <Link
                  href={mod.path}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  เข้าใช้งาน
                </Link>
              )}
              <button
                onClick={() => handleEdit(mod)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="แก้ไข"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(mod)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="ลบ"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {modules.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            ยังไม่มี Module ในระบบ — กด &quot;Seed ค่าเริ่มต้น&quot; หรือ
            &quot;เพิ่ม Module&quot;
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Companies Tab ====================

function CompaniesTab({
  companies,
  activeModules,
  users,
  onToggle,
  onRefresh,
}: {
  companies: (Company & { id: string })[];
  activeModules: ModuleInfo[];
  users: (User & { id: string })[];
  onToggle: (
    companyId: string,
    currentModules: string[],
    moduleId: string,
  ) => void;
  onRefresh: () => void;
}) {
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [whitelists, setWhitelists] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [emailInputs, setEmailInputs] = useState<Record<string, string>>({});
  const [loadingWhitelist, setLoadingWhitelist] = useState<string | null>(null);
  // User picker state: key = "companyId_moduleId"
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  // Add company state
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", code: "" });
  const [addingCompany, setAddingCompany] = useState(false);

  // Load whitelist when expanding a company
  const handleExpand = async (companyId: string) => {
    if (expandedCompany === companyId) {
      setExpandedCompany(null);
      return;
    }
    setExpandedCompany(companyId);
    setLoadingWhitelist(companyId);
    try {
      const wl = await getModuleWhitelist(companyId);
      setWhitelists((prev) => ({ ...prev, [companyId]: wl }));
    } catch (err) {
      console.error("Error loading whitelist:", err);
    } finally {
      setLoadingWhitelist(null);
    }
  };

  // Parse pasted/typed text into emails
  const handleAddEmails = (companyId: string, moduleId: string) => {
    const key = `${companyId}_${moduleId}`;
    const raw = emailInputs[key] || "";
    const newEmails = raw
      .split(/[\s,;]+/)
      .map((e) => e.toLowerCase().trim())
      .filter((e) => e.includes("@") && e.length > 3);

    if (newEmails.length === 0) return;

    const existing = whitelists[companyId]?.[moduleId] || [];
    const merged = [...new Set([...existing, ...newEmails])];

    setWhitelists((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [moduleId]: merged },
    }));
    setEmailInputs((prev) => ({ ...prev, [key]: "" }));
  };

  // Remove single email tag
  const handleRemoveEmail = (
    companyId: string,
    moduleId: string,
    email: string,
  ) => {
    const current = whitelists[companyId]?.[moduleId] || [];
    const updated = current.filter((e) => e !== email);
    setWhitelists((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [moduleId]: updated },
    }));
  };

  // Save whitelist to Firestore
  const handleSaveWhitelist = async (companyId: string, moduleId: string) => {
    const emails = whitelists[companyId]?.[moduleId] || [];
    try {
      await setModuleWhitelist(companyId, moduleId, emails);
      toast.success(
        `บันทึก whitelist ${moduleId} สำเร็จ (${emails.length} emails)`,
      );
    } catch (err) {
      console.error("Error:", err);
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  // Handle Enter key in email input
  const handleKeyDown = (
    e: React.KeyboardEvent,
    companyId: string,
    moduleId: string,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmails(companyId, moduleId);
    }
  };

  // Open user picker for a module
  const openPicker = (companyId: string, moduleId: string) => {
    const key = `${companyId}_${moduleId}`;
    // Pre-select: emails already in whitelist UNION emails of users in this company
    const alreadyInWhitelist = whitelists[companyId]?.[moduleId] || [];
    const companyMemberEmails = users
      .filter((u) => u.companyId === companyId && u.email)
      .map((u) => u.email as string);
    const preSelected = new Set([
      ...alreadyInWhitelist,
      ...companyMemberEmails,
    ]);
    setPickerSelected(preSelected);
    setPickerSearch("");
    setPickerOpen(key);
  };

  // Confirm user picker selection → add to whitelist + update companyIds for matched users
  const confirmPicker = (companyId: string, moduleId: string) => {
    const existing = whitelists[companyId]?.[moduleId] || [];
    const merged = [...new Set([...existing, ...Array.from(pickerSelected)])];
    setWhitelists((prev) => ({
      ...prev,
      [companyId]: { ...prev[companyId], [moduleId]: merged },
    }));

    // For newly added emails → add companyId to their companyIds in Firestore
    const existingSet = new Set(existing);
    const newlyAdded = Array.from(pickerSelected).filter(
      (email) => !existingSet.has(email),
    );
    if (newlyAdded.length > 0) {
      const emailToUser = new Map(
        users.filter((u) => u.email).map((u) => [u.email as string, u]),
      );
      newlyAdded.forEach((email) => {
        const matchedUser = emailToUser.get(email);
        if (matchedUser?.id) {
          addUserToCompany(matchedUser.id, companyId).catch((e) =>
            console.error("addUserToCompany error:", e),
          );
        }
      });
    }

    setPickerOpen(null);
    setPickerSelected(new Set());
  };

  // Add company handler
  const handleAddCompany = async () => {
    if (!addForm.name.trim() || !addForm.code.trim()) {
      toast.error("กรุณากรอกชื่อบริษัทและ Code");
      return;
    }
    setAddingCompany(true);
    try {
      await createCompany({
        name: addForm.name.trim(),
        code: addForm.code.trim(),
      });
      toast.success(`สร้างบริษัท "${addForm.name}" สำเร็จ`);
      setAddForm({ name: "", code: "" });
      setShowAddCompany(false);
      onRefresh();
    } catch (err) {
      console.error("Error:", err);
      toast.error("สร้างบริษัทไม่สำเร็จ");
    } finally {
      setAddingCompany(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          จัดการ Module ตามบริษัท ({companies.length})
        </h2>
        <button
          onClick={() => setShowAddCompany((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          เพิ่มบริษัท
        </button>
      </div>

      {/* Add company inline form */}
      {showAddCompany && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              เพิ่มบริษัทใหม่
            </h3>
            <button
              onClick={() => setShowAddCompany(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-45">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                ชื่อบริษัท *
              </label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="FITT Corporation"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div className="w-36">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Code *
              </label>
              <input
                type="text"
                value={addForm.code}
                onChange={(e) =>
                  setAddForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="FITT"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleAddCompany}
                disabled={addingCompany}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {addingCompany ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                บันทึก
              </button>
              <button
                onClick={() => {
                  setShowAddCompany(false);
                  setAddForm({ name: "", code: "" });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">
                  บริษัท
                </th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">
                  Code
                </th>
                {activeModules.map((mod) => (
                  <th
                    key={mod.id}
                    className="text-center px-4 py-3 font-medium text-gray-500"
                  >
                    {mod.icon} {mod.name}
                  </th>
                ))}
                <th className="text-center px-4 py-3 font-medium text-gray-500">
                  Whitelist
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const enabled = company.enabledModules || [];
                const isExpanded = expandedCompany === company.id;
                return (
                  <React.Fragment key={company.id}>
                    <tr className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">
                        {company.name}
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {company.code}
                      </td>
                      {activeModules.map((mod) => {
                        const isEnabled = enabled.includes(mod.id);
                        return (
                          <td key={mod.id} className="text-center px-4 py-3">
                            <button
                              onClick={() =>
                                onToggle(company.id, enabled, mod.id)
                              }
                              className={`w-8 h-8 rounded-lg inline-flex items-center justify-center text-lg transition-all ${
                                isEnabled
                                  ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200"
                                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 opacity-40"
                              }`}
                            >
                              {isEnabled ? "✅" : "⬜"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center px-4 py-3">
                        <button
                          onClick={() => handleExpand(company.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isExpanded
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200"
                          }`}
                        >
                          {isExpanded ? "ซ่อน" : "จัดการ"}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded whitelist editor */}
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={3 + activeModules.length}
                          className="px-6 py-4 bg-blue-50/50 dark:bg-blue-950/20"
                        >
                          {loadingWhitelist === company.id ? (
                            <div className="text-center py-4 text-gray-400">
                              กำลังโหลด whitelist...
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                📧 Email Whitelist — {company.name}
                              </h4>
                              <p className="text-xs text-gray-500">
                                วาง email ที่ต้องการให้สิทธิ์ (คั่นด้วย
                                เว้นวรรค, comma, หรือ Enter) → เมื่อ user login
                                ด้วย email นี้ จะได้สิทธิ์อัตโนมัติ
                              </p>

                              {activeModules
                                .filter((m) => enabled.includes(m.id))
                                .map((mod) => {
                                  const key = `${company.id}_${mod.id}`;
                                  const emails =
                                    whitelists[company.id]?.[mod.id] || [];
                                  const isPickerOpen = pickerOpen === key;
                                  // Show ALL users from the system (not just this company)
                                  const filteredForPicker = users.filter(
                                    (u) => {
                                      const q = pickerSearch.toLowerCase();
                                      return (
                                        !q ||
                                        (u.email || "")
                                          .toLowerCase()
                                          .includes(q) ||
                                        (u.name || u.displayName || "")
                                          .toLowerCase()
                                          .includes(q) ||
                                        (u.companyName || "")
                                          .toLowerCase()
                                          .includes(q)
                                      );
                                    },
                                  );
                                  return (
                                    <div
                                      key={mod.id}
                                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                          {mod.icon} {mod.name}
                                          <span className="ml-2 text-xs text-gray-400">
                                            ({emails.length} emails)
                                          </span>
                                        </span>
                                        <button
                                          onClick={() =>
                                            handleSaveWhitelist(
                                              company.id,
                                              mod.id,
                                            )
                                          }
                                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                          <Save className="w-3 h-3" />
                                          บันทึก
                                        </button>
                                      </div>

                                      {/* Email tags */}
                                      <div className="flex flex-wrap gap-1.5 mb-3 min-h-8">
                                        {emails.map((email) => (
                                          <span
                                            key={email}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium group"
                                          >
                                            {email}
                                            <button
                                              onClick={() =>
                                                handleRemoveEmail(
                                                  company.id,
                                                  mod.id,
                                                  email,
                                                )
                                              }
                                              className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors"
                                            >
                                              <X className="w-2.5 h-2.5" />
                                            </button>
                                          </span>
                                        ))}
                                        {emails.length === 0 && (
                                          <span className="text-xs text-gray-400 italic">
                                            ยังไม่มี email — วาง email ด้านล่าง
                                            หรือกด + เลือก user
                                          </span>
                                        )}
                                      </div>

                                      {/* Email input + user picker button */}
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={emailInputs[key] || ""}
                                          onChange={(e) =>
                                            setEmailInputs((prev) => ({
                                              ...prev,
                                              [key]: e.target.value,
                                            }))
                                          }
                                          onKeyDown={(e) =>
                                            handleKeyDown(e, company.id, mod.id)
                                          }
                                          placeholder="วาง email ที่นี่... (เช่น user1@gmail.com, user2@gmail.com)"
                                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400"
                                        />
                                        <button
                                          onClick={() =>
                                            handleAddEmails(company.id, mod.id)
                                          }
                                          className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                        >
                                          เพิ่ม
                                        </button>
                                        {/* User picker button */}
                                        {users.length > 0 && (
                                          <button
                                            onClick={() =>
                                              openPicker(company.id, mod.id)
                                            }
                                            title="เลือก user จากระบบ"
                                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                          >
                                            <UserPlus className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>

                                      {/* User picker dropdown */}
                                      {isPickerOpen && (
                                        <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden shadow-lg bg-white dark:bg-gray-800">
                                          <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                            <input
                                              autoFocus
                                              type="text"
                                              value={pickerSearch}
                                              onChange={(e) =>
                                                setPickerSearch(e.target.value)
                                              }
                                              placeholder="ค้นหาชื่อ, email หรือบริษัท..."
                                              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            />
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                              {pickerSelected.size} เลือก
                                            </span>
                                          </div>
                                          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-48 overflow-y-auto">
                                            {filteredForPicker.length === 0 ? (
                                              <p className="px-4 py-3 text-sm text-gray-400 text-center">
                                                ไม่พบ user ที่ตรงกัน
                                              </p>
                                            ) : (
                                              filteredForPicker.map((u) => {
                                                const email = u.email || "";
                                                const checked =
                                                  pickerSelected.has(email);
                                                return (
                                                  <button
                                                    key={u.id}
                                                    onClick={() => {
                                                      setPickerSelected(
                                                        (prev) => {
                                                          const next = new Set(
                                                            prev,
                                                          );
                                                          if (next.has(email))
                                                            next.delete(email);
                                                          else next.add(email);
                                                          return next;
                                                        },
                                                      );
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                                                  >
                                                    <div
                                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-gray-500"}`}
                                                    >
                                                      {checked && (
                                                        <Check className="w-3 h-3 text-white" />
                                                      )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                                          {u.name ||
                                                            u.displayName ||
                                                            email}
                                                        </p>
                                                        {u.companyId ===
                                                        company.id ? (
                                                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                                                            บริษัทนี้
                                                          </span>
                                                        ) : u.companyName ? (
                                                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 shrink-0">
                                                            {u.companyName}
                                                          </span>
                                                        ) : (
                                                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                                                            ยังไม่มีบริษัท
                                                          </span>
                                                        )}
                                                      </div>
                                                      <p className="text-xs text-gray-400 truncate">
                                                        {email}
                                                      </p>
                                                    </div>
                                                  </button>
                                                );
                                              })
                                            )}
                                          </div>
                                          <div className="flex gap-2 p-3 border-t border-gray-100 dark:border-gray-700">
                                            <button
                                              onClick={() =>
                                                confirmPicker(
                                                  company.id,
                                                  mod.id,
                                                )
                                              }
                                              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                              <Check className="w-4 h-4" />
                                              เพิ่ม {pickerSelected.size} user
                                            </button>
                                            <button
                                              onClick={() => {
                                                setPickerOpen(null);
                                                setPickerSelected(new Set());
                                              }}
                                              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                            >
                                              ยกเลิก
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                              {activeModules.filter((m) =>
                                enabled.includes(m.id),
                              ).length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">
                                  เปิดใช้ module ก่อนจึงจะจัดการ whitelist ได้
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {companies.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + activeModules.length}
                    className="text-center py-12 text-gray-400"
                  >
                    ไม่พบข้อมูลบริษัท
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== Users Tab ====================

function UsersTab({
  users,
  modules,
  companies,
  isSuperAdmin,
  onToggleModule,
}: {
  users: (User & { id: string })[];
  modules: ModuleInfo[];
  companies: (Company & { id: string })[];
  isSuperAdmin: boolean;
  onToggleModule: (
    userId: string,
    currentModules: string[],
    moduleId: string,
  ) => void;
}) {
  const [filterCompanyId, setFilterCompanyId] = useState<string>("");
  const [localUsers, setLocalUsers] = useState(users);

  // Sync when parent reloads
  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    // Optimistic update
    setLocalUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, role: newRole as User["role"] } : u,
      ),
    );
    try {
      await updateUserRole(userId, newRole);
      toast.success("เปลี่ยน Role สำเร็จ");
    } catch (err) {
      console.error("Error:", err);
      toast.error("เปลี่ยน Role ไม่สำเร็จ");
      // Revert
      setLocalUsers(users);
    }
  };

  const filteredUsers = filterCompanyId
    ? localUsers.filter((u) => u.companyId === filterCompanyId)
    : localUsers;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const p: Record<string, number> = {
      super_admin: 0,
      admin: 1,
      manager: 2,
      supervisor: 3,
      employee: 4,
      staff: 5,
    };
    return (p[a.role] || 99) - (p[b.role] || 99);
  });

  const companyModulesMap = new Map<string, string[]>();
  companies.forEach((c) => companyModulesMap.set(c.id, c.enabledModules || []));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          จัดการ Module ตามผู้ใช้
        </h2>
        <div className="flex items-center gap-3">
          {isSuperAdmin && companies.length > 0 && (
            <div className="relative">
              <select
                value={filterCompanyId}
                onChange={(e) => setFilterCompanyId(e.target.value)}
                className="appearance-none pl-4 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">ทุกบริษัท ({localUsers.length})</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (
                    {localUsers.filter((u) => u.companyId === c.id).length})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          <p className="text-sm text-gray-500">{sortedUsers.length} ผู้ใช้</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">
                  ผู้ใช้
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Role
                </th>
                {isSuperAdmin && (
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    บริษัท
                  </th>
                )}
                {modules.map((mod) => (
                  <th
                    key={mod.id}
                    className="text-center px-4 py-3 font-medium text-gray-500"
                  >
                    {mod.icon} {mod.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => {
                const userModules = user.moduleAccess || [];
                const companyEnabled =
                  companyModulesMap.get(user.companyId || "") || [];

                return (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.name || user.displayName || "—"}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {user.role === "super_admin" ? (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          super_admin
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          className={`text-xs font-medium px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                            user.role === "admin"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700"
                              : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                          }`}
                        >
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="supervisor">supervisor</option>
                          <option value="employee">employee</option>
                          <option value="staff">staff</option>
                        </select>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {user.companyName || "—"}
                      </td>
                    )}
                    {modules.map((mod) => {
                      if (user.role === "super_admin") {
                        return (
                          <td
                            key={mod.id}
                            className="text-center px-4 py-3"
                            title="Super Admin"
                          >
                            <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-lg bg-amber-100 dark:bg-amber-900/30">
                              ⭐
                            </span>
                          </td>
                        );
                      }

                      const hasAccess = userModules.includes(mod.id);
                      const companyHasModule = companyEnabled.includes(mod.id);

                      return (
                        <td key={mod.id} className="text-center px-4 py-3">
                          <button
                            onClick={() =>
                              onToggleModule(user.id, userModules, mod.id)
                            }
                            disabled={!companyHasModule && !isSuperAdmin}
                            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center text-lg transition-all ${
                              !companyHasModule
                                ? "bg-red-50 dark:bg-red-900/10 opacity-30 cursor-not-allowed"
                                : hasAccess
                                  ? "bg-green-100 dark:bg-green-900/30 hover:bg-green-200"
                                  : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 opacity-40"
                            }`}
                            title={
                              !companyHasModule
                                ? "บริษัทไม่ได้เปิดใช้ module นี้"
                                : hasAccess
                                  ? `ลบสิทธิ์ ${mod.name}`
                                  : `เพิ่มสิทธิ์ ${mod.name}`
                            }
                          >
                            {!companyHasModule ? "🚫" : hasAccess ? "✅" : "⬜"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {sortedUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + modules.length + (isSuperAdmin ? 1 : 0)}
                    className="text-center py-12 text-gray-400"
                  >
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span>✅ มีสิทธิ์</span>
        <span>⬜ ไม่มีสิทธิ์ (คลิกเพิ่ม)</span>
        <span>🚫 บริษัทไม่ได้เปิด module</span>
        <span>⭐ Super Admin</span>
      </div>
    </div>
  );
}
