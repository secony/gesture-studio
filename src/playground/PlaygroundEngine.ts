
import type { CursorPosition } from "../cursor/CursorController";

export type PlaygroundObjectType =
  | "rectangle"
  | "circle"
  | "triangle";

export interface PlaygroundObject {
  id: string;
  type: PlaygroundObjectType;
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

const OBJECT_SPAWN_POSITIONS: CursorPosition[] = [
  { x: 0.5, y: 0.25 },
  { x: 0.25, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0.25, y: 0.75 },
  { x: 0.5, y: 0.75 },
  { x: 0.75, y: 0.75 },
];

export class PlaygroundEngine {
  private objects: PlaygroundObject[] = [
    {
      id: "object-1",
      type: "rectangle",
      position: { x: 0.25, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
    {
      id: "object-2",
      type: "rectangle",
      position: { x: 0.5, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
    {
      id: "object-3",
      type: "rectangle",
      position: { x: 0.75, y: 0.5 },
      halfSize: 0.09,
      rotation: 0,
    },
  ];

  private nextObjectId = 4;

  private selectedObjectId: string | null = null;
  private isDragging = false;
  private isResizing = false;
  private isRotating = false;

  private previousPinching = false;
  private pinchLostAt: number | null = null;

  private aspectRatio = 1;

  private grabOffset: CursorPosition = {
    x: 0,
    y: 0,
  };

  private previousHandDistance: number | null = null;
  private previousHandAngle: number | null = null;

  addObject(
    position?: CursorPosition,
    type: PlaygroundObjectType = "rectangle"
  ): PlaygroundState {
    if (this.isDragging) {
      return this.getState();
    }

    const spawnIndex =
      (this.nextObjectId - 4) % OBJECT_SPAWN_POSITIONS.length;

    const spawnPosition =
      position ?? OBJECT_SPAWN_POSITIONS[spawnIndex];

    const object: PlaygroundObject = {
      id: `object-${this.nextObjectId}`,
      type,
      position: { ...spawnPosition },
      halfSize: 0.09,
      rotation: 0,
    };

    this.nextObjectId++;

    this.clampObjectPosition(object, this.aspectRatio);

    this.objects.push(object);
    this.selectedObjectId = object.id;

    return this.getState();
  }

  removeSelectedObject(): PlaygroundState {
    if (this.isDragging || !this.selectedObjectId) {
      return this.getState();
    }

    this.objects = this.objects.filter(
      (object) => object.id !== this.selectedObjectId
    );

    this.selectedObjectId = null;

    return this.getState();
  }

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

    this.aspectRatio = safeAspectRatio;

    const now = performance.now();

    const pinchStarted =
      isPinching && !this.previousPinching;

    if (pinchStarted && !this.isDragging) {
      const target = this.findObjectAt(
        cursor,
        safeAspectRatio
      );

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
      } else {
        this.selectedObjectId = null;
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

        this.clampObjectPosition(
          selectedObject,
          safeAspectRatio
        );

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

          this.clampObjectPosition(
            selectedObject,
            safeAspectRatio
          );
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

  private getLocalVertices(
    object: PlaygroundObject,
    aspectRatio: number
  ): CursorPosition[] {
    const size = object.halfSize;

    if (object.type === "triangle") {
      const halfWidth = (Math.sqrt(3) / 2) * size;

      return [
        { x: 0, y: -size },
        { x: halfWidth * aspectRatio, y: size / 2 },
        { x: -halfWidth * aspectRatio, y: size / 2 },
      ];
    }

    return [
      { x: -size * aspectRatio, y: -size },
      { x: size * aspectRatio, y: -size },
      { x: size * aspectRatio, y: size },
      { x: -size * aspectRatio, y: size },
    ];
  }

  private getObjectExtents(
    object: PlaygroundObject,
    aspectRatio: number
  ): CursorPosition {
    if (object.type === "circle") {
      return {
        x: object.halfSize / aspectRatio,
        y: object.halfSize,
      };
    }

    const vertices = this.getLocalVertices(
      object,
      aspectRatio
    );

    const cos = Math.cos(object.rotation);
    const sin = Math.sin(object.rotation);

    let maxX = 0;
    let maxY = 0;

    for (const vertex of vertices) {
      const rotatedX =
        vertex.x * cos - vertex.y * sin;

      const rotatedY =
        vertex.x * sin + vertex.y * cos;

      maxX = Math.max(maxX, Math.abs(rotatedX));
      maxY = Math.max(maxY, Math.abs(rotatedY));
    }

    return {
      x: maxX / aspectRatio,
      y: maxY,
    };
  }

  private clampObjectPosition(
    object: PlaygroundObject,
    aspectRatio: number
  ): void {
    const safeAspectRatio =
      Number.isFinite(aspectRatio) && aspectRatio > 0
        ? aspectRatio
        : 1;

    const extents = this.getObjectExtents(
      object,
      safeAspectRatio
    );

    object.position = {
      x: this.clamp(
        object.position.x,
        extents.x,
        1 - extents.x
      ),
      y: this.clamp(
        object.position.y,
        extents.y,
        1 - extents.y
      ),
    };
  }

  private isPointInsidePolygon(
    point: CursorPosition,
    vertices: CursorPosition[]
  ): boolean {
    let inside = false;

    for (
      let i = 0, j = vertices.length - 1;
      i < vertices.length;
      j = i++
    ) {
      const current = vertices[i];
      const previous = vertices[j];

      const intersects =
        current.y > point.y !== previous.y > point.y &&
        point.x <
          ((previous.x - current.x) *
            (point.y - current.y)) /
            (previous.y - current.y) +
            current.x;

      if (intersects) {
        inside = !inside;
      }
    }

    return inside;
  }

  private isPointInsideObject(
    object: PlaygroundObject,
    localX: number,
    localY: number,
    aspectRatio: number
  ): boolean {
    if (object.type === "circle") {
      return (
        localX * localX + localY * localY <=
        object.halfSize * object.halfSize
      );
    }

    const vertices = this.getLocalVertices(
      object,
      aspectRatio
    );

    return this.isPointInsidePolygon(
      { x: localX, y: localY },
      vertices
    );
  }

  private resetInteraction(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.isRotating = false;
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
    for (
      let index = this.objects.length - 1;
      index >= 0;
      index--
    ) {
      const object = this.objects[index];

      const deltaX =
        (cursor.x - object.position.x) * aspectRatio;

      const deltaY =
        cursor.y - object.position.y;

      const cos = Math.cos(object.rotation);
      const sin = Math.sin(object.rotation);

      const localX = deltaX * cos + deltaY * sin;
      const localY = -deltaX * sin + deltaY * cos;

      if (
        this.isPointInsideObject(
          object,
          localX,
          localY,
          aspectRatio
        )
      ) {
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
