import { Platform } from 'react-native';

export const ROAD_WIDTH = 8;
export const ROAD_HALF_WIDTH = ROAD_WIDTH / 2;

export const INITIAL_SPEED = 12;
export const SPEED_INCREMENT = 0.18;
export const MAX_SPEED = 30;

export const ARC_CONTROL_LEAD = 8;
export const ARC_CONTROL_EXIT = 8;
export const ARC_ZONE_RADIAL_SLACK = 4.8;

export const CAR_Y = 0.3;
export const POLICE_CAR_WEB_SCALE = 0.42;
export const POLICE_CAR_NATIVE_SCALE = 0.9;
export const POLICE_CAR_VISUAL_SCALE = Platform.OS === 'web' ? POLICE_CAR_WEB_SCALE : POLICE_CAR_NATIVE_SCALE;
export const POLICE_CAR_BASE_NATIVE_SCALE = 0.72;
export const POLICE_CAR_MODEL_HALF_WIDTH = 1.18;
export const CAR_ROD_COLLISION_ALLOWANCE = Math.max(
  0,
  (POLICE_CAR_VISUAL_SCALE - POLICE_CAR_BASE_NATIVE_SCALE) * POLICE_CAR_MODEL_HALF_WIDTH,
);

export const SEGMENT_BUFFER_AHEAD = 15;
export const SEGMENT_CULL_BEHIND = 5;

export const INITIAL_STRAIGHT_LENGTH_MIN = 18;
export const INITIAL_STRAIGHT_LENGTH_MAX = 34;
export const INITIAL_ARC_RADIUS_MIN = 18;
export const INITIAL_ARC_RADIUS_MAX = 42;
export const INITIAL_SWEEP_MIN = Math.PI / 3;
export const INITIAL_SWEEP_MAX = Math.PI * 0.9;

export const STRAIGHT_GUIDE_ASSIST = 4.6;
export const ARC_GUIDE_ASSIST = 1.7;
export const TURN_ALIGN_FORCE = 6.4;
export const TURN_PULL_FORCE = 22;
export const TURN_RADIUS_PULL = 3.2;
export const TURN_RELEASE_FLOAT = 6;
export const TENSION_RISE_RATE = 5.6;
export const TENSION_DROP_RATE = 4.8;
export const HEADING_SMOOTHING = 8;
export const OFFROAD_GRACE_BONUS = 1.25;

export const SCORE_PERFECT = 200;
export const SCORE_GOOD = 100;
export const SCORE_WEAK = 60;

export const BOUNDARY_TOLERANCE = 0.6;

export const CAMERA_BASE_FOV_LANDSCAPE = 58;
export const CAMERA_BASE_FOV_PORTRAIT = 76;
export const CAMERA_TURN_MAX_FOV_LANDSCAPE = 64;
export const CAMERA_TURN_MAX_FOV_PORTRAIT = 82;
export const CAMERA_SAFE_NDC_X_LANDSCAPE = 0.84;
export const CAMERA_SAFE_NDC_Y_LANDSCAPE = 0.8;
export const CAMERA_SAFE_NDC_X_PORTRAIT = 0.82;
export const CAMERA_SAFE_NDC_Y_PORTRAIT = 0.68;
export const CAMERA_CAR_SAFE_NDC_X_LANDSCAPE = 0.8;
export const CAMERA_CAR_SAFE_NDC_X_PORTRAIT = 0.76;
export const CAMERA_CAR_SAFE_NDC_TOP_LANDSCAPE = 0.78;
export const CAMERA_CAR_SAFE_NDC_TOP_PORTRAIT = 0.62;
export const CAMERA_CAR_SAFE_NDC_BOTTOM_LANDSCAPE = 0.56;
export const CAMERA_CAR_SAFE_NDC_BOTTOM_PORTRAIT = 0.44;
export const CAMERA_TURN_DISTANCE_SCALE_MAX_LANDSCAPE = 1.95;
export const CAMERA_TURN_DISTANCE_SCALE_MAX_PORTRAIT = 2.35;
export const CAMERA_TURN_HEIGHT_BONUS_MAX_LANDSCAPE = 12;
export const CAMERA_TURN_HEIGHT_BONUS_MAX_PORTRAIT = 20;
export const CAMERA_HOOK_VISUAL_TOP_Y = 8.8;
export const CAMERA_TURN_LOCK_ENTER = 0.08;
export const CAMERA_TURN_LOCK_EXIT = 0.02;
export const CAMERA_TURN_LOCK_HOLD = 0.24;
