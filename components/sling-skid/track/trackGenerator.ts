import type { Vec2, TrackSegment, StraightSegment, ArcSegment } from '../store/types';
import {
  INITIAL_STRAIGHT_LENGTH_MIN,
  INITIAL_STRAIGHT_LENGTH_MAX,
  INITIAL_ARC_RADIUS_MIN,
  INITIAL_ARC_RADIUS_MAX,
  INITIAL_SWEEP_MIN,
  ROAD_WIDTH,
  SEGMENT_BUFFER_AHEAD,
} from '../store/constants';

const MAX_GENERATION_ATTEMPTS = 32;
const CENTERLINE_SAMPLE_STEP = 1;
// TrackMesh renders a 1.4m shoulder outside each side of the 8m paved road.
const ROAD_CLEARANCE = ROAD_WIDTH + 2.8 + 0.5;
const FALLBACK_LENGTH_STEP = 0.5;
const MIN_FALLBACK_LENGTH = 0.03125;
const FALLBACK_ARC_RADII = [8, 10, 12, 16, 20, 24, 30, 36, 42];
const FALLBACK_ARC_SWEEPS = [Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI * 0.72];
const MAX_EXTENSION_BACKTRACKS = 128;
const MAX_TRACK_HEADING = Math.PI / 2 - 0.12;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function difficultyFactor(distance: number): number {
  return Math.min(distance / 2000, 1);
}

function sampleSegment(seg: TrackSegment): Vec2[] {
  const length = seg.type === 'straight' ? seg.length : seg.radius * seg.sweepAngle;
  const steps = Math.max(2, Math.ceil(length / CENTERLINE_SAMPLE_STEP));
  const points: Vec2[] = [];

  if (seg.type === 'straight') {
    for (let i = 0; i <= steps; i++) {
      const distance = seg.length * (i / steps);
      points.push({
        x: seg.start.x + Math.cos(seg.startHeading) * distance,
        z: seg.start.z + Math.sin(seg.startHeading) * distance,
      });
    }
    return points;
  }

  const startAngle = Math.atan2(seg.start.z - seg.center.z, seg.start.x - seg.center.x);
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + seg.sweepAngle * seg.direction * (i / steps);
    points.push({
      x: seg.center.x + Math.cos(angle) * seg.radius,
      z: seg.center.z + Math.sin(angle) * seg.radius,
    });
  }
  return points;
}

function pointToLineSectionDistanceSquared(point: Vec2, start: Vec2, end: Vec2): number {
  const sectionX = end.x - start.x;
  const sectionZ = end.z - start.z;
  const lengthSquared = sectionX * sectionX + sectionZ * sectionZ;

  if (lengthSquared <= Number.EPSILON) {
    return (point.x - start.x) ** 2 + (point.z - start.z) ** 2;
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * sectionX + (point.z - start.z) * sectionZ) / lengthSquared,
    ),
  );
  const closestX = start.x + sectionX * projection;
  const closestZ = start.z + sectionZ * projection;
  return (point.x - closestX) ** 2 + (point.z - closestZ) ** 2;
}

function lineSectionDistanceSquared(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const cdX = d.x - c.x;
  const cdZ = d.z - c.z;
  const denominator = abX * cdZ - abZ * cdX;

  if (Math.abs(denominator) > Number.EPSILON) {
    const acX = c.x - a.x;
    const acZ = c.z - a.z;
    const alongAB = (acX * cdZ - acZ * cdX) / denominator;
    const alongCD = (acX * abZ - acZ * abX) / denominator;
    if (alongAB >= 0 && alongAB <= 1 && alongCD >= 0 && alongCD <= 1) return 0;
  }

  return Math.min(
    pointToLineSectionDistanceSquared(a, c, d),
    pointToLineSectionDistanceSquared(b, c, d),
    pointToLineSectionDistanceSquared(c, a, b),
    pointToLineSectionDistanceSquared(d, a, b),
  );
}

function sampledSegmentsAreTooClose(a: Vec2[], b: Vec2[], clearanceSquared: number): boolean {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < b.length - 1; j++) {
      if (lineSectionDistanceSquared(a[i], a[i + 1], b[j], b[j + 1]) < clearanceSquared) {
        return true;
      }
    }
  }
  return false;
}

