import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { useAuthStore } from "@/stores/auth.store";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function ShopStockReceiveReview() {
  const user = useAuthStore((s) => s.user);
  const {
    transferNumber,
    branchCode,
    items,
    capturedImageUri,
    submit,
    isSubmitting,
  } = useShopStockReceiveStore();
  const [notes, setNotes] = useState("");

  const onSubmit = async () => {
    if (!user) return;
    if (!capturedImageUri) {
      Alert.alert("ยังไม่มีรูป", "กรุณาถ่ายรูปยืนยันการรับก่อน");
      return;
    }
    try {
      const res = await submit(user, notes || undefined);
      router.replace(
        `/(mini-apps)/shop-stock-receive/result?queued=${res.queued ? 1 : 0}` as any,
      );
    } catch (e) {
      console.error(e);
      Alert.alert("ส่งไม่สำเร็จ", "เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
        <Ionicons name="arrow-back" size={24} color="#111" />
      </Pressable>
      <Text style={styles.h1}>ตรวจสอบก่อนส่ง</Text>
      <Text style={styles.h2}>{transferNumber} · สาขา {branchCode}</Text>

      {capturedImageUri && (
        <Image source={{ uri: capturedImageUri }} style={styles.image} />
      )}

      {items.map((i) => (
        <View key={i.barcode} style={styles.row}>
          <Text style={styles.name}>{i.productName}</Text>
          <Text style={styles.sub}>{i.barcode}</Text>
          <Text style={styles.sub}>
            Sales {i.salesQty} · Test {i.testQty} · Mkt {i.mktQty}
          </Text>
        </View>
      ))}

      <Text style={styles.label}>หมายเหตุ (ถ้ามี)</Text>
      <TextInput
        style={styles.notes}
        multiline
        placeholder="เช่น ของเสียหาย 2 กล่อง"
        value={notes}
        onChangeText={setNotes}
      />

      <Pressable
        style={[styles.btn, isSubmitting && styles.disabled]}
        disabled={isSubmitting}
        onPress={onSubmit}
      >
        <Text style={styles.btnText}>
          {isSubmitting ? "กำลังส่ง..." : "📤 ยืนยันการรับสินค้า"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  backBtn: { padding: 8, marginLeft: -8, marginBottom: 4 },
  h1: { fontSize: 20, fontWeight: "700" },
  h2: { color: "#666", marginBottom: 12 },
  image: { width: "100%", height: 220, borderRadius: 12, marginBottom: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 6 },
  notes: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, minHeight: 70, textAlignVertical: "top" },
  btn: { backgroundColor: "#10B981", padding: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  disabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
