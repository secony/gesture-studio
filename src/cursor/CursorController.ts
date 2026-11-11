
import type { HandLandmark } from "../tracking/HandTracker";

export interface CursorPosition {
  x: number;
  y: number;
}

export class CursorController {
  private position: CursorPosition | null = null;

  // Quanto menor, maior a suavização.
  private readonly smoothingFactor: number;

  constructor(smoothingFactor = 0.25) {
    if (smoothingFactor <= 0 || smoothingFactor > 1) {
      throw new Error(
        "O fator de suavização deve estar entre 0 e 1."
      );
    }

    this.smoothingFactor = smoothingFactor;
  }

  update(landmark: HandLandmark): CursorPosition {
    // Espelha horizontalmente para acompanhar a câmera.
    const targetX = this.clamp(landmark.x);
    const targetY = this.clamp(landmark.y);

    if (!this.position) {
      this.position = {
        x: targetX,
        y: targetY,
      };

      return { ...this.position };
    }

    // Filtro EMA para reduzir tremores.
    this.position.x +=
      (targetX - this.position.x) * this.smoothingFactor;

    this.position.y +=
      (targetY - this.position.y) * this.smoothingFactor;

    return { ...this.position };
  }

  reset(): void {
    this.position = null;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
