"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Mail,
  Package,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
  { name: "ผู้ใช้งาน", href: "/dashboard/users", icon: Users },
  { name: "สาขา", href: "/dashboard/branches", icon: Building2 },
  { name: "สินค้า", href: "/dashboard/products", icon: Package },
  { name: "ข้อมูลการนับ", href: "/dashboard/counting", icon: ClipboardList },
  { name: "รายงาน", href: "/dashboard/reports", icon: BarChart3 },
  { name: "เชิญผู้ใช้", href: "/dashboard/invitations", icon: Mail },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="h-full flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-blue-600">Super Fitt</h1>
          <p className="text-sm text-gray-600 mt-1">Admin Dashboard</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            © 2026 Digital Value Co., Ltd.
          </p>
        </div>
      </div>
    </aside>
  );
}
