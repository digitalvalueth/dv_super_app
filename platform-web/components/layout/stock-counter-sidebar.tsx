"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useSidebarStore } from "@/stores/sidebar.store";
import {
    BarChart3,
    Building2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    DollarSign,
    Factory,
    Home,
    LayoutDashboard,
    Mail,
    Menu,
    Package,
    Shield,
    Truck,
    Users,
    X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { name: "แดชบอร์ด", href: "/stock-counter/dashboard", icon: LayoutDashboard },
  {
    name: "Supervisor Dashboard",
    href: "/stock-counter/dashboard/supervisor",
    icon: Shield,
    supervisorOnly: true,
  },
  {
    name: "ผู้ใช้งาน",
    href: "/stock-counter/dashboard/users",
    icon: Users,
    hideForSupervisor: true,
  },
  {
    name: "บริษัท",
    href: "/stock-counter/dashboard/companies",
    icon: Factory,
    superAdminOnly: true,
  },
  {
    name: "สาขา",
    href: "/stock-counter/dashboard/branches",
    icon: Building2,
    hideForSupervisor: true,
  },
  {
    name: "Manager",
    href: "/stock-counter/dashboard/managers",
    icon: Shield,
    adminOnly: true,
  },
  { name: "สินค้า", href: "/stock-counter/dashboard/products", icon: Package },
  { name: "ข้อมูลการนับ", href: "/stock-counter/dashboard/counting", icon: ClipboardList },
  { name: "เช็คชื่อพนักงาน", href: "/stock-counter/dashboard/attendance", icon: Clock },
  { name: "รับสินค้า", href: "/stock-counter/dashboard/delivery", icon: Truck },
  {
    name: "ค่าคอมมิชชั่น",
    href: "/stock-counter/dashboard/commission",
    icon: DollarSign,
    hideForSupervisor: true,
  },
  { name: "รายงาน", href: "/stock-counter/dashboard/reports", icon: BarChart3 },
  {
    name: "เชิญผู้ใช้",
    href: "/stock-counter/dashboard/invitations",
    icon: Mail,
    hideForSupervisor: true,
  },
];

export function StockCounterSidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { userData } = useAuthStore();
  const { collapsed, toggleSidebar } = useSidebarStore();

  const isSuperAdmin = userData?.role === "super_admin";
  const isAdminOrAbove =
    userData?.role === "admin" || userData?.role === "super_admin";
  const isSupervisor = userData?.role === "supervisor";

  const filteredNavigation = navigation.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdminOrAbove;
    if (item.supervisorOnly) return isSupervisor;
    if (item.hideForSupervisor && isSupervisor) return false;
    return true;
  });

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        ) : (
          <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          ${collapsed ? "w-[72px]" : "w-64"} 
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
          transition-all duration-300 ease-in-out
          ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className={`border-b border-gray-200 dark:border-gray-700 ${collapsed ? "p-3" : "p-6"}`}>
            {collapsed ? (
              <div className="flex items-center justify-center">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">SC</span>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  Stock Counter
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Admin Dashboard
                </p>
              </>
            )}
          </div>

          <nav className={`flex-1 ${collapsed ? "p-2" : "p-4"} space-y-1 overflow-y-auto`}>
            {/* Back to Platform */}
            <Link
              href="/"
              className={`flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-4"} py-3 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 mb-2 border border-dashed border-gray-300 dark:border-gray-600`}
              title={collapsed ? "กลับหน้าเลือก Module" : undefined}
            >
              <Home className="w-5 h-5 shrink-0" />
              {!collapsed && "กลับหน้าเลือก Module"}
            </Link>

            {filteredNavigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/stock-counter/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  title={collapsed ? item.name : undefined}
                  className={`
                    flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-4"} py-3 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }
                  `}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!collapsed && item.name}
                </Link>
              );
            })}
          </nav>

          {/* Collapse toggle + footer */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title={collapsed ? "ขยาย" : "หุบ"}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-xs">หุบเมนู</span>
                </>
              )}
            </button>
            {!collapsed && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center pb-3">
                © 2026 Digital Value Co., Ltd.
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
