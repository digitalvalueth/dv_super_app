import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  Stop,
} from "react-native-svg";

export interface AreaPoint {
  label: string;
  value: number;
  highlight?: boolean;
}

/** Catmull-Rom → cubic bezier for a smooth curve through the points. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

interface Props {
  data: AreaPoint[];
  height?: number;
  color?: string;
  /** Card background — used for the dot fill so dots read on the line. */
  dotFill?: string;
  labelColor?: string;
  highlightColor?: string;
  /** Tooltip surface (tap-to-reveal). */
  cardColor?: string;
  textColor?: string;
  subColor?: string;
  borderColor?: string;
  format?: (v: number) => string;
}

export function AreaChart({
  data,
  height = 170,
  color = "#F59E0B",
  dotFill = "#fff",
  labelColor = "#999",
  highlightColor = "#F43F5E",
  cardColor = "#fff",
  textColor = "#111",
  subColor = "#999",
  borderColor = "rgba(0,0,0,0.08)",
  format = (v) => `${Math.round(v)}`,
}: Props) {
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const padX = 10;
  const top = 16;
  const bottom = height - 14;
  const n = data.length;
  const max = Math.max(...data.map((d) => d.value), 1);

  const xs = (i: number) =>
    n <= 1 ? w / 2 : padX + (i / (n - 1)) * (w - 2 * padX);
  const ys = (v: number) => top + (1 - v / max) * (bottom - top);
  const pts = data.map((d, i) => ({ x: xs(i), y: ys(d.value) }));

  const line = smoothPath(pts);
  const area =
    pts.length > 1
      ? `${line} L ${pts[pts.length - 1].x} ${bottom} L ${pts[0].x} ${bottom} Z`
      : "";

  const tipW = 120;

  return (
    <View>
      <View
        style={{ height }}
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 && (
          <Svg width={w} height={height}>
            <Defs>
              <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.35" />
                <Stop offset="1" stopColor={color} stopOpacity="0.02" />
              </SvgGradient>
            </Defs>
            {area ? <Path d={area} fill="url(#areaFill)" /> : null}
            <Path
              d={line}
              stroke={color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {active !== null && pts[active] && (
              <Line
                x1={pts[active].x}
                y1={top - 6}
                x2={pts[active].x}
                y2={bottom}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                opacity={0.5}
              />
            )}
            {pts.map((p, i) => {
              const hl = data[i].highlight;
              const sel = active === i;
              return (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={sel ? 6.5 : hl ? 5.5 : 3.5}
                  fill={sel ? color : hl ? highlightColor : dotFill}
                  stroke={sel ? dotFill : hl ? highlightColor : color}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        )}

        {w > 0 && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const lx = e.nativeEvent.locationX;
              let best = 0;
              let bd = Infinity;
              pts.forEach((p, i) => {
                const d = Math.abs(p.x - lx);
                if (d < bd) {
                  bd = d;
                  best = i;
                }
              });
              setActive((prev) => (prev === best ? null : best));
            }}
          />
        )}

        {active !== null && pts[active] && (
          <View
            pointerEvents="none"
            style={[
              styles.tip,
              {
                left: Math.min(
                  Math.max(0, pts[active].x - tipW / 2),
                  Math.max(0, w - tipW),
                ),
                top: Math.max(0, ys(data[active].value) - 50),
                width: tipW,
                backgroundColor: cardColor,
                borderColor,
              },
            ]}
          >
            <Text style={[styles.tipDate, { color: subColor }]}>
              {data[active].label}
            </Text>
            <Text style={[styles.tipVal, { color: textColor }]}>
              {format(data[active].value)}
            </Text>
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
                color:
                  active === i ? color : d.highlight ? color : labelColor,
                fontWeight: active === i || d.highlight ? "800" : "500",
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
  labels: { flexDirection: "row", marginTop: 6 },
  label: { flex: 1, textAlign: "center", fontSize: 12 },
  tip: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tipDate: { fontSize: 11, fontWeight: "700", marginBottom: 3 },
  tipVal: { fontSize: 14, fontWeight: "800" },
});
