
import { describe, expect, it } from "vitest";
import { GestureClassifier } from "../../src/gestures/GestureClassifier";
import type { HandLandmark, TrackedHand } from "../../src/tracking/HandTracker";

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

function createHandWithFingerRatios(ratios: number[]): TrackedHand {
  const landmarks = createLandmarks();

  landmarks[9] = { x: 0, y: 1, z: 0 };

  const fingers = [
    { pip: 6, tip: 8 },
    { pip: 10, tip: 12 },
    { pip: 14, tip: 16 },
    { pip: 18, tip: 20 },
  ];

  fingers.forEach((finger, index) => {
    landmarks[finger.pip] = { x: 0, y: 1, z: 0 };
    landmarks[finger.tip] = {
      x: 0,
      y: ratios[index],
      z: 0,
    };
  });

  // Mantém o polegar distante do indicador para não ativar PINCH.
  landmarks[4] = { x: 2, y: 2, z: 0 };

  return createHand(landmarks);
}

function createOpenHand(): TrackedHand {
  return createHandWithFingerRatios([2, 2, 2, 2]);
}

function createFist(): TrackedHand {
  return createHandWithFingerRatios([0.5, 0.5, 0.5, 0.5]);
}

function createPinch(): TrackedHand {
  const hand = createOpenHand();

  hand.landmarks[4] = {
    x: 0.01,
    y: 2,
    z: 0,
  };

  return hand;
}

function createHandAtPinchDistance(normalizedDistance: number): TrackedHand {
  const hand = createOpenHand();

  hand.landmarks[4] = {
    x: normalizedDistance,
    y: 2,
    z: 0,
  };

  return hand;
}

function createUnknown(): TrackedHand {
  return createHandWithFingerRatios([1.2, 1.05, 1.05, 1.05]);
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

  it("deve manter uma pinça ativa até o limite de soltura", () => {
    const result = classifier.classify(
      createHandAtPinchDistance(0.38),
      "PINCH"
    );

    expect(result.gesture).toBe("PINCH");
  });

  it("não deve iniciar uma pinça fora do limite de entrada", () => {
    const result = classifier.classify(
      createHandAtPinchDistance(0.38),
      "UNKNOWN"
    );

    expect(result.gesture).toBe("OPEN_HAND");
  });

  it("deve liberar a pinça quando ultrapassar o limite de soltura", () => {
    const result = classifier.classify(
      createHandAtPinchDistance(0.43),
      "PINCH"
    );

    expect(result.gesture).toBe("OPEN_HAND");
  });

  it("deve retornar UNKNOWN para dedos em posições intermediárias", () => {
    const result = classifier.classify(createUnknown());

    expect(result.gesture).toBe("UNKNOWN");
    expect(result.confidence).toBe(0.5);
  });

  it("não deve reconhecer punho quando existe um dedo estendido", () => {
    const result = classifier.classify(
      createHandWithFingerRatios([2, 0.5, 0.5, 0.5])
    );

    expect(result.gesture).toBe("UNKNOWN");
  });

  it("não deve reconhecer mão aberta quando existe um dedo curvado", () => {
    const result = classifier.classify(
      createHandWithFingerRatios([2, 2, 2, 0.5])
    );

    expect(result.gesture).toBe("UNKNOWN");
  });

  it("deve retornar UNKNOWN quando existe um dedo indeterminado", () => {
    const result = classifier.classify(
      createHandWithFingerRatios([2, 2, 1.07, 2])
    );

    expect(result.gesture).toBe("UNKNOWN");
  });

  it("deve retornar UNKNOWN para combinações mistas de dedos", () => {
    const result = classifier.classify(
      createHandWithFingerRatios([2, 0.5, 2, 0.5])
    );

    expect(result.gesture).toBe("UNKNOWN");
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
    const result = classifier.classify(createHand(createLandmarks()));

    expect(result).toEqual({
      gesture: "UNKNOWN",
      confidence: 0,
    });
  });
});
