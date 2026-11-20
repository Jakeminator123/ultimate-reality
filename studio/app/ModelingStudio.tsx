"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight, ArrowUpRight, BookOpen, Box, ChevronLeft, ChevronRight,
  FolderOpen, ImageOff, Images, RefreshCw,
} from "lucide-react";
import { seriesCount } from "../lib/material-types";
import MaterialEvidence, { PhotoEvidence } from "./MaterialEvidence";
import { useCurrentModel } from "./useModelingInventory";
import styles from "./modeling.module.css";

const PoseReview = dynamic(() => import("./PoseReview"), {
  ssr: false,
  loading: () => <p className={styles.empty} role="status">Öppnar 3D-visningen…</p>,
});
const gallery = "/fotomall.html/fas-1/v1";
const shortNames: Record<string, string> = {
  front: "Front", trekvart: "Trekvart", profil: "Profil",
  handryggar: "Handryggar", "kortdrag-vanster": "Kortdrag", "kortvandning-hoger": "Vändning",
};

export default function ModelingStudio() {
  const [checkedRoute, setCheckedRoute] = useState(false);
  const [dealer, setDealer] = useState("paulina");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("pose")) {
      const archiveQuery = new URLSearchParams({ pose: query.get("pose") ?? "" });
      if (query.has("version")) archiveQuery.set("version", query.get("version") ?? "");
      window.location.replace("/ovrigt?" + archiveQuery);
      return;
    }
    setDealer(query.get("dealer") || "paulina");
    setCheckedRoute(true);
  }, []);
  return checkedRoute ? <CurrentModelingStudio dealer={dealer}/> : <p role="status">Öppnar modelleringsunderlaget…</p>;
}

function CurrentModelingStudio({ dealer }: { dealer: string }) {
  const [edition, setEdition] = useState("");
  const { inventory, loading, error, refresh } = useCurrentModel(edition, dealer);
  const name = dealer.charAt(0).toUpperCase() + dealer.slice(1);
  const paulinaFirst = dealer === "paulina" && inventory?.edition === "fas-1/v1";
  const [photoId, setPhotoId] = useState("sittande/front");
  const [missing, setMissing] = useState<string[]>([]);
  const photos = inventory?.photos ?? [];
  const groups = Array.from(new Set(photos.map(photo => photo.group)));
  const selectedIndex = Math.max(0, photos.findIndex(photo => photo.id === photoId));
  const selected = photos[selectedIndex];
  const source = selected?.url;
  const model = inventory?.activeModel;
  const cardFilm = inventory?.films.find(f => f.motion && f.card);
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
        </div>
        <figcaption className={styles.rail}><span>{name}{selected && " · " + selected.group}</span>
          {source && !missing.includes(source) &&
            <a href={source} target="_blank" rel="noreferrer">Visa original <ArrowUpRight size={14}/></a>}
        </figcaption>
      </figure>
      {selected && inventory && <PhotoEvidence photo={selected} project={inventory}/>}
    </section>

    <section className={styles.modelPanel} aria-labelledby="current-model">
      <header className={styles.panelHeader}>
        <div><p className={styles.meta}>3D-arbetsmodell</p><h2 id="current-model">{model?.name ?? "Modell för " + name}</h2></div>
        <Box size={23} strokeWidth={1.5} aria-hidden/>
      </header>
      <div className={styles.modelSurface}>
        {model ? <PoseReview key={model.url} model={model} cameraAngle={selected?.group === "Sittande" ? selected.targetAngle : undefined}/> : <div className={styles.empty} role="status">
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
        {photos.length > 0 && paulinaFirst && <a className={styles.inlineLink} href={gallery + "/index.html"}>Öppna galleriet <ArrowUpRight size={15}/></a>}
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
        </section>
      )}</div>
    </section>

    {inventory && <MaterialEvidence project={inventory}/>}
    <details className={styles.roadmap}>
      <summary>Från rigg till dealerfilm</summary>
      <ol>
        <li><strong>Filma ett kortdrag framifrån och från sidan samtidigt.</strong> Identifiera grepp, kort på kant och släpp i samma rutor. Sidovyn visar fingrarna när framsidan skyms.</li>
        <li><strong>{cardFilm ? "Jämför och förfina det animerade greppet." : "Passa handen mot kortet i 3D."}</strong> Styr handled, fingrar och ett gemensamt kort efter referensfilmen. Lägg till släpp och landning. Rendera samma tagning från stol 4 och stol 1. {cardFilm
          ? <a href={cardFilm.url}>Se utdraget med den valda modellversionen</a>
          : <a href="/bordsprov/rum3d?rum=mesh&stol=4&glas=1">Öppna bordsprovet med 08-riggen</a>}</li>
        <li><strong>Välj filmens utseende.</strong> Rendera båda kamerorna från samma rörelse. Om hud eller tyg ser konstgjorda ut, jämför fototexturen med film projicerad på den rörliga kroppen från en känd kamera.</li>
      </ol>
    </details>

    <nav className={styles.resources} aria-label="Bildverktyg och tidigare prov">
      <a href="/bildstandard"><BookOpen size={20}/><span><b>Bildstandard</b><small>Kamera, pose och prompt för varje vy</small></span><ArrowRight size={17}/></a>
      <a href="/bildpipeline"><Images size={20}/><span><b>Runways bildpipeline</b><small>Skapa en bildserie från egna foton</small></span><ArrowRight size={17}/></a>
      <a href="/ovrigt"><FolderOpen size={20}/><span><b>Övrigt</b><small>Kroppsprov, äldre riggar och labbets inkorg</small></span><ArrowRight size={17}/></a>
    </nav>
  </section>;
}
