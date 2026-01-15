"use client";

import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/stores/auth.store";
import { signOut } from "firebase/auth";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PendingApprovalPage() {
  const router = useRouter();
  const { userData, logout } = useAuthStore();

  // Auto-redirect if status changes to active or role is admin/manager
  useEffect(() => {
    if (userData) {
      if (userData.status === "active") {
        console.log("Status is active, redirecting to dashboard...");
        router.push("/dashboard");
      } else if (userData.role === "admin" || userData.role === "manager") {
        console.log("Role is admin/manager, redirecting to dashboard...");
        router.push("/dashboard");
      }
    }
  }, [userData, router]);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">รออนุมัติ</h1>
          <p className="text-gray-600">
            บัญชีของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">อีเมล:</span>
              <span className="font-semibold text-gray-900">
                {userData?.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ชื่อ:</span>
              <span className="font-semibold text-gray-900">
                {userData?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">สถานะ:</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                รออนุมัติ
              </span>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-6">
          <p>กรุณาติดต่อผู้ดูแลระบบเพื่อขออนุมัติการเข้าใช้งาน</p>
          <p className="mt-2">
            คุณจะได้รับอีเมลแจ้งเตือนเมื่อบัญชีได้รับการอนุมัติแล้ว
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-gray-600 text-white py-3 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
