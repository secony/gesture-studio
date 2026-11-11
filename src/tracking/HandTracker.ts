
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = "Left" | "Right" | "Unknown";

export interface TrackedHand {
  landmarks: HandLandmark[];
  handedness: Handedness;
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastTimestamp = 0;

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
    );

    const options = {
      baseOptions: {
        modelAssetPath: "/models/hand_landmarker.task",
        delegate: "GPU" as const,
      },
      runningMode: "VIDEO" as const,
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(
        vision,
        options
      );
    } catch (error) {
      console.warn("GPU indisponível. Tentando CPU.", error);

      this.landmarker = await HandLandmarker.createFromOptions(
        vision,
        {
          ...options,
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            delegate: "CPU",
          },
        }
      );
    }

    this.lastTimestamp = 0;
  }

  detect(video: HTMLVideoElement): TrackedHand[] {
    if (!this.landmarker) {
      throw new Error("HandTracker não inicializado.");
    }

    const timestamp = Math.max(
      performance.now(),
      this.lastTimestamp + 0.001
    );

    this.lastTimestamp = timestamp;

    const result = this.landmarker.detectForVideo(
      video,
      timestamp
    );

    return result.landmarks.map((landmarks, index) => {
      const category = result.handedness[index]?.[0]?.categoryName;

const handedness: Handedness =
  category === "Left"
    ? "Right"
    : category === "Right"
      ? "Left"
      : "Unknown";

      return {
        landmarks,
        handedness,
      };
    });
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastTimestamp = 0;
  }
}
