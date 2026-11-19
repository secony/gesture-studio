import { describe, expect, it } from "vitest";
import { GestureEngine } from "../../src/gestures/GestureEngine";
import type {
  Handedness,
  TrackedHand,
} from "../../src/tracking/HandTracker";

/**
 * Mão sintética com o pulso em (offsetX, 0). A geometria é a mesma
 * dos demais testes do GestureEngine, apenas deslocada no eixo X.
 */
function createHand(
  kind: "OPEN" | "FIST",
  handedness: Handedness,
  offsetX: number
): TrackedHand {
  const landmarks = Array.from({ length: 21 }, () => ({
    x: offsetX,
    y: 0,
    z: 0,
  }));

  landmarks[9] = { x: offsetX, y: 1, z: 0 };

  for (const [pip, tip] of [
    [6, 8],
    [10, 12],
    [14, 16],
    [18, 20],
  ]) {
    landmarks[pip] = { x: offsetX, y: 1, z: 0 };
    landmarks[tip] = {
      x: offsetX,
      y: kind === "OPEN" ? 2 : 0.5,
      z: 0,
    };
  }

  landmarks[4] = {
    x: offsetX + (kind === "OPEN" ? -0.5 : 0.5),
    y: 0.5,
    z: 0,
  };

  return { landmarks, handedness };
}

function run(
  engine: GestureEngine,
  frames: number,
  build: (frame: number) => TrackedHand[]
) {
  let last = engine.process(build(0));
  const events = [...last.events];

  for (let frame = 1; frame < frames; frame++) {
    last = engine.process(build(frame));
    events.push(...last.events);
  }

  return { last, events };
}

describe("GestureEngine com rótulos de lateralidade duplicados", () => {
  it("mantém gestos independentes para duas mãos com o mesmo rótulo", () => {
    const engine = new GestureEngine();

    const { last, events } = run(engine, 6, () => [
      createHand("OPEN", "Right", 0.2),
      createHand("FIST", "Right", 0.8),
    ]);

    expect(last.hands.map((hand) => hand.result.gesture)).toEqual([
      "OPEN_HAND",
      "FIST",
    ]);

    expect(
      events.filter((event) => event.type === "GESTURE_STARTED")
    ).toHaveLength(2);
  });

  it("não encurta o debounce quando duas mãos compartilham o rótulo", () => {
    const engine = new GestureEngine();

    const frames = [0, 1].map(() =>
      engine.process([
        createHand("OPEN", "Right", 0.2),
        createHand("OPEN", "Right", 0.8),
      ])
    );

    // Com 2 frames ainda não há estabilização (exige 3).
    expect(frames[1].hands.map((hand) => hand.result.gesture)).toEqual([
      "UNKNOWN",
      "UNKNOWN",
    ]);
  });

  it("não troca os históricos quando a ordem do array muda", () => {
    const engine = new GestureEngine();

    run(engine, 5, () => [
      createHand("OPEN", "Right", 0.2),
      createHand("FIST", "Right", 0.8),
    ]);

    const swapped = engine.process([
      createHand("FIST", "Right", 0.8),
      createHand("OPEN", "Right", 0.2),
    ]);

    expect(swapped.hands.map((hand) => hand.result.gesture)).toEqual([
      "FIST",
      "OPEN_HAND",
    ]);

    expect(swapped.events).toHaveLength(0);
  });

  it("não reporta a trilha extra como mão ausente enquanto o rótulo está presente", () => {
    const engine = new GestureEngine();

    run(engine, 5, () => [
      createHand("OPEN", "Right", 0.2),
      createHand("OPEN", "Right", 0.8),
    ]);

    const frame = engine.process([createHand("OPEN", "Right", 0.2)]);

    expect(frame.hands).toHaveLength(1);
    expect(frame.missingHands).toHaveLength(0);
  });

  it("encerra a trilha extra após a tolerância de perda", () => {
    const engine = new GestureEngine();

    run(engine, 5, () => [
      createHand("OPEN", "Right", 0.2),
      createHand("OPEN", "Right", 0.8),
    ]);

    const { events } = run(engine, 7, () => [
      createHand("OPEN", "Right", 0.2),
    ]);

    expect(
      events.filter((event) => event.type === "GESTURE_ENDED")
    ).toHaveLength(1);
  });

  it("preserva o comportamento com rótulos distintos", () => {
    const engine = new GestureEngine();

    const { last } = run(engine, 5, () => [
      createHand("OPEN", "Right", 0.2),
      createHand("FIST", "Left", 0.8),
    ]);

    expect(
      last.hands.map((hand) => `${hand.handedness}:${hand.result.gesture}`)
    ).toEqual(["Right:OPEN_HAND", "Left:FIST"]);
  });
});
