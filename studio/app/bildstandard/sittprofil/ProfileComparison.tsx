"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import type { ActiveDealerModel } from "../../../lib/modeling";
import type { DealerMaterial, Photo } from "../../../lib/material-types";
import { bodyPixels, checkSeatedFrame, seatedStandard, type SeatedMeasurement } from "../../../lib/seated-review";
import { FilmEvidence, PhotoCameraGuides } from "../../MaterialEvidence";
import styles from "../../modeling.module.css";

const PoseReview = dynamic(() => import("../../PoseReview"), { ssr: false, loading: () => <p role="status">Öppnar 3D-modellen…</p> });
export type ComparisonPhoto = Photo & { seated: SeatedMeasurement };
type Film = DealerMaterial["films"][number];
const number = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });

function filmLink(take: string) {
  return "/bildstandard/sittprofil?" + new URLSearchParams({ modell: "prov", tagning: take }) + "#givfilm";
}

export default function ProfileComparison({ trial, front, previous, model, candidate, candidateError, openCandidate, requestedTake, film, continuations }: {
  trial: ComparisonPhoto; front: ComparisonPhoto; previous: ComparisonPhoto; model: ActiveDealerModel;
  candidate: (ActiveDealerModel & { run: string | null; appearanceError?: string; defaultTake?: string }) | null;
  candidateError: string; openCandidate: boolean; requestedTake?: string;
  film?: Film; continuations: { take: string; end: NonNullable<Film["poses"]>["end"] }[];
}) {
  const [source, setSource] = useState<"trial" | "previous" | "front">("trial");
  const [guides, setGuides] = useState(false);
  const [body, setBody] = useState<"films" | "candidate">(openCandidate && candidate ? "candidate" : "films");
  const viewedModel = body === "candidate" && candidate ? candidate : model;
  const photo = { trial, previous, front }[source];
  const names = { trial: "Ny sittprofil", previous: "Tidigare sittprofil", front: "Sittfront" } as const;
  const check = checkSeatedFrame(photo, front);
  return <section id="jamforelse" className={styles.workspace + " " + styles.profilePair} aria-label="Foto bredvid 3D-modell">
    <section className={styles.photoPanel}>
      <header className={styles.panelHeader}><div><p className={styles.meta}>
        {source === "trial" ? "ImageGen · " + photo.file.split("/")[1] : "Bildutgåva · fas-1/v1"}</p><h2>{names[source]}</h2></div></header>
      <figure className={styles.photoFigure}>
        <div className={styles.photoSurface}><img src={photo.url} alt={"Paulina · " + names[source]}/>
          {guides && <PhotoCameraGuides photo={photo}/>}</div>
        <figcaption className={styles.rail}><span>{photo.format} · {photo.width} × {photo.height} px</span><a href={photo.url} target="_blank" rel="noreferrer">Öppna original ↗</a></figcaption>
      </figure>
      <div className={styles.sourceNote}>
        <div className={styles.archiveLinks} role="group" aria-label="Välj jämförelsefoto">
          {(["trial", "previous", "front"] as const).map(key => <button key={key} aria-pressed={key === source} onClick={() => setSource(key)}>{names[key]}</button>)}
        </div>
        <p><strong>{bodyPixels(photo)} px hjässa–sula</strong> · skalskillnad {number(check.scaleDelta)} % · mittpunkt {number(check.centreDelta)} procentenheter mot sittfronten.</p>
        <p className={check.review ? styles.photoWarning : undefined}>{check.review ? "Granska utsnittet." : "Utsnittet ligger inom gränserna."} Gräns ±{seatedStandard.scalePercent} % för bildskala och ±{seatedStandard.centrePercent} procentenhet för mittpunkt.</p>
        <p>Sitsens synliga underkant ligger på pixelrad {photo.seated.seatY}, jämfört med {front.seated.seatY} i sittfronten. Fotokamerans fysiska höjd och lutning är okända.</p>
      </div>
    </section>
    <section className={styles.modelPanel}>
      <header className={styles.panelHeader}><div><p className={styles.meta}>{body === "candidate" ? "SAM-kroppsprov från sittbilderna" : "Kroppsmodell för de tidigare givfilmerna"}</p><h2>{viewedModel.name}</h2></div></header>
      <div className={styles.modelSurface}><PoseReview key={viewedModel.url} model={viewedModel}
        initialVersion={viewedModel.appearanceUrl ? "utseende" : "front"} cameraAngle={photo.targetAngle}
        reference={photo} guides={guides} onGuides={setGuides}/></div>
      <div className={styles.sourceNote}>
        {candidate && <div className={styles.archiveLinks} role="group" aria-label="Välj kroppsmodell">
          <button aria-pressed={body === "candidate"} onClick={() => setBody("candidate")}>{candidate.name}</button>
          <button aria-pressed={body === "films"} onClick={() => setBody("films")}>{model.name}</button>
        </div>}
        {body === "candidate" && candidate ? <>
          <p>Sittfronten ger kroppsformen. Trekvarten och den nya sittprofilen ligger till grund för hållningen.
            {candidate.appearanceUrl && " Växla mellan Kroppsform och Fotoutseende under modellen för att jämföra samma kameravy."}
            {!candidate.appearanceUrl && !candidate.appearanceError && " Kroppsprovet visas med neutral yta."}
            {" "}Bildutgåvans grundmodell i 3D-modellering är {model.name}.</p>
          {candidate.appearanceError && <p role="status">{candidate.appearanceError}</p>}
          {(film || continuations.length > 0) && <p><a href="#givfilm">Se given på den här SAM-kroppen från stol 4 och stol 1</a></p>}
          {candidate.run && <small>SAM-körning <code>{candidate.run}</code></small>}
        </> : <p>Den här kroppen använder bildutgåvans sittprofil. Samma kropp visas i bildutgåvans rörelseprov.</p>}
        {candidateError && <p role="status">{candidateError}</p>}
        {openCandidate && !candidate && !candidateError && <p role="status">SAM-provet med den nya sittprofilen saknas för den här utgåvan.</p>}
      </div>
    </section>
    {body === "candidate" && candidate && (film || continuations.length > 0 || requestedTake !== undefined) && <section id="givfilm" className={styles.proof + " " + styles.combinedProof} aria-labelledby="provfilm-rubrik">
      <h2 id="provfilm-rubrik">Givfilm på {candidate.name}</h2>
      {continuations.length > 0 && <nav aria-label="Välj slutpose efter given till plats 4">
        <p>Från REDO A2.3 till plats 4</p>
        <div className={styles.archiveLinks}>{continuations.map(option => {
          const label = option.end === "A1" ? "Till VILA A1" : "Till REDO A2.3 för nästa kort";
          const current = option.take === film?.take;
          return <Link key={option.take} href={filmLink(option.take)} prefetch={false} scroll={false} aria-current={current ? "page" : undefined}>
            {current ? <strong>{label}</strong> : label}</Link>;
        })}</div>
      </nav>}
      {film ? <>
        <p>Stol 4 och stol 1 visar samma tagning på provkroppens egen fotoyta.</p>
        <FilmEvidence film={film} expanded/>
      </> : requestedTake !== undefined ? <p role="status">Tagningen <code>{requestedTake}</code> finns inte bland den här kroppens granskade filmer.
        {candidate.defaultTake && <> <Link href={filmLink(candidate.defaultTake)} prefetch={false}>Öppna studions valda tagning</Link></>}</p>
        : <p>Välj en granskad tagning ovan.</p>}
    </section>}
  </section>;
}
