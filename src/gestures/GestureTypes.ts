
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
  pinch: number;
  fingerExtended: number;
  fingerCurled: number;
}
