import { resolveProduct } from "@/services/shop-stock-receive.service";
import { useAuthStore } from "@/stores/auth.store";
import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { CameraView } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveForm() {
  const user = useAuthStore((s) => s.user);
  const { transferNumber, branchCode, items, addItem, removeItem, isOnline } =
    useShopStockReceiveStore();
  const [scanOpen, setScanOpen] = useState(false);
  const [draft, setDraft] = useState<
    | { productId: string; barcode: string; sku?: string; productName: string }
    | null
  >(null);
  const [sales, setSales] = useState("0");
  const [test, setTest] = useState("0");
  const [mkt, setMkt] = useState("0");
  const lastScan = useRef(0);

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - lastScan.current < 800) return;
      lastScan.current = now;
      setScanOpen(false);
      if (!user?.companyId) return;
      const p = await resolveProduct(user.companyId, data, isOnline);
      if (!p) {
        Alert.alert("ไม่พบสินค้า", `ไม่พบ barcode ${data} ในระบบ`);
        return;
      }
      setDraft({
        productId: p.id,
        barcode: data,
        sku: p.sku,
        productName: p.name,
      });
      setSales("0");
      setTest("0");
      setMkt("0");
    },
    [user?.companyId, isOnline],
  );

  const confirmAdd = useCallback(() => {
    if (!draft) return;
    const s = parseInt(sales, 10) || 0;
    const t = parseInt(test, 10) || 0;
    const m = parseInt(mkt, 10) || 0;
    if (s + t + m <= 0) {
      Alert.alert("จำนวนไม่ถูกต้อง", "ต้องมีอย่างน้อย 1 ช่องมากกว่า 0");
      return;
    }
    const err = addItem({
      productId: draft.productId,
      barcode: draft.barcode,
      sku: draft.sku,
      productName: draft.productName,
      salesQty: s,
      testQty: t,
      mktQty: m,
    });
    if (err) Alert.alert("เพิ่มไม่ได้", err);
    setDraft(null);
  }, [draft, sales, test, mkt, addItem]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.h1}>{transferNumber}</Text>
        <Text style={styles.h2}>สาขา {branchCode}</Text>
        {!isOnline && <Text style={styles.offline}>ออฟไลน์ — จะส่งเมื่อเน็ตกลับมา</Text>}
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.barcode}
        ListEmptyComponent={<Text style={styles.empty}>ยังไม่มีสินค้าในรายการ</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.productName}</Text>
              <Text style={styles.sub}>{item.barcode}</Text>
              <Text style={styles.sub}>
                Sales {item.salesQty} · Test {item.testQty} · Mkt {item.mktQty}
              </Text>
            </View>
            <Pressable onPress={() => removeItem(item.barcode)}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        )}
      />

      <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
        <Text style={styles.btnText}>＋ สแกนสินค้า</Text>
      </Pressable>
      <Pressable
        style={[styles.nextBtn, items.length === 0 && styles.disabled]}
        disabled={items.length === 0}
        onPress={() => router.push("/(mini-apps)/shop-stock-receive/camera" as any)}
      >
        <Text style={styles.btnText}>ถัดไป — ถ่ายรูปยืนยัน</Text>
      </Pressable>

      {/* scanner modal */}
      <Modal visible={scanOpen} animationType="slide">
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            active={scanOpen}
            onBarcodeScanned={scanOpen ? onScanned : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
            }}
          />
          <Pressable style={styles.closeBtn} onPress={() => setScanOpen(false)}>
            <Text style={styles.btnText}>ปิด</Text>
          </Pressable>
        </View>
      </Modal>

      {/* qty entry modal */}
      <Modal visible={!!draft} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.name}>{draft?.productName}</Text>
            <Text style={styles.sub}>{draft?.barcode}</Text>
            <QtyField label="Sales Qty" value={sales} onChange={setSales} />
            <QtyField label="Test Qty" value={test} onChange={setTest} />
            <QtyField label="Mkt Qty" value={mkt} onChange={setMkt} />
            <View style={styles.modalRow}>
              <Pressable style={styles.cancel} onPress={() => setDraft(null)}>
                <Text>ยกเลิก</Text>
              </Pressable>
              <Pressable style={styles.scanBtn} onPress={confirmAdd}>
                <Text style={styles.btnText}>＋ เพิ่ม</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function QtyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.qtyRow}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <TextInput
        style={styles.qtyInput}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { marginBottom: 12 },
  backBtn: { padding: 8, marginLeft: -8, marginBottom: 4 },
  h1: { fontSize: 18, fontWeight: "700" },
  h2: { color: "#666" },
  offline: { color: "#D97706", marginTop: 4 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
  remove: { color: "#EF4444", fontSize: 18, paddingHorizontal: 8 },
  scanBtn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  nextBtn: { backgroundColor: "#3B82F6", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  disabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontWeight: "700" },
  closeBtn: { backgroundColor: "#374151", padding: 14, alignItems: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 20, gap: 10 },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancel: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "#ccc" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyInput: { width: 90, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, textAlign: "center" },
});
