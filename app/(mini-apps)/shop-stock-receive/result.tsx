import { useShopStockReceiveStore } from "@/stores/shop-stock-receive.store";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ShopStockReceiveResult() {
  const { queued } = useLocalSearchParams<{ queued?: string }>();
  const reset = useShopStockReceiveStore((s) => s.reset);
  const isQueued = queued === "1";

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isQueued ? "🕒" : "✅"}</Text>
      <Text style={styles.title}>
        {isQueued ? "บันทึกแล้ว รอส่งเมื่อเน็ตกลับมา" : "รับสินค้าสำเร็จ"}
      </Text>
      <Text style={styles.sub}>
        {isQueued
          ? "ระบบจะส่งข้อมูลอัตโนมัติเมื่ออินเทอร์เน็ตกลับมา"
          : "ข้อมูลถูกบันทึกเรียบร้อย"}
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() => router.replace("/(mini-apps)/shop-stock-receive" as any)}
      >
        <Text style={styles.btnText}>รับสินค้าใบถัดไป</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  icon: { fontSize: 64 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  sub: { color: "#666", textAlign: "center" },
  btn: { backgroundColor: "#10B981", padding: 14, borderRadius: 8, marginTop: 20, paddingHorizontal: 32 },
  btnText: { color: "#fff", fontWeight: "700" },
});
