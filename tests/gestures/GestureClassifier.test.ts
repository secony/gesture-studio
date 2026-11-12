
import { describe, expect, it } from "vitest";
import { GestureClassifier } from "../../src/gestures/GestureClassifier";
import type { HandLandmark } from "../../src/tracking/HandTracker";
import type { TrackedHand } from "../../src/tracking/HandTracker";

function createHand(landmarks: HandLandmark[]): TrackedHand {
  return {
    landmarks,
    handedness: "Right",
  };
}

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
  landmarks[8] = { x: 0, y: 2, z: 0 };

  return createHand(landmarks);
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

  return createHand(landmarks);
}

function createPinch(): TrackedHand {
  const hand = createOpenHand();

  hand.landmarks[4] = { x: 0.01, y: 2, z: 0 };
  hand.landmarks[8] = { x: 0, y: 2, z: 0 };

  return hand;
}


function createUnknown(): TrackedHand {
  const landmarks = createLandmarks();

  landmarks[9] = { x: 0, y: 1, z: 0 };

  // Indicador parcialmente estendido.
  landmarks[6] = { x: 0, y: 1, z: 0 };
  landmarks[8] = { x: 0, y: 1.2, z: 0 };

  // Demais dedos dobrados.
  landmarks[10] = { x: 0, y: 1, z: 0 };
  landmarks[12] = { x: 0, y: 1.05, z: 0 };

  landmarks[14] = { x: 0, y: 1, z: 0 };
  landmarks[16] = { x: 0, y: 1.05, z: 0 };

  landmarks[18] = { x: 0, y: 1, z: 0 };
  landmarks[20] = { x: 0, y: 1.05, z: 0 };

  landmarks[4] = { x: 0.5, y: 0.5, z: 0 };

  return createHand(landmarks);
}


describe("GestureClassifier", () => {
  const classifier = new GestureClassifier();

  it("deve reconhecer uma mão aberta", () => {
    const result = classifier.classify(createOpenHand());

    expect(result.gesture).toBe("OPEN_HAND");
    expect(result.confidence).toBe(1);
  });

  it("deve reconhecer um punho fechado", () => {
    const result = classifier.classify(createFist());

    expect(result.gesture).toBe("FIST");
    expect(result.confidence).toBe(0.9);
  });

  it("deve reconhecer uma pinça", () => {
    const result = classifier.classify(createPinch());

    expect(result.gesture).toBe("PINCH");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("deve retornar UNKNOWN para uma posição intermediária", () => {
    const result = classifier.classify(createUnknown());

    expect(result.gesture).toBe("UNKNOWN");
    expect(result.confidence).toBe(0.5);
  });

  it("deve retornar UNKNOWN quando a quantidade de landmarks for inválida", () => {
    const result = classifier.classify(
      createHand(createLandmarks().slice(0, 10))
    );

    expect(result).toEqual({
      gesture: "UNKNOWN",
      confidence: 0,
    });
  });

  it("deve retornar UNKNOWN quando a escala da mão for praticamente nula", () => {
    const landmarks = createLandmarks();

    const result = classifier.classify(createHand(landmarks));

    expect(result).toEqual({
      gesture: "UNKNOWN",
      confidence: 0,
    });
  });
});
