"use client";

import { useEffect, useRef, useState } from "react";
import OrbitViewer from "../OrbitViewer";
import styles from "../deal.module.css";

const views = [
  { id: "ogon", name: "Bara ögonen", center: 36, half: 18 },
  { id: "huvud", name: "Huvud och ögon", center: 120, half: 24 },
] as const;
const directions = [
  { value: -1, key: "hoger", name: "Hennes höger" },
  { value: 0, key: "mitten", name: "Rakt fram" },
  { value: 1, key: "vanster", name: "Hennes vänster" },
] as const;

export default function BlickPlayer() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"ogon" | "huvud">("huvud");
  const [amount, setAmount] = useState(0);
  const transition = useRef<number | null>(null);
  const view = views.find(v => v.id === mode)!;
  const current = Math.round(amount * view.half);
  const label = current === 0 ? "Rakt fram" : (current < 0 ? "Hennes höger" : "Hennes vänster");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const selected = directions.find(d => d.key === query.get("riktning"));
    if (selected) setAmount(selected.value);
    if (query.get("lage") === "ogon") setMode("ogon");
    return () => { if (transition.current !== null) cancelAnimationFrame(transition.current); };
  }, []);

  function stopTransition() {
    if (transition.current !== null) cancelAnimationFrame(transition.current);
    transition.current = null;
  }

  function look(target: number) {
    stopTransition();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || target === amount) {
      setAmount(target);
      return;
    }
    const start = performance.now();
    const duration = (mode === "ogon" ? 130 : 330) * Math.sqrt(Math.abs(target - amount));
    function advance(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setAmount(t === 1 ? target : amount + (target - amount) * t * t * (3 - 2 * t));
      transition.current = t === 1 ? null : requestAnimationFrame(advance);
    }
    transition.current = requestAnimationFrame(advance);
  }

  return <>
    <OrbitViewer sceneUrl="/giv-plats-4/blick/blick.glb" frame={view.center + current} fps={24}
      cut="fast-ansikte" label="Paulinas blick från valbar kameravinkel" onReadyChange={setReady} />
    <div className={styles.review}>
      <div className={styles.moments} role="group" aria-label="Välj rörelse">
        {views.map(v => <button key={v.id} type="button" aria-pressed={v.id === mode} disabled={!ready}
          onClick={() => { stopTransition(); setMode(v.id); }}>{v.name}</button>)}
      </div>
      <div className={styles.scrub}>
        <label htmlFor="blickstyrning">Blick <output>{label}</output></label>
        <input id="blickstyrning" type="range" min={-view.half} max={view.half} step={1} value={current}
          aria-valuetext={current === 0 ? label : label + ", " + Math.round(Math.abs(current / view.half) * 100) + " procent"}
          disabled={!ready} onChange={e => { stopTransition(); setAmount(Number(e.target.value) / view.half); }} />
      </div>
      <div className={styles.moments} role="group" aria-label="Välj Paulinas egen blickriktning">
        {directions.map(d => <button key={d.key} type="button" aria-pressed={amount === d.value}
          disabled={!ready} onClick={() => look(d.value)}>{d.name}</button>)}
      </div>
    </div>
  </>;
}
