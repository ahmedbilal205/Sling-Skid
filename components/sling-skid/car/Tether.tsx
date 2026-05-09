/* eslint-disable react/no-unknown-property */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { getGameRuntimeState } from '../store/gameStore';
import { CAR_Y } from '../store/constants';
import type { ArcSegment } from '../store/types';

const TETHER_POINTS = 20;
const SAG = 0.3;

export default function Tether() {
  const positions = useMemo(() => new Float32Array(TETHER_POINTS * 3), []);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10000);
    return geo;
  }, [positions]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffd60a',
        transparent: true,
        opacity: 0.9,
        linewidth: 2,
      }),
    [],
  );

  const lineObj = useMemo(() => {
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    return line;
  }, [geometry, material]);
  const lineRef = useRef(lineObj);

  useFrame(() => {
    const { swing, carX, carZ, segments } = getGameRuntimeState();
    const obj = lineRef.current;
    const mat = obj.material as THREE.LineBasicMaterial;

    if (
      swing.anchorIndex < 0 ||
      swing.anchorIndex >= segments.length ||
      segments[swing.anchorIndex]?.type !== 'arc'
    ) {
      obj.visible = false;
      return;
    }

    const arc = segments[swing.anchorIndex] as ArcSegment;
    const tension = swing.tension;
    obj.visible = tension > 0.04 || swing.lineState === 'drifting';
    if (!obj.visible) return;

    const startX = carX;
    const startZ = carZ;
    const endX = arc.center.x;
    const endZ = arc.center.z;
    const dx = endX - startX;
    const dz = endZ - startZ;
    const dist = Math.hypot(dx, dz);

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const pullHeight = 0.7 + tension * 0.75;
    const sagAmount = SAG * (0.55 + (1 - tension) * 1.2);

    mat.opacity = 0.18 + tension * 0.82;
    mat.color.set(tension > 0.4 ? '#ffd60a' : '#8fe7ff');

    for (let i = 0; i < TETHER_POINTS; i++) {
      const t = i / (TETHER_POINTS - 1);
      const x = startX + dx * t;
      const z = startZ + dz * t;
      const sag = Math.sin(t * Math.PI) * sagAmount;
      const arcLift = Math.sin(t * Math.PI) * pullHeight;
      const y = CAR_Y + (0.46 - CAR_Y) * t + arcLift - sag - dist * 0.004 * t;

      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }

    posAttr.needsUpdate = true;
  });

  return <primitive ref={lineRef} object={lineObj} />;
}
