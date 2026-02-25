"use client";

import { ModuleCard } from "@/components/module-card";
import { auth } from "@/lib/firebase";
import {
  canAccessModule,
  getAllCompanies,
  getCompanyEnabledModules,
  getModules,
  ModuleInfo,
} from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import { Company } from "@/types";
import { signOut } from "firebase/auth";
import {
  ArrowRight,
  Building2,
  LogOut,
  RefreshCw,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ModuleSelectorPage() {
  const router = useRouter();
  const {
    user,
    userData,
    loading,
    activeCompanyId,
    activeCompanyName,
    setActiveCompany,
    clearActiveCompany,
  } = useAuthStore();

  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);

  // For multi-company users: fetched company details
  const [userCompanies, setUserCompanies] = useState<
    (Company & { id: string })[]
  >([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const isSuperAdmin = userData?.role === "super_admin";
  const isCompanyAdmin = userData?.role === "admin";

  // Effective company context (active selection overrides default companyId)
  const effectiveCompanyId = activeCompanyId || userData?.companyId;
  const effectiveCompanyName = activeCompanyName || userData?.companyName || "";

  // Is this a user belonging to multiple companies?
  const companyIdsList = userData?.companyIds ?? [];
  const hasMultipleCompanies = companyIdsList.length > 1;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Super admin → redirect to /super-admin
  useEffect(() => {
    if (!loading && userData && isSuperAdmin) {
      router.replace("/super-admin");
    }
  }, [loading, userData, isSuperAdmin, router]);

  // Fetch company details for multi-company users (to show names in picker)
  useEffect(() => {
    if (!userData || isSuperAdmin || companyIdsList.length <= 1) return;

    setLoadingCompanies(true);
    getAllCompanies()
      .then((all) =>
        setUserCompanies(all.filter((c) => companyIdsList.includes(c.id))),
      )
      .catch(console.error)
      .finally(() => setLoadingCompanies(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(companyIdsList), isSuperAdmin]);

  // Load all active modules
  useEffect(() => {
    if (!user || !userData || isSuperAdmin) return;

    async function loadModules() {
      setLoadingModules(true);
      try {
        const mods = await getModules();
        setModules(mods.filter((m) => m.status === "active"));
      } catch (error) {
        console.error("Error loading modules:", error);
      } finally {
        setLoadingModules(false);
      }
    }

    loadModules();
  }, [user, userData, isSuperAdmin]);

  // Load company-enabled modules — re-runs when effective company changes
  useEffect(() => {
    if (!effectiveCompanyId) {
      setCompanyModules([]);
      return;
    }
    getCompanyEnabledModules(effectiveCompanyId).then(setCompanyModules);
  }, [effectiveCompanyId]);

  const handleLogout = async () => {
    clearActiveCompany();
    await signOut(auth);
    router.push("/login");
  };

  // ── Full-screen loading ──────────────────────────────────────────────────────
  if (loading || !user || !userData || isSuperAdmin) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ── Company Picker Step ──────────────────────────────────────────────────────
  // Shown when user belongs to multiple companies but hasn't chosen one yet
  if (hasMultipleCompanies && !activeCompanyId) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-950 to-gray-900 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <header className="relative z-10 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                F
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">
                  FITT BSA Platform
                </h1>
                <p className="text-gray-500 text-xs">
                  เลือกบริษัทที่ต้องการทำงาน
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors text-sm border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>

        {/* Picker body */}
        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                เลือกบริษัท
              </h2>
              <p className="text-gray-400 text-sm">
                คุณมีสิทธิ์เข้าถึงหลายบริษัท —
                เลือกบริษัทที่ต้องการทำงานในขณะนี้
              </p>
            </div>

            {loadingCompanies ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-white/5 animate-pulse border border-white/10"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {userCompanies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => setActiveCompany(company.id, company.name)}
                    className="w-full flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/40 transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0 group-hover:bg-blue-600/30 transition-colors">
                        <span className="text-blue-300 font-bold text-lg">
                          {company.name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          {company.name}
                        </p>
                        <p className="text-gray-400 text-sm">
                          รหัสบริษัท: {company.code}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}

                {/* Fallback if company fetch failed */}
                {userCompanies.length === 0 && userData.companyId && (
                  <button
                    onClick={() =>
                      setActiveCompany(
                        userData.companyId!,
                        userData.companyName || userData.companyId!,
                      )
                    }
                    className="w-full flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/40 transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <span className="text-blue-300 font-bold text-lg">
                          {(userData.companyName || userData.companyId)[0]}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">
                          {userData.companyName || userData.companyId}
                        </p>
                        {userData.companyCode && (
                          <p className="text-gray-400 text-sm">
                            รหัสบริษัท: {userData.companyCode}
                          </p>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-all" />
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="relative z-10 px-6 py-6">
          <p className="text-center text-gray-600 text-xs">
            © 2026 Digital Value Co., Ltd. — FITT BSA Platform
          </p>
        </footer>
      </div>
    );
  }

  // ── Normal Module Selector ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-950 to-gray-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              F
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">
                FITT BSA Platform
              </h1>
              <p className="text-gray-500 text-xs">{effectiveCompanyName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info */}
            <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 border border-white/10">
              {userData.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  {(userData.name || userData.email)?.[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-gray-300 text-sm truncate max-w-37.5">
                {userData.name || userData.email}
              </span>
              {isCompanyAdmin && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                  Admin
                </span>
              )}
            </div>

            {/* Switch Company — visible when user has multiple companies */}
            {hasMultipleCompanies && (
              <button
                onClick={clearActiveCompany}
                title="เปลี่ยนบริษัท"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm font-medium border border-purple-500/20"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">เปลี่ยนบริษัท</span>
              </button>
            )}

            {/* Company Admin — manage users in company */}
            {isCompanyAdmin && (
              <button
                onClick={() => router.push("/super-admin")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium border border-blue-500/20"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">จัดการสิทธิ์</span>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors text-sm border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-6 py-8 sm:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              เลือก Module ที่ต้องการ
            </h2>
            <p className="text-gray-400 text-base sm:text-lg">
              เข้าถึงเครื่องมือที่ได้รับอนุญาตจากระบบ
            </p>
          </div>

          {/* Module Grid */}
          {loadingModules ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-52 rounded-2xl bg-white/5 animate-pulse border border-white/10"
                />
              ))}
            </div>
          ) : modules.length === 0 ? (
            <div className="text-center bg-white/5 rounded-2xl p-12 border border-white/10">
              <p className="text-gray-400">ยังไม่มี Module ในระบบ</p>
              <p className="text-gray-500 text-sm mt-2">
                กรุณาติดต่อ Admin เพื่อเปิดใช้งาน
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {modules
                .filter((mod) =>
                  canAccessModule(
                    userData,
                    mod.id,
                    companyModules.length > 0 ? companyModules : undefined,
                  ),
                )
                .map((mod) => (
                  <ModuleCard key={mod.id} module={mod} accessible={true} />
                ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-6 mt-auto">
        <p className="text-center text-gray-600 text-xs">
          © 2026 Digital Value Co., Ltd. — FITT BSA Platform
        </p>
      </footer>
    </div>
  );
}
