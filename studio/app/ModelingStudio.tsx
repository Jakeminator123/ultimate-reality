"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight, ArrowUpRight, BookOpen, Box, ChevronLeft, ChevronRight,
  FolderOpen, ImageOff, Images, RefreshCw,
} from "lucide-react";
import { hasReviewedSeatCameras, seriesCount, type DealerMaterial } from "../lib/material-types";
import MaterialEvidence, { PhotoCameraGuides, PhotoEvidence } from "./MaterialEvidence";
import { takeLink } from "./MotionTake";
import { useCurrentModel } from "./useModelingInventory";
import styles from "./modeling.module.css";

const PoseReview = dynamic(() => import("./PoseReview"), {
  ssr: false,
  loading: () => <p className={styles.empty} role="status">Öppnar 3D-visningen…</p>,
});
const gallery = "/fotomall.html/fas-1/v1";
const shortNames: Record<string, string> = {
  front: "Front", trekvart: "Trekvart", profil: "Profil",
  handryggar: "Handryggar", "kortdrag-vanster": "På kortets rygg", "kortvandning-hoger": "Vändning",
};

function latestReviewedDeal(material: DealerMaterial | null) {
  if (!material?.geometry || !material.activeModel) return;
  const geometry = material.geometry.sha256;
  const appearance = material.appearance?.sha256 ?? null;
  return material.films.filter(film =>
    film.take.startsWith("samspel-") && film.motion && film.card && film.geometry === geometry && film.appearance === appearance &&
    hasReviewedSeatCameras(film))
    .sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }))[0];
}

export default function ModelingStudio() {
  const [checkedRoute, setCheckedRoute] = useState(false);
  const [dealer, setDealer] = useState("paulina");
  const [initialEdition, setInitialEdition] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("pose")) {
      const archiveQuery = new URLSearchParams({ pose: query.get("pose") ?? "" });
      if (query.has("version")) archiveQuery.set("version", query.get("version") ?? "");
      window.location.replace("/ovrigt?" + archiveQuery);
      return;
    }
    setDealer(query.get("dealer") || "paulina");
    setInitialEdition(query.get("revision") || "");
    setCheckedRoute(true);
  }, []);
  return checkedRoute ? <CurrentModelingStudio dealer={dealer} initialEdition={initialEdition}/> : <p role="status">Öppnar modelleringsunderlaget…</p>;
}

