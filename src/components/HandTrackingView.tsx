
import { useEffect, useRef, useState } from "react";
import { CameraManager } from "../camera/CameraManager";
import { HandTracker } from "../tracking/HandTracker";
import { HAND_CONNECTIONS } from "../tracking/HandLandmarks";
import { GestureEngine } from "../gestures/GestureEngine";
import type { HandGesture } from "../gestures/GestureEngine";
import { InteractionEngine } from "../interaction/InteractionEngine";
import { ActionEngine } from "../actions/ActionEngine";
import type { ActionExecutionResult } from "../actions/ActionEngine";
import type { CursorPosition } from "../cursor/CursorController";
import { OneEuroCursorController } from "../cursor/OneEuroCursorController";
import { PlaygroundEngine } from "../playground/PlaygroundEngine";
import type {
  PlaygroundState,
  PlaygroundObjectType,
} from "../playground/PlaygroundEngine";
import { TrackingMetrics } from "../metrics/TrackingMetrics";
import "./HandTrackingView.css";

type TrackingStatus = "initializing" | "running" | "error";

const HAND_COLORS = {
  Left: "#22D3EE",
  Right: "#A78BFA",
  Unknown: "#FFFFFF",
} as const;

const GESTURE_LABELS = {
  OPEN_HAND: "Mão aberta",
  FIST: "Punho fechado",
  PINCH: "Pinça",
  UNKNOWN: "Gesto não identificado",
} as const;

const INITIAL_PLAYGROUND_STATE: PlaygroundState = {
  objects: [
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
  ],
  selectedObjectId: null,
  isDragging: false,
  isResizing: false,
  isRotating: false,
};

