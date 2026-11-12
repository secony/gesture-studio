
export interface CursorMetricPosition {
  x: number;
  y: number;
}

export interface TrackingMetricsSnapshot {
  fps: number;
  averageInferenceMs: number;
  maxInferenceMs: number;
  averageProcessingMs: number;
  maxProcessingMs: number;
  cursorJitter: number | null;
  cursorJitterSamples: number;
  trackingLossCount: number;
  averageTrackingLossDurationMs: number;
  lastTrackingLossDurationMs: number;
  isTrackingLost: boolean;
  currentTrackingLossDurationMs: number;
}

interface TrackingMetricsOptions {
  maxSamples?: number;
  stationaryThreshold?: number;
}

interface FrameSample {
  timestamp: number;
  inferenceMs: number;
  processingMs: number;
}

interface CursorSample {
  timestamp: number;
  raw: CursorMetricPosition;
  filtered: CursorMetricPosition;
}

export class TrackingMetrics {
  private readonly maxSamples: number;
  private readonly stationaryThreshold: number;

  private frameSamples: FrameSample[] = [];
  private cursorSamples: CursorSample[] = [];

  private trackingInitialized = false;
  private isTrackingLost = false;
  private trackingLossStartedAt: number | null = null;

  private trackingLossCount = 0;
  private totalTrackingLossDurationMs = 0;
  private lastTrackingLossDurationMs = 0;

  constructor(options: TrackingMetricsOptions = {}) {
    const {
      maxSamples = 120,
      stationaryThreshold = 0.004,
    } = options;

    if (!Number.isInteger(maxSamples) || maxSamples < 2) {
      throw new Error("maxSamples deve ser um inteiro maior ou igual a 2.");
    }

    if (
      !Number.isFinite(stationaryThreshold) ||
      stationaryThreshold < 0
    ) {
      throw new Error("stationaryThreshold deve ser não negativo.");
    }

    this.maxSamples = maxSamples;
    this.stationaryThreshold = stationaryThreshold;
  }

  recordFrame(
    inferenceMs: number,
    processingMs: number,
    timestamp: number
  ): void {
    this.validateTimestamp(timestamp);
    this.validateDuration(inferenceMs, "inferenceMs");
    this.validateDuration(processingMs, "processingMs");

    const previous = this.frameSamples.at(-1);

    if (previous && timestamp <= previous.timestamp) {
      throw new Error("O timestamp dos frames deve ser crescente.");
    }

    this.frameSamples.push({
      timestamp,
      inferenceMs,
      processingMs,
    });

    this.trimSamples(this.frameSamples);
  }

  recordCursor(
    raw: CursorMetricPosition,
    filtered: CursorMetricPosition,
    timestamp: number
  ): void {
    this.validateTimestamp(timestamp);
    this.validatePosition(raw, "raw");
    this.validatePosition(filtered, "filtered");

    const previous = this.cursorSamples.at(-1);

    if (previous && timestamp <= previous.timestamp) {
      throw new Error("O timestamp do cursor deve ser crescente.");
    }

    this.cursorSamples.push({
      timestamp,
      raw: { ...raw },
      filtered: { ...filtered },
    });

    this.trimSamples(this.cursorSamples);
  }

  
recordTracking(hasHand: boolean, timestamp: number): void {
  this.validateTimestamp(timestamp);

  // A ausência inicial de mão não é considerada perda de tracking.
  if (!this.trackingInitialized) {
    if (hasHand) {
      this.trackingInitialized = true;
    }

    return;
  }

  if (hasHand && this.isTrackingLost) {
    this.finishTrackingLoss(timestamp);
    return;
  }

  if (!hasHand && !this.isTrackingLost) {
    this.trackingLossCount++;
    this.isTrackingLost = true;
    this.trackingLossStartedAt = timestamp;
  }
}


