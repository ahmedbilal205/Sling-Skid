/* eslint-disable react/no-unknown-property */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useGameStore } from '../store/gameStore';

export default function Environment() {
  const planeRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { carX, carZ } = useGameStore.getState();
    if (planeRef.current) {
      planeRef.current.position.set(carX, -0.05, carZ);
    }
  });

  return (
    <mesh ref={planeRef} rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[800, 800]} />
      <meshStandardMaterial color="#1f5947" />
    </mesh>
  );
}
