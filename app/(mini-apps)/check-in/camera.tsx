import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import {
  createWatermarkMetadata,
  getCurrentLocation,
  getServerTimestamp,
} from "@/utils/watermark";
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

export default function CheckInCameraScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{
    type?: string; // "check-in" or "check-out"
    selectedShift?: string;
    selectedBranchId?: string;
    selectedBranchName?: string;
  }>();

  const checkInType = (params.type as "check-in" | "check-out") || "check-in";
  const isCheckIn = checkInType === "check-in";
  const selectedShift = params.selectedShift;
  const selectedBranchId = params.selectedBranchId || "";
  const selectedBranchName = params.selectedBranchName || "";

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Pre-fetch location & server time when camera mounts so it's ready when user taps capture
  const [prefetchedLocation, setPrefetchedLocation] = useState<{
    address: string;
    coordinates: { latitude: number; longitude: number };
  } | null>(null);
  const [prefetchedServerTime, setPrefetchedServerTime] = useState<Date | null>(
    null,
  );

  useEffect(() => {
    getCurrentLocation()
      .then(setPrefetchedLocation)
      .catch(() => {});
    getServerTimestamp()
      .then(setPrefetchedServerTime)
      .catch(() => {});
  }, []);

  // Pause camera when navigating away (prevents overheating)
  const [isCameraActive, setIsCameraActive] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      return () => setIsCameraActive(false);
    }, []),
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      // Start getting watermark metadata in parallel with photo capture
      const watermarkPromise = createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
        selectedBranchName || user?.branchName || "",
        undefined,
        undefined,
        prefetchedLocation ?? undefined,
        prefetchedServerTime ?? undefined,
      );

      // Take photo — URI only (no base64/exif overhead = much faster)
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo?.uri) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
        return;
      }

      // Wait for watermark data (should already be ready from pre-fetch)
      const watermarkData = await watermarkPromise;

      // Navigate to preview immediately — no base64 needed for check-in upload
      router.push({
        pathname: "/(mini-apps)/check-in/preview",
        params: {
          imageUri: photo.uri,
          imageBase64: "",
          watermarkData: JSON.stringify(watermarkData),
          type: checkInType,
          selectedShift: selectedShift || "",
          selectedBranchId: selectedBranchId || "",
          selectedBranchName: selectedBranchName || "",
        },
      });
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
  }, [
    isCapturing,
    user,
    checkInType,
    prefetchedLocation,
    prefetchedServerTime,
    selectedShift,
    selectedBranchId,
    selectedBranchName,
  ]);

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
            กรุณาอนุญาตการเข้าถึงกล้องเพื่อถ่ายรูปเช็คชื่อ
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
      />

      {/* Header - Absolute positioned */}
      <SafeAreaView style={styles.header} edges={["top"]}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isCheckIn ? "ลงเวลาเข้างาน" : "ลงเวลาเลิกงาน"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {selectedBranchName || user?.branchName
              ? `สาขา: ${selectedBranchName || user?.branchName}`
              : "ถ่ายรูปยืนยันพร้อมบูธของคุณ"}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerButton} onPress={toggleFlash}>
          <Ionicons
            name={flash === "on" ? "flash" : "flash-off"}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Guide overlay */}
      <View style={styles.guideOverlay}>
        <View style={styles.guideFrame}>
          <View style={[styles.guideCorner, styles.topLeft]} />
          <View style={[styles.guideCorner, styles.topRight]} />
          <View style={[styles.guideCorner, styles.bottomLeft]} />
          <View style={[styles.guideCorner, styles.bottomRight]} />
        </View>
        <Text style={styles.guideText}>จัดให้เห็นตัวคุณและบูธในภาพ</Text>
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomControls} edges={["bottom"]}>
        {/* Capture button */}
        <TouchableOpacity
          style={[
            styles.captureButton,
            isCapturing && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={isCapturing}
        >
          {isCapturing ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <View style={styles.captureButtonInner} />
          )}
        </TouchableOpacity>

        {/* Flip camera button */}
        <TouchableOpacity style={styles.flipButton} onPress={toggleFacing}>
          <Ionicons name="camera-reverse-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  permissionContent: {
    alignItems: "center",
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  guideOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  guideFrame: {
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 1.1,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 16,
    position: "relative",
  },
  guideCorner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#FFFFFF",
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  guideText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 16,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
    borderColor: "#FFFFFF",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
  },
});
