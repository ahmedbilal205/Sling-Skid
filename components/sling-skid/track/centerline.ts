import * as THREE from 'three/webgpu';
import type { TrackSegment } from '../store/types';

const STRAIGHT_STEP = 3.5;
const ARC_STEP = 2.5;

export function sampleSegmentPoints(seg: TrackSegment): THREE.Vector2[] {
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

function gatherCenterlinePoints(segments: TrackSegment[]): THREE.Vector2[] {
  const allPts: THREE.Vector2[] = [];
  for (const seg of segments) {
    const pts = sampleSegmentPoints(seg);
    if (allPts.length > 0) pts.shift();
    allPts.push(...pts);
  }
  return allPts;
}

export interface CenterlinePath {
  points: THREE.Vector2[];
  cumLen: number[];
  segmentStartS: number[];
  totalLen: number;
}

export function buildCenterlinePath(segments: TrackSegment[]): CenterlinePath {
  const points = gatherCenterlinePoints(segments);
  const n = points.length;

  const cumLen: number[] = new Array(n);
  if (n === 0) {
    return { points, cumLen, segmentStartS: [], totalLen: 0 };
  }
  cumLen[0] = 0;
  for (let i = 1; i < n; i++) {
    const a = points[i - 1];
    const b = points[i];
    cumLen[i] = cumLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const totalLen = cumLen[n - 1];

  const segmentStartS: number[] = new Array(segments.length).fill(0);
  let pointIndex = 0;
  for (let si = 0; si < segments.length; si++) {
    segmentStartS[si] = cumLen[pointIndex];
    const segPts = sampleSegmentPoints(segments[si]);
    const addCount = si === 0 ? segPts.length : segPts.length - 1;
    pointIndex += addCount;
    if (pointIndex > n) pointIndex = n;
  }

  return { points, cumLen, segmentStartS, totalLen };
}

function clampS(path: CenterlinePath, s: number): number {
  if (path.totalLen <= 0) return 0;
  return Math.max(0, Math.min(s, path.totalLen));
}

export function poseAtS(path: CenterlinePath, s: number): { x: number; z: number; heading: number } {
  if (path.points.length === 0) return { x: 0, z: 0, heading: 0 };
  if (path.points.length === 1) {
    return { x: path.points[0].x, z: path.points[0].y, heading: 0 };
  }

  const cl = clampS(path, s);
  let i = 0;
  while (i < path.cumLen.length - 1 && path.cumLen[i + 1] < cl) i++;

  const p0 = path.points[i];
  const p1 = path.points[Math.min(i + 1, path.points.length - 1)];
  const s0 = path.cumLen[i];
  const s1 = path.cumLen[Math.min(i + 1, path.cumLen.length - 1)];
  const span = s1 - s0 || 1e-6;
  const t = (cl - s0) / span;

  const x = p0.x + (p1.x - p0.x) * t;
  const z = p0.y + (p1.y - p0.y) * t;
  const heading = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  return { x, z, heading };
}

export function pointAheadOnPath(path: CenterlinePath, s: number, ahead: number): THREE.Vector3 {
  const p = poseAtS(path, s + ahead);
  return new THREE.Vector3(p.x, 0, p.z);
}

export function projectXZToPathS(path: CenterlinePath, x: number, z: number): number {
  if (path.points.length === 0) return 0;
  if (path.points.length === 1) return 0;

  let bestS = 0;
  let bestD2 = Infinity;

  for (let i = 0; i < path.points.length - 1; i++) {
    const a = path.points[i];
    const b = path.points[i + 1];
    const s0 = path.cumLen[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1e-6;
    const apx = x - a.x;
    const apz = z - a.y;
    let u = (apx * abx + apz * aby) / len2;
    u = Math.max(0, Math.min(1, u));
    const px = a.x + abx * u;
    const pz = a.y + aby * u;
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d2 < bestD2) {
      bestD2 = d2;
      bestS = s0 + Math.sqrt(len2) * u;
    }
  }

  return clampS(path, bestS);
}

export function pathSAtSegmentStart(path: CenterlinePath, segmentIndex: number): number {
  if (segmentIndex <= 0) return 0;
  if (segmentIndex >= path.segmentStartS.length) return path.totalLen;
  return path.segmentStartS[segmentIndex];
}
