"use client";

import { ModuleCard } from "@/components/module-card";
import { auth } from "@/lib/firebase";
import {
    canAccessModule,
    getCompanyEnabledModules,
    getModules,
    ModuleInfo,
} from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import { signOut } from "firebase/auth";
import { LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ModuleSelectorPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuthStore();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);

  const isSuperAdmin = userData?.role === "super_admin";
  const isCompanyAdmin = userData?.role === "admin";

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

  // Load modules
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

  // Load company enabled modules — re-runs when companyId changes (e.g. after whitelist auto-assign)
  useEffect(() => {
    if (!userData?.companyId) {
      setCompanyModules([]);
      return;
    }

    getCompanyEnabledModules(userData.companyId).then(setCompanyModules);
  }, [userData?.companyId]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Loading states
  if (loading || !user || !userData || isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto" />
          <p className="mt-4 text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
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
                {userData.companyName || ""}
              </p>
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
              <span className="text-gray-300 text-sm truncate max-w-[150px]">
                {userData.name || userData.email}
              </span>
              {isCompanyAdmin && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                  Admin
                </span>
              )}
            </div>

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
          {/* Title */}
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
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    accessible={true}
                  />
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
