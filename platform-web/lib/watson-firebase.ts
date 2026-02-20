import { PriceListItem } from "@/types/watson/pricelist";
import { PromotionItem } from "@/types/watson/promotion";
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  FirebaseStorage,
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} from "firebase/storage";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Database ID from environment (for multi-database support)
const FIRESTORE_DB_ID = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID;
if (!FIRESTORE_DB_ID) {
  throw new Error(
    "Missing required environment variable: NEXT_PUBLIC_FIRESTORE_DATABASE_ID",
  );
}

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let db: Firestore;
let storage: FirebaseStorage;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existingApps = getApps();
    app =
      existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    db = getFirestore(firebaseApp, FIRESTORE_DB_ID!);
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    const firebaseApp = getFirebaseApp();
    storage = getStorage(firebaseApp);
  }
  return storage;
}

// ==================== Storage Functions ====================

/**
 * Upload JSON data to Firebase Storage
 * @param path - Storage path (e.g., "invoice-uploads/abc123.json")
 * @param data - Data to serialize as JSON
 * @returns Download URL
 */
export async function uploadJsonToStorage<T>(
  path: string,
  data: T,
): Promise<string> {
  const storageInstance = getFirebaseStorage();
  const storageRef = ref(storageInstance, path);
  const jsonString = JSON.stringify(data);
  await uploadString(storageRef, jsonString, "raw", {
    contentType: "application/json",
  });
  return getDownloadURL(storageRef);
}

/**
 * Download JSON data from Firebase Storage
 * @param url - Download URL
 * @returns Parsed JSON data
 */
export async function downloadJsonFromStorage<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete file from Firebase Storage
 * @param path - Storage path
 */
export async function deleteFromStorage(path: string): Promise<void> {
  const storageInstance = getFirebaseStorage();
  const storageRef = ref(storageInstance, path);
  try {
    await deleteObject(storageRef);
  } catch (error) {
    // Ignore if file doesn't exist
    console.warn("File not found in storage:", path, error);
  }
}

// ==================== Types ====================

// Re-export from shared
// Re-export from shared
export {
  COLLECTIONS,
  type ActivityLogDocument,
  type ActivityLogFullDocument,
  type CurrentPriceListDocument,
  type ExportDocument,
  type ExportStatus,
  type ExportStorageData,
  type InvoiceStorageData,
  type InvoiceUploadDocument,
  type PriceImportHistoryDocument,
  type PriceImportStorageData,
  type PriceListDocument,
  type PromotionDataDocument,
  type WorkflowStatus,
} from "./watson-shared";

import {
  COLLECTIONS,
  type ActivityLogDocument,
  type ActivityLogFullDocument,
  type CurrentPriceListDocument,
  type ExportDocument,
  type ExportStatus,
  type ExportStorageData,
  type InvoiceStorageData,
  type InvoiceUploadDocument,
  type PriceImportHistoryDocument,
  type PriceImportStorageData,
  type PriceListDocument,
  type PromotionDataDocument,
  type WorkflowStatus,
} from "./watson-shared";

// ==================== Export Functions ====================

