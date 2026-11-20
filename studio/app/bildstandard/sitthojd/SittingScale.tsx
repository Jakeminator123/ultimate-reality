"use client";
import { useState } from "react";
import { bildformat, leveransformat } from "../../../fotomall/bildformat";
import type { Photo } from "../../../lib/material-types";
import { bodyPixels, checkSeatedFrame, floorSpread, seatedStandard, type SeatedMeasurement } from "../../../lib/seated-review";
import styles from "./sitting.module.css";

export type MeasuredPhoto = Photo & { seated: SeatedMeasurement };
const viewsInOrder = [
  { id: "sittande/front", label: "Framifrån" }, { id: "sittande/trekvart", label: "Trekvart" }, { id: "sittande/profil", label: "Profil" },
];
const format = (n: number, digits = 0) => n.toLocaleString("sv-SE", { maximumFractionDigits: digits });
const signed = (n: number) => (n > 0 ? "+" : "") + format(n, 2);

function PhotoGuides({ photo, scale, shift, floor, centre }: {
  photo: MeasuredPhoto; scale: number; shift: number; floor: boolean; centre: boolean;
}) {
  const { width: w, height: h, seated: s } = photo;
  const spread = floorSpread(s.marks, 2);
  const radius = w * 0.009;
  const railY = spread ? Math.min(h - radius, spread.bottom + .5 + radius * 2.4) : 0;
  return <svg aria-hidden="true" className={styles.guides} viewBox={`0 0 ${w} ${h}`}>
    <g transform={`translate(${(1 - scale) * w / 2} ${shift}) scale(${scale})`}>
      {[s.crownY, s.soleY].map(y => <line className={styles.bodyLine} key={y} x1="0" x2={w} y1={y + .5} y2={y + .5}/>)}
      <line className={styles.seatLine} x1="0" x2={w} y1={s.seatY + .5} y2={s.seatY + .5}/>
      <circle className={styles.seatDot} cx={s.seatX + .5} cy={s.seatY + .5} r={radius * .8}/>
      {centre && s.marks && <g className={styles.eye}>
        <line x1="0" x2={w} y1={s.marks.eye.y + .5} y2={s.marks.eye.y + .5}/>
        <circle cx={s.marks.eye.x + .5} cy={s.marks.eye.y + .5} r={radius}/>
      </g>}
      {floor && s.marks && <g className={styles.floor}>
        {spread?.centres === 4 && [...new Set([spread.top, spread.bottom])].map(y =>
          <line key={y} x1="0" x2={w} y1={y + .5} y2={y + .5}/>)}
        {spread && <path className={spread.centres === 4 ? styles.span : styles.partialSpan}
          d={`M ${spread.left + .5} ${railY - radius} v ${radius} h ${spread.widthPixels} v ${-radius}`}/>}
        {s.marks.feet.map(p => <circle key={p.x + "," + p.y} cx={p.x + .5} cy={p.y + .5}
          r={radius} className={p.visible === "centre" ? styles.contact : styles.edge}/>)}
      </g>}
    </g>
    {centre && <path className={styles.cross} d={`M ${w/2-24} ${h/2} h 48 M ${w/2} ${h/2-24} v 48`}/>}
  </svg>;
}

