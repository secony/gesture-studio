
import type { GestureEvent } from "../gestures/GestureEngine";

export type InteractionAction =
  | "ACTIVATE_MODE"
  | "SELECT"
  | "CANCEL"
  | "NONE";

export interface InteractionResult {
  action: InteractionAction;
  handedness: GestureEvent["handedness"];
  sourceGesture: GestureEvent["gesture"];
}
