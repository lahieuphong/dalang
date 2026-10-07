import type { HandDetection, HandFeatures, PuppetRig, Settings, Side } from '../types';
import { HandFeatureFilter } from './handFeatureFilter';
import { clamp, extractHandFeatures, lerp, smoothstep } from './handMath';
import { facing } from './puppetGeometry';
import { articulateFromHand, blendRig, emptyRig, idleRig, RIG_KEYS, stagePosition } from './puppetMapping';
import { stepSpring, type SpringParams } from './smoothing';

/** Keep the last tracked pose this long after a hand drops out, so brief misses never flicker. */
export const GRACE_MS = 380;
/** Engagement (0 = idle pose, 1 = hand pose) per second: grab fast (~110 ms), let go gently. */
const PICKUP_RATE = 9;
const RELEASE_RATE = 1.5;

/**
 * Palm prediction hides part of the camera + inference latency by
 * extrapolating the filtered palm to the moment of rendering. It is short,
 * clamped, and switched off just after pickup or when the hand reverses.
 */
const PREDICT_MAX_MS = 35;
const PREDICT_WARMUP_MS = 150;
const PREDICT_MAX_SHIFT = 0.035;

type RigKey = (typeof RIG_KEYS)[number];

/**
 * Response classes. Primary control (root, arm joints, fingers) is fast and
 * barely overshoots, so the puppet follows the hand closely; body and head
 * are a little softer. Even at maximum smoothing the joints stay responsive.
 */
function springParams(smoothing: number): Record<RigKey, SpringParams> {
  const s = clamp(smoothing, 0, 1);
  const root = { frequency: lerp(48, 22, s), damping: 0.9 };
  const joint = { frequency: lerp(50, 24, s), damping: 0.9 };
  const fingers = { frequency: lerp(55, 26, s), damping: 0.9 };
  const soft = { frequency: lerp(14, 6, s), damping: 1 };
  return {
    x: root,
    y: root,
    scale: soft,
    depth: soft,
    bodyRotation: { frequency: lerp(30, 14, s), damping: 0.82 },
    headRotation: { frequency: lerp(24, 11, s), damping: 0.72 },
    shoulderAngle: joint,
    elbowAngle: joint,
    backShoulderAngle: joint,
    backElbowAngle: joint,
    wristAngle: { frequency: lerp(52, 25, s), damping: 0.88 },
    frontFingerCurl: fingers,
    backFingerCurl: fingers,
  };
}

/** Secondary physics: loose, swingy springs that only ever add offsets on top of the controlled pose. */
const SECONDARY: SpringParams = { frequency: 11, damping: 0.42 };
const SECONDARY_KEYS = ['trail', 'fling', 'lean', 'nod'] as const;

const zeros = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

/**
 * Owns one puppet's motion. Each hand gets its own controller, so its
 * filters, velocity, pinch state and springs are fully independent.
 *
 *   landmarks → features (filtered per channel) → target pose
 *     → primary springs (fast) → + secondary physics (loose) → rendered rig
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

  private readonly control: PuppetRig;
  private readonly target = emptyRig();
  private readonly idle = emptyRig();
  private readonly tracked = emptyRig();
  private readonly position = { x: 0, y: 0 };
  private readonly palm = { x: 0.5, y: 0.5, t: 0 };
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
  private sensitivity = 0.65;
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
   * once; `captureTime` (ms) is when the camera took the frame. Returns true
   * when this picks the puppet up from rest.
   */
  observe(hand: HandDetection | null, aspect: number, now: number, settings: Settings, captureTime: number): boolean {
    if (!hand) return false;
    const fresh = !this.isTracking(now);
    if (fresh) {
      this.filter.reset();
      this.acquiredAt = now;
      this.palmVelocity.x = 0;
      this.palmVelocity.y = 0;
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

    this.features = features;
    this.pinched = this.filter.pinched;
    this.sensitivity = settings.sensitivity;
    articulateFromHand(features, this.side, this.tracked);
    this.lastSeen = now;
    this.hasHand = true;

    const pickedUp = !this.holding;
    this.holding = true;
    // A tiny physical acknowledgement of the pickup, on the secondary layer only.
    if (pickedUp) this.secondaryVelocity.fling -= 90;
    return pickedUp;
  }

  /**
   * First half of a frame: this frame's target pose. The caller may adjust it,
   * e.g. to keep the two puppets apart, before calling `integrate`.
   */
  prepareTarget(now: number, dt: number, idleAmplitude: number): PuppetRig {
    const tracking = this.isTracking(now);
    if (!tracking) this.holding = false;
    this.engagement = tracking
      ? Math.min(1, this.engagement + PICKUP_RATE * dt)
      : Math.max(0, this.engagement - RELEASE_RATE * dt);

    idleRig(this.side, now / 1000, idleAmplitude, this.idle);
    const target = this.target;
    if (this.hasHand && this.engagement > 0) {
      let horizon = clamp(now - this.palm.t, 0, PREDICT_MAX_MS) / 1000;
      if (now - this.acquiredAt < PREDICT_WARMUP_MS || this.reversing) horizon = 0;
      const px = this.palm.x + clamp(this.palmVelocity.x * horizon, -PREDICT_MAX_SHIFT, PREDICT_MAX_SHIFT);
      const py = this.palm.y + clamp(this.palmVelocity.y * horizon, -PREDICT_MAX_SHIFT, PREDICT_MAX_SHIFT);
      stagePosition(px, py, this.side, this.sensitivity, this.position);
      this.tracked.x = this.position.x;
      this.tracked.y = this.position.y;
      blendRig(this.idle, this.tracked, smoothstep(this.engagement), target);
    } else {
      Object.assign(target, this.idle);
    }

    // Hanging arms partly resist the lean, as gravity would.
    target.shoulderAngle += target.bodyRotation * 0.4;
    target.backShoulderAngle += target.bodyRotation * 0.4;
    return target;
  }

  /** Second half of a frame: primary springs, then secondary physics layered on top. */
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

    // Secondary physics is driven by how fast the controlled puppet travels:
    // loose arms trail sideways moves and fling on lifts, the body leans into
    // travel and the head nods with vertical motion.
    const forwardSpeed = facing(this.side) * this.controlVelocity.x;
    const verticalSpeed = this.controlVelocity.y;
    this.drive.trail = clamp(-forwardSpeed * 0.05, -26, 26);
    this.drive.fling = clamp(verticalSpeed * 0.04, -22, 22);
    this.drive.lean = clamp(forwardSpeed * 0.01, -6, 6);
    this.drive.nod = clamp(verticalSpeed * 0.015, -6, 6);
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
