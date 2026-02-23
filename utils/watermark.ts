import * as Device from "expo-device";
import * as Location from "expo-location";

export interface WatermarkData {
  employeeName: string;
  employeeId: string;
  branchName?: string;
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

    // Use Low accuracy — fastest GPS fix, sufficient for watermark
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    const { latitude, longitude } = location.coords;
    // Use coordinates directly — skip reverseGeocodeAsync (network call)
    const addressText = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

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

export interface ExifValidationResult {
  valid: boolean;
  takenAt: Date | null;
  /** "no_exif" | "no_date" | "too_old" | "ok" */
  reason: string;
}

/**
 * Validate EXIF metadata from a gallery-picked image.
 * - no_exif  : image has no EXIF at all (screenshot / downloaded image)
 * - no_date  : EXIF exists but no DateTimeOriginal/DateTime field
 * - too_old  : photo was taken more than maxAgeMinutes ago → block
 * - ok       : photo is recent enough
 */
export const validateImageExif = (
  exif: Record<string, unknown> | null | undefined,
  maxAgeMinutes = 120,
): ExifValidationResult => {
  if (!exif || Object.keys(exif).length === 0) {
    return { valid: false, takenAt: null, reason: "no_exif" };
  }

  const dateStr =
    (exif.DateTimeOriginal as string | undefined) ||
    (exif.DateTime as string | undefined);

  if (!dateStr) {
    return { valid: false, takenAt: null, reason: "no_date" };
  }

  // EXIF date format: "YYYY:MM:DD HH:MM:SS"
  const normalized = (dateStr as string).replace(
    /^(\d{4}):(\d{2}):(\d{2})/,
    "$1-$2-$3",
  );
  const takenAt = new Date(normalized);

  if (isNaN(takenAt.getTime())) {
    return { valid: false, takenAt: null, reason: "no_date" };
  }

  const ageMinutes = (Date.now() - takenAt.getTime()) / (1000 * 60);
  if (ageMinutes > maxAgeMinutes) {
    return { valid: false, takenAt, reason: "too_old" };
  }

  return { valid: true, takenAt, reason: "ok" };
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
 * Pass locationOverride to skip re-fetching location (faster)
 */
export const createWatermarkMetadata = async (
  employeeName: string,
  employeeId: string,
  branchName?: string,
  productName?: string,
  productBarcode?: string,
  locationOverride?: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  },
): Promise<WatermarkData> => {
  const { deviceName, deviceModel } = getDeviceInfo();
  const { address, coordinates } =
    locationOverride ?? (await getCurrentLocation());

  return {
    employeeName,
    employeeId,
    branchName,
    deviceName,
    deviceModel,
    location: address,
    coordinates,
    timestamp: new Date(),
    productName,
    productBarcode,
  };
};
