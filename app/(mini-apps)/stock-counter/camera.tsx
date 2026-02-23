import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import {
  createWatermarkMetadata,
  getCurrentLocation,
  validateImageExif,
} from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
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
    existingSessionId?: string;
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
        quality: 0.7,
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
          existingSessionId: params.existingSessionId || "",
          nativeScannedBarcode: scannedBarcode || "", // barcode read by native scanner (100% accurate)
        },
      });
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, params, prefetchedLocation]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        // No base64: true here — read lazily in preview when AI is triggered (same as camera capture)
        exif: true, // Required for metadata validation only
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      // Validate EXIF metadata from the gallery image
      const exifResult = validateImageExif(
        asset.exif as Record<string, unknown>,
      );

      if (exifResult.reason === "too_old") {
        const takenAtStr = exifResult.takenAt
          ? exifResult.takenAt.toLocaleString("th-TH", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "";
        Alert.alert(
          "รูปภาพเก่าเกินไป",
          `รูปนี้ถ่ายเมื่อ ${takenAtStr}\nกรุณาถ่ายรูปใหม่โดยตรงจากกล้องถ่าย`,
        );
        return;
      }

      if (exifResult.reason === "no_exif" || exifResult.reason === "no_date") {
        // Image has no EXIF — likely screenshot or downloaded image
        let proceed = false;
        await new Promise<void>((resolve) => {
          Alert.alert(
            "ไม่พบข้อมูลภาพ",
            "รูปนี้ไม่มีข้อมูลวันเวลาถ่าย (อาจเป็น screenshot หรือรูปที่ดาวน์โหลด)\nแนะนำให้ถ่ายรูปสดจากกล้อง ต้องการใช้รูปนี้ต่อไปหรือไม่?",
            [
              {
                text: "ถ่ายใหม่",
                style: "cancel",
                onPress: () => {
                  proceed = false;
                  resolve();
                },
              },
              {
                text: "ใช้ต่อไป",
                onPress: () => {
                  proceed = true;
                  resolve();
                },
              },
            ],
          );
        });
        if (!proceed) return;
      }

      // Get watermark metadata (use pre-fetched location if available)
      const watermarkData = await createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
        user?.branchName || "",
        params.productName,
        params.productBarcode,
        prefetchedLocation ?? undefined,
      );

      // Navigate to preview
      router.push({
        pathname: "/(mini-apps)/stock-counter/preview",
        params: {
          imageUri: asset.uri,
          imageBase64: "", // lazy read in preview, same as camera capture
          watermarkData: JSON.stringify(watermarkData),
          productId: params.productId,
          productName: params.productName,
          productBarcode: params.productBarcode,
          assignmentId: params.assignmentId,
          beforeQty: params.beforeQty,
          existingSessionId: params.existingSessionId || "",
          nativeScannedBarcode: scannedBarcode || "",
        },
      });
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกรูปภาพได้");
    }
  }, [user, params]);

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
            "qr",
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
        {/* Gallery button */}
        <TouchableOpacity style={styles.sideButton} onPress={handlePickImage}>
          <Ionicons name="images" size={28} color="#fff" />
        </TouchableOpacity>

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
        <TouchableOpacity style={styles.sideButton} onPress={toggleFacing}>
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
    justifyContent: "space-around",
    paddingVertical: 24,
    paddingHorizontal: 32,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sideButton: {
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
