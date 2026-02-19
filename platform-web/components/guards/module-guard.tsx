"use client";

import {
  canAccessModule,
  getCompanyEnabledModules,
} from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ModuleGuardProps {
  moduleId: string;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { user, userData, loading } = useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (checking) {
        toast.error("การตรวจสอบสิทธิ์ใช้เวลานานเกินไป กรุณาเข้าสู่ระบบใหม่");
        router.push("/login");
      }
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [checking, router]);

  useEffect(() => {
    if (loading || !user || !userData) return;

    if (hasAccess) return; // Already granted

    // Super admin has access to everything
    if (userData.role === "super_admin") {
      setHasAccess(true);
      setChecking(false);
      return;
    }

    async function checkAccess() {
      try {
        // Get company enabled modules
        const companyModules = userData!.companyId
          ? await getCompanyEnabledModules(userData!.companyId)
          : undefined;

        const allowed = canAccessModule(userData, moduleId, companyModules);

        if (!allowed) {
          toast.error("ไม่มีสิทธิ์เข้าถึง module นี้");
          router.push("/");
          return;
        }

        setHasAccess(true);
      } catch (error) {
        console.error("Error checking module access:", error);
        router.push("/");
      } finally {
        setChecking(false);
      }
    }

    checkAccess();
  }, [user, userData, loading, moduleId, router, hasAccess]);

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) return null;

  return <>{children}</>;
}
