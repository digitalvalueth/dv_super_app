import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveIndex() {
  const user = useAuthStore((s) => s.user);
  const { startTransfer, setOnline, flushQueue, preloadProductCache } =
    useShopStockReceiveStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [manual, setManual] = useState("");
  const lastScan = useRef(0);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setOnline(online);
      if (online) flushQueue().catch(() => {});
    });
    if (user?.companyId) preloadProductCache(user.companyId);
    return () => unsub();
  }, [user?.companyId, setOnline, flushQueue, preloadProductCache]);

  const handle = useCallback(
    (raw: string) => {
      if (!user) return;
      const err = startTransfer(raw, user);
      if (err) {
        setScanning(true);
        Alert.alert("ไม่สามารถรับสินค้าได้", err);
        return;
      }
      router.push("/(mini-apps)/shop-stock-receive/form" as any);
    },
    [user, startTransfer],
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - lastScan.current < 800) return;
      lastScan.current = now;
      setScanning(false);
      handle(data);
    },
    [handle],
  );

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>ต้องการสิทธิ์กล้องเพื่อสแกน QR</Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>อนุญาตกล้อง</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        active={scanning}
        onBarcodeScanned={scanning ? onBarcodeScanned : undefined}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39"] }}
      />
      <Pressable style={styles.backFloat} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>
      <View style={styles.overlay}>
        <Text style={styles.title}>สแกน QR ใบส่งสินค้า</Text>
        <Text style={styles.subtitle}>หรือพิมพ์เลข Transfer เอง</Text>
        <TextInput
          style={styles.input}
          placeholder="SR-20260617-7 && BL 41060"
          value={manual}
          onChangeText={setManual}
          autoCapitalize="characters"
        />
        <Pressable style={styles.btn} onPress={() => manual && handle(manual)}>
          <Text style={styles.btnText}>ตรวจสอบ</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.push("/(mini-apps)/shop-stock-receive/history" as any)}>
          <Text style={styles.linkText}>ประวัติการรับสินค้า</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  overlay: { padding: 20, backgroundColor: "#fff", gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#666" },
  info: { fontSize: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  link: { alignItems: "center", padding: 8 },
  linkText: { color: "#10B981", fontWeight: "600" },
  backFloat: { position: "absolute", top: 52, left: 16, zIndex: 10, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20, padding: 8 },
});
