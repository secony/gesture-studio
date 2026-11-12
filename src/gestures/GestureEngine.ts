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
  hands: HandGesture[];
  events: GestureEvent[];
}

interface HandHistory {
  handedness: TrackedHand["handedness"];
  candidate: GestureType;
  consecutiveFrames: number;
  missingFrames: number;
  stableResult: GestureResult;
}

const REQUIRED_STABLE_FRAMES = 3;
const REQUIRED_PINCH_RELEASE_FRAMES = 3;
const MAX_MISSING_FRAMES = 5;

export class GestureEngine {
  private classifier: GestureClassifier;
  private history = new Map<string, HandHistory>();

  constructor() {
    this.classifier = new GestureClassifier();
  }

  process(hands: TrackedHand[]): GestureFrame {
    const activeHands = new Set<string>();
    const events: GestureEvent[] = [];

    const results = hands.map((hand, index) => {
      const key =
        hand.handedness === "Unknown"
          ? `Unknown-${index}`
          : hand.handedness;

      activeHands.add(key);

      let history = this.history.get(key);

      // A classificação recebe o último gesto estabilizado para aplicar
      // o limite de manutenção da pinça quando ela já está ativa.
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
      events,
    };
  }
}
