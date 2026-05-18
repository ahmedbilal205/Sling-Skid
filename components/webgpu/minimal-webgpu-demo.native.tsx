import { useEffect, useState } from "react";
import { LogBox, StyleSheet, Text, View } from "react-native";

import { WebGpuFiberCanvas } from "@/components/webgpu/webgpu-fiber-canvas";
import {
  WebGpuPerformanceMonitor,
  type WebGpuPerformanceSample,
} from "@/components/webgpu/webgpu-performance-monitor";
import { WebGpuScene } from "@/components/webgpu/webgpu-scene";
import { WebGpuStatusOverlay } from "@/components/webgpu/webgpu-status-overlay";

function ErrorFallback({ message }: { message: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>WebGPU unavailable</Text>
      <Text style={styles.fallbackBody}>{message}</Text>
      <Text style={styles.fallbackHint}>
        Use a development build on Android and ensure WebGPU is available on the
        device.
      </Text>
    </View>
  );
}

export default function MinimalWebGpuDemo() {
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [performance, setPerformance] = useState<WebGpuPerformanceSample | null>(
    null,
  );

  useEffect(() => {
    LogBox.ignoreLogs([
      "THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.",
    ]);
  }, []);

  return (
    <View style={styles.screen}>
      {error ? (
        <ErrorFallback message={error.message} />
      ) : (
        <WebGpuFiberCanvas
          onError={setError}
          onReady={() => {
            setError(null);
            setIsReady(true);
            setPerformance(null);
          }}
          style={styles.canvas}
        >
          <WebGpuScene />
          <WebGpuPerformanceMonitor onSample={setPerformance} />
        </WebGpuFiberCanvas>
      )}

      <WebGpuStatusOverlay
        badge="React Native WebGPU + R3F"
        caption={isReady ? "WebGPU working" : "Initializing renderer..."}
        performance={performance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  fallback: {
    backgroundColor: "#081223",
    borderColor: "#1e293b",
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 96,
    padding: 20,
  },
  fallbackBody: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },
  fallbackHint: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  fallbackTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
  },
  screen: {
    backgroundColor: "#020617",
    flex: 1,
  },
});
