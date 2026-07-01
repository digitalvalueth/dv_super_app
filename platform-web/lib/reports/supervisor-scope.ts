// Pure team/branch-scope resolution for the supervisor team sales report.
// No next/react/firebase imports — the Firestore `getDocs` for the manager's
// supervisors stays in the page, which passes the already-fetched supervisor
// docs in here as `fetchedSupervisorDocs`.

export interface ScopeUser {
  role: string;
  branchId?: string;
  managedBranchIds?: string[];
  managedSupervisorIds?: string[];
  uid?: string;
}

/** Minimal shape of a fetched supervisor user doc (only field we read). */
export interface SupervisorDoc {
  managedBranchIds?: string[];
}

/**
 * Resolve the branch scope for a user viewing the team sales report.
 *
 * - admin / super_admin → `null` (no branch restriction; see all).
 * - supervisor → own `managedBranchIds`, falling back to `[branchId]` when
 *   empty, or `[]` when neither is set.
 * - manager → union of own managed branches (same fallback as supervisor)
 *   plus every `managedBranchIds` entry from the fetched supervisor docs.
 * - any other role (e.g. employee/staff) → `[]` (no branches; NOT all).
 *
 * Returning `null` means "all branches"; returning `[]` means "no branches".
 * Pages must keep these distinct so an unscoped non-elevated user never sees
 * everything.
 *
 * `fetchedSupervisorDocs` is only consulted for the manager role; the page is
 * responsible for fetching it (Firestore) and passing it in.
 */
export function resolveScopedBranchIds(
  user: ScopeUser | null | undefined,
  fetchedSupervisorDocs: SupervisorDoc[] = [],
): string[] | null {
  if (!user) return [];

  const role = user.role;
  if (role === "admin" || role === "super_admin") {
    return null;
  }

  if (role !== "supervisor" && role !== "manager") {
    return [];
  }

  const ownManaged = user.managedBranchIds?.length
    ? [...user.managedBranchIds]
    : user.branchId
      ? [user.branchId]
      : [];
  const branchSet = new Set<string>(ownManaged);

  if (role === "manager") {
    for (const sup of fetchedSupervisorDocs) {
      (sup.managedBranchIds || []).forEach((id) => branchSet.add(id));
    }
  }

  return [...branchSet];
}
