import type { HandDetection, PuppetRig, Settings, Side } from '../types';
import { clamp, extractHandFeatures, lerp, smoothstep, type HandFeatures } from './handMath';
import { facing } from './puppetGeometry';
import { blendRig, idleRig, RIG_KEYS, rigFromHand } from './puppetMapping';
import { OneEuroFilter, stepSpring, type SpringParams } from './smoothing';

/** Keep the last tracked pose this long after a hand drops out, so brief misses never flicker. */
export const GRACE_MS = 380;
/** Engagement (0 = idle pose, 1 = hand pose) change per second. */
const PICKUP_RATE = 3.4;
const RELEASE_RATE = 1.5;
/** The little hop-and-wave when a hand first picks a puppet up lasts about half a second. */
const FLOURISH_RATE = 2.2;

type RigKey = (typeof RIG_KEYS)[number];
type FeatureKey = keyof HandFeatures;

/** One Euro [minCutoff Hz, beta] per feature, tuned to each feature's units. */
const FEATURE_FILTERS: Record<FeatureKey, readonly [number, number]> = {
  palmX: [1.2, 10],
  palmY: [1.2, 10],
  tilt: [1, 0.05],
  indexDeflection: [1, 0.05],
  indexExtension: [1.6, 2],
  openness: [1.6, 2],
  thumbSpread: [1.4, 1.6],
  pinch: [1.6, 2],
  size: [0.8, 2],
};
const FEATURE_KEYS = Object.keys(FEATURE_FILTERS) as FeatureKey[];

function springParams(smoothing: number): Record<RigKey, SpringParams> {
  const position = { frequency: lerp(18, 7, smoothing), damping: 0.84 };
  const soft = { frequency: lerp(12, 5.5, smoothing), damping: 1 };
  // Under-damped arms swing past their target, like loose leather on a pin.
  const arm = { frequency: lerp(15, 7, smoothing), damping: 0.5 };
  return {
    x: position,
    y: position,
    scale: soft,
    depth: soft,
    bodyRotation: { frequency: lerp(16, 7, smoothing), damping: 0.78 },
    headRotation: { frequency: lerp(13, 6, smoothing), damping: 0.62 },
    shoulderAngle: arm,
    elbowAngle: arm,
    backShoulderAngle: arm,
    backElbowAngle: arm,
    wristAngle: { frequency: lerp(17, 8, smoothing), damping: 0.5 },
  };
}

/**
 * Owns one puppet's motion: hand features → filtered features → target pose,
 * blended with the idle pose by an engagement factor, then sprung toward
 * smoothly every animation frame.
 */
export class PuppetController {
  readonly side: Side;
  readonly rig: PuppetRig;
  /** Latest filtered features, exposed for the debug panel. */
  features: HandFeatures | null = null;

  private readonly target: PuppetRig;
  private readonly velocity: Record<RigKey, number>;
  private readonly filters: Record<FeatureKey, OneEuroFilter>;
  private tracked: PuppetRig | null = null;
  private lastSeen = -Infinity;
  private engagement = 0;
  private holding = false;
  /** 1 right after a pickup, decaying to 0: drives the hop-and-wave. */
  private flourish = 0;
  private springSmoothing = -1;
  private springs: Record<RigKey, SpringParams> = springParams(0.5);

  constructor(side: Side) {
    this.side = side;
    this.rig = idleRig(side, 0, 1);
    this.target = { ...this.rig };
    this.velocity = Object.fromEntries(RIG_KEYS.map((key) => [key, 0])) as Record<RigKey, number>;
    this.filters = Object.fromEntries(
      FEATURE_KEYS.map((key) => [key, new OneEuroFilter(FEATURE_FILTERS[key][0], FEATURE_FILTERS[key][1])]),
    ) as Record<FeatureKey, OneEuroFilter>;
  }

  isTracking(now: number) {
    return this.tracked !== null && now - this.lastSeen < GRACE_MS;
  }

