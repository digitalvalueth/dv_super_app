import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
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
}

export function AreaChart({
  data,
  height = 170,
  color = "#F59E0B",
  dotFill = "#fff",
  labelColor = "#999",
  highlightColor = "#F43F5E",
}: Props) {
  const [w, setW] = useState(0);
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
            {pts.map((p, i) => {
              const hl = data[i].highlight;
              return (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hl ? 5.5 : 3.5}
                  fill={hl ? highlightColor : dotFill}
                  stroke={hl ? highlightColor : color}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.label,
              {
                color: d.highlight ? color : labelColor,
                fontWeight: d.highlight ? "800" : "500",
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
});
