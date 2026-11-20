"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { DealReference } from "../../../lib/deal-references";
import type { DealerMaterial } from "../../../lib/material-types";
import styles from "./comparison.module.css";

type Film = DealerMaterial["films"][number];
type ModelTimes = Pick<DealReference, "draw" | "push" | "handover" | "turn" | "release" | "rest">;
export type TakeComparison = { clips: readonly DealReference[]; times: ModelTimes };
const speedKey = "rorelseprov:hastighet";
const playbackSpeeds = [0.25, 0.5, 0.75, 1];

export function pauseAtMark(player: HTMLVideoElement, seconds: number) {
  player.pause();
  // MP4 seeks can round down at frame boundaries. One millisecond falls inside the marked frame.
  player.currentTime = seconds + 0.001;
}

export function PlaybackSpeed({ speed, onChange }: { speed: number; onChange: (value: number) => void }) {
  const choices = playbackSpeeds.includes(speed) ? playbackSpeeds : [...playbackSpeeds, speed].sort((a, b) => a - b);
  return <label>Hastighet{" "}
    <select value={speed} onChange={event => onChange(Number(event.target.value))}>
      {choices.map(rate => <option key={rate} value={rate}>{rate.toLocaleString("sv-SE")}×</option>)}
    </select>
  </label>;
}

export default function DealComparison({ film, modelPlayer, clips, times, viewGuide }: TakeComparison & {
  film: Film; modelPlayer: RefObject<HTMLVideoElement | null>; viewGuide?: string;
}) {
  const references = useRef<(HTMLVideoElement | null)[]>([]);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [filmControls, setFilmControls] = useState(false);
  const [speed, setSpeed] = useState(1);
  const pair = clips.length === 1;
  const hasPush = times.push !== undefined && clips.every(clip => clip.push !== undefined);
  const hasTurn = times.turn !== undefined && clips.every(clip => clip.turn !== undefined);
  const hasRest = times.rest !== undefined && clips.every(clip => clip.rest !== undefined);

  useEffect(() => {
    try {
      const stored = Number(sessionStorage.getItem(speedKey));
      if (playbackSpeeds.includes(stored)) setSpeed(stored);
    } catch { /* The current take still works when the browser blocks storage. */ }
  }, []);

  useEffect(() => {
    for (const player of [modelPlayer.current, ...references.current]) {
      if (player) {
        player.defaultPlaybackRate = speed;
        player.playbackRate = speed;
      }
    }
  }, [speed, modelPlayer]);

  function changeSpeed(rate: number) {
    setSpeed(rate);
    try {
      sessionStorage.setItem(speedKey, String(rate));
    } catch { /* Keep the selection for this take. */ }
  }

  function position(phase: keyof ModelTimes) {
    if (phase !== "draw") setFilmControls(false);
    const positions = [
      { player: modelPlayer.current, time: times[phase] },
      ...clips.map((clip, i) => ({ player: references.current[i], time: clip[phase] })),
    ];
    setMessage("");
    for (const { player, time } of positions) {
      if (!player || player.error || time === undefined) continue;
      player.playbackRate = speed;
      pauseAtMark(player, time);
    }
    return positions;
  }

  async function playDeal() {
    const starts = position("draw");
    try {
      await Promise.all(starts.map(({ player }) => player && !player.error ? player.play() : undefined));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      for (const { player } of starts) player?.pause();
      setMessage("Gemensam uppspelning kunde inte starta. Välj Visa filmreglage för att spela ett klipp i taget.");
    }
  }

  return <section id="jamfor-giv" className={styles.comparison} aria-labelledby="jamfor-giv-rubrik">
    <h3 id="jamfor-giv-rubrik">{pair ? "Jämför given med originalfilmen" : "Jämför handbytet och släppet"}</h3>
    <p>{pair ? "Välj en händelse för att pausa båda filmerna vid motsvarande rörelse. Hastigheten gäller båda. Kontaktkraften mellan fingrar och kort har inte mätts."
      : "Handbyte och Släpp pausar alla tre filmerna vid motsvarande rörelse. Hastigheten gäller också alla tre."}</p>
    <div className={styles.actions} role="group" aria-label={pair ? "Styr båda filmerna" : "Styr de tre filmerna"}>
      {hasPush && <button type="button" onClick={() => position("push")}>Utskjut ur skon</button>}
      <button type="button" onClick={() => position("handover")}>Handbyte</button>
      {hasTurn && <button type="button" onClick={() => position("turn")}>Vändning</button>}
      <button type="button" onClick={() => position("release")}>Släpp</button>
      {hasRest && <button type="button" onClick={() => position("rest")}>Händernas slutläge</button>}
      <button type="button" onClick={playDeal}>Spela från uttaget</button>
      <button type="button" onClick={() => {
        modelPlayer.current?.pause();
        references.current.forEach(player => player?.pause());
      }}>{pair ? "Pausa båda" : "Pausa alla"}</button>
      <PlaybackSpeed speed={speed} onChange={changeSpeed}/>
      <label><input type="checkbox" checked={filmControls} onChange={event => setFilmControls(event.target.checked)}/> Visa filmreglage</label>
    </div>
    {message && <p role="status">{message}</p>}
    <div className={pair ? styles.players + " " + styles.pair : styles.players}>
      <figure className={styles.model}>
        <figcaption><strong>Paulina · konstruerad rörelsestudie</strong><span>{film.cameras.map(c => c.id).join(" och ")} · {film.take}</span></figcaption>
        {viewGuide && <p>{viewGuide}</p>}
        <video controls={filmControls} playsInline preload="auto" ref={modelPlayer} aria-label={film.title} src={film.url}/>
      </figure>
      {clips.map((clip, i) => <figure key={clip.sha256}>
        <figcaption><strong>{clip.title}</strong><span>{clip.view}</span></figcaption>
        <video controls={filmControls} playsInline preload="auto" aria-label={clip.title} src={"/api/givreferens?film=" + clip.sha256}
          ref={element => { references.current[i] = element; }}
          onError={() => setUnavailable(previous => previous.includes(clip.sha256) ? previous : [...previous, clip.sha256])}/>
        {unavailable.includes(clip.sha256) && <p role="status">Det lokala klippet kunde inte öppnas.
          {clip.source && <> <a href={clip.source}>Öppna källfilmen</a></>}</p>}
      </figure>)}
    </div>
  </section>;
}
