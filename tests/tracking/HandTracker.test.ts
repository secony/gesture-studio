import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mocks.forVisionTasks },
  HandLandmarker: { createFromOptions: mocks.createFromOptions },
}));

import { HandTracker } from "../../src/tracking/HandTracker";

interface FakeLandmarker {
  detectForVideo: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function createFakeLandmarker(
  categories: Array<string | undefined> = []
): FakeLandmarker {
  return {
    detectForVideo: vi.fn(() => ({
      landmarks: categories.map(() => [{ x: 0.5, y: 0.5, z: 0 }]),
      handedness: categories.map((categoryName) =>
        categoryName === undefined ? [] : [{ categoryName }]
      ),
    })),
    close: vi.fn(),
  };
}

const video = {} as HTMLVideoElement;

describe("HandTracker", () => {
  beforeEach(() => {
    mocks.forVisionTasks.mockReset().mockResolvedValue({});
    mocks.createFromOptions.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lança erro ao detectar antes de inicializar", () => {
    expect(() => new HandTracker().detect(video)).toThrow(
      "HandTracker não inicializado."
    );
  });

  it("inicializa em modo VIDEO com duas mãos e delegate GPU", async () => {
    mocks.createFromOptions.mockResolvedValue(createFakeLandmarker());

    await new HandTracker().initialize();

    expect(mocks.createFromOptions).toHaveBeenCalledTimes(1);

    const options = mocks.createFromOptions.mock.calls[0][1];

    expect(options.runningMode).toBe("VIDEO");
    expect(options.numHands).toBe(2);
    expect(options.baseOptions.delegate).toBe("GPU");
  });

  it("recorre à CPU quando a GPU não está disponível", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mocks.createFromOptions
      .mockRejectedValueOnce(new Error("sem GPU"))
      .mockResolvedValueOnce(createFakeLandmarker());

    await new HandTracker().initialize();

    expect(mocks.createFromOptions).toHaveBeenCalledTimes(2);
    expect(
      mocks.createFromOptions.mock.calls[1][1].baseOptions.delegate
    ).toBe("CPU");
  });

  it("propaga o erro quando GPU e CPU falham", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mocks.createFromOptions.mockRejectedValue(new Error("falha"));

    await expect(new HandTracker().initialize()).rejects.toThrow("falha");
  });

  it("converte a lateralidade e usa Unknown para valores ausentes ou inválidos", async () => {
    mocks.createFromOptions.mockResolvedValue(
      createFakeLandmarker(["Left", "Right", "Other", undefined])
    );

    const tracker = new HandTracker();
    await tracker.initialize();

    expect(tracker.detect(video).map((hand) => hand.handedness)).toEqual([
      "Left",
      "Right",
      "Unknown",
      "Unknown",
    ]);
  });

  it("retorna lista vazia quando nenhuma mão é detectada", async () => {
    mocks.createFromOptions.mockResolvedValue(createFakeLandmarker([]));

    const tracker = new HandTracker();
    await tracker.initialize();

    expect(tracker.detect(video)).toEqual([]);
  });

  it("envia timestamps estritamente crescentes mesmo com relógio parado", async () => {
    const landmarker = createFakeLandmarker();
    mocks.createFromOptions.mockResolvedValue(landmarker);

    vi.spyOn(performance, "now").mockReturnValue(1000);

    const tracker = new HandTracker();
    await tracker.initialize();

    tracker.detect(video);
    tracker.detect(video);
    tracker.detect(video);

    const timestamps = landmarker.detectForVideo.mock.calls.map(
      (call) => call[1] as number
    );

    expect(timestamps[1]).toBeGreaterThan(timestamps[0]);
    expect(timestamps[2]).toBeGreaterThan(timestamps[1]);
  });

  it("fecha o landmarker e volta a exigir inicialização", async () => {
    const landmarker = createFakeLandmarker();
    mocks.createFromOptions.mockResolvedValue(landmarker);

    const tracker = new HandTracker();
    await tracker.initialize();

    tracker.close();

    expect(landmarker.close).toHaveBeenCalledTimes(1);
    expect(() => tracker.detect(video)).toThrow(
      "HandTracker não inicializado."
    );
  });
});
