import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient as SvgGradient,
  Rect,
  Stop,
} from "react-native-svg";

export interface BarGroup {
  label: string;
  /** One value per series (1 = single, 2 = paired comparison). */
  values: number[];
}

interface Props {
  data: BarGroup[];
  height?: number;
  /** Per-series colors. */
  colors?: string[];
  /** Per-series names, shown in the tooltip. */
  seriesNames?: string[];
  labelColor?: string;
  /** Tooltip surface. */
  cardColor?: string;
  textColor?: string;
  subColor?: string;
  borderColor?: string;
  format?: (v: number) => string;
}

/**
 * Grouped bar chart (1–2 series) with tap-to-reveal tooltip.
 * Tapping a day column toggles a floating tooltip with each series value.
 */
export function BarChart({
  data,
  height = 180,
  colors = ["#F59E0B", "#CBD5E1"],
  seriesNames = [],
  labelColor = "#999",
  cardColor = "#fff",
  textColor = "#111",
  subColor = "#999",
  borderColor = "rgba(0,0,0,0.08)",
  format = (v) => `${Math.round(v)}`,
}: Props) {
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const padX = 6;
  const top = 14;
  const chartBottom = height - 6;
  const n = data.length;
  const series = Math.max(1, ...data.map((d) => d.values.length));
  const max = Math.max(1, ...data.flatMap((d) => d.values));

  const groupW = n > 0 ? (w - 2 * padX) / n : 0;
  const cluster = groupW * 0.62;
  const barW = series > 0 ? cluster / series : cluster;
  const ys = (v: number) => top + (1 - v / max) * (chartBottom - top);

  const tipW = 132;
  const tipLeft =
    active !== null
      ? Math.min(
          Math.max(padX, padX + active * groupW + groupW / 2 - tipW / 2),
          Math.max(padX, w - tipW - padX),
        )
      : 0;
  const tallestY =
    active !== null ? Math.min(...data[active].values.map(ys)) : 0;

  return (
    <View>
      <View
        style={{ height }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 && (
          <Svg width={w} height={height}>
            <Defs>
              {colors.map((c, j) => (
                <SvgGradient
                  key={j}
                  id={`bar${j}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0" stopColor={c} stopOpacity="1" />
                  <Stop offset="1" stopColor={c} stopOpacity="0.6" />
                </SvgGradient>
              ))}
            </Defs>
            {data.map((g, i) => {
              const groupX = padX + i * groupW;
              const isActive = active === i;
              return (
                <G key={i}>
                  {isActive && (
                    <Rect
                      x={groupX + 1}
                      y={top - 8}
                      width={groupW - 2}
                      height={chartBottom - top + 8}
                      rx={10}
                      fill={colors[0]}
                      opacity={0.08}
                    />
                  )}
                  {g.values.map((v, j) => {
                    const x = groupX + groupW * 0.19 + j * barW;
                    const y = ys(v);
                    const h = Math.max(v > 0 ? 3 : 0, chartBottom - y);
                    return (
                      <Rect
                        key={`${i}-${j}`}
                        x={x}
                        y={chartBottom - h}
                        width={barW * 0.82}
                        height={h}
                        rx={Math.min(5, (barW * 0.82) / 2)}
                        fill={`url(#bar${j})`}
                        opacity={active === null || isActive ? 1 : 0.4}
                      />
                    );
                  })}
                </G>
              );
            })}
          </Svg>
        )}

        {/* Hit areas — one column per group */}
        {w > 0 && (
          <View style={[StyleSheet.absoluteFill, styles.hitRow]}>
            {data.map((_, i) => (
              <Pressable
                key={i}
                style={{ flex: 1, height }}
                onPress={() => setActive((p) => (p === i ? null : i))}
              />
            ))}
          </View>
        )}

        {/* Tooltip */}
        {active !== null && w > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.tip,
              {
                left: tipLeft,
                top: Math.max(0, tallestY - (series > 1 ? 64 : 46)),
                width: tipW,
                backgroundColor: cardColor,
                borderColor,
              },
            ]}
          >
            <Text style={[styles.tipDate, { color: subColor }]}>
              {data[active].label}
            </Text>
            {data[active].values.map((v, j) => (
              <View key={j} style={styles.tipRow}>
                <View
                  style={[styles.tipDot, { backgroundColor: colors[j] }]}
                />
                <Text style={[styles.tipName, { color: subColor }]}>
                  {seriesNames[j] ?? `#${j + 1}`}
                </Text>
                <Text style={[styles.tipVal, { color: textColor }]}>
                  {format(v)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.label,
              {
                color: active === i ? colors[0] : labelColor,
                fontWeight: active === i ? "800" : "500",
              },
            ]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hitRow: { flexDirection: "row" },
  labels: { flexDirection: "row", marginTop: 6 },
  label: { flex: 1, textAlign: "center", fontSize: 12 },
  tip: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tipDate: { fontSize: 11, fontWeight: "700", marginBottom: 5 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  tipDot: { width: 8, height: 8, borderRadius: 4 },
  tipName: { fontSize: 12, flex: 1 },
  tipVal: { fontSize: 12, fontWeight: "800" },
});
