import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import { createWatermarkMetadata } from "@/utils/watermark";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

export default function ShopStockReceiveCamera() {
  const user = useAuthStore((s) => s.user);
  const setCapturedImage = useShopStockReceiveStore((s) => s.setCapturedImage);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    try {
      setIsCapturing(true);
      const watermarkPromise = createWatermarkMetadata(
        user?.name || "Unknown",
        user?.uid || "",
      );
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
        return;
      }
      const watermark = await watermarkPromise;
      setCapturedImage(photo.uri, watermark);
      router.push("/(mini-apps)/shop-stock-receive/review" as any);
    } catch (e) {
      console.error("capture error", e);
      Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถถ่ายรูปได้");
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, user, setCapturedImage]);

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text>ต้องการสิทธิ์กล้อง</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>อนุญาต</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <Pressable style={styles.backFloat} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>
      <View style={styles.controls}>
        <Text style={styles.hint}>ถ่ายรูปยืนยันการรับสินค้า</Text>
        <Pressable
          style={[styles.shutter, isCapturing && styles.disabled]}
          disabled={isCapturing}
          onPress={handleCapture}
        >
          <Text style={styles.btnText}>{isCapturing ? "กำลังถ่าย..." : "ถ่ายรูป"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  controls: { padding: 20, backgroundColor: "#000", alignItems: "center", gap: 12 },
  hint: { color: "#fff" },
  shutter: { backgroundColor: "#10B981", paddingVertical: 16, paddingHorizontal: 40, borderRadius: 40 },
  disabled: { opacity: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
  backFloat: { position: "absolute", top: 52, left: 16, zIndex: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20, padding: 8 },
});
