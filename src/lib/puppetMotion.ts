import type { HandDetection, HandFeatures, PuppetRig, Settings, Side } from '../types';
import { HandFeatureFilter } from './handFeatureFilter';
import { clamp, extractHandFeatures, lerp, smoothstep } from './handMath';
import { facing } from './puppetGeometry';
import { articulateFromHand, blendRig, emptyRig, idleRig, RIG_KEYS, stagePosition } from './puppetMapping';
import { stepSpring, type SpringParams } from './smoothing';

/** Keep the last tracked pose this long after a hand drops out, so brief misses never flicker. */
export const GRACE_MS = 300;
/**
 * Pickup: the hand's pose takes over exponentially at this rate (1/s), so
 * the very first frame with a hand already carries the puppet about 40 % of
 * the way and it is fully in hand after ~100 ms. Letting go is slow and soft.
 */
const ATTACK_RATE = 32;
const RELEASE_RATE = 1.5;

/**
 * Palm prediction hides part of the camera + inference latency by carrying
 * the filtered palm forward along its velocity: a small lead on arrival, then
 * on until the next result is due. It is short, clamped, palm-only, and
 * switched off just after pickup or when the hand reverses.
 */
const PREDICT_LEAD_MS = 8;
const PREDICT_MAX_MS = 25;
const PREDICT_WARMUP_MS = 120;
const PREDICT_MAX_SHIFT = 0.03;

type RigKey = (typeof RIG_KEYS)[number];

/**
 * Followers between the tracker's rate and the display's. The features are
 * already filtered, so these are not a second smoothing stage: they only
 * carry the pose from one tracking result to the next without visible steps.
 * Primary control is critically damped and very stiff, so nothing overshoots
 * and nothing chases; only the body and head, which no finger drives
 * directly, are allowed to be a little softer.
 *
 *   fastest  wrist, finger blades (pinch, thumb, finger curl)
 *   fast     root position, arm joints
 *   medium   body lean, head
 *   slow     depth and scale
 */
function springParams(smoothing: number): Record<RigKey, SpringParams> {
  const k = lerp(1.35, 0.5, clamp(smoothing, 0, 1));
  const fingers = { frequency: 120 * k, damping: 1 };
  const joint = { frequency: 100 * k, damping: 1 };
  const root = { frequency: 110 * k, damping: 1 };
  const soft = { frequency: 12 * k, damping: 1 };
  return {
    x: root,
    y: root,
    scale: soft,
    depth: soft,
    bodyRotation: { frequency: 70 * k, damping: 0.9 },
    headRotation: { frequency: 36 * k, damping: 0.8 },
    shoulderAngle: joint,
    elbowAngle: joint,
    backShoulderAngle: joint,
    backElbowAngle: joint,
    wristAngle: fingers,
    frontFingerCurl: fingers,
    backFingerCurl: fingers,
  };
}

/**
 * Secondary physics: a little follow-through added on top of the controlled
 * pose while the puppet travels. Kept small and well damped: it must read as
 * weight, never as lag.
 */
const SECONDARY: SpringParams = { frequency: 16, damping: 0.7 };
const SECONDARY_KEYS = ['trail', 'fling', 'lean', 'nod'] as const;

const zeros = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

/**
 * Owns one puppet's motion. Each hand gets its own controller, so its
 * filters, velocity, pinch state and followers are fully independent.
 *
 *   landmarks → features (filtered once, per channel) → target pose
 *     → stiff followers (display rate) → + slight follow-through → rendered rig
 */
export class PuppetController {
  readonly side: Side;
  /** The rendered pose: controlled pose plus secondary physics. */
  readonly rig: PuppetRig;
  /** Latest filtered features, for the debug panel. */
  features: HandFeatures | null = null;
  /** Discrete pinch state with hysteresis (debug and accents only). */
  pinched = false;
  /** Filtered palm velocity, normalized view units per second. */
  readonly palmVelocity = { x: 0, y: 0 };
  /** How far the rendered root trails its target: stage units, and the same expressed as time. */
  readonly follow = { distance: 0, lagMs: 0 };

  private readonly control: PuppetRig;
  private readonly target = emptyRig();
  private readonly idle = emptyRig();
  private readonly tracked = emptyRig();
  private readonly position = { x: 0, y: 0 };
  private readonly palm = { x: 0.5, y: 0.5, t: 0, seenAt: 0 };
  private readonly controlVelocity = zeros(RIG_KEYS);
  private readonly secondary = zeros(SECONDARY_KEYS);
  private readonly secondaryVelocity = zeros(SECONDARY_KEYS);
  private readonly drive = zeros(SECONDARY_KEYS);
  private readonly filter = new HandFeatureFilter();
  private hasHand = false;
  private lastSeen = -Infinity;
  private acquiredAt = -Infinity;
  private engagement = 0;
  private holding = false;
  private reversing = false;
  private sensitivity = 0.5;
  private springSmoothing = -1;
  private springs: Record<RigKey, SpringParams> = springParams(0.5);

  constructor(side: Side) {
    this.side = side;
    this.rig = idleRig(side, 0, 1);
    this.control = { ...this.rig };
    Object.assign(this.target, this.rig);
  }

  isTracking(now: number) {
    return this.hasHand && now - this.lastSeen < GRACE_MS;
  }

  /** 0 at rest, 1 when fully held: how strongly to light the puppet up. */
  get presence() {
    return smoothstep(this.engagement);
  }

