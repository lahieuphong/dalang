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

/**
 * Monotonic 0..1 → 0..1 curve whose slope at 0 is `gain`: above 1 it
 * amplifies small inputs. It always ends exactly at 1 and never goes flat, so
 * extra gain costs no travel at the far end.
 */
export const boost = (t: number, gain: number) => {
  const x = clamp(t, 0, 1);
  return (x * gain) / (1 + (gain - 1) * x);
};

const RESPONSE = 1.8;

/**
 * Response curve for 0..1 control signals: small inputs are amplified
 * (0.1 → 0.17, 0.2 → 0.31, 0.5 → 0.64 at gain 1) while 0 and 1 stay where
 * they are, so a slight movement of a finger is already visible on the
 * puppet. `gain` scales the low end further.
 */
export const respond = (t: number, gain = 1) => boost(t, RESPONSE * gain);

/**
 * Clamps to [min, max], but eases into each limit over the last `knee` units
 * instead of stopping dead, so there is always a little travel left.
 */
export function softClamp(value: number, min: number, max: number, knee: number) {
  if (value > max - knee) return max - knee + knee * Math.tanh((value - (max - knee)) / knee);
  if (value < min + knee) return min + knee - knee * Math.tanh((min + knee - value) / knee);
  return value;
}

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
 * How far each finger flexes compared with the index finger. The ring and
 * little fingers travel less, so their full range is reached sooner.
 */
const REACH = { index: 1, middle: 1, ring: 0.92, pinky: 0.85 } as const;

/**
 * Flexion of a long finger, 0 (straight) to 1 (folded), built from three
 * angles that are all linear for small bends, so a slight bend reads as a
 * slight curl instead of vanishing:
 *
 * - sweep:   how far the whole finger (knuckle → tip) has swung toward the palm
 * - knuckle: flexion at the MCP joint
 * - hook:    flexion of the two finger joints together (PIP and DIP)
 *
 * Each uses the longest baseline available rather than the short bones on
 * their own, which keeps landmark noise several times lower than summing the
 * three joint angles would. Sweep and knuckle are measured in the finger's
 * flexion plane only, so spreading the fingers sideways does not read as
 * curling. The lower bounds only cover the few degrees a straight finger
 * shows anyway.
 */
function fingerCurl(shape: Point[], chain: Chain, palmNormal: Vec, reach: number) {
  const [mcp, pip, , tip] = chain;
  const metacarpal = sub(shape[mcp], shape[LANDMARK.WRIST]);
  const proximal = sub(shape[pip], shape[mcp]);
  const lateral = unit(cross(palmNormal, metacarpal));
  const sweep = angleBetween(metacarpal, flatten(sub(shape[tip], shape[mcp]), lateral));
  const knuckle = angleBetween(metacarpal, flatten(proximal, lateral));
  const hook = angleBetween(proximal, sub(shape[tip], shape[pip]));
  return clamp(
    0.5 * normalize(sweep, 3, 140 * reach) + 0.2 * normalize(knuckle, 4, 80 * reach) + 0.3 * normalize(hook, 4, 118 * reach),
    0,
    1,
  );
}

/** The thumb has its own anatomy: CMC → MCP → IP → tip, opposing the palm. */
function thumbFeatures(shape: Point[], image: Point[], aspect: number, roll: number): { finger: FingerFeatures; spread: number } {
  const { THUMB_CMC: cmc, THUMB_MCP: mcp, THUMB_IP: ip, THUMB_TIP: tip, INDEX_MCP, WRIST } = LANDMARK;
  const metacarpal = sub(shape[mcp], shape[cmc]);
  const proximal = sub(shape[ip], shape[mcp]);
  const distal = sub(shape[tip], shape[ip]);
  // The swing of the two outer bones together against the metacarpal, plus the tip joint on its own.
  const sweep = angleBetween(metacarpal, sub(shape[tip], shape[mcp]));
  const curl = clamp(0.6 * normalize(sweep, 4, 75) + 0.4 * normalize(angleBetween(proximal, distal), 4, 80), 0, 1);
  // Abduction: the thumb's metacarpal swinging away from the index metacarpal.
  const spread = normalize(angleBetween(metacarpal, sub(shape[INDEX_MCP], shape[WRIST])), 15, 55);
  const direction = wrapDegrees(angleFromVertical(image[cmc], image[tip], aspect) - roll);
  return { finger: { extension: 1 - curl, curl, direction }, spread };
}

/** Angular separation of two fingers, measured within the palm plane. */
function spreadBetween(shape: Point[], a: Chain, b: Chain, palmNormal: Vec) {
  const da = flatten(sub(shape[a[3]], shape[a[0]]), palmNormal);
  const db = flatten(sub(shape[b[3]], shape[b[0]]), palmNormal);
  return normalize(angleBetween(da, db), 3, 25);
}

/**
 * Thumb tip ↔ index tip distance over the hand's own size: about 0.18 when
 * the pads touch and 1.0 with the hand comfortably open. The whole span in
 * between counts, so the pinch is felt long before the fingers meet.
 */
export const PINCH_NEAR = 0.18;
export const PINCH_FAR = 1.0;

/** Turns a normalized fingertip distance into a 0..1 closeness, linear over the whole approach. */
export const pinchFromDistance = (distanceRatio: number) => 1 - normalize(distanceRatio, PINCH_NEAR, PINCH_FAR);

/**
 * How closed the whole hand is. Deliberately quiet at the low end, so one
 * finger bending on its own does not read as the start of a fist.
 */
export const fistFromCurl = (meanCurl: number, thumbCurl: number) =>
  smoothstep(normalize(0.82 * meanCurl + 0.18 * thumbCurl, 0.22, 0.85));

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

  const long = (name: keyof typeof FINGERS): FingerFeatures => {
    const chain = FINGERS[name];
    const curl = fingerCurl(shape, chain, normal, REACH[name]);
    return { extension: 1 - curl, curl, direction: wrapDegrees(angleFromVertical(lm[chain[0]], lm[chain[3]], aspect) - roll) };
  };
  const index = long('index');
  const middle = long('middle');
  const ring = long('ring');
  const pinky = long('pinky');
  const { finger: thumb, spread: thumbSpread } = thumbFeatures(shape, lm, aspect, roll);

  // Hand scale for distance normalization: mean of palm length and palm width.
  const handScale = Math.max(1e-6, 0.5 * (len(along) + len(across)));
  const pinchDistance = distance(shape[THUMB_TIP], shape[INDEX_TIP]) / handScale;
  const middlePinch = pinchFromDistance(distance(shape[THUMB_TIP], shape[MIDDLE_TIP]) / handScale);

  const meanCurl = (index.curl + middle.curl + ring.curl + pinky.curl) / 4;
  const openness = 1 - meanCurl;
  const fistStrength = fistFromCurl(meanCurl, thumb.curl);

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
