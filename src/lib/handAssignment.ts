import { SIDES, type AssignedHands, type HandDetection, type Point, type Side } from '../types';
import { clamp, distance2D, palmCenter } from './handMath';

/** A slot that saw its hand this recently is still considered "owned" by that hand. */
const RECENT_MS = 450;
/** Cost per unit of palm travel (normalized frame units) for continuing an existing track. */
const CONTINUITY_WEIGHT = 3.2;
/** Flat cost for starting a fresh track on an empty slot. */
const NEW_TRACK_COST = 0.55;
/**
 * Screen side is the main signal for a new hand: like a mirror, a hand on the
 * right of the preview takes the puppet on the right of the stage.
 */
const SCREEN_SIDE_WEIGHT = 1.2;
/** Handedness only breaks ties for hands near the middle of the frame. */
const HANDEDNESS_WEIGHT = 0.25;

interface SlotState {
  palm: Point | null;
  lastSeen: number;
}

interface Candidate {
  hand: HandDetection;
  palm: Point;
  /** 0..1 confidence of the handedness label. */
  certainty: number;
}

export interface SlotDebug {
  palm: Point | null;
  ageMs: number;
}

const emptySlot = (): SlotState => ({ palm: null, lastSeen: -Infinity });

/**
 * Keeps each physical hand bound to the same puppet across frames.
 *
 * A newly raised hand goes to the puppet on its side of the (mirrored)
 * preview, so raising your right hand moves the puppet on the right of the
 * screen; MediaPipe handedness only settles hands right in the middle. Once a
 * hand is tracked, continuity (distance from where that puppet's hand was)
 * dominates, so crossing hands or a noisy frame never swaps puppets.
 */
export class HandAssigner {
  private slots: Record<Side, SlotState> = { left: emptySlot(), right: emptySlot() };

  reset() {
    this.slots = { left: emptySlot(), right: emptySlot() };
  }

  assign(hands: HandDetection[], now: number): AssignedHands {
    const candidates: Candidate[] = hands.slice(0, 2).map((hand) => ({
      hand,
      palm: palmCenter(hand.landmarks),
      certainty: clamp((hand.handednessScore - 0.5) * 2, 0, 1),
    }));

    const chosen: Record<Side, Candidate | null> = { left: null, right: null };
    if (candidates.length === 2) {
      const [a, b] = candidates;
      const straight = this.cost(a, 'left', now) + this.cost(b, 'right', now);
      const crossed = this.cost(a, 'right', now) + this.cost(b, 'left', now);
      chosen.left = straight <= crossed ? a : b;
      chosen.right = straight <= crossed ? b : a;
    } else if (candidates.length === 1) {
      const [a] = candidates;
      chosen[this.cost(a, 'left', now) <= this.cost(a, 'right', now) ? 'left' : 'right'] = a;
    }

    for (const side of SIDES) {
      const candidate = chosen[side];
      if (!candidate) continue;
      this.slots[side] = { palm: candidate.palm, lastSeen: now };
    }

    return { left: chosen.left?.hand ?? null, right: chosen.right?.hand ?? null };
  }

  debugState(now: number): Record<Side, SlotDebug> {
    const describe = (slot: SlotState): SlotDebug => ({ palm: slot.palm, ageMs: now - slot.lastSeen });
    return { left: describe(this.slots.left), right: describe(this.slots.right) };
  }

  private isRecent(side: Side, now: number) {
    const slot = this.slots[side];
    return slot.palm !== null && now - slot.lastSeen < RECENT_MS;
  }

  private cost(candidate: Candidate, side: Side, now: number): number {
    const slot = this.slots[side];
    const recent = this.isRecent(side, now);
    let cost = recent && slot.palm ? distance2D(candidate.palm, slot.palm) * CONTINUITY_WEIGHT : NEW_TRACK_COST;

    // 0 at the puppet's own edge of the preview, 1 at the opposite edge.
    const distanceFromOwnEdge = side === 'left' ? candidate.palm.x : 1 - candidate.palm.x;
    cost += distanceFromOwnEdge * (recent ? 0.05 : SCREEN_SIDE_WEIGHT);

    if (candidate.hand.naturalSide !== null && candidate.hand.naturalSide !== side) {
      cost += (recent ? 0.1 : HANDEDNESS_WEIGHT) * candidate.certainty;
    }
    return cost;
  }
}
