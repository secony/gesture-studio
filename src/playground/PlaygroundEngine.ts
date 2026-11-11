
import type { CursorPosition } from "../cursor/CursorController";

export interface PlaygroundObject {
  id: string;
  position: CursorPosition;
  halfSize: number;
}

export interface PlaygroundState {
  objects: PlaygroundObject[];
  selectedObjectId: string | null;
  isDragging: boolean;
}

const PINCH_RELEASE_DELAY_MS = 150;

export class PlaygroundEngine {
  private objects: PlaygroundObject[] = [
    {
      id: "object-1",
      position: { x: 0.25, y: 0.5 },
      halfSize: 0.09,
    },
    {
      id: "object-2",
      position: { x: 0.5, y: 0.5 },
      halfSize: 0.09,
    },
    {
      id: "object-3",
      position: { x: 0.75, y: 0.5 },
      halfSize: 0.09,
    },
  ];

  private selectedObjectId: string | null = null;
  private isDragging = false;
  private previousPinching = false;
  private pinchLostAt: number | null = null;

  private grabOffset: CursorPosition = {
    x: 0,
    y: 0,
  };

  update(
    cursor: CursorPosition | null,
    isPinching: boolean,
    isActive: boolean
  ): PlaygroundState {
    if (!isActive || !cursor) {
      this.isDragging = false;
      this.selectedObjectId = null;
      this.previousPinching = false;
      this.pinchLostAt = null;

      return this.getState();
    }

    const now = performance.now();

    const pinchStarted =
      isPinching && !this.previousPinching;

    if (pinchStarted && !this.isDragging) {
      const target = this.findObjectAt(cursor);

      if (target) {
        this.selectedObjectId = target.id;
        this.isDragging = true;

        this.grabOffset = {
          x: target.position.x - cursor.x,
          y: target.position.y - cursor.y,
        };
      }
    }

    if (this.isDragging) {
      if (isPinching) {
        this.pinchLostAt = null;
      } else if (this.pinchLostAt === null) {
        this.pinchLostAt = now;
      }

      const releaseConfirmed =
        this.pinchLostAt !== null &&
        now - this.pinchLostAt >= PINCH_RELEASE_DELAY_MS;

      if (releaseConfirmed) {
        this.isDragging = false;
        this.selectedObjectId = null;
        this.pinchLostAt = null;
      }
    }

    if (this.isDragging && isPinching) {
      const selectedObject = this.objects.find(
        (object) => object.id === this.selectedObjectId
      );

      if (selectedObject) {
        selectedObject.position = {
          x: this.clamp(
            cursor.x + this.grabOffset.x,
            selectedObject.halfSize,
            1 - selectedObject.halfSize
          ),
          y: this.clamp(
            cursor.y + this.grabOffset.y,
            selectedObject.halfSize,
            1 - selectedObject.halfSize
          ),
        };
      }
    }

    this.previousPinching = isPinching;

    return this.getState();
  }

  private findObjectAt(
    cursor: CursorPosition
  ): PlaygroundObject | null {
    for (let index = this.objects.length - 1; index >= 0; index--) {
      const object = this.objects[index];

      const insideX =
        Math.abs(cursor.x - object.position.x) <= object.halfSize;

      const insideY =
        Math.abs(cursor.y - object.position.y) <= object.halfSize;

      if (insideX && insideY) {
        return object;
      }
    }

    return null;
  }

  private clamp(
    value: number,
    min: number,
    max: number
  ): number {
    return Math.max(min, Math.min(max, value));
  }

  private getState(): PlaygroundState {
    return {
      objects: this.objects.map((object) => ({
        ...object,
        position: { ...object.position },
      })),
      selectedObjectId: this.selectedObjectId,
      isDragging: this.isDragging,
    };
  }
}
