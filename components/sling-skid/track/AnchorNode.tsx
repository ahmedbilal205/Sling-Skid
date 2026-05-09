/* eslint-disable react/no-unknown-property */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { getGameRuntimeState, useGameStore } from '../store/gameStore';
import type { ArcSegment } from '../store/types';

function AnchorMarker({ segment, index }: { segment: ArcSegment; index: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const materialsRef = useRef<{
    beacon: THREE.MeshBasicMaterial;
    disc: THREE.MeshStandardMaterial;
    pulse: THREE.MeshBasicMaterial;
  } | null>(null);
  const colorRef = useRef('');

  useFrame(({ clock }) => {
    const { swing, nextArcIndex, activeArcIndex, currentSegmentIndex } = getGameRuntimeState();

    const g = groupRef.current;
    const disc = discRef.current;
    const pulse = pulseRef.current;
    const beacon = beaconRef.current;
    if (!g || !disc || !pulse || !beacon) return;
    const materials =
      materialsRef.current ??
      {
        beacon: beacon.material as THREE.MeshBasicMaterial,
        disc: disc.material as THREE.MeshStandardMaterial,
        pulse: pulse.material as THREE.MeshBasicMaterial,
      };
    materialsRef.current = materials;

    const isUpcoming = index === nextArcIndex && index !== activeArcIndex;
    const isActive = index === activeArcIndex || index === swing.anchorIndex;
    const isPassed = !isActive && index < currentSegmentIndex;

    if (isPassed) {
      g.visible = false;
      return;
    }

    g.visible = true;

    if (isActive) {
      const activeColor = swing.lineState === 'drifting' ? '#4cc9f0' : '#ffd60a';
      if (colorRef.current !== activeColor) {
        materials.disc.color.set(activeColor);
        materials.disc.emissive.set(activeColor);
        materials.pulse.color.set(activeColor);
        materials.beacon.color.set(activeColor);
        colorRef.current = activeColor;
      }

      disc.scale.setScalar(1.15 + swing.tension * 0.45);
      materials.disc.emissiveIntensity = 2.2 + swing.tension * 1.8;
      materials.disc.opacity = 1;

      pulse.visible = true;
      pulse.scale.setScalar(1.05 + swing.tension * 0.85);
      materials.pulse.opacity = 0.22 + swing.tension * 0.18;

      beacon.visible = true;
      beacon.scale.y = 1 + swing.tension * 0.55;
      materials.beacon.opacity = 0.45 + swing.tension * 0.25;
    } else if (isUpcoming) {
      const t = (Math.sin(clock.elapsedTime * 5) + 1) * 0.5;
      if (colorRef.current !== '#e53e3e') {
        materials.disc.color.set('#e53e3e');
        materials.disc.emissive.set('#e53e3e');
        materials.pulse.color.set('#e53e3e');
        materials.beacon.color.set('#ff4d4d');
        colorRef.current = '#e53e3e';
      }
      disc.scale.setScalar(1.0);
      materials.disc.emissiveIntensity = 1.5 + t;
      materials.disc.opacity = 0.95;

      pulse.visible = true;
      pulse.scale.setScalar(1.0 + t * 1.2);
      materials.pulse.opacity = 0.35 * (1 - t);

      beacon.visible = true;
      beacon.scale.y = 1 + t * 0.35;
      materials.beacon.opacity = 0.45 + t * 0.25;
    } else {
      g.visible = false;
    }
  });

  return (
    <group ref={groupRef} position={[segment.center.x, 0, segment.center.z]}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[2.8, 28]} />
        <meshBasicMaterial color="#0a0a0a" transparent opacity={0.5} />
      </mesh>
      <mesh ref={discRef} rotation-x={-Math.PI / 2} position={[0, 0.06, 0]}>
        <circleGeometry args={[2.0, 28]} />
        <meshStandardMaterial
          color="#e53e3e"
          emissive="#e53e3e"
          emissiveIntensity={2}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.08, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh ref={beaconRef} position={[0, 4.2, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 8.4, 10]} />
        <meshBasicMaterial color="#ff4d4d" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={pulseRef} rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.2, 3.0, 32]} />
        <meshBasicMaterial color="#e53e3e" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function AnchorNodes() {
  const segments = useGameStore(s => s.segments);
  const nextArcIndex = useGameStore(s => s.nextArcIndex);
  const activeSwingIndex = useGameStore(s => (s.swing.anchorIndex >= 0 ? s.swing.anchorIndex : -1));
  const activeArcIndex = useGameStore(s => s.activeArcIndex);

  const arcs = useMemo(() => {
    const result: { segment: ArcSegment; index: number }[] = [];

    if (
      activeArcIndex >= 0 &&
      activeArcIndex < segments.length &&
      segments[activeArcIndex]?.type === 'arc'
    ) {
      result.push({ segment: segments[activeArcIndex] as ArcSegment, index: activeArcIndex });
    }

    if (
      activeSwingIndex >= 0 &&
      activeSwingIndex < segments.length &&
      activeSwingIndex !== activeArcIndex &&
      segments[activeSwingIndex]?.type === 'arc'
    ) {
      result.push({ segment: segments[activeSwingIndex] as ArcSegment, index: activeSwingIndex });
    }

    if (
      nextArcIndex >= 0 &&
      nextArcIndex < segments.length &&
      nextArcIndex !== activeSwingIndex &&
      nextArcIndex !== activeArcIndex &&
      segments[nextArcIndex]?.type === 'arc'
    ) {
      result.push({ segment: segments[nextArcIndex] as ArcSegment, index: nextArcIndex });
    }

    return result;
  }, [segments, nextArcIndex, activeSwingIndex, activeArcIndex]);

  return (
    <group>
      {arcs.map(({ segment, index }) => (
        <AnchorMarker key={`node-${index}`} segment={segment} index={index} />
      ))}
    </group>
  );
}