export function HandTrackingView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const playgroundEngineRef = useRef<PlaygroundEngine | null>(null);
  const playgroundUiRef = useRef<PlaygroundState>(
    INITIAL_PLAYGROUND_STATE
  );

  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [handCount, setHandCount] = useState(0);
  const [gestures, setGestures] = useState<HandGesture[]>([]);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] =
    useState<ActionExecutionResult | null>(null);
  const [cursorActive, setCursorActive] = useState(false);

  const [playgroundState, setPlaygroundState] =
    useState<PlaygroundState>(INITIAL_PLAYGROUND_STATE);

  /**
   * Sincroniza o estado visual do Playground somente quando
   * há mudanças relevantes para a interface.
   *
   * A movimentação contínua dos objetos permanece no Canvas,
   * sem provocar renderizações React a cada frame.
   */
  function syncPlaygroundState(next: PlaygroundState) {
    const previous = playgroundUiRef.current;

    const objectsChanged =
      previous.objects.length !== next.objects.length ||
      previous.objects.some(
        (object, index) => object.id !== next.objects[index]?.id
      );

    const changed =
      objectsChanged ||
      previous.selectedObjectId !== next.selectedObjectId ||
      previous.isDragging !== next.isDragging ||
      previous.isResizing !== next.isResizing ||
      previous.isRotating !== next.isRotating;

    if (!changed) return;

    playgroundUiRef.current = next;
    setPlaygroundState(next);
  }

  useEffect(() => {
    const camera = new CameraManager();
    const tracker = new HandTracker();
    const gestureEngine = new GestureEngine();
    const interactionEngine = new InteractionEngine();
    const actionEngine = new ActionEngine();

    const cursorController = new OneEuroCursorController({
      minCutoff: 10,
      beta: 4,
    });

    const playgroundEngine = new PlaygroundEngine();
    playgroundEngineRef.current = playgroundEngine;

    const trackingMetrics = new TrackingMetrics();

    let active = true;
    let animationId = 0;
    let lastVideoTime = -1;
    let lastCursorPosition: CursorPosition | null = null;

    let consecutiveFrameErrors = 0;
    const MAX_CONSECUTIVE_FRAME_ERRORS = 3;

    async function startTracking() {
      try {
        const video = videoRef.current;

        if (!video) {
          throw new Error("Elemento de vídeo não encontrado.");
        }

        await tracker.initialize();

        if (!active) {
          tracker.close();
          return;
        }

        await camera.start(video);

        if (!active) {
          camera.stop();
          tracker.close();
          return;
        }

        setStatus("running");

        function processFrame() {
          if (!active) return;

          try {
            const currentVideo = videoRef.current;
            const canvas = canvasRef.current;

            if (!currentVideo || !canvas) return;
            if (currentVideo.readyState < 2) return;
            if (currentVideo.currentTime === lastVideoTime) return;

            lastVideoTime = currentVideo.currentTime;

            const frameStartedAt = performance.now();

            const context = canvas.getContext("2d");

            if (!context) {
              throw new Error(
                "Não foi possível obter o contexto 2D do Canvas."
              );
            }

            if (
              canvas.width !== currentVideo.videoWidth ||
              canvas.height !== currentVideo.videoHeight
            ) {
              canvas.width = currentVideo.videoWidth;
              canvas.height = currentVideo.videoHeight;

              if (containerRef.current) {
                containerRef.current.style.aspectRatio =
                  `${currentVideo.videoWidth} / ${currentVideo.videoHeight}`;
              }
            }

            const canvasAspectRatio = canvas.width / canvas.height;

            // Inferência do MediaPipe.
            const inferenceStartedAt = performance.now();
            const hands = tracker.detect(currentVideo);
            const inferenceMs = performance.now() - inferenceStartedAt;

            // Reconhecimento de gestos.
            const gestureFrame = gestureEngine.process(hands);
            const currentGestures = gestureFrame.hands;

            // Processamento de eventos de interação.
            gestureFrame.events.forEach((event) => {
              const interaction = interactionEngine.process(event);

              if (!interaction) return;

              const result = actionEngine.execute(interaction);
              setActionResult(result);
            });

            const isActive = actionEngine.getMode() === "ACTIVE";

            const rightHand = hands.find(
              (hand) => hand.handedness === "Right"
            );

            const trackingTimestamp = performance.now();

            trackingMetrics.recordTracking(
              Boolean(rightHand),
              trackingTimestamp
            );

            const leftHand = hands.find(
              (hand) => hand.handedness === "Left"
            );

            const leftIndexTip = leftHand?.landmarks[8];

            const secondaryHandPosition = leftIndexTip
              ? {
                  x: leftIndexTip.x,
                  y: leftIndexTip.y,
                }
              : null;

            const rightHandGesture =
              currentGestures.find(
                (hand) => hand.handedness === "Right"
              ) ??
              gestureFrame.missingHands.find(
                (hand) => hand.handedness === "Right"
              );

            const isPinching =
              rightHandGesture?.result.gesture === "PINCH";

            const rightHandTemporarilyMissing =
              gestureFrame.missingHands.some(
                (hand) => hand.handedness === "Right"
              );

            // Atualização do cursor One Euro.
            if (isActive && rightHand) {
              const indexTip = rightHand.landmarks[8];

              if (indexTip) {
                const cursorTimestamp = performance.now();

                lastCursorPosition = cursorController.update(
                  indexTip,
                  cursorTimestamp
                );

                trackingMetrics.recordCursor(
                  indexTip,
                  lastCursorPosition,
                  cursorTimestamp
                );
              } else {
                lastCursorPosition = null;
                cursorController.reset();
              }
            } else if (
              isActive &&
              rightHandTemporarilyMissing
            ) {
              // Preserva o último cursor durante a tolerância de tracking.
            } else {
              cursorController.reset();
              lastCursorPosition = null;
            }

            // Atualização do motor do Playground.
            const nextPlaygroundState = playgroundEngine.update(
              lastCursorPosition,
              isPinching,
              isActive,
              rightHandTemporarilyMissing
                ? null
                : secondaryHandPosition,
              canvasAspectRatio
            );

            syncPlaygroundState(nextPlaygroundState);

            // Atualiza o indicador de cursor apenas quando muda.
            const nextCursorActive = Boolean(lastCursorPosition);

            setCursorActive((previous) =>
              previous === nextCursorActive
                ? previous
                : nextCursorActive
            );

            // Atualiza a quantidade de mãos apenas quando muda.
            setHandCount((previous) =>
              previous === hands.length ? previous : hands.length
            );

            // Evita renderizações por pequenas oscilações de confiança.
            setGestures((previous) => {
              const unchanged =
                previous.length === currentGestures.length &&
                previous.every((item, index) => {
                  const current = currentGestures[index];

                  if (!current) return false;

                  const previousConfidence = Math.round(
                    item.result.confidence * 100
                  );

                  const currentConfidence = Math.round(
                    current.result.confidence * 100
                  );

                  return (
                    item.handedness === current.handedness &&
                    item.result.gesture === current.result.gesture &&
                    Math.abs(
                      previousConfidence - currentConfidence
                    ) < 5
                  );
                });

              return unchanged ? previous : currentGestures;
            });

            // Limpeza do Canvas.
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Desenho das mãos.
            for (const hand of hands) {
              const landmarks = hand.landmarks;
              const color = HAND_COLORS[hand.handedness];

              context.strokeStyle = color;
              context.fillStyle = color;
              context.lineWidth = 3;
              context.lineCap = "round";

              for (const [start, end] of HAND_CONNECTIONS) {
                const pointA = landmarks[start];
                const pointB = landmarks[end];

                if (!pointA || !pointB) continue;

                context.beginPath();

                context.moveTo(
                  pointA.x * canvas.width,
                  pointA.y * canvas.height
                );

                context.lineTo(
                  pointB.x * canvas.width,
                  pointB.y * canvas.height
                );

                context.stroke();
              }

              for (const point of landmarks) {
                context.beginPath();

                context.arc(
                  point.x * canvas.width,
                  point.y * canvas.height,
                  5,
                  0,
                  Math.PI * 2
                );

                context.fill();
              }
            }

            // Desenho dos objetos do Playground.
            for (const object of nextPlaygroundState.objects) {
              const objectX = object.position.x * canvas.width;
              const objectY = object.position.y * canvas.height;

              const objectWidth =
                object.halfSize * 2 * canvas.width;

              const objectHeight =
                object.halfSize * 2 * canvas.height;

              const isSelected =
                nextPlaygroundState.selectedObjectId === object.id;

              context.save();

              context.translate(objectX, objectY);
              context.rotate(object.rotation);

              context.shadowBlur = isSelected ? 35 : 15;

              context.shadowColor = isSelected
                ? "#4ADE80"
                : "#22D3EE";

              context.fillStyle = isSelected
                ? "rgba(74, 222, 128, 0.25)"
                : "rgba(34, 211, 238, 0.20)";

              context.strokeStyle = isSelected
                ? "#4ADE80"
                : "#22D3EE";

              context.lineWidth = isSelected ? 4 : 3;

              context.beginPath();

              context.rect(
                -objectWidth / 2,
                -objectHeight / 2,
                objectWidth,
                objectHeight
              );

              context.fill();
              context.stroke();

              context.restore();
            }

            // Desenho do cursor virtual.
            if (isActive && lastCursorPosition) {
              const cursorX =
                lastCursorPosition.x * canvas.width;

              const cursorY =
                lastCursorPosition.y * canvas.height;

              context.save();

              context.beginPath();
              context.arc(cursorX, cursorY, 13, 0, Math.PI * 2);
              context.fillStyle = "#A78BFA";
              context.fill();

              context.beginPath();
              context.arc(cursorX, cursorY, 9, 0, Math.PI * 2);
              context.fillStyle = "#FFFFFF";
              context.fill();

              context.beginPath();
              context.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
              context.fillStyle = "#080B12";
              context.fill();

              context.restore();
            }

            const frameFinishedAt = performance.now();

            trackingMetrics.recordFrame(
              inferenceMs,
              frameFinishedAt - frameStartedAt,
              frameFinishedAt
            );

            consecutiveFrameErrors = 0;
          } catch (err) {
            consecutiveFrameErrors++;

            console.warn(
              `[TRACKING] Falha no processamento (${consecutiveFrameErrors}/${MAX_CONSECUTIVE_FRAME_ERRORS})`,
              err
            );

            if (
              consecutiveFrameErrors >=
              MAX_CONSECUTIVE_FRAME_ERRORS
            ) {
              active = false;
              cancelAnimationFrame(animationId);

              camera.stop();
              tracker.close();
              cursorController.reset();

              setStatus("error");

              setError(
                `Rastreamento interrompido após ${MAX_CONSECUTIVE_FRAME_ERRORS} falhas consecutivas. ${
                  err instanceof Error
                    ? err.message
                    : "Erro desconhecido."
                }`
              );

              setHandCount(0);
              setGestures([]);
              setCursorActive(false);
            }
          } finally {
            if (active) {
              animationId = requestAnimationFrame(processFrame);
            }
          }
        }

        animationId = requestAnimationFrame(processFrame);
      } catch (err) {
        if (!active) return;

        setStatus("error");

        setError(
          err instanceof Error
            ? err.message
            : "Erro desconhecido ao iniciar o rastreamento."
        );

        camera.stop();
        tracker.close();
      }
    }

    startTracking();

    return () => {
      active = false;

      cancelAnimationFrame(animationId);

      camera.stop();
      tracker.close();
      cursorController.reset();
      trackingMetrics.reset();

      playgroundEngineRef.current = null;
    };
  }, []);

  // Adiciona um objeto ao Playground.
  function handleAddObject(
    type: PlaygroundObjectType = "rectangle"
  ) {
    const engine = playgroundEngineRef.current;

    if (!engine) return;

    const nextState = engine.addObject(undefined, type);
    syncPlaygroundState(nextState);
  }

  // Remove o objeto atualmente selecionado.
  function handleRemoveObject() {
    const engine = playgroundEngineRef.current;

    if (!engine) return;

    const nextState = engine.removeSelectedObject();
    syncPlaygroundState(nextState);
  }

  const selectedObject = playgroundState.objects.find(
    (object) => object.id === playgroundState.selectedObjectId
  );

  const canRemoveObject =
    Boolean(selectedObject) && !playgroundState.isDragging;

  const interactionLabel = playgroundState.isRotating
    ? "Rotacionando"
    : playgroundState.isResizing
      ? "Redimensionando"
      : playgroundState.isDragging
        ? "Movendo objeto"
        : "Em espera";

  return (
    <main className="studio-shell">
      <div className="studio-container">
        <header className="studio-header">
          <div className="studio-brand">
            <div className="studio-brand-mark">G</div>

            <div>
              <h1>Gesture Studio</h1>
              <p>Real-time hand tracking system</p>
            </div>
          </div>

          <div className="studio-header-status">
            <span
              className={`studio-status-dot ${
                status === "running" ? "is-running" : ""
              }`}
            />

            {status === "running"
              ? "SISTEMA OPERACIONAL"
              : status === "error"
                ? "FALHA NO SISTEMA"
                : "INICIALIZANDO"}
          </div>
        </header>

        <section className="studio-overview">
          <Metric
            label="Mãos detectadas"
            value={`${handCount} / 2`}
            accent
          />

          <Metric
            label="Modo de interação"
            value={actionResult?.mode ?? "INACTIVE"}
            active={actionResult?.mode === "ACTIVE"}
          />

          <Metric
            label="Cursor virtual"
            value={cursorActive ? "Ativo" : "Inativo"}
            active={cursorActive}
          />

          <Metric
            label="Objetos no playground"
            value={String(playgroundState.objects.length)}
            accent
          />
        </section>

        {error && (
          <div className="studio-error">
            {error}
          </div>
        )}

        <section className="studio-workspace">
          <div className="studio-panel">
            <div className="studio-panel-header">
              <div>
                <h2 className="studio-panel-title">
                  Playground
                </h2>

                <p className="studio-panel-subtitle">
                  Ambiente de interação gestual em tempo real
                </p>
              </div>

              <span className="studio-count">
                {playgroundState.objects.length} OBJETOS
              </span>
            </div>

            <div
              ref={containerRef}
              className="studio-camera-stage"
              style={{ aspectRatio: "16 / 9" }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="studio-camera-video"
              />

              <canvas
                ref={canvasRef}
                className="studio-camera-canvas"
              />

              <div className="studio-camera-overlay">
                <span
                  className={`studio-status-dot ${
                    status === "running" ? "is-running" : ""
                  }`}
                />

                {status === "running"
                  ? "LIVE TRACKING"
                  : "CAMERA STANDBY"}
              </div>
            </div>
          </div>

          <aside className="studio-panel">
            <div className="studio-panel-header">
              <div>
                <h2 className="studio-panel-title">
                  Controles
                </h2>

                <p className="studio-panel-subtitle">
                  Gerenciamento do playground
                </p>
              </div>
            </div>

            <div className="studio-side-content">
              <div>
                <p className="studio-section-label">
                  OBJETO SELECIONADO
                </p>

                <div className="studio-object-summary">
                  <div>
                    <div className="studio-section-label">
                      IDENTIFICADOR
                    </div>

                    <div className="studio-object-name">
                      {selectedObject
                        ? selectedObject.id
                            .replace("-", " ")
                            .toUpperCase()
                        : "Nenhum objeto"}
                    </div>
                  </div>

                  <span className="studio-count">
                    {selectedObject ? "01" : "00"}
                  </span>
                </div>

                <div style={{ height: 12 }} />

                <div className="studio-object-actions">
                  <button
                    type="button"
                    className="studio-button studio-button-primary"
                    onClick={() => handleAddObject("rectangle")}
                    disabled={
                      status !== "running" ||
                      playgroundState.isDragging
                    }
                  >
                    + Adicionar
                  </button>

                  <button
                    type="button"
                    className="studio-button studio-button-danger"
                    onClick={handleRemoveObject}
                    disabled={!canRemoveObject}
                  >
                    Remover
                  </button>
                </div>
              </div>

              <div className="studio-divider" />

              <div>
                <p className="studio-section-label">
                  ESTADO DA INTERAÇÃO
                </p>

                <div className="studio-object-summary">
                  <span className="studio-gesture-name">
                    {interactionLabel}
                  </span>

                  <span
                    className={`studio-status-dot ${
                      playgroundState.isDragging ||
                      playgroundState.isResizing ||
                      playgroundState.isRotating
                        ? "is-running"
                        : ""
                    }`}
                  />
                </div>
              </div>

              <div className="studio-divider" />

              <div>
                <p className="studio-section-label">
                  GESTOS RECONHECIDOS
                </p>

                <div className="studio-gesture-list">
                  {gestures.length === 0 ? (
                    <div className="studio-empty-state">
                      Aguardando detecção de mãos...
                    </div>
                  ) : (
                    gestures.map((hand, index) => (
                      <div
                        key={`${hand.handedness}-${index}`}
                        className="studio-gesture-card"
                      >
                        <div className="studio-gesture-top">
                          <span
                            className="studio-gesture-name"
                            style={{
                              color: HAND_COLORS[hand.handedness],
                            }}
                          >
                            {GESTURE_LABELS[hand.result.gesture]}
                          </span>

                          <span className="studio-gesture-hand">
                            {hand.handedness.toUpperCase()}
                          </span>
                        </div>

                        <div className="studio-gesture-confidence">
                          Confiança:{" "}
                          {(hand.result.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {actionResult && (
                <>
                  <div className="studio-divider" />

                  <div className="studio-action-card">
                    <p className="studio-section-label">
                      ÚLTIMA AÇÃO
                    </p>

                    <p className="studio-action-title">
                      {actionResult.action}
                    </p>

                    <p className="studio-action-message">
                      {actionResult.message}
                    </p>
                  </div>
                </>
              )}
            </div>
          </aside>
        </section>

        <footer className="studio-footer">
          <span>
            GESTURE STUDIO · INTERACTIVE VISION
          </span>

          <span>
            HAND TRACKING ENGINE
          </span>
        </footer>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  active = false,
  accent = false,
}: {
  label: string;
  value: string;
  active?: boolean;
  accent?: boolean;
}) {
  const valueClass = [
    "studio-metric-value",
    active ? "is-active" : "",
    accent ? "is-accent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="studio-metric">
      <div className="studio-metric-label">
        {label}
      </div>

      <div className={valueClass}>
        {value}
      </div>
    </div>
  );
}
