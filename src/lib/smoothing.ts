/**
 * One Euro filter (Casiez et al.): heavy smoothing while the signal is still,
 * little lag once it moves fast. Ideal for killing hand tremor without making
 * deliberate motion feel sluggish.
 */
export class OneEuroFilter {
  minCutoff: number;
  beta: number;
  private readonly derivativeCutoff: number;
  private value: number | null = null;
  private derivative = 0;
  private lastTime = 0;

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
      return input;
    }
    const dt = Math.max(1e-3, time - this.lastTime);
    this.lastTime = time;
    const rawDerivative = (input - this.value) / dt;
    this.derivative += smoothingFactor(dt, this.derivativeCutoff) * (rawDerivative - this.derivative);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative);
    this.value += smoothingFactor(dt, cutoff) * (input - this.value);
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
  /** 1 = critically damped, below 1 lets the value swing past its target a little. */
  damping: number;
}

const MAX_SUBSTEP = 1 / 120;

/**
 * Advances a damped spring toward `target` and returns the new value. Velocity is
 * kept in `velocity[key]` so callers can read it for secondary motion.
 */
export function stepSpring<K extends string>(
  value: number,
  target: number,
  velocity: Record<K, number>,
  key: K,
  params: SpringParams,
  dt: number,
): number {
  const { frequency: w, damping: z } = params;
  let x = value;
  let v = velocity[key];
  let remaining = dt;
  while (remaining > 1e-6) {
    const h = Math.min(MAX_SUBSTEP, remaining);
    v += (w * w * (target - x) - 2 * z * w * v) * h;
    x += v * h;
    remaining -= h;
  }
  velocity[key] = v;
  return x;
}

