"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import OrbitViewer, { type OrbitCut } from "../OrbitViewer";
import styles from "../deal.module.css";

const momentLabels = {
  start: "Startgrepp", extended: "Utsträckt arm", sourceSetDown: "Kortet ligger plant",
  sourceRelease: "Släpp", end: "Slutruta",
};
type Timing = {
  frames: number;
  fps: number;
  moments: Array<{ label: string; frame: number }>;
  measuredFrames?: number[];
};
const films = {
  kling: {
    edition: "/giv-plats-4/filmrorelse/v2/",
    source: "/prov-70/v1/kallfilm.mp4",
    title: "Kling-film via Runway",
    model: "V4 med filmens kortgrepp",
  },
  dashboard: {
    edition: "/giv-plats-4/dashboardklipp/v1/",
    source: "/giv-plats-4/dashboardklipp/v1/original.mp4",
    title: "Originalfilm från dashboarden",
    model: "Paulina V4 med de uppmätta rörelserna",
  },
};

function readTiming(data: {
  frames: number; fps: number; keyframes?: Record<string, number>; measuredSourceFrames?: number[];
}, dashboard: boolean): Timing {
  const { frames, fps, keyframes, measuredSourceFrames } = data;
  if (!Number.isSafeInteger(frames) || frames < 1 || !Number.isFinite(fps) || fps <= 0) throw Error();
  if (dashboard) {
    if (frames !== 196 || fps !== 30 || !Array.isArray(measuredSourceFrames) ||
      measuredSourceFrames.length !== 40 || measuredSourceFrames.some((frame, i) => frame !== i * 5)) throw Error();
    return { frames, fps, moments: [], measuredFrames: measuredSourceFrames };
  }
  const moments = Object.entries(momentLabels).map(([key, label]) => ({ label, frame: keyframes?.[key] ?? -1 }));
  if (moments.some(m => !Number.isSafeInteger(m.frame) || m.frame < 0 || m.frame >= frames)) throw Error();
  return { frames, fps, moments };
}

function measurementStatus(frame: number, measured: number[]) {
  const next = measured.findIndex(value => value >= frame);
  if (measured[next] === frame) return "SAM mätte denna ruta";
  return `Interpolerad mellan ruta ${measured[next - 1]} och ${measured[next]}`;
}

function secondsLabel(frame: number, fps: number) {
  return (frame / fps).toFixed(3).replace(".", ",") + " s";
}

function seekTime(frame: number, timing: Timing) {
  if (timing.measuredFrames && (frame === 0 || frame === timing.frames - 1)) return frame / timing.fps;
  return (frame + .25) / timing.fps;
}

function stopAtLastMeasurement(film: HTMLVideoElement, timing: Timing, displayed: number) {
  if (!timing.measuredFrames || displayed < timing.frames - 1) return;
  const end = (timing.frames - 1) / timing.fps;
  if (!film.paused) film.pause();
  if (Math.abs(film.currentTime - end) > .0005) film.currentTime = end;
}

