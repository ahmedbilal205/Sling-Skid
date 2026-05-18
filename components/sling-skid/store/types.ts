export interface Vec2 {
  x: number;
  z: number;
}

export type SegmentType = 'straight' | 'arc';

export interface StraightSegment {
  type: 'straight';
  start: Vec2;
  startHeading: number;
  length: number;
  end: Vec2;
  endHeading: number;
}

export interface ArcSegment {
  type: 'arc';
  start: Vec2;
  startHeading: number;
  center: Vec2;
  radius: number;
  sweepAngle: number;
  direction: 1 | -1; // 1 = CCW, -1 = CW
  end: Vec2;
  endHeading: number;
}

export type TrackSegment = StraightSegment | ArcSegment;

export type GamePhase = 'menu' | 'playing' | 'gameOver';

export type SwingQuality = 'none' | 'perfect' | 'good' | 'weak';
export type SwingLineState = 'neutral' | 'loading' | 'drifting';

export interface SwingState {
  engaged: boolean;
  anchorIndex: number;
  tension: number;
  zoneProgress: number;
  turnTime: number;
  turnControl: number;
  wideTime: number;
  regrabs: number;
  slip: number;
  radialError: number;
  lineState: SwingLineState;
  quality: SwingQuality;
}

export interface CarState {
  x: number;
  z: number;
  heading: number;
}
