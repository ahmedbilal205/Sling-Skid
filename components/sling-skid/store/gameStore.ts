import { create } from 'zustand';
import type {
  GamePhase,
  SwingState,
  TrackSegment,
  SwingQuality,
  ArcSegment,
  SwingLineState,
  Vec2,
} from './types';
import {
  INITIAL_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  SCORE_PERFECT,
  SCORE_GOOD,
  SCORE_WEAK,
  BOUNDARY_TOLERANCE,
  ROAD_HALF_WIDTH,
  ARC_CONTROL_LEAD,
  ARC_CONTROL_EXIT,
  ARC_ZONE_RADIAL_SLACK,
  STRAIGHT_GUIDE_ASSIST,
  ARC_GUIDE_ASSIST,
  TURN_ALIGN_FORCE,
  TURN_PULL_FORCE,
  TURN_RADIUS_PULL,
  TURN_RELEASE_FLOAT,
  TENSION_RISE_RATE,
  TENSION_DROP_RATE,
  HEADING_SMOOTHING,
  OFFROAD_GRACE_BONUS,
  CAR_ROD_COLLISION_ALLOWANCE,
} from './constants';
import { generateInitialTrack, generateNextSegment, isOnRoad } from '../track/trackGenerator';

const defaultSwing: SwingState = {
  engaged: false,
  anchorIndex: -1,
  tension: 0,
  zoneProgress: 0,
  turnTime: 0,
  turnControl: 0,
  wideTime: 0,
  regrabs: 0,
  slip: 0,
  radialError: 0,
  lineState: 'neutral',
  quality: 'none',
};

