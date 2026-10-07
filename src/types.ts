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
  /** The puppet's four-finger blade curling at the knuckles; 0 = straight. */
  frontFingerCurl: number;
  backFingerCurl: number;
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
  /** When the camera captured this frame (performance.now() timeline). */
  time: number;
}

export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export const FINGER_NAMES: readonly FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export interface FingerFeatures {
  /** 0 = folded into the palm, 1 = fully straight (counts knuckle flexion too). */
  extension: number;
  /** 0 = straight, 1 = fully flexed, from the joint angles. */
  curl: number;
  /** Pointing direction relative to the hand axis, degrees, positive toward +x in view. */
  direction: number;
}

/** Continuous description of one hand, built from all 21 landmarks. */
export interface HandFeatures {
  /** Palm centre in normalized view coordinates. */
  palmX: number;
  palmY: number;
  /** In-image rotation of the hand axis, degrees from upright, positive toward +x. */
  roll: number;
  /** Fingers tipping toward (+) or away from the camera, degrees. */
  pitch: number;
  /** Palm turning sideways, degrees. */
  yaw: number;
  /** Palm length relative to the frame height: grows as the hand nears the camera. */
  size: number;
  thumb: FingerFeatures;
  index: FingerFeatures;
  middle: FingerFeatures;
  ring: FingerFeatures;
  pinky: FingerFeatures;
  /** Thumb abduction away from the index finger, 0..1. */
  thumbSpread: number;
  /** Thumb tip ↔ index tip distance divided by the hand scale. */
  pinchDistance: number;
  /** 0 = wide apart … 1 = touching; continuous. */
  pinchStrength: number;
  /** Thumb ↔ middle fingertip closeness, 0..1. */
  middlePinch: number;
  /** Angular separation of neighbouring fingers, each 0..1. */
  spreadIndexMiddle: number;
  spreadMiddleRing: number;
  spreadRingPinky: number;
  /** Mean extension of the four fingers. */
  openness: number;
  /** How closed the whole hand is, 0..1. */
  fistStrength: number;
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
