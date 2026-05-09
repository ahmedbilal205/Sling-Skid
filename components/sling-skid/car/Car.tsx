/* eslint-disable react/no-unknown-property */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three/webgpu';
import { useGameStore } from '../store/gameStore';
import { CAR_Y } from '../store/constants';

export default function Car() {
  const groupRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    let store = useGameStore.getState();

    if (store.phase === 'playing') {
      store.tick(dt);
      store = useGameStore.getState();
    }

    const g = groupRef.current;
    if (!g) return;

    g.position.set(store.carX, CAR_Y, store.carZ);
    g.rotation.y = -store.heading + Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.2, 0.4, 2.4]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.5, -0.15]} castShadow>
        <boxGeometry args={[1.0, 0.35, 1.2]} />
        <meshStandardMaterial color="#c1121f" />
      </mesh>
      {/* Wheels */}
      {[
        [-0.65, 0, 0.7],
        [0.65, 0, 0.7],
        [-0.65, 0, -0.7],
        [0.65, 0, -0.7],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.2, 0.3, 0.5]} />
          <meshStandardMaterial color="#1d1d1d" />
        </mesh>
      ))}
      {/* Headlights */}
      <mesh position={[-0.4, 0.25, 1.21]}>
        <boxGeometry args={[0.25, 0.15, 0.05]} />
        <meshStandardMaterial color="#fffacd" emissive="#fffacd" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.4, 0.25, 1.21]}>
        <boxGeometry args={[0.25, 0.15, 0.05]} />
        <meshStandardMaterial color="#fffacd" emissive="#fffacd" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
