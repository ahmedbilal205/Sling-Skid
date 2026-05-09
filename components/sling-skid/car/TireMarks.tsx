/* eslint-disable react/no-unknown-property */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useGameStore } from '../store/gameStore';

const MAX_MARKS = 300;
const MARK_INTERVAL = 0.06;

export default function TireMarks() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const indexRef = useRef(0);
  const timerRef = useRef(0);
  const activeCount = useRef(0);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const { swing, carX, carZ, heading, phase, activeArcIndex } = useGameStore.getState();
    const mesh = meshRef.current;
    if (!mesh) return;

    if (phase !== 'playing' || activeArcIndex < 0 || swing.slip < 0.18) {
      timerRef.current = 0;
      return;
    }

    timerRef.current += delta;
    if (timerRef.current < MARK_INTERVAL) return;
    timerRef.current = 0;

    const idx = indexRef.current % MAX_MARKS;
    const markScale = 0.8 + swing.slip * 0.9;

    const offsetL = 0.55;
    const offsetR = -0.55;
    const perpX = -Math.sin(heading);
    const perpZ = Math.cos(heading);

    dummy.position.set(carX + perpX * offsetL, 0.08, carZ + perpZ * offsetL);
    dummy.rotation.set(-Math.PI / 2, 0, -heading);
    dummy.scale.set(markScale, markScale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx * 2, dummy.matrix);

    dummy.position.set(carX + perpX * offsetR, 0.08, carZ + perpZ * offsetR);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx * 2 + 1, dummy.matrix);

    indexRef.current++;
    activeCount.current = Math.min(activeCount.current + 2, MAX_MARKS * 2);
    mesh.count = activeCount.current;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_MARKS * 2]}>
      <planeGeometry args={[0.18, 0.6]} />
      <meshBasicMaterial color="#1a1a1a" transparent opacity={0.4} depthWrite={false} />
    </instancedMesh>
  );
}
