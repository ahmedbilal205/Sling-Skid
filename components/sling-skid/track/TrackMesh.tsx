/* eslint-disable react/no-unknown-property */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three/webgpu';

import { ROAD_HALF_WIDTH } from '../store/constants';
import { useGameStore } from '../store/gameStore';
import type { TrackSegment } from '../store/types';

const STRAIGHT_STEP = 4.5;
const ARC_STEP = 3.2;
const ROAD_Y = 0.08;
const MAX_ROAD_PIECES = 1024;

type RoadPiece = {
  angle: number;
  key: string;
  length: number;
  x: number;
  z: number;
};

function sampleSegment(seg: TrackSegment): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];

  if (seg.type === 'straight') {
    const steps = Math.max(2, Math.ceil(seg.length / STRAIGHT_STEP));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push(
        new THREE.Vector2(
          seg.start.x + Math.cos(seg.startHeading) * seg.length * t,
          seg.start.z + Math.sin(seg.startHeading) * seg.length * t,
        ),
      );
    }
  } else {
    const startAngle = Math.atan2(
      seg.start.z - seg.center.z,
      seg.start.x - seg.center.x,
    );
    const arcLength = seg.radius * seg.sweepAngle;
    const steps = Math.max(10, Math.ceil(arcLength / ARC_STEP));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = startAngle + seg.sweepAngle * seg.direction * t;
      pts.push(
        new THREE.Vector2(
          seg.center.x + Math.cos(angle) * seg.radius,
          seg.center.z + Math.sin(angle) * seg.radius,
        ),
      );
    }
  }
  return pts;
}

function gatherCenterline(segments: TrackSegment[]): THREE.Vector2[] {
  const allPts: THREE.Vector2[] = [];
  for (const seg of segments) {
    const pts = sampleSegment(seg);
    if (allPts.length > 0) pts.shift();
    allPts.push(...pts);
  }
  return allPts;
}

function buildRoadPieces(points: THREE.Vector2[]): RoadPiece[] {
  const pieces: RoadPiece[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);

    if (length <= 0.001) continue;

    pieces.push({
      angle: Math.atan2(dz, dx),
      key: `${i}-${a.x.toFixed(1)}-${a.y.toFixed(1)}`,
      length: length + 0.55,
      x: (a.x + b.x) * 0.5,
      z: (a.y + b.y) * 0.5,
    });
  }

  return pieces;
}

function offsetPoint(piece: RoadPiece, offset: number) {
  const perpX = -Math.sin(piece.angle);
  const perpZ = Math.cos(piece.angle);

  return {
    x: piece.x + perpX * offset,
    z: piece.z + perpZ * offset,
  };
}

function RoadStrip({
  color,
  offset = 0,
  pieces,
  width,
  y,
}: {
  color: string;
  offset?: number;
  pieces: RoadPiece[];
  width: number;
  y: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const count = Math.min(pieces.length, MAX_ROAD_PIECES);
    mesh.count = count;

    for (let index = 0; index < count; index++) {
      const piece = pieces[index];
      const pos = offsetPoint(piece, offset);
      dummy.position.set(pos.x, y, pos.z);
      dummy.rotation.set(0, -piece.angle, 0);
      dummy.scale.set(piece.length, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, offset, pieces, y]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_ROAD_PIECES]}
    >
      <boxGeometry args={[1, 0.035, width]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
}

export default function TrackMesh() {
  const segments = useGameStore((s) => s.segments);
  const currentSegmentIndex = useGameStore((s) => s.currentSegmentIndex);

  const visibleSegments = useMemo(() => {
    const start = Math.max(0, currentSegmentIndex - 2);
    const end = Math.min(segments.length, currentSegmentIndex + 14);
    return segments.slice(start, end);
  }, [segments, currentSegmentIndex]);

  const roadPieces = useMemo(
    () => buildRoadPieces(gatherCenterline(visibleSegments)),
    [visibleSegments],
  );

  return (
    <group>
      <RoadStrip color="#3f2a0f" pieces={roadPieces} width={ROAD_HALF_WIDTH * 2 + 2.8} y={ROAD_Y} />
      <RoadStrip color="#1c1f23" pieces={roadPieces} width={ROAD_HALF_WIDTH * 2} y={ROAD_Y + 0.045} />
      <RoadStrip color="#f0f0f0" offset={ROAD_HALF_WIDTH - 0.15} pieces={roadPieces} width={0.24} y={ROAD_Y + 0.09} />
      <RoadStrip color="#f0f0f0" offset={-ROAD_HALF_WIDTH + 0.15} pieces={roadPieces} width={0.24} y={ROAD_Y + 0.09} />
      <RoadStrip color="#ffd736" pieces={roadPieces} width={0.14} y={ROAD_Y + 0.12} />
    </group>
  );
}
