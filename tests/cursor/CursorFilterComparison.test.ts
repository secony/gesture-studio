
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
  type: "stationary" | "movement" | "step";
  stepTimestamp?: number;
  initialPosition: number;
  targetPosition: number;
}

interface FilterMetrics {
  scenario: string;
  filter: string;
  rmse: number;
  jitter: number | null;
  latency90Ms: number | null;
}

interface FilterConfiguration {
  name: string;
  minCutoff: number;
  beta: number;
}

const oneEuroConfigurations: FilterConfiguration[] = [
  { name: "One Euro 1", minCutoff: 6, beta: 1 },
  { name: "One Euro 2", minCutoff: 6, beta: 2 },
  { name: "One Euro 3", minCutoff: 6, beta: 3 },
  { name: "One Euro 4", minCutoff: 6, beta: 4 },
  { name: "One Euro 5", minCutoff: 8, beta: 1 },
  { name: "One Euro 6", minCutoff: 8, beta: 2 },
  { name: "One Euro 7", minCutoff: 8, beta: 3 },
  { name: "One Euro 8", minCutoff: 8, beta: 4 },
  { name: "One Euro 9", minCutoff: 10, beta: 1 },
  { name: "One Euro 10", minCutoff: 10, beta: 2 },
  { name: "One Euro 11", minCutoff: 10, beta: 3 },
  { name: "One Euro 12", minCutoff: 10, beta: 4 },
];

function createScenario(
  name: string,
  durationSeconds: number,
  getPosition: (elapsedSeconds: number) => number,
  type: Scenario["type"],
  getInterval: (index: number) => number = () => 1000 / 60,
  stepTimestamp?: number
): Scenario {
  const samples: Sample[] = [];
  let timestamp = 0;
  let index = 0;

  while (timestamp <= durationSeconds * 1000) {
    const elapsedSeconds = timestamp / 1000;
    const truth = getPosition(elapsedSeconds);

    // Ruído determinístico para permitir comparações reproduzíveis.
    const noise =
      0.006 * Math.sin(index * 1.7) +
      0.003 * Math.sin(index * 0.37);

    samples.push({
      x: truth + noise,
      truth,
      timestamp,
    });

    timestamp += getInterval(index);
    index += 1;
  }

  return {
    name,
    samples,
    type,
    stepTimestamp,
    initialPosition: getPosition(0),
    targetPosition: getPosition(durationSeconds),
  };
}

function createScenarios(): Scenario[] {
  const slowMovement = (time: number) =>
    0.2 + (0.6 * Math.min(time, 3)) / 3;

  const fastMovement = (time: number) => {
    if (time < 0.2) return 0.2;
    if (time < 0.6) return 0.2 + (0.6 * (time - 0.2)) / 0.4;
    return 0.8;
  };

  const stepTimestamp = 0.5;

  const stepMovement = (time: number) =>
    time < stepTimestamp ? 0.2 : 0.8;

  const variableIntervals = [8.33, 16.67, 33.33, 12.5, 25];

  return [
    createScenario(
      "Mão parada",
      3,
      () => 0.5,
      "stationary"
    ),
    createScenario(
      "Movimento lento",
      3,
      slowMovement,
      "movement"
    ),
    createScenario(
      "Movimento rápido",
      1.5,
      fastMovement,
      "movement"
    ),
    createScenario(
      "FPS variável",
      3,
      slowMovement,
      "movement",
      (index) => variableIntervals[index % variableIntervals.length]
    ),
    createScenario(
      "Mudança brusca",
      1.5,
      stepMovement,
      "step",
      () => 1000 / 60,
      stepTimestamp * 1000
    ),
  ];
}

function calculateRMSE(actual: number[], expected: number[]): number {
  const squaredErrors = actual.map(
    (value, index) => (value - expected[index]) ** 2
  );

  const mean =
    squaredErrors.reduce((sum, value) => sum + value, 0) /
    squaredErrors.length;

  return Math.sqrt(mean);
}

