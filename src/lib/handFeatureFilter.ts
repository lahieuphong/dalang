import { FINGER_NAMES, type FingerName, type HandFeatures } from '../types';
import { clamp, lerp, normalize, pinchFromDistance, smoothstep } from './handMath';
import { OneEuroFilter } from './smoothing';

/**
 * Per-channel filtering for one hand's features.
 *
 * Every channel gets its own One Euro filter tuned to how that signal behaves:
 * palm position and finger articulation pass through fast (they are the
 * puppeteer's intent), depth is calmer. Before filtering, a light spike guard
 * holds a single implausible jump for one frame; if the next frame confirms
 * the move (same direction), it is accepted, so genuine fast gestures still
 * get through with at most one frame of delay.
 */

interface ChannelSpec {
  /** One Euro minimum cutoff (Hz) at default smoothing. */
  minCutoff: number;
  /** One Euro speed coefficient, in the channel's units per second. */
  beta: number;
  /** Largest believable change between two consecutive tracker frames. */
  jump: number;
}

const ROOT: ChannelSpec = { minCutoff: 2.2, beta: 25, jump: 0.15 };
const ARTICULATION: ChannelSpec = { minCutoff: 4.5, beta: 3, jump: 0.5 };
const DIRECTION: ChannelSpec = { minCutoff: 3, beta: 0.06, jump: 45 };
const ORIENTATION: ChannelSpec = { minCutoff: 2.5, beta: 0.06, jump: 35 };
const TILT: ChannelSpec = { minCutoff: 1.5, beta: 0.04, jump: 35 };
const DEPTH: ChannelSpec = { minCutoff: 1, beta: 2, jump: 0.06 };
const PINCH: ChannelSpec = { minCutoff: 6, beta: 5, jump: 0.6 };
const SPREAD: ChannelSpec = { minCutoff: 3.5, beta: 2, jump: 0.6 };

type FingerKey = `${FingerName}.${'extension' | 'curl' | 'direction'}`;
type ScalarKey =
  | 'palmX'
  | 'palmY'
  | 'roll'
  | 'pitch'
  | 'yaw'
  | 'size'
  | 'thumbSpread'
  | 'pinchDistance'
  | 'middlePinch'
  | 'spreadIndexMiddle'
  | 'spreadMiddleRing'
  | 'spreadRingPinky';
type ChannelKey = ScalarKey | FingerKey;

const CHANNELS: readonly (readonly [ChannelKey, ChannelSpec])[] = [
  ['palmX', ROOT],
  ['palmY', ROOT],
  ['roll', ORIENTATION],
  ['pitch', TILT],
  ['yaw', TILT],
  ['size', DEPTH],
  ['thumbSpread', ARTICULATION],
  ['pinchDistance', PINCH],
  ['middlePinch', PINCH],
  ['spreadIndexMiddle', SPREAD],
  ['spreadMiddleRing', SPREAD],
  ['spreadRingPinky', SPREAD],
  ...FINGER_NAMES.flatMap((finger) => [
    [`${finger}.extension`, ARTICULATION] as const,
    [`${finger}.curl`, ARTICULATION] as const,
    [`${finger}.direction`, DIRECTION] as const,
  ]),
];

interface Accessor {
  get(f: HandFeatures): number;
  set(f: HandFeatures, value: number): void;
}

/** Built once, so the per-frame loop never parses keys or allocates. */
function accessor(key: ChannelKey): Accessor {
  const dot = key.indexOf('.');
  if (dot < 0) {
    const scalar = key as ScalarKey;
    return { get: (f) => f[scalar], set: (f, v) => void (f[scalar] = v) };
  }
  const finger = key.slice(0, dot) as FingerName;
  const field = key.slice(dot + 1) as 'extension' | 'curl' | 'direction';
  return { get: (f) => f[finger][field], set: (f, v) => void (f[finger][field] = v) };
}

const ACCESSORS = CHANNELS.map(([key]) => accessor(key));

/** Holds back a single-frame spike; confirms it if the next frame keeps going the same way. */
class SpikeGuard {
  private last: number | null = null;
  private pending: number | null = null;

  reset() {
    this.last = null;
    this.pending = null;
  }

  apply(value: number, jump: number): number {
    const last = this.last;
    if (last === null || Math.abs(value - last) <= jump) {
      this.pending = null;
      this.last = value;
      return value;
    }
    const pending = this.pending;
    if (pending !== null && Math.sign(value - last) === Math.sign(pending - last)) {
      this.pending = null;
      this.last = value;
      return value;
    }
    this.pending = value;
    return last;
  }
}

const emptyFinger = () => ({ extension: 0, curl: 0, direction: 0 });

export function emptyFeatures(): HandFeatures {
  return {
    palmX: 0.5,
    palmY: 0.5,
    roll: 0,
    pitch: 0,
    yaw: 0,
    size: 0.15,
    thumb: emptyFinger(),
    index: emptyFinger(),
    middle: emptyFinger(),
    ring: emptyFinger(),
    pinky: emptyFinger(),
    thumbSpread: 0,
    pinchDistance: 1,
    pinchStrength: 0,
    middlePinch: 0,
    spreadIndexMiddle: 0,
    spreadMiddleRing: 0,
    spreadRingPinky: 0,
    openness: 0,
    fistStrength: 0,
  };
}

/** Pinch state with hysteresis, for accents and debugging only; the pose uses pinchStrength. */
const PINCH_ENTER = 0.24;
const PINCH_RELEASE = 0.32;

export class HandFeatureFilter {
  /** The latest filtered features (reused object). */
  readonly value: HandFeatures = emptyFeatures();
  pinched = false;

  private readonly filters = CHANNELS.map(([, spec]) => new OneEuroFilter(spec.minCutoff, spec.beta, 1.5));
  private readonly guards = CHANNELS.map(() => new SpikeGuard());

  reset() {
    for (const filter of this.filters) filter.reset();
    for (const guard of this.guards) guard.reset();
    this.pinched = false;
  }

  /**
   * `time` is the capture time in seconds. `smoothing` (0..1) trades
   * responsiveness for stability by scaling every channel's minimum cutoff,
   * but even at its maximum the articulation channels stay above ~3 Hz.
   */
  filter(raw: HandFeatures, time: number, smoothing: number): HandFeatures {
    const cutoffScale = lerp(1.5, 0.65, clamp(smoothing, 0, 1));
    const out = this.value;
    for (let i = 0; i < CHANNELS.length; i++) {
      const spec = CHANNELS[i][1];
      const filter = this.filters[i];
      filter.minCutoff = spec.minCutoff * cutoffScale;
      ACCESSORS[i].set(out, filter.filter(this.guards[i].apply(ACCESSORS[i].get(raw), spec.jump), time));
    }

    // Derived signals come from the filtered channels, so they need no filter of their own.
    out.pinchStrength = pinchFromDistance(out.pinchDistance);
    out.middlePinch = clamp(out.middlePinch, 0, 1);
    out.openness = (out.index.extension + out.middle.extension + out.ring.extension + out.pinky.extension) / 4;
    const meanCurl = (out.index.curl + out.middle.curl + out.ring.curl + out.pinky.curl) / 4;
    out.fistStrength = smoothstep(normalize(0.82 * meanCurl + 0.18 * out.thumb.curl, 0.15, 0.8));

    if (this.pinched) this.pinched = out.pinchDistance < PINCH_RELEASE;
    else this.pinched = out.pinchDistance < PINCH_ENTER;
    return out;
  }
}
