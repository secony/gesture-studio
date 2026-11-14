
import { describe, expect, it, vi, afterEach } from "vitest";
import { PlaygroundEngine } from "../../src/playground/PlaygroundEngine";
import type { CursorPosition } from "../../src/cursor/CursorController";

function createPosition(x: number, y: number): CursorPosition {
  return { x, y };
}

function selectAndReleaseFirstObject(engine: PlaygroundEngine) {
  const cursor = createPosition(0.25, 0.5);
  const clock = vi.spyOn(performance, "now");

  clock.mockReturnValue(1000);
  engine.update(cursor, false, true);
  engine.update(cursor, true, true);

  clock.mockReturnValue(1001);
  engine.update(cursor, false, true);

  clock.mockReturnValue(1051);

  return engine.update(cursor, false, true);
}

describe("PlaygroundEngine - gerenciamento de objetos", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve adicionar um objeto com identificador único", () => {
    const engine = new PlaygroundEngine();

    const state = engine.addObject();

    expect(state.objects).toHaveLength(4);
    expect(state.objects[3].id).toBe("object-4");
    expect(state.selectedObjectId).toBe("object-4");
    expect(state.isDragging).toBe(false);
  });

  it("deve permitir adicionar vários objetos", () => {
    const engine = new PlaygroundEngine();

    engine.addObject();
    const state = engine.addObject();

    expect(state.objects).toHaveLength(5);
    expect(state.objects[3].id).toBe("object-4");
    expect(state.objects[4].id).toBe("object-5");
    expect(state.selectedObjectId).toBe("object-5");
  });

  it("deve permitir definir a posição inicial do novo objeto", () => {
    const engine = new PlaygroundEngine();

    const state = engine.addObject(
      createPosition(0.4, 0.4)
    );

    const object = state.objects.find(
      (item) => item.id === "object-4"
    );

    expect(object?.position.x).toBeCloseTo(0.4);
    expect(object?.position.y).toBeCloseTo(0.4);
  });

  it("deve limitar a posição inicial do novo objeto à área", () => {
    const engine = new PlaygroundEngine();

    const state = engine.addObject(
      createPosition(0, 0)
    );

    const object = state.objects.find(
      (item) => item.id === "object-4"
    );

    expect(object?.position.x).toBeCloseTo(0.09);
    expect(object?.position.y).toBeCloseTo(0.09);
  });

  it("deve manter a seleção depois que o objeto é solto", () => {
    const engine = new PlaygroundEngine();

    const state = selectAndReleaseFirstObject(engine);

    expect(state.isDragging).toBe(false);
    expect(state.selectedObjectId).toBe("object-1");
  });

  it("deve remover o objeto selecionado", () => {
    const engine = new PlaygroundEngine();

    selectAndReleaseFirstObject(engine);

    const state = engine.removeSelectedObject();

    expect(state.objects).toHaveLength(2);
    expect(
      state.objects.some((item) => item.id === "object-1")
    ).toBe(false);
    expect(state.selectedObjectId).toBeNull();
  });

  it("não deve remover objetos quando não existe seleção", () => {
    const engine = new PlaygroundEngine();

    const state = engine.removeSelectedObject();

    expect(state.objects).toHaveLength(3);
    expect(state.selectedObjectId).toBeNull();
  });

  it("não deve remover um objeto enquanto ele está sendo manipulado", () => {
    const engine = new PlaygroundEngine();
    const cursor = createPosition(0.25, 0.5);

    engine.update(cursor, false, true);
    engine.update(cursor, true, true);

    const state = engine.removeSelectedObject();

    expect(state.objects).toHaveLength(3);
    expect(state.selectedObjectId).toBe("object-1");
    expect(state.isDragging).toBe(true);
  });

  it("deve trocar a seleção ao selecionar outro objeto", () => {
    const engine = new PlaygroundEngine();

    selectAndReleaseFirstObject(engine);

    const cursor = createPosition(0.5, 0.5);

    engine.update(cursor, false, true);

    const state = engine.update(cursor, true, true);

    expect(state.selectedObjectId).toBe("object-2");
    expect(state.isDragging).toBe(true);
  });

  it("deve limpar a seleção ao iniciar uma pinça fora dos objetos", () => {
    const engine = new PlaygroundEngine();

    selectAndReleaseFirstObject(engine);

    const cursor = createPosition(0.05, 0.05);

    engine.update(cursor, false, true);

    const state = engine.update(cursor, true, true);

    expect(state.selectedObjectId).toBeNull();
    expect(state.isDragging).toBe(false);
  });
});
