"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Box, Cpu, FolderOpen, Image as ImageIcon, Layers3, RefreshCw } from "lucide-react";
import { displayName, mediaUrl } from "../lib/model";
import { resultUrl, type ModelingInventory, type PoseVersion } from "../lib/modeling";

const PoseReview = dynamic(() => import("./PoseReview"), { ssr: false });
const knownViews: Record<string, string> = {
  "01_staende_bakgrund.png": "Stående · original",
  "02_staende_frilagd.png": "Stående · frilagd",
  "03_sittande_bakgrund.png": "Sittande · original",
  "04_sittande_frilagd.png": "Sittande · frilagd",
  "05_sittande_sidoprofil_genererad.png": "Sittande · profil",
  "05b_sittande_sidoprofil_ansiktsreferens03_genererad.png": "Sittande · reviderad profil",
  "06_staende_trekvart_genererad.png": "Stående · trekvart",
  "07_staende_vansterprofil_genererad.png": "Stående · vänsterprofil",
  "08_sittande_trekvart_bordskontakt_genererad.png": "Sittande · trekvart",
  "09_vansterhand_kortdrag_genererad.png": "Vänster hand · kortdrag",
};
const label = (name: string) => knownViews[name] ? name.split("_")[0] + " · " + knownViews[name] : displayName(name);
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
  const [initialVersion, setInitialVersion] = useState<PoseVersion>("front");
  const openedLink = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/modeling", { signal: controller.signal, cache: "no-store" });
        const inventory = await response.json();
        if (!response.ok) throw Error(inventory.error || "Modelleringsunderlaget kunde inte läsas.");
        if (!controller.signal.aborted) {
          setData(inventory);
          if (!openedLink.current) {
            openedLink.current = true;
            const query = new URLSearchParams(location.search);
            const selected = (inventory as ModelingInventory).poses.find(p => p.run + "/" + p.index === query.get("pose"));
            if (selected && (selected.hasFront || selected.hasViewer)) {
              setPoseId(selected.run + "/" + selected.index);
              setImageName(selected.source);
              const version = query.get("version");
              setInitialVersion(version === "rak" && selected.hasUpright ? "rak"
                : version === "bordsvila" && selected.hasTablePose ? "bordsvila"
                : selected.hasAppearance && (version === "utseende" || !version) ? "utseende" : "front");
              setView("mesh");
            }
          }
        }
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
  const paulinaReady = poses.some(p => p.hasAppearance && p.source === "08_sittande_trekvart_bordskontakt_genererad.png");
  const photo = [imageName, "03_sittande_bakgrund.png"].find(name => images.includes(name)) ?? images[0];
  const sourceForPhoto = sourceForCutout[photo] ?? photo;
  const pose = poses.find(p => p.run + "/" + p.index === poseId) ?? poses.find(p => p.source === sourceForPhoto);
  const showingPhoto = view === "photo" || !pose;
  function selectPhoto(name: string) {
    setImageName(name);
    setPoseId("");
    setInitialVersion(poses.some(p => p.source === (sourceForCutout[name] ?? name) && p.hasAppearance) ? "utseende" : "front");
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
            <button aria-pressed={!showingPhoto && view === "mesh"} disabled={!pose?.hasViewer && !pose?.hasFront} onClick={() => setView("mesh")}><Box size={14}/> 3D</button>
          </div>
        </header>
        <figure className="reference-figure">
          <div className={"reference-surface " + (showingPhoto && photo?.includes("frilagd") ? "transparent-surface" : "")}>
            {showingPhoto ? photo
              ? <img src={mediaUrl(photo)} alt={label(photo)} />
              : <p>{loading ? "Läser labbets inkorg…" : "Lägg en bild i labbets inkorg och uppdatera vyn."}</p>
              : view === "mesh" && pose.hasFront ? <PoseReview key={[pose.run, pose.index, pose.hasTablePose, pose.hasAppearance, pose.hasUpright, initialVersion].join("/")} pose={pose} initialVersion={initialVersion}/>
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
              setInitialVersion(selected.hasAppearance ? "utseende" : "front");
              if (images.includes(selected.source)) setImageName(selected.source);
              setView(selected.hasFront || selected.hasViewer ? "mesh" : selected.hasSheet ? "sheet" : "photo");
            }}><option value="" disabled>Välj ett kroppsprov</option>{poses.map(p => <option key={p.run + "/" + p.index} value={p.run + "/" + p.index}>{label(p.source)} · {p.run.slice(10, 12)}/{p.run.slice(8, 10)} {p.run.slice(13, 15)}.{p.run.slice(15, 17)} UTC</option>)}</select>
            {pose && <small>{pose.run}</small>}
            {pose?.hasAppearance && <p><a href="/bordsprov/paulina-utdrag.html?avatar=paulina">Se kortutdraget från båda stolarna</a></p>}
            {pose?.hasUpright && <p><a href="/bordsprov/paulina-rak">Jämför 08 före och efter upprätning</a></p>}
            {pose?.hasComparison && <p><a href={resultUrl(pose, "comparison")} target="_blank" rel="noreferrer">Jämför proportioner och vinklar</a></p>}
          </> : <p>{loading ? "Läser sparade prov…" : "Inga bevarade SAM-prov hittades."}</p>}
        </section>
        {paulinaReady && <section className="model-inspect-section">
          <h2>Bilderna i Paulinas modell</h2>
          <ol><li><b>01 och 03 · utseende</b><span>01 visar kostym, byxor och skor. 03 ger ansikte, hårfärg, hals och båda handryggarna.</span></li>
            <li><b>08 · sittande kropp</b><span>Den upprätade sittposen och de rörliga lederna kommer från 08.</span></li>
            <li><b>Övriga referenser</b><span>02 och 04 är frilagda. 05, 05b, 06 och 07 jämför proportioner. 09 visar ett föreslaget kortgrepp.</span></li></ol>
        </section>}
        <section className="model-inspect-section">
          <h2>Grundbilder för en dealer</h2>
          <p><a href="/fotomall.html">Öppna fotomallen med dockans vinklar och Paulinas nästa bilder</a></p>
          <ol><li><b>Stående helkropp framifrån</b><span>Ta med huvud, skor och båda händerna i samma ljus.</span></li>
            <li><b>Sittande framifrån och i ren profil</b><span>Behåll samma stol och avslappnade, upprätta pose. Håll kameran i våg. Låt höft, knän och fötter synas fritt från sidan.</span></li>
            <li><b>Båda handryggarna nära</b><span>Lägg ett spelkort intill och visa alla fingertoppar och tatueringar. Ett kort klipp av det riktiga utdraget ger rörelsereferensen.</span></li></ol>
        </section>
        <section className="model-inspect-section">
          <h2>{paulinaReady ? "Nästa rörelse" : "Från grundbild till dealerfilm"}</h2>
          {paulinaReady ? <><p>Efter utdraget ska Paulina föra kortet till plats 4, släppa det och dra tillbaka handen.</p>
            <p>Riggen går att animera redan nu. Ett riktigt sittande foto från stol 1 skulle hjälpa oss att förfina profilen och håret i nacken.</p></>
            : <ol><li><b>Kropp och sittpose</b><span>SAM skattar en kropp per bild. Kontrollera hållningen mot lodlinjen och passa in händerna vid filten.</span></li>
            <li><b>Fingrar och kort</b><span>Posera upptag, utdrag och släpp. Granska samma rörelse från stol 4 och stol 1.</span></li>
            <li><b>Paulinas utseende</b><span>Använd ansikts-, hår-, dräkt- och tatueringsreferenser på den godkända kroppen och rendera båda kamerorna.</span></li></ol>}
          {data && <small className="inbox-path"><FolderOpen size={14}/> {data.inbox}</small>}
        </section>
      </aside>
    </div>
  </section>;
}
