"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import OrbitViewer from "../OrbitViewer";
import styles from "../deal.module.css";

const framesPerSecond = 24;
const peak = framesPerSecond;
const release = 36;
const end = 60;

// The portable clip reaches its peak at 1 s, holds to 1.5 s and returns to rest at 2.5 s.
function expressionPercent(frame: number) {
  if (frame <= peak) return Math.round(100 * frame / peak);
  if (frame <= release) return 100;
  return Math.round(100 * (end - frame) / (end - release));
}

export default function ExpressionPlayer() {
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startFrame = useRef(0);
  const strength = expressionPercent(frame);

  useEffect(() => {
    if (!playing || !ready) return;
    const first = startFrame.current;
    const started = performance.now();
    let request: number;
    function tick(now: number) {
      const at = Math.min(end, first + Math.floor((now - started) * framesPerSecond / 1000));
      setFrame(at);
      if (at === end) setPlaying(false);
      else request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, ready]);

  function selectFrame(value: number) {
    setPlaying(false);
    setFrame(value);
  }

  function togglePlayback() {
    if (!playing) {
      startFrame.current = frame === end ? 0 : frame;
      setFrame(startFrame.current);
    }
    setPlaying(!playing);
  }

  return <>
    <OrbitViewer sceneUrl="/giv-plats-4/v3/minspel.glb" frame={frame} fps={framesPerSecond}
      cut="ansikte" label="Paulinas ansiktsuttryck från 120 vinklar" onReadyChange={setReady} />
    <div className={styles.review}>
      <div className={styles.scrub}>
        <button type="button" className={styles.play} onClick={togglePlayback} disabled={!ready}>
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {playing ? "Pausa" : "Spela minspel"}
        </button>
        <label htmlFor="minspel-styrka">Uttryck <output>{strength} %</output></label>
        <input id="minspel-styrka" type="range" min={0} max={peak} step={1}
          value={Math.round(strength * peak / 100)} aria-valuetext={strength + " procent"} disabled={!ready}
          onChange={e => selectFrame(Number(e.target.value))} />
      </div>
      <div className={styles.moments} role="group" aria-label="Välj ansiktsuttryck">
        <button type="button" disabled={!ready} aria-pressed={!playing && strength === 0} onClick={() => selectFrame(0)}>Vila</button>
        <button type="button" disabled={!ready} aria-pressed={!playing && strength === 100} onClick={() => selectFrame(peak)}>Snett leende</button>
      </div>
    </div>
  </>;
}