export async function saveExport(
  exportData: Omit<
    ExportDocument,
    | "id"
    | "exportedAt"
    | "storagePath"
    | "storageUrl"
    | "status"
    | "confirmedAt"
    | "confirmedBy"
  > & { data?: unknown[] },
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.EXPORTS));
  const docId = docRef.id;

  // Separate data from metadata
  const { data, headers, ...metadata } = exportData;

  // Upload data to Firebase Storage (under /watson/ path for storage rules)
  const storagePath = `watson/exports/${docId}.json`;
  const storageData = { headers, data: data || [] };

  console.log(
    `[saveExport] Uploading to storage: ${storagePath}, rows: ${data?.length || 0}`,
  );

  let storageUrl: string;
  try {
    storageUrl = await uploadJsonToStorage(storagePath, storageData);
    console.log(`[saveExport] Storage upload success: ${storageUrl}`);
  } catch (storageError) {
    console.error(`[saveExport] Storage upload failed:`, storageError);
    throw new Error(
      `Storage upload failed: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
    );
  }

  const document: ExportDocument = {
    ...metadata,
    headers,
    id: docId,
    exportedAt: Timestamp.now(),
    status: "draft", // Default to draft, user must confirm later
    storagePath,
    storageUrl,
  };

  try {
    await setDoc(docRef, document);
    console.log(`[saveExport] Firestore save success: ${docId}`);
  } catch (firestoreError) {
    console.error(`[saveExport] Firestore save failed:`, firestoreError);
    throw new Error(
      `Firestore save failed: ${firestoreError instanceof Error ? firestoreError.message : String(firestoreError)}`,
    );
  }

  return docId;
}

/**
 * Confirm an export - marks it as ready for API consumption
 * @param id - Export document ID
 * @param confirmedBy - Optional: who confirmed the export
 * @returns true if successful
 */
export async function confirmExport(
  id: string,
  confirmedBy?: string,
): Promise<boolean> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.EXPORTS, id);

  // Check if document exists
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`Export ${id} not found`);
  }

  // Update status to confirmed
  await updateDoc(docRef, {
    status: "confirmed",
    confirmedAt: Timestamp.now(),
    ...(confirmedBy && { confirmedBy }),
  });

  console.log(`[confirmExport] Export ${id} confirmed`);
  return true;
}

/**
 * Unconfirm an export - revert to draft status
 * @param id - Export document ID
 * @returns true if successful
 */
export async function unconfirmExport(id: string): Promise<boolean> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.EXPORTS, id);

  // Check if document exists
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`Export ${id} not found`);
  }

  // Update status back to draft
  await updateDoc(docRef, {
    status: "draft",
    confirmedAt: null,
    confirmedBy: null,
  });

  console.log(`[unconfirmExport] Export ${id} reverted to draft`);
  return true;
}

export async function getExport(
  id: string,
): Promise<(ExportDocument & { data?: Record<string, unknown>[] }) | null> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.EXPORTS, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const exportDoc = docSnap.data() as ExportDocument;

  // If data is stored in Firebase Storage, download it
  if (exportDoc.storageUrl) {
    try {
      const storageData = await downloadJsonFromStorage<ExportStorageData>(
        exportDoc.storageUrl,
      );
      return {
        ...exportDoc,
        data: storageData.data,
        headers: storageData.headers,
      };
    } catch (error) {
      console.error("Error downloading export data from storage:", error);
      // Return without data if download fails
      return exportDoc;
    }
  }

  return exportDoc;
}

export async function listExports(options?: {
  supplierCode?: string;
  startDate?: Date;
  endDate?: Date;
  confirmedStartDate?: Date;
  confirmedEndDate?: Date;
  limitCount?: number;
  status?: ExportStatus; // Filter by status: "draft" | "confirmed"
}): Promise<ExportDocument[]> {
  const db = getFirestoreDb();
  const constraints: QueryConstraint[] = [];

  if (options?.supplierCode) {
    constraints.push(where("supplierCode", "==", options.supplierCode));
  }

  if (options?.status) {
    constraints.push(where("status", "==", options.status));
  }

  if (options?.startDate) {
    constraints.push(
      where("exportedAt", ">=", Timestamp.fromDate(options.startDate)),
    );
  }

  if (options?.endDate) {
    constraints.push(
      where("exportedAt", "<=", Timestamp.fromDate(options.endDate)),
    );
  }

  // Filter by confirmedAt range (only works when status=confirmed)
  if (options?.confirmedStartDate) {
    constraints.push(
      where(
        "confirmedAt",
        ">=",
        Timestamp.fromDate(options.confirmedStartDate),
      ),
    );
  }

  if (options?.confirmedEndDate) {
    constraints.push(
      where("confirmedAt", "<=", Timestamp.fromDate(options.confirmedEndDate)),
    );
  }

  constraints.push(orderBy("exportedAt", "desc"));

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  const q = query(collection(db, COLLECTIONS.EXPORTS), ...constraints);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => doc.data() as ExportDocument);
}

// ==================== Price List Functions ====================

export async function savePriceList(
  priceListData: Omit<PriceListDocument, "id" | "importedAt">,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.PRICE_LISTS));

  const document: PriceListDocument = {
    ...priceListData,
    id: docRef.id,
    importedAt: Timestamp.now(),
  };

  await setDoc(docRef, document);
  return docRef.id;
}

export async function getPriceList(
  id: string,
): Promise<PriceListDocument | null> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.PRICE_LISTS, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;
  return docSnap.data() as PriceListDocument;
}

export async function listPriceLists(options?: {
  limitCount?: number;
}): Promise<PriceListDocument[]> {
  const db = getFirestoreDb();
  const constraints: QueryConstraint[] = [orderBy("importedAt", "desc")];

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  const q = query(collection(db, COLLECTIONS.PRICE_LISTS), ...constraints);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => doc.data() as PriceListDocument);
}

// ==================== Activity Log Functions ====================

export async function saveActivityLog(
  logData: Omit<ActivityLogDocument, "id" | "timestamp">,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.ACTIVITY_LOGS));

  const document: ActivityLogDocument = {
    ...logData,
    id: docRef.id,
    timestamp: Timestamp.now(),
  };

  await setDoc(docRef, document);
  return docRef.id;
}

export async function listActivityLogs(options?: {
  sessionId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limitCount?: number;
}): Promise<ActivityLogDocument[]> {
  const db = getFirestoreDb();
  const constraints: QueryConstraint[] = [];

  if (options?.sessionId) {
    constraints.push(where("sessionId", "==", options.sessionId));
  }

  if (options?.action) {
    constraints.push(where("action", "==", options.action));
  }

  if (options?.startDate) {
    constraints.push(
      where("timestamp", ">=", Timestamp.fromDate(options.startDate)),
    );
  }

  if (options?.endDate) {
    constraints.push(
      where("timestamp", "<=", Timestamp.fromDate(options.endDate)),
    );
  }

  constraints.push(orderBy("timestamp", "desc"));

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount));
  }

  const q = query(collection(db, COLLECTIONS.ACTIVITY_LOGS), ...constraints);
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => doc.data() as ActivityLogDocument);
}

// ==================== API Key Validation ====================

export async function validateApiKey(apiKey: string): Promise<boolean> {
  // Check environment variables for hardcoded API keys
  const validEnvKeys = [
    process.env.WATSON_API_KEY,
    process.env.WATSON_API_KEY_SANDBOX,
    process.env.WATSON_API_KEY_PROD,
  ].filter(Boolean);

  if (validEnvKeys.includes(apiKey)) {
    return true;
  }

  // Fallback to Firestore validation
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.API_KEYS),
    where("key", "==", apiKey),
    where("active", "==", true),
  );

  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty;
}

export async function createApiKey(
  name: string,
  description?: string,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.API_KEYS));

  // Generate a random API key
  const apiKey = `wv_${generateRandomString(32)}`;

  await setDoc(docRef, {
    id: docRef.id,
    name,
    description,
    key: apiKey,
    active: true,
    createdAt: Timestamp.now(),
  });

  return apiKey;
}

function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ==================== Price Import History Functions ====================

export async function savePriceImportHistory(
  metadata: Omit<
    PriceImportHistoryDocument,
    "id" | "importedAt" | "storagePath" | "storageUrl"
  >,
  data: PriceListItem[],
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.PRICE_IMPORT_HISTORY));
  const docId = docRef.id;

  // Upload data to Firebase Storage
  const storagePath = `watson/price-imports/${docId}.json`;
  const storageUrl = await uploadJsonToStorage<PriceImportStorageData>(
    storagePath,
    { data },
  );

  // Save metadata to Firestore
  const document: PriceImportHistoryDocument = {
    ...metadata,
    id: docId,
    importedAt: Timestamp.now(),
    storagePath,
    storageUrl,
  };

  await setDoc(docRef, document);
  return docId;
}

export async function getPriceImportData(
  doc: PriceImportHistoryDocument,
): Promise<PriceListItem[]> {
  if (!doc.storageUrl) return [];
  try {
    const storageData = await downloadJsonFromStorage<PriceImportStorageData>(
      doc.storageUrl,
    );
    return storageData.data || [];
  } catch (error) {
    console.error("Error downloading price import data:", error);
    return [];
  }
}

export async function listPriceImportHistory(
  limitCount: number = 10,
): Promise<PriceImportHistoryDocument[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.PRICE_IMPORT_HISTORY),
    orderBy("importedAt", "desc"),
    limit(limitCount),
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => d.data() as PriceImportHistoryDocument);
}

export async function deletePriceImportHistory(id: string): Promise<void> {
  const db = getFirestoreDb();

  // Get document to find storage path
  const docRef = doc(db, COLLECTIONS.PRICE_IMPORT_HISTORY, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as PriceImportHistoryDocument;
    // Delete from Storage
    if (data.storagePath) {
      await deleteFromStorage(data.storagePath);
    }
  }

  // Delete from Firestore
  await deleteDoc(docRef);
}

export async function clearAllPriceImportHistory(): Promise<void> {
  const db = getFirestoreDb();
  const querySnapshot = await getDocs(
    collection(db, COLLECTIONS.PRICE_IMPORT_HISTORY),
  );

  // Delete all storage files and documents
  const deletePromises = querySnapshot.docs.map(async (d) => {
    const data = d.data() as PriceImportHistoryDocument;
    if (data.storagePath) {
      await deleteFromStorage(data.storagePath);
    }
    await deleteDoc(d.ref);
  });
  await Promise.all(deletePromises);
}

// ==================== Invoice Upload Functions ====================

export async function saveInvoiceUpload(
  metadata: Omit<
    InvoiceUploadDocument,
    "id" | "uploadedAt" | "storagePath" | "storageUrl"
  >,
  invoiceData: InvoiceStorageData,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.INVOICE_UPLOADS));
  const docId = docRef.id;

  // Upload data to Firebase Storage
  const storagePath = `watson/invoice-uploads/${docId}.json`;
  const storageUrl = await uploadJsonToStorage<InvoiceStorageData>(
    storagePath,
    invoiceData,
  );

  // Save metadata to Firestore
  const document: InvoiceUploadDocument = {
    ...metadata,
    id: docId,
    uploadedAt: Timestamp.now(),
    storagePath,
    storageUrl,
  };

  await setDoc(docRef, document);
  return docId;
}

export async function getInvoiceUploadData(
  docData: InvoiceUploadDocument,
): Promise<InvoiceStorageData | null> {
  if (!docData.storageUrl) return null;
  try {
    return await downloadJsonFromStorage<InvoiceStorageData>(
      docData.storageUrl,
    );
  } catch (error) {
    console.error("Error downloading invoice data:", error);
    return null;
  }
}

export async function getInvoiceUpload(
  id: string,
): Promise<InvoiceUploadDocument | null> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.INVOICE_UPLOADS, id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return docSnap.data() as InvoiceUploadDocument;
}

export async function listInvoiceUploads(
  limitCount: number = 5,
): Promise<InvoiceUploadDocument[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.INVOICE_UPLOADS),
    orderBy("uploadedAt", "desc"),
    limit(limitCount),
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((d) => d.data() as InvoiceUploadDocument);
}

export async function deleteInvoiceUpload(id: string): Promise<void> {
  const db = getFirestoreDb();

  // Get document to find storage path
  const docRef = doc(db, COLLECTIONS.INVOICE_UPLOADS, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data() as InvoiceUploadDocument;
    // Delete from Storage
    if (data.storagePath) {
      await deleteFromStorage(data.storagePath);
    }
  }

  // Delete from Firestore
  await deleteDoc(docRef);
}

export async function updateInvoiceUploadData(
  id: string,
  invoiceData: InvoiceStorageData,
): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.INVOICE_UPLOADS, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Invoice upload with id ${id} not found`);
  }

  const data = docSnap.data() as InvoiceUploadDocument;
  const storagePath = data.storagePath || `watson/invoice-uploads/${id}.json`;

  // Re-upload data to Firebase Storage (overwrites existing)
  const storageUrl = await uploadJsonToStorage<InvoiceStorageData>(
    storagePath,
    invoiceData,
  );

  // Update Firestore document with new row count
  await setDoc(
    docRef,
    {
      rowCount: invoiceData.data.length,
      storagePath,
      storageUrl,
    },
    { merge: true },
  );
}

