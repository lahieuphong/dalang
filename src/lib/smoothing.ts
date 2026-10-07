import { clamp } from './handMath';

/** How long the running noise estimate remembers, seconds. */
const NOISE_MEMORY_S = 0.5;
/** A change this many noise standard deviations away from the filtered value is taken as real. */
const SNAP_SIGMAS = 3;

/**
 * One Euro filter (Casiez et al.) made noise-aware.
 *
 * One Euro alone: heavy smoothing while the signal is still, little lag once
 * it moves fast. Two things hold it back for live control. Its speed estimate
 * needs a few samples to build up, so the first frames of a movement are
 * delayed; and sensor noise looks like speed, so a noisy signal opens the
 * filter and shimmers. This version measures the signal's own noise as it
 * runs and uses it twice:
 *
 * - Snap: a change larger than noise can explain (3 σ) is let through on the
 *   very sample it is seen, with no build-up at all.
 * - Gate: only speed beyond what noise alone would produce opens the filter,
 *   and a signal noisier than expected is held more firmly at rest.
 *
 * The noise is estimated from how successive changes relate: noise reverses
 * from one sample to the next, deliberate movement keeps going. So moving the
 * hand does not make the filter think the camera got noisier.
 */
export class OneEuroFilter {
  minCutoff: number;
  beta: number;
  /** Expected noise (one standard deviation) under good conditions; 0 turns snapping and gating off. */
  noise = 0;
  /** Scales the measured noise: above 1 treats the signal as noisier than measured (steadier, a touch slower). */
  caution = 1;
  private readonly derivativeCutoff: number;
  private value: number | null = null;
  private derivative = 0;
  private lastTime = 0;
  private lastInput = 0;
  private lastDelta = 0;
  private noiseVariance = 0;

  constructor(minCutoff: number, beta: number, derivativeCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
  }

  reset() {
    this.value = null;
    this.derivative = 0;
  }

  /** `time` is in seconds. */
  filter(input: number, time: number): number {
    if (this.value === null) {
      this.value = input;
      this.lastTime = time;
      this.lastInput = input;
      this.lastDelta = 0;
      this.noiseVariance = this.noise * this.noise;
      return input;
    }
    const dt = Math.max(1e-3, time - this.lastTime);
    this.lastTime = time;

    // Measured noise, kept within sensible bounds of what this channel normally shows.
    let sigma = 0;
    let quiet = 1;
    if (this.noise > 0) {
      const delta = input - this.lastInput;
      this.lastInput = input;
      const floor = 0.25 * this.noise * this.noise;
      const sample = Math.min(Math.max(0, -delta * this.lastDelta), 9 * Math.max(this.noiseVariance, floor));
      this.lastDelta = delta;
      this.noiseVariance += (1 - Math.exp(-dt / NOISE_MEMORY_S)) * (sample - this.noiseVariance);
      const measured = clamp(Math.sqrt(this.noiseVariance), 0.5 * this.noise, 3 * this.noise);
      sigma = measured * this.caution;
      quiet = clamp(this.noise / sigma, 1 / 3, 1);
    }

    const error = input - this.value;
    const derivativeAlpha = smoothingFactor(dt, this.derivativeCutoff);
    this.derivative += derivativeAlpha * (error / dt - this.derivative);
    const noiseSpeed = 1.5 * (sigma / dt) * Math.sqrt(derivativeAlpha / (2 - derivativeAlpha));
    const speed = Math.max(0, Math.abs(this.derivative) - noiseSpeed);
    let alpha = smoothingFactor(dt, this.minCutoff * quiet + this.beta * speed);
    if (sigma > 0) {
      const excess = Math.abs(error) / (SNAP_SIGMAS * sigma) - 1;
      if (excess > 0) {
        const t = Math.min(1, excess);
        alpha += (1 - alpha) * t * t * (3 - 2 * t);
      }
    }
    this.value += alpha * error;
    return this.value;
  }
}

function smoothingFactor(dt: number, cutoff: number) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export interface SpringParams {
  /** Natural frequency in rad/s. Higher = snappier. */
  frequency: number;
  /** 1 = critically damped (no overshoot), below 1 lets the value swing past its target a little. */
  damping: number;
}

/**
 * Advances a damped spring toward `target` and returns the new value. Velocity is
 * kept in `velocity[key]` so callers can read it for secondary motion.
 *
 * This is the exact solution for a target held still over `dt`, so it is
 * stable at any stiffness and frame rate: a very fast spring simply arrives,
 * it never rings or blows up the way a stepped integrator would.
 */
export function stepSpring<K extends string>(
  value: number,
  target: number,
  velocity: Record<K, number>,
  key: K,
  params: SpringParams,
  dt: number,
): number {
  if (dt <= 0) return value;
  const { frequency: w, damping: z } = params;
  const x0 = value - target;
  const v0 = velocity[key];

  if (z >= 1) {
    const decay = Math.exp(-w * dt);
    const c = v0 + w * x0;
    velocity[key] = (v0 - c * w * dt) * decay;
    return target + (x0 + c * dt) * decay;
  }

  const wd = w * Math.sqrt(1 - z * z);
  const decay = Math.exp(-z * w * dt);
  const cos = Math.cos(wd * dt);
  const sin = Math.sin(wd * dt);
  const b = (v0 + z * w * x0) / wd;
  velocity[key] = decay * (v0 * cos - (x0 * wd + z * w * b) * sin);
  return target + decay * (x0 * cos + b * sin);
}
