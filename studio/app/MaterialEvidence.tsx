import { useRef } from "react";
import { cropSource, dimensions, roleName, type DealerMaterial, type Photo } from "../lib/material-types";
import { checkSeatedFrame, seatedStandard } from "../lib/seated-review";
import { modelPhotoRoles } from "../lib/photo-review";
import styles from "./modeling.module.css";

export function PhotoEvidence({ photo, project }: { photo: Photo; project: DealerMaterial }) {
  const roles = modelPhotoRoles(photo, project);
  const front = project.photos.find(p => p.id === "sittande/front");
  const check = photo.seated && front?.seated ? checkSeatedFrame({ ...photo, seated: photo.seated }, { ...front, seated: front.seated }) : null;
  const edition = new URLSearchParams({ dealer: project.dealer, edition: project.edition });
  if (project.revision) edition.set("revision", project.revision);
  const measured = "/bildstandard/sitthojd?" + edition;
  return <div className={styles.sourceNote}>
    {photo.review && <p><strong>{photo.review.decision === "usable" ? "Granskad · användbar som referens" : "Granskad · användbar med förbehåll"}</strong> · {photo.review.note}</p>}
    <p><strong>{photo.format} · {dimensions([photo.width, photo.height])}</strong>{photo.targetAngle !== undefined &&
      (photo.group === "Sittande" ? " · receptets sidovinkel " : " · målvinkel ") + photo.targetAngle + "°"}</p>
    <p>{roles.length ? roles.map(s => roleName[s]).join(" och ") : "Referens i bildserien"}</p>
    {photo.group === "Sittande" && <p>Fotokamerans höjd över golvet och faktiska lutning är okända.</p>}
    {check?.review && <p className={styles.photoWarning}>Granska utsnittet. {check.scaleDiffers &&
      "Kroppens bildskala avviker " + Math.abs(check.scaleDelta).toLocaleString("sv-SE", { maximumFractionDigits: 1 }) +
      " % från sittfronten (gräns " + seatedStandard.scalePercent + " %). "}
      {check.centreDiffers && "Kroppens mitt ligger på en annan bildhöjd. "}{check.formatDiffers && "Originalens pixelmått skiljer sig."}</p>}
    {roles.includes("surface") && photo.group === "Ansikte" && <p>Porträttet ger hud, drag och tatueringar till huvudets fotoyta. Blick, blinkning och tal behöver egna rörelser.</p>}
    {roles.includes("surface") && photo.id === "hander/handryggar" && <p>Handryggarna ger hud, naglar och tatueringar. Fingerlederna styr rörelsen i ett grepp.</p>}
    {(photo.id === "hander/kortdrag-vanster" || photo.id === "rorelsereferens/kortvandning-hoger") &&
      <p>Greppbilden visar hur fingrarna möter kortet. En synkad front- och sidofilm ger rörelsens tempo och visar fingrar som skyms från den andra kameran.</p>}
    {photo.observed && <><p>{photo.observed.kalla}</p><details>
      <summary>Fotots riktning och ljus</summary><p>{photo.observed.observation.riktning} {photo.observed.observation.ljus}</p>
      <p>{photo.observed.osakerhet}</p></details></>}
    {photo.group === "Sittande" && front?.seated && <a href={measured}>Jämför utsnitt, ögonlinje och stolkontakter</a>}
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
    {film.reviews.map(review => <p key={review.camera + review.note}><b>{review.camera} · ruta {review.frames.join(", ")}</b> · {review.note}</p>)}
  </details>;
}

export default function MaterialEvidence({ project }: { project: DealerMaterial }) {
  const model = project.geometry, look = project.appearance;
  const geometryPhotos = project.photos.filter(p => modelPhotoRoles(p, project).includes("geometry"));
  const posePhotos = project.photos.filter(p => modelPhotoRoles(p, project).includes("posture"));
  const surfacePhotos = project.photos.filter(p => modelPhotoRoles(p, project).includes("surface"));
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
    {geometryPhotos.length > 0 && <div className={styles.photoOrigin}>
      <h3>Hur används vinklarna?</h3>
      <p><strong>{geometryPhotos.map(p => p.name).join(", ")}</strong> ger kroppsgeometrin.
        {posePhotos.length > 0 && " " + posePhotos.map(p => p.name).join(" och ") + " används för att jämföra hållningen från sidan."}</p>
      {surfacePhotos.length > 0 && <p><strong>{surfacePhotos.length} foton ger modellens yta.</strong> Bilderna passas mot samma 3D-kropp. För varje del av huden eller kläderna väger foton där den syns tydligt tyngre. Färgerna blandas i en gemensam textur. På ytor som saknar fototäckning skattas utseendet. Underlaget är {surfacePhotos.map(p => p.name.toLocaleLowerCase("sv")).join(", ")}.</p>}
      <p>Rörelsen skapas i riggens leder. Greppbilderna visar var fingrarna ska möta kortet. När kortbanan och lederna följer samma tidslinje kan samma giv renderas från båda stolarna.</p>
    </div>}
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
