
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlaygroundEngine } from "../../src/playground/PlaygroundEngine";
import type { CursorPosition } from "../../src/cursor/CursorController";

function createPosition(x: number, y: number): CursorPosition {
  return { x, y };
}

function startDragging(
  engine: PlaygroundEngine,
  cursor = createPosition(0.25, 0.5),
  secondaryHand: CursorPosition | null = null
) {
  engine.update(cursor, false, true);
  return engine.update(cursor, true, true, secondaryHand);
}

describe("PlaygroundEngine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve iniciar com três objetos nas posições esperadas", () => {
    const engine = new PlaygroundEngine();
    const state = engine.update(null, false, false);

    expect(state.objects).toHaveLength(3);
    expect(state.objects[0]).toMatchObject({
      id: "object-1",
      position: { x: 0.25, y: 0.5 },
      halfSize: 0.09,
    });
    expect(state.objects[1].id).toBe("object-2");
    expect(state.objects[2].id).toBe("object-3");
  });

  it("não deve selecionar um objeto sem iniciar a pinça", () => {
    const engine = new PlaygroundEngine();

    const state = engine.update(
      createPosition(0.25, 0.5),
      false,
      true
    );

    expect(state.selectedObjectId).toBeNull();
    expect(state.isDragging).toBe(false);
  });

  it("deve selecionar um objeto ao iniciar a pinça sobre ele", () => {
    const engine = new PlaygroundEngine();

    const state = startDragging(engine);

    expect(state.selectedObjectId).toBe("object-1");
    expect(state.isDragging).toBe(true);
  });

  it("não deve selecionar um objeto quando a pinça começa fora dele", () => {
    const engine = new PlaygroundEngine();

    const state = startDragging(
      engine,
      createPosition(0.1, 0.1)
    );

    expect(state.selectedObjectId).toBeNull();
    expect(state.isDragging).toBe(false);
  });

  it("não deve selecionar um objeto ao entrar nele mantendo a pinça", () => {
    const engine = new PlaygroundEngine();

    engine.update(createPosition(0.1, 0.1), false, true);
    engine.update(createPosition(0.1, 0.1), true, true);

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true
    );

    expect(state.selectedObjectId).toBeNull();
    expect(state.isDragging).toBe(false);
  });

  it("deve preservar o deslocamento inicial durante o arraste", () => {
    const engine = new PlaygroundEngine();

    startDragging(engine, createPosition(0.2, 0.48));

    const state = engine.update(
      createPosition(0.4, 0.6),
      true,
      true
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.position.x).toBeCloseTo(0.45);
    expect(object?.position.y).toBeCloseTo(0.62);
    expect(state.isDragging).toBe(true);
  });

  it("deve mover o objeto selecionado para o topo da ordem", () => {
    const engine = new PlaygroundEngine();

    const state = startDragging(engine);

    expect(state.objects.map((object) => object.id)).toEqual([
      "object-2",
      "object-3",
      "object-1",
    ]);
  });

  it("deve limitar a posição do objeto aos limites da área", () => {
    const engine = new PlaygroundEngine();

    startDragging(engine);

    const state = engine.update(
      createPosition(0, 0),
      true,
      true
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.position.x).toBeCloseTo(0.09);
    expect(object?.position.y).toBeCloseTo(0.09);
  });

  it("deve manter o arraste durante a tolerância de soltura", () => {
    const engine = new PlaygroundEngine();
    const clock = vi.spyOn(performance, "now");

    clock.mockReturnValue(1000);
    startDragging(engine);

    clock.mockReturnValue(1001);
    engine.update(createPosition(0.3, 0.5), false, true);

    clock.mockReturnValue(1150);
    const state = engine.update(
      createPosition(0.3, 0.5),
      false,
      true
    );

    expect(state.isDragging).toBe(true);
    expect(state.selectedObjectId).toBe("object-1");
  });

  it("deve encerrar o arraste após 150 ms sem pinça", () => {
    const engine = new PlaygroundEngine();
    const clock = vi.spyOn(performance, "now");

    clock.mockReturnValue(1000);
    startDragging(engine);

    clock.mockReturnValue(1001);
    engine.update(createPosition(0.3, 0.5), false, true);

    clock.mockReturnValue(1151);
    const state = engine.update(
      createPosition(0.3, 0.5),
      false,
      true
    );

    expect(state.isDragging).toBe(false);
    expect(state.isResizing).toBe(false);
    expect(state.selectedObjectId).toBeNull();
  });

  it("deve cancelar a soltura se a pinça retornar dentro do prazo", () => {
    const engine = new PlaygroundEngine();
    const clock = vi.spyOn(performance, "now");

    clock.mockReturnValue(1000);
    startDragging(engine);

    clock.mockReturnValue(1001);
    engine.update(createPosition(0.3, 0.5), false, true);

    clock.mockReturnValue(1100);
    const state = engine.update(
      createPosition(0.3, 0.5),
      true,
      true
    );

    expect(state.isDragging).toBe(true);
    expect(state.selectedObjectId).toBe("object-1");
  });

  it("deve encerrar a interação quando o modo fica inativo", () => {
    const engine = new PlaygroundEngine();

    startDragging(engine);

    const state = engine.update(
      createPosition(0.3, 0.5),
      true,
      false
    );

    expect(state.isDragging).toBe(false);
    expect(state.isResizing).toBe(false);
    expect(state.selectedObjectId).toBeNull();
  });

  it("deve encerrar a interação quando o cursor desaparece", () => {
    const engine = new PlaygroundEngine();

    startDragging(engine);

    const state = engine.update(null, true, true);

    expect(state.isDragging).toBe(false);
    expect(state.selectedObjectId).toBeNull();
  });

  it("deve estabelecer uma distância inicial antes de redimensionar", () => {
    const engine = new PlaygroundEngine();

    const state = startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    expect(state.isDragging).toBe(true);
    expect(state.isResizing).toBe(false);

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.halfSize).toBeCloseTo(0.09);
  });

  it("deve aumentar proporcionalmente o tamanho do objeto", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      createPosition(0.55, 0.5)
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.halfSize).toBeCloseTo(0.14);
    expect(state.isResizing).toBe(true);
  });

  it("deve limitar o redimensionamento ao tamanho máximo", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      createPosition(1, 0.5)
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.halfSize).toBeCloseTo(0.18);
  });

  it("deve limitar o redimensionamento ao tamanho mínimo", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      createPosition(0.26, 0.5)
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.halfSize).toBeCloseTo(0.05);
  });

  it("deve interromper o redimensionamento quando a mão secundária desaparece", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      createPosition(0.55, 0.5)
    );

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      null
    );

    expect(state.isDragging).toBe(true);
    expect(state.isResizing).toBe(false);
  });

  it("deve estabelecer uma nova referência quando a mão secundária retorna", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.25, 0.5),
      createPosition(0.45, 0.5)
    );

    engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      null
    );

    const state = engine.update(
      createPosition(0.25, 0.5),
      true,
      true,
      createPosition(0.8, 0.5)
    );

    const object = state.objects.find(
      (item) => item.id === "object-1"
    );

    expect(object?.halfSize).toBeCloseTo(0.09);
    expect(state.isDragging).toBe(true);
    expect(state.isResizing).toBe(false);
  });

  it("deve retornar cópias dos objetos sem expor o estado interno", () => {
    const engine = new PlaygroundEngine();

    const firstState = engine.update(null, false, false);

    firstState.objects[0].position.x = 0.99;
    firstState.objects[0].halfSize = 0.18;
    firstState.objects.pop();

    const secondState = engine.update(null, false, false);

    expect(secondState.objects).toHaveLength(3);
    expect(secondState.objects[0].position.x).toBeCloseTo(0.25);
    expect(secondState.objects[0].halfSize).toBeCloseTo(0.09);
  });

  it("não deve permitir que o objeto redimensionado ultrapasse a área", () => {
    const engine = new PlaygroundEngine();

    startDragging(
      engine,
      createPosition(0.75, 0.5),
      createPosition(0.95, 0.5)
    );

    const state = engine.update(
      createPosition(0.91, 0.5),
      true,
      true,
      createPosition(0.16, 0.5)
    );

    const object = state.objects.find(
      (item) => item.id === "object-3"
    );

    expect(object).toBeDefined();
    expect(object!.position.x + object!.halfSize).toBeLessThanOrEqual(1);
  });
});
