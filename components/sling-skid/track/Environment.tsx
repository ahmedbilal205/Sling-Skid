/* eslint-disable react/no-unknown-property */

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import * as THREE from 'three/webgpu';

import grassBaseColor from '../../../assets/textures/grass-patchy-ground/base-color.jpg';
import { getGameRuntimeState } from '../store/gameStore';

const GRASS_REPEAT = 72;
const GROUND_SIZE = 800;
const TEXTURE_SCROLL_SCALE = GRASS_REPEAT / GROUND_SIZE;

function wrapTextureOffset(value: number) {
  return ((value % 1) + 1) % 1;
}

function prepareTexture(texture: THREE.Texture, colorSpace: THREE.ColorSpace) {
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GRASS_REPEAT, GRASS_REPEAT);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return texture;
}

async function createNativeImageBitmap(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch {
    return await createImageBitmap(uri as unknown as Blob);
  }
}

async function createTexture(assetModule: number, colorSpace: THREE.ColorSpace) {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();

  const uri = asset.localUri ?? asset.uri;

  if (Platform.OS === 'web') {
    const texture = await new THREE.TextureLoader().loadAsync(uri);
    return prepareTexture(texture, colorSpace);
  }

  const bitmap = await createNativeImageBitmap(uri);
  return prepareTexture(new THREE.Texture(bitmap), colorSpace);
}

export default function Environment() {
  const planeRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const [grassTexture, setGrassTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedTexture: THREE.Texture | null = null;

    createTexture(grassBaseColor, THREE.SRGBColorSpace)
      .then((texture) => {
        loadedTexture = texture;

        if (!cancelled) {
          setGrassTexture(texture);
        } else {
          texture.dispose();
        }
      })
      .catch((error) => {
        console.warn('Failed to load grass texture', error);
      });

    return () => {
      cancelled = true;
      loadedTexture?.dispose();
    };
  }, []);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.map = grassTexture;
    material.color.set(grassTexture ? '#ffffff' : '#1f5947');
    material.needsUpdate = true;
  }, [grassTexture]);

  useFrame(() => {
    const { carX, carZ } = getGameRuntimeState();
    if (planeRef.current) {
      planeRef.current.position.set(carX, -0.05, carZ);
    }

    if (grassTexture) {
      grassTexture.offset.set(
        wrapTextureOffset(carX * TEXTURE_SCROLL_SCALE),
        wrapTextureOffset(-carZ * TEXTURE_SCROLL_SCALE),
      );
      grassTexture.updateMatrix();
    }
  });

  return (
    <mesh ref={planeRef} rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshBasicMaterial
        key={grassTexture ? 'grass-textured' : 'grass-fallback'}
        ref={materialRef}
        color={grassTexture ? '#ffffff' : '#1f5947'}
        map={grassTexture}
      />
    </mesh>
  );
}
