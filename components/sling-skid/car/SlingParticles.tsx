/* eslint-disable react/no-unknown-property */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { getGameRuntimeState } from '../store/gameStore';

const PARTICLE_COUNT = 30;
const LIFETIME = 0.6;

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  alive: boolean;
}

export default function SlingParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wasEngaged = useRef(false);
  const particlesRef = useRef<Particle[]>(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      alive: false,
    })),
  );

  useFrame((_, delta) => {
    const { swing, carX, carZ, velX, velZ } = getGameRuntimeState();
    const mesh = meshRef.current;
    const particles = particlesRef.current;
    if (!mesh) return;

    if (swing.engaged && !wasEngaged.current) {
      const travelSpeed = Math.hypot(velX, velZ) || 1;
      const dirX = velX / travelSpeed;
      const dirZ = velZ / travelSpeed;
      for (const p of particles) {
        p.pos.set(carX, 0.5, carZ);
        p.vel.set(
          dirX * (4 + Math.random() * 5) + (Math.random() - 0.5) * 6,
          Math.random() * 6 + 2,
          dirZ * (4 + Math.random() * 5) + (Math.random() - 0.5) * 6,
        );
        p.life = LIFETIME;
        p.alive = true;
      }
    }
    wasEngaged.current = swing.engaged;

    let count = 0;
    for (const p of particles) {
      if (!p.alive) continue;

      p.life -= delta;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }

      p.vel.y -= 15 * delta;
      p.pos.addScaledVector(p.vel, delta);

      const scale = p.life / LIFETIME;
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(0.12 * scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      count++;
    }

    if (count > 0) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    mesh.count = count;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#ffd60a" transparent opacity={0.8} />
    </instancedMesh>
  );
}
