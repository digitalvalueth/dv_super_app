import {
  deleteDailySale,
  getDailySalesByEmployee,
} from "@/services/daily-sale.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { DailySale } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const HERO = ["#F59E0B", "#FB923C", "#FB7185"] as const;
const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const getMonthRange = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const start = `${y}-${m}-01`;
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
};

export default function DailySaleHistory() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { start, end } = getMonthRange();
      setSales(await getDailySalesByEmployee(user.uid, start, end));
    } catch (e) {
      console.error("Error loading daily sales:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (item: DailySale) => {
    Alert.alert(
      "ลบรายการนี้?",
      `ยอดขายวันที่ ${formatDate(item.saleDate)} จะถูกลบถาวร`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ลบ",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDailySale(item.id);
              load();
            } catch (e) {
              console.error("Error deleting daily sale:", e);
              Alert.alert("เกิดข้อผิดพลาด", "ไม่สามารถลบรายการได้ กรุณาลองใหม่");
            }
          },
        },
      ],
    );
  };

  const totalItems = sales.reduce((sum, s) => sum + s.totalItems, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);

  const renderItem = ({ item }: { item: DailySale }) => {
    const promo = item.saleType === "promotion";
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHead}>
          <View style={styles.dateRow}>
            <View style={styles.dateIcon}>
              <Ionicons name="calendar" size={16} color={HERO[0]} />
            </View>
            <Text style={[styles.date, { color: colors.text }]}>
              {formatDate(item.saleDate)}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              { backgroundColor: promo ? "#F59E0B22" : "#10B98122" },
            ]}
          >
            <Text
              style={[styles.badgeText, { color: promo ? "#D97706" : "#059669" }]}
            >
              {promo ? "โปรโมชั่น" : "ปกติ"}
            </Text>
          </View>
        </View>

        <View style={styles.metrics}>
          <View>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              ยอดขาย
            </Text>
            <Text style={[styles.metricValue, { color: HERO[0] }]}>
              {baht(item.totalRevenue)}
            </Text>
          </View>
          <View>
            <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
              จำนวน
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
              {item.totalItems} ชิ้น
            </Text>
          </View>
          {item.branchName ? (
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text
                style={[styles.metricLabel, { color: colors.textSecondary }]}
              >
                สาขา
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.branch, { color: colors.textSecondary }]}
              >
                {item.branchName}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(mini-apps)/daily-sale/record",
                params: { id: item.id },
              })
            }
            style={styles.actionBtn}
          >
            <Ionicons name="create-outline" size={16} color={HERO[0]} />
            <Text style={[styles.actionText, { color: HERO[0] }]}>แก้ไข</Text>
          </Pressable>
          <Pressable onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={[styles.actionText, { color: "#EF4444" }]}>ลบ</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Fixed top bar ── */}
      <LinearGradient
        colors={HERO}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topBar}
      >
        <SafeAreaView edges={["top"]}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.topTitle}>รายการขาย</Text>
            <View style={{ width: 38 }} />
          </View>
        </SafeAreaView>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={HERO[0]} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={HERO[0]}
            />
          }
          ListHeaderComponent={
            <View style={{ paddingTop: 16 }}>
              <LinearGradient
                colors={HERO}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summary}
              >
                <View style={styles.summaryFrost}>
                  <Text style={styles.summaryLabel}>ยอดขายเดือนนี้</Text>
                  <Text style={styles.summaryValue}>{baht(totalRevenue)}</Text>
                  <Text style={styles.summaryMeta}>
                    {sales.length} วัน · {totalItems} ชิ้น
                  </Text>
                </View>
              </LinearGradient>
              {sales.length > 0 && (
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  ทั้งหมด {sales.length} รายการ
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 50 }}>
              <Ionicons
                name="receipt-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 12,
                  fontSize: 14,
                }}
              >
                ยังไม่มีรายการยอดขายเดือนนี้
              </Text>
            </View>
          }
        />
      )}

      {/* ── Fixed bottom bar ── */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <SafeAreaView edges={["bottom"]}>
          <Pressable
            onPress={() => router.push("/(mini-apps)/daily-sale/record")}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={HERO}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cta}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.ctaText}>บันทึกยอดขายใหม่</Text>
            </LinearGradient>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  topTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  summary: {
    borderRadius: 24,
    padding: 6,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  summaryFrost: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 19,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
  },
  summaryLabel: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  summaryValue: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 },
  summaryMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 5 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginTop: 18, marginBottom: 4 },
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B18",
  },
  date: { fontWeight: "700", fontSize: 15 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  metrics: { flexDirection: "row", gap: 22, marginTop: 14 },
  metricLabel: { fontSize: 11, marginBottom: 2 },
  metricValue: { fontSize: 16, fontWeight: "800" },
  branch: { fontSize: 13, fontWeight: "600", maxWidth: 120 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionText: { fontSize: 13, fontWeight: "700" },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
