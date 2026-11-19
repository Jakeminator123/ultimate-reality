"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Box, Cpu, FolderOpen, Image as ImageIcon, Layers3, RefreshCw } from "lucide-react";
import { displayName, mediaUrl } from "../lib/model";
import { resultUrl, type ModelingInventory } from "../lib/modeling";

const knownViews: Record<string, string> = {
  "01_staende_bakgrund.png": "Stående · original",
  "02_staende_frilagd.png": "Stående · frilagd",
  "03_sittande_bakgrund.png": "Sittande · original",
  "04_sittande_frilagd.png": "Sittande · frilagd",
  "05_sittande_sidoprofil_genererad.png": "Sittande · profil",
  "06_staende_trekvart_genererad.png": "Stående · trekvart",
};
const label = (name: string) => knownViews[name] || displayName(name);
const sourceForCutout: Record<string, string> = {
  "02_staende_frilagd.png": "01_staende_bakgrund.png",
  "04_sittande_frilagd.png": "03_sittande_bakgrund.png",
};
type View = "photo" | "mesh" | "sheet";

export default function ModelingStudio() {
  const [data, setData] = useState<ModelingInventory | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageName, setImageName] = useState("");
  const [poseId, setPoseId] = useState("");
  const [view, setView] = useState<View>("photo");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/modeling", { signal: controller.signal, cache: "no-store" });
        const inventory = await response.json();
        if (!response.ok) throw Error(inventory.error || "Modelleringsunderlaget kunde inte läsas.");
        if (!controller.signal.aborted) setData(inventory);
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  const images = data?.images ?? [];
  const poses = data?.poses ?? [];
  const photo = [imageName, "03_sittande_bakgrund.png"].find(name => images.includes(name)) ?? images[0];
  const sourceForPhoto = sourceForCutout[photo] ?? photo;
  const pose = poses.find(p => p.run + "/" + p.index === poseId) ?? poses.find(p => p.source === sourceForPhoto);
  const showingPhoto = view === "photo" || !pose;
  function selectPhoto(name: string) {
    setImageName(name);
    setPoseId("");
    setView("photo");
  }

  return <section className="modeling-studio" aria-label="Lokalt modelleringsunderlag">
    {error && <p role="alert" className="alert">{error}</p>}
    <div className="modeling-grid">
      <section className="reference-desk">
        <header className="desk-head">
          <h2>{showingPhoto ? "Bildreferens" : view === "mesh" ? "Vridbar kroppsmodell" : "Foto och SAM-resultat"}</h2>
          <div className="view-switch" aria-label="Visning">
            <button aria-pressed={showingPhoto} onClick={() => setView("photo")}><ImageIcon size={14}/> Foto</button>
            <button aria-pressed={!showingPhoto && view === "sheet"} disabled={!pose?.hasSheet} onClick={() => setView("sheet")}><Layers3 size={14}/> Överlägg</button>
            <button aria-pressed={!showingPhoto && view === "mesh"} disabled={!pose?.hasViewer} onClick={() => setView("mesh")}><Box size={14}/> 3D</button>
          </div>
        </header>
        <figure className="reference-figure">
          <div className={"reference-surface " + (showingPhoto && photo?.includes("frilagd") ? "transparent-surface" : "")}>
            {showingPhoto ? photo
              ? <img src={mediaUrl(photo)} alt={label(photo)} />
              : <p>{loading ? "Läser labbets inkorg…" : "Lägg en bild i labbets inkorg och uppdatera vyn."}</p>
              : view === "mesh" ? <iframe key={resultUrl(pose, "mesh")} title={"Vridbar SAM-modell av " + label(pose.source)} sandbox="allow-scripts" src={resultUrl(pose, "mesh")} />
              : <img src={resultUrl(pose, "sheet")} alt={"Original, SAM-överlägg och vriden modell från " + label(pose.source)} />}
          </div>
          <figcaption><strong>{showingPhoto ? photo && label(photo) : pose && label(pose.source)}</strong>
            <span>{showingPhoto ? photo : view === "mesh" ? "Dra för att vrida · scrolla för att zooma" : "Original · överlägg · 45°"}</span></figcaption>
        </figure>
        <div className="contact-heading"><h3>Bildinkorg</h3><span>{images.length} bilder</span>
          <button onClick={() => setRevision(v => v + 1)} disabled={loading} aria-label="Uppdatera modelleringsunderlag"><RefreshCw size={15}/></button>
        </div>
        <div className="contact-strip">{images.map(name =>
          <button key={name} aria-pressed={photo === name && showingPhoto} onClick={() => selectPhoto(name)}>
            <img loading="lazy" src={mediaUrl(name)} alt="" /><span>{label(name)}</span>
          </button>)}</div>
      </section>
      <aside className="model-inspector">
        <section className="sam-card">
          <div className="machine-symbol"><Cpu size={24}/></div>
          <h2>SAM 3D Body</h2>
          <p>Ett foto ger en uppskattad kroppsform och pose för händer, fötter och kropp. Hår, kläder och tatueringar behöver egna bildreferenser.</p>
          <dl><dt>Grafikkort</dt><dd>{data ? data.gpu ?? "Kunde inte avläsas" : "Läser…"}</dd>
            <dt>Modellvikter på disk</dt><dd>{data ? data.checkpoints.join(" / ") || "Inga hittades" : "Läser…"}</dd></dl>
          <a href="https://github.com/facebookresearch/sam-3d-body" target="_blank" rel="noreferrer">Metas modellguide <ArrowUpRight size={14}/></a>
        </section>
        <section className="model-inspect-section">
          <h2>Sparade kroppsprov</h2>
          {poses.length ? <>
            <label htmlFor="sam-pose">Källbild och körning</label>
            <select id="sam-pose" value={pose ? pose.run + "/" + pose.index : ""} onChange={e => {
              const selected = poses.find(p => p.run + "/" + p.index === e.target.value);
              if (!selected) return;
              setPoseId(e.target.value);
              if (images.includes(selected.source)) setImageName(selected.source);
              setView(selected.hasViewer ? "mesh" : selected.hasSheet ? "sheet" : "photo");
            }}><option value="" disabled>Välj ett kroppsprov</option>{poses.map(p => <option key={p.run + "/" + p.index} value={p.run + "/" + p.index}>{label(p.source)} · {p.run.slice(10, 12)}/{p.run.slice(8, 10)} {p.run.slice(13, 15)}.{p.run.slice(15, 17)} UTC</option>)}</select>
            {pose && <small>{pose.run}</small>}
            {pose?.hasComparison && <p><a href={resultUrl(pose, "comparison")} target="_blank" rel="noreferrer">Jämför proportioner och vinklar</a></p>}
          </> : <p>{loading ? "Läser sparade prov…" : "Inga bevarade SAM-prov hittades."}</p>}
        </section>
        <section className="model-inspect-section">
          <h2>Bilder för nästa vinkel</h2>
          <ol><li><b>Sittande från sidan</b><span>Visa stol, höft, knän och fötter i samma pose. De döljs av bordet i frontbilden.</span></li>
            <li><b>Stående profil och trekvart</b><span>Flytta kameran 90° och 45°. Behåll pose, hår, dräkt och ljus.</span></li>
            <li><b>Handen med ett kort</b><span>Visa tumme och pekfinger från två håll vid samma grepp.</span></li></ol>
          {data && <small className="inbox-path"><FolderOpen size={14}/> {data.inbox}</small>}
        </section>
      </aside>
    </div>
  </section>;
}
