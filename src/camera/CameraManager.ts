
export interface CameraDevice {
  deviceId: string;
  label: string;
}

export class CameraManager {
  private stream: MediaStream | null = null;

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

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      video.srcObject = this.stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();
    } catch (error) {
      this.stop();

      throw new Error(
        `Não foi possível iniciar a câmera: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());

    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}
