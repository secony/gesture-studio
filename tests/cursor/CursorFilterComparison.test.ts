
import { describe, expect, it } from "vitest";
import { CursorController } from "../../src/cursor/CursorController";
import { OneEuroCursorController } from "../../src/cursor/OneEuroCursorController";

interface Sample {
  x: number;
  truth: number;
  timestamp: number;
}

interface Scenario {
  name: string;
  samples: Sample[];
}

interface FilterResult {
  scenario: string;
  filter: string;
  rmse: number;
}

const oneEuroConfigurations = [
  { name: "One Euro 1", minCutoff: 1, beta: 0 },
  { name: "One Euro 2", minCutoff: 1, beta: 0.05 },
  { name: "One Euro 3", minCutoff: 1, beta: 0.1 },
  { name: "One Euro 4", minCutoff: 1.5, beta: 0.1 },
];

function createScenario(
  name: string,
  frameCount: number,
  getPosition: (index: number) => number,
  getInterval: (index: number) => number = () => 1000 / 60
): Scenario {
  let timestamp = 0;

  const samples = Array.from({ length: frameCount }, (_, index) => {
    timestamp += getInterval(index);

    const truth = getPosition(index);

    const noise =
      0.006 * Math.sin(index * 1.7) +
      0.003 * Math.sin(index * 0.37);

    return {
      x: truth + noise,
      truth,
      timestamp,
    };
  });

  return { name, samples };
}

function createScenarios(): Scenario[] {
  return [
    createScenario(
      "Mão parada",
      180,
      () => 0.5
    ),

    createScenario(
      "Movimento lento",
      180,
      (index) => 0.2 + (0.6 * index) / 179
    ),

    createScenario(
      "Movimento rápido",
      90,
      (index) => {
        if (index < 20) return 0.2;

        if (index < 40) {
          return 0.2 + (0.6 * (index - 20)) / 20;
        }

        if (index < 60) {
          return 0.8 - (0.6 * (index - 40)) / 20;
        }

        return 0.2;
      }
    ),

    createScenario(
      "FPS variável",
      180,
      (index) => 0.2 + (0.6 * index) / 179,
      (index) => [8.33, 16.67, 33.33, 12.5, 25][index % 5]
    ),
  ];
}

function calculateRMSE(
  actual: number[],
  expected: number[]
): number {
  const squaredErrors = actual.map(
    (value, index) => (value - expected[index]) ** 2
  );

  const mean =
    squaredErrors.reduce((sum, value) => sum + value, 0) /
    squaredErrors.length;

  return Math.sqrt(mean);
}

function evaluateEMA(samples: Sample[]): number {
  const controller = new CursorController(0.25);

  const actual: number[] = [];
  const expected: number[] = [];

  for (const sample of samples) {
    const result = controller.update({
      x: sample.x,
      y: 0.5,
      z: 0,
    });

    actual.push(result.x);
    expected.push(sample.truth);
  }

  return calculateRMSE(actual, expected);
}

function evaluateOneEuro(
  samples: Sample[],
  minCutoff: number,
  beta: number
): number {
  const controller = new OneEuroCursorController({
    minCutoff,
    beta,
  });

  const actual: number[] = [];
  const expected: number[] = [];

  for (const sample of samples) {
    const result = controller.update(
      {
        x: sample.x,
        y: 0.5,
        z: 0,
      },
      sample.timestamp
    );

    actual.push(result.x);
    expected.push(sample.truth);
  }

  return calculateRMSE(actual, expected);
}

describe("Comparação experimental dos filtros de cursor", () => {
  it("deve comparar EMA e configurações do One Euro", () => {
    const scenarios = createScenarios();
    const results: FilterResult[] = [];

    for (const scenario of scenarios) {
      results.push({
        scenario: scenario.name,
        filter: "EMA 0.25",
        rmse: evaluateEMA(scenario.samples),
      });

      for (const configuration of oneEuroConfigurations) {
        results.push({
          scenario: scenario.name,
          filter: configuration.name,
          rmse: evaluateOneEuro(
            scenario.samples,
            configuration.minCutoff,
            configuration.beta
          ),
        });
      }
    }

    console.table(
      results.map((result) => ({
        Cenário: result.scenario,
        Filtro: result.filter,
        RMSE: result.rmse.toFixed(6),
      }))
    );

    expect(results).toHaveLength(
      scenarios.length * (oneEuroConfigurations.length + 1)
    );

    for (const result of results) {
      expect(Number.isFinite(result.rmse)).toBe(true);
      expect(result.rmse).toBeGreaterThanOrEqual(0);
    }
  });
});
