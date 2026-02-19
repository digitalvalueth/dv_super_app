"use client";

import { ModuleGuard } from "@/components/guards/module-guard";
import { Header } from "@/components/layout/header";
import { StockCounterSidebar } from "@/components/layout/stock-counter-sidebar";
import { useAuthStore } from "@/stores/auth.store";
import { Smartphone } from "lucide-react";
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

export default function StockCounterDashboardLayout({ children }: { children: ReactNode }) {
  const { userData } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Block staff from accessing the web platform
  // Only check this after hydration to prevent SSG/SSR errors
  if (mounted && userData?.role === "staff") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-4 text-center">
        <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-xl border border-white/20 mb-8 shadow-2xl">
          <Smartphone className="w-16 h-16 text-blue-400 mx-auto" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">
          กรุณาใช้งานผ่าน Mobile App
        </h1>
        <p className="text-gray-300 max-w-md mb-8 text-lg">
          ระบบ Stock Counter สำหรับพนักงานถูกออกแบบมาให้ใช้งานบนแอปพลิเคชันมือถือเท่านั้น
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-white text-blue-900 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <ModuleGuard moduleId="stock-counter">
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden">
        <StockCounterSidebar />
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ModuleGuard>
  );
}

