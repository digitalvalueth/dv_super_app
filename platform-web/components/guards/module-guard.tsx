"use client";

import { db } from "@/lib/firebase";
import {
  canAccessModule,
  getCompanyEnabledModules,
} from "@/lib/module-service";
import { useAuthStore } from "@/stores/auth.store";
import { User } from "@/types";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface ModuleGuardProps {
  moduleId: string;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { user, userData, loading, activeCompanyId, setUserData } =
    useAuthStore();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const buildFreshUserData = useCallback(
    (id: string, data: Record<string, any>): User & { id: string } =>
      ({
        id,
        uid: data.uid || user?.uid || id,
        ...data,
      }) as User & { id: string },
    [user?.uid],
  );

  const getFreshUserCandidates = useCallback(async () => {
    if (!user) return [];

    const candidates: (User & { id: string })[] = [];
    const seen = new Set<string>();

    const addCandidate = (id: string, data: Record<string, any>) => {
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push(buildFreshUserData(id, data));
    };

    const uidSnap = await getDoc(doc(db, "users", user.uid));
    if (uidSnap.exists()) {
      addCandidate(uidSnap.id, uidSnap.data());
    }

    if (user.email) {
      const emailSnap = await getDocs(
        query(collection(db, "users"), where("email", "==", user.email)),
      );
      emailSnap.forEach((snap) => addCandidate(snap.id, snap.data()));
    }

    return candidates;
  }, [buildFreshUserData, user]);

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
        const effectiveCompanyId = activeCompanyId || userData!.companyId;
        const companyModulesResult = effectiveCompanyId
          ? await getCompanyEnabledModules(effectiveCompanyId)
          : [];

        // If company has no modules configured, skip company-level check (same as home page)
        const companyModulesArg =
          companyModulesResult.length > 0 ? companyModulesResult : undefined;

        const freshCandidates = await getFreshUserCandidates();
        const accessCandidates = [
          ...freshCandidates,
          userData as User & { id: string },
        ];
        const allowedUser = accessCandidates.find((candidate) =>
          canAccessModule(candidate, moduleId, companyModulesArg),
        );

        const allowed = Boolean(allowedUser);

        if (!allowed) {
          toast.error("ไม่มีสิทธิ์เข้าถึง module นี้");
          router.push("/");
          return;
        }

        if (allowedUser && allowedUser !== userData) {
          setUserData(allowedUser);
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
  }, [
    user,
    userData,
    loading,
    moduleId,
    router,
    hasAccess,
    activeCompanyId,
    setUserData,
    getFreshUserCandidates,
  ]);

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
