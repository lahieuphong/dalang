import type { FingerName, HandFeatures, PuppetRig, Side } from '../types';
import { boost, clamp, lerp, normalize, respond, softClamp } from './handMath';
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
 * Where each hand naturally sits in the mirrored camera view, and where that
 * puts its puppet. Travel is measured from this home, so turning sensitivity
 * up makes the puppet move further around it instead of pushing the pair
 * toward the edges of the stage.
 */
const HOME_PALM_X: Record<Side, number> = { left: 0.33, right: 0.67 };
const HOME_X: Record<Side, number> = { left: 300, right: 700 };
const HOME_PALM_Y = 0.6;
/**
 * Stage units travelled per frame-width / frame-height of palm travel at
 * gain 1. At the default gain a hand covers its puppet's whole range within
 * roughly the middle two thirds of the camera view.
 */
const TRAVEL_X = 1120;
const TRAVEL_Y = 480;
/** The last stretch before a limit is eased, so a puppet never hits a wall. */
const X_KNEE = 40;
const Y_KNEE = 24;

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

/** A held puppet can be lifted this far above the rail, or let sink this far behind it. */
const MAX_LIFT = 150;
const MAX_SINK = 50;

/**
 * Overall control gain from the sensitivity setting: 0.75 (calm), 1.25 at
 * the default, 1.75 (lively). It scales how far the puppet moves for a given
 * hand movement and has nothing to do with smoothing.
 */
export const controlGain = (sensitivity: number) => lerp(0.75, 1.75, clamp(sensitivity, 0, 1));

/** The ring and little fingers move less on their own, so they are given more gain. */
const FINGER_GAIN: Record<FingerName, number> = { thumb: 1.1, index: 1, middle: 1, ring: 1.15, pinky: 1.25 };

/** Upright hands lean in by a few degrees; that much roll is treated as standing straight. */
const NEUTRAL_ROLL = 4;
const LEAN_GAIN = 0.75;
const MAX_LEAN = 20;

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
 * coordinates). Linear around the hand's home with no flat spots, so the
 * slightest palm movement moves the puppet; only the approach to a limit is
 * eased. Kept separate from articulation so the root can be fed a predicted
 * palm position every render frame.
 */
export function stagePosition(palmX: number, palmY: number, side: Side, sensitivity: number, out: { x: number; y: number }) {
  const gain = controlGain(sensitivity);
  const [minX, maxX] = X_RANGE[side];
  out.x = softClamp(HOME_X[side] + (palmX - HOME_PALM_X[side]) * TRAVEL_X * gain, minX, maxX, X_KNEE);
  out.y = HELD_Y + softClamp((palmY - HOME_PALM_Y) * TRAVEL_Y * gain, -MAX_LIFT, MAX_SINK, Y_KNEE);
}

/**
 * Turns filtered hand features into every joint of the puppet except its root
 * position. It is fully continuous: each human finger drives its own puppet
 * joint, so a single finger moving changes only its part of the pose, and
 * every finger signal goes through the response curve, so a slight bend
 * already shows.
 *
 * - hand roll leans the body; palm pitch and the pinch nod the head
 * - INDEX  → front shoulder: straight raises the arm, bending lowers it, its
 *            direction aims it, extending it alone (others curled) points
 * - MIDDLE → front elbow: its curl bends the elbow
 * - THUMB  → front wrist: abduction and curl turn it
 * - PINCH  → a precise grip over the whole approach of thumb and index:
 *            wrist turns in, forearm draws in, fingers close
 * - RING   → back shoulder: straight raises it
 * - PINKY  → back elbow: its curl bends it
 * - fist   → compacts both arms; finger spread adds a little flourish
 * - palm size (distance to camera) → depth: scale and shadow
 */
export function articulateFromHand(hand: HandFeatures, side: Side, sensitivity: number, out: PuppetRig): PuppetRig {
  const f = facing(side);
  const gain = controlGain(sensitivity);
  const fist = hand.fistStrength;
  const thumbBend = respond(hand.thumb.curl, FINGER_GAIN.thumb * gain);
  const indexBend = respond(hand.index.curl, FINGER_GAIN.index * gain);
  const middleBend = respond(hand.middle.curl, FINGER_GAIN.middle * gain);
  const ringBend = respond(hand.ring.curl, FINGER_GAIN.ring * gain);
  const pinkyBend = respond(hand.pinky.curl, FINGER_GAIN.pinky * gain);
  // The pinch is already linear over the whole approach; sensitivity only leans on it gently.
  const pinch = boost(hand.pinchStrength, Math.sqrt(gain));

  const forwardRoll = f * hand.roll - NEUTRAL_ROLL;
  const lean = softClamp(forwardRoll * LEAN_GAIN * gain, -MAX_LEAN, MAX_LEAN, 6);
  out.bodyRotation = lean;
  out.headRotation = clamp(-lean * 0.3 + hand.pitch * 0.15 + pinch * 8, -14, 14);

  // A curled finger has no meaningful direction, so its aim is weighted by how straight it is.
  const indexAim = clamp(f * hand.index.direction, -40, 40) * (1 - indexBend);
  const pointing = clamp(((middleBend + ringBend + pinkyBend) / 3 - indexBend) * 1.8, 0, 1);

  out.shoulderAngle = clamp(
    lerp(78, 6, indexBend) + 0.6 * indexAim + 28 * pointing + clamp(forwardRoll * 0.5, -20, 30) - 12 * fist,
    -30,
    160,
  );
  out.elbowAngle = clamp(lerp(4, 76, middleBend) + 24 * pinch + 16 * fist - 10 * pointing, -12, 115);
  // The thumb turns the wrist on its own; as a pinch closes, the pinch takes the wrist over.
  out.wristAngle = clamp(
    (1 - pinch) * (lerp(-10, 20, hand.thumbSpread) - 14 * thumbBend) - 34 * pinch + 8 * (hand.spreadIndexMiddle - 0.4),
    -42,
    42,
  );
  out.frontFingerCurl = clamp(Math.max(indexBend, 0.9 * pinch) * 78, 0, 80);

  out.backShoulderAngle = clamp(
    lerp(64, -12, ringBend) - 10 * fist + 6 * hand.spreadMiddleRing - clamp(forwardRoll * 0.2, -10, 10),
    -35,
    120,
  );
  out.backElbowAngle = clamp(lerp(4, 60, pinkyBend) + 6 * hand.spreadRingPinky, 0, 100);
  out.backFingerCurl = clamp(((ringBend + pinkyBend) / 2) * 78, 0, 80);

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
