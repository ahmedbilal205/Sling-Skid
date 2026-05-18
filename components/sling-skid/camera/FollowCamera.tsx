import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {
  CAMERA_BASE_FOV_LANDSCAPE,
  CAMERA_BASE_FOV_PORTRAIT,
  CAMERA_CAR_SAFE_NDC_BOTTOM_LANDSCAPE,
  CAMERA_CAR_SAFE_NDC_BOTTOM_PORTRAIT,
  CAMERA_CAR_SAFE_NDC_TOP_LANDSCAPE,
  CAMERA_CAR_SAFE_NDC_TOP_PORTRAIT,
  CAMERA_CAR_SAFE_NDC_X_LANDSCAPE,
  CAMERA_CAR_SAFE_NDC_X_PORTRAIT,
  CAMERA_HOOK_VISUAL_TOP_Y,
  CAMERA_SAFE_NDC_X_LANDSCAPE,
  CAMERA_SAFE_NDC_X_PORTRAIT,
  CAMERA_SAFE_NDC_Y_LANDSCAPE,
  CAMERA_SAFE_NDC_Y_PORTRAIT,
  CAMERA_TURN_DISTANCE_SCALE_MAX_LANDSCAPE,
  CAMERA_TURN_DISTANCE_SCALE_MAX_PORTRAIT,
  CAMERA_TURN_HEIGHT_BONUS_MAX_LANDSCAPE,
  CAMERA_TURN_HEIGHT_BONUS_MAX_PORTRAIT,
  CAMERA_TURN_LOCK_ENTER,
  CAMERA_TURN_LOCK_EXIT,
  CAMERA_TURN_LOCK_HOLD,
  CAMERA_TURN_MAX_FOV_LANDSCAPE,
  CAMERA_TURN_MAX_FOV_PORTRAIT,
} from '../store/constants';
import { getActiveHookTarget, getGameRuntimeState } from '../store/gameStore';

const _desired = new THREE.Vector3();
const _lookAt = new THREE.Vector3();
const _target = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _car = new THREE.Vector3();
const _hook = new THREE.Vector3();
const _hookTop = new THREE.Vector3();
const _carTop = new THREE.Vector3();
const _pair = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _ndc2 = new THREE.Vector3();

