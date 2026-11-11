
import { useEffect, useRef, useState } from "react";
import { CameraManager } from "../camera/CameraManager";
import { HandTracker } from "../tracking/HandTracker";
import { HAND_CONNECTIONS } from "../tracking/HandLandmarks";
import { GestureEngine } from "../gestures/GestureEngine";
import type { HandGesture } from "../gestures/GestureEngine";
import { InteractionEngine } from "../interaction/InteractionEngine";
import { ActionEngine } from "../actions/ActionEngine";
import type { ActionExecutionResult } from "../actions/ActionEngine";
import { CursorController } from "../cursor/CursorController";
import type { CursorPosition } from "../cursor/CursorController";
import { PlaygroundEngine } from "../playground/PlaygroundEngine";

type TrackingStatus = "initializing" | "running" | "error";

const HAND_COLORS = {
  Left: "#00E5FF",
  Right: "#B388FF",
  Unknown: "#FFFFFF",
} as const;

const GESTURE_LABELS = {
  OPEN_HAND: "MÃO ABERTA",
  FIST: "PUNHO FECHADO",
  PINCH: "PINÇA",
  UNKNOWN: "GESTO NÃO IDENTIFICADO",
} as const;

export function HandTrackingView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<TrackingStatus>("initializing");
  const [handCount, setHandCount] = useState(0);
  const [gestures, setGestures] = useState<HandGesture[]>([]);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] =
    useState<ActionExecutionResult | null>(null);
  const [cursorPosition, setCursorPosition] =
    useState<CursorPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const camera = new CameraManager();
    const tracker = new HandTracker();
    const gestureEngine = new GestureEngine();
    const interactionEngine = new InteractionEngine();
    const actionEngine = new ActionEngine();
    const cursorController = new CursorController();
    const playgroundEngine = new PlaygroundEngine();

    let active = true;
    let animationId = 0;
    let lastVideoTime = -1;
    let lastCursorPosition: CursorPosition | null = null;
    let previousDragging = false;

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

          animationId = requestAnimationFrame(processFrame);

          const currentVideo = videoRef.current;
          const canvas = canvasRef.current;

          if (!currentVideo || !canvas) return;
          if (currentVideo.readyState < 2) return;
          if (currentVideo.currentTime === lastVideoTime) return;

          lastVideoTime = currentVideo.currentTime;

          const context = canvas.getContext("2d");
          if (!context) return;

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

          const hands = tracker.detect(currentVideo);
          const gestureFrame = gestureEngine.process(hands);
          const currentGestures = gestureFrame.hands;

          gestureFrame.events.forEach((event) => {
            const interaction = interactionEngine.process(event);

            if (!interaction) return;

            const result = actionEngine.execute(interaction);

            setActionResult(result);

            console.log("[INTERACTION]", interaction);
            console.log("[ACTION EXECUTED]", result);
          });

          const isActive = actionEngine.getMode() === "ACTIVE";

          const rightHand = hands.find(
            (hand) => hand.handedness === "Right"
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

          const rightHandGesture = currentGestures.find(
            (hand) => hand.handedness === "Right"
          );

          const isPinching =
            rightHandGesture?.result.gesture === "PINCH";

          if (isActive && rightHand) {
            const indexTip = rightHand.landmarks[8];

            if (indexTip) {
              lastCursorPosition = cursorController.update(indexTip);
            } else {
              lastCursorPosition = null;
              cursorController.reset();
            }
          } else {
            cursorController.reset();
            lastCursorPosition = null;
          }

          const playgroundState = playgroundEngine.update(
  lastCursorPosition,
  isPinching,
  isActive,
  secondaryHandPosition
);

          if (previousDragging !== playgroundState.isDragging) {
            previousDragging = playgroundState.isDragging;
            setIsDragging(previousDragging);

            console.log(
              "[PLAYGROUND]",
              previousDragging ? "OBJECT GRABBED" : "OBJECT RELEASED"
            );
          }

          setCursorPosition((previous) => {
            if (
              previous?.x === lastCursorPosition?.x &&
              previous?.y === lastCursorPosition?.y
            ) {
              return previous;
            }

            return lastCursorPosition
              ? { ...lastCursorPosition }
              : null;
          });

          setHandCount((current) =>
            current === hands.length ? current : hands.length
          );

          setGestures((previous) => {
            const unchanged =
              previous.length === currentGestures.length &&
              previous.every(
                (item, index) =>
                  item.handedness === currentGestures[index].handedness &&
                  item.result.gesture ===
                    currentGestures[index].result.gesture
              );

            return unchanged ? previous : currentGestures;
          });

          context.clearRect(0, 0, canvas.width, canvas.height);

          // Desenho das mãos
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

          // Objetos interativos do Playground
          for (const object of playgroundState.objects) {
            const objectX = object.position.x * canvas.width;
            const objectY = object.position.y * canvas.height;

            const objectWidth =
              object.halfSize * 2 * canvas.width;

            const objectHeight =
              object.halfSize * 2 * canvas.height;

            const isSelected =
              playgroundState.selectedObjectId === object.id;

            context.save();

            context.shadowBlur = isSelected ? 35 : 15;
            context.shadowColor = isSelected
              ? "#4ADE80"
              : "#00E5FF";

            context.fillStyle = isSelected
              ? "rgba(74, 222, 128, 0.25)"
              : "rgba(0, 229, 255, 0.20)";

            context.strokeStyle = isSelected
              ? "#4ADE80"
              : "#00E5FF";

            context.lineWidth = isSelected ? 4 : 3;

            context.beginPath();
            context.rect(
              objectX - objectWidth / 2,
              objectY - objectHeight / 2,
              objectWidth,
              objectHeight
            );

            context.fill();
            context.stroke();

            context.restore();
          }

          // Cursor virtual
          if (isActive && lastCursorPosition) {
            const cursorX =
              lastCursorPosition.x * canvas.width;

            const cursorY =
              lastCursorPosition.y * canvas.height;

            context.beginPath();
            context.arc(cursorX, cursorY, 13, 0, Math.PI * 2);
            context.fillStyle = "#FFFFFF";
            context.fill();

            context.beginPath();
            context.arc(cursorX, cursorY, 9, 0, Math.PI * 2);
            context.fillStyle = "#00E5FF";
            context.fill();

            context.beginPath();
            context.arc(cursorX, cursorY, 3, 0, Math.PI * 2);
            context.fillStyle = "#080B12";
            context.fill();
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
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080B12",
        color: "#E5E7EB",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ color: "#00E5FF", marginBottom: "8px" }}>
          GESTURE STUDIO
        </h1>

        <p style={{ color: "#8B95A7" }}>
          Real-time hand tracking system
        </p>
      </header>

      <section
        style={{
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div>
          <small style={{ color: "#8B95A7" }}>STATUS</small>
          <p>
            {status === "running"
              ? "TRACKING ACTIVE"
              : status.toUpperCase()}
          </p>
        </div>

        <div>
          <small style={{ color: "#8B95A7" }}>HANDS DETECTED</small>
          <p>{handCount} / 2</p>
        </div>

        <div>
          <small style={{ color: "#8B95A7" }}>INTERACTION MODE</small>
          <p
            style={{
              color:
                actionResult?.mode === "ACTIVE" ? "#4ADE80" : "#F87171",
              fontWeight: "bold",
            }}
          >
            {actionResult?.mode ?? "INACTIVE"}
          </p>
        </div>

        <div>
          <small style={{ color: "#8B95A7" }}>VIRTUAL CURSOR</small>
          <p style={{ color: cursorPosition ? "#4ADE80" : "#8B95A7" }}>
            {cursorPosition ? "ACTIVE" : "INACTIVE"}
          </p>
        </div>

        <div>
          <small style={{ color: "#8B95A7" }}>OBJECT</small>
          <p style={{ color: isDragging ? "#4ADE80" : "#8B95A7" }}>
            {isDragging ? "DRAGGING" : "IDLE"}
          </p>
        </div>
      </section>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {gestures.length === 0 ? (
          <p style={{ color: "#8B95A7" }}>
            Aguardando detecção de mãos...
          </p>
        ) : (
          gestures.map((hand, index) => (
            <div
              key={`${hand.handedness}-${index}`}
              style={{
                background: "#151D2B",
                border: `1px solid ${HAND_COLORS[hand.handedness]}`,
                borderRadius: "8px",
                padding: "12px 16px",
                minWidth: "180px",
              }}
            >
              <small style={{ color: "#8B95A7" }}>
                {hand.handedness.toUpperCase()}
              </small>

              <p
                style={{
                  color: HAND_COLORS[hand.handedness],
                  fontWeight: "bold",
                  margin: "8px 0",
                }}
              >
                {GESTURE_LABELS[hand.result.gesture]}
              </p>

              <small style={{ color: "#8B95A7" }}>
                Confiança: {(hand.result.confidence * 100).toFixed(0)}%
              </small>
            </div>
          ))
        )}
      </section>

      {actionResult && (
        <section
          style={{
            background: "#151D2B",
            border: "1px solid #263449",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "20px",
            maxWidth: "500px",
          }}
        >
          <small style={{ color: "#8B95A7" }}>
            ÚLTIMA AÇÃO
          </small>

          <p style={{ fontWeight: "bold", margin: "8px 0" }}>
            {actionResult.action}
          </p>

          <p style={{ color: "#8B95A7", margin: "4px 0" }}>
            {actionResult.message}
          </p>

          <small
            style={{
              color:
                actionResult.status === "SIMULATED"
                  ? "#4ADE80"
                  : "#FBBF24",
            }}
          >
            {actionResult.status}
          </small>
        </section>
      )}

      {error && (
        <p style={{ color: "#FF6B6B", marginBottom: "16px" }}>
          {error}
        </p>
      )}

      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1100px",
          aspectRatio: "16 / 9",
          overflow: "hidden",
          border: "1px solid #263449",
          borderRadius: "12px",
          background: "#111827",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            transform: "scaleX(-1)",
          }}
        />

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)",
            pointerEvents: "none",
          }}
        />
      </div>
    </main>
  );
}
