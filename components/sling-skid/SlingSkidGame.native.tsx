import { useCallback, useEffect, useRef, useState } from 'react';
import { LogBox, PixelRatio, StyleSheet, Text, View } from 'react-native';

import { WebGpuFiberCanvas } from '@/components/webgpu/webgpu-fiber-canvas';

import GameScene from './scene/GameScene';
import { useGameStore } from './store/gameStore';
import GameOverScreen from './ui/GameOverScreen';
import HUD from './ui/HUD';
import StartScreen from './ui/StartScreen';
import SwingFeedback from './ui/SwingFeedback';

function ErrorFallback({ message }: { message: string }) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackTitle}>WebGPU unavailable</Text>
      <Text style={styles.fallbackBody}>{message}</Text>
      <Text style={styles.fallbackHint}>Use a development build on Android and ensure WebGPU is available on the device.</Text>
    </View>
  );
}

export default function SlingSkidGame() {
  const phase = useGameStore((s) => s.phase);
  const triggerSling = useGameStore((s) => s.triggerSling);
  const releaseSling = useGameStore((s) => s.releaseSling);
  const inputHeldRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    LogBox.ignoreLogs([
      'THREE.THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
    ]);
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
      {error ? (
        <ErrorFallback message={error.message} />
      ) : (
        <WebGpuFiberCanvas
          antialias={false}
          camera={{ fov: 55, near: 0.1, far: 250 }}
          dpr={Math.min(PixelRatio.get(), 2)}
          onError={setError}
          onReady={() => setError(null)}
          powerPreference="high-performance"
          style={styles.canvas}
        >
          <GameScene />
        </WebGpuFiberCanvas>
      )}

      {phase === 'playing' ? (
        <View
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
  canvas: {
    flex: 1,
  },
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
  screen: {
    backgroundColor: '#1b6f63',
    flex: 1,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
