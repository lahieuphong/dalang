import type { PuppetRig, Side } from '../types';
import { clamp, lerp, normalize, type HandFeatures } from './handMath';
import { facing, PUPPET, STAGE } from './puppetGeometry';

/** Grip height that puts the feet exactly on the rail. */
export const REST_Y = STAGE.railTop + PUPPET.pivotY * PUPPET.scale;

export const REST_X: Record<Side, number> = { left: 285, right: 715 };

/** Each puppet keeps to its half but may reach past the centre to meet the other. */
const X_RANGE: Record<Side, readonly [number, number]> = { left: [130, 580], right: [420, 870] };

/**
 * Closest the two puppets may come, measured at the grip and at the head
 * (which moves with the lean). Bodies and faces stay apart; hands can still meet.
 */
const MIN_GRIP_GAP = 215;
const MIN_HEAD_GAP = 228;
/** Distance from the lean pivot (knees) up to the face, in puppet units. */
const HEAD_LEVER = PUPPET.leanY + 370;

/**
 * Hands map to a lift above the rail rather than to the full stage height.
 * Below LIFT_START (normalized, after sensitivity) the feet stay on the rail.
 */
const MAX_LIFT = 135;
const MAX_SINK = 22;
const LIFT_START = 0.54;

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

/**
 * Resting pose: grounded on the rail, facing the centre, front arm slightly
 * raised, breathing almost imperceptibly. `amplitude` scales the idle motion.
 */
export function idleRig(side: Side, time: number, amplitude: number): PuppetRig {
  const phase = side === 'left' ? 0 : 2.1;
  const a = amplitude;
  return {
    x: REST_X[side] + 2.5 * a * Math.sin(time * 0.17 + phase),
    y: REST_Y + 1.6 * a * Math.sin(time * 0.9 + phase),
    scale: PUPPET.scale,
    bodyRotation: a * (1.3 * Math.sin(time * 0.52 + phase) + 0.5 * Math.sin(time * 0.23 + phase * 1.7)),
    headRotation: 1.2 * a * Math.sin(time * 0.37 + phase + 1),
    shoulderAngle: 14 + 2.6 * a * Math.sin(time * 0.61 + phase),
    elbowAngle: 26 + 3 * a * Math.sin(time * 0.47 + phase + 0.6),
    wristAngle: 6 + 3 * a * Math.sin(time * 0.8 + phase),
    backShoulderAngle: 4 + 2 * a * Math.sin(time * 0.43 + phase + 2),
    backElbowAngle: 22 + 2.4 * a * Math.sin(time * 0.55 + phase),
    depth: 0.15,
  };
}

/**
 * Turns (already filtered) hand features into a target pose. The mapping is
 * deliberately artistic rather than literal:
 * - palm position moves the puppet within its half and lifts it off the rail
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
    v < LIFT_START ? -MAX_LIFT * normalize(LIFT_START - v, 0, 0.44) : MAX_SINK * normalize(v - 0.72, 0, 0.22);

  const forwardTilt = f * features.tilt;
  const lean = clamp(forwardTilt * 0.35, -11, 11);
  const ext = features.indexExtension;
  const open = features.openness;
  const pointing = clamp((ext - open) * 1.6, 0, 1);

  const shoulder =
    lerp(10, 58, ext) +
    30 * pointing +
    clamp(forwardTilt * 0.45, -18, 30) +
    clamp(f * features.indexDeflection * 0.5, -18, 26);

  const depth = normalize(features.size, 0.1, 0.3);

  return {
    x: clamp(lerp(70, 930, u), minX, maxX),
    y: REST_Y + lift,
    scale: PUPPET.scale * (1 + lerp(-0.03, 0.06, depth)),
    bodyRotation: lean,
    headRotation: clamp(-lean * 0.3 + lerp(7, -3, features.pinch), -9, 9),
    shoulderAngle: clamp(shoulder, -25, 150),
    elbowAngle: clamp(lerp(50, 6, ext), -10, 90),
    wristAngle: clamp(lerp(-10, 16, features.thumbSpread), -25, 30),
    backShoulderAngle: clamp(lerp(-8, 46, open) - clamp(forwardTilt * 0.2, -10, 10), -30, 110),
    backElbowAngle: clamp(lerp(44, 8, open), 0, 90),
    depth,
  };
}

const headReach = (rig: PuppetRig) => Math.sin((rig.bodyRotation * Math.PI) / 180) * HEAD_LEVER * rig.scale;

/** Pushes two target poses apart symmetrically when their grips or leaning heads come too close. */
export function keepApart(left: PuppetRig, right: PuppetRig) {
  const gripGap = right.x - left.x;
  const headGap = right.x - headReach(right) - (left.x + headReach(left));
  const overlap = Math.max(MIN_GRIP_GAP - gripGap, MIN_HEAD_GAP - headGap);
  if (overlap <= 0) return;
  left.x -= overlap / 2;
  right.x += overlap / 2;
}

export function blendRig(from: PuppetRig, to: PuppetRig, t: number, out: PuppetRig): PuppetRig {
  for (const key of RIG_KEYS) out[key] = lerp(from[key], to[key], t);
  return out;
}
