import { describe, expect, it } from "vitest";
import { TrackingMetrics } from "../../src/metrics/TrackingMetrics";

const hand = (handedness: string, x = 0.5, y = 0.5) => ({
  handedness,
  wrist: { x, y },
});

describe("TrackingMetrics — rótulos de lateralidade", () => {
  it("começa zerado", () => {
    const snapshot = new TrackingMetrics().getSnapshot(0);

    expect(snapshot.handFrames).toBe(0);
    expect(snapshot.duplicateLabelFrames).toBe(0);
    expect(snapshot.labelSwitchCount).toBe(0);
  });

  it("conta frames com mãos detectadas", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([], 1);
    metrics.recordHands([hand("Right")], 2);
    metrics.recordHands([hand("Right"), hand("Left", 0.2)], 3);

    expect(metrics.getSnapshot(4).handFrames).toBe(2);
  });

  it("conta frames com rótulos duplicados", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Right", 0.2), hand("Right", 0.8)], 1);
    metrics.recordHands([hand("Right", 0.2), hand("Left", 0.8)], 2);

    expect(metrics.getSnapshot(3).duplicateLabelFrames).toBe(1);
  });

  it("não considera rótulos Unknown como duplicados", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Unknown", 0.2), hand("Unknown", 0.8)], 1);

    expect(metrics.getSnapshot(2).duplicateLabelFrames).toBe(0);
  });

  it("conta troca de rótulo quando a mesma mão muda de Right para Left", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Right", 0.5, 0.5)], 1);
    metrics.recordHands([hand("Left", 0.52, 0.5)], 2);
    metrics.recordHands([hand("Right", 0.53, 0.5)], 3);

    expect(metrics.getSnapshot(4).labelSwitchCount).toBe(2);
  });

  it("não conta troca quando a posição mudou muito (outra mão)", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Right", 0.1, 0.5)], 1);
    metrics.recordHands([hand("Left", 0.9, 0.5)], 2);

    expect(metrics.getSnapshot(3).labelSwitchCount).toBe(0);
  });

  it("não conta troca quando há mais de uma mão", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Right", 0.2), hand("Left", 0.8)], 1);
    metrics.recordHands([hand("Left", 0.2), hand("Right", 0.8)], 2);

    expect(metrics.getSnapshot(3).labelSwitchCount).toBe(0);
  });

  it("zera os contadores no reset", () => {
    const metrics = new TrackingMetrics();

    metrics.recordHands([hand("Right"), hand("Right", 0.9)], 1);
    metrics.reset();

    const snapshot = metrics.getSnapshot(2);

    expect(snapshot.handFrames).toBe(0);
    expect(snapshot.duplicateLabelFrames).toBe(0);
    expect(snapshot.labelSwitchCount).toBe(0);
  });

  it("rejeita timestamp inválido", () => {
    expect(() =>
      new TrackingMetrics().recordHands([], Number.NaN)
    ).toThrow();
  });
});
