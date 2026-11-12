import { describe, expect, it } from "vitest";
import { GestureEngine } from "../../src/gestures/GestureEngine";
import type { HandLandmark, TrackedHand } from "../../src/tracking/HandTracker";

function createLandmarks(): HandLandmark[] {
  return Array.from({ length: 21 }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
}

function createOpenHand(): TrackedHand {
  const landmarks = createLandmarks();

  landmarks[9] = { x: 0, y: 1, z: 0 };

  const fingers = [
    { pip: 6, tip: 8 },
    { pip: 10, tip: 12 },
    { pip: 14, tip: 16 },
    { pip: 18, tip: 20 },
  ];

  for (const finger of fingers) {
    landmarks[finger.pip] = { x: 0, y: 1, z: 0 };
    landmarks[finger.tip] = { x: 0, y: 2, z: 0 };
  }

  landmarks[4] = { x: -0.5, y: 0.5, z: 0 };

  return {
    landmarks,
    handedness: "Right",
  };
}

function createFist(): TrackedHand {
  const landmarks = createLandmarks();

  landmarks[9] = { x: 0, y: 1, z: 0 };

  const fingers = [
    { pip: 6, tip: 8 },
    { pip: 10, tip: 12 },
    { pip: 14, tip: 16 },
    { pip: 18, tip: 20 },
  ];

  for (const finger of fingers) {
    landmarks[finger.pip] = { x: 0, y: 1, z: 0 };
    landmarks[finger.tip] = { x: 0, y: 0.5, z: 0 };
  }

  landmarks[4] = { x: 0.5, y: 0.5, z: 0 };

  return {
    landmarks,
    handedness: "Right",
  };
}

function createPinch(): TrackedHand {
  const hand = createOpenHand();

  hand.landmarks[4] = { x: 0.01, y: 2, z: 0 };

  return hand;
}

function createHandAtPinchDistance(normalizedDistance: number): TrackedHand {
  const hand = createOpenHand();

  // A escala da mão é 1, então esta distância corresponde ao valor normalizado.
  hand.landmarks[4] = {
    x: normalizedDistance,
    y: 2,
    z: 0,
  };

  return hand;
}

describe("GestureEngine", () => {
    it("deve preservar uma pinça durante até 5 frames sem detectar a mão", () => {
    const engine = new GestureEngine();
    const pinch = createPinch();

    engine.process([pinch]);
    engine.process([pinch]);

    const pinchStarted = engine.process([pinch]);

    expect(pinchStarted.hands[0].result.gesture).toBe("PINCH");

    for (let index = 0; index < 5; index++) {
      const frame = engine.process([]);

      expect(frame.hands).toHaveLength(0);
      expect(frame.missingHands).toEqual([
        expect.objectContaining({
          handedness: "Right",
          result: expect.objectContaining({
            gesture: "PINCH",
          }),
        }),
      ]);

      expect(frame.events).toHaveLength(0);
    }

    const recoveredFrame = engine.process([pinch]);

    expect(recoveredFrame.hands[0].result.gesture).toBe("PINCH");
    expect(recoveredFrame.missingHands).toHaveLength(0);
    expect(recoveredFrame.events).toHaveLength(0);
  });

  it("deve encerrar a pinça e remover o gesto preservado após 6 frames ausentes", () => {
    const engine = new GestureEngine();
    const pinch = createPinch();

    engine.process([pinch]);
    engine.process([pinch]);
    engine.process([pinch]);

    for (let index = 0; index < 5; index++) {
      engine.process([]);
    }

    const sixthMissingFrame = engine.process([]);

    expect(sixthMissingFrame.missingHands).toHaveLength(0);

    expect(sixthMissingFrame.events).toEqual([
      expect.objectContaining({
        type: "GESTURE_ENDED",
        gesture: "PINCH",
        handedness: "Right",
      }),
    ]);
  });
  it("deve estabilizar um gesto após 3 frames consecutivos", () => {
    const engine = new GestureEngine();
    const hand = createOpenHand();

    const firstFrame = engine.process([hand]);
    const secondFrame = engine.process([hand]);
    const thirdFrame = engine.process([hand]);

    expect(firstFrame.hands[0].result.gesture).toBe("UNKNOWN");
    expect(firstFrame.events).toHaveLength(0);

    expect(secondFrame.hands[0].result.gesture).toBe("UNKNOWN");
    expect(secondFrame.events).toHaveLength(0);

    expect(thirdFrame.hands[0].result.gesture).toBe("OPEN_HAND");

    expect(thirdFrame.events).toEqual([
      expect.objectContaining({
        type: "GESTURE_STARTED",
        gesture: "OPEN_HAND",
        handedness: "Right",
      }),
    ]);
  });

  it("deve exigir 3 frames para confirmar a mudança de gesto", () => {
    const engine = new GestureEngine();
    const openHand = createOpenHand();
    const fist = createFist();

    engine.process([openHand]);
    engine.process([openHand]);
    engine.process([openHand]);

    const firstFistFrame = engine.process([fist]);
    const secondFistFrame = engine.process([fist]);
    const thirdFistFrame = engine.process([fist]);

    expect(firstFistFrame.hands[0].result.gesture).toBe("OPEN_HAND");
    expect(firstFistFrame.events).toHaveLength(0);

    expect(secondFistFrame.hands[0].result.gesture).toBe("OPEN_HAND");
    expect(secondFistFrame.events).toHaveLength(0);

    expect(thirdFistFrame.hands[0].result.gesture).toBe("FIST");

    expect(thirdFistFrame.events.map((event) => event.type)).toEqual([
      "GESTURE_ENDED",
      "GESTURE_STARTED",
    ]);

    expect(thirdFistFrame.events.map((event) => event.gesture)).toEqual([
      "OPEN_HAND",
      "FIST",
    ]);
  });

  it("deve exigir 3 frames para liberar uma pinça", () => {
    const engine = new GestureEngine();
    const pinch = createPinch();
    const openHand = createOpenHand();

    engine.process([pinch]);
    engine.process([pinch]);

    const pinchStarted = engine.process([pinch]);

    expect(pinchStarted.hands[0].result.gesture).toBe("PINCH");

    const releaseFrames = [];

    for (let index = 0; index < 3; index++) {
      releaseFrames.push(engine.process([openHand]));
    }

    for (let index = 0; index < 2; index++) {
      expect(releaseFrames[index].hands[0].result.gesture).toBe("PINCH");
      expect(releaseFrames[index].events).toHaveLength(0);
    }

    expect(releaseFrames[2].hands[0].result.gesture).toBe("OPEN_HAND");

    expect(releaseFrames[2].events.map((event) => event.type)).toEqual([
      "GESTURE_ENDED",
      "GESTURE_STARTED",
    ]);
  });

  it("deve manter a pinça estável quando a distância oscila entre os limites", () => {
    const engine = new GestureEngine();

    engine.process([createPinch()]);
    engine.process([createPinch()]);
    const pinchStarted = engine.process([createPinch()]);

    expect(pinchStarted.hands[0].result.gesture).toBe("PINCH");

    const oscillatingDistances = [0.36, 0.39, 0.37, 0.41, 0.38, 0.40];

    for (const distance of oscillatingDistances) {
      const frame = engine.process([createHandAtPinchDistance(distance)]);

      expect(frame.hands[0].result.gesture).toBe("PINCH");
      expect(frame.events).toHaveLength(0);
    }
  });

  it("deve tolerar até 5 frames sem detectar a mão", () => {
    const engine = new GestureEngine();
    const hand = createOpenHand();

    engine.process([hand]);
    engine.process([hand]);
    engine.process([hand]);

    for (let index = 0; index < 5; index++) {
      const frame = engine.process([]);

      expect(frame.events).toHaveLength(0);
    }

    const recoveredFrame = engine.process([hand]);

    expect(recoveredFrame.hands[0].result.gesture).toBe("OPEN_HAND");
    expect(recoveredFrame.events).toHaveLength(0);
  });

  it("deve encerrar o gesto após mais de 5 frames sem detectar a mão", () => {
    const engine = new GestureEngine();
    const hand = createOpenHand();

    engine.process([hand]);
    engine.process([hand]);
    engine.process([hand]);

    for (let index = 0; index < 5; index++) {
      engine.process([]);
    }

    const sixthMissingFrame = engine.process([]);

    expect(sixthMissingFrame.events).toEqual([
      expect.objectContaining({
        type: "GESTURE_ENDED",
        gesture: "OPEN_HAND",
        handedness: "Right",
      }),
    ]);
  });

  it("deve exigir nova estabilização quando a mão retorna após ser removida do histórico", () => {
    const engine = new GestureEngine();
    const hand = createOpenHand();

    engine.process([hand]);
    engine.process([hand]);
    engine.process([hand]);

    for (let index = 0; index < 6; index++) {
      engine.process([]);
    }

    const firstFrame = engine.process([hand]);
    const secondFrame = engine.process([hand]);
    const thirdFrame = engine.process([hand]);

    expect(firstFrame.hands[0].result.gesture).toBe("UNKNOWN");
    expect(secondFrame.hands[0].result.gesture).toBe("UNKNOWN");
    expect(thirdFrame.hands[0].result.gesture).toBe("OPEN_HAND");

    expect(thirdFrame.events).toHaveLength(1);
    expect(thirdFrame.events[0].type).toBe("GESTURE_STARTED");
  });
});
