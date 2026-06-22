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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ShopStockReceiveIndex() {
  const insets = useSafeAreaInsets();
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
      {/* header bar overlaying top of camera */}
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>รับสินค้า (Transfer)</Text>
      </View>
      {/* QR scan guide frame */}
      <View style={styles.guideWrapper} pointerEvents="none">
        <View style={styles.guideFrame} />
        <Text style={styles.guideHint}>เล็งกล้องไปที่ QR Code บนใบส่งสินค้า</Text>
      </View>
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
  // header bar
  headerBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingBottom: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  headerBack: { padding: 8 },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "600", flex: 1 },
  // scan guide
  guideWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  guideFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  guideHint: {
    color: "#fff",
    marginTop: 16,
    textAlign: "center",
    fontSize: 14,
  },
});