/**
 * Update invoice workflow status
 * @param id - Invoice upload document ID
 * @param status - New workflow status
 * @param options - Additional fields to update (lastExportId, etc.)
 */
export async function updateInvoiceUploadStatus(
  id: string,
  status: WorkflowStatus,
  options?: { lastExportId?: string },
): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.INVOICE_UPLOADS, id);

  const updateData: Record<string, unknown> = { status };

  // Add timestamp based on status
  switch (status) {
    case "validated":
      updateData.validatedAt = Timestamp.now();
      break;
    case "calculated":
      updateData.calculatedAt = Timestamp.now();
      break;
    case "exported":
      updateData.exportedAt = Timestamp.now();
      if (options?.lastExportId) {
        updateData.lastExportId = options.lastExportId;
      }
      break;
    case "confirmed":
      updateData.confirmedAt = Timestamp.now();
      break;
  }

  await updateDoc(docRef, updateData);
}

export async function clearAllInvoiceUploads(): Promise<void> {
  const db = getFirestoreDb();
  const querySnapshot = await getDocs(
    collection(db, COLLECTIONS.INVOICE_UPLOADS),
  );

  // Delete all storage files and documents
  const deletePromises = querySnapshot.docs.map(async (d) => {
    const data = d.data() as InvoiceUploadDocument;
    if (data.storagePath) {
      await deleteFromStorage(data.storagePath);
    }
    await deleteDoc(d.ref);
  });
  await Promise.all(deletePromises);
}

