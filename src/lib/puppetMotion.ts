import type { HandDetection, PuppetRig, Settings, Side } from '../types';
import { clamp, extractHandFeatures, lerp, smoothstep, type HandFeatures } from './handMath';
import { facing } from './puppetGeometry';
import { blendRig, idleRig, RIG_KEYS, rigFromHand } from './puppetMapping';
import { OneEuroFilter, stepSpring, type SpringParams } from './smoothing';

/** Keep the last tracked pose this long after a hand drops out, so brief misses never flicker. */
export const GRACE_MS = 380;
/** Engagement (0 = idle pose, 1 = hand pose) change per second. */
const PICKUP_RATE = 2.6;
const RELEASE_RATE = 1.5;

type RigKey = (typeof RIG_KEYS)[number];
type FeatureKey = keyof HandFeatures;

/** One Euro [minCutoff Hz, beta] per feature, tuned to each feature's units. */
const FEATURE_FILTERS: Record<FeatureKey, readonly [number, number]> = {
  palmX: [1.1, 6],
  palmY: [1.1, 6],
  tilt: [0.9, 0.03],
  indexDeflection: [0.9, 0.03],
  indexExtension: [1.4, 1.2],
  openness: [1.4, 1.2],
  thumbSpread: [1.2, 1],
  pinch: [1.4, 1.2],
  size: [0.6, 1.5],
};
const FEATURE_KEYS = Object.keys(FEATURE_FILTERS) as FeatureKey[];

function springParams(smoothing: number): Record<RigKey, SpringParams> {
  const position = { frequency: lerp(15, 6.5, smoothing), damping: 0.86 };
  const soft = { frequency: lerp(10, 5, smoothing), damping: 1 };
  // Under-damped arms swing a little past their target, like loose leather on a pin.
  const arm = { frequency: lerp(13, 6.5, smoothing), damping: 0.62 };
  return {
    x: position,
    y: position,
    scale: soft,
    depth: soft,
    bodyRotation: { frequency: lerp(14, 6.5, smoothing), damping: 0.8 },
    headRotation: { frequency: lerp(12, 5.5, smoothing), damping: 0.7 },
    shoulderAngle: arm,
    elbowAngle: arm,
    backShoulderAngle: arm,
    backElbowAngle: arm,
    wristAngle: { frequency: lerp(15, 7, smoothing), damping: 0.6 },
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

    // Secondary motion: the body leans into travel, loose arms trail behind it,
    // and hanging arms partly resist the lean as gravity would.
    const forwardSpeed = facing(this.side) * this.velocity.x;
    const trail = clamp(-forwardSpeed * 0.04, -24, 24);
    target.bodyRotation += clamp(forwardSpeed * 0.008, -4, 4);
    target.shoulderAngle += trail * 0.8 + target.bodyRotation * 0.4;
    target.backShoulderAngle += trail + target.bodyRotation * 0.4;
    target.elbowAngle += trail * 0.4;
    target.backElbowAngle += trail * 0.4;
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