  /**
   * Feeds a newly assigned hand. Every valid result updates the target at
   * once, with no debouncing; `captureTime` (ms) is when the camera took the
   * frame. Returns true when this picks the puppet up from rest.
   */
  observe(hand: HandDetection | null, aspect: number, now: number, settings: Settings, captureTime: number): boolean {
    if (!hand) return false;
    const fresh = !this.isTracking(now);
    if (fresh) {
      this.filter.reset();
      this.acquiredAt = now;
      this.palmVelocity.x = 0;
      this.palmVelocity.y = 0;
      this.reversing = false;
    }

    const features = this.filter.filter(extractHandFeatures(hand, aspect), captureTime / 1000, settings.smoothing);

    if (!fresh) {
      const dt = (captureTime - this.palm.t) / 1000;
      if (dt > 0.004) {
        const vx = (features.palmX - this.palm.x) / dt;
        const vy = (features.palmY - this.palm.y) / dt;
        this.reversing = vx * this.palmVelocity.x + vy * this.palmVelocity.y < 0;
        this.palmVelocity.x += (vx - this.palmVelocity.x) * 0.5;
        this.palmVelocity.y += (vy - this.palmVelocity.y) * 0.5;
      }
    }
    this.palm.x = features.palmX;
    this.palm.y = features.palmY;
    this.palm.t = captureTime;
    this.palm.seenAt = now;

    this.features = features;
    this.pinched = this.filter.pinched;
    this.sensitivity = settings.sensitivity;
    articulateFromHand(features, this.side, settings.sensitivity, this.tracked);
    this.lastSeen = now;
    this.hasHand = true;

    const pickedUp = !this.holding;
    // Coming back while the puppet was still settling: carry on from where the release had got to.
    if (pickedUp) this.engagement = smoothstep(this.engagement);
    this.holding = true;
    return pickedUp;
  }

  /**
   * First half of a frame: this frame's target pose. The caller may adjust it,
   * e.g. to keep the two puppets apart, before calling `integrate`.
   */
  prepareTarget(now: number, dt: number, idleAmplitude: number): PuppetRig {
    const tracking = this.isTracking(now);
    if (tracking) {
      this.engagement += (1 - this.engagement) * (1 - Math.exp(-ATTACK_RATE * dt));
    } else {
      this.holding = false;
      this.engagement = Math.max(0, this.engagement - RELEASE_RATE * dt);
    }

    idleRig(this.side, now / 1000, idleAmplitude, this.idle);
    const target = this.target;
    if (this.hasHand && this.engagement > 0) {
      let horizon = clamp(now - this.palm.seenAt + PREDICT_LEAD_MS, 0, PREDICT_MAX_MS) / 1000;
      if (!tracking || now - this.acquiredAt < PREDICT_WARMUP_MS || this.reversing) horizon = 0;
      const px = this.palm.x + clamp(this.palmVelocity.x * horizon, -PREDICT_MAX_SHIFT, PREDICT_MAX_SHIFT);
      const py = this.palm.y + clamp(this.palmVelocity.y * horizon, -PREDICT_MAX_SHIFT, PREDICT_MAX_SHIFT);
      stagePosition(px, py, this.side, this.sensitivity, this.position);
      this.tracked.x = this.position.x;
      this.tracked.y = this.position.y;
      // Grabbing takes over directly (fast attack); letting go eases out.
      blendRig(this.idle, this.tracked, tracking ? this.engagement : smoothstep(this.engagement), target);
    } else {
      Object.assign(target, this.idle);
    }

    // Hanging arms partly resist the lean, as gravity would.
    target.shoulderAngle += target.bodyRotation * 0.4;
    target.backShoulderAngle += target.bodyRotation * 0.4;
    return target;
  }

  /** Second half of a frame: followers, then the slight follow-through layered on top. */
  integrate(dt: number, settings: Settings): PuppetRig {
    if (settings.smoothing !== this.springSmoothing) {
      this.springSmoothing = settings.smoothing;
      this.springs = springParams(settings.smoothing);
    }
    const control = this.control;
    const target = this.target;
    for (const key of RIG_KEYS) {
      control[key] = stepSpring(control[key], target[key], this.controlVelocity, key, this.springs[key], dt);
    }

    const behind = Math.hypot(target.x - control.x, target.y - control.y);
    const speed = Math.hypot(this.controlVelocity.x, this.controlVelocity.y);
    this.follow.distance += (behind - this.follow.distance) * 0.1;
    if (speed > 60) this.follow.lagMs += ((behind / speed) * 1000 - this.follow.lagMs) * 0.1;

    // Follow-through is driven by how fast the controlled puppet travels:
    // the arms trail sideways moves a touch and lift a little on rises.
    const forwardSpeed = facing(this.side) * this.controlVelocity.x;
    const verticalSpeed = this.controlVelocity.y;
    this.drive.trail = clamp(-forwardSpeed * 0.012, -8, 8);
    this.drive.fling = clamp(verticalSpeed * 0.01, -6, 6);
    this.drive.lean = clamp(forwardSpeed * 0.004, -2.5, 2.5);
    this.drive.nod = clamp(verticalSpeed * 0.005, -2.5, 2.5);
    for (const key of SECONDARY_KEYS) {
      this.secondary[key] = stepSpring(this.secondary[key], this.drive[key], this.secondaryVelocity, key, SECONDARY, dt);
    }

    const { trail, fling, lean, nod } = this.secondary;
    const rig = Object.assign(this.rig, control);
    rig.shoulderAngle += trail * 0.8 + fling;
    rig.backShoulderAngle += trail + fling * 0.8;
    rig.elbowAngle += trail * 0.4 + fling * 0.5;
    rig.backElbowAngle += trail * 0.4 + fling * 0.5;
    rig.bodyRotation += lean;
    rig.headRotation += nod;
    return rig;
  }
}
