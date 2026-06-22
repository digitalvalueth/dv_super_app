import { getUserReceiveHistory } from "@/services/shop-stock-receive.service";
import { getQueuedReceives, QueuedReceive } from "@/services/shop-stock-receive.queue";
import { useAuthStore } from "@/stores/auth.store";
import { ShopStockReceive } from "@/types";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function ShopStockReceiveHistory() {
  const user = useAuthStore((s) => s.user);
  const [synced, setSynced] = useState<ShopStockReceive[]>([]);
  const [pending, setPending] = useState<QueuedReceive[]>([]);

  useEffect(() => {
    (async () => {
      if (user?.uid) setSynced(await getUserReceiveHistory(user.uid));
      setPending(await getQueuedReceives());
    })();
  }, [user?.uid]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.h1}>ประวัติการรับสินค้า</Text>
      </View>
      {pending.length > 0 && (
        <Text style={styles.pending}>รอส่ง {pending.length} รายการ</Text>
      )}
      <FlatList
        data={synced}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={styles.empty}>ยังไม่มีประวัติ</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.transferNumber}</Text>
            <Text style={styles.sub}>
              สาขา {item.branchCode} · {item.totalItems} รายการ
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  backBtn: { padding: 8, marginLeft: -8 },
  h1: { fontSize: 20, fontWeight: "700" },
  pending: { color: "#D97706", marginBottom: 8 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#eee" },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12 },
});