// ==================== Activity Logs Full Functions ====================

export async function saveActivityLogFull(
  data: Omit<ActivityLogFullDocument, "id" | "timestamp">,
): Promise<string> {
  const db = getFirestoreDb();
  const docRef = doc(collection(db, COLLECTIONS.ACTIVITY_LOGS_FULL));

  const document: ActivityLogFullDocument = {
    ...data,
    id: docRef.id,
    timestamp: Timestamp.now(),
  };

  await setDoc(docRef, document);
  return docRef.id;
}

export async function listActivityLogsFull(
  limitCount: number = 100,
): Promise<ActivityLogFullDocument[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTIONS.ACTIVITY_LOGS_FULL),
    orderBy("timestamp", "desc"),
    limit(limitCount),
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => doc.data() as ActivityLogFullDocument);
}

export async function updateActivityLogFull(
  id: string,
  updates: Partial<ActivityLogFullDocument>,
): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.ACTIVITY_LOGS_FULL, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    await setDoc(docRef, { ...docSnap.data(), ...updates }, { merge: true });
  }
}

export async function clearAllActivityLogsFull(): Promise<void> {
  const db = getFirestoreDb();
  const querySnapshot = await getDocs(
    collection(db, COLLECTIONS.ACTIVITY_LOGS_FULL),
  );
  const deletePromises = querySnapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletePromises);
}

