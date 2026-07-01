import { describe, it, expect } from "vitest";
import {
  resolveScopedBranchIds,
  type ScopeUser,
  type SupervisorDoc,
} from "./supervisor-scope";

const make = (over: Partial<ScopeUser>): ScopeUser => ({
  role: "employee",
  ...over,
});

describe("resolveScopedBranchIds", () => {
  it("returns null (all branches) for admin", () => {
    expect(resolveScopedBranchIds(make({ role: "admin" }))).toBeNull();
  });

  it("returns null (all branches) for super_admin", () => {
    expect(resolveScopedBranchIds(make({ role: "super_admin" }))).toBeNull();
  });

  it("supervisor with managedBranchIds returns those branches", () => {
    expect(
      resolveScopedBranchIds(
        make({ role: "supervisor", managedBranchIds: ["b1", "b2"] }),
      ),
    ).toEqual(["b1", "b2"]);
  });

  it("supervisor with empty managedBranchIds falls back to [branchId]", () => {
    expect(
      resolveScopedBranchIds(
        make({ role: "supervisor", managedBranchIds: [], branchId: "home" }),
      ),
    ).toEqual(["home"]);
  });

  it("supervisor with undefined managedBranchIds falls back to [branchId]", () => {
    expect(
      resolveScopedBranchIds(make({ role: "supervisor", branchId: "home" })),
    ).toEqual(["home"]);
  });

  it("supervisor with no managed branches and no branchId returns [] (NOT all)", () => {
    const result = resolveScopedBranchIds(make({ role: "supervisor" }));
    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it("manager unions own managed branches with fetched supervisors' branches", () => {
    const supervisors: SupervisorDoc[] = [
      { managedBranchIds: ["s1", "s2"] },
      { managedBranchIds: ["s3"] },
    ];
    const result = resolveScopedBranchIds(
      make({ role: "manager", managedBranchIds: ["own1"] }),
      supervisors,
    );
    expect(new Set(result)).toEqual(new Set(["own1", "s1", "s2", "s3"]));
    expect(result).toHaveLength(4);
  });

  it("manager de-duplicates overlapping branch ids across supervisors", () => {
    const supervisors: SupervisorDoc[] = [
      { managedBranchIds: ["b1", "b2"] },
      { managedBranchIds: ["b2", "b3"] },
    ];
    const result = resolveScopedBranchIds(
      make({ role: "manager", managedBranchIds: ["b1"] }),
      supervisors,
    );
    expect(new Set(result)).toEqual(new Set(["b1", "b2", "b3"]));
    expect(result).toHaveLength(3);
  });

  it("manager falls back to [branchId] for own branches when no managedBranchIds", () => {
    const result = resolveScopedBranchIds(
      make({ role: "manager", branchId: "mb" }),
      [{ managedBranchIds: ["sx"] }],
    );
    expect(new Set(result)).toEqual(new Set(["mb", "sx"]));
  });

  it("manager with no own branches and no supervisor docs returns []", () => {
    expect(resolveScopedBranchIds(make({ role: "manager" }), [])).toEqual([]);
  });

  it("manager ignores supervisor docs missing managedBranchIds", () => {
    const result = resolveScopedBranchIds(
      make({ role: "manager", managedBranchIds: ["own"] }),
      [{}, { managedBranchIds: undefined }],
    );
    expect(result).toEqual(["own"]);
  });

  it("plain employee gets [] (no branches, not all)", () => {
    const result = resolveScopedBranchIds(
      make({ role: "employee", branchId: "x", managedBranchIds: ["y"] }),
    );
    expect(result).toEqual([]);
  });

  it("staff role gets [] (no branches, not all)", () => {
    expect(resolveScopedBranchIds(make({ role: "staff" }))).toEqual([]);
  });

  it("null/undefined user gets [] (no branches, not all)", () => {
    expect(resolveScopedBranchIds(null)).toEqual([]);
    expect(resolveScopedBranchIds(undefined)).toEqual([]);
  });

  it("does not consult supervisor docs for a supervisor role", () => {
    // Supervisor scope must NOT widen via supervisor docs (manager-only).
    const result = resolveScopedBranchIds(
      make({ role: "supervisor", managedBranchIds: ["b1"] }),
      [{ managedBranchIds: ["should-not-appear"] }],
    );
    expect(result).toEqual(["b1"]);
  });
});
