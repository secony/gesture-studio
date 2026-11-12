
export interface OneEuroFilterOptions {
  minCutoff?: number;
  beta?: number;
  derivativeCutoff?: number;
}

export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly derivativeCutoff: number;

  private previousRawValue: number | null = null;
  private previousFilteredValue: number | null = null;
  private previousFilteredDerivative = 0;
  private previousTimestamp: number | null = null;

  constructor(options: OneEuroFilterOptions = {}) {
    const {
      minCutoff = 1,
      beta = 0,
      derivativeCutoff = 1,
    } = options;

    if (!Number.isFinite(minCutoff) || minCutoff <= 0) {
      throw new Error("minCutoff deve ser um número positivo.");
    }

    if (!Number.isFinite(beta) || beta < 0) {
      throw new Error("beta deve ser um número não negativo.");
    }

    if (
      !Number.isFinite(derivativeCutoff) ||
      derivativeCutoff <= 0
    ) {
      throw new Error(
        "derivativeCutoff deve ser um número positivo."
      );
    }

    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
  }

  filter(value: number, timestamp: number): number {
    if (!Number.isFinite(value)) {
      throw new Error("O valor a filtrar deve ser finito.");
    }

    if (!Number.isFinite(timestamp)) {
      throw new Error("O timestamp deve ser finito.");
    }

    if (
      this.previousTimestamp !== null &&
      timestamp <= this.previousTimestamp
    ) {
      throw new Error("O timestamp deve ser estritamente crescente.");
    }

    if (
      this.previousRawValue === null ||
      this.previousFilteredValue === null ||
      this.previousTimestamp === null
    ) {
      this.previousRawValue = value;
      this.previousFilteredValue = value;
      this.previousTimestamp = timestamp;

      return value;
    }

    // performance.now() fornece milissegundos; o filtro utiliza segundos.
    const elapsedSeconds =
      (timestamp - this.previousTimestamp) / 1000;

    const rawDerivative =
      (value - this.previousRawValue) / elapsedSeconds;

    const derivativeAlpha = this.smoothingFactor(
      this.derivativeCutoff,
      elapsedSeconds
    );

    const filteredDerivative =
      derivativeAlpha * rawDerivative +
      (1 - derivativeAlpha) * this.previousFilteredDerivative;

    const adaptiveCutoff =
      this.minCutoff + this.beta * Math.abs(filteredDerivative);

    const valueAlpha = this.smoothingFactor(
      adaptiveCutoff,
      elapsedSeconds
    );

    const filteredValue =
      valueAlpha * value +
      (1 - valueAlpha) * this.previousFilteredValue;

    this.previousRawValue = value;
    this.previousFilteredValue = filteredValue;
    this.previousFilteredDerivative = filteredDerivative;
    this.previousTimestamp = timestamp;

    return filteredValue;
  }

  reset(): void {
    this.previousRawValue = null;
    this.previousFilteredValue = null;
    this.previousFilteredDerivative = 0;
    this.previousTimestamp = null;
  }

  private smoothingFactor(cutoff: number, elapsedSeconds: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);

    return 1 / (1 + tau / elapsedSeconds);
  }
}
