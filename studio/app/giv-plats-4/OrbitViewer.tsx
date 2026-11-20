"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { orbitIndex, positions, stepDeg } from "./orbit-cameras.mjs";
import styles from "./orbit-viewer.module.css";

export type OrbitCut = "helbild" | "hander" | "ansikte";
export type OrbitViewerProps = {
  sceneUrl: string;
  frame: number;
  fps: number;
  initialAngle?: number;
  onAngleChange?: (index: number) => void;
  cut: OrbitCut;
  onCutChange?: (cut: OrbitCut) => void;
  onReadyChange?: (ready: boolean) => void;
  label?: string;
};

type Runtime = Awaited<ReturnType<typeof import("./orbit-runtime.mjs")["createOrbitScene"]>>;

export function OrbitViewer({
  sceneUrl, frame, fps, initialAngle = 0, cut, onAngleChange, onCutChange, onReadyChange,
  label = "Paulinas giv från 120 vinklar",
}: OrbitViewerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [angle, setAngle] = useState(() => orbitIndex(initialAngle));
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [problem, setProblem] = useState("");
  const [attempt, setAttempt] = useState(0);
  const position = useRef({ frame, fps, angle, cut });
  const gesture = useRef<{ id: number; x: number; angle: number; pixelsPerStep: number } | null>(null);
  const inputId = useId();

  useEffect(() => setAngle(orbitIndex(initialAngle)), [initialAngle]);

  const paint = useCallback(() => {
    const p = position.current;
    runtime.current?.draw(p.frame, p.fps, p.angle, p.cut);
  }, []);

  useEffect(() => {
    position.current = { frame, fps, angle, cut };
    paint();
  }, [frame, fps, angle, cut, paint]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const controller = new AbortController();
    setStatus("loading");
    onReadyChange?.(false);
    setProblem("");
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    const failure = (error: unknown) => {
      if (controller.signal.aborted) return;
      setStatus("failed");
      onReadyChange?.(false);
      setProblem(error instanceof Error ? error.message : "3D-visaren kunde inte öppnas.");
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      failure(Error("Grafikanslutningen avbröts."));
    };
    const contextRestored = () => setAttempt(value => value + 1);
    element.addEventListener("webglcontextlost", contextLost);
    element.addEventListener("webglcontextrestored", contextRestored);
    (async () => {
      const { createOrbitScene } = await import("./orbit-runtime.mjs");
      if (controller.signal.aborted) return;
      const loaded = await createOrbitScene(element, sceneUrl, controller.signal);
      if (controller.signal.aborted) { loaded.dispose(); return; }
      runtime.current = loaded;
      paint();
      setStatus("ready");
      onReadyChange?.(true);
    })().catch(failure);
    return () => {
      controller.abort();
      observer.disconnect();
      element.removeEventListener("webglcontextlost", contextLost);
      element.removeEventListener("webglcontextrestored", contextRestored);
      runtime.current?.dispose();
      runtime.current = null;
      gesture.current = null;
    };
  }, [sceneUrl, attempt, paint, onReadyChange]);

  function selectAngle(number: number) {
    const next = orbitIndex(number);
    if (next === position.current.angle) return;
    position.current.angle = next;
    setAngle(next);
    onAngleChange?.(next);
  }

  return <section className={styles.viewer} aria-label={label} data-orbit-state={status}>
    <div className={styles.stage}>
      <canvas key={sceneUrl + ":" + attempt} ref={canvas} className={styles.canvas} tabIndex={0} aria-label="3D-vy. Dra i sidled eller vrid med piltangenterna."
        data-orbit-angle={angle * stepDeg} data-orbit-frame={frame} data-orbit-cut={cut}
        onPointerDown={e => {
          if (!e.isPrimary || e.button !== 0) return;
          gesture.current = { id: e.pointerId, x: e.clientX, angle, pixelsPerStep: Math.max(3, e.currentTarget.clientWidth / positions) };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const start = gesture.current;
          if (start?.id === e.pointerId) selectAngle(start.angle + Math.round((start.x - e.clientX) / start.pixelsPerStep));
        }}
        onPointerUp={e => { if (gesture.current?.id === e.pointerId) gesture.current = null; }}
        onLostPointerCapture={() => { gesture.current = null; }}
        onPointerCancel={() => { gesture.current = null; }}
        onKeyDown={e => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") {
            e.preventDefault();
            selectAngle(e.key === "Home" ? 0 : e.key === "End" ? positions - 1 : angle + (e.key === "ArrowRight" ? 1 : -1));
          }
        }}>Använd vinkelreglaget eller pilarna för att se modellen från andra håll.</canvas>
      {status !== "ready" && <div className={styles.notice} role="status">
        {status === "loading" ? "Läser Paulinas 3D-scen…" : <>{problem}
          <button type="button" onClick={() => setAttempt(value => value + 1)}>Försök igen</button></>}
      </div>}
    </div>
    <div className={styles.controls}>
      {onCutChange && <div className={styles.zoom} role="group" aria-label="Utsnitt">
        <button type="button" aria-pressed={cut === "helbild"} onClick={() => onCutChange("helbild")}>Helbild</button>
        <button type="button" aria-pressed={cut === "hander"} onClick={() => onCutChange("hander")}>Händer</button>
        <button type="button" aria-pressed={cut === "ansikte"} onClick={() => onCutChange("ansikte")}>Ansikte</button>
      </div>}
      <div className={styles.angle}>
        <label htmlFor={inputId}>Vinkel <strong>{angle * stepDeg}°</strong></label>
        <button type="button" aria-label="Föregående vinkel" onClick={() => selectAngle(angle - 1)}><ChevronLeft size={18} aria-hidden /></button>
        <input id={inputId} type="range" min={0} max={positions - 1} step={1} value={angle}
          aria-valuetext={angle * stepDeg + " grader"} onChange={e => selectAngle(Number(e.target.value))} />
        <button type="button" aria-label="Nästa vinkel" onClick={() => selectAngle(angle + 1)}><ChevronRight size={18} aria-hidden /></button>
      </div>
    </div>
  </section>;
}

export default OrbitViewer;
