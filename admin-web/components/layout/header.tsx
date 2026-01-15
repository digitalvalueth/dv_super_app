"use client";

import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { signOut } from "firebase/auth";
import { Bell, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function Header() {
  const router = useRouter();
  const { userData, logout } = useAuthStore();
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
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          ยินดีต้อนรับ, {userData?.name || "Admin"}
        </h2>
        <p className="text-sm text-gray-600">{userData?.email}</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
              {userData?.name?.[0] || "A"}
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">
                  {userData?.name}
                </p>
                <p className="text-xs text-gray-600">{userData?.role}</p>
              </div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  router.push("/dashboard/profile");
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                โปรไฟล์
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
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
