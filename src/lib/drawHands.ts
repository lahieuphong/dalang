import type { AssignedHands, HandDetection, HandFrame, Side } from '../types';

const CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

interface HandStyle {
  joint: string;
  tip: string;
}

/** Warm, decorative styling: cream bones, peach joints, muted coral fingertips. */
const STYLES: Record<Side | 'none', HandStyle> = {
  left: { joint: 'rgba(235, 194, 129, 0.95)', tip: 'rgba(218, 85, 88, 0.9)' },
  right: { joint: 'rgba(235, 194, 129, 0.95)', tip: 'rgba(218, 85, 88, 0.9)' },
  none: { joint: 'rgba(235, 194, 129, 0.55)', tip: 'rgba(218, 85, 88, 0.5)' },
};

export interface OverlayViewport {
  /** CSS pixel size of the preview. */
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
}

/**
 * Draws hands in view space onto a canvas that sits exactly over an
 * `object-fit: cover` video. Landmarks are already mirrored when the preview
 * is, so the canvas itself is never flipped.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  frame: HandFrame,
  assigned: AssignedHands,
  viewport: OverlayViewport,
) {
  const { width, height, videoWidth, videoHeight } = viewport;
  ctx.clearRect(0, 0, width, height);
  if (!videoWidth || !videoHeight) return;

  const scale = Math.max(width / videoWidth, height / videoHeight);
  const drawnWidth = videoWidth * scale;
  const drawnHeight = videoHeight * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;
  const unit = Math.max(0.8, Math.min(1.25, width / 300));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const hand of frame.hands) {
    const side: Side | 'none' = hand === assigned.left ? 'left' : hand === assigned.right ? 'right' : 'none';
    drawHand(ctx, hand, STYLES[side], unit, (x, y) => [offsetX + x * drawnWidth, offsetY + y * drawnHeight]);
  }
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: HandDetection,
  style: HandStyle,
  unit: number,
  project: (x: number, y: number) => [number, number],
) {
  const points = hand.landmarks.map((p) => project(p.x, p.y));

  // A soft dark underlay keeps the cream skeleton legible on bright skin.
  ctx.strokeStyle = 'rgba(28, 12, 5, 0.35)';
  ctx.lineWidth = 3.6 * unit;
  strokeSkeleton(ctx, points);
  ctx.strokeStyle = 'rgba(241, 213, 163, 0.85)';
  ctx.lineWidth = 1.8 * unit;
  strokeSkeleton(ctx, points);

  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    const tip = FINGERTIPS.has(i);
    ctx.beginPath();
    ctx.arc(x, y, (tip ? 2.6 : 2.1) * unit, 0, Math.PI * 2);
    ctx.fillStyle = tip ? style.tip : style.joint;
    ctx.fill();
    ctx.lineWidth = 0.9 * unit;
    ctx.strokeStyle = 'rgba(40, 16, 6, 0.55)';
    ctx.stroke();
  }
}

function strokeSkeleton(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(points[a][0], points[a][1]);
    ctx.lineTo(points[b][0], points[b][1]);
  }
  ctx.stroke();
}