export function overlapsExistingRoad(candidate: TrackSegment, existingSegments: TrackSegment[]): boolean {
  // The final existing segment is adjacent and intentionally shares the candidate's start point.
  const nonAdjacentSegments = existingSegments.slice(0, -1);
  if (nonAdjacentSegments.length === 0) return false;

  const candidatePoints = sampleSegment(candidate);
  const clearanceSquared = ROAD_CLEARANCE * ROAD_CLEARANCE;
  return nonAdjacentSegments.some((segment) =>
    sampledSegmentsAreTooClose(candidatePoints, sampleSegment(segment), clearanceSquared),
  );
}

function createStraight(start: Vec2, heading: number, length: number): StraightSegment {
  return {
    type: 'straight',
    start: { ...start },
    startHeading: heading,
    length,
    end: {
      x: start.x + Math.cos(heading) * length,
      z: start.z + Math.sin(heading) * length,
    },
    endHeading: heading,
  };
}

function createArc(
  start: Vec2,
  heading: number,
  radius: number,
  sweepAngle: number,
  direction: 1 | -1,
): ArcSegment {
  // +1 (CCW) means turning left from current heading.
  const perpAngle = heading + (direction > 0 ? Math.PI / 2 : -Math.PI / 2);
  const center: Vec2 = {
    x: start.x + Math.cos(perpAngle) * radius,
    z: start.z + Math.sin(perpAngle) * radius,
  };

  const startAngle = Math.atan2(start.z - center.z, start.x - center.x);
  const endAngle = startAngle + sweepAngle * direction;

  const end: Vec2 = {
    x: center.x + Math.cos(endAngle) * radius,
    z: center.z + Math.sin(endAngle) * radius,
  };

  const endHeading = heading + sweepAngle * direction;

  return {
    type: 'arc',
    start: { ...start },
    startHeading: heading,
    center,
    radius,
    sweepAngle,
    direction,
    end,
    endHeading,
  };
}

function createRandomCandidate(prev: TrackSegment, distance: number): TrackSegment {
  const d = difficultyFactor(distance);
  const start = prev.end;
  const heading = prev.endHeading;

  // Always give every curve a readable approach/recovery straight.
  if (prev.type === 'arc') {
    const lMin = lerp(22, 15, d);
    const lMax = lerp(34, 22, d);
    return createStraight(start, heading, rand(lMin, lMax));
  }

  const arcChance = lerp(0.62, 0.78, d);
  if (Math.random() >= arcChance) {
    const lMin = lerp(INITIAL_STRAIGHT_LENGTH_MIN, 16, d);
    const lMax = lerp(INITIAL_STRAIGHT_LENGTH_MAX, 24, d);
    return createStraight(start, heading, rand(lMin, lMax));
  }

  const rMin = lerp(INITIAL_ARC_RADIUS_MIN, 16, d);
  const rMax = lerp(INITIAL_ARC_RADIUS_MAX, 30, d);
  const sMin = lerp(INITIAL_SWEEP_MIN, Math.PI / 2.8, d);
  const sMax = lerp(Math.PI * 0.82, Math.PI * 0.72, d);

  let direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  let availableSweep = direction > 0
    ? MAX_TRACK_HEADING - heading
    : heading + MAX_TRACK_HEADING;
  if (availableSweep < sMin) {
    direction = direction > 0 ? -1 : 1;
    availableSweep = direction > 0
      ? MAX_TRACK_HEADING - heading
      : heading + MAX_TRACK_HEADING;
  }
  if (availableSweep < sMin) {
    return createStraight(start, heading, rand(INITIAL_STRAIGHT_LENGTH_MIN, INITIAL_STRAIGHT_LENGTH_MAX));
  }

  const radius = rand(rMin, rMax);
  const sweep = rand(sMin, Math.min(sMax, availableSweep));

  return createArc(start, heading, radius, sweep, direction);
}

