import type { Vec2, TrackSegment, StraightSegment, ArcSegment } from '../store/types';
import {
  INITIAL_STRAIGHT_LENGTH_MIN,
  INITIAL_STRAIGHT_LENGTH_MAX,
  INITIAL_ARC_RADIUS_MIN,
  INITIAL_ARC_RADIUS_MAX,
  INITIAL_SWEEP_MIN,
  SEGMENT_BUFFER_AHEAD,
} from '../store/constants';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function difficultyFactor(distance: number): number {
  return Math.min(distance / 2000, 1);
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

export function generateNextSegment(prev: TrackSegment, distance: number): TrackSegment {
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

  const radius = rand(rMin, rMax);
  const sweep = rand(sMin, sMax);
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

  return createArc(start, heading, radius, sweep, direction);
}

export function generateInitialTrack(): TrackSegment[] {
  const segments: TrackSegment[] = [];

  const first = createStraight({ x: 0, z: 0 }, 0, 32);
  segments.push(first);

  for (let i = 1; i < SEGMENT_BUFFER_AHEAD; i++) {
    const prev = segments[segments.length - 1];
    segments.push(generateNextSegment(prev, 0));
  }

  return segments;
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