export default function FilmPlayer({ filmId = "kling" }: { filmId?: keyof typeof films }) {
  const { edition, source, title, model } = films[filmId];
  const [timing, setTiming] = useState<Timing>();
  const [frame, setFrame] = useState(0);
  const [cut, setCut] = useState<OrbitCut>("helbild");
  const [modelReady, setModelReady] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const start = useRef(0);
  const angle = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const response = await fetch(edition + "rorelsematning.json", { signal: controller.signal });
      if (!response.ok) throw Error();
      const loaded = readTiming(await response.json(), filmId === "dashboard");
      const query = new URLSearchParams(window.location.search);
      start.current = Math.min(loaded.frames - 1, Math.max(0, Math.round(Number(query.get("ruta"))) || 0));
      angle.current = Math.round(Number(query.get("vinkel")) / 3) || 0;
      if (!controller.signal.aborted) {
        setFrame(start.current);
        setTiming(loaded);
      }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("Rörelsemätningen saknas på den här datorn."); });
    return () => controller.abort();
  }, [edition, filmId]);

  useEffect(() => {
    const film = video.current;
    if (!timing || !film?.requestVideoFrameCallback) return;
    const loaded = timing;
    const player = film;
    function displayed(_: number, metadata: VideoFrameCallbackMetadata) {
      const visible = Math.round(metadata.mediaTime * loaded.fps);
      setFrame(Math.min(loaded.frames - 1, Math.max(0, visible)));
      stopAtLastMeasurement(player, loaded, visible);
      callback = player.requestVideoFrameCallback(displayed);
    }
    let callback = film.requestVideoFrameCallback(displayed);
    return () => film.cancelVideoFrameCallback(callback);
  }, [timing]);

  function seek(index: number) {
    const film = video.current;
    if (!timing || !film) return;
    film.pause();
    setFrame(index);
    film.currentTime = seekTime(index, timing);
  }

  function toggle() {
    const film = video.current;
    if (!film || !timing) return;
    if (!film.paused) { film.pause(); return; }
    if (film.ended || frame === timing.frames - 1) film.currentTime = 0;
    void film.play().catch(() => setError("Webbläsaren kunde inte spela källfilmen."));
  }

  if (error) return <p role="status">{error}</p>;
  if (!timing) return <p role="status">Läser rörelsemätningen…</p>;
  return <div className={styles.review}>
    <div className={styles.filmPair}>
      <section><h2>{title}</h2>
        <video ref={video} className={styles.player} src={source} preload="auto" muted playsInline
          aria-label="Filmen som användes för att mäta rörelsen"
          onLoadedMetadata={e => { e.currentTarget.currentTime = seekTime(start.current, timing); }}
          onLoadedData={() => setFilmReady(true)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)} onError={() => setError("Källfilmen saknas på den här datorn.")}
          onTimeUpdate={e => {
            const player = e.currentTarget;
            const visible = Math.floor(player.currentTime * timing.fps + 1e-5);
            if (timing.measuredFrames && visible >= timing.frames - 1) {
              setFrame(timing.frames - 1);
              stopAtLastMeasurement(player, timing, visible);
            }
            if (typeof player.requestVideoFrameCallback !== "function") {
              setFrame(Math.min(timing.frames - 1, visible));
            }
          }} />
      </section>
      <section><h2>{model}</h2>
        <OrbitViewer sceneUrl={edition + "filmrorelse.glb"} frame={frame} fps={timing.fps} cut={cut} onCutChange={setCut}
          initialAngle={angle.current} onReadyChange={setModelReady} label="Filmöverföringen på Paulina V4" />
      </section>
    </div>
    {timing.moments.length > 0 && <div className={styles.moments} role="group" aria-label="Händelser i källfilmen">
      {timing.moments.map(moment => <button key={moment.frame} type="button"
        disabled={!filmReady || !modelReady} aria-pressed={frame === moment.frame}
        onClick={() => seek(moment.frame)}>{moment.label} · {moment.frame}</button>)}
    </div>}
    <div className={styles.scrub}>
      <button type="button" className={styles.play} onClick={toggle} disabled={!filmReady || !modelReady}>
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}{playing ? "Pausa" : "Spela båda"}
      </button>
      <label htmlFor="filmrorelse-ruta">Ruta <output>{frame}</output> av {timing.frames - 1}</label>
      <input id="filmrorelse-ruta" type="range" min={0} max={timing.frames - 1} value={frame}
        disabled={!filmReady || !modelReady} onChange={e => seek(Number(e.target.value))} />
    </div>
    {timing.measuredFrames && <>
      <output data-measurement-status aria-label="Mätstatus" aria-live={playing ? "off" : "polite"}>
        {measurementStatus(frame, timing.measuredFrames)} · {secondsLabel(frame, timing.fps)}
      </output>
      <details>
        <summary>Hoppa till en av de {timing.measuredFrames.length} mätta rutorna</summary>
        <div className={styles.moments} role="group" aria-label="Mätta källrutor">
          {timing.measuredFrames.map(index => <button key={index} type="button"
            disabled={!filmReady || !modelReady} aria-pressed={frame === index} onClick={() => seek(index)}>
            Ruta {index} · {secondsLabel(index, timing.fps)}
          </button>)}
        </div>
      </details>
    </>}
  </div>;
}
