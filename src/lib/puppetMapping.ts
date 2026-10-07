import type { HandFeatures, PuppetRig, Side } from '../types';
import { clamp, lerp, normalize } from './handMath';
import { facing, PUPPET, STAGE } from './puppetGeometry';

/** Feet sit exactly on the rail top at this grip height. */
const ON_RAIL_Y = STAGE.railTop + PUPPET.pivotY * PUPPET.scale;

/** With no hand the puppets settle down behind the rail, lower legs hidden. */
export const REST_Y = ON_RAIL_Y + 64;

/** A held puppet is lifted into the scene: feet just clear of the rail. */
const HELD_Y = ON_RAIL_Y - 16;

export const REST_X: Record<Side, number> = { left: 255, right: 745 };

/** Each puppet keeps to its own half of the stage. */
const X_RANGE: Record<Side, readonly [number, number]> = { left: [150, 470], right: [530, 850] };

/** Grip positions that keep a whole puppet, back ornaments included, inside the frame. */
const STAGE_BOUNDS = { min: 140, max: 860 } as const;

/**
 * Hands naturally drift toward the middle of the camera frame, so each puppet
 * is nudged this far toward its own side of the stage.
 */
const OUTWARD_BIAS = 50;

/**
 * Preferred closest approach, measured at the grip and at the head (which
 * moves with the lean). It is a soft constraint: pushing the hands further
 * together still moves the puppets a little closer, so the hand stays in
 * charge, while bodies and faces keep a clear gap and arms can meet.
 */
const MIN_GRIP_GAP = 320;
const MIN_HEAD_GAP = 330;
const SOFTNESS = 22;
/** Distance from the lean pivot (knees) up to the face, in puppet units. */
const HEAD_LEVER = PUPPET.leanY + 370;

/**
 * Raising the hand above LIFT_START (normalized, after sensitivity) lifts the
 * held puppet further; dropping it low lets the puppet sink toward the rail.
 */
const MAX_LIFT = 150;
const MAX_SINK = 50;
const LIFT_START = 0.58;

export const RIG_KEYS = [
  'x',
  'y',
  'scale',
  'bodyRotation',
  'headRotation',
  'shoulderAngle',
  'elbowAngle',
  'wristAngle',
  'backShoulderAngle',
  'backElbowAngle',
  'frontFingerCurl',
  'backFingerCurl',
  'depth',
] as const satisfies readonly (keyof PuppetRig)[];

interface RestPose {
  phase: number;
  tempo: number;
  lean: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  backShoulder: number;
  backElbow: number;
  fingers: number;
  backFingers: number;
}

/** Each puppet rests in its own pose and breathes on its own clock, so they never move in lockstep. */
const REST_POSE: Record<Side, RestPose> = {
  left: { phase: 0, tempo: 1, lean: -0.6, shoulder: 14, elbow: 28, wrist: 6, backShoulder: 4, backElbow: 22, fingers: 16, backFingers: 24 },
  right: { phase: 2.1, tempo: 0.87, lean: 1.2, shoulder: 24, elbow: 14, wrist: 12, backShoulder: -3, backElbow: 32, fingers: 22, backFingers: 18 },
};

export const emptyRig = (): PuppetRig => ({
  x: 0,
  y: 0,
  scale: PUPPET.scale,
  bodyRotation: 0,
  headRotation: 0,
  shoulderAngle: 0,
  elbowAngle: 0,
  wristAngle: 0,
  backShoulderAngle: 0,
  backElbowAngle: 0,
  frontFingerCurl: 0,
  backFingerCurl: 0,
  depth: 0,
});

/**
 * Resting pose: settled low behind the rail, facing the centre, front arm
 * slightly raised, breathing almost imperceptibly. `amplitude` scales the
 * idle motion. Writes into `out` to stay allocation-free in the render loop.
 */
export function idleRig(side: Side, time: number, amplitude: number, out: PuppetRig = emptyRig()): PuppetRig {
  const pose = REST_POSE[side];
  const t = time * pose.tempo;
  const p = pose.phase;
  const a = amplitude;
  out.x = REST_X[side] + 2 * a * Math.sin(t * 0.17 + p);
  out.y = REST_Y + 1.5 * a * Math.sin(t * 0.9 + p);
  out.scale = PUPPET.scale;
  out.bodyRotation = pose.lean + a * (0.9 * Math.sin(t * 0.52 + p) + 0.35 * Math.sin(t * 0.23 + p * 1.7));
  // The head trails the body's sway slightly.
  out.headRotation = a * Math.sin(t * 0.52 + p - 0.9);
  out.shoulderAngle = pose.shoulder + 2.2 * a * Math.sin(t * 0.61 + p);
  out.elbowAngle = pose.elbow + 2.6 * a * Math.sin(t * 0.47 + p + 0.6);
  out.wristAngle = pose.wrist + 2.5 * a * Math.sin(t * 0.8 + p);
  out.backShoulderAngle = pose.backShoulder + 1.8 * a * Math.sin(t * 0.43 + p + 2);
  out.backElbowAngle = pose.backElbow + 2 * a * Math.sin(t * 0.55 + p);
  out.frontFingerCurl = pose.fingers + 2 * a * Math.sin(t * 0.7 + p + 1);
  out.backFingerCurl = pose.backFingers;
  out.depth = 0.15;
  return out;
}

