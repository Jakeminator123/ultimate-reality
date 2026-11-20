"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { cropSource, dimensions, roleName, type DealerMaterial, type Photo } from "../lib/material-types";
import { checkSeatedFrame, floorSpread, seatedStandard } from "../lib/seated-review";
import { modelPhotoRoles } from "../lib/photo-review";
import DealComparison, { pauseAtMark, PlaybackSpeed, type TakeComparison } from "./modellering/rorelseprov/DealComparison";
import { MotionComponents, takeLabel } from "./MotionTake";
import styles from "./modeling.module.css";

export function PhotoCameraGuides({ photo }: { photo: Photo }) {
  const eye = photo.seated?.marks?.eye;
  if (!eye) return null;
  return <svg aria-hidden="true" className={styles.photoGuides} viewBox={`0 0 ${photo.width} ${photo.height}`}>
    <line x1="0" x2={photo.width} y1={eye.y + .5} y2={eye.y + .5}/>
    <circle cx={eye.x + .5} cy={eye.y + .5} r={photo.width * .009}/>
    <path d={`M ${photo.width/2-24} ${photo.height/2} h 48 M ${photo.width/2} ${photo.height/2-24} v 48`}/>
  </svg>;
}

export function PhotoEvidence({ photo, project }: { photo: Photo; project: DealerMaterial }) {
  const roles = modelPhotoRoles(photo, project);
  const front = project.photos.find(p => p.id === "sittande/front");
  const check = photo.seated && front?.seated ? checkSeatedFrame({ ...photo, seated: photo.seated }, { ...front, seated: front.seated }) : null;
  const contacts = floorSpread(photo.seated?.marks, 2);
  const edition = new URLSearchParams({ dealer: project.dealer, edition: project.edition });
  if (project.revision) edition.set("revision", project.revision);
  const measured = "/bildstandard/sitthojd?" + edition;
  return <div className={styles.sourceNote}>
    {photo.review && <p><strong>{photo.review.decision === "usable" ? "Granskad · användbar som referens" : "Granskad · användbar med förbehåll"}</strong> · {photo.review.note}</p>}
    <p><strong>{photo.format} · {dimensions([photo.width, photo.height])}</strong>{photo.targetAngle !== undefined &&
      (photo.group === "Sittande" ? " · receptets sidovinkel " : " · målvinkel ") + photo.targetAngle + "°"}</p>
    <p>{roles.length ? roles.map(s => roleName[s]).join(" och ") : "Referens i bildserien"}</p>
    {contacts && <p>De {contacts.centres} synliga mittpunkterna under stolfötterna spänner över {contacts.widthPixels} px i sidled och {contacts.pixels} px i höjdled.
      {contacts.centres < 4 && " Hela stolens spann är okänt."}</p>}
    {photo.group === "Sittande" && <p>Fotokamerans höjd över golvet och faktiska lutning är okända.</p>}
    {check?.review && <p className={styles.photoWarning}>Granska utsnittet. {check.scaleDiffers &&
      "Kroppens bildskala avviker " + Math.abs(check.scaleDelta).toLocaleString("sv-SE", { maximumFractionDigits: 1 }) +
      " % från sittfronten (gräns " + seatedStandard.scalePercent + " %). "}
      {check.centreDiffers && "Kroppens mitt ligger på en annan bildhöjd. "}{check.formatDiffers && "Originalens pixelmått skiljer sig."}</p>}
    {roles.includes("surface") && photo.group === "Ansikte" && <p>De tre porträtten ger hud, drag och tatueringar till samma huvud. Vyn bredvid följer porträttets målvinkel. Käkleden öppnar munnen. En blinkning kräver att själva ögonlocken rör sig över ögat.</p>}
    {roles.includes("surface") && photo.id === "hander/handryggar" && <p>Handryggarna ger hud, naglar och tatueringar till modellens händer. Vyn bredvid visar händerna i den sittande grundposen.</p>}
    {photo.id === "hander/kortdrag-vanster" && <p>Bilden ger ett referensläge för vänsterhandens grepp vid skon. I rörelseprovet styrs handled och fingerleder så att fingertopparna följer kortets kant under utdraget.</p>}
    {photo.id === "rorelsereferens/kortvandning-hoger" && <p>Bilden ger ett referensläge för högerhandens grepp när kortet är på kant. Filmen ger ordningen för handbyte, vändning och släpp. Här visas riggens händer i vila.</p>}
    {photo.observed && <><p>{photo.observed.kalla}</p><details>
      <summary>Fotots riktning och ljus</summary><p>{photo.observed.observation.riktning} {photo.observed.observation.ljus}</p>
      <p>{photo.observed.osakerhet}</p></details></>}
    {photo.group === "Sittande" && front?.seated && <a href={measured}>Jämför utsnitt, ögonlinje och stolkontakter</a>}
    {project.dealer === "paulina" && project.edition === "fas-1/v1" && photo.id === "sittande/profil" &&
      <p><a href="/bildstandard/sittprofil#jamforelse">Visa den nya sittprofilen bredvid 3D-modellen</a></p>}
  </div>;
}

