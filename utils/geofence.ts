/**
 * Geofence utilities — สำหรับตรวจสอบว่าผู้ใช้อยู่ในพื้นที่สาขาหรือไม่
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BranchGeofence {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
}

/**
 * คำนวณระยะทางระหว่าง 2 จุด (Haversine formula)
 * @returns ระยะทางเป็นเมตร
 */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const aa =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

  return R * c;
}

export interface GeofenceResult {
  /** สาขามีพิกัดตั้งไว้หรือไม่ */
  hasBranchCoords: boolean;
  /** อยู่ในรัศมีหรือไม่ (true ถ้าสาขายังไม่ตั้งพิกัด — ไม่ block) */
  withinRadius: boolean;
  /** ระยะทางจริง (เมตร) — null ถ้าสาขายังไม่ตั้งพิกัด */
  distanceMeters: number | null;
  /** รัศมีที่อนุญาต */
  radiusMeters: number;
}

/**
 * ตรวจสอบว่าตำแหน่งผู้ใช้อยู่ในพื้นที่สาขาหรือไม่
 */
export function checkBranchGeofence(
  userLocation: LatLng | null | undefined,
  branch: BranchGeofence | null | undefined,
): GeofenceResult {
  // จำกัดรัศมีสูงสุดที่ 500 เมตร เพื่อป้องกันการตั้งค่ารัศมีกว้างเกินไป
  const MAX_RADIUS_METERS = 500;
  const radius = Math.min(branch?.radiusMeters || 200, MAX_RADIUS_METERS);

  // สาขายังไม่ตั้งพิกัด → ผ่าน (ไม่ block) แต่ระบุ flag
  if (
    !branch ||
    branch.latitude == null ||
    branch.longitude == null ||
    branch.latitude === 0 ||
    branch.longitude === 0
  ) {
    return {
      hasBranchCoords: false,
      withinRadius: true,
      distanceMeters: null,
      radiusMeters: radius,
    };
  }

  // ผู้ใช้ไม่ได้อนุญาต location หรือพิกัดเป็น 0,0
  if (
    !userLocation ||
    (userLocation.latitude === 0 && userLocation.longitude === 0)
  ) {
    return {
      hasBranchCoords: true,
      withinRadius: false,
      distanceMeters: null,
      radiusMeters: radius,
    };
  }

  const distance = haversineDistance(userLocation, {
    latitude: branch.latitude,
    longitude: branch.longitude,
  });

  return {
    hasBranchCoords: true,
    withinRadius: distance <= radius,
    distanceMeters: Math.round(distance),
    radiusMeters: radius,
  };
}

/**
 * ทำข้อความสรุปสำหรับแจ้ง user
 */
export function formatGeofenceWarning(result: GeofenceResult): string {
  if (!result.hasBranchCoords) {
    return "ยังไม่ได้ตั้งพิกัดสาขานี้ในระบบ — ข้ามการตรวจตำแหน่ง";
  }
  if (result.distanceMeters == null) {
    return "ไม่สามารถระบุตำแหน่งของคุณได้ กรุณาเปิด GPS";
  }
  if (result.withinRadius) {
    return `อยู่ในพื้นที่สาขา (ห่าง ${result.distanceMeters}m)`;
  }
  return `คุณอยู่ห่างสาขา ${result.distanceMeters} เมตร (อนุญาต ${result.radiusMeters}m) — ข้อมูลจะถูกบันทึกไว้`;
}
