"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    console.log("AuthGuard:", { user: !!user, userData, loading });

    if (!loading) {
      if (!user) {
        // ไม่มี user → ไป login
        router.push("/login");
      } else if (userData === null) {
        // มี user แต่ยังไม่มี userData → รออีกสักครู่
        console.log("Waiting for userData...");
      } else if (userData.status === "pending") {
        // User ยังรออนุมัติ → ไปหน้า pending-approval
        router.push("/pending-approval");
      } else if (userData.role !== "admin" && userData.role !== "manager") {
        // มี userData แต่ role ไม่ใช่ admin/manager → ไป unauthorized
        router.push("/unauthorized");
      }
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ถ้ามี user แต่ยังไม่มี userData → แสดง loading
  if (user && userData === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลดข้อมูลผู้ใช้...</p>
        </div>
      </div>
    );
  }

  if (
    !user ||
    !userData ||
    (userData.role !== "admin" && userData.role !== "manager")
  ) {
    return null;
  }

  return <>{children}</>;
}