function dampingAlpha(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

function fitPointsInView(
  cam: THREE.PerspectiveCamera,
  points: THREE.Vector3[],
  safeX: number,
  safeY: number,
): boolean {
  for (const point of points) {
    _ndc.copy(point).project(cam);
    if (_ndc.z < -1 || _ndc.z > 1.15) return false;
    if (Math.abs(_ndc.x) > safeX || Math.abs(_ndc.y) > safeY) return false;
  }
  return true;
}

function projectPointToNdc(cam: THREE.PerspectiveCamera, point: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
  return target.copy(point).project(cam);
}

export default function FollowCamera() {
  const { camera, size } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const scratchCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const smoothPos = useRef(new THREE.Vector3(0, 38, -10));
  const smoothLook = useRef(new THREE.Vector3(0, 0, 8));
  const smoothTilt = useRef(0);
  const smoothFov = useRef(CAMERA_BASE_FOV_LANDSCAPE);
  const turnFrameWeight = useRef(0);
  const turnFrameHold = useRef(0);
  const lockedHook = useRef(new THREE.Vector3(0, 0, 0));
  const hasLockedHook = useRef(false);
  const recoveryFrame = useRef(0);
  const cachedRecovery = useRef({ behind: 0, height: 0, lookBack: 0 });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const state = getGameRuntimeState();
    const {
      carX,
      carZ,
      heading,
      velX,
      velZ,
      speed,
      phase,
      swing,
      segments,
      nextArcIndex,
      activeArcIndex,
    } = state;

    const portrait = size.height > size.width;
    const narrow = size.width / Math.max(size.height, 1) < 0.62;

    if (!cameraRef.current) {
      cameraRef.current = camera as THREE.PerspectiveCamera;
      smoothFov.current = cameraRef.current.fov;
    }
    if (!scratchCameraRef.current) {
      scratchCameraRef.current = new THREE.PerspectiveCamera(
        cameraRef.current.fov,
        Math.max(size.width, 1) / Math.max(size.height, 1),
        cameraRef.current.near,
        cameraRef.current.far,
      );
    }

    const cam = cameraRef.current;
    const scratch = scratchCameraRef.current;
    scratch.aspect = Math.max(size.width, 1) / Math.max(size.height, 1);
    scratch.near = cam.near;
    scratch.far = cam.far;

    if (phase === 'menu' || phase === 'gameOver') {
      cam.position.set(0, 38, -12);
      cam.lookAt(0, 0, 10);
      return;
    }

    const baseFov = portrait ? CAMERA_BASE_FOV_PORTRAIT : CAMERA_BASE_FOV_LANDSCAPE;
    const turnMaxFov = portrait ? CAMERA_TURN_MAX_FOV_PORTRAIT : CAMERA_TURN_MAX_FOV_LANDSCAPE;
    const safeX = portrait ? CAMERA_SAFE_NDC_X_PORTRAIT : CAMERA_SAFE_NDC_X_LANDSCAPE;
    const safeY = portrait ? CAMERA_SAFE_NDC_Y_PORTRAIT : CAMERA_SAFE_NDC_Y_LANDSCAPE;
    const carSafeX = portrait ? CAMERA_CAR_SAFE_NDC_X_PORTRAIT : CAMERA_CAR_SAFE_NDC_X_LANDSCAPE;
    const carSafeTop = portrait ? CAMERA_CAR_SAFE_NDC_TOP_PORTRAIT : CAMERA_CAR_SAFE_NDC_TOP_LANDSCAPE;
    const carSafeBottom = portrait
      ? CAMERA_CAR_SAFE_NDC_BOTTOM_PORTRAIT
      : CAMERA_CAR_SAFE_NDC_BOTTOM_LANDSCAPE;
    const maxDistanceScale = portrait
      ? CAMERA_TURN_DISTANCE_SCALE_MAX_PORTRAIT
      : CAMERA_TURN_DISTANCE_SCALE_MAX_LANDSCAPE;
    const maxHeightBonus = portrait
      ? CAMERA_TURN_HEIGHT_BONUS_MAX_PORTRAIT
      : CAMERA_TURN_HEIGHT_BONUS_MAX_LANDSCAPE;

    const velocityHeading = Math.atan2(velZ, velX);
    const moveHeading = speed > 0.25 ? velocityHeading : heading;
    _forward.set(Math.cos(moveHeading), 0, Math.sin(moveHeading));
    _right.set(-_forward.z, 0, _forward.x);
    _car.set(carX, 0.55, carZ);
    _carTop.set(carX, 1.35, carZ);

    const baseBehind = portrait ? 9 + speed * 0.06 : 14 + speed * 0.11;
    const baseSide =
      swing.lineState === 'drifting'
        ? portrait
          ? 1.8
          : 3.2
        : swing.tension * (portrait ? 0.8 : 1.8);
    const baseHeight = portrait ? 44 + speed * 0.08 : 31 + speed * 0.085;
    const lookAhead = portrait ? 26 + speed * 0.24 : 19 + speed * 0.2;

    const hookTarget = getActiveHookTarget(state);
    const shouldLockTurnFrame =
      hookTarget !== null &&
      (swing.engaged ||
        swing.tension > CAMERA_TURN_LOCK_ENTER ||
        activeArcIndex >= 0 ||
        swing.anchorIndex >= 0);

    if (shouldLockTurnFrame && hookTarget) {
      lockedHook.current.set(hookTarget.x, 0, hookTarget.z);
      hasLockedHook.current = true;
      turnFrameHold.current = CAMERA_TURN_LOCK_HOLD;
    } else if (turnFrameHold.current > 0) {
      turnFrameHold.current = Math.max(0, turnFrameHold.current - dt);
    } else if (swing.tension < CAMERA_TURN_LOCK_EXIT) {
      hasLockedHook.current = false;
    }

    const dualTargetGoal = shouldLockTurnFrame || (hasLockedHook.current && turnFrameHold.current > 0) ? 1 : 0;
    turnFrameWeight.current +=
      (dualTargetGoal - turnFrameWeight.current) * dampingAlpha(dualTargetGoal > turnFrameWeight.current ? 7.5 : 5, dt);

    let targetFov = baseFov;
    _desired.set(
      carX - _forward.x * baseBehind - _right.x * baseSide,
      baseHeight,
      carZ - _forward.z * baseBehind - _right.z * baseSide,
    );
    _lookAt.set(
      carX + _forward.x * lookAhead,
      0.45,
      carZ + _forward.z * lookAhead,
    );

    if (turnFrameWeight.current > 0.02 && hasLockedHook.current) {
      _hook.copy(lockedHook.current);
      _hookTop.set(lockedHook.current.x, CAMERA_HOOK_VISUAL_TOP_Y, lockedHook.current.z);
      _pair.subVectors(_hook, _car);
      _mid.copy(_car).add(_hook).multiplyScalar(0.5);

      const forwardSep = Math.abs(_pair.dot(_forward));
      const sideSep = Math.abs(_pair.dot(_right));
      const signedSide = _pair.dot(_right);
      const weight = turnFrameWeight.current;

      const solveBehind =
        baseBehind * (1.12 + weight * 0.12) +
        sideSep * (portrait ? 0.46 : 0.32) +
        forwardSep * (portrait ? 0.34 : 0.24);
      const solveHeight =
        baseHeight +
        sideSep * (portrait ? 0.36 : 0.22) +
        forwardSep * (portrait ? 0.18 : 0.12);
      let solveFov = Math.min(turnMaxFov, baseFov + 2 + weight * (portrait ? 4 : 3));
      const lookLift = 0.7 + sideSep * 0.05;
      const lateralBias = clamp(signedSide * 0.18, -5, 5);
      let distanceScale = 1;
      let heightBonus = 0;

      _lookAt.set(
        _mid.x + _forward.x * lookAhead * 0.14,
        lookLift,
        _mid.z + _forward.z * lookAhead * 0.14,
      );

      for (let i = 0; i < 10; i++) {
        _desired.set(
          _mid.x - _forward.x * solveBehind * distanceScale + _right.x * lateralBias,
          solveHeight + heightBonus,
          _mid.z - _forward.z * solveBehind * distanceScale + _right.z * lateralBias,
        );

        scratch.position.copy(_desired);
        scratch.up.set(0, 1, 0);
        scratch.fov = solveFov;
        scratch.lookAt(_lookAt);
        scratch.updateProjectionMatrix();
        scratch.updateMatrixWorld();

        if (fitPointsInView(scratch, [_car, _carTop, _hook, _hookTop], safeX, safeY)) {
          break;
        }

        distanceScale = Math.min(maxDistanceScale, distanceScale + (portrait ? 0.18 : 0.12));
        heightBonus = Math.min(maxHeightBonus, heightBonus + (portrait ? 2.8 : 1.7));
        solveFov = Math.min(turnMaxFov, solveFov + (portrait || narrow ? 1.6 : 1.1));
      }

      targetFov = solveFov;
    } else {
      const nextSeg = segments[nextArcIndex];
      if (nextSeg?.type === 'arc') {
        const nodeDx = nextSeg.center.x - carX;
        const nodeDz = nextSeg.center.z - carZ;
        const nodeDist = Math.sqrt(nodeDx * nodeDx + nodeDz * nodeDz);
        if (nodeDist < 120) {
          const cameraNodeWeight = portrait ? 0.26 : 0.16;
          _lookAt.x = _lookAt.x * (1 - cameraNodeWeight) + nextSeg.center.x * cameraNodeWeight;
          _lookAt.z = _lookAt.z * (1 - cameraNodeWeight) + nextSeg.center.z * cameraNodeWeight;

          const nodeSideBias = portrait ? 0.16 : 0.08;
          _desired.x += nodeDx * nodeSideBias;
          _desired.z += nodeDz * nodeSideBias;
        }
      }
    }

    let carRecoveryBehind = 0;
    let carRecoveryHeight = 0;
    let carRecoveryLookBack = 0;
    const canReuseRecovery = turnFrameWeight.current < 0.05 && recoveryFrame.current % 2 === 1;
    recoveryFrame.current += 1;

    if (canReuseRecovery) {
      carRecoveryBehind = cachedRecovery.current.behind;
      carRecoveryHeight = cachedRecovery.current.height;
      carRecoveryLookBack = cachedRecovery.current.lookBack;
    } else {
      for (let i = 0; i < 8; i++) {
        scratch.position.set(
          _desired.x - _forward.x * carRecoveryBehind,
          _desired.y + carRecoveryHeight,
          _desired.z - _forward.z * carRecoveryBehind,
        );
        scratch.up.set(0, 1, 0);
        scratch.fov = targetFov;
        scratch.lookAt(
          _lookAt.x - _forward.x * carRecoveryLookBack,
          _lookAt.y,
          _lookAt.z - _forward.z * carRecoveryLookBack,
        );
        scratch.updateProjectionMatrix();
        scratch.updateMatrixWorld();

        const carNdc = projectPointToNdc(scratch, _car, _ndc);
        const carTopNdc = projectPointToNdc(scratch, _carTop, _ndc2);
        const xOverflow = Math.max(Math.abs(carNdc.x), Math.abs(carTopNdc.x)) - carSafeX;
        const bottomOverflow = -carNdc.y - carSafeBottom;
        const topOverflow = carTopNdc.y - carSafeTop;

        if (xOverflow <= 0 && bottomOverflow <= 0 && topOverflow <= 0 && carNdc.z <= 1.05) {
          break;
        }

        const xBoost = Math.max(0, xOverflow);
        const bottomBoost = Math.max(0, bottomOverflow);
        const topBoost = Math.max(0, topOverflow);

        carRecoveryBehind += (portrait ? 0.95 : 0.7) + xBoost * 2.8 + bottomBoost * 4.8;
        carRecoveryHeight += (portrait ? 0.7 : 0.45) + xBoost * 1.8 + bottomBoost * 4.2 + topBoost * 1.4;
        carRecoveryLookBack += (portrait ? 0.45 : 0.3) + bottomBoost * 2.6;
      }

      cachedRecovery.current.behind = carRecoveryBehind;
      cachedRecovery.current.height = carRecoveryHeight;
      cachedRecovery.current.lookBack = carRecoveryLookBack;
    }

    _desired.addScaledVector(_forward, -carRecoveryBehind);
    _desired.y += carRecoveryHeight;
    _lookAt.addScaledVector(_forward, -carRecoveryLookBack);

    const posAlpha = dampingAlpha(turnFrameWeight.current > 0.1 ? 6.5 : 4.8, dt);
    const lookAlpha = dampingAlpha(turnFrameWeight.current > 0.1 ? 7.5 : 5.8, dt);
    const fovAlpha = dampingAlpha(turnFrameWeight.current > 0.1 ? 3.4 : 2.6, dt);

    smoothPos.current.lerp(_desired, posAlpha);
    smoothLook.current.lerp(_lookAt, lookAlpha);
    const easedTargetFov = smoothFov.current + (targetFov - smoothFov.current) * fovAlpha;
    smoothFov.current = moveTowards(
      smoothFov.current,
      easedTargetFov,
      (turnFrameWeight.current > 0.1 ? 10 : 7) * dt,
    );

    const targetTilt =
      swing.lineState === 'drifting'
        ? -0.08
        : swing.tension > 0.15
          ? -0.02 - swing.tension * 0.05
          : 0;
    smoothTilt.current += (targetTilt - smoothTilt.current) * dampingAlpha(5.8, dt);

    cam.position.copy(smoothPos.current);
    cam.fov = smoothFov.current;
    cam.updateProjectionMatrix();
    _up.set(Math.sin(smoothTilt.current), Math.cos(smoothTilt.current), 0);
    cam.up.copy(_up);
    _target.copy(smoothLook.current);
    cam.lookAt(_target);
  });

  return null;
}
