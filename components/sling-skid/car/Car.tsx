/* eslint-disable react/no-unknown-property */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three/webgpu';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import policeCarModelNative from '../../../assets/models/police_car.native.glb';
import { getGameRuntimeState, stepGameRuntime } from '../store/gameStore';
import { CAR_Y } from '../store/constants';

const POLICE_CAR_MODEL_WEB_PATH = '/models/police_car.glb';
const DRACO_DECODER_PATH = '/draco/gltf/';
const POLICE_CAR_SCALE = 0.42;
const POLICE_CAR_MODEL_ROTATION_Y = -Math.PI / 2;

async function getPoliceCarModelUris() {
  if (Platform.OS === 'web') {
    return [POLICE_CAR_MODEL_WEB_PATH];
  }

  const asset = Asset.fromModule(policeCarModelNative);
  await asset.downloadAsync();
  return [asset.uri, asset.localUri].filter((uri): uri is string => Boolean(uri));
}

function preparePoliceCarScene(scene: THREE.Group) {
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = false;

      if (Platform.OS !== 'web') {
        child.material = new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
        });
      }
    }
  });
}

function loadGltfScene(loader: GLTFLoader, uri: string) {
  return new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      uri,
      (gltf) => {
        const scene = gltf.scene;
        preparePoliceCarScene(scene);
        resolve(scene);
      },
      undefined,
      reject
    );
  });
}

async function loadFirstAvailableScene(loader: GLTFLoader, uris: string[]) {
  let lastError: unknown;

  for (const uri of uris) {
    try {
      return await loadGltfScene(loader, uri);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function FallbackCar() {
  return (
    <>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.2, 0.4, 2.4]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.5, -0.15]}>
        <boxGeometry args={[1.0, 0.35, 1.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      {[
        [-0.65, 0, 0.7],
        [0.65, 0, 0.7],
        [-0.65, 0, -0.7],
        [0.65, 0, -0.7],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <boxGeometry args={[0.2, 0.3, 0.5]} />
          <meshStandardMaterial color="#050505" />
        </mesh>
      ))}
    </>
  );
}

export default function Car() {
  const groupRef = useRef<THREE.Group>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [modelFailed, setModelFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const dracoLoader = Platform.OS === 'web' ? new DRACOLoader() : null;

    if (dracoLoader) {
      dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
      loader.setDRACOLoader(dracoLoader);
    }

    getPoliceCarModelUris()
      .then((uris) => loadFirstAvailableScene(loader, uris))
      .then((scene) => {
        if (!cancelled) {
          setModelScene(scene);
          setModelFailed(false);
        }
      })
      .catch((error) => {
        console.warn('Failed to load police car model', error);
        if (!cancelled) {
          setModelFailed(true);
        }
      });

    return () => {
      cancelled = true;
      dracoLoader?.dispose();
    };
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    let store = getGameRuntimeState();

    if (store.phase === 'playing') {
      stepGameRuntime(dt);
      store = getGameRuntimeState();
    }

    const g = groupRef.current;
    if (!g) return;

    g.position.set(store.carX, CAR_Y, store.carZ);
    g.rotation.y = -store.heading + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      {modelScene ? (
        <group rotation-y={POLICE_CAR_MODEL_ROTATION_Y} scale={POLICE_CAR_SCALE}>
          <primitive object={modelScene} />
        </group>
      ) : null}
      {modelFailed ? <FallbackCar /> : null}
    </group>
  );
}
