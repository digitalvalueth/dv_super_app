import { db } from "@/config/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

// ─── Types ───

export interface EodDetail {
  Barcode?: string;
  Item?: string;
  EOD_Qty?: number;
  EOD_Date?: string;
  ID?: number;
  [key: string]: unknown;
}

export interface EodSnapshot {
  id: string;
  branchCode: string;
  sourceBranchCode?: string;
  location?: string;
  locationId?: string;
  eodDateMax?: string;
  details: EodDetail[];
}

// ─── Helpers ───

/** Extract digits only from a branch code string (e.g. "WL 3191" → "3191") */
const normalizeBranchCode = (value?: string | null): string => {
  const raw = (value || "").trim();
  const digits = raw.replace(/\D+/g, "");
  return digits || raw.replace(/\s+/g, "").toUpperCase();
};

// ─── Service ───

/**
 * Fetch EOD snapshot for a specific branch code.
 * Reads all `phithanEodImports` docs and matches the user's branch code
 * against the normalized branchCode field.
 */
export async function getEodForBranch(
  userBranchCode: string,
): Promise<EodSnapshot | null> {
  const normalizedUserCode = normalizeBranchCode(userBranchCode);
  if (!normalizedUserCode) return null;

  try {
    const snapshot = await getDocs(collection(db, "phithanEodImports"));
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const rawCode = String(data.branchCode || docSnap.id || "").trim();
      const normalizedCode = normalizeBranchCode(rawCode);
      if (normalizedCode === normalizedUserCode) {
        const payload =
          typeof data.data === "object" && data.data !== null
            ? (data.data as Record<string, unknown>)
            : undefined;

        const details: EodDetail[] = Array.isArray(data.data)
          ? data.data
          : Array.isArray(payload?.details)
            ? (payload.details as EodDetail[])
            : [];

        return {
          id: docSnap.id,
          branchCode: normalizedCode,
          sourceBranchCode: data.sourceBranchCode ?? docSnap.id,
          location:
            typeof payload?.Location === "string"
              ? payload.Location
              : undefined,
          locationId:
            typeof payload?.LocationID === "string"
              ? normalizeBranchCode(payload.LocationID)
              : undefined,
          eodDateMax:
            typeof payload?.EOD_Date_MAX === "string"
              ? payload.EOD_Date_MAX
              : undefined,
          details,
        };
      }
    }
    return null;
  } catch (error) {
    console.error("[eod.service] Error fetching EOD data:", error);
    return null;
  }
}

/**
 * Fetch EOD snapshot for a user.
 * Uses branchCode if set, otherwise falls back to branchId → branch.code lookup.
 */
export async function getEodForUser(user: {
  branchCode?: string | null;
  branchId?: string | null;
}): Promise<EodSnapshot | null> {
  if (user.branchCode) {
    return getEodForBranch(user.branchCode);
  }
  if (user.branchId) {
    return getEodForBranchId(user.branchId);
  }
  return null;
}

/**
 * Fetch EOD snapshot by branchId (Firestore document ID).
 * Looks up the branch's code and delegates to getEodForBranch.
 */
export async function getEodForBranchId(
  branchId: string,
): Promise<EodSnapshot | null> {
  if (!branchId) return null;
  try {
    const branchDoc = await getDoc(doc(db, "branches", branchId));
    if (branchDoc.exists()) {
      const code = (branchDoc.data() as { code?: string }).code;
      if (code) return getEodForBranch(code);
    }
  } catch (error) {
    console.error("[eod.service] Error fetching branch for EOD lookup:", error);
  }
  return null;
}

/**
 * Find an EOD detail entry that matches a given product barcode.
 * Compares against the `Barcode` field in the details array.
 */
export function findEodDetailByBarcode(
  eod: EodSnapshot | null,
  barcode: string,
): EodDetail | null {
  if (!eod || !barcode) return null;
  const target = barcode.trim();
  return eod.details.find((d) => (d.Barcode ?? "").trim() === target) ?? null;
}
