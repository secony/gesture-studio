
import type { HandLandmark } from "../tracking/HandTracker";
import { OneEuroFilter } from "./OneEuroFilter";
import type { OneEuroFilterOptions } from "./OneEuroFilter";
import type { CursorPosition } from "./CursorController";

export class OneEuroCursorController {
  private readonly xFilter: OneEuroFilter;
  private readonly yFilter: OneEuroFilter;

  constructor(options: OneEuroFilterOptions = {}) {
    this.xFilter = new OneEuroFilter(options);
    this.yFilter = new OneEuroFilter(options);
  }

  update(
    landmark: HandLandmark,
    timestamp = performance.now()
  ): CursorPosition {
    if (!Number.isFinite(timestamp)) {
      throw new Error("O timestamp deve ser finito.");
    }

    if (
      !Number.isFinite(landmark.x) ||
      !Number.isFinite(landmark.y)
    ) {
      throw new Error(
        "As coordenadas do landmark devem ser finitas."
      );
    }

    const targetX = this.clamp(landmark.x);
    const targetY = this.clamp(landmark.y);

    const x = this.xFilter.filter(targetX, timestamp);
    const y = this.yFilter.filter(targetY, timestamp);

    return { x, y };
  }

  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