// ==================== Promotion Data Functions ====================

const PROMOTION_DOC_ID = "current";

export async function savePromotionData(items: PromotionItem[]): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.PROMOTION_DATA, PROMOTION_DOC_ID);

  await setDoc(docRef, {
    id: PROMOTION_DOC_ID,
    updatedAt: Timestamp.now(),
    items,
  });
}

export async function getPromotionData(): Promise<PromotionItem[]> {
  const db = getFirestoreDb();
  const docRef = doc(db, COLLECTIONS.PROMOTION_DATA, PROMOTION_DOC_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return [];
  const data = docSnap.data() as PromotionDataDocument;
  return data.items || [];
}

// ==================== Current Price List Functions ====================

const CURRENT_PRICELIST_DOC_ID = "current";

export async function saveCurrentPriceList(
  items: PriceListItem[],
): Promise<void> {
  // Save to localStorage as backup
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("price_list_backup", JSON.stringify(items));
    } catch {
      console.warn("Could not save price list backup to localStorage");
    }
  }

  const db = getFirestoreDb();
  const docRef = doc(
    db,
    COLLECTIONS.CURRENT_PRICE_LIST,
    CURRENT_PRICELIST_DOC_ID,
  );

  await setDoc(docRef, {
    id: CURRENT_PRICELIST_DOC_ID,
    updatedAt: Timestamp.now(),
    items,
  });
}

export async function getCurrentPriceList(): Promise<PriceListItem[]> {
  try {
    const db = getFirestoreDb();
    const docRef = doc(
      db,
      COLLECTIONS.CURRENT_PRICE_LIST,
      CURRENT_PRICELIST_DOC_ID,
    );
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Try localStorage backup
      return getLocalStoragePriceListBackup();
    }
    const data = docSnap.data() as CurrentPriceListDocument;
    return data.items || [];
  } catch (error) {
    console.warn("Firestore offline, falling back to localStorage:", error);
    // Fallback to localStorage when offline
    return getLocalStoragePriceListBackup();
  }
}

function getLocalStoragePriceListBackup(): PriceListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const backup = localStorage.getItem("price_list_backup");
    if (backup) {
      return JSON.parse(backup) as PriceListItem[];
    }
  } catch {
    console.warn("Could not load price list backup from localStorage");
  }
  return [];
}

export async function clearCurrentPriceList(): Promise<void> {
  // Clear localStorage backup
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("price_list_backup");
    } catch {
      // Ignore
    }
  }

  const db = getFirestoreDb();
  await deleteDoc(
    doc(db, COLLECTIONS.CURRENT_PRICE_LIST, CURRENT_PRICELIST_DOC_ID),
  );
}