  getSnapshot(timestamp: number): TrackingMetricsSnapshot {
    this.validateTimestamp(timestamp);

    const inferenceTimes = this.frameSamples.map(
      (sample) => sample.inferenceMs
    );

    const processingTimes = this.frameSamples.map(
      (sample) => sample.processingMs
    );

    const firstFrame = this.frameSamples[0];
    const lastFrame = this.frameSamples.at(-1);

    const elapsedMs =
      firstFrame && lastFrame
        ? lastFrame.timestamp - firstFrame.timestamp
        : 0;

    const fps =
      this.frameSamples.length >= 2 && elapsedMs > 0
        ? ((this.frameSamples.length - 1) / elapsedMs) * 1000
        : 0;

    const cursorJitter = this.calculateCursorJitter();

    const currentTrackingLossDurationMs =
      this.isTrackingLost && this.trackingLossStartedAt !== null
        ? Math.max(0, timestamp - this.trackingLossStartedAt)
        : 0;

    return {
      fps,
      averageInferenceMs: this.average(inferenceTimes),
      maxInferenceMs: this.maximum(inferenceTimes),
      averageProcessingMs: this.average(processingTimes),
      maxProcessingMs: this.maximum(processingTimes),
      cursorJitter: cursorJitter.value,
      cursorJitterSamples: cursorJitter.samples,
      trackingLossCount: this.trackingLossCount,
      averageTrackingLossDurationMs:
  this.trackingLossCount - (this.isTrackingLost ? 1 : 0) > 0
    ? this.totalTrackingLossDurationMs /
      (this.trackingLossCount - (this.isTrackingLost ? 1 : 0))
    : 0,
      lastTrackingLossDurationMs: this.lastTrackingLossDurationMs,
      isTrackingLost: this.isTrackingLost,
      currentTrackingLossDurationMs,
    };
  }

  reset(): void {
    this.frameSamples = [];
    this.cursorSamples = [];

    this.trackingInitialized = false;
    this.isTrackingLost = false;
    this.trackingLossStartedAt = null;

    this.trackingLossCount = 0;
    this.totalTrackingLossDurationMs = 0;
    this.lastTrackingLossDurationMs = 0;
  }

  private finishTrackingLoss(timestamp: number): void {
    if (this.trackingLossStartedAt === null) {
      return;
    }

    const duration = Math.max(
      0,
      timestamp - this.trackingLossStartedAt
    );

    this.lastTrackingLossDurationMs = duration;
    this.totalTrackingLossDurationMs += duration;

    this.trackingLossStartedAt = null;
    this.isTrackingLost = false;
  }

  private calculateCursorJitter(): {
    value: number | null;
    samples: number;
  } {
    const displacements: number[] = [];

    for (let index = 1; index < this.cursorSamples.length; index++) {
      const previous = this.cursorSamples[index - 1];
      const current = this.cursorSamples[index];

      const rawMovement = Math.hypot(
        current.raw.x - previous.raw.x,
        current.raw.y - previous.raw.y
      );

      if (rawMovement > this.stationaryThreshold) {
        continue;
      }

      const filteredMovement = Math.hypot(
        current.filtered.x - previous.filtered.x,
        current.filtered.y - previous.filtered.y
      );

      displacements.push(filteredMovement);
    }

    if (displacements.length === 0) {
      return { value: null, samples: 0 };
    }

    return {
      value: this.average(displacements),
      samples: displacements.length,
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) /
      values.length;
  }

  private maximum(values: number[]): number {
    return values.length > 0 ? Math.max(...values) : 0;
  }

  private trimSamples<T>(samples: T[]): void {
    if (samples.length > this.maxSamples) {
      samples.splice(0, samples.length - this.maxSamples);
    }
  }

  private validateTimestamp(timestamp: number): void {
    if (!Number.isFinite(timestamp)) {
      throw new Error("O timestamp deve ser finito.");
    }
  }

  private validateDuration(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} deve ser um número não negativo.`);
    }
  }

  private validatePosition(
    position: CursorMetricPosition,
    name: string
  ): void {
    if (
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      throw new Error(`As coordenadas de ${name} devem ser finitas.`);
    }
  }
}
