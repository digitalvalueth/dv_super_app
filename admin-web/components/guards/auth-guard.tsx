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
        console.log("AuthGuard: Redirecting to login (no user)");
        router.push("/login");
      } else if (userData === null) {
        // มี user แต่ยังไม่มี userData → รออีกสักครู่
        console.log("Waiting for userData...");
      } else if (userData.status === "pending") {
        // User ยังรออนุมัติ → ไปหน้า pending-approval
        console.log("AuthGuard: Redirecting to pending-approval");
        router.push("/pending-approval");
      } else if (
        userData.role !== "admin" &&
        userData.role !== "manager" &&
        userData.role !== "super_admin"
      ) {
        // มี userData แต่ role ไม่ใช่ admin/manager/super_admin → ไป unauthorized
        console.log(
          "AuthGuard: Redirecting to unauthorized, role:",
          userData.role,
        );
        router.push("/unauthorized");
      } else {
        // ผ่านทุกเงื่อนไข
        console.log("AuthGuard: Access granted, role:", userData.role);
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
    (userData.role !== "admin" &&
      userData.role !== "manager" &&
      userData.role !== "super_admin")
  ) {
    return null;
  }

  return <>{children}</>;
}
