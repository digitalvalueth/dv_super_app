import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { createWatermarkMetadata, getCurrentLocation } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CameraScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{
    productId?: string;
    productName?: string;
    productBarcode?: string;
    assignmentId?: string;
    beforeQty?: string;
    assignmentBranchId?: string;
    existingSessionId?: string;
    isSupplementMode?: string; // "true" when opening from history ถ่ายเพิ่ม
    originalSessionId?: string; // original countingSession id for supplement
    isSupplemental?: string; // "true" เมื่อถ่ายรูปเพิ่มเติม (ต่างจากจำนวนหลัก)
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Pre-fetch location when camera mounts so it’s ready when user taps capture
  const [prefetchedLocation, setPrefetchedLocation] = useState<{
    address: string;
    coordinates: { latitude: number; longitude: number };
  } | null>(null);

  // Pause camera when navigating away (prevents overheating)
  const [isCameraActive, setIsCameraActive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      return () => setIsCameraActive(false); // called when screen loses focus
    }, []),
  );

  // Native barcode scan state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const lastScanRef = useRef<number>(0);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    const now = Date.now();
    // Debounce — process at most once per 800ms
    if (now - lastScanRef.current < 800) return;
    lastScanRef.current = now;
    setScannedBarcode(data);
  }, []);

  const barcodeMatchesExpected =
    params.productBarcode && scannedBarcode
      ? scannedBarcode === params.productBarcode
      : null;

  useEffect(() => {
    getCurrentLocation()
      .then(setPrefetchedLocation)
      .catch(() => {});
  }, []);

  // Geofence check — block camera if user is outside branch radius
  const geofenceCheckedRef = useRef(false);
  useEffect(() => {
    if (geofenceCheckedRef.current) return;
    if (!user?.branchId || !prefetchedLocation?.coordinates) return;
    geofenceCheckedRef.current = true;
    (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/config/firebase");
        const { checkBranchGeofence, formatGeofenceWarning } =
          await import("@/utils/geofence");
        const branchSnap = await getDoc(doc(db, "branches", user.branchId!));
        if (!branchSnap.exists()) return;
        const b = branchSnap.data() as {
          latitude?: number;
          longitude?: number;
          radiusMeters?: number;
        };
        const result = checkBranchGeofence(prefetchedLocation.coordinates, b);
        if (result.hasBranchCoords && !result.withinRadius) {
          Alert.alert(
            "⚠️ อยู่นอกพื้นที่สาขา",
            formatGeofenceWarning(result) +
              "\n\nไม่สามารถถ่ายรูปจากนอกพื้นที่สาขาได้",
            [{ text: "ย้อนกลับ", onPress: () => router.back() }],
            { cancelable: false },
          );
        }
      } catch (err) {
        console.warn("Geofence check failed:", err);
      }
    })();
  }, [user?.branchId, prefetchedLocation]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      // Start getting watermark metadata in parallel with photo capture
      const watermarkPromise = createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
        user?.branchName || "",
        params.productName,
        params.productBarcode,
        prefetchedLocation ?? undefined,
      );

      // Take photo — no base64 here, just get the URI fast
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.82, // Balanced quality — good enough for barcode, faster than 0.9
      });

      if (!photo?.uri) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
        return;
      }

      // Wait for watermark data (should already be ready from pre-fetch)
      const watermarkData = await watermarkPromise;

      // Navigate to preview immediately with just the URI — no base64 overhead
      router.push({
        pathname: "/(mini-apps)/stock-counter/preview",
        params: {
          imageUri: photo.uri,
          imageBase64: "", // will be read lazily in preview when AI is triggered
          watermarkData: JSON.stringify(watermarkData),
          productId: params.productId,
          productName: params.productName,
          productBarcode: params.productBarcode,
          assignmentId: params.assignmentId,
          beforeQty: params.beforeQty,
          assignmentBranchId: params.assignmentBranchId || "",
          existingSessionId: params.existingSessionId || "",
          nativeScannedBarcode: scannedBarcode || "", // barcode read by native scanner (100% accurate)
          isSupplementMode: params.isSupplementMode || "",
          originalSessionId: params.originalSessionId || "",
          isSupplemental: params.isSupplemental || "",
        },
      });
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapturing, user, params, prefetchedLocation]);

  const toggleFlash = () => {
    setFlash((prev) => (prev === "off" ? "on" : "off"));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  // Request permission if not granted
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Ionicons
            name="camera-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            ต้องการสิทธิ์กล้อง
          </Text>
          <Text
            style={[styles.permissionText, { color: colors.textSecondary }]}
          >
            กรุณาอนุญาตการเข้าถึงกล้องเพื่อถ่ายรูปสินค้า
          </Text>
          <TouchableOpacity
            style={[
              styles.permissionButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>
              อนุญาตการเข้าถึงกล้อง
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        active={isCameraActive}
        onBarcodeScanned={isCameraActive ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
          ],
        }}
      />

      {/* Header - Absolute positioned */}
      <SafeAreaView style={styles.header} edges={["top"]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {params.productName && (
            <Text style={styles.productName} numberOfLines={1}>
              📦 {params.productName}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={toggleFlash}>
          <Ionicons
            name={flash === "on" ? "flash" : "flash-off"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Guide overlay - Absolute positioned */}
      <View style={styles.guideContainer}>
        <View
          style={[
            styles.guideBox,
            barcodeMatchesExpected === true && styles.guideBoxMatched,
            barcodeMatchesExpected === false && styles.guideBoxMismatched,
          ]}
        >
          <View style={[styles.guideCorner, styles.topLeft]} />
          <View style={[styles.guideCorner, styles.topRight]} />
          <View style={[styles.guideCorner, styles.bottomLeft]} />
          <View style={[styles.guideCorner, styles.bottomRight]} />
        </View>

        {/* Barcode scan status banner */}
        {scannedBarcode ? (
          <View
            style={[
              styles.barcodeBanner,
              {
                backgroundColor:
                  barcodeMatchesExpected === true
                    ? "rgba(22,163,74,0.92)"
                    : barcodeMatchesExpected === false
                      ? "rgba(220,38,38,0.92)"
                      : "rgba(0,0,0,0.75)",
              },
            ]}
          >
            <Ionicons
              name={
                barcodeMatchesExpected === true
                  ? "checkmark-circle"
                  : barcodeMatchesExpected === false
                    ? "close-circle"
                    : "barcode"
              }
              size={20}
              color="#fff"
            />
            <Text style={styles.barcodeBannerText}>
              {barcodeMatchesExpected === true
                ? `✅ บาร์โค้ดตรง: ${scannedBarcode}`
                : barcodeMatchesExpected === false
                  ? `❌ ไม่ตรง: ${scannedBarcode}`
                  : `📷 พบ: ${scannedBarcode}`}
            </Text>
          </View>
        ) : (
          <Text style={styles.guideText}>
            {params.productBarcode
              ? `สแกนหาบาร์โค้ด: ${params.productBarcode}`
              : "วางสินค้าในกรอบ ให้เห็น Barcode ชัดเจน"}
          </Text>
        )}
      </View>

      {/* Bottom controls - Absolute positioned */}
      <SafeAreaView style={styles.controls} edges={["bottom"]}>
        {/* Capture button */}
        <TouchableOpacity
          style={styles.captureButton}
          onPress={handleCapture}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>

        {/* Flip camera button */}
        <TouchableOpacity style={styles.flipButton} onPress={toggleFacing}>
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContent: {
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  permissionText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 12,
  },
  productName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  guideContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  guideBox: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    position: "relative",
  },
  guideBoxMatched: {
    borderColor: "#16a34a",
  },
  guideBoxMismatched: {
    borderColor: "#dc2626",
  },
  barcodeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  barcodeBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  guideCorner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#fff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  guideText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 24,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
  },
  controls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 32,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  flipButton: {
    position: "absolute",
    right: 48,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
});
