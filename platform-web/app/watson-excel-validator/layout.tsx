"use client";

import { ModuleGuard } from "@/components/guards/module-guard";
import { Header } from "@/components/layout/header";
import { WatsonSidebar } from "@/components/layout/watson-sidebar";
import { ReactNode } from "react";

export default function WatsonLayout({ children }: { children: ReactNode }) {
  return (
    <ModuleGuard moduleId="watson-excel-validator">
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-hidden">
        <WatsonSidebar />
        <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </ModuleGuard>
  );
}

