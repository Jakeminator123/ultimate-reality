"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import common from "../giv-plats-4/deal.module.css";
import styles from "./dance.module.css";

const edition = "/rorelseprov-dans/v1/";
const fps = 24;
const lastFrame = 95;
const moments = [[12, "Blinkningen"], [64, "Hoppets topp"], [68, "Landningen"]] as const;

export default function DanceFilms({ resultUrl }: { resultUrl: string | null }) {
  const source = useRef<HTMLVideoElement>(null);
  const result = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [error, setError] = useState("");
  const ready = sourceReady && (!resultUrl || resultReady);

  useEffect(() => {
    // A cached MP4 can finish loading before hydration attaches onLoadedData.
    setSourceReady((source.current?.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA);
    setResultReady((result.current?.readyState ?? 0) >= HTMLMediaElement.HAVE_CURRENT_DATA);
  }, [resultUrl]);

  useEffect(() => {
    if (!playing) return;
    let task = 0;
    function tick() {
      const film = source.current;
      const other = result.current;
      if (!film || film.paused) return;
      setFrame(Math.min(lastFrame, Math.floor(film.currentTime * fps)));
      if (other && !other.seeking && !other.ended && Math.abs(film.currentTime - other.currentTime) > 1 / fps)
        other.currentTime = Math.min(film.currentTime, other.duration);
      task = requestAnimationFrame(tick);
    }
    task = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(task);
  }, [playing]);

  function pause() {
    source.current?.pause();
    result.current?.pause();
    setPlaying(false);
  }

  function seek(index: number) {
    pause();
    const time = (index + .1) / fps;
    for (const film of [source.current, result.current]) {
      if (film && Number.isFinite(film.duration)) film.currentTime = Math.min(time, film.duration);
    }
    setFrame(index);
  }

  async function toggle() {
    if (playing) {
      seek(Math.min(lastFrame, Math.floor((source.current?.currentTime ?? 0) * fps)));
      return;
    }
    if (frame === lastFrame || source.current?.ended) seek(0);
    try {
      await Promise.all([source.current?.play(), result.current?.play()]);
      setPlaying(true);
    } catch {
      pause();
      setError("Webbläsaren kunde inte spela filmerna tillsammans.");
    }
  }

  return <>
    <div className={styles.films}>
      <section>
        <h2>Paulinas 3D-rigg</h2>
        <video ref={source} src={edition + "rorelsereferens.mp4"} muted playsInline preload="auto"
          aria-label="Rörelsefilmen från Paulinas 3D-rigg" onLoadedData={() => setSourceReady(true)}
          onEnded={() => seek(lastFrame)}
          onError={() => setError("Rörelsefilmen gick inte att läsa.")} />
      </section>
      {resultUrl && <section>
        <h2>Kling 4 via Runway</h2>
        <video ref={result} src={resultUrl} muted playsInline preload="auto"
          aria-label="Runways film från ståfotot och rörelsefilmen" onLoadedData={() => setResultReady(true)}
          onError={() => setError("Kling-filmen gick inte att läsa.")} />
      </section>}
    </div>
    <div className={common.scrub}>
      <button className={common.play} type="button" onClick={() => void toggle()} disabled={!ready}>
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        {playing ? "Pausa" : resultUrl ? "Spela båda" : "Spela riggen"}
      </button>
      <label htmlFor="dansruta">Riggens ruta <output>{frame}</output> · {(frame / fps).toLocaleString("sv-SE", {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      })} s</label>
      <input id="dansruta" type="range" min={0} max={lastFrame} value={frame}
        disabled={!ready} onChange={event => seek(Number(event.target.value))} />
    </div>
    <div className={common.moments + " " + styles.moments} role="group" aria-label="Ögonblick i riggens rörelse">
      {moments.map(([index, label]) => <button type="button" key={index} aria-pressed={frame === index}
        disabled={!ready} onClick={() => seek(index)}>{label} · ruta {index}</button>)}
    </div>
    {error && <p role="alert">{error}</p>}
  </>;
}
