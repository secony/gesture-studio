
import type { GestureEvent } from "../gestures/GestureEngine";
import type { InteractionResult } from "./InteractionTypes";

export class InteractionEngine {
  process(event: GestureEvent): InteractionResult | null {
    if (event.type !== "GESTURE_STARTED") {
      return null;
    }

    let action: InteractionResult["action"] = "NONE";

    switch (event.gesture) {
      case "OPEN_HAND":
        action = "ACTIVATE_MODE";
        break;

      case "PINCH":
        action = "SELECT";
        break;

      case "FIST":
        action = "CANCEL";
        break;

      default:
        action = "NONE";
    }

    return {
      action,
      handedness: event.handedness,
      sourceGesture: event.gesture,
    };
  }
}
