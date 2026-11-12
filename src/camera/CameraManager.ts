
export interface CameraDevice {
  deviceId: string;
  label: string;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private operationId = 0;

  async getAvailableCameras(): Promise<CameraDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();

    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || "Câmera sem identificação",
      }));
  }

  async start(
    video: HTMLVideoElement,
    deviceId?: string
  ): Promise<void> {
    this.stop();

    const currentOperation = ++this.operationId;
    this.videoElement = video;

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };

    let newStream: MediaStream | null = null;

    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      if (currentOperation !== this.operationId) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stream = newStream;

      video.srcObject = newStream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      // Operações antigas não podem interromper a câmera atual.
      if (currentOperation !== this.operationId) {
        return;
      }
    } catch (error) {
      // Uma operação obsoleta não deve afetar a operação atual.
      if (currentOperation !== this.operationId) {
        newStream?.getTracks().forEach((track) => track.stop());
        return;
      }

      this.stop();

      throw new Error(
        `Não foi possível iniciar a câmera: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  stop(): void {
    this.operationId++;

    this.stream?.getTracks().forEach((track) => track.stop());

    this.stream = null;

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.videoElement = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}
