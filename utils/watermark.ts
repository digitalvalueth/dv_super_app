import * as Device from "expo-device";
import * as Location from "expo-location";

export interface WatermarkData {
  employeeName: string;
  employeeId: string;
  deviceName: string;
  deviceModel: string;
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
  productName?: string;
  productBarcode?: string;
}

/**
 * Get device information for watermark
 */
export const getDeviceInfo = (): {
  deviceName: string;
  deviceModel: string;
} => {
  const deviceName = Device.deviceName || "Unknown Device";
  const deviceModel = Device.modelName || Device.modelId || "Unknown Model";
  return { deviceName, deviceModel };
};

/**
 * Get current location for watermark (optimized for speed)
 */
export const getCurrentLocation = async (): Promise<{
  address: string;
  coordinates: { latitude: number; longitude: number };
}> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      return {
        address: "ไม่ได้รับอนุญาตตำแหน่ง",
        coordinates: { latitude: 0, longitude: 0 },
      };
    }

    // Use Balanced accuracy for faster response (High is too slow)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Try to get address, but don't wait too long
    let addressText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    
    try {
      // Wrap reverseGeocode in a timeout
      const geocodePromise = Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 2000)
      );
      
      const result = await Promise.race([geocodePromise, timeoutPromise]);
      
      if (result && result[0]) {
        const address = result[0];
        const parts = [
          address.street,
          address.district,
          address.subregion,
          address.city,
          address.region,
        ].filter(Boolean);
        if (parts.length > 0) {
          addressText = parts.join(", ");
        }
      }
    } catch {
      // Use coordinates as fallback
    }

    return {
      address: addressText,
      coordinates: { latitude, longitude },
    };
  } catch (error) {
    console.error("Error getting location:", error);
    return {
      address: "ไม่สามารถระบุตำแหน่งได้",
      coordinates: { latitude: 0, longitude: 0 },
    };
  }
};

/**
 * Format timestamp for watermark
 */
export const formatTimestamp = (date: Date): string => {
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

/**
 * Generate watermark text lines
 */
export const generateWatermarkLines = (data: WatermarkData): string[] => {
  const lines: string[] = [];

  // Line 1: Employee info
  lines.push(`👤 ${data.employeeName}`);

  // Line 2: Device info
  lines.push(`📱 ${data.deviceModel}`);

  // Line 3: Location
  lines.push(`📍 ${data.location}`);

  // Line 4: Timestamp
  lines.push(`🕐 ${formatTimestamp(data.timestamp)}`);

  // Line 5: Product info (if available)
  if (data.productName) {
    lines.push(`📦 ${data.productName}`);
  }

  return lines;
};

/**
 * Create watermark metadata object
 */
export const createWatermarkMetadata = async (
  employeeName: string,
  employeeId: string,
  productName?: string,
  productBarcode?: string
): Promise<WatermarkData> => {
  const { deviceName, deviceModel } = getDeviceInfo();
  const { address, coordinates } = await getCurrentLocation();

  return {
    employeeName,
    employeeId,
    deviceName,
    deviceModel,
    location: address,
    coordinates,
    timestamp: new Date(),
    productName,
    productBarcode,
  };
};
