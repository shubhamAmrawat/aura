import { View } from "react-native";

type Props = { size: number; thickness: number; progress: number; color: string; trackColor: string };

/**
 * Circular progress drawn with plain Views (no SVG library needed): two half-rings, each
 * clipped to one side of the circle and rotated into view as progress grows (clockwise from 12).
 */
export default function ProgressRing({ size, thickness, progress, color, trackColor }: Props) {
  const p = Math.max(0, Math.min(1, progress));
  const half = size / 2;
  const ring = { position: "absolute" as const, width: size, height: size, borderRadius: half, borderWidth: thickness };
  // Top + left borders make a half ring; rotated -45deg it covers the left half (6 → 12 o'clock).
  const arc = (deg: number) => ({
    ...ring,
    borderTopColor: color,
    borderLeftColor: color,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    transform: [{ rotate: `${deg}deg` }],
  });
  const rightDeg = Math.min(p, 0.5) * 360;
  const leftDeg = Math.max(0, p - 0.5) * 360;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View style={{ ...ring, borderColor: trackColor }} />
      {p > 0 ? (
        <View style={{ position: "absolute", left: half, top: 0, width: half, height: size, overflow: "hidden" }}>
          <View style={{ ...arc(-45 + rightDeg), left: -half }} />
        </View>
      ) : null}
      {p > 0.5 ? (
        <View style={{ position: "absolute", left: 0, top: 0, width: half, height: size, overflow: "hidden" }}>
          <View style={arc(135 + leftDeg)} />
        </View>
      ) : null}
    </View>
  );
}
