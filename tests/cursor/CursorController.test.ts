
import { describe, expect, it } from "vitest";
import { CursorController } from "../../src/cursor/CursorController";
import type { HandLandmark } from "../../src/tracking/HandTracker";

function createLandmark(
  x: number,
  y: number,
  z = 0
): HandLandmark {
  return { x, y, z };
}

describe("CursorController", () => {
  it("deve inicializar o cursor na posição do landmark", () => {
    const controller = new CursorController();

    const result = controller.update(createLandmark(0.4, 0.6));

    expect(result).toEqual({
      x: 0.4,
      y: 0.6,
    });
  });

  it("deve suavizar o movimento usando o fator padrão", () => {
    const controller = new CursorController();

    controller.update(createLandmark(0.2, 0.4));

    const result = controller.update(createLandmark(0.6, 0.8));

    expect(result.x).toBeCloseTo(0.3);
    expect(result.y).toBeCloseTo(0.5);
  });

  it("deve aplicar o fator de suavização personalizado", () => {
    const controller = new CursorController(0.5);

    controller.update(createLandmark(0.2, 0.2));

    const result = controller.update(createLandmark(0.8, 0.8));

    expect(result.x).toBeCloseTo(0.5);
    expect(result.y).toBeCloseTo(0.5);
  });

  
it("deve acompanhar imediatamente a posição quando o fator é 1", () => {
  const controller = new CursorController(1);

  controller.update(createLandmark(0.2, 0.3));

  const result = controller.update(createLandmark(0.8, 0.9));

  expect(result.x).toBeCloseTo(0.8);
  expect(result.y).toBeCloseTo(0.9);
});


  it("deve limitar coordenadas abaixo de zero", () => {
    const controller = new CursorController();

    const result = controller.update(createLandmark(-0.5, -1));

    expect(result).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("deve limitar coordenadas acima de 1", () => {
    const controller = new CursorController();

    const result = controller.update(createLandmark(1.5, 2));

    expect(result).toEqual({
      x: 1,
      y: 1,
    });
  });

  it("deve reiniciar a posição após reset", () => {
    const controller = new CursorController();

    controller.update(createLandmark(0.2, 0.2));
    controller.update(createLandmark(0.8, 0.8));

    controller.reset();

    const result = controller.update(createLandmark(0.7, 0.6));

    expect(result).toEqual({
      x: 0.7,
      y: 0.6,
    });
  });

  it("deve retornar uma cópia da posição sem expor o estado interno", () => {
    const controller = new CursorController();

    const firstResult = controller.update(createLandmark(0.3, 0.4));

    firstResult.x = 0.9;
    firstResult.y = 0.9;

    const secondResult = controller.update(createLandmark(0.3, 0.4));

    expect(secondResult).toEqual({
      x: 0.3,
      y: 0.4,
    });
  });

  it("deve rejeitar fator de suavização igual a zero", () => {
    expect(() => new CursorController(0)).toThrow();
  });

  it("deve rejeitar fator de suavização negativo", () => {
    expect(() => new CursorController(-0.5)).toThrow();
  });

  it("deve rejeitar fator de suavização superior a 1", () => {
    expect(() => new CursorController(1.5)).toThrow();
  });
});
