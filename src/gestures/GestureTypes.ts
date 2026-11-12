export type GestureType =
  | "OPEN_HAND"
  | "FIST"
  | "PINCH"
  | "UNKNOWN";

export interface GestureResult {
  gesture: GestureType;
  confidence: number;
}

export interface GestureThresholds {
  /** Distância normalizada máxima para iniciar uma pinça. */
  pinch: number;
  /** Distância normalizada máxima para manter uma pinça já ativa. */
  pinchRelease: number;
  fingerExtended: number;
  fingerCurled: number;
}
