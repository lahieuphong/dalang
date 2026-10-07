export type Side = 'left' | 'right';

export const SIDES: readonly Side[] = ['left', 'right'];

export interface Point {
  x: number;
  y: number;
  z?: number;
}

/**
 * Pose of one puppet. Angles are in degrees and expressed in the puppet's own
 * frame, so the same values mean the same gesture for both mirrored puppets.
 */
export interface PuppetRig {
  /** Grip point (where the dalang holds the main rod) in stage units (1000 × 860). */
  x: number;
  y: number;
  scale: number;
  /** Lean; positive tips the puppet toward the direction it faces. */
  bodyRotation: number;
  /** Nod; positive dips the face. */
  headRotation: number;
  /** Front arm. 0 hangs straight down, positive swings forward and up. */
  shoulderAngle: number;
  elbowAngle: number;
  wristAngle: number;
  /** Back arm, same convention. */
  backShoulderAngle: number;
  backElbowAngle: number;
  /** 0 = pressed against the screen, 1 = held toward the lamp (larger, softer shadow). */
  depth: number;
}

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface HandDetection {
  /** 21 landmarks normalized to the video frame, in view space (mirrored when the preview is). */
  landmarks: Point[];
  /** 21 metric landmarks centred on the hand; used for scale-free shape features. */
  worldLandmarks: Point[] | null;
  /** The user's physical hand according to MediaPipe. */
  handedness: Side | null;
  /** The puppet this hand naturally belongs to, given the current mirroring. */
  naturalSide: Side | null;
  handednessScore: number;
}

export interface HandFrame {
  hands: HandDetection[];
  /** Width / height of the source video. */
  aspect: number;
  time: number;
}

export type AssignedHands = Record<Side, HandDetection | null>;

export interface Settings {
  cameraEnabled: boolean;
  showLandmarks: boolean;
  mirror: boolean;
  /** 0..1 */
  sensitivity: number;
  /** 0..1 */
  smoothing: number;
}
