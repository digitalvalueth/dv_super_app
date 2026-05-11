import { getDailySalesByEmployee } from "@/services/daily-sale.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { DailySale } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function DailySaleIndex() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [sales, setSales] = useState<DailySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { start, end } = getMonthRange();
      const data = await getDailySalesByEmployee(user.uid, start, end);
      setSales(data);
    } catch (e) {
      console.error("Error loading daily sales:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const totalItems = sales.reduce((sum, s) => sum + s.totalItems, 0);
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalRevenue, 0);

  const renderItem = ({ item }: { item: DailySale }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>
          {formatDate(item.saleDate)}
        </Text>
        <View
          style={{
            backgroundColor:
              item.saleType === "promotion" ? "#F59E0B22" : "#10B98122",
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: item.saleType === "promotion" ? "#D97706" : "#059669",
            }}
          >
            {item.saleType === "promotion" ? "โปรโมชั่น" : "ปกติ"}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 20 }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          สินค้า:{" "}
          <Text style={{ color: colors.text, fontWeight: "600" }}>
            {item.totalItems} ชิ้น
          </Text>
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          ยอดขาย:{" "}
          <Text style={{ color: "#2563EB", fontWeight: "600" }}>
            ฿
            {item.totalRevenue.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}
          </Text>
        </Text>
      </View>
      {item.branchName ? (
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}
        >
          {item.branchName}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            บันทึกยอดขาย
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            รายการเดือนนี้
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(mini-apps)/daily-sale/record")}
          style={{
            backgroundColor: "#F59E0B",
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            บันทึก
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View
        style={{
          flexDirection: "row",
          margin: 16,
          gap: 10,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#FFF7ED",
            borderRadius: 10,
            padding: 14,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#FED7AA",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#EA580C" }}>
            {totalItems}
          </Text>
          <Text style={{ fontSize: 11, color: "#9A3412", marginTop: 2 }}>
            ชิ้นรวม
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: "#EFF6FF",
            borderRadius: 10,
            padding: 14,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#BFDBFE",
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1D4ED8" }}>
            {totalRevenue.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ fontSize: 11, color: "#1E40AF", marginTop: 2 }}>
            ยอดขายรวม (฿)
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: "#F0FDF4",
            borderRadius: 10,
            padding: 14,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "#BBF7D0",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#16A34A" }}>
            {sales.length}
          </Text>
          <Text style={{ fontSize: 11, color: "#15803D", marginTop: 2 }}>
            วันที่บันทึก
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60 }}>
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
              <TouchableOpacity
                onPress={() => router.push("/(mini-apps)/daily-sale/record")}
                style={{
                  marginTop: 16,
                  backgroundColor: "#F59E0B",
                  borderRadius: 8,
                  paddingHorizontal: 24,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  บันทึกยอดขายแรก
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
