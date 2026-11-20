"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Box, Pause, Play } from "lucide-react";
import styles from "./comparison.module.css";

type Seat = "4" | "1";
type Version = "fore" | "efter";
type View = "hallning" | "bord" | "hand";
type Point = [number, number];
type Guides = { hip: Point; neck: Point; bottom: Point; top: Point };
export type TakeSummary = {
  run: string; total: number; beforeDegrees: number; afterDegrees: number; maxGapMm: number;
  guides: Record<Version, Record<Seat, Guides>>; travel: number[]; cameraPitch: Record<Seat, number>;
};
const versions = ["fore", "efter"] as const;
const both = ["4", "1"] as const;
const titles = { fore: "Före", efter: "Efter" };
const number = (value: number, places: number) => value.toLocaleString("sv-SE", { minimumFractionDigits: places, maximumFractionDigits: places });
function url(version: Version, frame: number, seat: Seat, view: View) {
  return "/bordsprov/paulina-rak/" + version + "-" + String(frame).padStart(2, "0") + "-" + seat + "-" + (view === "hand" ? "hand" : "bord") + ".webp";
}

function LabFrame({ guide, view, lines, seat, version, frame }: { guide: Guides; lines: boolean; seat: Seat; version: Version; frame: number; view: View }) {
  const box = view === "hallning" ? [guide.hip[0]-340, guide.top[1]-53, 740, 422].join(" ") : "0 0 1280 720";
  return <svg role="img" aria-label={titles[version] + ", stol " + seat + ", bildruta " + frame}
    viewBox={box} className={styles.shot}>
    <image href={url(version, frame, seat, view)} width="1280" height="720" />
    {lines && view !== "hand" && <g>
      <line x1={guide.bottom[0]} y1={guide.bottom[1]} x2={guide.top[0]} y2={guide.top[1]} stroke="#092f2d" strokeWidth="5" strokeOpacity=".75" strokeDasharray="8 6"/>
      <line x1={guide.bottom[0]} y1={guide.bottom[1]} x2={guide.top[0]} y2={guide.top[1]} stroke="#92e6ce" strokeWidth="2.4" strokeDasharray="8 6"/>
      <line x1={guide.hip[0]} y1={guide.hip[1]} x2={guide.neck[0]} y2={guide.neck[1]} stroke="#ffc77e" strokeWidth="2.5"/>
      {[guide.neck, guide.hip].map(([x,y]) => <circle key={y} cx={x} cy={y} r="4.5" fill="#ffc77e" stroke="#2a2721" strokeWidth="1.8"/>)}
    </g>}
  </svg>;
}

type Selection = { frame: number; view: View; seat: Seat | "bada" };
export default function Comparison({ take, initialFrame, initialView, initialSeat }: {
  take: TakeSummary; initialFrame: number; initialView: View; initialSeat: Seat | "bada";
}) {
  const [selected, setSelected] = useState<Selection>({ frame: initialFrame, view: initialView, seat: initialSeat });
  const [shown, setShown] = useState(selected);
  const [playing, play] = useState(false);
  const [lines, setLines] = useState(false);
  const [failed, setFailed] = useState(false);
  const { frame, seat, view } = selected;
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seats = seat === "bada" ? both : [seat];
    const frames = seats.flatMap(s => versions.map(v => {
      const image = new Image();
      image.src = url(v, frame, s, view);
      return image.decode();
    }));
    Promise.all(frames).then(() => {
      if (!active) return;
      setFailed(false);
      setShown({ frame, seat, view });
      if (playing && frame < take.total) timer = setTimeout(() => setSelected(s => ({ ...s, frame:frame+1 })), 95);
      else if (playing) play(false);
    }).catch(() => { if (active) { setFailed(true); play(false); } });
    return () => { active = false; clearTimeout(timer); };
  }, [frame, seat, view, playing, take.total]);
  function select(next: Partial<Selection>) {
    play(false);
    setSelected(s => ({ ...s, ...next }));
  }
  function toggle() {
    if (!playing && frame === take.total) setSelected(s => ({ ...s, frame:1 }));
    play(!playing);
  }
  const evidence = shown.view === "hand";
  return <main className={styles.page}>
    <nav className={styles.nav}><a href="/bordsprov/paulina-utdrag.html"><ArrowLeft size={15}/> Kortutdrag</a>
      <a href={"/?pose="+encodeURIComponent(take.run+"/1")+"&version=rak#modellering"}><Box size={15}/> Vrid 3D-modellen</a></nav>
    <header className={styles.header}><h1>Paulinas sittpose</h1>
      <p>Första kortet ur skon. Samma rörelse från stol 4 och stol 1, före och efter upprätningen av 08.</p></header>
    <div className={styles.toolbar}>
      <div className={styles.group} role="group" aria-label="Bildutsnitt">
        {([["hallning","Hållning"],["hand","Hand och kort"],["bord","Hela bordet"]] as const).map(([v,title]) =>
          <button key={v} aria-pressed={view === v} onClick={() => select({view:v})}>{title}</button>)}
      </div>
      <div className={styles.group} role="group" aria-label="Kamera">
        {([["bada","Båda stolarna"],["4","Stol 4"],["1","Stol 1"]] as const).map(([s,title]) =>
          <button key={s} aria-pressed={seat === s} onClick={() => select({seat:s})}>{title}</button>)}
      </div>
      {!evidence && <label className={styles.guides}><input type="checkbox" checked={lines} onChange={e => setLines(e.target.checked)}/> Lodlinje</label>}
    </div>
    <div className={styles.timeline}>
      <button className={styles.play} aria-label={playing ? "Pausa utdraget" : "Spela utdraget"} onClick={toggle}>
        {playing ? <Pause size={17}/> : <Play size={17}/>} {playing ? "Pausa" : "Spela"}
      </button>
      <input type="range" min="1" max={take.total} value={frame} aria-label="Bildruta" onChange={e => select({frame:Number(e.target.value)})}/>
      <output>Ruta {shown.frame}/{take.total} <span>· {number(take.travel[shown.frame-1], 0)} mm</span></output>
    </div>
    {failed && <p role="alert">En provbild saknas. Välj en annan ruta eller ladda om.</p>}
    <div className={styles.labels}><h2>Före <span>{number(take.beforeDegrees, 1)}° framåt</span></h2>
      <h2>Efter <span>{number(take.afterDegrees, 1)}°</span></h2></div>
    {(shown.seat === "bada" ? both : [shown.seat]).map(s => <section key={s} className={styles.row} aria-label={"Stol "+s}>
      {versions.map(v => <figure key={v} className={styles.figure}>
        <LabFrame guide={take.guides[v][s]} lines={lines} seat={s} version={v} view={shown.view} frame={shown.frame}/>
        <figcaption>Stol {s}</figcaption>
      </figure>)}
    </section>)}
    <p className={styles.note}>{evidence
      ? "Pek- och långfinger följer kortet i "+take.total+" rutor. Största uppmätta glapp vid de två fingerblommorna är "+number(take.maxGapMm, 3)+" mm. Skon är riktad 70 % inåt och 30 % mot stol 4."
      : lines ? "Den streckade linjen är lod genom höftmitten. Den gula linjen följer höftmitt till nackbas. Punkten bakom bordet visar höftledens läge i 3D."
      : "Vinkeln mäts i 3D från höftmitt till nackbas. Stol 4 blickar "+number(take.cameraPitch["4"],1)+"° nedåt och stol 1 "+number(take.cameraPitch["1"],1)+"°. Lodlinjen visar hur det påverkar bilden."}</p>
  </main>;
}