/**
 * Where a held puppet stands for a given palm position (normalized view
 * coordinates). Kept separate from articulation so the root can be fed a
 * predicted palm position every render frame.
 */
export function stagePosition(palmX: number, palmY: number, side: Side, sensitivity: number, out: { x: number; y: number }) {
  const f = facing(side);
  const gain = lerp(1, 1.9, sensitivity);
  const u = clamp(0.5 + (palmX - 0.5) * gain, 0, 1);
  const v = clamp(0.5 + (palmY - 0.5) * gain, 0, 1);
  const [minX, maxX] = X_RANGE[side];
  const lift = v < LIFT_START ? -MAX_LIFT * normalize(LIFT_START - v, 0, 0.38) : MAX_SINK * normalize(v - 0.72, 0, 0.22);
  out.x = clamp(lerp(70, 930, u) - f * OUTWARD_BIAS, minX, maxX);
  out.y = HELD_Y + lift;
}

/**
 * Turns filtered hand features into every joint of the puppet except its root
 * position. It is fully continuous: each human finger drives its own puppet
 * joint, so a single finger moving changes only its part of the pose.
 *
 * - hand roll leans the body; palm pitch and the pinch nod the head
 * - INDEX  → front shoulder: extension raises it, direction aims it,
 *            extending it alone (others curled) points
 * - MIDDLE → front elbow: its curl bends the elbow
 * - THUMB  → front wrist: abduction and curl turn it
 * - PINCH  → a precise grip: wrist turns in, forearm draws in, fingers close
 * - RING   → back shoulder: extension raises it
 * - PINKY  → back elbow: extension straightens it
 * - fist   → compacts both arms; openness and finger spread add a little flourish
 * - palm size (distance to camera) → depth: scale and shadow
 */
export function articulateFromHand(hand: HandFeatures, side: Side, out: PuppetRig): PuppetRig {
  const f = facing(side);
  const { thumb, index, middle, ring, pinky, fistStrength: fist, pinchStrength: pinch } = hand;
  const forwardRoll = f * hand.roll;

  const lean = clamp(forwardRoll * 0.55, -16, 16);
  out.bodyRotation = lean;
  out.headRotation = clamp(-lean * 0.3 + hand.pitch * 0.15 + pinch * 6, -13, 13);

  // A curled finger has no meaningful direction, so its aim is weighted by its extension.
  const indexAim = clamp(f * index.direction, -40, 40) * index.extension;
  const othersExtension = (middle.extension + ring.extension + pinky.extension) / 3;
  const pointing = clamp((index.extension - othersExtension) * 1.8, 0, 1);

  out.shoulderAngle = clamp(
    lerp(4, 74, index.extension) + 0.6 * indexAim + 30 * pointing + clamp(forwardRoll * 0.5, -20, 30) - 14 * fist + 5 * hand.openness,
    -30,
    160,
  );
  out.elbowAngle = clamp(lerp(4, 72, middle.curl) + 14 * pinch + 18 * fist - 10 * pointing, -12, 110);
  out.wristAngle = clamp(
    lerp(-14, 22, hand.thumbSpread) - 18 * thumb.curl - 20 * pinch + 8 * (hand.spreadIndexMiddle - 0.4),
    -36,
    36,
  );
  out.frontFingerCurl = clamp(Math.max(index.curl, 0.85 * pinch) * 75, 0, 80);

  out.backShoulderAngle = clamp(
    lerp(-12, 62, ring.extension) - 12 * fist + 6 * hand.spreadMiddleRing - clamp(forwardRoll * 0.2, -10, 10),
    -35,
    120,
  );
  out.backElbowAngle = clamp(lerp(58, 4, pinky.extension) + 6 * hand.spreadRingPinky, 0, 100);
  out.backFingerCurl = clamp(((ring.curl + pinky.curl) / 2) * 75, 0, 80);

  const depth = normalize(hand.size, 0.1, 0.28);
  out.depth = depth;
  out.scale = PUPPET.scale * (1 + lerp(-0.04, 0.08, depth));
  return out;
}

const headReach = (rig: PuppetRig) => Math.sin((rig.bodyRotation * Math.PI) / 180) * HEAD_LEVER * rig.scale;

/**
 * Softly keeps the two target poses apart: small overlaps are mostly
 * tolerated, larger ones increasingly resisted, and the pair always stays
 * inside the frame.
 */
export function keepApart(left: PuppetRig, right: PuppetRig) {
  const gripGap = right.x - left.x;
  const headGap = right.x - headReach(right) - (left.x + headReach(left));
  const overlap = Math.max(MIN_GRIP_GAP - gripGap, MIN_HEAD_GAP - headGap);
  if (overlap > 0) {
    const push = overlap - SOFTNESS * Math.log1p(overlap / SOFTNESS);
    left.x -= push / 2;
    right.x += push / 2;
  }
  // Being pushed apart must never shove a puppet out of the frame: slide the pair back in.
  const shift = Math.max(0, STAGE_BOUNDS.min - left.x) - Math.max(0, right.x - STAGE_BOUNDS.max);
  left.x = Math.max(STAGE_BOUNDS.min, left.x + shift);
  right.x = Math.min(STAGE_BOUNDS.max, right.x + shift);
}

export function blendRig(from: PuppetRig, to: PuppetRig, t: number, out: PuppetRig): PuppetRig {
  for (const key of RIG_KEYS) out[key] = lerp(from[key], to[key], t);
  return out;
}
