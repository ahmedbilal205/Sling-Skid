import { StyleSheet, Text, View } from "react-native";

import type { WebGpuPerformanceSample } from "@/components/webgpu/webgpu-performance-monitor";

type WebGpuStatusOverlayProps = {
  badge: string;
  caption: string;
  performance: WebGpuPerformanceSample | null;
};

function formatMetricValue(value: number, digits = 0) {
  return value.toFixed(digits);
}

function getFpsColor(fps: number) {
  if (fps >= 55) {
    return "#86efac";
  }

  if (fps >= 30) {
    return "#fcd34d";
  }

  return "#fca5a5";
}

export function WebGpuStatusOverlay({
  badge,
  caption,
  performance,
}: WebGpuStatusOverlayProps) {
  const fpsColor = performance ? getFpsColor(performance.fps) : "#f8fafc";

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Text style={styles.badge}>{badge}</Text>
      <Text style={styles.caption}>{caption}</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>FPS</Text>
          <Text style={[styles.metricValue, { color: fpsColor }]}>
            {performance ? formatMetricValue(performance.fps) : "--"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>MS</Text>
          <Text style={styles.metricValue}>
            {performance ? formatMetricValue(performance.frameTime, 1) : "--"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: "#f8fafc",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  caption: {
    color: "#cbd5e1",
    fontSize: 8,
    marginTop: 2,
  },
  metricCard: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 78,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  metricLabel: {
    color: "#94a3b8",
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  overlay: {
    backgroundColor: "rgba(5, 8, 22, 0.72)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    borderRadius: 16,
    borderWidth: 1,
    left: 18,
    maxWidth: 300,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "absolute",
    top: 18,
  },
});
