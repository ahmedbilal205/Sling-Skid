import { Canvas } from '@react-three/fiber';
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three/webgpu';

import {
  WebGpuPerformanceMonitor,
  type WebGpuPerformanceSample,
} from '@/components/webgpu/webgpu-performance-monitor';
import { WebGpuScene } from '@/components/webgpu/webgpu-scene';
import { WebGpuStatusOverlay } from '@/components/webgpu/webgpu-status-overlay';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class WebGpuErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }

    return this.props.children;
  }
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>WebGPU unavailable</Text>
      <Text style={styles.fallbackBody}>{message}</Text>
      <Text style={styles.fallbackHint}>
        Use a browser with WebGPU support enabled, such as current Chrome or Edge.
      </Text>
    </View>
  );
}

export default function MinimalWebGpuDemo() {
  const [isClient, setIsClient] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [performance, setPerformance] = useState<WebGpuPerformanceSample | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <View style={styles.screen}>
      {isClient ? (
        <WebGpuErrorBoundary fallback={(error) => <ErrorFallback message={error.message} />}>
          <Canvas
            camera={{ fov: 46, position: [0, 0, 4] }}
            gl={async (props) => {
              const renderer = new THREE.WebGPURenderer({
                alpha: true,
                antialias: props.antialias,
                canvas: props.canvas as HTMLCanvasElement,
                powerPreference:
                  props.powerPreference === 'default' ? undefined : props.powerPreference,
              });

              await renderer.init();
              return renderer;
            }}
            onCreated={() => {
              setIsReady(true);
              setPerformance(null);
            }}
            style={styles.canvas}>
            <WebGpuScene />
            <WebGpuPerformanceMonitor onSample={setPerformance} />
          </Canvas>
        </WebGpuErrorBoundary>
      ) : (
        <View style={styles.loading} />
      )}

      <WebGpuStatusOverlay
        badge="React Native WebGPU + R3F"
        caption={isReady ? 'Minimal rotating cube demo' : 'Preparing renderer...'}
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
    backgroundColor: '#081223',
    borderColor: '#1e293b',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 96,
    padding: 20,
  },
  fallbackBody: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  fallbackHint: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  fallbackTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  loading: {
    flex: 1,
  },
  screen: {
    backgroundColor: '#020617',
    flex: 1,
  },
});
