import { db } from "@/lib/firebase";
import { Company, User } from "@/types";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

// ==================== Types ====================

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  status: "active" | "inactive" | "coming_soon";
  order: number;
}

// ==================== Module Registry (Platform Level) ====================

export async function getModules(): Promise<ModuleInfo[]> {
  try {
    const modulesRef = collection(db, "modules");
    const q = query(modulesRef, orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ModuleInfo[];
  } catch (error) {
    console.error("Error fetching modules:", error);
    return [];
  }
}

export async function createModule(module: ModuleInfo): Promise<void> {
  const moduleRef = doc(db, "modules", module.id);
  await setDoc(moduleRef, {
    name: module.name,
    description: module.description,
    icon: module.icon,
    path: module.path,
    color: module.color,
    status: module.status,
    order: module.order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateModule(
  moduleId: string,
  data: Partial<Omit<ModuleInfo, "id">>,
): Promise<void> {
  const moduleRef = doc(db, "modules", moduleId);
  await updateDoc(moduleRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteModule(moduleId: string): Promise<void> {
  await deleteDoc(doc(db, "modules", moduleId));
}

// Seed initial modules — call once from Super Admin UI
export async function seedInitialModules(): Promise<void> {
  const existing = await getModules();
  if (existing.length > 0) return; // Don't overwrite

  const defaults: ModuleInfo[] = [
    {
      id: "stock-counter",
      name: "Stock Counter",
      description: "โปรแกรมนับ Stock สินค้า",
      icon: "📦",
      path: "/stock-counter",
      color: "#3B82F6",
      status: "active",
      order: 1,
    },
  ];

  for (const mod of defaults) {
    await createModule(mod);
  }
}

// ==================== Company Modules (Company Level) ====================

export async function getCompanyEnabledModules(
  companyId: string,
): Promise<string[]> {
  try {
    const companyRef = doc(db, "companies", companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) return [];
    return companySnap.data()?.enabledModules || [];
  } catch (error) {
    console.error("Error fetching company modules:", error);
    return [];
  }
}

export async function updateCompanyEnabledModules(
  companyId: string,
  modules: string[],
): Promise<void> {
  const companyRef = doc(db, "companies", companyId);
  await updateDoc(companyRef, {
    enabledModules: modules,
    updatedAt: serverTimestamp(),
  });
}

// ==================== User Module Access (User Level) ====================

export async function getUserModuleAccess(userId: string): Promise<string[]> {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return [];
    return userSnap.data()?.moduleAccess || [];
  } catch (error) {
    console.error("Error fetching user module access:", error);
    return [];
  }
}

export async function updateUserModuleAccess(
  userId: string,
  modules: string[],
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    moduleAccess: modules,
    updatedAt: serverTimestamp(),
  });
}

// ==================== Company / User Queries ====================

export async function getCompanyUsers(
  companyId: string,
): Promise<(User & { id: string })[]> {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("companyId", "==", companyId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (User & { id: string })[];
  } catch (error) {
    console.error("Error fetching company users:", error);
    return [];
  }
}

export async function getAllCompanies(): Promise<(Company & { id: string })[]> {
  try {
    const companiesRef = collection(db, "companies");
    const snapshot = await getDocs(companiesRef);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (Company & { id: string })[];
  } catch (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
}

export async function getAllUsers(): Promise<(User & { id: string })[]> {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as (User & { id: string })[];
  } catch (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
}

export async function updateUserRole(
  userId: string,
  role: string,
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { role, updatedAt: serverTimestamp() });
}

export async function createCompany(data: {
  name: string;
  code: string;
  enabledModules?: string[];
}): Promise<string> {
  const companiesRef = collection(db, "companies");
  const docRef = await addDoc(companiesRef, {
    name: data.name,
    code: data.code.toUpperCase(),
    enabledModules: data.enabledModules || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Add a companyId to a user's companyIds array (for multi-company users).
 * Safe to call multiple times — arrayUnion deduplicates.
 */
export async function addUserToCompany(
  userId: string,
  companyId: string,
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    companyIds: arrayUnion(companyId),
  });
}

// ==================== Access Check Helpers ====================

/**
 * 3-layer access check:
 * 1. super_admin → always has access
 * 2. company.enabledModules → must include the module
 * 3. user.moduleAccess → must include the module
 */
export function canAccessModule(
  userData: User | null,
  moduleId: string,
  companyEnabledModules?: string[],
): boolean {
  if (!userData) return false;

  // Layer 1: Super admin bypasses all checks
  if (userData.role === "super_admin") return true;

  // Layer 2: Company must have the module enabled
  if (companyEnabledModules && !companyEnabledModules.includes(moduleId)) {
    return false;
  }

  // Layer 3: User must have access to the module
  const userModules = userData.moduleAccess || [];
  return userModules.includes(moduleId);
}

/**
 * Compute effective modules for a user: intersection of company modules and user modules
 */
export function getEffectiveModules(
  userData: User | null,
  companyEnabledModules: string[],
): string[] {
  if (!userData) return [];
  if (userData.role === "super_admin") return companyEnabledModules;

  const userModules = userData.moduleAccess || [];
  return userModules.filter((m) => companyEnabledModules.includes(m));
}

// ==================== Module Whitelist (Email-based Access) ====================

/**
 * Get module whitelist for a company
 * Returns: { "stock-counter": ["a@b.com"], "watson": ["c@d.com"] }
 */
export async function getModuleWhitelist(
  companyId: string,
): Promise<Record<string, string[]>> {
  try {
    const companyRef = doc(db, "companies", companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) return {};
    return companySnap.data()?.moduleWhitelist || {};
  } catch (error) {
    console.error("Error fetching module whitelist:", error);
    return {};
  }
}

/**
 * Set whitelist emails for a specific module in a company
 */
export async function setModuleWhitelist(
  companyId: string,
  moduleId: string,
  emails: string[],
): Promise<void> {
  const companyRef = doc(db, "companies", companyId);
  const companySnap = await getDoc(companyRef);
  const existing = companySnap.exists()
    ? companySnap.data()?.moduleWhitelist || {}
    : {};

  existing[moduleId] = emails
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  await updateDoc(companyRef, {
    moduleWhitelist: existing,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Sync user's moduleAccess based on company whitelist.
 * Called on login:
 * - If user HAS companyId → sync that company's whitelist
 * - If user has NO companyId → scan ALL companies' whitelists,
 *   auto-assign to the first matching company, and set moduleAccess
 */
export async function syncModuleAccessFromWhitelist(
  userId: string,
  email: string,
  companyId?: string,
): Promise<string[]> {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Case 1: User already belongs to a company
    if (companyId) {
      const whitelist = await getModuleWhitelist(companyId);
      const enabledModules = await getCompanyEnabledModules(companyId);

      const grantedModules: string[] = [];
      for (const [moduleId, emails] of Object.entries(whitelist)) {
        if (
          enabledModules.includes(moduleId) &&
          emails.includes(normalizedEmail)
        ) {
          grantedModules.push(moduleId);
        }
      }

      if (grantedModules.length > 0) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          moduleAccess: grantedModules,
          updatedAt: serverTimestamp(),
        });
      }

      return grantedModules;
    }

    // Case 2: User has no company → scan ALL companies
    const companies = await getAllCompanies();

    for (const company of companies) {
      const whitelist = company.moduleWhitelist || {};
      const enabledModules = company.enabledModules || [];

      const grantedModules: string[] = [];
      for (const [moduleId, emails] of Object.entries(whitelist)) {
        if (
          enabledModules.includes(moduleId) &&
          (emails as string[]).includes(normalizedEmail)
        ) {
          grantedModules.push(moduleId);
        }
      }

      // Found a match → assign user to this company + set moduleAccess
      if (grantedModules.length > 0) {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          companyId: company.id,
          companyCode: company.code || "",
          companyName: company.name || "",
          moduleAccess: grantedModules,
          status: "active",
          updatedAt: serverTimestamp(),
        });

        console.log(
          `Auto-assigned user ${email} to company ${company.name} with modules:`,
          grantedModules,
        );
        return grantedModules;
      }
    }

    return [];
  } catch (error) {
    console.error("Error syncing module access from whitelist:", error);
    return [];
  }
}
