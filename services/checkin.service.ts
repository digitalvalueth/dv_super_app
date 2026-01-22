import { db, storage } from "@/config/firebase";
import { AttendanceSettings, CheckIn, CheckInType } from "@/types";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// Default work start time
const DEFAULT_WORK_START_TIME = "10:00";

/**
 * Check if the current time is late based on work start time
 */
export const checkIfLate = (
  checkInTime: Date,
  workStartTime: string = DEFAULT_WORK_START_TIME,
): { isLate: boolean; lateMinutes: number } => {
  const [hour, minute] = workStartTime.split(":").map(Number);
  const workStart = new Date(checkInTime);
  workStart.setHours(hour, minute, 0, 0);

  if (checkInTime > workStart) {
    const lateMinutes = Math.floor(
      (checkInTime.getTime() - workStart.getTime()) / 60000,
    );
    return { isLate: true, lateMinutes };
  }
  return { isLate: false, lateMinutes: 0 };
};

/**
 * Upload check-in image to Firebase Storage
 */
export const uploadCheckInImage = async (
  userId: string,
  checkInId: string,
  imageUri: string,
): Promise<string> => {
  try {
    // Convert image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Create storage reference
    const date = new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const storageRef = ref(
      storage,
      `check-ins/${userId}/${dateStr}/${checkInId}.jpg`,
    );

    // Upload image
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading check-in image:", error);
    throw error;
  }
};

/**
 * Get attendance settings for a company/branch
 */
export const getAttendanceSettings = async (
  companyId: string,
  branchId?: string,
): Promise<AttendanceSettings | null> => {
  try {
    const settingsRef = collection(db, "attendanceSettings");

    // Try to get branch-specific settings first
    if (branchId) {
      const branchQuery = query(
        settingsRef,
        where("companyId", "==", companyId),
        where("branchId", "==", branchId),
        limit(1),
      );
      const branchSnapshot = await getDocs(branchQuery);
      if (!branchSnapshot.empty) {
        return {
          id: branchSnapshot.docs[0].id,
          ...branchSnapshot.docs[0].data(),
        } as AttendanceSettings;
      }
    }

    // Fall back to company-wide settings
    const companyQuery = query(
      settingsRef,
      where("companyId", "==", companyId),
      where("branchId", "==", null),
      limit(1),
    );
    const companySnapshot = await getDocs(companyQuery);
    if (!companySnapshot.empty) {
      return {
        id: companySnapshot.docs[0].id,
        ...companySnapshot.docs[0].data(),
      } as AttendanceSettings;
    }

    // Return default settings
    return null;
  } catch (error) {
    console.error("Error getting attendance settings:", error);
    return null;
  }
};

/**
 * Create a new check-in record
 */
export const createCheckIn = async (
  data: Omit<
    CheckIn,
    "id" | "createdAt" | "updatedAt" | "isLate" | "lateMinutes"
  >,
): Promise<string> => {
  try {
    // Get attendance settings to determine work start time
    const settings = await getAttendanceSettings(data.companyId, data.branchId);
    const workStartTime = settings?.workStartTime || DEFAULT_WORK_START_TIME;

    // Calculate if late (only for check-in, not check-out)
    let lateInfo = { isLate: false, lateMinutes: 0 };
    if (data.type === "check-in") {
      lateInfo = checkIfLate(new Date(), workStartTime);
    }

    const checkInsRef = collection(db, "checkIns");

    const newCheckIn = {
      ...data,
      isLate: lateInfo.isLate,
      lateMinutes: lateInfo.lateMinutes,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(checkInsRef, newCheckIn);

    return docRef.id;
  } catch (error) {
    console.error("Error creating check-in:", error);
    throw error;
  }
};

/**
 * Get today's check-in for a user
 */
export const getTodayCheckIn = async (
  userId: string,
  type: CheckInType,
): Promise<CheckIn | null> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkInsRef = collection(db, "checkIns");
    const q = query(
      checkInsRef,
      where("userId", "==", userId),
      where("type", "==", type),
      where("createdAt", ">=", Timestamp.fromDate(today)),
      where("createdAt", "<", Timestamp.fromDate(tomorrow)),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data(),
      } as CheckIn;
    }

    return null;
  } catch (error) {
    console.error("Error getting today's check-in:", error);
    return null;
  }
};

/**
 * Get user's check-in history
 */
export const getUserCheckInHistory = async (
  userId: string,
  limitCount: number = 30,
): Promise<CheckIn[]> => {
  try {
    const checkInsRef = collection(db, "checkIns");
    const q = query(
      checkInsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CheckIn[];
  } catch (error) {
    console.error("Error getting check-in history:", error);
    throw error;
  }
};

/**
 * Get check-ins by company for a specific date
 */
export const getCompanyCheckIns = async (
  companyId: string,
  date: Date,
  branchId?: string,
): Promise<CheckIn[]> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const checkInsRef = collection(db, "checkIns");
    let q;

    if (branchId) {
      q = query(
        checkInsRef,
        where("companyId", "==", companyId),
        where("branchId", "==", branchId),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
        orderBy("createdAt", "desc"),
      );
    } else {
      q = query(
        checkInsRef,
        where("companyId", "==", companyId),
        where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
        where("createdAt", "<=", Timestamp.fromDate(endOfDay)),
        orderBy("createdAt", "desc"),
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CheckIn[];
  } catch (error) {
    console.error("Error getting company check-ins:", error);
    throw error;
  }
};

/**
 * Get check-in by ID
 */
export const getCheckInById = async (
  checkInId: string,
): Promise<CheckIn | null> => {
  try {
    const checkInDoc = await getDoc(doc(db, "checkIns", checkInId));

    if (checkInDoc.exists()) {
      return { id: checkInDoc.id, ...checkInDoc.data() } as CheckIn;
    }

    return null;
  } catch (error) {
    console.error("Error getting check-in:", error);
    throw error;
  }
};
