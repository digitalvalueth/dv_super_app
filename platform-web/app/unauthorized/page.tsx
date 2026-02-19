"use client";

import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { signOut } from "firebase/auth";
import { Home, LogOut, ShieldX } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { userData, logout } = useAuthStore();

  const handleGoHome = () => {
    router.push("/");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-4 text-center">
        <div className="bg-white/[0.07] backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-10 h-10 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            ไม่มีสิทธิ์เข้าถึง
          </h1>
          <p className="text-blue-200/60 text-sm mb-1">
            คุณไม่มีสิทธิ์ในการเข้าใช้งานหน้านี้
          </p>
          <p className="text-blue-300/40 text-xs mb-6">
            กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าถึง
          </p>

          {/* Currently logged in as */}
          {userData && (
            <div className="bg-white/[0.05] border border-white/10 rounded-xl p-3 mb-6">
              <p className="text-xs text-blue-300/40 mb-1">เข้าสู่ระบบอยู่ในชื่อ</p>
              <p className="text-white text-sm font-medium">{userData.name}</p>
              <p className="text-blue-300/50 text-xs">{userData.email}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleGoHome}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/20 text-sm"
            >
              <Home className="w-4 h-4" />
              กลับหน้าเลือก Module
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.06] border border-white/10 text-red-400 py-3 rounded-xl text-sm font-medium hover:bg-red-500/10 hover:border-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
              ออกจากระบบ เข้าบัญชีอื่น
            </button>
          </div>
        </div>

        <p className="text-xs text-blue-300/20 mt-6">
          © 2026 Digital Value Co., Ltd. — FITT BSA Platform
        </p>
      </div>
    </div>
  );
}
