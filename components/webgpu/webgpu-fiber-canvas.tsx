import { createRoot, type ReconcilerRoot } from "@react-three/fiber";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  PixelRatio,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import {
  type CanvasRef,
  type RNCanvasContext,
  Canvas as WebGPUCanvas,
} from "react-native-wgpu";
import * as THREE from "three/webgpu";

type Size = {
  height: number;
  width: number;
};

type WebGpuCameraConfig = {
  far?: number;
  fov?: number;
  near?: number;
  position?: [number, number, number];
};

type WebGpuFiberCanvasProps = {
  antialias?: boolean;
  camera?: WebGpuCameraConfig;
  children: ReactNode;
  dpr?: number;
  onError?: (error: Error) => void;
  onReady?: () => void;
  powerPreference?: "default" | "high-performance" | "low-power";
  style?: StyleProp<ViewStyle>;
};

type CanvasAdapter = {
  addEventListener?: (type: string, listener: (event: Event) => void) => void;
  clientHeight: number;
  clientWidth: number;
  dispatchEvent?: (event: Event) => boolean;
  getContext?: (contextName: "webgpu") => RNCanvasContext | null;
  getRootNode?: () => CanvasAdapter;
  height: number;
  ownerDocument?: CanvasAdapter;
  removeEventListener?: (
    type: string,
    listener: (event: Event) => void,
  ) => void;
  releasePointerCapture?: () => void;
  setAttribute?: (name: string, value: string) => void;
  setPointerCapture?: () => void;
  style?: Record<string, string | number>;
  width: number;
};

type NativeCanvasLike = {
  clientHeight?: number;
  clientWidth?: number;
  height?: number;
  width?: number;
};

function getPixelSize(size: Size, dpr: number) {
  return {
    height: Math.max(1, Math.round(size.height * dpr)),
    width: Math.max(1, Math.round(size.width * dpr)),
  };
}

function createCanvasAdapter(context: RNCanvasContext, size: Size, dpr: number) {
  const nativeCanvas = context.canvas as NativeCanvasLike;
  const listeners = new Map<string, Set<(event: Event) => void>>();
  const pixelSize = getPixelSize(size, dpr);
  const canvas = {
    addEventListener(type: string, listener: (event: Event) => void) {
      const callbacks =
        listeners.get(type) ?? new Set<(event: Event) => void>();
      callbacks.add(listener);
      listeners.set(type, callbacks);
    },
    dispatchEvent(event: Event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    getContext(contextName: "webgpu") {
      return contextName === "webgpu" ? context : null;
    },
    getRootNode: () => canvas,
    ownerDocument: undefined as CanvasAdapter | undefined,
    releasePointerCapture() {},
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener);
    },
    setAttribute(name: string, value: string) {
      const numericValue = Number(value);

      if (name === "width" && Number.isFinite(numericValue)) {
        nativeCanvas.width = numericValue;
      }

      if (name === "height" && Number.isFinite(numericValue)) {
        nativeCanvas.height = numericValue;
      }
    },
    setPointerCapture() {},
    style: {},
  } as CanvasAdapter;

  Object.defineProperties(canvas, {
    clientHeight: {
      get: () => nativeCanvas.clientHeight ?? size.height,
    },
    clientWidth: {
      get: () => nativeCanvas.clientWidth ?? size.width,
    },
    height: {
      get: () => nativeCanvas.height ?? pixelSize.height,
      set: (value: number) => {
        nativeCanvas.height = value;
      },
    },
    width: {
      get: () => nativeCanvas.width ?? pixelSize.width,
      set: (value: number) => {
        nativeCanvas.width = value;
      },
    },
  });

  canvas.ownerDocument = canvas;
  return canvas;
}

function syncCanvasSize(canvas: CanvasAdapter, size: Size, dpr: number) {
  const pixelSize = getPixelSize(size, dpr);

  canvas.width = pixelSize.width;
  canvas.height = pixelSize.height;
  canvas.setAttribute?.("width", `${pixelSize.width}`);
  canvas.setAttribute?.("height", `${pixelSize.height}`);
}

function wrapRenderer(
  renderer: THREE.WebGPURenderer,
  context: RNCanvasContext,
) {
  const renderFrame = renderer.render.bind(renderer);

  renderer.render = ((scene, camera) => {
    const result = renderFrame(scene, camera);
    context.present?.();
    return result;
  }) as THREE.WebGPURenderer["render"];

  return renderer;
}

export function WebGpuFiberCanvas({
  antialias = true,
  camera,
  children,
  dpr = PixelRatio.get(),
  onError,
  onReady,
  powerPreference,
  style,
}: WebGpuFiberCanvasProps) {
  const canvasRef = useRef<CanvasRef>(null);
  const canvasAdapterRef = useRef<CanvasAdapter | null>(null);
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null);
  const rootRef = useRef<ReconcilerRoot<HTMLCanvasElement> | null>(null);
  const readyRef = useRef(false);
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    return () => {
      rootRef.current?.unmount();
      rendererRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !size) {
      return;
    }

    let cancelled = false;

    const configureScene = async () => {
      try {
        const context = canvasRef.current?.getContext("webgpu");

        if (!context) {
          throw new Error("Unable to create a WebGPU canvas context.");
        }

        const canvas =
          canvasAdapterRef.current ?? createCanvasAdapter(context, size, dpr);
        canvasAdapterRef.current = canvas;
        syncCanvasSize(canvas, size, dpr);

        const root =
          rootRef.current ?? createRoot(canvas as unknown as HTMLCanvasElement);
        rootRef.current = root;

        const renderer =
          rendererRef.current ??
          wrapRenderer(
            new THREE.WebGPURenderer({
              alpha: true,
              antialias,
              canvas: canvas as unknown as HTMLCanvasElement,
              context,
              powerPreference:
                powerPreference === "default" ? undefined : powerPreference,
            }),
            context,
          );

        if (!rendererRef.current) {
          await renderer.init();
          renderer.shadowMap.enabled = true;
          rendererRef.current = renderer;
        }

        renderer.setPixelRatio(dpr);
        renderer.setSize(size.width, size.height, false);

        await root.configure({
          camera: {
            far: camera?.far ?? 1000,
            fov: camera?.fov ?? 64,
            near: camera?.near ?? 0.1,
            position: camera?.position ?? [0, 0, 6],
          },
          dpr,
          gl: renderer,
          size: {
            height: size.height,
            left: 0,
            top: 0,
            width: size.width,
          },
        });

        if (cancelled) {
          return;
        }

        root.render(children);

        if (!readyRef.current) {
          readyRef.current = true;
          onReady?.();
        }
      } catch (error) {
        if (!cancelled) {
          onError?.(
            error instanceof Error
              ? error
              : new Error("Unable to initialize WebGPU."),
          );
        }
      }
    };

    void configureScene();

    return () => {
      cancelled = true;
    };
  }, [antialias, camera, children, dpr, onError, onReady, powerPreference, size]);

  return (
    <WebGPUCanvas
      onLayout={(event) => {
        const { height, width } = event.nativeEvent.layout;

        if (height > 0 && width > 0) {
          setSize({ height, width });
        }
      }}
      ref={canvasRef}
      style={[styles.canvas, style]}
    />
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});
