import type { TrackedHand } from "../tracking/HandTracker";
import { GestureClassifier } from "./GestureClassifier";
import type { GestureResult, GestureType } from "./GestureTypes";

export type GestureEventType =
  | "GESTURE_STARTED"
  | "GESTURE_ENDED";

export interface GestureEvent {
  type: GestureEventType;
  handedness: TrackedHand["handedness"];
  gesture: GestureType;
  confidence: number;
}

export interface HandGesture {
  handedness: TrackedHand["handedness"];
  result: GestureResult;
}

export interface GestureFrame {
  /** Mãos efetivamente detectadas no frame atual. */
  hands: HandGesture[];

  /** Gestos preservados durante perdas temporárias de detecção. */
  missingHands: HandGesture[];

  events: GestureEvent[];
}

interface HandHistory {
  handedness: TrackedHand["handedness"];
  candidate: GestureType;
  consecutiveFrames: number;
  missingFrames: number;
  stableResult: GestureResult;
  /** Última posição do pulso, usada para distinguir mãos com o mesmo rótulo. */
  lastWrist: { x: number; y: number } | null;
}

const REQUIRED_STABLE_FRAMES = 3;
const REQUIRED_PINCH_RELEASE_FRAMES = 3;
const MAX_MISSING_FRAMES = 5;
const UNMATCHED_COST = 10;

function wristOf(hand: TrackedHand): { x: number; y: number } | null {
  const wrist = hand.landmarks[0];

  return wrist ? { x: wrist.x, y: wrist.y } : null;
}

export class GestureEngine {
  private classifier: GestureClassifier;
  private history = new Map<string, HandHistory>();

  constructor() {
    this.classifier = new GestureClassifier();
  }

  process(hands: TrackedHand[]): GestureFrame {
    const activeHands = new Set<string>();
    const events: GestureEvent[] = [];
    const missingHands: HandGesture[] = [];

    const keys = this.assignHistoryKeys(hands);
    const activeLabels = new Set<string>(
      hands.map((hand) => hand.handedness)
    );

    const results = hands.map((hand, index) => {
      const key = keys[index];

      activeHands.add(key);

      let history = this.history.get(key);

      const current = this.classifier.classify(
        hand,
        history?.stableResult.gesture
      );

      if (!history) {
        history = {
          handedness: hand.handedness,
          candidate: current.gesture,
          consecutiveFrames: 1,
          missingFrames: 0,
          stableResult: {
            gesture: "UNKNOWN",
            confidence: 0,
          },
          lastWrist: null,
        };

        this.history.set(key, history);
      } else {
        history.missingFrames = 0;

        if (history.candidate === current.gesture) {
          history.consecutiveFrames++;
        } else {
          history.candidate = current.gesture;
          history.consecutiveFrames = 1;
        }
      }

      history.lastWrist = wristOf(hand);

      const previousGesture = history.stableResult.gesture;
      const previousConfidence = history.stableResult.confidence;

      const requiredFrames =
        previousGesture === "PINCH"
          ? REQUIRED_PINCH_RELEASE_FRAMES
          : REQUIRED_STABLE_FRAMES;

      if (history.consecutiveFrames >= requiredFrames) {
        history.stableResult = current;
      }

      const newGesture = history.stableResult.gesture;

      if (previousGesture !== newGesture) {
        if (previousGesture !== "UNKNOWN") {
          events.push({
            type: "GESTURE_ENDED",
            handedness: hand.handedness,
            gesture: previousGesture,
            confidence: previousConfidence,
          });
        }

        if (newGesture !== "UNKNOWN") {
          events.push({
            type: "GESTURE_STARTED",
            handedness: hand.handedness,
            gesture: newGesture,
            confidence: history.stableResult.confidence,
          });
        }
      }

      return {
        handedness: hand.handedness,
        result: history.stableResult,
      };
    });

    for (const [key, history] of this.history) {
      if (activeHands.has(key)) {
        continue;
      }

      history.missingFrames++;

      if (history.missingFrames <= MAX_MISSING_FRAMES) {
        // Uma trilha extra (mesmo rótulo de outra mão presente) não
        // representa uma mão ausente para os consumidores.
        const isSecondarySlot = key.includes("#");

        if (!(isSecondarySlot && activeLabels.has(history.handedness))) {
          missingHands.push({
            handedness: history.handedness,
            result: history.stableResult,
          });
        }

        continue;
      }

      const gesture = history.stableResult;

      if (gesture.gesture !== "UNKNOWN") {
        events.push({
          type: "GESTURE_ENDED",
          handedness: history.handedness,
          gesture: gesture.gesture,
          confidence: gesture.confidence,
        });
      }

      this.history.delete(key);
    }

    return {
      hands: results,
      missingHands,
      events,
    };
  }

  /**
   * Define a chave de histórico de cada mão.
   *
   * Mãos com rótulos distintos mantêm a chave igual ao rótulo
   * (comportamento original). Quando o MediaPipe atribui o mesmo
   * rótulo a mais de uma mão no mesmo frame, cada mão é associada
   * à trilha cujo último pulso está mais próximo, para que elas não
   * compartilhem o mesmo histórico.
   */
  private assignHistoryKeys(hands: TrackedHand[]): string[] {
    const keys: string[] = new Array(hands.length);
    const groups = new Map<string, number[]>();

    hands.forEach((hand, index) => {
      if (hand.handedness === "Unknown") {
        keys[index] = `Unknown-${index}`;
        return;
      }

      const group = groups.get(hand.handedness) ?? [];
      group.push(index);
      groups.set(hand.handedness, group);
    });

    for (const [label, indexes] of groups) {
      if (indexes.length === 1) {
        keys[indexes[0]] = label;
        continue;
      }

      const slots = indexes.map((_, slot) =>
        slot === 0 ? label : `${label}#${slot}`
      );

      const pairs: { hand: number; slot: number; cost: number }[] = [];

      indexes.forEach((handIndex, h) => {
        const wrist = wristOf(hands[handIndex]);

        slots.forEach((slotKey, slot) => {
          const previous = this.history.get(slotKey)?.lastWrist;

          pairs.push({
            hand: h,
            slot,
            cost:
              previous && wrist
                ? Math.hypot(wrist.x - previous.x, wrist.y - previous.y)
                : UNMATCHED_COST,
          });
        });
      });

      pairs.sort((a, b) => a.cost - b.cost || a.slot - b.slot || a.hand - b.hand);

      const handTaken = new Set<number>();
      const slotTaken = new Set<number>();

      for (const pair of pairs) {
        if (handTaken.has(pair.hand) || slotTaken.has(pair.slot)) continue;

        keys[indexes[pair.hand]] = slots[pair.slot];
        handTaken.add(pair.hand);
        slotTaken.add(pair.slot);
      }
    }

    return keys;
  }
}
