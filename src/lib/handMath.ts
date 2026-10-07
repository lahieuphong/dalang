import type { HandDetection, Point } from '../types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Maps value from [sourceMin, sourceMax] to [0, 1], clamped. */
export const normalize = (value: number, sourceMin: number, sourceMax: number) =>
  clamp((value - sourceMin) / (sourceMax - sourceMin), 0, 1);

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

export const distance2D = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Direction of a→b in degrees measured from straight up, positive leaning toward +x.
 * `aspect` corrects normalized image coordinates for non-square frames.
 */
export const angleFromVertical = (a: Point, b: Point, aspect = 1) =>
  (Math.atan2((b.x - a.x) * aspect, -(b.y - a.y)) * 180) / Math.PI;

export const wrapDegrees = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

export const LANDMARK = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  PINKY_MCP: 17,
} as const;

type Finger = readonly [mcp: number, pip: number, dip: number, tip: number];

export const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const satisfies Record<string, Finger>;

/** Average of the wrist and the four finger knuckles: far steadier than the wrist alone. */
export function palmCenter(landmarks: Point[]): Point {
  const ids = [LANDMARK.WRIST, LANDMARK.INDEX_MCP, LANDMARK.MIDDLE_MCP, LANDMARK.RING_MCP, LANDMARK.PINKY_MCP];
  let x = 0;
  let y = 0;
  for (const id of ids) {
    x += landmarks[id].x;
    y += landmarks[id].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

/**
 * 0 = curled into the palm, 1 = fully extended. Compares the wrist→tip chord to the
 * bone path so that knuckle flexion counts as well as finger curl.
 */
export function fingerExtension(landmarks: Point[], finger: Finger): number {
  const [mcp, pip, dip, tip] = finger;
  const wrist = landmarks[LANDMARK.WRIST];
  const path =
    distance(wrist, landmarks[mcp]) +
    distance(landmarks[mcp], landmarks[pip]) +
    distance(landmarks[pip], landmarks[dip]) +
    distance(landmarks[dip], landmarks[tip]);
  if (path < 1e-6) return 0;
  return normalize(distance(wrist, landmarks[tip]) / path, 0.55, 0.95);
}

/** Mean extension of the middle, ring and pinky fingers. */
export function handOpenness(landmarks: Point[]): number {
  return (
    (fingerExtension(landmarks, FINGERS.middle) +
      fingerExtension(landmarks, FINGERS.ring) +
      fingerExtension(landmarks, FINGERS.pinky)) /
    3
  );
}

function palmLength(landmarks: Point[]) {
  return Math.max(1e-6, distance(landmarks[LANDMARK.WRIST], landmarks[LANDMARK.MIDDLE_MCP]));
}

/** How far the thumb tip stands away from the index knuckle. */
export function thumbSpread(landmarks: Point[]): number {
  return normalize(distance(landmarks[LANDMARK.THUMB_TIP], landmarks[LANDMARK.INDEX_MCP]) / palmLength(landmarks), 0.3, 0.95);
}

/** 0 when thumb and index tips touch, 1 when they are wide apart. */
export function pinchOpenness(landmarks: Point[]): number {
  return normalize(distance(landmarks[LANDMARK.THUMB_TIP], landmarks[LANDMARK.INDEX_TIP]) / palmLength(landmarks), 0.15, 0.85);
}

export interface HandFeatures {
  /** Palm centre in normalized view coordinates. */
  palmX: number;
  palmY: number;
  /** Hand axis (wrist → middle knuckle) in degrees from upright, positive toward +x. */
  tilt: number;
  /** Index finger direction relative to the hand axis, positive toward +x. */
  indexDeflection: number;
  indexExtension: number;
  openness: number;
  thumbSpread: number;
  pinch: number;
  /** Palm length relative to the frame height: grows as the hand nears the camera. */
  size: number;
}

export function extractHandFeatures(hand: HandDetection, aspect: number): HandFeatures {
  const lm = hand.landmarks;
  // Shape features prefer metric world landmarks: they are immune to distance and foreshortening.
  const shape = hand.worldLandmarks ?? lm.map((p) => ({ x: p.x * aspect, y: p.y, z: (p.z ?? 0) * aspect }));
  const palm = palmCenter(lm);
  const tilt = angleFromVertical(lm[LANDMARK.WRIST], lm[LANDMARK.MIDDLE_MCP], aspect);
  const indexDirection = angleFromVertical(lm[LANDMARK.INDEX_MCP], lm[LANDMARK.INDEX_TIP], aspect);
  const wrist = lm[LANDMARK.WRIST];
  const knuckle = lm[LANDMARK.MIDDLE_MCP];

  return {
    palmX: palm.x,
    palmY: palm.y,
    tilt,
    indexDeflection: wrapDegrees(indexDirection - tilt),
    indexExtension: fingerExtension(shape, FINGERS.index),
    openness: handOpenness(shape),
    thumbSpread: thumbSpread(shape),
    pinch: pinchOpenness(shape),
    size: Math.hypot((knuckle.x - wrist.x) * aspect, knuckle.y - wrist.y),
  };
}
