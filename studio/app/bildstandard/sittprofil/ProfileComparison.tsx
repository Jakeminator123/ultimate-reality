"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ActiveDealerModel } from "../../../lib/modeling";
import type { Photo } from "../../../lib/material-types";
import { bodyPixels, checkSeatedFrame, seatedStandard, type SeatedMeasurement } from "../../../lib/seated-review";
import { PhotoCameraGuides } from "../../MaterialEvidence";
import styles from "../../modeling.module.css";

const PoseReview = dynamic(() => import("../../PoseReview"), { ssr: false, loading: () => <p role="status">Öppnar 3D-modellen…</p> });
export type ComparisonPhoto = Photo & { seated: SeatedMeasurement };
const number = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });

export default function ProfileComparison({ trial, front, previous, model, candidate, candidateError, openCandidate }: {
  trial: ComparisonPhoto; front: ComparisonPhoto; previous: ComparisonPhoto; model: ActiveDealerModel;
  candidate: ActiveDealerModel | null; candidateError: string; openCandidate: boolean;
}) {
  const [source, setSource] = useState<"trial" | "previous" | "front">("trial");
  const [guides, setGuides] = useState(false);
  const [body, setBody] = useState<"appearance" | "geometry" | "candidate">(openCandidate && candidate ? "candidate" : "appearance");
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
      <header className={styles.panelHeader}><div><p className={styles.meta}>{body === "candidate" ? "3D-prov med ny profil" : "3D-arbetsmodell"}</p><h2>{viewedModel.name}</h2></div></header>
      <div className={styles.modelSurface}><PoseReview key={body} model={viewedModel} initialVersion={body === "appearance" ? "utseende" : "front"} cameraAngle={photo.targetAngle}
        reference={photo} guides={guides} onGuides={setGuides}/></div>
      <div className={styles.sourceNote}>
        {candidate && <div className={styles.archiveLinks} role="group" aria-label="Välj kroppsmodell">
          <button aria-pressed={body !== "candidate"} onClick={() => setBody("geometry")}>Aktiv rigg · v2</button>
          <button aria-pressed={body === "candidate"} onClick={() => setBody("candidate")}>Kroppsprov · v3</button>
        </div>}
        <p>{body === "candidate" ? "Sittfronten ger kroppen. Trekvarten och den nya profilen styr huvudets och nackens hållning. V3 är ett prov av kroppens geometri."
          : "Den här riggens hållning och fotoyta bygger på den tidigare bildutgåvan. Den nya profilen visas som jämförelse."}</p>
        {candidateError && <p role="status">{candidateError}</p>}
      </div>
    </section>
  </section>;
}