export default function SittingScale({ dealer, edition, views }: { dealer: string; edition: string; views: MeasuredPhoto[] }) {
  const [aligned, setAligned] = useState(false);
  const [lines, setLines] = useState(true);
  const [floor, setFloor] = useState(true);
  const [centre, setCentre] = useState(true);
  const [tolerance, setTolerance] = useState<number>(seatedStandard.scalePercent);
  const front = views.find(p => p.id === "sittande/front");
  const name = dealer.charAt(0).toUpperCase() + dealer.slice(1);
  const rows = viewsInOrder.map(v => ({ ...v, photo: views.find(p => p.id === v.id) }));
  const formats = [...new Set(views.map(p => `${p.width} × ${p.height} px`))];
  const flagged = front ? rows.filter(r => r.photo && checkSeatedFrame(r.photo, front, tolerance).review) : [];
  const reviewed = rows.filter(r => r.photo).length;
  const uncertainties = [...new Set(views.flatMap(p => p.seated.marks ? [p.seated.marks.uncertaintyPx] : []))];
  return <main className={styles.page}>
    <nav aria-label="Studionavigering"><a href={dealer === "paulina" ? "/#modellering" : "/?dealer=" + encodeURIComponent(dealer) + "#modellering"}>← 3D-modellering</a><a href="/bildstandard">Bildstandard</a>
      {dealer === "paulina" && edition === "fas-1/v1" && <a href="/bildstandard/sittprofil#jamforelse">Ny sittprofil bredvid 3D-modellen</a>}</nav>
    <header><p>{name} · {edition}</p><h1>Sittande i tre vinklar</h1></header>
    {!front ? <p>De lokala bilderna och mätningen för sittfronten behövs för att visa jämförelsen.</p> : <>
      <p className={styles.intro}>Jämför kroppens utsnitt, ögonens läge och stolbenens kontakt med golvet. Sidovinklarna är receptets mål. Fotokamerans höjd och lutning är okända.</p>
      <div className={styles.reviewBar}>
        <div aria-live="polite"><strong>{flagged.length ? "Granska utsnittet" : "Utsnitt inom gränserna"}</strong>
          <span>{flagged.length ? flagged.map(r => r.label).join(", ") : `${reviewed} uppmätta vyer`}{reviewed < rows.length && " · mätunderlag saknas för en eller flera vyer"}</span></div>
        <label className={styles.tolerance}>Gräns för skalskillnad <strong>{format(tolerance, 1)} %</strong>
          <input aria-label="Gräns för skalskillnad" type="range" min=".1" max="5" step=".1" value={tolerance}
            onChange={e => setTolerance(Number(e.target.value))}/>
          <small>{format(tolerance * 10)} ‰ · {format(bodyPixels(front) * tolerance / 100, 1)} px i frontens kroppshöjd</small>
        </label>
      </div>
      <div className={styles.tools}>
        <div role="group" aria-label="Bildskala">
          <button aria-pressed={!aligned} onClick={() => setAligned(false)}>Originalens utsnitt</button>
          <button aria-pressed={aligned} onClick={() => setAligned(true)}>Samma bildskala</button>
        </div>
        <label><input type="checkbox" checked={lines} onChange={e => setLines(e.target.checked)}/> Mätlinjer</label>
        <label><input type="checkbox" disabled={!lines} checked={floor} onChange={e => setFloor(e.target.checked)}/> Stolkontakter</label>
        <label><input type="checkbox" disabled={!lines} checked={centre} onChange={e => setCentre(e.target.checked)}/> Bildcentrum och ögon</label>
      </div>
      <p className={styles.explanation}>{aligned ? "Hjässa och sula är nu i frontens bildskala. Kontrollen nedan använder alltid originalen." :
        "Originalens bildmått är " + formats.join(", ") + ". Mätpunkterna hör till just dessa filer."}</p>
      <div className={styles.views}>{rows.map(({ id, label, photo }) => {
        if (!photo) return <figure key={id}><figcaption>{label}</figcaption><p>Mätunderlag saknas för bildversionen.</p></figure>;
        const s = photo.seated;
        const scale = aligned ? ((front.seated.soleY - front.seated.crownY) / front.height) / ((s.soleY - s.crownY) / photo.height) : 1;
        const shift = aligned ? ((front.seated.crownY + .5) / front.height) * photo.height - scale * (s.crownY + .5) : 0;
        const status = checkSeatedFrame(photo, front, tolerance);
        return <figure key={id}><figcaption><strong>{label}</strong><span>Recept {photo.targetAngle}°</span></figcaption>
          <div className={styles.frame} style={{ aspectRatio: photo.width + "/" + photo.height }}>
            <img src={photo.url} alt={name + " · " + photo.name}
              style={{ transform: "translateY(" + shift / photo.height * 100 + "%) scale(" + scale + ")" }}/>
            {lines && <PhotoGuides photo={photo} scale={scale} shift={shift} floor={floor} centre={centre}/>}
          </div>
          <div className={styles.measure}><strong>{format(bodyPixels(photo))} px</strong> hjässa–sula · <a href={photo.url}>Öppna foto</a></div>
          <p className={status.review ? styles.warning : styles.status}>{photo === front ? "Referens för utsnittet" : status.review ? "Granska utsnittet" : "Utsnitt inom gränserna"}</p>
        </figure>;
      })}</div>
      {lines && <div className={styles.legend}><span className={styles.bodyKey}>Hjässa och sula</span><span className={styles.seatKey}>Dynans underkant</span>
        {centre && <span className={styles.eyeKey}>Pupill · kryss i bildrutans mitt</span>}
        {floor && <span className={styles.floorKey}>Stolfötter · fylld punkt vid synlig mitt, ring vid skymd mitt. Klammern visar spannet i sidled.</span>}</div>}
      <section className={styles.note}><h2>Mått i originalen</h2>
        <div className={styles.dataScroll}><table><thead><tr><th scope="col">Vy</th><th scope="col">Skala mot front</th><th scope="col">Höjdläge mot front</th><th scope="col">Sitsrad</th><th scope="col">Stolkontakter</th><th scope="col">Spann i sidled (x)</th><th scope="col">Spann i höjdled (y)</th></tr></thead>
          <tbody>{rows.map(({ id, label, photo }) => {
            if (!photo) return <tr key={id}><th scope="row">{label}</th><td colSpan={6}>Mätunderlag saknas</td></tr>;
            const check = checkSeatedFrame(photo, front, tolerance), marks = photo.seated.marks, spread = floorSpread(marks, 2);
            return <tr key={id}><th scope="row">{label}</th>
              <td className={check.scaleDiffers ? styles.flagged : undefined}>{signed(check.scaleDelta)} %</td>
              <td className={check.centreDiffers ? styles.flagged : undefined}>{signed(check.centreDelta)} %</td>
              <td>{photo.seated.seatY} px</td><td>{marks ? marks.feet.filter(p => p.visible === "centre").length + " av 4" : "Ej granskade"}
                {spread && spread.centres < 4 && <small>Bara synliga fötter</small>}</td>
              <td>{spread ? <>{format(spread.widthPixels)} px<small>x {spread.left}–{spread.right} · {format(spread.widthPixels / photo.width * 100, 1)} %</small></> : "Ej mätbart"}</td>
              <td>{spread ? <>{format(spread.pixels)} px<small>y {spread.top}–{spread.bottom} · {format(spread.pixels / photo.height * 100, 1)} %</small></> : "Ej mätbart"}</td></tr>;
          })}</tbody></table></div>
        <p>Skalan jämför hur stor del av bilden kroppen upptar. Höjdläget jämför mittpunkten mellan hjässa och sula i procent av bildhöjden. Positiva värden ligger längre ned. Grundgränserna är {seatedStandard.scalePercent} % för skala och {seatedStandard.centrePercent} % för höjdläge. Även olika bildmått inom serien ger en varning.</p>
      </section>
      <section className={styles.note}><h2>Visar stolbenen en högre kamera?</h2>
        <p>När kameran går runt samma stol ändras benens avstånd till kameran. I trekvart syns stolens bredd och djup samtidigt. Fötter på golvet kan därför hamna på olika bildrader även om kameran hålls vågrät på samma höjd.</p>
        <p>Spannen mäts mellan de yttersta synliga kontaktcentrumen i x och y. Vid två eller tre synliga mittpunkter visar den streckade klammern bara deras spann. Hela stolens spann är då okänt. {uncertainties.length > 0 && "Punktavläsningens skattade osäkerhet är " + uncertainties.map(u => "±" + u + " px").join(", ") + "."}</p>
        <p>Krysset visar bildrutans geometriska mitt. Fotots optiska centrum kräver kalibrering. Kroppsriggen följer dealern. Med kända fotpositioner på samma stol och kalibrerade kameror går det att jämföra var varje stolfot ska hamna med var den syns i varje original.</p>
      </section>
      <section className={styles.note}><h2>Standard för nästa sittserie</h2>
        <p><strong>{leveransformat(bildformat.person)}</strong> i alla tre vyer. Använd samma stol, brännvidd och kameraradie. Mät objektivets höjd från golvet, håll den optiska axeln vågrät och rotera runt stolens mitt. Vid fotografering, ta en kalibreringsruta i varje kameraläge med en måttsatt referens i samma koordinatsystem som golvet.</p>
      </section>
    </>}
  </main>;
}
