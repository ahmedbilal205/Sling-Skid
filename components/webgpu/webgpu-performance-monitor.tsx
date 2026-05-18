import { useFrame } from "@react-three/fiber";
import { type ReactElement, useRef } from "react";

export type WebGpuPerformanceSample = {
  fps: number;
  frameTime: number;
};

type WebGpuPerformanceMonitorProps = {
  onSample: (sample: WebGpuPerformanceSample) => void;
  sampleWindow?: number;
};

export function WebGpuPerformanceMonitor({
  onSample,
  sampleWindow = 0.5,
}: WebGpuPerformanceMonitorProps): ReactElement | null {
  const elapsedRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    frameCountRef.current += 1;

    if (elapsedRef.current < sampleWindow) {
      return;
    }

    const elapsed = elapsedRef.current;
    const frameCount = frameCountRef.current;

    onSample({
      fps: frameCount / elapsed,
      frameTime: (elapsed / frameCount) * 1000,
    });

    elapsedRef.current = 0;
    frameCountRef.current = 0;
  });

  return null;
}
