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
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { AreaChart } from "@/components/ui/AreaChart";
import { DonutChart } from "@/components/ui/DonutChart";

const HERO = ["#F59E0B", "#FB923C", "#FB7185"] as const;
const THAI_DOW = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const baht = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dow = (s: string) => THAI_DOW[new Date(`${s}T00:00:00`).getDay()];

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

  // Spotify-style collapsing header: the hero card fades + parallaxes away as
  // you scroll, while the compact top bar stays.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const todayAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 95], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, 150],
          [0, -55],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollY.value, [0, 150], [1, 0.9], Extrapolation.CLAMP),
      },
    ],
  }));

  if (loading && !stats) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={HERO[0]} />
      </View>
    );
  }

  const s = stats!;
  const chart = s.series.slice(-7);
  const txt = colors.text;
  const sub = colors.textSecondary;

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
        </SafeAreaView>
      </LinearGradient>

      <Animated.ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
        {/* ── Today card (glass on gradient, fades on scroll) ── */}
        <Animated.View style={[styles.todayWrap, todayAnim]}>
          <LinearGradient
            colors={HERO}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.todayCard}
          >
            <View style={styles.todayFrost}>
              <Text style={styles.heroLabel}>ยอดขายวันนี้</Text>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroValue}>{baht(s.today.revenue)}</Text>
                <DeltaChip pct={s.todayVsYesterdayPct} />
              </View>
              <Text style={styles.heroMeta}>
                {s.today.items} ชิ้น · เทียบเมื่อวาน {baht(s.yesterday.revenue)}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

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
          style={{ paddingHorizontal: 18, marginTop: 18 }}
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

            <AreaChart
              data={chart.map((d) => ({
                label: dow(d.date),
                value: d.revenue,
                highlight:
                  s.bestDay?.date === d.date || d.date === todayStr(),
              }))}
              color={HERO[0]}
              dotFill={colors.card}
              labelColor={sub}
            />
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
            <Text style={[styles.panelTitle, { color: txt, marginBottom: 14 }]}>
              เทียบสัปดาห์นี้ vs ก่อนหน้า
            </Text>
            <View style={styles.cmpWrap}>
              <DonutChart
                progress={
                  s.week.revenue + s.prevWeek.revenue > 0
                    ? s.week.revenue / (s.week.revenue + s.prevWeek.revenue)
                    : 0
                }
                color={HERO[0]}
                size={118}
                strokeWidth={14}
              >
                <Text style={[styles.donutPct, { color: txt }]}>
                  {s.weekVsPrevPct === null
                    ? "—"
                    : `${s.weekVsPrevPct >= 0 ? "+" : ""}${s.weekVsPrevPct.toFixed(0)}%`}
                </Text>
                <Text style={[styles.donutCap, { color: sub }]}>vs ก่อนหน้า</Text>
              </DonutChart>
              <View style={{ flex: 1, gap: 14 }}>
                <Legend
                  dot={HERO[0]}
                  label="สัปดาห์นี้"
                  value={baht(s.week.revenue)}
                  txt={txt}
                  sub={sub}
                />
                <Legend
                  dot={isDark ? "#52525b" : "#cbd5e1"}
                  label="สัปดาห์ก่อน"
                  value={baht(s.prevWeek.revenue)}
                  txt={txt}
                  sub={sub}
                />
              </View>
            </View>
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

      </Animated.ScrollView>

      {/* ── Fixed bottom bar ── */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.bottomInner}>
            <Pressable
              onPress={() => router.push("/(mini-apps)/daily-sale/history")}
              style={[styles.bottomGhost, { borderColor: colors.border }]}
            >
              <Ionicons name="receipt-outline" size={19} color={colors.text} />
              <Text style={[styles.bottomGhostText, { color: colors.text }]}>
                รายการ
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(mini-apps)/daily-sale/record")}
              style={({ pressed }) => [
                styles.cta,
                { flex: 1, opacity: pressed ? 0.9 : 1 },
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
          </View>
        </SafeAreaView>
      </View>
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

function Legend({
  dot,
  label,
  value,
  txt,
  sub,
}: {
  dot: string;
  label: string;
  value: string;
  txt: string;
  sub: string;
}) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.legendLabel, { color: sub }]}>{label}</Text>
        <Text style={[styles.legendValue, { color: txt }]}>{value}</Text>
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
  todayWrap: { paddingHorizontal: 18, marginTop: 16 },
  todayCard: {
    borderRadius: 24,
    padding: 6,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  todayFrost: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 19,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.4)",
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
  cmpWrap: { flexDirection: "row", alignItems: "center", gap: 18 },
  donutPct: { fontSize: 20, fontWeight: "800" },
  donutCap: { fontSize: 11, marginTop: 2 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 12 },
  legendValue: { fontSize: 16, fontWeight: "800" },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  bottomInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  bottomGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bottomGhostText: { fontWeight: "700", fontSize: 14 },
  cta: { borderRadius: 16 },
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
