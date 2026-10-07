import type { HandDetection, HandFrame, Point, Side } from '../types';

/**
 * Development aid (`?simulate=1`): synthesizes two plausible moving hands so the
 * full assignment → mapping → smoothing → rendering pipeline can be exercised
 * without a webcam. The right hand periodically drops out to test the
 * grace period and the return to idle.
 */

/** Left hand seen palm-on in a mirrored preview; wrist at the origin, unit = palm length. */
const TEMPLATE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.28, -0.16], [0.48, -0.36], [0.62, -0.56], [0.74, -0.72],
  [0.3, -0.95], [0.34, -1.35], [0.36, -1.6], [0.38, -1.82],
  [0.05, -1.0], [0.05, -1.45], [0.05, -1.72], [0.05, -1.95],
  [-0.18, -0.95], [-0.22, -1.35], [-0.24, -1.58], [-0.26, -1.78],
  [-0.38, -0.85], [-0.45, -1.15], [-0.48, -1.33], [-0.5, -1.5],
];
const FINGER_CHAINS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
] as const;

const ASPECT = 16 / 9;
const INTERVAL_MS = 1000 / 28;
const METERS_PER_UNIT = 0.085;

interface HandPose {
  x: number;
  y: number;
  tilt: number;
  size: number;
  /** Extension per finger: thumb, index, middle, ring, pinky. */
  extension: readonly number[];
}

function synthesize(pose: HandPose, side: Side): HandDetection {
  const flip = side === 'left' ? 1 : -1;
  const local: Point[] = TEMPLATE.map(([x, y]) => ({ x: x * flip, y, z: 0 }));

  // Curl each finger toward the camera, joint by joint.
  FINGER_CHAINS.forEach((chain, finger) => {
    const bend = (1 - pose.extension[finger]) * (finger === 0 ? 0.6 : 1.35);
    let previous = local[chain[0]];
    for (let k = 1; k < chain.length; k++) {
      const [tx, ty] = TEMPLATE[chain[k]];
      const [px, py] = TEMPLATE[chain[k - 1]];
      const length = Math.hypot(tx - px, ty - py);
      const dirX = ((tx - px) / length) * flip;
      const dirY = (ty - py) / length;
      const a = bend * k * 0.55;
      const point = {
        x: previous.x + dirX * length * Math.cos(a),
        y: previous.y + dirY * length * Math.cos(a),
        z: (previous.z ?? 0) - length * Math.sin(a),
      };
      local[chain[k]] = point;
      previous = point;
    }
  });

  const t = (pose.tilt * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const rotated = local.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos, z: p.z ?? 0 }));
  const palmIds = [0, 5, 9, 13, 17];
  const cx = palmIds.reduce((sum, i) => sum + rotated[i].x, 0) / palmIds.length;
  const cy = palmIds.reduce((sum, i) => sum + rotated[i].y, 0) / palmIds.length;

  return {
    landmarks: rotated.map((p) => ({
      x: pose.x + ((p.x - cx) * pose.size) / ASPECT,
      y: pose.y + (p.y - cy) * pose.size,
      z: p.z * pose.size,
    })),
    worldLandmarks: rotated.map((p) => ({
      x: (p.x - cx) * METERS_PER_UNIT,
      y: (p.y - cy) * METERS_PER_UNIT,
      z: p.z * METERS_PER_UNIT,
    })),
    handedness: side,
    naturalSide: side,
    handednessScore: 0.96,
  };
}

const wave = (t: number, speed: number, phase = 0) => Math.sin(t * speed + phase);

function scriptedPose(side: Side, t: number): HandPose {
  const p = side === 'left' ? 0 : 1.7;
  const baseX = side === 'left' ? 0.32 : 0.68;
  const fingers = 0.55 + 0.45 * wave(t, 0.75, p + 1);
  return {
    x: baseX + 0.13 * wave(t, 0.55, p) + (side === 'left' ? 0.06 : -0.06) * Math.max(0, wave(t, 0.3, 2)),
    y: 0.56 + 0.14 * wave(t, 0.83, p + 0.5),
    tilt: 14 * wave(t, 0.7, p),
    size: 0.17 + 0.03 * wave(t, 0.4, p),
    extension: [fingers, 0.5 + 0.5 * wave(t, 1.1, p), fingers, fingers, fingers],
  };
}

export class HandSimulator {
  private lastFrameAt = -Infinity;

  next(now: number): HandFrame | null {
    if (now - this.lastFrameAt < INTERVAL_MS) return null;
    this.lastFrameAt = now;
    const t = now / 1000;
    const hands = [synthesize(scriptedPose('left', t), 'left')];
    if (t % 11 < 8.8) hands.push(synthesize(scriptedPose('right', t), 'right'));
    return { hands, aspect: ASPECT, time: now };
  }
}
