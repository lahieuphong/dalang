import { SIDES, type AssignedHands, type HandDetection, type Point, type Side } from '../types';
import { clamp, distance2D, palmCenter } from './handMath';

/** A slot that saw its hand this recently is still considered "owned" by that hand. */
const RECENT_MS = 450;
/** Cost per unit of palm travel (normalized frame units) for continuing an existing track. */
const CONTINUITY_WEIGHT = 3.2;
/** Flat cost for starting a fresh track on an empty slot. */
const NEW_TRACK_COST = 0.55;
/** Sustained handedness disagreement above this moves a hand to the other puppet. */
const CORRECTION_THRESHOLD = 0.6;

interface SlotState {
  palm: Point | null;
  lastSeen: number;
  /** EMA of handedness evidence: +1 = the hand consistently looks like it belongs to the other slot. */
  disagreement: number;
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
  disagreement: number;
}

const emptySlot = (): SlotState => ({ palm: null, lastSeen: -Infinity, disagreement: 0 });
const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');

/**
 * Keeps each physical hand bound to the same puppet across frames.
 *
 * Per frame it picks the cheapest hand→puppet pairing, where the cost mixes
 * temporal continuity (distance from where that puppet's hand was), MediaPipe
 * handedness and a weak left/right screen prior. Continuity dominates while a
 * hand is being tracked, so crossing hands or a noisy handedness frame never
 * swaps puppets; handedness only re-routes a hand after it disagrees
 * consistently for a while (hysteresis).
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
      const slot = this.slots[side];
      const evidence =
        candidate.hand.naturalSide === null ? 0 : (candidate.hand.naturalSide === side ? -1 : 1) * candidate.certainty;
      slot.disagreement = slot.palm && now - slot.lastSeen < RECENT_MS ? slot.disagreement * 0.88 + evidence * 0.12 : 0;
      slot.palm = candidate.palm;
      slot.lastSeen = now;
    }

    this.correctIdentity(chosen, now);
    return { left: chosen.left?.hand ?? null, right: chosen.right?.hand ?? null };
  }

  debugState(now: number): Record<Side, SlotDebug> {
    const describe = (slot: SlotState): SlotDebug => ({
      palm: slot.palm,
      ageMs: now - slot.lastSeen,
      disagreement: slot.disagreement,
    });
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

    if (candidate.hand.naturalSide !== null && candidate.hand.naturalSide !== side) {
      cost += (recent ? 0.12 : 0.6) * candidate.certainty;
    }

    // Weak prior: the left puppet's hand tends to live on the left of the frame.
    const distanceFromOwnEdge = side === 'left' ? candidate.palm.x : 1 - candidate.palm.x;
    cost += distanceFromOwnEdge * (recent ? 0.05 : 0.25);
    return cost;
  }

  /** Re-routes hands whose handedness has disagreed with their puppet for a sustained period. */
  private correctIdentity(chosen: Record<Side, Candidate | null>, now: number) {
    const leftWrong = chosen.left !== null && this.slots.left.disagreement > CORRECTION_THRESHOLD;
    const rightWrong = chosen.right !== null && this.slots.right.disagreement > CORRECTION_THRESHOLD;

    if (leftWrong && rightWrong) {
      [chosen.left, chosen.right] = [chosen.right, chosen.left];
      [this.slots.left, this.slots.right] = [this.slots.right, this.slots.left];
      this.slots.left.disagreement = 0;
      this.slots.right.disagreement = 0;
      return;
    }

    for (const side of SIDES) {
      const wrong = side === 'left' ? leftWrong : rightWrong;
      const target = other(side);
      if (!wrong || chosen[target] !== null || this.isRecent(target, now)) continue;
      chosen[target] = chosen[side];
      chosen[side] = null;
      this.slots[target] = { palm: this.slots[side].palm, lastSeen: now, disagreement: 0 };
      this.slots[side] = emptySlot();
    }
  }
}