function getNextArcIndex(segments: TrackSegment[], startIndex: number): number {
  for (let i = Math.max(0, startIndex); i < segments.length; i++) {
    if (segments[i].type === 'arc') return i;
  }
  return -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function normalizeAngle(angle: number): number {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

function positiveAngle(value: number): number {
  while (value < -0.15) value += Math.PI * 2;
  while (value > Math.PI * 2 + 0.15) value -= Math.PI * 2;
  return value;
}

function moveTowards(current: number, target: number, maxStep: number): number {
  if (current < target) return Math.min(current + maxStep, target);
  return Math.max(current - maxStep, target);
}

function resetSwing(quality: SwingQuality = 'none'): SwingState {
  return {
    ...defaultSwing,
    quality,
  };
}

function guideHeadingForSegment(segment: TrackSegment, pos: Vec2): number {
  if (segment.type === 'straight') return segment.startHeading;

  const angle = Math.atan2(pos.z - segment.center.z, pos.x - segment.center.x);
  return angle + (segment.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
}

interface ArcZoneState {
  progress: number;
  phase: 'approach' | 'corner' | 'exit';
  radialError: number;
  tangentHeading: number;
}

function assessArcZone(pos: Vec2, arc: ArcSegment): ArcZoneState | null {
  const relStartX = pos.x - arc.start.x;
  const relStartZ = pos.z - arc.start.z;
  const forwardX = Math.cos(arc.startHeading);
  const forwardZ = Math.sin(arc.startHeading);
  const lateralX = -forwardZ;
  const lateralZ = forwardX;
  const along = relStartX * forwardX + relStartZ * forwardZ;
  const lateral = relStartX * lateralX + relStartZ * lateralZ;

  const dx = pos.x - arc.center.x;
  const dz = pos.z - arc.center.z;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const radialError = dist - arc.radius;
  const startAngle = Math.atan2(arc.start.z - arc.center.z, arc.start.x - arc.center.x);
  const rawTurnAngle = (Math.atan2(dz, dx) - startAngle) * arc.direction;
  const turnAngle = positiveAngle(rawTurnAngle);
  const arcLength = arc.radius * arc.sweepAngle;
  const exitAngleBuffer = ARC_CONTROL_EXIT / arc.radius;
  const totalLen = ARC_CONTROL_LEAD + arcLength + ARC_CONTROL_EXIT;

  const inApproach =
    along >= -ARC_CONTROL_LEAD &&
    along < 0.8 &&
    Math.abs(lateral) <= ROAD_HALF_WIDTH + 2.6 + CAR_ROD_COLLISION_ALLOWANCE;
  if (inApproach) {
    return {
      progress: clamp01((along + ARC_CONTROL_LEAD) / totalLen),
      phase: 'approach',
      radialError,
      tangentHeading: arc.startHeading,
    };
  }

  const inCorner =
    turnAngle >= -0.08 &&
    turnAngle <= arc.sweepAngle + exitAngleBuffer &&
    Math.abs(radialError) <= ROAD_HALF_WIDTH + ARC_ZONE_RADIAL_SLACK + CAR_ROD_COLLISION_ALLOWANCE;

  if (!inCorner) return null;

  if (turnAngle <= arc.sweepAngle) {
    return {
      progress: clamp01((ARC_CONTROL_LEAD + turnAngle * arc.radius) / totalLen),
      phase: 'corner',
      radialError,
      tangentHeading: Math.atan2(dz, dx) + (arc.direction > 0 ? Math.PI / 2 : -Math.PI / 2),
    };
  }

  return {
    progress: clamp01(
      (ARC_CONTROL_LEAD + arcLength + Math.min((turnAngle - arc.sweepAngle) * arc.radius, ARC_CONTROL_EXIT)) /
        totalLen,
    ),
    phase: 'exit',
    radialError,
    tangentHeading: arc.endHeading,
  };
}

function resolveArcContext(
  pos: Vec2,
  segments: TrackSegment[],
  currentSegmentIndex: number,
  preferredIndex: number,
): { activeArcIndex: number; activeZone: ArcZoneState | null; nextArcIndex: number } {
  if (
    preferredIndex >= 0 &&
    preferredIndex < segments.length &&
    segments[preferredIndex]?.type === 'arc'
  ) {
    const preferredArc = segments[preferredIndex] as ArcSegment;
    const preferredZone = assessArcZone(pos, preferredArc);
    if (preferredZone) {
      return { activeArcIndex: preferredIndex, activeZone: preferredZone, nextArcIndex: preferredIndex };
    }
  }

  const start = Math.max(0, currentSegmentIndex - 1);
  const end = Math.min(segments.length, currentSegmentIndex + 5);
  for (let i = start; i < end; i++) {
    if (segments[i]?.type !== 'arc') continue;
    const zone = assessArcZone(pos, segments[i] as ArcSegment);
    if (zone) {
      return { activeArcIndex: i, activeZone: zone, nextArcIndex: i };
    }
  }

  return {
    activeArcIndex: -1,
    activeZone: null,
    nextArcIndex: getNextArcIndex(segments, currentSegmentIndex),
  };
}

function scoreTurn(
  combo: number,
  swing: SwingState,
): { quality: SwingQuality; scoreAdd: number; combo: number; multiplier: number } {
  const control = swing.turnControl / Math.max(swing.turnTime, 0.0001);
  const driftPenalty = swing.wideTime / Math.max(swing.turnTime, 0.0001);
  const pulseBonus = Math.min(swing.regrabs, 3) * 0.05;
  const score = control + pulseBonus - driftPenalty * 0.85;

  if (score >= 0.58) {
    const nextCombo = combo + 1;
    const nextMultiplier = Math.min(nextCombo + 1, 8);
    return {
      quality: 'perfect',
      scoreAdd: SCORE_PERFECT * nextMultiplier,
      combo: nextCombo,
      multiplier: nextMultiplier,
    };
  }

  if (score >= 0.33) {
    const nextCombo = combo + 1;
    const nextMultiplier = Math.min(nextCombo + 1, 8);
    return {
      quality: 'good',
      scoreAdd: SCORE_GOOD * nextMultiplier,
      combo: nextCombo,
      multiplier: nextMultiplier,
    };
  }

  return {
    quality: 'weak',
    scoreAdd: SCORE_WEAK,
    combo: 0,
    multiplier: 1,
  };
}

export interface GameState {
  phase: GamePhase;

  carX: number;
  carZ: number;
  heading: number;
  velX: number;
  velZ: number;

  inputHeld: boolean;
  hasPulledIn: boolean;
  speed: number;
  paceSpeed: number;
  distance: number;
  score: number;
  combo: number;
  multiplier: number;
  turnsCompleted: number;

  swing: SwingState;
  segments: TrackSegment[];
  currentSegmentIndex: number;
  nextArcIndex: number;
  activeArcIndex: number;
  activeArcZone: number;

  startGame: () => void;
  endGame: () => void;
  triggerSling: () => void;
  releaseSling: () => void;
  tick: (dt: number) => void;
}

export function getActiveHookTarget(state: Pick<GameState, 'segments' | 'swing' | 'activeArcIndex'>): Vec2 | null {
  const { segments, swing, activeArcIndex } = state;
  const hookIndex = swing.anchorIndex >= 0 ? swing.anchorIndex : activeArcIndex;
  if (hookIndex < 0 || hookIndex >= segments.length || segments[hookIndex]?.type !== 'arc') {
    return null;
  }

  const arc = segments[hookIndex] as ArcSegment;
  return {
    x: arc.center.x,
    z: arc.center.z,
  };
}

export type GameRuntimeState = Omit<
  GameState,
  'startGame' | 'endGame' | 'triggerSling' | 'releaseSling' | 'tick'
>;

const PUBLISH_INTERVAL = 0.1;

const initialRuntimeState: GameRuntimeState = {
  phase: 'menu',

  carX: 0,
  carZ: 0,
  heading: 0,
  velX: INITIAL_SPEED,
  velZ: 0,

  inputHeld: false,
  hasPulledIn: false,
  speed: INITIAL_SPEED,
  paceSpeed: INITIAL_SPEED,
  distance: 0,
  score: 0,
  combo: 0,
  multiplier: 1,
  turnsCompleted: 0,

  swing: { ...defaultSwing },
  segments: [],
  currentSegmentIndex: 0,
  nextArcIndex: 0,
  activeArcIndex: -1,
  activeArcZone: -1,
};

let runtimeState: GameRuntimeState = {
  ...initialRuntimeState,
  swing: { ...defaultSwing },
};
let publishElapsed = 0;
let publishGameSnapshot: ((snapshot: GameRuntimeState) => void) | null = null;

function commitRuntimeState(patch: Partial<GameRuntimeState>, publishNow = false) {
  runtimeState = {
    ...runtimeState,
    ...patch,
  };

  if (publishNow) {
    publishElapsed = 0;
    publishGameSnapshot?.(runtimeState);
  }
}

function maybePublishRuntimeState(dt: number, force = false) {
  publishElapsed += dt;
  if (!force && publishElapsed < PUBLISH_INTERVAL) return;

  publishElapsed = 0;
  publishGameSnapshot?.(runtimeState);
}

export function getGameRuntimeState(): GameRuntimeState {
  return runtimeState;
}

export function startGameRuntime() {
  const segments = generateInitialTrack();
  const firstArc = getNextArcIndex(segments, 0);

  commitRuntimeState(
    {
      phase: 'playing',
      carX: segments[0].start.x,
      carZ: segments[0].start.z,
      heading: segments[0].startHeading,
      velX: Math.cos(segments[0].startHeading) * INITIAL_SPEED,
      velZ: Math.sin(segments[0].startHeading) * INITIAL_SPEED,
      inputHeld: false,
      hasPulledIn: false,
      speed: INITIAL_SPEED,
      paceSpeed: INITIAL_SPEED,
      distance: 0,
      score: 0,
      combo: 0,
      multiplier: 1,
      turnsCompleted: 0,
      swing: { ...defaultSwing },
      segments,
      currentSegmentIndex: 0,
      nextArcIndex: firstArc >= 0 ? firstArc : 0,
      activeArcIndex: -1,
      activeArcZone: -1,
    },
    true,
  );
}

export function endGameRuntime() {
  commitRuntimeState({ phase: 'gameOver' }, true);
}

export function releaseSlingRuntime() {
  commitRuntimeState(
    {
      inputHeld: false,
      swing: {
        ...runtimeState.swing,
        engaged: false,
      },
    },
    true,
  );
}

export function triggerSlingRuntime() {
  const state = runtimeState;
  if (state.phase !== 'playing') return;

  commitRuntimeState(
    {
      inputHeld: true,
      hasPulledIn: state.hasPulledIn || state.activeArcIndex >= 0,
      swing:
        state.activeArcIndex >= 0 &&
        state.swing.anchorIndex === state.activeArcIndex &&
        !state.swing.engaged
          ? {
              ...state.swing,
              engaged: true,
              regrabs: state.swing.regrabs + (state.swing.turnTime > 0.08 ? 1 : 0),
            }
          : {
              ...state.swing,
              engaged: state.activeArcIndex >= 0,
            },
    },
    true,
  );
}

export function stepGameRuntime(dt: number) {
  const state = runtimeState;
  if (state.phase !== 'playing') return;

  const posBefore = { x: state.carX, z: state.carZ };
  const arcBefore = resolveArcContext(
    posBefore,
    state.segments,
    state.currentSegmentIndex,
    state.activeArcIndex >= 0 ? state.activeArcIndex : state.swing.anchorIndex,
  );

  const newPaceSpeed = Math.min(state.paceSpeed + SPEED_INCREMENT * dt, MAX_SPEED);
  let newScore = state.score;
  let newCombo = state.combo;
  let newMultiplier = state.multiplier;
  let newTurns = state.turnsCompleted;
  let newX = state.carX;
  let newZ = state.carZ;
  let newHeading = state.heading;
  let newSwing = { ...state.swing };
  let newVelX = state.velX;
  let newVelZ = state.velZ;

  if (newSwing.anchorIndex !== arcBefore.activeArcIndex) {
    if (newSwing.anchorIndex >= 0 && newSwing.zoneProgress > 0.45) {
      const turnScore = scoreTurn(newCombo, newSwing);
      newScore += turnScore.scoreAdd;
      newCombo = turnScore.combo;
      newMultiplier = turnScore.multiplier;
      newTurns += 1;
      newSwing = resetSwing(turnScore.quality);
    }

    if (arcBefore.activeArcIndex >= 0) {
      newSwing = {
        ...resetSwing(newSwing.quality),
        anchorIndex: arcBefore.activeArcIndex,
        engaged: state.inputHeld,
        regrabs: state.inputHeld ? 1 : 0,
      };
    }
  }

  const guideSegment = arcBefore.activeArcIndex >= 0
    ? (state.segments[arcBefore.activeArcIndex] as ArcSegment)
    : state.segments[state.currentSegmentIndex];
  const guideHeading =
    arcBefore.activeZone?.tangentHeading ?? guideHeadingForSegment(guideSegment, posBefore);
  const guideX = Math.cos(guideHeading);
  const guideZ = Math.sin(guideHeading);
  const speedBefore = Math.hypot(newVelX, newVelZ) || state.paceSpeed;
  const assistStrength = arcBefore.activeArcIndex >= 0 ? ARC_GUIDE_ASSIST : STRAIGHT_GUIDE_ASSIST;

  newVelX += (guideX * speedBefore - newVelX) * assistStrength * dt;
  newVelZ += (guideZ * speedBefore - newVelZ) * assistStrength * dt;

  const tensionTarget = arcBefore.activeArcIndex >= 0 && state.inputHeld ? 1 : 0;
  const tensionRate = tensionTarget > newSwing.tension ? TENSION_RISE_RATE : TENSION_DROP_RATE;
  newSwing.tension = moveTowards(newSwing.tension, tensionTarget, tensionRate * dt);
  newSwing.engaged = arcBefore.activeArcIndex >= 0 && state.inputHeld;

  if (arcBefore.activeArcIndex >= 0) {
    const arc = state.segments[arcBefore.activeArcIndex] as ArcSegment;
    const dx = state.carX - arc.center.x;
    const dz = state.carZ - arc.center.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    const radialX = dx / dist;
    const radialZ = dz / dist;
    const tangentHeadingNow = arcBefore.activeZone?.tangentHeading ?? guideHeading;
    const tangentX = Math.cos(tangentHeadingNow);
    const tangentZ = Math.sin(tangentHeadingNow);
    const radialError = dist - arc.radius;
    const tension = newSwing.tension;

    if (newSwing.engaged) {
      const inwardForce = (TURN_PULL_FORCE + Math.max(radialError, -1.5) * TURN_RADIUS_PULL) * tension;
      newVelX += -radialX * inwardForce * dt;
      newVelZ += -radialZ * inwardForce * dt;
      newVelX += (tangentX * Math.max(speedBefore, newPaceSpeed) - newVelX) * TURN_ALIGN_FORCE * tension * dt;
      newVelZ += (tangentZ * Math.max(speedBefore, newPaceSpeed) - newVelZ) * TURN_ALIGN_FORCE * tension * dt;
    } else {
      newVelX += radialX * TURN_RELEASE_FLOAT * dt;
      newVelZ += radialZ * TURN_RELEASE_FLOAT * dt;
    }
  }

  const postForceSpeed = Math.max(Math.hypot(newVelX, newVelZ), 0.001);
  const desiredSpeed = newPaceSpeed * (1 + newSwing.tension * 0.08);
  const speedBlend = clamp01(dt * (arcBefore.activeArcIndex >= 0 ? 2.4 : 4.8));
  const nextSpeed = postForceSpeed + (desiredSpeed - postForceSpeed) * speedBlend;
  newVelX = (newVelX / postForceSpeed) * nextSpeed;
  newVelZ = (newVelZ / postForceSpeed) * nextSpeed;

  newX += newVelX * dt;
  newZ += newVelZ * dt;

  const velocityHeading = Math.atan2(newVelZ, newVelX);
  newHeading += normalizeAngle(velocityHeading - newHeading) * clamp01(HEADING_SMOOTHING * dt);
  const newSpeed = Math.hypot(newVelX, newVelZ);
  const newDistance = state.distance + newSpeed * dt;

  const onRoad = isOnRoad(
    { x: newX, z: newZ },
    state.segments,
    state.currentSegmentIndex,
    ROAD_HALF_WIDTH +
      BOUNDARY_TOLERANCE +
      (arcBefore.activeArcIndex >= 0 ? OFFROAD_GRACE_BONUS * (0.45 + newSwing.tension * 0.55) : 0),
  );

  if (!onRoad) {
    commitRuntimeState({ phase: 'gameOver', carX: newX, carZ: newZ, velX: newVelX, velZ: newVelZ }, true);
    return;
  }

  let newSegIdx = state.currentSegmentIndex;
  while (newSegIdx < state.segments.length - 1) {
    const nextSeg = state.segments[newSegIdx + 1];
    const dx = newX - nextSeg.start.x;
    const dz = newZ - nextSeg.start.z;
    const fwd_x = Math.cos(nextSeg.startHeading);
    const fwd_z = Math.sin(nextSeg.startHeading);
    const dot = dx * fwd_x + dz * fwd_z;
    if (dot > 0) {
      newSegIdx++;
    } else {
      break;
    }
  }

  let newSegments = state.segments;
  const remaining = newSegments.length - newSegIdx;
  if (remaining < 15) {
    const toAdd: TrackSegment[] = [];
    let last = newSegments[newSegments.length - 1];
    const count = 15 - remaining + 2;
    for (let i = 0; i < count; i++) {
      last = generateNextSegment(last, newDistance);
      toAdd.push(last);
    }
    newSegments = [...newSegments, ...toAdd];
  }

  const arcAfter = resolveArcContext(
    { x: newX, z: newZ },
    newSegments,
    newSegIdx,
    arcBefore.activeArcIndex >= 0 ? arcBefore.activeArcIndex : newSwing.anchorIndex,
  );

  if (arcAfter.activeArcIndex >= 0) {
    if (newSwing.anchorIndex !== arcAfter.activeArcIndex) {
      newSwing = {
        ...resetSwing(newSwing.quality),
        anchorIndex: arcAfter.activeArcIndex,
        engaged: state.inputHeld,
        regrabs: state.inputHeld ? 1 : 0,
      };
    }

    newSwing.zoneProgress = Math.max(newSwing.zoneProgress, arcAfter.activeZone?.progress ?? 0);
    newSwing.radialError = arcAfter.activeZone?.radialError ?? 0;
    newSwing.turnTime += dt;
    newSwing.turnControl += newSwing.tension * dt;
    newSwing.wideTime +=
      Math.max(0, Math.abs(newSwing.radialError) - ROAD_HALF_WIDTH * 0.25) /
      (ROAD_HALF_WIDTH + ARC_ZONE_RADIAL_SLACK) *
      dt;
    newSwing.slip = clamp01(
      Math.abs(newSwing.radialError) / (ROAD_HALF_WIDTH + 2) + (1 - newSwing.tension) * 0.28,
    );
    newSwing.lineState = newSwing.engaged
      ? 'loading'
      : newSwing.slip > 0.32
        ? 'drifting'
        : 'neutral';
  } else {
    if (newSwing.anchorIndex >= 0 && newSwing.zoneProgress > 0.45) {
      const turnScore = scoreTurn(newCombo, newSwing);
      newScore += turnScore.scoreAdd;
      newCombo = turnScore.combo;
      newMultiplier = turnScore.multiplier;
      newTurns += 1;
      newSwing = resetSwing(turnScore.quality);
    } else {
      newSwing = {
        ...newSwing,
        engaged: false,
        radialError: 0,
        slip: Math.max(0, newSwing.slip - dt * 2.5),
        lineState: 'neutral' as SwingLineState,
        anchorIndex: state.inputHeld ? newSwing.anchorIndex : -1,
      };
    }
  }

  if (arcAfter.activeArcIndex < 0 && newSwing.anchorIndex < 0) {
    newSwing.tension = Math.max(0, newSwing.tension - TENSION_DROP_RATE * dt);
  }

  if (!state.inputHeld && arcAfter.activeArcIndex < 0 && newSegIdx > 5) {
    const pruneCount = newSegIdx - 3;
    newSegments = newSegments.slice(pruneCount);
    newSegIdx -= pruneCount;
    if (newSwing.anchorIndex >= 0) {
      newSwing.anchorIndex = Math.max(-1, newSwing.anchorIndex - pruneCount);
    }
    const adjustedActive = arcAfter.activeArcIndex >= 0 ? arcAfter.activeArcIndex - pruneCount : -1;
    const adjustedNext = arcAfter.nextArcIndex >= 0 ? arcAfter.nextArcIndex - pruneCount : -1;

    commitRuntimeState({
      carX: newX,
      carZ: newZ,
      heading: newHeading,
      velX: newVelX,
      velZ: newVelZ,
      speed: newSpeed,
      paceSpeed: newPaceSpeed,
      hasPulledIn: state.hasPulledIn || newSwing.engaged,
      distance: newDistance,
      score: newScore + Math.floor(newSpeed * dt * (0.35 + newSwing.tension * 1.35)),
      combo: newCombo,
      multiplier: newMultiplier,
      swing: newSwing,
      currentSegmentIndex: newSegIdx,
      nextArcIndex: adjustedNext,
      activeArcIndex: adjustedActive,
      activeArcZone: adjustedActive >= 0 ? arcAfter.activeZone?.progress ?? 0 : -1,
      segments: newSegments,
      turnsCompleted: newTurns,
    });
    maybePublishRuntimeState(dt, true);
    return;
  }

  commitRuntimeState({
    carX: newX,
    carZ: newZ,
    heading: newHeading,
    velX: newVelX,
    velZ: newVelZ,
    inputHeld: state.inputHeld,
    hasPulledIn: state.hasPulledIn || newSwing.engaged,
    speed: newSpeed,
    paceSpeed: newPaceSpeed,
    distance: newDistance,
    score: newScore + Math.floor(newSpeed * dt * (0.35 + newSwing.tension * 1.35)),
    combo: newCombo,
    multiplier: newMultiplier,
    swing: newSwing,
    currentSegmentIndex: newSegIdx,
    nextArcIndex: arcAfter.nextArcIndex,
    activeArcIndex: arcAfter.activeArcIndex,
    activeArcZone: arcAfter.activeArcIndex >= 0 ? arcAfter.activeZone?.progress ?? 0 : -1,
    segments: newSegments,
    turnsCompleted: newTurns,
  });
  maybePublishRuntimeState(dt, newSegIdx !== state.currentSegmentIndex || newSegments !== state.segments);
}

export const useGameStore = create<GameState>((set) => ({
  ...runtimeState,

  startGame: () => {
    startGameRuntime();
  },

  endGame: () => {
    endGameRuntime();
  },

  releaseSling: () => {
    releaseSlingRuntime();
  },

  triggerSling: () => {
    triggerSlingRuntime();
  },

  tick: (dt: number) => {
    stepGameRuntime(dt);
  },
}));

publishGameSnapshot = (snapshot) => {
  useGameStore.setState({
    ...snapshot,
  });
};
