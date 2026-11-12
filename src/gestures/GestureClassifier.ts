import type { HandLandmark, TrackedHand } from "../tracking/HandTracker";
import type {
  GestureResult,
  GestureThresholds,
  GestureType,
} from "./GestureTypes";

const DEFAULT_THRESHOLDS: GestureThresholds = {
  pinch: 0.35,
  pinchRelease: 0.42,
  fingerExtended: 1.1,
  fingerCurled: 1.05,
};

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function isFingerExtended(
  landmarks: HandLandmark[],
  pip: number,
  tip: number,
  threshold: number
): boolean {
  const wrist = landmarks[0];

  const tipDistance = distance(wrist, landmarks[tip]);
  const pipDistance = distance(wrist, landmarks[pip]);

  return tipDistance > pipDistance * threshold;
}

export class GestureClassifier {
  private thresholds: GestureThresholds;

  constructor(thresholds: GestureThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  classify(
    hand: TrackedHand,
    previousGesture: GestureType = "UNKNOWN"
  ): GestureResult {
    const landmarks = hand.landmarks;

    if (landmarks.length !== 21) {
      return { gesture: "UNKNOWN", confidence: 0 };
    }

    const handScale = distance(landmarks[0], landmarks[9]);

    if (handScale < 0.001) {
      return { gesture: "UNKNOWN", confidence: 0 };
    }

    const fingerStates = [
      isFingerExtended(landmarks, 6, 8, this.thresholds.fingerExtended),
      isFingerExtended(landmarks, 10, 12, this.thresholds.fingerExtended),
      isFingerExtended(landmarks, 14, 16, this.thresholds.fingerExtended),
      isFingerExtended(landmarks, 18, 20, this.thresholds.fingerExtended),
    ];

    const extendedCount = fingerStates.filter(Boolean).length;
    const pinchDistance = distance(landmarks[4], landmarks[8]) / handScale;

    // Usa uma margem maior para manter uma pinça já reconhecida.
    // Isso evita alternância rápida quando a distância oscila perto do limite.
    const pinchThreshold =
      previousGesture === "PINCH"
        ? this.thresholds.pinchRelease
        : this.thresholds.pinch;

    if (pinchDistance < pinchThreshold) {
      return {
        gesture: "PINCH",
        confidence: Math.min(
          1,
          0.5 + (pinchThreshold - pinchDistance) / pinchThreshold
        ),
      };
    }

    // Só considera punho fechado quando nenhum dedo está estendido
    // e o polegar não está próximo do indicador.
    if (extendedCount === 0) {
      return {
        gesture: "FIST",
        confidence: 0.9,
      };
    }

    if (extendedCount === 4) {
      return { gesture: "OPEN_HAND", confidence: 1 };
    }

    return { gesture: "UNKNOWN", confidence: 0.5 };
  }
}
