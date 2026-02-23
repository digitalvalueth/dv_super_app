import { useAuthStore } from "@/stores/auth.store";
import { useDeliveryStore } from "@/stores/delivery.store";
import { useTheme } from "@/stores/theme.store";
import { createWatermarkMetadata } from "@/utils/watermark";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
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

export default function DeliveryCameraScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const { selectedShipment, setCapturedImage, setWatermarkData } =
    useDeliveryStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Pause camera when navigating away (prevents overheating)
  const [isCameraActive, setIsCameraActive] = useState(true);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);

      // Start getting watermark metadata in parallel with photo capture
      const watermarkPromise = createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
      );

      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (!photo?.uri || !photo?.base64) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
        return;
      }

      // Wait for watermark data
      const watermarkData = await watermarkPromise;

      // Store in zustand
      setCapturedImage(photo.uri);
      setWatermarkData(watermarkData);

      // Navigate to preview with photo data
      router.push({
        pathname: "/(mini-apps)/delivery-receive/preview",
        params: {
          imageUri: photo.uri,
          imageBase64: photo.base64,
          watermarkData: JSON.stringify(watermarkData),
        },
      });
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, setCapturedImage, setWatermarkData]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      if (!asset.base64) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถอ่านรูปภาพได้");
        return;
      }

      // Get watermark metadata
      const watermarkData = await createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
      );

      // Store in zustand
      setCapturedImage(asset.uri);
      setWatermarkData(watermarkData);

      // Navigate to preview
      router.push({
        pathname: "/(mini-apps)/delivery-receive/preview",
        params: {
          imageUri: asset.uri,
          imageBase64: asset.base64,
          watermarkData: JSON.stringify(watermarkData),
        },
      });
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถเลือกรูปภาพได้");
    }
  }, [user, setCapturedImage, setWatermarkData]);

  const toggleFlash = () => {
    setFlash((prev) => (prev === "off" ? "on" : "off"));
  };

  const toggleFacing = () => {
    setFacing((prev) => (prev === "back" ? "front" : "back"));
  };

  // Redirect if no shipment selected
  useFocusEffect(
    useCallback(() => {
      setIsCameraActive(true);
      return () => setIsCameraActive(false);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!selectedShipment) {
        const timeout = setTimeout(() => {
          router.back();
        }, 0);
        return () => clearTimeout(timeout);
      }
    }, [selectedShipment]),
  );

  if (!selectedShipment) {
    return (
      <View
        style={[
          styles.permissionContainer,
          { backgroundColor: colors.background },
        ]}
      />
    );
  }

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
            กรุณาอนุญาตการเข้าถึงกล้องเพื่อถ่ายรูปรับสินค้า
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
          <Text style={styles.headerTitle}>รับสินค้า</Text>
          <Text style={styles.headerSubtitle}>
            {selectedShipment.trackingNumber}
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
        <Text style={styles.guideText}>ถ่ายรูปพัสดุที่รับพร้อมกับตัวคุณ</Text>
      </View>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomControls} edges={["bottom"]}>
        {/* Gallery button */}
        <TouchableOpacity style={styles.sideButton} onPress={handlePickImage}>
          <Ionicons name="images-outline" size={28} color="#FFFFFF" />
        </TouchableOpacity>

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
        <TouchableOpacity style={styles.sideButton} onPress={toggleFacing}>
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
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  guideOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  guideFrame: {
    width: SCREEN_WIDTH - 48,
    aspectRatio: 4 / 3,
    position: "relative",
  },
  guideCorner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#FFFFFF",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  guideText: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 24,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
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
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.3)",
    gap: 40,
  },
  sideButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
