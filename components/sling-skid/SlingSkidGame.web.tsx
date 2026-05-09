import { Canvas } from '@react-three/fiber';
import { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three/webgpu';

import GameScene from './scene/GameScene';
import { useGameStore } from './store/gameStore';
import GameOverScreen from './ui/GameOverScreen';
import HUD from './ui/HUD';
import StartScreen from './ui/StartScreen';
import SwingFeedback from './ui/SwingFeedback';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class WebGpuErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

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
      <Text style={styles.fallbackHint}>Use a browser with WebGPU support enabled, such as current Chrome or Edge.</Text>
    </View>
  );
}

export default function SlingSkidGame() {
  const phase = useGameStore((s) => s.phase);
  const triggerSling = useGameStore((s) => s.triggerSling);
  const releaseSling = useGameStore((s) => s.releaseSling);
  const inputHeldRef = useRef(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handlePressIn = useCallback(() => {
    if (phase === 'playing' && !inputHeldRef.current) {
      inputHeldRef.current = true;
      triggerSling();
    }
  }, [phase, triggerSling]);

  const handlePressOut = useCallback(() => {
    if (inputHeldRef.current) {
      inputHeldRef.current = false;
      releaseSling();
    }
  }, [releaseSling]);

  return (
    <View style={styles.screen}>
      {isClient ? (
        <WebGpuErrorBoundary fallback={(error) => <ErrorFallback message={error.message} />}>
          <Canvas
            camera={{ fov: 55, near: 0.1, far: 250 }}
            gl={async (props) => {
              const renderer = new THREE.WebGPURenderer({
                alpha: true,
                antialias: props.antialias,
                canvas: props.canvas as HTMLCanvasElement,
                powerPreference: props.powerPreference === 'default' ? undefined : props.powerPreference,
              });

              await renderer.init();
              return renderer;
            }}
            style={styles.webCanvas}
          >
            <GameScene />
          </Canvas>
        </WebGpuErrorBoundary>
      ) : (
        <View style={styles.loading} />
      )}

      {phase === 'playing' ? (
        <View
          onPointerCancel={handlePressOut}
          onPointerDown={handlePressIn}
          onPointerLeave={handlePressOut}
          onPointerUp={handlePressOut}
          onResponderGrant={handlePressIn}
          onResponderRelease={handlePressOut}
          onResponderTerminate={handlePressOut}
          onStartShouldSetResponder={() => true}
          onTouchCancel={handlePressOut}
          onTouchEnd={handlePressOut}
          onTouchStart={handlePressIn}
          style={styles.tapLayer}
        />
      ) : null}

      <HUD />
      <SwingFeedback />
      <StartScreen />
      <GameOverScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#081223',
    borderColor: '#1e293b',
    borderRadius: 8,
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
    backgroundColor: '#1b6f63',
    flex: 1,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  webCanvas: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
});
