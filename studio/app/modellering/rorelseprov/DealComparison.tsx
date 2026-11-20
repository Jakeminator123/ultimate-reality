"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { dealReferences } from "../../../lib/deal-references";
import type { DealerMaterial } from "../../../lib/material-types";
import styles from "./comparison.module.css";

type Film = DealerMaterial["films"][number];
type Phase = "draw" | "handover" | "release";
const speedKey = "rorelseprov:hastighet";

export default function DealComparison({ film, modelPlayer, handover, release, viewGuide }: {
  film: Film; modelPlayer: RefObject<HTMLVideoElement | null>; handover: number; release: number; viewGuide?: string;
}) {
  const references = useRef<(HTMLVideoElement | null)[]>([]);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [filmControls, setFilmControls] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    try {
      const stored = Number(sessionStorage.getItem(speedKey));
      if ([0.25, 0.5, 0.75, 1].includes(stored)) setSpeed(stored);
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

  function position(phase: Phase) {
    if (phase !== "draw") setFilmControls(false);
    const modelTime = { draw: 0, handover, release }[phase];
    const positions = [
      { player: modelPlayer.current, time: modelTime },
      ...dealReferences.map((clip, i) => ({ player: references.current[i], time: clip[phase] })),
    ];
    setMessage("");
    for (const { player, time } of positions) {
      if (!player || player.error) continue;
      player.pause();
      player.playbackRate = speed;
      player.currentTime = time + 0.000001;
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
    <h3 id="jamfor-giv-rubrik">Jämför handbytet och släppet</h3>
    <p>Handbyte och Släpp pausar alla tre filmerna vid motsvarande rörelse. Hastigheten gäller också alla tre.</p>
    <div className={styles.actions} role="group" aria-label="Styr de tre filmerna">
      <button type="button" onClick={() => position("handover")}>Handbyte</button>
      <button type="button" onClick={() => position("release")}>Släpp</button>
      <button type="button" onClick={playDeal}>Spela från uttaget</button>
      <button type="button" onClick={() => {
        modelPlayer.current?.pause();
        references.current.forEach(player => player?.pause());
      }}>Pausa alla</button>
      <label>Hastighet
        <select value={speed} onChange={event => changeSpeed(Number(event.target.value))}>
          <option value={0.25}>0,25×</option>
          <option value={0.5}>0,5×</option>
          <option value={0.75}>0,75×</option>
          <option value={1}>1×</option>
        </select>
      </label>
      <label><input type="checkbox" checked={filmControls} onChange={event => setFilmControls(event.target.checked)}/> Visa filmreglage</label>
    </div>
    {message && <p role="status">{message}</p>}
    <div className={styles.players}>
      <figure className={styles.model}>
        <figcaption><strong>Paulina · konstruerad rörelsestudie</strong><span>{film.cameras.map(c => c.id).join(" och ")} · {film.take}</span></figcaption>
        {viewGuide && <p>{viewGuide}</p>}
        <video controls={filmControls} playsInline preload="auto" ref={modelPlayer} aria-label={film.title} src={film.url}/>
      </figure>
      {dealReferences.map((clip, i) => <figure key={clip.sha256}>
        <figcaption><strong>{clip.title}</strong><span>{clip.view}</span></figcaption>
        <video controls={filmControls} playsInline preload="auto" aria-label={clip.title} src={"/api/givreferens?film=" + clip.sha256}
          ref={element => { references.current[i] = element; }}
          onError={() => setUnavailable(previous => previous.includes(clip.sha256) ? previous : [...previous, clip.sha256])}/>
        {unavailable.includes(clip.sha256) && <p role="status">Det lokala klippet kunde inte öppnas. <a href={clip.source}>Öppna källfilmen</a></p>}
      </figure>)}
    </div>
  </section>;
}
