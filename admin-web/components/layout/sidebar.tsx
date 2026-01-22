"use client";

import { useAuthStore } from "@/stores/auth.store";
import {
  BarChart3,
  Building2,
  ClipboardList,
  DollarSign,
  Factory,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  Shield,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "ผู้ใช้งาน", href: "/dashboard/users", icon: Users },
  {
    name: "บริษัท",
    href: "/dashboard/companies",
    icon: Factory,
    superAdminOnly: true, // เฉพาะ Super Admin
  },
  { name: "สาขา", href: "/dashboard/branches", icon: Building2 },
  {
    name: "Manager",
    href: "/dashboard/managers",
    icon: Shield,
    adminOnly: true, // เฉพาะ Admin และ Super Admin
  },
  { name: "สินค้า", href: "/dashboard/products", icon: Package },
  { name: "ข้อมูลการนับ", href: "/dashboard/counting", icon: ClipboardList },
  { name: "ค่าคอมมิชชั่น", href: "/dashboard/commission", icon: DollarSign },
  { name: "รายงาน", href: "/dashboard/reports", icon: BarChart3 },
  { name: "เชิญผู้ใช้", href: "/dashboard/invitations", icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { userData } = useAuthStore();

  // Check if user is super admin by role
  const isSuperAdmin = userData?.role === "super_admin";
  // Check if user is admin or super admin
  const isAdminOrAbove =
    userData?.role === "admin" || userData?.role === "super_admin";

  // Filter navigation based on user role
  const filteredNavigation = navigation.filter((item) => {
    if (item.superAdminOnly) {
      return isSuperAdmin;
    }
    if (item.adminOnly) {
      return isAdminOrAbove;
    }
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
          w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
          transition-transform duration-300 ease-in-out
          ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Super Fitt
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Admin Dashboard
            </p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavigation.map((item) => {
              // Check if the current path matches the navigation item
              // For nested routes like /dashboard/branches/[id], highlight the parent menu
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              © 2026 Digital Value Co., Ltd.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
