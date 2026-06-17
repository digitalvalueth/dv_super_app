// Client-side helper that resolves a viewer's branch scope for the sales
// reports, doing the Firestore reads (manager → their supervisors' branches)
// and delegating the pure decision to `resolveScopedBranchIds`.
//
// Returns `null` for admin/super_admin (no restriction — see all), an array of
// branchIds for supervisor/manager, and `[]` for any other role (see none).
// Pages MUST keep null vs [] distinct so a non-elevated user never sees all.

import {
  collection,
  doc as fsDoc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  resolveScopedBranchIds,
  type ScopeUser,
  type SupervisorDoc,
} from "@/lib/reports/supervisor-scope";

export const ELEVATED_ROLES = [
  "supervisor",
  "manager",
  "admin",
  "super_admin",
];

export function isElevated(role: string | undefined): boolean {
  return !!role && ELEVATED_ROLES.includes(role);
}

export async function loadScopedBranchIds(
  userData: (ScopeUser & { uid?: string }) | null | undefined,
): Promise<string[] | null> {
  if (!userData) return [];

  const role = userData.role;
  if (role === "admin" || role === "super_admin") return null;
  if (role !== "supervisor" && role !== "manager") return [];

  let supervisorDocs: SupervisorDoc[] = [];
  if (role === "manager") {
    // Managers manage branches indirectly through their supervisors. Read
    // managedSupervisorIds from the live user doc as a fallback (the auth
    // store may not hydrate it), then fetch those supervisors' branches.
    let supervisorIds: string[] = userData.managedSupervisorIds || [];
    if (!supervisorIds.length && userData.uid) {
      try {
        const meSnap = await getDoc(fsDoc(db, "users", userData.uid));
        supervisorIds = (meSnap.data()?.managedSupervisorIds as string[]) || [];
      } catch {
        supervisorIds = [];
      }
    }
    supervisorIds = supervisorIds.slice(0, 30);
    if (supervisorIds.length > 0) {
      const snap = await getDocs(
        query(
          collection(db, "users"),
          where(documentId(), "in", supervisorIds),
        ),
      );
      supervisorDocs = snap.docs.map((d) => d.data() as SupervisorDoc);
    }
  }

  return resolveScopedBranchIds(userData, supervisorDocs);
}
