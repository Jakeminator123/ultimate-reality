"use client";

import { useRef, useState } from "react";
import { pauseAtMark } from "../../modellering/rorelseprov/DealComparison";
import styles from "../../modeling.module.css";

type Clip = { take: string; url: string; modelUrl: string };
type Study = { before: Clip; after: Clip; parts: string[]; marks: { frame: number; seconds: number }[] };

export default function PhotoLayerComparison({ study }: { study: Study }) {
  const [side, setSide] = useState<"before" | "after">("after");
  const [unavailable, setUnavailable] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const playback = useRef({ time: 0, speed: 1, playing: false });
  const label = study.parts.join(" och ");
  const clip = study[side];

  function switchSide(next: typeof side) {
    if (next === side) return;
    const video = player.current;
    if (video && video.readyState >= 1)
      playback.current = { time: video.currentTime, speed: video.playbackRate, playing: !video.paused && !video.ended };
    setUnavailable(false);
    setSide(next);
  }

  return <article className={styles.proof}>
    <h3>{label}</h3>
    <div className={styles.archiveLinks} role="group" aria-label={"Jämför fotoytan för " + label}>
      <button type="button" aria-pressed={side === "before"} onClick={() => switchSide("before")}>Före</button>
      <button type="button" aria-pressed={side === "after"} onClick={() => switchSide("after")}>Efter</button>
    </div>
    <video key={clip.url} ref={player} src={clip.url} controls playsInline preload="metadata"
      aria-label={label + (side === "before" ? " före korrigering" : " efter korrigering")}
      onError={() => setUnavailable(true)} onLoadedMetadata={event => {
        const video = event.currentTarget, saved = playback.current;
        video.playbackRate = saved.speed;
        video.currentTime = Math.min(saved.time, video.duration);
        if (saved.playing) void video.play().catch(() => { /* Playback can be resumed using the native controls. */ });
      }}/>
    {unavailable && <p role="status">Filmen kunde inte öppnas. <a href={clip.url}>Öppna filmfilen</a></p>}
    <div className={styles.frameMarks} role="group" aria-label="Välj granskningsruta">
      {study.marks.map(mark => <button type="button" key={mark.frame} onClick={() => {
        playback.current = { ...playback.current, time: mark.seconds + 0.001, playing: false };
        if (player.current && player.current.readyState >= 1) pauseAtMark(player.current, mark.seconds);
      }}>Ruta {mark.frame}</button>)}
    </div>
    <small>Tagning <code>{clip.take}</code> · <a href={clip.modelUrl}>Hämta den animerade 3D-modellen</a></small>
  </article>;
}