  /** 0 at rest, 1 when fully held: how strongly to light the puppet up. */
  get presence() {
    return smoothstep(this.engagement);
  }

  /** Feeds a newly assigned hand. Returns true when this picks the puppet up from rest. */
  observe(hand: HandDetection | null, aspect: number, now: number, settings: Settings): boolean {
    if (!hand) return false;
    if (!this.isTracking(now)) {
      for (const key of FEATURE_KEYS) this.filters[key].reset();
    }

    const raw = extractHandFeatures(hand, aspect);
    const cutoffScale = lerp(1.8, 0.55, settings.smoothing);
    const filtered = {} as HandFeatures;
    for (const key of FEATURE_KEYS) {
      const filter = this.filters[key];
      filter.minCutoff = FEATURE_FILTERS[key][0] * cutoffScale;
      filtered[key] = filter.filter(raw[key], now / 1000);
    }

    this.features = filtered;
    this.tracked = rigFromHand(filtered, this.side, settings.sensitivity);
    this.lastSeen = now;

    const pickedUp = !this.holding;
    this.holding = true;
    if (pickedUp) this.flourish = 1;
    return pickedUp;
  }

  /**
   * First half of a frame: computes this frame's target pose (idle/hand blend
   * plus secondary motion). The caller may adjust it, e.g. to keep the two
   * puppets apart, before calling `integrate`.
   */
  prepareTarget(now: number, dt: number, idleAmplitude: number): PuppetRig {
    const tracking = this.isTracking(now);
    if (!tracking) this.holding = false;
    this.engagement = tracking
      ? Math.min(1, this.engagement + PICKUP_RATE * dt)
      : Math.max(0, this.engagement - RELEASE_RATE * dt);

    const idle = idleRig(this.side, now / 1000, idleAmplitude);
    const target =
      this.tracked && this.engagement > 0
        ? blendRig(idle, this.tracked, smoothstep(this.engagement), this.target)
        : Object.assign(this.target, idle);

    // Secondary motion: the body leans into travel, loose arms trail behind it
    // sideways and fling when the puppet is raised or dropped quickly, the head
    // tips with vertical moves, and hanging arms partly resist the lean.
    const forwardSpeed = facing(this.side) * this.velocity.x;
    const trail = clamp(-forwardSpeed * 0.06, -32, 32);
    const fling = clamp(this.velocity.y * 0.045, -24, 24);
    target.bodyRotation += clamp(forwardSpeed * 0.012, -7, 7);
    target.headRotation += clamp(this.velocity.y * 0.02, -8, 8);
    target.shoulderAngle += trail * 0.8 + fling + target.bodyRotation * 0.4;
    target.backShoulderAngle += trail + fling * 0.8 + target.bodyRotation * 0.4;
    target.elbowAngle += trail * 0.4 + fling * 0.5;
    target.backElbowAngle += trail * 0.4 + fling * 0.5;

    // Pickup flourish: a small hop with a raised-arm greeting, then settle.
    if (this.flourish > 0) {
      this.flourish = Math.max(0, this.flourish - FLOURISH_RATE * dt);
      const bump = Math.sin(Math.PI * (1 - this.flourish));
      target.y -= 26 * bump;
      target.shoulderAngle += 30 * bump;
      target.backShoulderAngle += 18 * bump;
      target.headRotation -= 5 * bump;
    }
    return target;
  }

  /** Second half of a frame: springs the rendered pose toward the prepared target. */
  integrate(dt: number, settings: Settings): PuppetRig {
    const target = this.target;
    if (settings.smoothing !== this.springSmoothing) {
      this.springSmoothing = settings.smoothing;
      this.springs = springParams(settings.smoothing);
    }
    for (const key of RIG_KEYS) {
      this.rig[key] = stepSpring(this.rig[key], target[key], this.velocity, key, this.springs[key], dt);
    }
    return this.rig;
  }
}
