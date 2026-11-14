
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

type FingerState = "EXTENDED" | "CURLED" | "INDETERMINATE";

function distance(a: HandLandmark, b: HandLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function classifyFinger(
  landmarks: HandLandmark[],
  pip: number,
  tip: number,
  thresholds: GestureThresholds
): FingerState {
  const wrist = landmarks[0];

  const tipDistance = distance(wrist, landmarks[tip]);
  const pipDistance = distance(wrist, landmarks[pip]);

  if (tipDistance > pipDistance * thresholds.fingerExtended) {
    return "EXTENDED";
  }

  if (tipDistance < pipDistance * thresholds.fingerCurled) {
    return "CURLED";
  }

  return "INDETERMINATE";
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
      classifyFinger(landmarks, 6, 8, this.thresholds),
      classifyFinger(landmarks, 10, 12, this.thresholds),
      classifyFinger(landmarks, 14, 16, this.thresholds),
      classifyFinger(landmarks, 18, 20, this.thresholds),
    ];

    const extendedCount = fingerStates.filter(
      (state) => state === "EXTENDED"
    ).length;

    const curledCount = fingerStates.filter(
      (state) => state === "CURLED"
    ).length;

    const pinchDistance = distance(landmarks[4], landmarks[8]) / handScale;

    // Mantém a margem maior para uma pinça já reconhecida.
    if (
      pinchDistance <
      (previousGesture === "PINCH"
        ? this.thresholds.pinchRelease
        : this.thresholds.pinch)
    ) {
      const pinchThreshold =
        previousGesture === "PINCH"
          ? this.thresholds.pinchRelease
          : this.thresholds.pinch;

      return {
        gesture: "PINCH",
        confidence: Math.min(
          1,
          0.5 + (pinchThreshold - pinchDistance) / pinchThreshold
        ),
      };
    }

    // Uma mão aberta exige os quatro dedos estendidos.
    if (extendedCount === 4) {
      return {
        gesture: "OPEN_HAND",
        confidence: 1,
      };
    }

    // Um punho exige os quatro dedos efetivamente curvados.
    if (curledCount === 4) {
      return {
        gesture: "FIST",
        confidence: 0.9,
      };
    }

    // Combinações mistas ou posições ambíguas não são forçadas
    // para uma classificação específica.
    return {
      gesture: "UNKNOWN",
      confidence: 0.5,
    };
  }
}
