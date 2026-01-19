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

    // Update assignment - only mark as completed if session status is completed
    // If status is "pending" (draft), don't mark as completed yet
    if (data.status === "completed") {
      await updateAssignmentStatus(
        data.assignmentId,
        "completed",
        Timestamp.now(),
        data.productId // Pass productId to track which product is completed
      );
    }

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
 * Update assignment status - add productId to completedProductIds or inProgressProductIds array
 */
export const updateAssignmentStatus = async (
  assignmentId: string,
  status: "pending" | "in_progress" | "completed",
  countedAt?: Timestamp,
  productId?: string
): Promise<void> => {
  try {
    const assignmentRef = doc(db, "assignments", assignmentId);

    // If completed and productId provided, add to completedProductIds array
    if (status === "completed" && productId) {
      const assignmentDoc = await getDoc(assignmentRef);
      if (assignmentDoc.exists()) {
        const currentData = assignmentDoc.data();
        const completedProductIds = currentData.completedProductIds || [];
        const inProgressProductIds = currentData.inProgressProductIds || [];

        // Add productId if not already in array
        if (!completedProductIds.includes(productId)) {
          completedProductIds.push(productId);
        }

        // Remove from inProgressProductIds since it's now completed
        const updatedInProgressIds = inProgressProductIds.filter(
          (id: string) => id !== productId
        );

        await updateDoc(assignmentRef, {
          completedProductIds,
          inProgressProductIds: updatedInProgressIds,
          ...(countedAt && { countedAt }),
          updatedAt: Timestamp.now(),
        });
      }
    } else if (status === "in_progress" && productId) {
      // Add to inProgressProductIds array
      const assignmentDoc = await getDoc(assignmentRef);
      if (assignmentDoc.exists()) {
        const currentData = assignmentDoc.data();
        const inProgressProductIds = currentData.inProgressProductIds || [];
        const completedProductIds = currentData.completedProductIds || [];

        // Only add if not already completed and not already in progress
        if (
          !completedProductIds.includes(productId) &&
          !inProgressProductIds.includes(productId)
        ) {
          inProgressProductIds.push(productId);

          await updateDoc(assignmentRef, {
            inProgressProductIds,
            updatedAt: Timestamp.now(),
          });
        }
      }
    } else {
      await updateDoc(assignmentRef, {
        status,
        ...(countedAt && { countedAt }),
        updatedAt: Timestamp.now(),
      });
    }
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
  const historyRef = doc(db, `users/${userId}/countingHistory`, sessionId);

  try {
    await updateDoc(historyRef, historyData as any);
  } catch {
    // If document doesn't exist, create it
    await addDoc(
      collection(db, `users/${userId}/countingHistory`),
      historyData as any
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
    console.log("🔍 Searching counting sessions for productId:", productId);

    const sessionsRef = collection(db, "countingSessions");

    // Query without orderBy to avoid needing composite index
    const q = query(sessionsRef, where("productId", "==", productId));

    const snapshot = await getDocs(q);

    console.log(`📊 Found ${snapshot.size} sessions`);

    // Debug: Log first session data if exists
    if (snapshot.size > 0) {
      const firstDoc = snapshot.docs[0];
      console.log("📝 First session data:", firstDoc.data());
    }

    // Sort in JavaScript instead of Firestore (no index needed)
    const sessions = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as CountingSession)
    );

    // Sort by createdAt descending
    sessions.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    return sessions;
  } catch (error) {
    console.error("Error getting product sessions:", error);
    throw error;
  }
};
