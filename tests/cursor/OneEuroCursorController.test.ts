
import { describe, expect, it } from "vitest";
import { OneEuroCursorController } from "../../src/cursor/OneEuroCursorController";
import type { HandLandmark } from "../../src/tracking/HandTracker";

function createLandmark(
  x: number,
  y: number,
  z = 0
): HandLandmark {
  return { x, y, z };
}

describe("OneEuroCursorController", () => {
  it("deve inicializar o cursor na posição do landmark", () => {
    const controller = new OneEuroCursorController();

    const result = controller.update(
      createLandmark(0.4, 0.6),
      1000
    );

    expect(result).toEqual({ x: 0.4, y: 0.6 });
  });

  it("deve filtrar X e Y independentemente", () => {
    const controller = new OneEuroCursorController({
      minCutoff: 1,
      beta: 0,
    });

    controller.update(createLandmark(0.2, 0.3), 1000);

    const result = controller.update(
      createLandmark(0.8, 0.3),
      1016
    );

    expect(result.x).toBeGreaterThan(0.2);
    expect(result.x).toBeLessThan(0.8);
    expect(result.y).toBeCloseTo(0.3);
  });

  it("deve limitar coordenadas abaixo de zero", () => {
    const controller = new OneEuroCursorController();

    expect(
      controller.update(createLandmark(-0.5, -1), 1000)
    ).toEqual({ x: 0, y: 0 });
  });

  it("deve limitar coordenadas acima de um", () => {
    const controller = new OneEuroCursorController();

    expect(
      controller.update(createLandmark(1.5, 2), 1000)
    ).toEqual({ x: 1, y: 1 });
  });

  it("deve rejeitar coordenadas NaN", () => {
    const controller = new OneEuroCursorController();

    expect(() =>
      controller.update(createLandmark(Number.NaN, 0.5), 1000)
    ).toThrow();
  });

  it("deve rejeitar timestamps não finitos", () => {
    const controller = new OneEuroCursorController();

    expect(() =>
      controller.update(createLandmark(0.5, 0.5), Number.NaN)
    ).toThrow();
  });

  it("deve rejeitar timestamps repetidos ou regressivos", () => {
    const controller = new OneEuroCursorController();

    controller.update(createLandmark(0.2, 0.2), 1000);

    expect(() =>
      controller.update(createLandmark(0.3, 0.3), 1000)
    ).toThrow();

    expect(() =>
      controller.update(createLandmark(0.3, 0.3), 999)
    ).toThrow();
  });

  it("deve reinicializar os filtros após reset", () => {
    const controller = new OneEuroCursorController();

    controller.update(createLandmark(0.2, 0.3), 1000);
    controller.update(createLandmark(0.8, 0.9), 1016);

    controller.reset();

    expect(
      controller.update(createLandmark(0.7, 0.6), 2000)
    ).toEqual({ x: 0.7, y: 0.6 });
  });

  it("deve retornar uma nova posição sem expor estado interno", () => {
    const controller = new OneEuroCursorController();

    const first = controller.update(
      createLandmark(0.4, 0.6),
      1000
    );

    first.x = 0.9;
    first.y = 0.9;

    const second = controller.update(
      createLandmark(0.4, 0.6),
      1016
    );

    expect(second).toEqual({ x: 0.4, y: 0.6 });
  });
});

