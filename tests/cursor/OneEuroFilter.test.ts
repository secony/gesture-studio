
import { describe, expect, it } from "vitest";
import { OneEuroFilter } from "../../src/cursor/OneEuroFilter";

describe("OneEuroFilter", () => {
  it("deve retornar diretamente o primeiro valor", () => {
    const filter = new OneEuroFilter();

    expect(filter.filter(0.4, 1000)).toBe(0.4);
  });

  it("deve suavizar uma mudança de posição", () => {
    const filter = new OneEuroFilter({
      minCutoff: 1,
      beta: 0,
    });

    filter.filter(0, 1000);

    const result = filter.filter(1, 1016);

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("deve responder mais rapidamente com beta maior em movimento rápido", () => {
    const slowFilter = new OneEuroFilter({
      minCutoff: 1,
      beta: 0,
    });

    const adaptiveFilter = new OneEuroFilter({
      minCutoff: 1,
      beta: 1,
    });

    slowFilter.filter(0, 1000);
    adaptiveFilter.filter(0, 1000);

    const slowResult = slowFilter.filter(1, 1016);
    const adaptiveResult = adaptiveFilter.filter(1, 1016);

    expect(adaptiveResult).toBeGreaterThan(slowResult);
  });

  it("deve aceitar intervalos variáveis entre atualizações", () => {
    const filter = new OneEuroFilter();

    filter.filter(0.2, 1000);
    filter.filter(0.3, 1016);

    const result = filter.filter(0.4, 1050);

    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0.2);
    expect(result).toBeLessThan(0.4);
  });

  it("deve reiniciar completamente o estado", () => {
    const filter = new OneEuroFilter();

    filter.filter(0.2, 1000);
    filter.filter(0.8, 1016);

    filter.reset();

    expect(filter.filter(0.7, 2000)).toBe(0.7);
  });

  it("deve rejeitar valores não finitos", () => {
    const filter = new OneEuroFilter();

    expect(() => filter.filter(Number.NaN, 1000)).toThrow();
    expect(() => filter.filter(Number.POSITIVE_INFINITY, 1000)).toThrow();
  });

  it("deve rejeitar timestamps não finitos", () => {
    const filter = new OneEuroFilter();

    expect(() => filter.filter(0.5, Number.NaN)).toThrow();
    expect(() => filter.filter(0.5, Number.POSITIVE_INFINITY)).toThrow();
  });

  it("deve rejeitar timestamps repetidos ou regressivos", () => {
    const filter = new OneEuroFilter();

    filter.filter(0.2, 1000);

    expect(() => filter.filter(0.3, 1000)).toThrow();
    expect(() => filter.filter(0.3, 999)).toThrow();
  });

  it("deve rejeitar parâmetros inválidos", () => {
    expect(() => new OneEuroFilter({ minCutoff: 0 })).toThrow();
    expect(() => new OneEuroFilter({ minCutoff: -1 })).toThrow();
    expect(() => new OneEuroFilter({ beta: -1 })).toThrow();
    expect(() => new OneEuroFilter({ derivativeCutoff: 0 })).toThrow();
    expect(() => new OneEuroFilter({ derivativeCutoff: -1 })).toThrow();
    expect(() => new OneEuroFilter({ beta: Number.NaN })).toThrow();
  });
});
