import { useEffect, useState } from "react";
import { LogBox, StyleSheet, Text, View } from "react-native";

import { WebGpuFiberCanvas } from "@/components/webgpu/webgpu-fiber-canvas";
import { WebGpuScene } from "@/components/webgpu/webgpu-scene";

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
          }}
          style={styles.canvas}
        >
          <WebGpuScene />
        </WebGpuFiberCanvas>
      )}

      <View pointerEvents="none" style={styles.overlay}>
        <Text style={styles.badge}>React Native WebGPU + R3F</Text>
        <Text style={styles.caption}>
          {isReady ? "WebGpu Working" : "Initializing renderer..."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  canvas: {
    flex: 1,
  },
  caption: {
    color: "#cbd5e1",
    fontSize: 14,
    marginTop: 4,
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
  overlay: {
    backgroundColor: "rgba(5, 8, 22, 0.72)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    borderRadius: 16,
    borderWidth: 1,
    left: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: "absolute",
    right: 18,
    top: 18,
  },
  screen: {
    backgroundColor: "#020617",
    flex: 1,
  },
});