function findGeometricallySafeFallbackArc(existingSegments: TrackSegment[]): ArcSegment | null {
  const prev = existingSegments[existingSegments.length - 1];
  for (const sweep of FALLBACK_ARC_SWEEPS) {
    for (const radius of FALLBACK_ARC_RADII) {
      for (const direction of [1, -1] as const) {
        const candidate = createArc(prev.end, prev.endHeading, radius, sweep, direction);
        if (
          Math.abs(candidate.endHeading) <= MAX_TRACK_HEADING &&
          !overlapsExistingRoad(candidate, existingSegments)
        ) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function createSafeFallback(existingSegments: TrackSegment[], distance: number): TrackSegment {
  const prev = existingSegments[existingSegments.length - 1];
  const d = difficultyFactor(distance);

  // A deterministic turn avoids advancing a straight into a dead end when random retries are exhausted.
  if (prev.type === 'straight') {
    const safeArc = findGeometricallySafeFallbackArc(existingSegments);
    if (safeArc) return safeArc;
  }

  const regularMax = prev.type === 'arc'
    ? lerp(34, 22, d)
    : lerp(INITIAL_STRAIGHT_LENGTH_MAX, 24, d);

  for (let length = regularMax; length >= FALLBACK_LENGTH_STEP; length -= FALLBACK_LENGTH_STEP) {
    const candidate = createStraight(prev.end, prev.endHeading, length);
    if (!overlapsExistingRoad(candidate, existingSegments)) return candidate;
  }

  for (let length = FALLBACK_LENGTH_STEP / 2; length >= MIN_FALLBACK_LENGTH; length /= 2) {
    const candidate = createStraight(prev.end, prev.endHeading, length);
    if (!overlapsExistingRoad(candidate, existingSegments)) return candidate;
  }

  throw new Error('Unable to generate a non-overlapping road segment');
}

export function generateNextSegment(existingSegments: TrackSegment[], distance: number): TrackSegment {
  const prev = existingSegments[existingSegments.length - 1];
  if (!prev) throw new Error('Cannot generate a road segment without existing track');

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const candidate = createRandomCandidate(prev, distance);
    if (!overlapsExistingRoad(candidate, existingSegments)) return candidate;
  }

  return createSafeFallback(existingSegments, distance);
}

export function extendTrack(
  existingSegments: TrackSegment[],
  count: number,
  distance: number,
  backtrackableTail = 0,
): TrackSegment[] {
  const targetLength = existingSegments.length + count;
  const lockedLength = Math.max(1, existingSegments.length - backtrackableTail);
  const segments = [...existingSegments];
  let backtracks = 0;

  while (segments.length < targetLength) {
    try {
      segments.push(generateNextSegment(segments, distance));
    } catch (error) {
      if (segments.length <= lockedLength || backtracks >= MAX_EXTENSION_BACKTRACKS) throw error;
      segments.pop();
      backtracks++;
    }
  }

  return segments;
}

export function generateInitialTrack(): TrackSegment[] {
  const first = createStraight({ x: 0, z: 0 }, 0, 32);
  return extendTrack([first], SEGMENT_BUFFER_AHEAD - 1, 0);
}

export function isOnRoad(
  pos: Vec2,
  segments: TrackSegment[],
  currentIdx: number,
  halfWidth: number,
): boolean {
  const checkStart = Math.max(0, currentIdx - 2);
  const checkEnd = Math.min(segments.length, currentIdx + 6);

  for (let i = checkStart; i < checkEnd; i++) {
    const seg = segments[i];

    if (seg.type === 'straight') {
      const dx = pos.x - seg.start.x;
      const dz = pos.z - seg.start.z;
      const fwdX = Math.cos(seg.startHeading);
      const fwdZ = Math.sin(seg.startHeading);
      const along = dx * fwdX + dz * fwdZ;

      if (along < -halfWidth || along > seg.length + halfWidth) continue;

      const perpX = -fwdZ;
      const perpZ = fwdX;
      const perp = Math.abs(dx * perpX + dz * perpZ);

      if (perp <= halfWidth) return true;
    } else {
      const dx = pos.x - seg.center.x;
      const dz = pos.z - seg.center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (Math.abs(dist - seg.radius) <= halfWidth) {
        const angle = Math.atan2(dz, dx);
        const startAngle = Math.atan2(
          seg.start.z - seg.center.z,
          seg.start.x - seg.center.x,
        );

        let delta = (angle - startAngle) * seg.direction;
        while (delta < -0.1) delta += Math.PI * 2;
        while (delta > Math.PI * 2 + 0.1) delta -= Math.PI * 2;

        if (delta <= seg.sweepAngle + 0.2) return true;
      }
    }
  }
  return false;
}
