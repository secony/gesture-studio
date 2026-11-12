
import { describe, expect, it } from "vitest";
import { InteractionEngine } from "../../src/interaction/InteractionEngine";
import type { GestureEvent } from "../../src/gestures/GestureEngine";

function createEvent(
  gesture: GestureEvent["gesture"],
  type: GestureEvent["type"] = "GESTURE_STARTED",
  handedness: GestureEvent["handedness"] = "Right"
): GestureEvent {
  return {
    type,
    gesture,
    handedness,
    confidence: 1,
  };
}

describe("InteractionEngine", () => {
  const engine = new InteractionEngine();

  it("deve converter OPEN_HAND em ACTIVATE_MODE", () => {
    const result = engine.process(createEvent("OPEN_HAND"));

    expect(result).toEqual({
      action: "ACTIVATE_MODE",
      handedness: "Right",
      sourceGesture: "OPEN_HAND",
    });
  });

  it("deve converter PINCH em SELECT", () => {
    const result = engine.process(createEvent("PINCH"));

    expect(result).toEqual({
      action: "SELECT",
      handedness: "Right",
      sourceGesture: "PINCH",
    });
  });

  it("deve converter FIST em CANCEL", () => {
    const result = engine.process(createEvent("FIST"));

    expect(result).toEqual({
      action: "CANCEL",
      handedness: "Right",
      sourceGesture: "FIST",
    });
  });

  it("não deve produzir ação para GESTURE_ENDED", () => {
    const gestures = ["OPEN_HAND", "PINCH", "FIST"] as const;

    for (const gesture of gestures) {
      const result = engine.process(
        createEvent(gesture, "GESTURE_ENDED")
      );

      expect(result).toBeNull();
    }
  });

  it("deve preservar a identificação da mão esquerda", () => {
    const result = engine.process(
      createEvent("PINCH", "GESTURE_STARTED", "Left")
    );

    expect(result?.handedness).toBe("Left");
    expect(result?.action).toBe("SELECT");
  });

  it("deve preservar o gesto de origem na interação", () => {
    const result = engine.process(createEvent("FIST"));

    expect(result?.sourceGesture).toBe("FIST");
  });
});

