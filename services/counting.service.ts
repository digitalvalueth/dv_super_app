import { db, storage } from "@/config/firebase";
import { CountingHistory, CountingSession } from "@/types";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

/**
 * Upload counting image to Firebase Storage
 */
export const uploadCountingImage = async (
  userId: string,
  sessionId: string,
  imageUri: string
): Promise<string> => {
  try {
    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Create storage reference
    const storageRef = ref(
      storage,
      `counting/${userId}/${sessionId}/${Date.now()}.jpg`
    );

    // Upload image
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

/**
 * Create a new counting session
 */
export const createCountingSession = async (
  data: Omit<CountingSession, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const sessionsRef = collection(db, "countingSessions");

    const newSession = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(sessionsRef, newSession);

    // Update assignment status
    await updateAssignmentStatus(
      data.assignmentId,
      "completed",
      Timestamp.now()
    );

    // Add to user's counting history
    await addToCountingHistory(data.userId, docRef.id, {
      sessionId: docRef.id,
      productName: "", // Will be populated from product data
      productSKU: data.productId,
      currentCountQty: data.currentCountQty,
      beforeCountQty: data.beforeCountQty,
      variance: data.variance,
      countedAt: Timestamp.now(),
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating counting session:", error);
    throw error;
  }
};

/**
 * Update assignment status
 */
export const updateAssignmentStatus = async (
  assignmentId: string,
  status: "pending" | "in_progress" | "completed",
  countedAt?: Timestamp
): Promise<void> => {
  try {
    const assignmentRef = doc(db, "userAssignments", assignmentId);

    await updateDoc(assignmentRef, {
      status,
      ...(countedAt && { countedAt }),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating assignment status:", error);
    throw error;
  }
};

/**
 * Get counting session by ID
 */
export const getCountingSession = async (
  sessionId: string
): Promise<CountingSession | null> => {
  try {
    const sessionDoc = await getDoc(doc(db, "countingSessions", sessionId));

    if (sessionDoc.exists()) {
      return { id: sessionDoc.id, ...sessionDoc.data() } as CountingSession;
    }

    return null;
  } catch (error) {
    console.error("Error getting counting session:", error);
    throw error;
  }
};

/**
 * Get user's counting history
 */
export const getUserCountingHistory = async (
  userId: string,
  limitCount: number = 50
): Promise<CountingHistory[]> => {
  try {
    const historyRef = collection(db, `users/${userId}/countingHistory`);
    const q = query(historyRef, orderBy("countedAt", "desc"));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => doc.data() as CountingHistory);
  } catch (error) {
    console.error("Error getting counting history:", error);
    throw error;
  }
};

/**
 * Add to counting history (subcollection)
 */
const addToCountingHistory = async (
  userId: string,
  sessionId: string,
  historyData: CountingHistory
): Promise<void> => {
  try {
    const historyRef = doc(db, `users/${userId}/countingHistory`, sessionId);
    await updateDoc(historyRef, historyData);
  } catch (error) {
    // If document doesn't exist, create it
    const historyRef = doc(db, `users/${userId}/countingHistory`, sessionId);
    await addDoc(
      collection(db, `users/${userId}/countingHistory`),
      historyData
    );
  }
};

/**
 * Get all sessions for a product
 */
export const getProductCountingSessions = async (
  productId: string,
  limitCount: number = 10
): Promise<CountingSession[]> => {
  try {
    const sessionsRef = collection(db, "countingSessions");
    const q = query(
      sessionsRef,
      where("productId", "==", productId),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CountingSession)
    );
  } catch (error) {
    console.error("Error getting product sessions:", error);
    throw error;
  }
};