function calculateStandardDeviation(values: number[]): number {
  const mean =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

function calculateJitter(output: number[]): number | null {
  // Ignora os primeiros 30 frames para evitar medir a inicialização.
  const stableSamples = output.slice(30);

  if (stableSamples.length === 0) {
    return null;
  }

  return calculateStandardDeviation(stableSamples);
}

function calculateLatency90(
  output: number[],
  samples: Sample[],
  scenario: Scenario
): number | null {
  if (
    scenario.type !== "step" ||
    scenario.stepTimestamp === undefined
  ) {
    return null;
  }

  const initial = scenario.initialPosition;
  const target = scenario.targetPosition;

  const threshold = initial + (target - initial) * 0.9;

  const reachedIndex = output.findIndex(
    (value, index) =>
      samples[index].timestamp >= scenario.stepTimestamp! &&
      (target > initial ? value >= threshold : value <= threshold)
  );

  if (reachedIndex === -1) {
    return null;
  }

  return samples[reachedIndex].timestamp - scenario.stepTimestamp;
}

function evaluateFilter(
  scenario: Scenario,
  filterName: string,
  update: (sample: Sample) => number
): FilterMetrics {
  const output: number[] = [];
  const expected: number[] = [];

  for (const sample of scenario.samples) {
    output.push(update(sample));
    expected.push(sample.truth);
  }

  return {
    scenario: scenario.name,
    filter: filterName,
    rmse: calculateRMSE(output, expected),
    jitter:
      scenario.type === "stationary"
        ? calculateJitter(output)
        : null,
    latency90Ms: calculateLatency90(
      output,
      scenario.samples,
      scenario
    ),
  };
}

function evaluateEMA(scenario: Scenario): FilterMetrics {
  const controller = new CursorController(0.25);

  return evaluateFilter(scenario, "EMA 0.25", (sample) => {
    const result = controller.update({
      x: sample.x,
      y: 0.5,
      z: 0,
    });

    return result.x;
  });
}

function evaluateOneEuro(
  scenario: Scenario,
  configuration: FilterConfiguration
): FilterMetrics {
  const controller = new OneEuroCursorController({
    minCutoff: configuration.minCutoff,
    beta: configuration.beta,
  });

  return evaluateFilter(
    scenario,
    configuration.name,
    (sample) => {
      const result = controller.update(
        {
          x: sample.x,
          y: 0.5,
          z: 0,
        },
        sample.timestamp
      );

      return result.x;
    }
  );
}

describe("Comparação experimental dos filtros de cursor", () => {
  it("deve comparar EMA e configurações do One Euro em diferentes cenários", () => {
    const scenarios = createScenarios();
    const results: FilterMetrics[] = [];

    for (const scenario of scenarios) {
      results.push(evaluateEMA(scenario));

      for (const configuration of oneEuroConfigurations) {
        results.push(evaluateOneEuro(scenario, configuration));
      }
    }

    console.table(
      results.map((result) => ({
        Cenário: result.scenario,
        Filtro: result.filter,
        RMSE: result.rmse.toFixed(6),
        Jitter: result.jitter?.toFixed(6) ?? "-",
        "Latência 90% (ms)":
          result.latency90Ms?.toFixed(2) ?? "-",
      }))
    );

    expect(results).toHaveLength(
      scenarios.length * (oneEuroConfigurations.length + 1)
    );

    for (const result of results) {
      expect(Number.isFinite(result.rmse)).toBe(true);
      expect(result.rmse).toBeGreaterThanOrEqual(0);

      if (result.jitter !== null) {
        expect(Number.isFinite(result.jitter)).toBe(true);
        expect(result.jitter).toBeGreaterThanOrEqual(0);
      }

      if (result.latency90Ms !== null) {
        expect(Number.isFinite(result.latency90Ms)).toBe(true);
        expect(result.latency90Ms).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
