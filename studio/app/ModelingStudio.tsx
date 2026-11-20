"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight, ArrowUpRight, BookOpen, Box, ChevronLeft, ChevronRight,
  FolderOpen, ImageOff, Images, RefreshCw,
} from "lucide-react";
import { bildrecept } from "../fotomall/bildrecept";
import { useCurrentModel } from "./useModelingInventory";
import styles from "./modeling.module.css";

const PoseReview = dynamic(() => import("./PoseReview"), {
  ssr: false,
  loading: () => <p className={styles.empty} role="status">Öppnar 3D-visningen…</p>,
});
const gallery = "/fotomall.html/fas-1/v1";
const groups = Array.from(new Set(bildrecept.map(photo => photo.grupp)));
const shortNames: Record<string, string> = {
  front: "Front", trekvart: "Trekvart", profil: "Profil",
  handryggar: "Handryggar", "kortdrag-vanster": "Kortdrag", "kortvandning-hoger": "Vändning",
};

export default function ModelingStudio() {
  const [checkedRoute, setCheckedRoute] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("pose")) {
      const archiveQuery = new URLSearchParams({ pose: query.get("pose") ?? "" });
      if (query.has("version")) archiveQuery.set("version", query.get("version") ?? "");
      window.location.replace("/ovrigt?" + archiveQuery);
      return;
    }
    setCheckedRoute(true);
  }, []);
  return checkedRoute ? <CurrentModelingStudio /> : <p role="status">Öppnar modelleringsunderlaget…</p>;
}

function CurrentModelingStudio() {
  const { inventory, loading, error, refresh } = useCurrentModel();
  const [photoId, setPhotoId] = useState("sittande/front");
  const [missing, setMissing] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);
  const selectedIndex = bildrecept.findIndex(photo => photo.id === photoId);
  const selected = bildrecept[selectedIndex];
  const source = gallery + "/" + selected.id + ".png";
  const model = inventory?.activeModel;
  const markMissing = (id: string) => setMissing(ids => ids.includes(id) ? ids : [...ids, id]);
  const markAvailable = (id: string) => setAvailable(ids => ids.includes(id) ? ids : [...ids, id]);

  function stepPhoto(direction: number) {
    const next = (selectedIndex + direction + bildrecept.length) % bildrecept.length;
    setPhotoId(bildrecept[next].id);
  }

  return <section className={styles.workspace} aria-label="Paulinas aktuella modelleringsunderlag">
    <section className={styles.photoPanel} aria-labelledby="selected-reference">
      <header className={styles.panelHeader}>
        <div><p className={styles.meta}>Bildreferens · Fas 1 v1</p><h2 id="selected-reference">{selected.namn}</h2></div>
        <div className={styles.arrows}>
          <button aria-label="Föregående bildreferens" onClick={() => stepPhoto(-1)}><ChevronLeft size={17}/></button>
          <button aria-label="Nästa bildreferens" onClick={() => stepPhoto(1)}><ChevronRight size={17}/></button>
        </div>
      </header>
      <figure className={styles.photoFigure}>
        <div className={styles.photoSurface}>
          {missing.includes(source)
            ? <div className={styles.empty}><ImageOff size={26}/><p>Bildfilen saknas på den här datorn.</p></div>
            : <img key={source} src={source} alt={"Paulina · " + selected.namn} onLoad={() => markAvailable(selected.id)} onError={() => markMissing(source)} />}
        </div>
        <figcaption className={styles.rail}><span>Paulina · {selected.grupp}</span>
          {available.includes(selected.id) && !missing.includes(source) &&
            <a href={source} target="_blank" rel="noreferrer">Visa original <ArrowUpRight size={14}/></a>}
        </figcaption>
      </figure>
      {selected.grupp === "Sittande" && <p className={styles.sourceNote}>
        Bildkälla · ImageGen i Codex<br/><a href="/bildstandard/sitthojd">Visa originalens bildskala och sitsnivå</a>
      </p>}
    </section>

    <section className={styles.modelPanel} aria-labelledby="current-model">
      <header className={styles.panelHeader}>
        <div><p className={styles.meta}>3D-arbetsmodell</p><h2 id="current-model">{model?.name ?? "Paulina · Fas 1 v2"}</h2></div>
        <Box size={23} strokeWidth={1.5} aria-hidden/>
      </header>
      <div className={styles.modelSurface}>
        {model ? <PoseReview model={model} cameraAngle={selected.grupp === "Sittande" ? selected.vinkelGrader : undefined}/> : <div className={styles.empty} role="status">
          <Box size={28} strokeWidth={1.4}/>
          <p>{error || (loading ? "Läser den lokala modellen…" : "Paulinas v2-modell saknas på den här datorn.")}</p>
          {!loading && <button onClick={refresh}><RefreshCw size={14}/> Läs in igen</button>}
        </div>}
      </div>
      <div className={styles.rail}><span>Sittande kropp · Fas 1</span>{model && <span>Dra för att vrida</span>}</div>
      {model && error && <p role="alert" className="alert">{error}</p>}
    </section>

    <section className={styles.gallery} aria-labelledby="phase-one">
      <header className={styles.galleryHeader}>
        <div><h2 id="phase-one">Paulinas bildserie</h2><p>Fas 1 v1 · 11 grundbilder och en extra kortvändning</p></div>
        {available.length > 0 && <a className={styles.inlineLink} href={gallery + "/index.html"}>Öppna galleriet <ArrowUpRight size={15}/></a>}
      </header>
      <div className={styles.families}>{groups.map(group =>
        <section className={styles.family} key={group} aria-label={group}>
          <h3>{group}</h3>
          <div className={styles.thumbnails}>{bildrecept.filter(photo => photo.grupp === group).map(photo =>
            <button key={photo.id} aria-label={photo.namn} aria-pressed={selected.id === photo.id} onClick={() => setPhotoId(photo.id)}>
              {missing.includes(photo.id)
                ? <span className={styles.thumbMissing}><ImageOff size={16} aria-label="Bildfil saknas"/></span>
                : <img src={gallery + "/" + photo.id + ".png?vy=miniatyr"} alt="" loading="lazy"
                    onLoad={() => markAvailable(photo.id)} onError={() => markMissing(photo.id)}/>}
              <span>{shortNames[photo.id.split("/")[1]] ?? photo.namn}</span>
            </button>
          )}</div>
          {group === "Sittande" && <a className={styles.heightLink} href="/bildstandard/sitthojd">Jämför sitthöjd och bildskala <ArrowRight size={13}/></a>}
        </section>
      )}</div>
    </section>

    <nav className={styles.resources} aria-label="Bildverktyg och tidigare prov">
      <a href="/bildstandard"><BookOpen size={20}/><span><b>Bildstandard</b><small>Kamera, pose och prompt för varje vy</small></span><ArrowRight size={17}/></a>
      <a href="/bildpipeline"><Images size={20}/><span><b>Runways bildpipeline</b><small>Skapa en bildserie från egna foton</small></span><ArrowRight size={17}/></a>
      <a href="/ovrigt"><FolderOpen size={20}/><span><b>Övrigt</b><small>Kroppsprov, äldre riggar och labbets inkorg</small></span><ArrowRight size={17}/></a>
    </nav>
  </section>;
}