function CurrentModelingStudio({ dealer, initialEdition }: { dealer: string; initialEdition: string }) {
  const [edition, setEdition] = useState(initialEdition);
  const { inventory, loading, error, refresh } = useCurrentModel(edition, dealer);
  const name = dealer.charAt(0).toUpperCase() + dealer.slice(1);
  const paulinaFirst = dealer === "paulina" && inventory?.edition === "fas-1/v1";
  const [photoId, setPhotoId] = useState("sittande/front");
  const [missing, setMissing] = useState<string[]>([]);
  const [cameraGuides, setCameraGuides] = useState(false);
  const photos = inventory?.photos ?? [];
  const groups = Array.from(new Set(photos.map(photo => photo.group)));
  const selectedIndex = Math.max(0, photos.findIndex(photo => photo.id === photoId));
  const selected = photos[selectedIndex];
  const cameraDetail = selected?.group === "Ansikte" ? "ansikte" :
    selected?.group === "Händer" || selected?.group === "Rörelsereferens" ? "händer" : undefined;
  const source = selected?.url;
  const model = inventory?.activeModel;
  const proofQuery = new URLSearchParams({ dealer });
  if (inventory?.revision) proofQuery.set("revision", inventory.revision);
  const proofPage = "/modellering/rorelseprov?" + proofQuery;
  const reviewedDeal = latestReviewedDeal(inventory);
  const reviewedLink = reviewedDeal && inventory ? takeLink(inventory, reviewedDeal.take) : undefined;
  const markMissing = (id: string) => setMissing(ids => ids.includes(id) ? ids : [...ids, id]);

  function stepPhoto(direction: number) {
    const next = (selectedIndex + direction + photos.length) % photos.length;
    setPhotoId(photos[next].id);
  }

  return <section className={styles.workspace} aria-label={"Modelleringsunderlag för " + name}>
    <section className={styles.photoPanel} aria-labelledby="selected-reference">
      <header className={styles.panelHeader}>
        <div><p className={styles.meta}>Bildreferens · {inventory?.edition ?? "Fas 1"}</p><h2 id="selected-reference">{selected?.name ?? "Bildoriginal"}</h2></div>
        <div className={styles.arrows}>
          <button aria-label="Föregående bildreferens" disabled={!selected} onClick={() => stepPhoto(-1)}><ChevronLeft size={17}/></button>
          <button aria-label="Nästa bildreferens" disabled={!selected} onClick={() => stepPhoto(1)}><ChevronRight size={17}/></button>
        </div>
      </header>
      <figure className={styles.photoFigure}>
        <div className={styles.photoSurface}>
          {!source || missing.includes(source)
            ? <div className={styles.empty}><ImageOff size={26}/><p>{loading ? "Läser bildoriginalen…" : "Bildfilen saknas på den här datorn."}</p></div>
            : <img key={source} src={source} alt={name + " · " + selected.name} onError={() => markMissing(source)} />}
          {cameraGuides && source && !missing.includes(source) && selected && <PhotoCameraGuides photo={selected}/>}
        </div>
        <figcaption className={styles.rail}><span>{name}{selected && " · " + selected.group}</span>
          {source && !missing.includes(source) &&
            <a href={source} target="_blank" rel="noreferrer">Visa original <ArrowUpRight size={14}/></a>}
        </figcaption>
      </figure>
      {selected && inventory && <PhotoEvidence photo={selected} project={inventory} reviewedDeal={reviewedDeal}/>}
    </section>

    <section className={styles.modelPanel} aria-labelledby="current-model">
      <header className={styles.panelHeader}>
        <div><p className={styles.meta}>3D-visare · grundmodellen i vila</p><h2 id="current-model">{model?.name ?? "Modell för " + name}</h2></div>
        <Box size={23} strokeWidth={1.5} aria-hidden/>
      </header>
      {inventory?.seatedTrial && <div className={styles.modelFilm}>
        <a className={styles.inlineLink} href="/bildstandard/sittprofil?modell=prov#jamforelse">
          Öppna {inventory.seatedTrial.name} <ArrowRight size={15}/></a>
      </div>}
      {inventory?.seatedTrial?.film && <div className={styles.modelFilm}>
        <a className={styles.inlineLink} href={inventory.seatedTrial.film.url}>Spela given på {inventory.seatedTrial.name} <ArrowRight size={15}/></a>
        <span>Stol 4 och stol 1 · <code>{inventory.seatedTrial.film.take}</code></span>
        <a className={styles.inlineLink} href="/bildstandard/sittprofil?modell=prov#givfilm">Granska i filmspelaren</a>
      </div>}
      {reviewedDeal && reviewedLink && model && <div className={styles.modelFilm}>
        <a className={styles.inlineLink} href={reviewedLink}>Öppna senaste granskade given <ArrowRight size={15}/></a>
        <span>Givfilmens kropp · {model.name} · <code>{reviewedDeal.take}</code></span>
      </div>}
      <div className={styles.modelSurface}>
        {model ? <PoseReview key={model.url} model={model} cameraDetail={cameraDetail} cameraAngle={cameraDetail === "händer" ? undefined : selected?.targetAngle}
          reference={selected?.group === "Sittande" ? selected : undefined} guides={cameraGuides} onGuides={setCameraGuides}/> : <div className={styles.empty} role="status">
          <Box size={28} strokeWidth={1.4}/>
          <p>{error || (loading ? "Läser den lokala modellen…" : "Modellfilen saknas på den här datorn.")}</p>
          {!loading && <button onClick={refresh}><RefreshCw size={14}/> Läs in igen</button>}
        </div>}
      </div>
      <div className={styles.rail}><span>{inventory && inventory.versions.length > 1 ?
        <label>Modellutgåva <select aria-label="Modellutgåva" value={inventory.revision ?? ""} onChange={e => setEdition(e.target.value)}>
        {inventory.versions.map(v => <option key={v.key} value={v.key}>{v.name} · {v.key.slice(0, 8)}</option>)}</select></label> : model?.name}</span>{model && <span>Dra för att vrida</span>}</div>
      {model && error && <p role="alert" className="alert">{error}</p>}
    </section>

    <section className={styles.gallery} aria-labelledby="phase-one">
      <header className={styles.galleryHeader}>
        <div><h2 id="phase-one">{dealer === "paulina" ? "Paulinas bildserie" : "Bildserie · " + name}</h2><p>{inventory ? inventory.edition + " · " + seriesCount(photos) : "Läser bildregistret…"}</p></div>
        {photos.length > 0 && paulinaFirst && <div className={styles.galleryLinks}><a className={styles.inlineLink} href="/bildstandard#utgavekontroll">Kontroll av bildutgåvan</a>
          <a className={styles.inlineLink} href={gallery + "/index.html"}>Öppna galleriet <ArrowUpRight size={15}/></a></div>}
      </header>
      <div className={styles.families}>{groups.map(group =>
        <section className={styles.family} key={group} aria-label={group}>
          <h3>{group}</h3>
          <div className={styles.thumbnails}>{photos.filter(photo => photo.group === group).map(photo =>
            <button key={photo.sha256} aria-label={photo.name} aria-pressed={selected?.id === photo.id} onClick={() => setPhotoId(photo.id)}>
              {missing.includes(photo.url)
                ? <span className={styles.thumbMissing}><ImageOff size={16} aria-label="Bildfil saknas"/></span>
                : <img src={photo.url + "&vy=miniatyr"} alt="" loading="lazy" onError={() => markMissing(photo.url)}/>}
              <span>{shortNames[photo.id.split("/")[1]] ?? photo.name}</span>
            </button>
          )}</div>
          {group === "Sittande" && paulinaFirst && <a className={styles.heightLink} href="/bildstandard/sitthojd">Jämför sitthöjd och bildskala <ArrowRight size={13}/></a>}
          {group === "Ansikte" && <a className={styles.heightLink} href={proofPage + "#ansikte"}>Granska blinkningen <ArrowRight size={13}/></a>}
          {group === "Händer" && <a className={styles.heightLink} href={reviewedLink ?? proofPage + "#hander"}>
            {reviewedLink ? "Följ kortet i den granskade given" : "Öppna handproven"} <ArrowRight size={13}/></a>}
        </section>
      )}</div>
    </section>

    {inventory && <MaterialEvidence project={inventory}/>}
    <details className={styles.roadmap}>
      <summary>Från rigg till dealerfilm</summary>
      <ol>
        <li><strong>Passa bildserien mot en kropp.</strong> Sittfronten ger grundposen. Sittvinklarna kontrollerar hållningen, och porträtten och handryggarna ger detaljer till fotoytan.</li>
        <li><strong>Prova ansikte och händer parallellt.</strong> Kontrollera hur ögonlocken täcker iris. Följ samma kort från skon genom handbytet tills det ligger stilla på filten. <a href={proofPage}>Öppna rörelseproven</a></li>
        {reviewedLink && <li><strong>Giv med blinkning på samma kropp.</strong> Filmen visar kortet, händerna och ögonlocken från stol 4 och stol 1.
          {" "}<a href={reviewedLink}>Öppna den granskade tagningen</a></li>}
        <li><strong>Bedöm den färdiga filmrutan.</strong> Jämför handkontakt, ansiktsuttryck, hår, tyg och skuggor i båda kamerorna. När en fingerkontakt skyms i referensfilmen behövs en samtidig sidovy för att mäta djupet.</li>
      </ol>
    </details>

    <nav className={styles.resources} aria-label="Bildverktyg och tidigare prov">
      <a href="/bildstandard"><BookOpen size={20}/><span><b>Bildstandard</b><small>Kamera, pose och prompt för varje vy</small></span><ArrowRight size={17}/></a>
      <a href="/bildpipeline"><Images size={20}/><span><b>Runways bildpipeline</b><small>Skapa en bildserie från egna foton</small></span><ArrowRight size={17}/></a>
      <a href="/ovrigt"><FolderOpen size={20}/><span><b>Övrigt</b><small>Kroppsprov, äldre riggar och labbets inkorg</small></span><ArrowRight size={17}/></a>
    </nav>
  </section>;
}
