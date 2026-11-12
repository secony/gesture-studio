
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
  isResizing: boolean;
}

const PINCH_RELEASE_DELAY_MS = 50;

const MIN_HALF_SIZE = 0.05;
const MAX_HALF_SIZE = 0.18;
const RESIZE_SENSITIVITY = 0.5;

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
  private isResizing = false;

  private previousPinching = false;
  private pinchLostAt: number | null = null;

  private grabOffset: CursorPosition = {
    x: 0,
    y: 0,
  };

  private previousHandDistance: number | null = null;

  update(
    cursor: CursorPosition | null,
    isPinching: boolean,
    isActive: boolean,
    secondaryHand: CursorPosition | null = null
  ): PlaygroundState {
    if (!isActive || !cursor) {
      this.resetInteraction();
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

        this.objects = this.objects.filter(
          (object) => object.id !== target.id
        );

        this.objects.push(target);
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
        this.isResizing = false;
        this.selectedObjectId = null;
        this.pinchLostAt = null;
        this.previousHandDistance = null;
      }
    }

    if (this.isDragging && isPinching) {
      const selectedObject = this.getSelectedObject();

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

        if (secondaryHand) {
          this.resizeObject(selectedObject, cursor, secondaryHand);
        } else {
          this.isResizing = false;
          this.previousHandDistance = null;
        }
      }
    }

    this.previousPinching = isPinching;

    return this.getState();
  }

  private resizeObject(
    object: PlaygroundObject,
    primaryHand: CursorPosition,
    secondaryHand: CursorPosition
  ): void {
    const currentDistance = Math.hypot(
      primaryHand.x - secondaryHand.x,
      primaryHand.y - secondaryHand.y
    );

    if (this.previousHandDistance === null) {
      this.previousHandDistance = currentDistance;
      return;
    }

    const distanceDifference =
      currentDistance - this.previousHandDistance;

    object.halfSize = this.clamp(
      object.halfSize + distanceDifference * RESIZE_SENSITIVITY,
      MIN_HALF_SIZE,
      MAX_HALF_SIZE
    );

    // Mantém o objeto dentro da área após o redimensionamento.
    object.position = {
      x: this.clamp(
        object.position.x,
        object.halfSize,
        1 - object.halfSize
      ),
      y: this.clamp(
        object.position.y,
        object.halfSize,
        1 - object.halfSize
      ),
    };

    this.previousHandDistance = currentDistance;
    this.isResizing = true;
  }

  private resetInteraction(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.selectedObjectId = null;
    this.previousPinching = false;
    this.pinchLostAt = null;
    this.previousHandDistance = null;
  }

  private getSelectedObject(): PlaygroundObject | undefined {
    return this.objects.find(
      (object) => object.id === this.selectedObjectId
    );
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
      isResizing: this.isResizing,
    };
  }
}
