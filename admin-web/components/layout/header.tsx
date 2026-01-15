"use client";

import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { useThemeStore } from "@/stores/theme.store";
import { signOut } from "firebase/auth";
import { Bell, LogOut, Moon, Sun, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function Header() {
  const router = useRouter();
  const { userData, logout } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      logout();
      toast.success("ออกจากระบบสำเร็จ");
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("ออกจากระบบไม่สำเร็จ");
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 lg:px-6 transition-colors">
      <div className="hidden sm:block">
        <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
          ยินดีต้อนรับ, {userData?.name || "Admin"}
        </h2>
        <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">
          {userData?.email}
        </p>
      </div>

      {/* Mobile: Show only user name */}
      <div className="sm:hidden">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {userData?.name || "Admin"}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => {
            console.log("Toggle button clicked, current theme:", theme);
            toggleTheme();
          }}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title={
            theme === "light" ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"
          }
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        <button className="hidden sm:block p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {userData?.name?.[0] || "A"}
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {userData?.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {userData?.role}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push("/dashboard/profile");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" />
                โปรไฟล์
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
