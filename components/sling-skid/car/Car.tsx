/* eslint-disable react/no-unknown-property */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import * as THREE from 'three/webgpu';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import policeCarModelNative from '../../../assets/models/police_car.native.glb';
import policeCarTextureNative from '../../../assets/models/police_car.texture.jpg';
import { getGameRuntimeState, stepGameRuntime } from '../store/gameStore';
import { CAR_Y, POLICE_CAR_NATIVE_SCALE, POLICE_CAR_WEB_SCALE } from '../store/constants';

const POLICE_CAR_MODEL_WEB_PATH = '/models/police_car.glb';
const DRACO_DECODER_PATH = '/draco/gltf/';
const POLICE_CAR_MODEL_ROTATION_Y = -Math.PI / 2;

async function createNativeImageBitmap(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch {
    return await createImageBitmap(uri as unknown as Blob);
  }
}

async function getPoliceCarModelUris() {
  if (Platform.OS === 'web') {
    return [POLICE_CAR_MODEL_WEB_PATH];
  }

  const asset = Asset.fromModule(policeCarModelNative);
  await asset.downloadAsync();
  return [asset.uri, asset.localUri].filter((uri): uri is string => Boolean(uri));
}

async function loadPoliceCarTexture() {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const asset = Asset.fromModule(policeCarTextureNative);
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri;
    const bitmap = await createNativeImageBitmap(uri);
    const texture = new THREE.Texture(bitmap);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    return texture;
  } catch (error) {
    console.warn('Failed to load police car texture', error);
    return null;
  }
}

function flipNativePoliceCarUvs(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute('uv');

  if (!uv) {
    return;
  }

  for (let i = 0; i < uv.count; i += 1) {
    uv.setY(i, 1 - uv.getY(i));
  }

  uv.needsUpdate = true;
}

function preparePoliceCarScene(scene: THREE.Group, nativeTexture: THREE.Texture | null) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      if (Platform.OS !== 'web') {
        flipNativePoliceCarUvs(mesh.geometry);
        mesh.geometry.deleteAttribute('color');

        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material) => {
          material.side = THREE.DoubleSide;

          if (nativeTexture) {
            const mappedMaterial = material as THREE.MeshStandardMaterial;
            mappedMaterial.map = nativeTexture;
            mappedMaterial.vertexColors = false;
            mappedMaterial.color.set(0xffffff);
            mappedMaterial.metalness = 0;
            mappedMaterial.roughness = 0.82;
          }

          material.needsUpdate = true;
        });
      }
    }
  });
}

function loadGltfScene(loader: GLTFLoader, uri: string, nativeTexture: THREE.Texture | null) {
  return new Promise<THREE.Group>((resolve, reject) => {
    loader.load(
      uri,
      (gltf) => {
        const scene = gltf.scene;
        preparePoliceCarScene(scene, nativeTexture);
        resolve(scene);
      },
      undefined,
      reject
    );
  });
}

async function loadFirstAvailableScene(loader: GLTFLoader, uris: string[], nativeTexture: THREE.Texture | null) {
  let lastError: unknown;

  for (const uri of uris) {
    try {
      return await loadGltfScene(loader, uri, nativeTexture);
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
  const modelScale = Platform.OS === 'web' ? POLICE_CAR_WEB_SCALE : POLICE_CAR_NATIVE_SCALE;

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    const dracoLoader = Platform.OS === 'web' ? new DRACOLoader() : null;

    if (dracoLoader) {
      dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
      loader.setDRACOLoader(dracoLoader);
    }

    Promise.all([getPoliceCarModelUris(), loadPoliceCarTexture()])
      .then(([uris, texture]) => loadFirstAvailableScene(loader, uris, texture))
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
        <group rotation-y={POLICE_CAR_MODEL_ROTATION_Y} scale={modelScale}>
          <primitive object={modelScene} />
        </group>
      ) : null}
      {modelFailed ? <FallbackCar /> : null}
    </group>
  );
}