export function FilmEvidence({ film, expanded, context, children, comparison, anchorId, viewGuide }: {
  film: DealerMaterial["films"][number]; expanded?: boolean; context?: ReactNode; children?: ReactNode;
  anchorId?: string; viewGuide?: string;
  comparison?: TakeComparison;
}) {
  const player = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);
  const frameHeading = useId();
  const name = takeLabel(film.take, film.title);
  return <details open={expanded} id={anchorId}>
    <summary>{name}</summary>
    {name !== film.title && <p>{film.title}</p>}
    <p>Tagning <code>{film.take}</code> · {dimensions([film.width, film.height])} · {film.fps} fps · {film.frames} rutor · {film.appearance ? "Fotoyta" : "Kroppsform"} · {film.cameras.map(c => c.id).join(", ")}</p>
    {context}
    {comparison ? <DealComparison film={film} modelPlayer={player} {...comparison} viewGuide={viewGuide}/> :
      <>{viewGuide && <p>{viewGuide}</p>}
        <PlaybackSpeed speed={speed} onChange={rate => {
          if (player.current) {
            player.current.defaultPlaybackRate = rate;
            player.current.playbackRate = rate;
          }
          setSpeed(rate);
        }}/>
        <video controls playsInline preload="metadata" ref={player} aria-label={film.title} src={film.url}
          onRateChange={event => setSpeed(event.currentTarget.playbackRate)}/></>}
    {comparison && <><h3 id={frameHeading}>Bildrutor i Paulinas film</h3>
      <p>Knapparna nedan pausar Paulinas film på den valda rutan. Första bildrutan är 0.</p></>}
    <div className={styles.frameMarks} role={comparison ? "group" : undefined} aria-labelledby={comparison ? frameHeading : undefined}>
      {film.marks.map(m => m.seconds === undefined ?
      <span key={m.frame}>{m.label} · ruta {m.frame}</span> :
      <button key={m.frame} onClick={() => {
        if (player.current && m.seconds !== undefined) pauseAtMark(player.current, m.seconds);
      }}>{m.label} · ruta {m.frame}</button>)}</div>
    {!comparison && <p>Rutorna räknas från 0.</p>}
    {film.reviews.map(review => <p key={review.camera + review.note}><b>{review.camera} · ruta {review.frames.join(", ")}</b> · {review.note}</p>)}
    {children}
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
    {project.motions.length > 0 && <h3>Animationer på grundmodellen</h3>}
    {project.motions.length > 0 && project.activeModel && <p>Rörelseproven använder samma kropp, {project.activeModel.name}.</p>}
    {project.motions.map(record => {
      const { sha256, motion, url } = record;
      const film = project.films.find(f => f.motion === sha256 && f.take === motion.take);
      return <details key={sha256}><summary>{takeLabel(motion.take, film?.title ?? (motion.card ? "Kortprov" : "Rörelseprov"))}</summary>
        <p>Tagning <code>{motion.take}</code> · {motion.card && motion.card + " · "}{motion.keyframes} samplade lägen · {(motion.end - motion.start).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} s</p>
        <MotionComponents material={project} motion={record}/>
        <a href={url} download={motion.take + ".glb"}>Hämta den animerade GLB-filen</a></details>;
    })}
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
    {project.films.length > 0 && <h3>Renderade filmprov</h3>}
    {project.films.map(film => <FilmEvidence key={film.url} film={film}>
      <MotionComponents material={project} motion={project.motions.find(m => m.sha256 === film.motion)}/>
    </FilmEvidence>)}
    <a className={styles.jsonLink} href={doc + "json"} target="_blank" rel="noreferrer">Visa källfiler och kameravärden i JSON ↗</a>
  </section>;
}
