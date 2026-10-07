import type { PuppetRig, Side } from '../types';
import { clamp, lerp, normalize, type HandFeatures } from './handMath';
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
 * Closest the two puppets may come, measured at the grip and at the head
 * (which moves with the lean). Bodies and faces keep a clear gap; outstretched
 * arms can still meet in the middle.
 */
const MIN_GRIP_GAP = 290;
const MIN_HEAD_GAP = 300;
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
  'depth',
] as const satisfies readonly (keyof PuppetRig)[];

/** Each puppet rests in its own pose and breathes on its own clock, so they never move in lockstep. */
const REST_POSE: Record<
  Side,
  { phase: number; tempo: number; lean: number; shoulder: number; elbow: number; wrist: number; backShoulder: number; backElbow: number }
> = {
  left: { phase: 0, tempo: 1, lean: -0.6, shoulder: 14, elbow: 28, wrist: 6, backShoulder: 4, backElbow: 22 },
  right: { phase: 2.1, tempo: 0.87, lean: 1.2, shoulder: 24, elbow: 14, wrist: 12, backShoulder: -3, backElbow: 32 },
};

/**
 * Resting pose: settled low behind the rail, facing the centre, front arm
 * slightly raised, breathing almost imperceptibly. `amplitude` scales the idle motion.
 */
export function idleRig(side: Side, time: number, amplitude: number): PuppetRig {
  const pose = REST_POSE[side];
  const t = time * pose.tempo;
  const p = pose.phase;
  const a = amplitude;
  return {
    x: REST_X[side] + 2 * a * Math.sin(t * 0.17 + p),
    y: REST_Y + 1.5 * a * Math.sin(t * 0.9 + p),
    scale: PUPPET.scale,
    bodyRotation: pose.lean + a * (0.9 * Math.sin(t * 0.52 + p) + 0.35 * Math.sin(t * 0.23 + p * 1.7)),
    // The head trails the body's sway slightly.
    headRotation: a * Math.sin(t * 0.52 + p - 0.9),
    shoulderAngle: pose.shoulder + 2.2 * a * Math.sin(t * 0.61 + p),
    elbowAngle: pose.elbow + 2.6 * a * Math.sin(t * 0.47 + p + 0.6),
    wristAngle: pose.wrist + 2.5 * a * Math.sin(t * 0.8 + p),
    backShoulderAngle: pose.backShoulder + 1.8 * a * Math.sin(t * 0.43 + p + 2),
    backElbowAngle: pose.backElbow + 2 * a * Math.sin(t * 0.55 + p),
    depth: 0.15,
  };
}

/**
 * Turns (already filtered) hand features into a target pose. The mapping is
 * deliberately artistic rather than literal:
 * - a held puppet is lifted out from behind the rail; palm position moves it
 *   within its half and raising the hand lifts it higher
 * - hand tilt leans the body
 * - the index finger is the front arm: curl it to lower, extend it to raise,
 *   extend it alone to point
 * - the other three fingers open and close the back arm
 * - thumb spread flicks the wrist, a thumb–index pinch bows the head
 * - moving the hand toward the camera lifts the puppet toward the lamp
 */
export function rigFromHand(features: HandFeatures, side: Side, sensitivity: number): PuppetRig {
  const f = facing(side);
  const gain = lerp(1, 1.9, sensitivity);
  const u = clamp(0.5 + (features.palmX - 0.5) * gain, 0, 1);
  const v = clamp(0.5 + (features.palmY - 0.5) * gain, 0, 1);
  const [minX, maxX] = X_RANGE[side];

  const lift =
    v < LIFT_START ? -MAX_LIFT * normalize(LIFT_START - v, 0, 0.38) : MAX_SINK * normalize(v - 0.72, 0, 0.22);

  const forwardTilt = f * features.tilt;
  const lean = clamp(forwardTilt * 0.55, -16, 16);
  const ext = features.indexExtension;
  const open = features.openness;
  const pointing = clamp((ext - open) * 1.8, 0, 1);

  const shoulder =
    lerp(4, 74, ext) +
    38 * pointing +
    clamp(forwardTilt * 0.6, -22, 36) +
    clamp(f * features.indexDeflection * 0.6, -22, 30);

  const depth = normalize(features.size, 0.1, 0.28);

  return {
    x: clamp(lerp(70, 930, u) - f * OUTWARD_BIAS, minX, maxX),
    y: HELD_Y + lift,
    scale: PUPPET.scale * (1 + lerp(-0.04, 0.08, depth)),
    bodyRotation: lean,
    headRotation: clamp(-lean * 0.35 + lerp(10, -5, features.pinch), -13, 13),
    shoulderAngle: clamp(shoulder, -30, 160),
    elbowAngle: clamp(lerp(64, 2, ext), -12, 100),
    wristAngle: clamp(lerp(-16, 24, features.thumbSpread), -30, 36),
    backShoulderAngle: clamp(lerp(-12, 64, open) - clamp(forwardTilt * 0.25, -12, 12), -35, 120),
    backElbowAngle: clamp(lerp(52, 4, open), 0, 100),
    depth,
  };
}

const headReach = (rig: PuppetRig) => Math.sin((rig.bodyRotation * Math.PI) / 180) * HEAD_LEVER * rig.scale;

/** Pushes two target poses apart symmetrically when their grips or leaning heads come too close. */
export function keepApart(left: PuppetRig, right: PuppetRig) {
  const gripGap = right.x - left.x;
  const headGap = right.x - headReach(right) - (left.x + headReach(left));
  const overlap = Math.max(MIN_GRIP_GAP - gripGap, MIN_HEAD_GAP - headGap);
  if (overlap > 0) {
    left.x -= overlap / 2;
    right.x += overlap / 2;
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
