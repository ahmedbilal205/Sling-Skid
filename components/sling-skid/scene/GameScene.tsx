/* eslint-disable react/no-unknown-property */

import './registerThree';

import { useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';

import Car from '../car/Car';
import Tether from '../car/Tether';
import TireMarks from '../car/TireMarks';
import SlingParticles from '../car/SlingParticles';
import FollowCamera from '../camera/FollowCamera';
import TrackMesh from '../track/TrackMesh';
import AnchorNodes from '../track/AnchorNode';
import Environment from '../track/Environment';
import { getGameRuntimeState } from '../store/gameStore';

const isAndroid = Platform.OS === 'android';
const SHADOW_TARGET_STEP = 1.2;

function GameSun() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const lastShadowCenter = useRef({ x: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY });

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;

    const { carX, carZ } = getGameRuntimeState();
    const dx = carX - lastShadowCenter.current.x;
    const dz = carZ - lastShadowCenter.current.z;
    if (dx * dx + dz * dz < SHADOW_TARGET_STEP * SHADOW_TARGET_STEP) return;

    lastShadowCenter.current.x = carX;
    lastShadowCenter.current.z = carZ;
    target.position.set(carX, 0, carZ);
    light.position.set(carX + 18, 48, carZ + 18);
    light.target = target;
    target.updateMatrixWorld();
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={[20, 48, 20]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={isAndroid ? 512 : 1024}
        shadow-mapSize-height={isAndroid ? 512 : 1024}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={34}
        shadow-camera-bottom={-30}
        shadow-camera-near={8}
        shadow-camera-far={90}
      />
      <primitive object={target} />
    </>
  );
}

export default function GameScene() {
  return (
    <>
      <color attach="background" args={['#1b6f63']} />
      <fog attach="fog" args={['#1b6f63', 60, 200]} />
      <ambientLight intensity={0.85} />
      <GameSun />
      <FollowCamera />
      <Environment />
      <TrackMesh />
      <AnchorNodes />
      <Car />
      <Tether />
      <TireMarks />
      <SlingParticles />
    </>
  );
}
