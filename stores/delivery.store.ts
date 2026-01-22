import {
  createDeliveryReceive,
  getPendingShipments,
  getShipmentByTracking,
  getUserDeliveryHistory,
  uploadDeliveryImage,
} from "@/services/delivery.service";
import { DeliveryReceive, Shipment } from "@/types";
import { WatermarkData } from "@/utils/watermark";
import { Timestamp } from "firebase/firestore";
import { create } from "zustand";

interface DeliveryState {
  // Shipment states
  pendingShipments: Shipment[];
  selectedShipment: Shipment | null;
  isLoadingShipments: boolean;

  // Receive states
  capturedImage: string | null;
  watermarkData: WatermarkData | null;
  history: DeliveryReceive[];
  isLoadingHistory: boolean;

  // Actions
  loadPendingShipments: (branchId: string) => Promise<void>;
  selectShipment: (shipment: Shipment | null) => void;
  searchByTracking: (trackingNumber: string) => Promise<Shipment | null>;
  setCapturedImage: (imageUri: string | null) => void;
  setWatermarkData: (data: WatermarkData | null) => void;
  confirmReceive: (
    userId: string,
    userName: string,
    branchId: string,
    branchName: string,
    notes?: string,
  ) => Promise<string>;
  loadHistory: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  pendingShipments: [],
  selectedShipment: null,
  isLoadingShipments: false,
  capturedImage: null,
  watermarkData: null,
  history: [],
  isLoadingHistory: false,
};

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  ...initialState,

  loadPendingShipments: async (branchId: string) => {
    set({ isLoadingShipments: true });
    try {
      const shipments = await getPendingShipments(branchId);
      set({ pendingShipments: shipments });
    } catch (error) {
      console.error("Error loading pending shipments:", error);
      throw error;
    } finally {
      set({ isLoadingShipments: false });
    }
  },

  selectShipment: (shipment: Shipment | null) => {
    set({ selectedShipment: shipment });
  },

  searchByTracking: async (trackingNumber: string) => {
    try {
      const shipment = await getShipmentByTracking(trackingNumber);
      if (shipment) {
        set({ selectedShipment: shipment });
      }
      return shipment;
    } catch (error) {
      console.error("Error searching shipment:", error);
      throw error;
    }
  },

  setCapturedImage: (imageUri: string | null) => {
    set({ capturedImage: imageUri });
  },

  setWatermarkData: (data: WatermarkData | null) => {
    set({ watermarkData: data });
  },

  confirmReceive: async (
    userId: string,
    userName: string,
    branchId: string,
    branchName: string,
    notes?: string,
  ) => {
    const { selectedShipment, capturedImage, watermarkData } = get();

    if (!selectedShipment) {
      throw new Error("No shipment selected");
    }

    if (!capturedImage) {
      throw new Error("No image captured");
    }

    // Generate a temporary ID for the upload
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Upload image
    const imageUrl = await uploadDeliveryImage(userId, tempId, capturedImage);

    // Create delivery receive record
    const receiveData: Parameters<typeof createDeliveryReceive>[0] = {
      shipmentId: selectedShipment.id!,
      trackingNumber: selectedShipment.trackingNumber,
      companyId: selectedShipment.companyId,
      branchId,
      branchName,
      products: selectedShipment.products,
      totalItems: selectedShipment.totalItems,
      receivedBy: userId,
      receivedByName: userName,
      receivedAt: Timestamp.now(),
      imageUrl,
      watermarkData: watermarkData
        ? {
            timestamp:
              watermarkData.timestamp instanceof Date
                ? watermarkData.timestamp.toISOString()
                : watermarkData.timestamp,
            location: watermarkData.location,
            coordinates: watermarkData.coordinates,
            employeeName: watermarkData.employeeName,
            employeeId: watermarkData.employeeId,
            deviceModel: watermarkData.deviceModel,
            deviceName: watermarkData.deviceName,
          }
        : undefined,
      status: "received",
    };

    // Only add notes if it has a value (Firebase doesn't accept undefined)
    if (notes) {
      receiveData.notes = notes;
    }

    const receiveId = await createDeliveryReceive(receiveData);

    return receiveId;
  },

  loadHistory: async (userId: string) => {
    set({ isLoadingHistory: true });
    try {
      const history = await getUserDeliveryHistory(userId);
      set({ history });
    } catch (error) {
      console.error("Error loading delivery history:", error);
      throw error;
    } finally {
      set({ isLoadingHistory: false });
    }
  },

  reset: () => {
    set({
      selectedShipment: null,
      capturedImage: null,
      watermarkData: null,
    });
  },
}));
