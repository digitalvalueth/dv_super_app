import { db, storage } from "@/config/firebase";
import {
  DeliveryReceive,
  Shipment,
  ShipmentProduct,
  ShipmentStatus,
} from "@/types";
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
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

// ==================== Shipment Functions ====================

/**
 * Get pending shipments for a branch
 */
export const getPendingShipments = async (
  branchId: string,
): Promise<Shipment[]> => {
  try {
    const shipmentsRef = collection(db, "shipments");
    const q = query(
      shipmentsRef,
      where("branchId", "==", branchId),
      where("status", "in", ["pending", "in_transit"]),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Shipment[];
  } catch (error) {
    console.error("Error getting pending shipments:", error);
    throw error;
  }
};

/**
 * Get shipment by ID
 */
export const getShipmentById = async (
  shipmentId: string,
): Promise<Shipment | null> => {
  try {
    const shipmentDoc = await getDoc(doc(db, "shipments", shipmentId));

    if (shipmentDoc.exists()) {
      return { id: shipmentDoc.id, ...shipmentDoc.data() } as Shipment;
    }

    return null;
  } catch (error) {
    console.error("Error getting shipment:", error);
    throw error;
  }
};

/**
 * Get shipment by tracking number
 */
export const getShipmentByTracking = async (
  trackingNumber: string,
): Promise<Shipment | null> => {
  try {
    const shipmentsRef = collection(db, "shipments");
    const q = query(
      shipmentsRef,
      where("trackingNumber", "==", trackingNumber),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as Shipment;
    }

    return null;
  } catch (error) {
    console.error("Error getting shipment by tracking:", error);
    throw error;
  }
};

/**
 * Update shipment status
 */
export const updateShipmentStatus = async (
  shipmentId: string,
  status: ShipmentStatus,
): Promise<void> => {
  try {
    const shipmentRef = doc(db, "shipments", shipmentId);
    await updateDoc(shipmentRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error("Error updating shipment status:", error);
    throw error;
  }
};

/**
 * Create a mock shipment (for demo)
 */
export const createMockShipment = async (
  companyId: string,
  branchId: string,
  branchName: string,
  products: ShipmentProduct[],
): Promise<string> => {
  try {
    // Generate tracking number
    const trackingNumber = `TH${Date.now()}${Math.random().toString().slice(2, 6)}`;

    const shipmentsRef = collection(db, "shipments");

    const newShipment: Omit<Shipment, "id"> = {
      trackingNumber,
      companyId,
      branchId,
      branchName,
      products,
      totalItems: products.reduce((sum, p) => sum + p.quantity, 0),
      deliveryPersonName: `พนักงานส่ง ${Math.floor(Math.random() * 100)}`,
      deliveryCompany: "Demo Logistics",
      deliveryPhone: `08${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0")}`,
      status: "in_transit",
      estimatedDelivery: Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      ), // Tomorrow
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(shipmentsRef, newShipment);
    return docRef.id;
  } catch (error) {
    console.error("Error creating mock shipment:", error);
    throw error;
  }
};

// ==================== Delivery Receive Functions ====================

/**
 * Upload delivery receive image to Firebase Storage
 */
export const uploadDeliveryImage = async (
  userId: string,
  receiveId: string,
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
      `delivery-receives/${userId}/${dateStr}/${receiveId}.jpg`,
    );

    // Upload image
    await uploadBytes(storageRef, blob);

    // Get download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading delivery image:", error);
    throw error;
  }
};

/**
 * Create delivery receive record
 */
export const createDeliveryReceive = async (
  data: Omit<DeliveryReceive, "id" | "createdAt" | "updatedAt">,
): Promise<string> => {
  try {
    const receivesRef = collection(db, "deliveryReceives");

    const newReceive = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(receivesRef, newReceive);

    // Update shipment status to "received"
    await updateShipmentStatus(data.shipmentId, "received");

    return docRef.id;
  } catch (error) {
    console.error("Error creating delivery receive:", error);
    throw error;
  }
};

/**
 * Get delivery receive by ID
 */
export const getDeliveryReceiveById = async (
  receiveId: string,
): Promise<DeliveryReceive | null> => {
  try {
    const receiveDoc = await getDoc(doc(db, "deliveryReceives", receiveId));

    if (receiveDoc.exists()) {
      return { id: receiveDoc.id, ...receiveDoc.data() } as DeliveryReceive;
    }

    return null;
  } catch (error) {
    console.error("Error getting delivery receive:", error);
    throw error;
  }
};

/**
 * Get user's delivery receive history
 */
export const getUserDeliveryHistory = async (
  userId: string,
  limitCount: number = 30,
): Promise<DeliveryReceive[]> => {
  try {
    const receivesRef = collection(db, "deliveryReceives");
    const q = query(
      receivesRef,
      where("receivedBy", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DeliveryReceive[];
  } catch (error) {
    console.error("Error getting delivery history:", error);
    throw error;
  }
};

/**
 * Get branch's delivery receive history
 */
export const getBranchDeliveryHistory = async (
  branchId: string,
  limitCount: number = 50,
): Promise<DeliveryReceive[]> => {
  try {
    const receivesRef = collection(db, "deliveryReceives");
    const q = query(
      receivesRef,
      where("branchId", "==", branchId),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DeliveryReceive[];
  } catch (error) {
    console.error("Error getting branch delivery history:", error);
    throw error;
  }
};

/**
 * Get today's received shipments for a branch
 */
export const getTodayReceivedShipments = async (
  branchId: string,
): Promise<DeliveryReceive[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const receivesRef = collection(db, "deliveryReceives");
    const q = query(
      receivesRef,
      where("branchId", "==", branchId),
      where("createdAt", ">=", Timestamp.fromDate(today)),
      where("createdAt", "<", Timestamp.fromDate(tomorrow)),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as DeliveryReceive[];
  } catch (error) {
    console.error("Error getting today's received shipments:", error);
    throw error;
  }
};
