import { useRef } from "react";
import { cropSource, dimensions, roleName, type DealerMaterial, type Photo } from "../lib/material-types";
import styles from "./modeling.module.css";

export function PhotoEvidence({ photo, project }: { photo: Photo; project: DealerMaterial }) {
  const sources = [...(project.geometry?.sources ?? []), ...(project.appearance?.sources ?? [])].filter(s => s.sha256 === photo.sha256);
  return <div className={styles.sourceNote}>
    <p><strong>{photo.format} · {dimensions([photo.width, photo.height])}</strong>{photo.targetAngle !== undefined && " · målvinkel " + photo.targetAngle + "°"}</p>
    <p>{sources.length ? sources.map(s => roleName[s.role]).join(" och ") : "Referens i bildserien"}</p>
    {photo.observed && <><p>{photo.observed.kalla}</p><details>
      <summary>Fotots riktning och ljus</summary><p>{photo.observed.observation.riktning} {photo.observed.observation.ljus}</p>
      <p>{photo.observed.osakerhet}</p></details></>}
    {photo.group === "Sittande" && project.dealer === "paulina" && project.edition === "fas-1/v1" && <a href="/bildstandard/sitthojd">Jämför bildskala och sitsnivå</a>}
  </div>;
}

function FilmEvidence({ film }: { film: DealerMaterial["films"][number] }) {
  const player = useRef<HTMLVideoElement>(null);
  return <details>
    <summary>{film.title}</summary>
    <p>{dimensions([film.width, film.height])} · {film.fps} fps · {film.frames} rutor · {film.appearance ? "Fotoyta" : "Kroppsform"} · {film.cameras.map(c => c.id).join(", ")}</p>
    <video controls preload="metadata" ref={player} aria-label={film.title} src={film.url}/>
    <div className={styles.frameMarks}>{film.marks.map(m => m.seconds === undefined ?
      <span key={m.frame}>{m.label} · ruta {m.frame}</span> :
      <button key={m.frame} onClick={() => {
        // ffprobe prints microseconds. Seek just past the rounded onset of this displayed frame.
        if (player.current && m.seconds !== undefined) { player.current.pause(); player.current.currentTime = m.seconds + .000001; }
      }}>{m.label} · ruta {m.frame}</button>)}</div>
    <p>Rutorna räknas från 0.</p>
    {film.reviews.map(review => <p key={review.note}><b>Ruta {review.frames.join(", ")}</b> · {review.note}</p>)}
  </details>;
}

export default function MaterialEvidence({ project }: { project: DealerMaterial }) {
  const model = project.geometry, look = project.appearance;
  const query = new URLSearchParams({ dealer: project.dealer });
  if (project.revision) query.set("revision", project.revision);
  const doc = "/api/material?" + query + "&report=";
  return <section className={styles.evidence} aria-labelledby="sources-heading">
    <header className={styles.galleryHeader}><div><h2 id="sources-heading">Modellens underlag</h2>
      <p>{project.activeModel?.name ?? "Modellversion saknas"} · bildutgåva {project.edition}</p></div>
      <a href={doc + "md"} target="_blank" rel="noreferrer">Öppna materialrapporten ↗</a></header>
    {model && <dl className={styles.lineage}>
      <div><dt>Kroppsmodell</dt><dd>{model.joints} leder · <code title={model.sha256}>{model.sha256.slice(0, 12)}</code></dd></div>
      {look && <div><dt>Fotoyta</dt><dd>{look.sources.length} källbilder{look.atlas && " · " + dimensions(look.atlas)}</dd></div>}
      <div><dt>Filmer för modellen</dt><dd>{project.films.length}</dd></div>
    </dl>}
    {project.issues.length > 0 && <ul>{project.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
    {project.motions.map(({ sha256, motion, url }) => <details key={sha256}><summary>Kortprov · {motion.take}</summary>
      <p>{motion.card} · {motion.keyframes} samplade lägen · {(motion.end - motion.start).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} s</p>
      <a href={url} download={motion.take + ".glb"}>Hämta den animerade GLB-filen</a></details>)}
    {model && <details><summary>Bildmått genom SAM-körningen</summary>
      <p>{model.run ?? "Körnings-ID saknas"}</p>
      <div className={styles.dataScroll}><table><thead><tr><th>Bild</th><th>Original</th><th>Inläst bild</th><th>Kroppsutsnitt</th><th>Handutsnitt</th></tr></thead>
        <tbody>{model.sources.map(s => {
          const p = project.photos.find(photo => photo.sha256 === s.sha256), m = s.processing;
          return <tr key={s.sha256}><th>{p?.name ?? s.photo}</th><td>{m ? dimensions(m.original) : "Saknas"}</td>
            <td>{m ? dimensions(m.prepared) : "Saknas"}</td><td>{m?.crop ? dimensions(m.crop.body) : "Saknas"}</td><td>{m?.crop ? dimensions(m.crop.hand) : "Saknas"}</td></tr>;
        })}</tbody></table></div>
      {Array.from(new Set(model.sources.flatMap(s => s.processing?.crop ? [s.processing.crop.evidence] : []))).map(source =>
        <p key={source}>Utsnittens storlek kommer från {cropSource[source]}.</p>)}
    </details>}
    {project.films.map(film => <FilmEvidence key={film.url} film={film}/>)}
    <a className={styles.jsonLink} href={doc + "json"} target="_blank" rel="noreferrer">Visa källfiler och kameravärden i JSON ↗</a>
  </section>;
}
