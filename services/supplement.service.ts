import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { SupplementSession } from "@/types";

const COLLECTION = "supplementSessions";

/**
 * Create a supplement counting session (additional count for same product)
 */
export async function createSupplementSession(params: {
  originalSessionId: string;
  userId: string;
  userName: string;
  productId: string;
  productName: string;
  companyId: string;
  branchId: string;
  additionalCount: number;
  imageUrl: string;
  aiCount: number;
  reason: string;
}): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...params,
    status: "pending",
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Get supplement sessions for a specific original counting session
 */
export async function getSupplementsForSession(
  originalSessionId: string,
): Promise<SupplementSession[]> {
  const q = query(
    collection(db, COLLECTION),
    where("originalSessionId", "==", originalSessionId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as SupplementSession[];
}

/**
 * Get all supplement sessions for a company
 */
export async function getCompanySupplements(
  companyId: string,
  status?: string,
): Promise<SupplementSession[]> {
  const constraints = [where("companyId", "==", companyId)];
  if (status) {
    constraints.push(where("status", "==", status));
  }
  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as SupplementSession[];
}

/**
 * Get supplements by user
 */
export async function getUserSupplements(
  userId: string,
): Promise<SupplementSession[]> {
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as SupplementSession[];
}

/**
 * Approve a supplement session (supervisor)
 */
export async function approveSupplementSession(
  sessionId: string,
  reviewedBy: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, sessionId), {
    status: "approved",
    reviewedBy,
    reviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Reject a supplement session (supervisor)
 */
export async function rejectSupplementSession(
  sessionId: string,
  reviewedBy: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, sessionId), {
    status: "rejected",
    reviewedBy,
    reviewedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get supplement total for a session (sum of all approved supplement counts)
 */
export async function getSupplementTotal(
  originalSessionId: string,
): Promise<number> {
  const supplements = await getSupplementsForSession(originalSessionId);
  return supplements
    .filter((s) => s.status === "approved")
    .reduce((sum, s) => sum + s.additionalCount, 0);
}
