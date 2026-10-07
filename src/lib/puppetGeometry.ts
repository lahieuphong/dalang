import type { Point, PuppetRig, Side } from '../types';

/** The stage scene is drawn in a fixed 1000 × 860 viewBox. */
export const STAGE = {
  width: 1000,
  height: 860,
  /** Top edge of the foreground rail (about 7% of the screen height). */
  railTop: 798,
  /** Where the blencong lamp sits; shadows are cast away from it. */
  lamp: { x: 500, y: 60 },
} as const;

export interface ArmGeometry {
  shoulder: Point;
  upper: number;
  fore: number;
  /** Distance from the wrist pin to where the arm rod is tied to the palm. */
  grip: number;
}

/**
 * Puppet-local rig dimensions. Artwork is drawn facing right with the feet on
 * y = 0; the right-hand puppet is the same rig mirrored.
 */
export const PUPPET = {
  /** Base size of the artwork on stage; puppets stand a little over half the screen height. */
  scale: 1.1,
  /** The dalang's grip on the main rod, below the feet. Rig x/y refer to this point. */
  pivotY: 60,
  /** The body leans about this height (around the knees), so a lean bows the puppet rather than swinging it. */
  leanY: -120,
  neck: { x: 40, y: -336 },
  front: { shoulder: { x: 46, y: -297 }, upper: 108, fore: 102, grip: 18 } satisfies ArmGeometry,
  back: { shoulder: { x: -42, y: -295 }, upper: 108, fore: 102, grip: 18 } satisfies ArmGeometry,
  rodLength: 560,
  /** Where the four-finger blade hinges on the palm, in hand coordinates. */
  knuckle: { x: 0.3, y: 21 },
} as const;

/** +1 when the puppet faces right (stage left puppet), -1 when it faces left. */
export const facing = (side: Side) => (side === 'left' ? 1 : -1);

const RAD = Math.PI / 180;

/** Forward kinematics: the point on the hand where its control rod attaches, in puppet space. */
export function armGripPoint(arm: ArmGeometry, shoulderDeg: number, elbowDeg: number, wristDeg: number): Point {
  const a1 = shoulderDeg * RAD;
  const a2 = a1 + elbowDeg * RAD;
  const a3 = a2 + wristDeg * RAD;
  return {
    x: arm.shoulder.x + arm.upper * Math.sin(a1) + arm.fore * Math.sin(a2) + arm.grip * Math.sin(a3),
    y: arm.shoulder.y + arm.upper * Math.cos(a1) + arm.fore * Math.cos(a2) + arm.grip * Math.cos(a3),
  };
}

/**
 * SVG rotation for an arm rod. The far end of the rod is in the dalang's hand
 * below the stage, so rods aim back toward the body and stay closer to
 * vertical than the leaning puppet does.
 */
export function rodRotation(grip: Point, bodyRotation: number, handOffset: number): number {
  const dx = grip.x * 0.45 + handOffset - grip.x;
  const dy = 330 - grip.y;
  return Math.atan2(-dx, dy) / RAD - bodyRotation * 0.6;
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export interface RigTransforms {
  root: string;
  head: string;
  frontUpper: string;
  frontFore: string;
  frontHand: string;
  backUpper: string;
  backFore: string;
  frontFingers: string;
  backFingers: string;
  frontRod: string;
  backRod: string;
}

/** Converts a rig into SVG transform attributes for each articulated group. */
export function rigTransforms(side: Side, rig: PuppetRig): RigTransforms {
  const flip = facing(side);
  const frontGrip = armGripPoint(PUPPET.front, rig.shoulderAngle, rig.elbowAngle, rig.wristAngle);
  const backGrip = armGripPoint(PUPPET.back, rig.backShoulderAngle, rig.backElbowAngle, 0);
  const leanPivot = (PUPPET.leanY - PUPPET.pivotY) * rig.scale;
  return {
    root: `translate(${f(rig.x)} ${f(rig.y)}) rotate(${f(flip * rig.bodyRotation)} 0 ${f(leanPivot)}) scale(${f(flip * rig.scale)} ${f(rig.scale)}) translate(0 ${-PUPPET.pivotY})`,
    head: `rotate(${f(rig.headRotation)} ${PUPPET.neck.x} ${PUPPET.neck.y})`,
    // Rig angles are "forward positive"; in the right-facing artwork that is a counter-clockwise SVG rotation.
    frontUpper: `rotate(${f(-rig.shoulderAngle)})`,
    frontFore: `rotate(${f(-rig.elbowAngle)})`,
    frontHand: `rotate(${f(-rig.wristAngle)})`,
    backUpper: `rotate(${f(-rig.backShoulderAngle)})`,
    backFore: `rotate(${f(-rig.backElbowAngle)})`,
    frontFingers: `rotate(${f(-rig.frontFingerCurl)} ${PUPPET.knuckle.x} ${PUPPET.knuckle.y})`,
    backFingers: `rotate(${f(-rig.backFingerCurl)} ${PUPPET.knuckle.x} ${PUPPET.knuckle.y})`,
    frontRod: `translate(${f(frontGrip.x)} ${f(frontGrip.y)}) rotate(${f(rodRotation(frontGrip, rig.bodyRotation, 26))})`,
    backRod: `translate(${f(backGrip.x)} ${f(backGrip.y)}) rotate(${f(rodRotation(backGrip, rig.bodyRotation, -26))})`,
  };
}
