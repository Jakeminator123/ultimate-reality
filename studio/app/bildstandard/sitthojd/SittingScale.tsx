"use client";
import { useState } from "react";
import styles from "./sitting.module.css";

export type MeasuredPhoto = {
  file: string; url: string; label: string; degrees: number; width: number; height: number;
  crownY: number; soleY: number; seatX: number; seatY: number;
};
const span = (photo: MeasuredPhoto) => photo.soleY - photo.crownY;
const format = (n: number, digits = 0) => n.toLocaleString("sv-SE", { maximumFractionDigits: digits });

export default function SittingScale({ views }: { views: MeasuredPhoto[] }) {
  const [aligned, setAligned] = useState(false);
  const [lines, setLines] = useState(true);
  const front = views[0];
  return <main className={styles.page}>
    <nav aria-label="Studionavigering"><a href="/#modellering">← 3D-modellering</a><a href="/bildstandard">Bildstandard</a></nav>
    <header><p>Paulina · Fas 1 v1</p><h1>Sittande i tre vinklar</h1></header>
    {!front ? <p>De lokala bilderna och mätningen för upplaga 1 behövs för att visa jämförelsen.</p> : <>
      <p className={styles.intro}>Från hjässa till skosula upptar Paulina {views.map(photo => format(span(photo) + 1) + " px " + photo.label.toLocaleLowerCase("sv")).join(", ")}.</p>
      <div className={styles.tools}>
        <div role="group" aria-label="Bildskala">
          <button aria-pressed={!aligned} onClick={() => setAligned(false)}>Originalens utsnitt</button>
          <button aria-pressed={aligned} onClick={() => setAligned(true)}>Samma bildskala</button>
        </div>
        <label><input type="checkbox" checked={lines} onChange={e => setLines(e.target.checked)}/> Mätlinjer</label>
      </div>
      <p className={styles.explanation}>{aligned
        ? "Hjässan och skosulan visas på frontbildens nivåer. Bilderna skalas likformigt på höjden och bredden."
        : "Originalformat i serien är " + Array.from(new Set(views.map(p => p.width + " × " + p.height + " px"))).join(", ") + ". Hela originalets utsnitt visas."}</p>
      <div className={styles.views}>{views.map(photo => {
        const scale = aligned ? (span(front) / front.height) / (span(photo) / photo.height) : 1;
        const shift = aligned ? (front.crownY / front.height) * photo.height - scale * photo.crownY : 0;
        const y = (pixel: number) => (pixel * scale + shift) / photo.height * 100 + "%";
        const seatX = (0.5 + (photo.seatX / photo.width - 0.5) * scale) * 100 + "%";
        return <figure key={photo.file}>
          <figcaption>{photo.label} <span>Recept {photo.degrees}°</span></figcaption>
          <div className={styles.frame} style={{ aspectRatio: photo.width + "/" + photo.height }}>
            <img src={photo.url} alt={"Paulina sittande " + photo.label.toLocaleLowerCase("sv")} style={{
              transform: "translateY(" + (shift / photo.height * 100) + "%) scale(" + scale + ")",
            }}/>
            {lines && <div aria-hidden="true">
              <i className={styles.line} style={{ top: y(photo.crownY) }}/><i className={styles.line} style={{ top: y(photo.soleY) }}/>
              <i className={styles.seatLine} style={{ top: y(photo.seatY) }}/><b className={styles.dot} style={{ top: y(photo.seatY), left: seatX }}/>
            </div>}
          </div>
          <div className={styles.measure}><strong>{format(span(photo) + 1)} px</strong> i originalet · <a href={photo.url}>Öppna foto</a></div>
        </figure>;
      })}</div>
      <p className={styles.legend}><i/> Hjässa och skosula <b/> Dynans underkant ovanför främre stolsbenet</p>
      <section className={styles.note}><h2>Vad visar sitsen?</h2>
        <p>Det synliga märket där den grå dynan möter träet ligger på rad {views.map(v => format(v.seatY)).join(", ")} från bildens överkant. Den streckade linjen visar hur märket förskjuts även när kropparna visas i samma skala.</p>
        <p>ImageGen i Codex skapade de tre sparade referenserna. Kameraperspektivet påverkar var stolkanten syns och kroppen döljer den faktiska sittytan. Fysisk sitthöjd i centimeter går därför inte att fastställa från de här bilderna.</p>
      </section>
    </>}
  </main>;
}
