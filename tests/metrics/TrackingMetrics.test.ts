
import { describe, expect, it } from "vitest";
import { TrackingMetrics } from "../../src/metrics/TrackingMetrics";

describe("TrackingMetrics", () => {
  describe("recordFrame", () => {
    it("calcula o FPS com base no intervalo entre frames", () => {
      const metrics = new TrackingMetrics();

      metrics.recordFrame(10, 20, 0);
      metrics.recordFrame(15, 30, 100);
      metrics.recordFrame(20, 40, 200);

      const snapshot = metrics.getSnapshot(200);

      expect(snapshot.fps).toBe(10);
    });

    it("calcula média e pico dos tempos de inferência e processamento", () => {
      const metrics = new TrackingMetrics();

      metrics.recordFrame(10, 20, 0);
      metrics.recordFrame(20, 40, 100);
      metrics.recordFrame(30, 60, 200);

      const snapshot = metrics.getSnapshot(200);

      expect(snapshot.averageInferenceMs).toBe(20);
      expect(snapshot.maxInferenceMs).toBe(30);
      expect(snapshot.averageProcessingMs).toBe(40);
      expect(snapshot.maxProcessingMs).toBe(60);
    });

    it("retorna zero quando não existem amostras", () => {
      const metrics = new TrackingMetrics();
      const snapshot = metrics.getSnapshot(0);

      expect(snapshot.fps).toBe(0);
      expect(snapshot.averageInferenceMs).toBe(0);
      expect(snapshot.maxInferenceMs).toBe(0);
      expect(snapshot.averageProcessingMs).toBe(0);
      expect(snapshot.maxProcessingMs).toBe(0);
    });

    it("mantém somente a quantidade máxima de amostras", () => {
      const metrics = new TrackingMetrics({ maxSamples: 2 });

      metrics.recordFrame(10, 20, 0);
      metrics.recordFrame(20, 40, 100);
      metrics.recordFrame(30, 60, 200);

      const snapshot = metrics.getSnapshot(200);

      expect(snapshot.averageInferenceMs).toBe(25);
      expect(snapshot.averageProcessingMs).toBe(50);
      expect(snapshot.fps).toBe(10);
    });

    it("rejeita timestamps que não sejam crescentes", () => {
      const metrics = new TrackingMetrics();

      metrics.recordFrame(10, 20, 100);

      expect(() => {
        metrics.recordFrame(10, 20, 100);
      }).toThrow();

      expect(() => {
        metrics.recordFrame(10, 20, 90);
      }).toThrow();
    });

    it("rejeita durações negativas ou não finitas", () => {
      const metrics = new TrackingMetrics();

      expect(() => metrics.recordFrame(-1, 20, 0)).toThrow();
      expect(() => metrics.recordFrame(10, -1, 0)).toThrow();
      expect(() => metrics.recordFrame(Number.NaN, 20, 0)).toThrow();
      expect(() => metrics.recordFrame(10, Number.POSITIVE_INFINITY, 0)).toThrow();
    });
  });

  describe("recordCursor", () => {
    it("calcula jitter usando deslocamentos filtrados em períodos estacionários", () => {
      const metrics = new TrackingMetrics();

      metrics.recordCursor(
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
        0
      );

      metrics.recordCursor(
        { x: 0.501, y: 0.5 },
        { x: 0.502, y: 0.5 },
        16
      );

      const snapshot = metrics.getSnapshot(16);

      expect(snapshot.cursorJitter).toBeCloseTo(0.002);
      expect(snapshot.cursorJitterSamples).toBe(1);
    });

    it("ignora deslocamentos brutos acima do limite estacionário", () => {
      const metrics = new TrackingMetrics({
        stationaryThreshold: 0.004,
      });

      metrics.recordCursor(
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
        0
      );

      metrics.recordCursor(
        { x: 0.51, y: 0.5 },
        { x: 0.52, y: 0.5 },
        16
      );

      const snapshot = metrics.getSnapshot(16);

      expect(snapshot.cursorJitter).toBeNull();
      expect(snapshot.cursorJitterSamples).toBe(0);
    });

    it("rejeita timestamps que não sejam crescentes", () => {
      const metrics = new TrackingMetrics();

      metrics.recordCursor({ x: 0, y: 0 }, { x: 0, y: 0 }, 100);

      expect(() => {
        metrics.recordCursor({ x: 0, y: 0 }, { x: 0, y: 0 }, 100);
      }).toThrow();
    });

    it("rejeita coordenadas não finitas", () => {
      const metrics = new TrackingMetrics();

      expect(() => {
        metrics.recordCursor(
          { x: Number.NaN, y: 0 },
          { x: 0, y: 0 },
          0
        );
      }).toThrow();
    });
  });

  describe("recordTracking", () => {

it("não inclui perdas em andamento na duração média", () => {
  const metrics = new TrackingMetrics();

  // Primeira perda: concluída após 100 ms.
  metrics.recordTracking(true, 0);
  metrics.recordTracking(false, 100);
  metrics.recordTracking(true, 200);

  // Segunda perda: ainda em andamento.
  metrics.recordTracking(false, 300);

  const snapshot = metrics.getSnapshot(500);

  expect(snapshot.trackingLossCount).toBe(2);
  expect(snapshot.averageTrackingLossDurationMs).toBe(100);
  expect(snapshot.lastTrackingLossDurationMs).toBe(100);
  expect(snapshot.isTrackingLost).toBe(true);
  expect(snapshot.currentTrackingLossDurationMs).toBe(200);
});


it("não considera ausência inicial de mão como perda de tracking", () => {
  const metrics = new TrackingMetrics();

  metrics.recordTracking(false, 0);
  metrics.recordTracking(false, 100);
  metrics.recordTracking(true, 200);

  const snapshot = metrics.getSnapshot(200);

  expect(snapshot.trackingLossCount).toBe(0);
  expect(snapshot.isTrackingLost).toBe(false);
  expect(snapshot.lastTrackingLossDurationMs).toBe(0);
});

    it("registra uma perda e calcula sua duração após a recuperação", () => {
      const metrics = new TrackingMetrics();

      metrics.recordTracking(true, 0);
      metrics.recordTracking(false, 100);
      metrics.recordTracking(true, 350);

      const snapshot = metrics.getSnapshot(350);

      expect(snapshot.trackingLossCount).toBe(1);
      expect(snapshot.lastTrackingLossDurationMs).toBe(250);
      expect(snapshot.averageTrackingLossDurationMs).toBe(250);
      expect(snapshot.isTrackingLost).toBe(false);
      expect(snapshot.currentTrackingLossDurationMs).toBe(0);
    });

    it("mantém a duração atual enquanto o tracking está perdido", () => {
      const metrics = new TrackingMetrics();

      metrics.recordTracking(true, 0);
      metrics.recordTracking(false, 100);

      const snapshot = metrics.getSnapshot(400);

      expect(snapshot.trackingLossCount).toBe(1);
      expect(snapshot.isTrackingLost).toBe(true);
      expect(snapshot.currentTrackingLossDurationMs).toBe(300);
    });

    it("contabiliza múltiplas perdas de tracking", () => {
      const metrics = new TrackingMetrics();

      metrics.recordTracking(true, 0);
      metrics.recordTracking(false, 100);
      metrics.recordTracking(true, 200);
      metrics.recordTracking(false, 300);
      metrics.recordTracking(true, 500);

      const snapshot = metrics.getSnapshot(500);

      expect(snapshot.trackingLossCount).toBe(2);
      expect(snapshot.lastTrackingLossDurationMs).toBe(200);
      expect(snapshot.averageTrackingLossDurationMs).toBe(150);
    });
  });

  describe("reset", () => {
    it("limpa todas as métricas e estados internos", () => {
      const metrics = new TrackingMetrics();

      metrics.recordFrame(10, 20, 0);
      metrics.recordFrame(20, 40, 100);
      metrics.recordCursor(
        { x: 0.5, y: 0.5 },
        { x: 0.51, y: 0.5 },
        0
      );
      metrics.recordTracking(true, 0);
      metrics.recordTracking(false, 100);

      metrics.reset();

      const snapshot = metrics.getSnapshot(200);

      expect(snapshot.fps).toBe(0);
      expect(snapshot.averageInferenceMs).toBe(0);
      expect(snapshot.averageProcessingMs).toBe(0);
      expect(snapshot.cursorJitter).toBeNull();
      expect(snapshot.cursorJitterSamples).toBe(0);
      expect(snapshot.trackingLossCount).toBe(0);
      expect(snapshot.averageTrackingLossDurationMs).toBe(0);
      expect(snapshot.lastTrackingLossDurationMs).toBe(0);
      expect(snapshot.isTrackingLost).toBe(false);
      expect(snapshot.currentTrackingLossDurationMs).toBe(0);
    });
  });

  describe("constructor", () => {
    it("rejeita limite de amostras inválido", () => {
      expect(() => new TrackingMetrics({ maxSamples: 1 })).toThrow();
      expect(() => new TrackingMetrics({ maxSamples: 0 })).toThrow();
    });

    it("rejeita limite estacionário negativo ou não finito", () => {
      expect(() => new TrackingMetrics({ stationaryThreshold: -1 })).toThrow();
      expect(() => new TrackingMetrics({
        stationaryThreshold: Number.NaN,
      })).toThrow();
    });
  });
});
