import { GlassCard } from "@/components/ui/GlassCard";
import {
  addDays,
  buildDashboardStats,
  type DashboardStats,
} from "@/services/daily-sale-dashboard";
import { getDailySalesByEmployee } from "@/services/daily-sale.service";
import { useAuthStore } from "@/stores/auth.store";
import { useTheme } from "@/stores/theme.store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const HERO = ["#F59E0B", "#FB923C", "#FB7185"] as const;
const BAR = ["#FCD34D", "#F59E0B"] as const;
const BAR_BEST = ["#FB7185", "#F43F5E"] as const;
const CHART_H = 150;
const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const bahtShort = (n: number) =>
  n <= 0
    ? ""
    : n >= 1000
      ? `฿${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
      : `฿${Math.round(n)}`;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dow = (s: string) => THAI_DOW[new Date(`${s}T00:00:00`).getDay()];

// ── Animated bar ──────────────────────────────────────────────────────
function Bar({
  target,
  gradient,
  delay,
}: {
  target: number;
  gradient: readonly [string, string];
  delay: number;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(target, { duration: 650 }));
  }, [target, delay, h]);
  const aStyle = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View style={[styles.bar, aStyle]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// ── Comparison chip (▲/▼ %) ───────────────────────────────────────────
function DeltaChip({ pct }: { pct: number | null }) {
  if (pct === null)
    return (
      <View style={[styles.chip, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
        <Text style={styles.chipText}>ใหม่</Text>
      </View>
    );
  const up = pct >= 0;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: up ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.28)" },
      ]}
    >
      <Ionicons
        name={up ? "arrow-up" : "arrow-down"}
        size={12}
        color="#fff"
      />
      <Text style={styles.chipText}>{Math.abs(pct).toFixed(0)}%</Text>
    </View>
  );
}

export default function DailySaleDashboard() {
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    try {
      const today = todayStr();
      const sales = await getDailySalesByEmployee(
        user.uid,
        addDays(today, -34),
        today,
      );
      setStats(
        buildDashboardStats(
          sales.map((s) => ({
            saleDate: s.saleDate,
            totalRevenue: s.totalRevenue || 0,
            totalItems: s.totalItems || 0,
          })),
          today,
          14,
        ),
      );
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

  if (loading && !stats) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={HERO[0]} />
      </View>
    );
  }

  const s = stats!;
  const chart = s.series.slice(-7);
  const max = Math.max(...chart.map((d) => d.revenue), 1);
  const txt = colors.text;
  const sub = colors.textSecondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
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
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={HERO}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <SafeAreaView edges={["top"]}>
            <View style={styles.heroTop}>
              <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.heroTitle}>ยอดขายของฉัน</Text>
              <Pressable
                onPress={() => router.push("/(mini-apps)/daily-sale/history")}
                style={styles.iconBtn}
              >
                <Ionicons name="receipt-outline" size={20} color="#fff" />
              </Pressable>
            </View>

            <Animated.View entering={FadeInDown.duration(500)}>
              <GlassCard
                tint="light"
                overlay="rgba(255,255,255,0.18)"
                style={styles.heroCard}
              >
                <View style={{ padding: 18 }}>
                  <Text style={styles.heroLabel}>ยอดขายวันนี้</Text>
                  <View style={styles.heroValueRow}>
                    <Text style={styles.heroValue}>{baht(s.today.revenue)}</Text>
                    <DeltaChip pct={s.todayVsYesterdayPct} />
                  </View>
                  <Text style={styles.heroMeta}>
                    {s.today.items} ชิ้น · เทียบเมื่อวาน {baht(s.yesterday.revenue)}
                  </Text>
                </View>
              </GlassCard>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>

        {/* ── Summary cards ── */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(500)}
          style={styles.row}
        >
          <StatCard
            label="7 วันล่าสุด"
            value={baht(s.week.revenue)}
            sub={`${s.week.items} ชิ้น`}
            icon="calendar-outline"
            tint={colors}
            isDark={isDark}
            chip={<DeltaChip pct={s.weekVsPrevPct} />}
          />
          <StatCard
            label="เดือนนี้"
            value={baht(s.month.revenue)}
            sub={`${s.month.items} ชิ้น`}
            icon="trending-up-outline"
            tint={colors}
            isDark={isDark}
          />
        </Animated.View>

        {/* ── Bar chart ── */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(500)}
          style={{ paddingHorizontal: 18 }}
        >
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.panelHead}>
              <Text style={[styles.panelTitle, { color: txt }]}>
                ยอดขาย 7 วันล่าสุด
              </Text>
              {s.bestDay && (
                <Text style={[styles.panelHint, { color: sub }]}>
                  สูงสุด {baht(s.bestDay.revenue)}
                </Text>
              )}
            </View>

            <View style={styles.chart}>
              {chart.map((d, i) => {
                const isBest = s.bestDay?.date === d.date;
                const isToday = d.date === todayStr();
                const target =
                  d.revenue > 0 ? Math.max(8, (d.revenue / max) * CHART_H) : 3;
                return (
                  <View key={d.date} style={styles.col}>
                    <View style={styles.barSlot}>
                      <Text style={[styles.barValue, { color: sub }]}>
                        {bahtShort(d.revenue)}
                      </Text>
                      <Bar
                        target={target}
                        gradient={isBest ? BAR_BEST : BAR}
                        delay={i * 70}
                      />
                    </View>
                    <Text
                      style={[
                        styles.dow,
                        {
                          color: isToday ? HERO[0] : sub,
                          fontWeight: isToday ? "800" : "500",
                        },
                      ]}
                    >
                      {dow(d.date)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ── Week vs last week comparison ── */}
        <Animated.View
          entering={FadeInDown.delay(280).duration(500)}
          style={{ paddingHorizontal: 18, marginTop: 16 }}
        >
          <View
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.panelTitle, { color: txt, marginBottom: 12 }]}>
              เทียบสัปดาห์นี้ vs ก่อนหน้า
            </Text>
            <CompareRow
              label="สัปดาห์นี้"
              value={s.week.revenue}
              max={Math.max(s.week.revenue, s.prevWeek.revenue, 1)}
              color={HERO[0]}
              sub={sub}
              txt={txt}
            />
            <CompareRow
              label="สัปดาห์ก่อน"
              value={s.prevWeek.revenue}
              max={Math.max(s.week.revenue, s.prevWeek.revenue, 1)}
              color={isDark ? "#52525b" : "#cbd5e1"}
              sub={sub}
              txt={txt}
            />
          </View>
        </Animated.View>

        {/* ── Quick stats ── */}
        <Animated.View
          entering={FadeInDown.delay(340).duration(500)}
          style={[styles.row, { marginTop: 14 }]}
        >
          <MiniStat
            icon="receipt-outline"
            label="จำนวนบิล (35 วัน)"
            value={`${s.totalTx}`}
            tint={colors}
          />
          <MiniStat
            icon="stats-chart-outline"
            label="เฉลี่ย/วันที่ขาย"
            value={baht(s.avgPerActiveDay)}
            tint={colors}
          />
        </Animated.View>

        {/* ── CTA ── */}
        <Pressable
          onPress={() => router.push("/(mini-apps)/daily-sale/record")}
          style={({ pressed }) => [
            styles.cta,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={HERO}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaInner}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.ctaText}>บันทึกยอดขายใหม่</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  tint,
  isDark,
  chip,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { card: string; text: string; textSecondary: string; border: string };
  isDark: boolean;
  chip?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: tint.card, borderColor: tint.border },
      ]}
    >
      <View style={styles.statTop}>
        <Ionicons name={icon} size={18} color={HERO[0]} />
        {chip}
      </View>
      <Text style={[styles.statValue, { color: tint.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tint.textSecondary }]}>
        {label} · {sub}
      </Text>
    </View>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: { card: string; text: string; textSecondary: string; border: string };
}) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: tint.card, borderColor: tint.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={HERO[2]} />
      <Text style={[styles.statValue, { color: tint.text, marginTop: 6 }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: tint.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function CompareRow({
  label,
  value,
  max,
  color,
  sub,
  txt,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sub: string;
  txt: string;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.cmpHead}>
        <Text style={[styles.cmpLabel, { color: sub }]}>{label}</Text>
        <Text style={[styles.cmpValue, { color: txt }]}>{baht(value)}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={{
            width: `${Math.max(3, (value / max) * 100)}%`,
            height: "100%",
            borderRadius: 6,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroTop: {
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
  heroTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  heroCard: { marginTop: 8 },
  heroLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
  },
  heroValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  heroValue: { color: "#fff", fontSize: 34, fontWeight: "800" },
  heroMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 11,
  },
  chipText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 18, marginTop: 16 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statValue: { fontSize: 20, fontWeight: "800", marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 2 },
  panel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  panelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  panelTitle: { fontSize: 15, fontWeight: "700" },
  panelHint: { fontSize: 12, fontWeight: "600" },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 6,
  },
  col: { flex: 1, alignItems: "center" },
  barSlot: {
    height: CHART_H + 18,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 3,
  },
  bar: { width: 24, borderRadius: 8, overflow: "hidden" },
  barValue: { fontSize: 9, fontWeight: "600" },
  dow: { fontSize: 12, marginTop: 6 },
  cmpHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  cmpLabel: { fontSize: 13, fontWeight: "500" },
  cmpValue: { fontSize: 14, fontWeight: "700" },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "rgba(120,120,120,0.15)",
    overflow: "hidden",
  },
  cta: { marginHorizontal: 18, marginTop: 22, borderRadius: 16 },
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
