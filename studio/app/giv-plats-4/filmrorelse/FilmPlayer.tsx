"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import OrbitViewer, { type OrbitCut } from "../OrbitViewer";
import styles from "../deal.module.css";

const momentLabels = {
  start: "Startgrepp", extended: "Utsträckt arm", sourceSetDown: "Kortet ligger plant",
  sourceRelease: "Släpp", end: "Slutruta",
};
type Timing = { frames: number; fps: number; moments: Array<{ label: string; frame: number }> };
const edition = "/giv-plats-4/filmrorelse/v2/";

export default function FilmPlayer() {
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
      const { frames, fps, keyframes } = await response.json();
      if (!Number.isSafeInteger(frames) || frames < 1 || !Number.isFinite(fps) || fps <= 0) throw Error();
      const moments = Object.entries(momentLabels).map(([key, label]) => ({ label, frame: keyframes?.[key] }));
      if (moments.some(m => !Number.isSafeInteger(m.frame) || m.frame < 0 || m.frame >= frames)) throw Error();
      const query = new URLSearchParams(window.location.search);
      start.current = Math.min(frames - 1, Math.max(0, Math.round(Number(query.get("ruta"))) || 0));
      angle.current = Math.round(Number(query.get("vinkel")) / 3) || 0;
      if (!controller.signal.aborted) {
        setFrame(start.current);
        setTiming({ frames, fps, moments });
      }
    }
    void load().catch(() => { if (!controller.signal.aborted) setError("Rörelsemätningen saknas på den här datorn."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const film = video.current;
    if (!timing || !film?.requestVideoFrameCallback) return;
    const { fps, frames } = timing;
    function displayed(_: number, metadata: VideoFrameCallbackMetadata) {
      setFrame(Math.min(frames - 1, Math.max(0, Math.round(metadata.mediaTime * fps))));
      callback = film!.requestVideoFrameCallback(displayed);
    }
    let callback = film.requestVideoFrameCallback(displayed);
    return () => film.cancelVideoFrameCallback(callback);
  }, [timing]);

  function seek(index: number) {
    const film = video.current;
    if (!timing || !film) return;
    film.pause();
    setFrame(index);
    film.currentTime = (index + .25) / timing.fps;
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
      <section><h2>Kling-film via Runway</h2>
        <video ref={video} className={styles.player} src="/prov-70/v1/kallfilm.mp4" preload="auto" muted playsInline
          aria-label="Filmen som användes för att mäta rörelsen"
          onLoadedMetadata={e => { e.currentTarget.currentTime = (start.current + .25) / timing.fps; }}
          onLoadedData={() => setFilmReady(true)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)} onError={() => setError("Källfilmen saknas på den här datorn.")}
          onTimeUpdate={e => {
            if (typeof e.currentTarget.requestVideoFrameCallback !== "function") {
              setFrame(Math.min(timing.frames - 1, Math.floor(e.currentTarget.currentTime * timing.fps + 1e-5)));
            }
          }} />
      </section>
      <section><h2>V4 med filmens kortgrepp</h2>
        <OrbitViewer sceneUrl={edition + "filmrorelse.glb"} frame={frame} fps={timing.fps} cut={cut} onCutChange={setCut}
          initialAngle={angle.current} onReadyChange={setModelReady} label="Filmöverföringen på Paulina V4" />
      </section>
    </div>
    <div className={styles.moments} role="group" aria-label="Händelser i källfilmen">
      {timing.moments.map(moment => <button key={moment.frame} type="button"
        disabled={!filmReady || !modelReady} aria-pressed={frame === moment.frame}
        onClick={() => seek(moment.frame)}>{moment.label} · {moment.frame}</button>)}
    </div>
    <div className={styles.scrub}>
      <button type="button" className={styles.play} onClick={toggle} disabled={!filmReady || !modelReady}>
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}{playing ? "Pausa" : "Spela båda"}
      </button>
      <label htmlFor="filmrorelse-ruta">Ruta <output>{frame}</output> av {timing.frames - 1}</label>
      <input id="filmrorelse-ruta" type="range" min={0} max={timing.frames - 1} value={frame}
        disabled={!filmReady || !modelReady} onChange={e => seek(Number(e.target.value))} />
    </div>
  </div>;
}
