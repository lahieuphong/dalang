import type { FingerFeatures, HandDetection, HandFeatures, Point } from '../types';

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
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  PINKY_MCP: 17,
} as const;

type Chain = readonly [mcp: number, pip: number, dip: number, tip: number];

export const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
} as const satisfies Record<string, Chain>;

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

/* ------------------------------------------------------------------ 3D vectors */

interface Vec {
  x: number;
  y: number;
  z: number;
}

const sub = (a: Point, b: Point): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec) => Math.hypot(a.x, a.y, a.z);
const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scaleVec = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const unit = (a: Vec): Vec => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0, z: 0 } : scaleVec(a, 1 / l);
};
/** Removes the component of `a` along unit vector `n` (projects onto the plane normal to `n`). */
const flatten = (a: Vec, n: Vec): Vec => {
  const k = dot(a, n);
  return { x: a.x - n.x * k, y: a.y - n.y * k, z: a.z - n.z * k };
};
/** Unsigned angle between two vectors, degrees. */
const angleBetween = (a: Vec, b: Vec) => {
  const la = len(a);
  const lb = len(b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  return (Math.acos(clamp(dot(a, b) / (la * lb), -1, 1)) * 180) / Math.PI;
};

/* ------------------------------------------------------------------ features */

/**
 * Straightness: the wrist→tip chord against the bone path, so bending at any
 * joint, knuckle included, shortens it.
 */
function chordExtension(shape: Point[], chain: Chain, lo: number, hi: number) {
  const wrist = shape[LANDMARK.WRIST];
  const [mcp, pip, dip, tip] = chain;
  const path =
    distance(wrist, shape[mcp]) + distance(shape[mcp], shape[pip]) + distance(shape[pip], shape[dip]) + distance(shape[dip], shape[tip]);
  return path < 1e-9 ? 0 : normalize(distance(wrist, shape[tip]) / path, lo, hi);
}

/**
 * Flexion of a long finger from its three joint angles. The knuckle (MCP)
 * angle is measured in the finger's flexion plane only, so spreading the
 * fingers sideways does not read as curling.
 */
function fingerCurl(shape: Point[], chain: Chain, palmNormal: Vec) {
  const [mcp, pip, dip, tip] = chain;
  const metacarpal = sub(shape[mcp], shape[LANDMARK.WRIST]);
  const proximal = sub(shape[pip], shape[mcp]);
  const middle = sub(shape[dip], shape[pip]);
  const distal = sub(shape[tip], shape[dip]);
  const lateral = unit(cross(palmNormal, metacarpal));
  const mcpAngle = angleBetween(metacarpal, flatten(proximal, lateral));
  const pipAngle = angleBetween(proximal, middle);
  const dipAngle = angleBetween(middle, distal);
  return clamp(0.4 * normalize(mcpAngle, 10, 85) + 0.4 * normalize(pipAngle, 8, 100) + 0.2 * normalize(dipAngle, 6, 75), 0, 1);
}

/** The thumb has its own anatomy: CMC → MCP → IP → tip, opposing the palm. */
function thumbFeatures(shape: Point[], image: Point[], aspect: number, roll: number): { finger: FingerFeatures; spread: number } {
  const { THUMB_CMC: cmc, THUMB_MCP: mcp, THUMB_IP: ip, THUMB_TIP: tip, INDEX_MCP, WRIST } = LANDMARK;
  const metacarpal = sub(shape[mcp], shape[cmc]);
  const proximal = sub(shape[ip], shape[mcp]);
  const distal = sub(shape[tip], shape[ip]);
  const curl = clamp(0.45 * normalize(angleBetween(metacarpal, proximal), 5, 55) + 0.55 * normalize(angleBetween(proximal, distal), 5, 80), 0, 1);
  const path = len(metacarpal) + len(proximal) + len(distal);
  const extension = path < 1e-9 ? 0 : normalize(distance(shape[cmc], shape[tip]) / path, 0.72, 0.98);
  // Abduction: the thumb's metacarpal swinging away from the index metacarpal.
  const spread = normalize(angleBetween(metacarpal, sub(shape[INDEX_MCP], shape[WRIST])), 18, 55);
  const direction = wrapDegrees(angleFromVertical(image[cmc], image[tip], aspect) - roll);
  return { finger: { extension, curl, direction }, spread };
}

/** Angular separation of two fingers, measured within the palm plane. */
function spreadBetween(shape: Point[], a: Chain, b: Chain, palmNormal: Vec) {
  const da = flatten(sub(shape[a[3]], shape[a[0]]), palmNormal);
  const db = flatten(sub(shape[b[3]], shape[b[0]]), palmNormal);
  return normalize(angleBetween(da, db), 3, 25);
}

export const PINCH_NEAR = 0.22;
export const PINCH_FAR = 0.8;

/** Turns a normalized fingertip distance into a 0..1 closeness. */
export const pinchFromDistance = (distanceRatio: number) => 1 - normalize(distanceRatio, PINCH_NEAR, PINCH_FAR);

/**
 * Builds the full continuous feature set for one hand. Position and in-image
 * rotation come from the normalized image landmarks; everything about the
 * hand's shape comes from the metric world landmarks when available, so it
 * does not depend on distance to the camera or camera resolution.
 */
export function extractHandFeatures(hand: HandDetection, aspect: number): HandFeatures {
  const lm = hand.landmarks;
  const shape = hand.worldLandmarks ?? lm.map((p) => ({ x: p.x * aspect, y: p.y, z: (p.z ?? 0) * aspect }));
  const { WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP, THUMB_TIP, INDEX_TIP, MIDDLE_TIP } = LANDMARK;

  const palm = palmCenter(lm);
  // Hand axis: wrist → centroid of the four knuckles (steadier than one knuckle).
  const knuckles = {
    x: (lm[INDEX_MCP].x + lm[MIDDLE_MCP].x + lm[RING_MCP].x + lm[PINKY_MCP].x) / 4,
    y: (lm[INDEX_MCP].y + lm[MIDDLE_MCP].y + lm[RING_MCP].y + lm[PINKY_MCP].y) / 4,
  };
  const roll = angleFromVertical(lm[WRIST], knuckles, aspect);

  // Palm basis from the world landmarks.
  const along = sub(shape[MIDDLE_MCP], shape[WRIST]);
  const across = sub(shape[INDEX_MCP], shape[PINKY_MCP]);
  const normal = unit(cross(along, across));
  const pitch = clamp((Math.atan2(-along.z, Math.hypot(along.x, along.y)) * 180) / Math.PI, -45, 45);
  const yaw = clamp((Math.atan2(across.z, Math.hypot(across.x, across.y)) * 180) / Math.PI, -45, 45);

  const long = (chain: Chain): FingerFeatures => ({
    extension: chordExtension(shape, chain, 0.55, 0.96),
    curl: fingerCurl(shape, chain, normal),
    direction: wrapDegrees(angleFromVertical(lm[chain[0]], lm[chain[3]], aspect) - roll),
  });
  const index = long(FINGERS.index);
  const middle = long(FINGERS.middle);
  const ring = long(FINGERS.ring);
  const pinky = long(FINGERS.pinky);
  const { finger: thumb, spread: thumbSpread } = thumbFeatures(shape, lm, aspect, roll);

  // Hand scale for distance normalization: mean of palm length and palm width.
  const handScale = Math.max(1e-6, 0.5 * (len(along) + len(across)));
  const pinchDistance = distance(shape[THUMB_TIP], shape[INDEX_TIP]) / handScale;
  const middlePinch = pinchFromDistance(distance(shape[THUMB_TIP], shape[MIDDLE_TIP]) / handScale);

  const openness = (index.extension + middle.extension + ring.extension + pinky.extension) / 4;
  const meanCurl = (index.curl + middle.curl + ring.curl + pinky.curl) / 4;
  const fistStrength = smoothstep(normalize(0.82 * meanCurl + 0.18 * thumb.curl, 0.15, 0.8));

  const wrist = lm[WRIST];
  const knuckle = lm[MIDDLE_MCP];
  return {
    palmX: palm.x,
    palmY: palm.y,
    roll,
    pitch,
    yaw,
    size: Math.hypot((knuckle.x - wrist.x) * aspect, knuckle.y - wrist.y),
    thumb,
    index,
    middle,
    ring,
    pinky,
    thumbSpread,
    pinchDistance,
    pinchStrength: pinchFromDistance(pinchDistance),
    middlePinch,
    spreadIndexMiddle: spreadBetween(shape, FINGERS.index, FINGERS.middle, normal),
    spreadMiddleRing: spreadBetween(shape, FINGERS.middle, FINGERS.ring, normal),
    spreadRingPinky: spreadBetween(shape, FINGERS.ring, FINGERS.pinky, normal),
    openness,
    fistStrength,
  };
}
