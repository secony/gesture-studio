
import type { CursorPosition } from "../cursor/CursorController";

export interface PlaygroundObject {
  id: string;
  position: CursorPosition;
  halfSize: number;
  rotation: number;
}

export interface PlaygroundState {
  objects: PlaygroundObject[];
  selectedObjectId: string | null;
  isDragging: boolean;
  isResizing: boolean;
  isRotating: boolean;
}

const PINCH_RELEASE_DELAY_MS = 50;

const MIN_HALF_SIZE = 0.05;
const MAX_HALF_SIZE = 0.18;
const RESIZE_SENSITIVITY = 0.5;
const ROTATION_EPSILON = 0.00001;

export class PlaygroundEngine {
  private objects: PlaygroundObject[] = [
    {
      id: "object-1",
      position: { x: 0.25, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
    {
      id: "object-2",
      position: { x: 0.5, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
    {
      id: "object-3",
      position: { x: 0.75, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
  ];

  private selectedObjectId: string | null = null;
  private isDragging = false;
  private isResizing = false;
  private isRotating = false;

  private previousPinching = false;
  private pinchLostAt: number | null = null;

  private grabOffset: CursorPosition = {
    x: 0,
    y: 0,
  };

  private previousHandDistance: number | null = null;
  private previousHandAngle: number | null = null;

  update(
    cursor: CursorPosition | null,
    isPinching: boolean,
    isActive: boolean,
    secondaryHand: CursorPosition | null = null,
    aspectRatio = 1
  ): PlaygroundState {
    if (!isActive || !cursor) {
      this.resetInteraction();
      return this.getState();
    }

    const safeAspectRatio =
      Number.isFinite(aspectRatio) && aspectRatio > 0
        ? aspectRatio
        : 1;

    const now = performance.now();

    const pinchStarted =
      isPinching && !this.previousPinching;

    if (pinchStarted && !this.isDragging) {
      const target = this.findObjectAt(cursor, safeAspectRatio);

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
        this.isRotating = false;
        this.selectedObjectId = null;
        this.pinchLostAt = null;
        this.previousHandDistance = null;
        this.previousHandAngle = null;
      }
    }

    if (this.isDragging && isPinching) {
      const selectedObject = this.getSelectedObject();

      if (selectedObject) {
        selectedObject.position = {
          x: cursor.x + this.grabOffset.x,
          y: cursor.y + this.grabOffset.y,
        };

        this.clampObjectPosition(selectedObject, safeAspectRatio);

        if (secondaryHand) {
          this.resizeObject(
            selectedObject,
            cursor,
            secondaryHand,
            safeAspectRatio
          );

          this.rotateObject(
            selectedObject,
            cursor,
            secondaryHand,
            safeAspectRatio
          );

          this.clampObjectPosition(selectedObject, safeAspectRatio);
        } else {
          this.isResizing = false;
          this.isRotating = false;
          this.previousHandDistance = null;
          this.previousHandAngle = null;
        }
      }
    }

    this.previousPinching = isPinching;

    return this.getState();
  }

  private resizeObject(
    object: PlaygroundObject,
    primaryHand: CursorPosition,
    secondaryHand: CursorPosition,
    aspectRatio: number
  ): void {
    const currentDistance = Math.hypot(
      (primaryHand.x - secondaryHand.x) * aspectRatio,
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

    this.previousHandDistance = currentDistance;
    this.isResizing =
      Math.abs(distanceDifference) > ROTATION_EPSILON;
  }

  private rotateObject(
    object: PlaygroundObject,
    primaryHand: CursorPosition,
    secondaryHand: CursorPosition,
    aspectRatio: number
  ): void {
    const deltaX =
      (secondaryHand.x - primaryHand.x) * aspectRatio;

    const deltaY =
      secondaryHand.y - primaryHand.y;

    const currentAngle = Math.atan2(deltaY, deltaX);

    if (this.previousHandAngle === null) {
      this.previousHandAngle = currentAngle;
      return;
    }

    const angleDifference = this.normalizeAngle(
      currentAngle - this.previousHandAngle
    );

    object.rotation = this.normalizeAngle(
      object.rotation + angleDifference
    );

    this.previousHandAngle = currentAngle;
    this.isRotating =
      Math.abs(angleDifference) > ROTATION_EPSILON;
  }

  private normalizeAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  private clampObjectPosition(
    object: PlaygroundObject,
    aspectRatio: number
  ): void {
    const absCos = Math.abs(Math.cos(object.rotation));
    const absSin = Math.abs(Math.sin(object.rotation));

    const horizontalExtent =
      object.halfSize *
      (absCos + absSin / aspectRatio);

    const verticalExtent =
      object.halfSize *
      (absSin * aspectRatio + absCos);

    object.position = {
      x: this.clamp(
        object.position.x,
        horizontalExtent,
        1 - horizontalExtent
      ),
      y: this.clamp(
        object.position.y,
        verticalExtent,
        1 - verticalExtent
      ),
    };
  }

  private resetInteraction(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
    this.selectedObjectId = null;
    this.previousPinching = false;
    this.pinchLostAt = null;
    this.previousHandDistance = null;
    this.previousHandAngle = null;
  }

  private getSelectedObject(): PlaygroundObject | undefined {
    return this.objects.find(
      (object) => object.id === this.selectedObjectId
    );
  }

  private findObjectAt(
    cursor: CursorPosition,
    aspectRatio: number
  ): PlaygroundObject | null {
    for (let index = this.objects.length - 1; index >= 0; index--) {
      const object = this.objects[index];

      const deltaX =
        (cursor.x - object.position.x) * aspectRatio;

      const deltaY =
        cursor.y - object.position.y;

      const cos = Math.cos(object.rotation);
      const sin = Math.sin(object.rotation);

      const localX = deltaX * cos + deltaY * sin;
      const localY = -deltaX * sin + deltaY * cos;

      const insideX =
        Math.abs(localX) <= object.halfSize * aspectRatio;

      const insideY =
        Math.abs(localY) <= object.halfSize;

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
      isRotating: this.isRotating,
    };
  }
}
