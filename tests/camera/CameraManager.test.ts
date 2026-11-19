import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraManager } from "../../src/camera/CameraManager";

function createStream() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;

  return { stream, track };
}

function createVideo() {
  const video = {
    srcObject: null as unknown,
    muted: false,
    playsInline: false,
    play: vi.fn().mockResolvedValue(undefined),
  };

  return video as unknown as HTMLVideoElement & typeof video;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("CameraManager", () => {
  const getUserMedia = vi.fn();
  const enumerateDevices = vi.fn();

  beforeEach(() => {
    getUserMedia.mockReset();
    enumerateDevices.mockReset();

    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia, enumerateDevices },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lista apenas câmeras e usa rótulo padrão quando não há nome", async () => {
    enumerateDevices.mockResolvedValue([
      { kind: "videoinput", deviceId: "a", label: "Webcam HD" },
      { kind: "audioinput", deviceId: "b", label: "Microfone" },
      { kind: "videoinput", deviceId: "c", label: "" },
    ]);

    expect(await new CameraManager().getAvailableCameras()).toEqual([
      { deviceId: "a", label: "Webcam HD" },
      { deviceId: "c", label: "Câmera sem identificação" },
    ]);
  });

  it("inicia a câmera, silencia o vídeo e começa a reproduzir", async () => {
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);

    const video = createVideo();
    const manager = new CameraManager();

    await manager.start(video);

    expect(video.srcObject).toBe(stream);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(manager.getStream()).toBe(stream);
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
  });

  it("exige o dispositivo escolhido quando um deviceId é informado", async () => {
    getUserMedia.mockResolvedValue(createStream().stream);

    await new CameraManager().start(createVideo(), "camera-2");

    expect(getUserMedia.mock.calls[0][0].video.deviceId).toEqual({
      exact: "camera-2",
    });
  });

  it("para as trilhas e limpa o vídeo ao parar", async () => {
    const { stream, track } = createStream();
    getUserMedia.mockResolvedValue(stream);

    const video = createVideo();
    const manager = new CameraManager();

    await manager.start(video);
    manager.stop();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(manager.getStream()).toBeNull();
  });

  it("converte falhas de getUserMedia em erro legível e libera o estado", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"));

    const manager = new CameraManager();

    await expect(manager.start(createVideo())).rejects.toThrow(
      "Não foi possível iniciar a câmera: Permission denied"
    );

    expect(manager.getStream()).toBeNull();
  });

  it("descarta a operação antiga quando uma nova começa antes dela terminar", async () => {
    const first = deferred<MediaStream>();
    const old = createStream();
    const current = createStream();

    getUserMedia
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(current.stream);

    const manager = new CameraManager();
    const video = createVideo();

    const firstStart = manager.start(video, "camera-1");
    await manager.start(video, "camera-2");

    first.resolve(old.stream);
    await firstStart;

    expect(old.track.stop).toHaveBeenCalledTimes(1);
    expect(current.track.stop).not.toHaveBeenCalled();
    expect(manager.getStream()).toBe(current.stream);
  });

  it("ignora a falha de uma operação antiga sem afetar a câmera atual", async () => {
    const first = deferred<MediaStream>();
    const current = createStream();

    getUserMedia
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(current.stream);

    const manager = new CameraManager();
    const video = createVideo();

    const firstStart = manager.start(video);
    await manager.start(video);

    first.reject(new Error("falha tardia"));

    await expect(firstStart).resolves.toBeUndefined();

    expect(current.track.stop).not.toHaveBeenCalled();
    expect(manager.getStream()).toBe(current.stream);
  });
});
