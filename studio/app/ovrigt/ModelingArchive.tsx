"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Box, Cpu, FolderOpen, Image as ImageIcon, Layers3, RefreshCw } from "lucide-react";
import { displayName, mediaUrl } from "../../lib/model";
import { resultUrl, type SamPose, type PoseVersion } from "../../lib/modeling";
import { useModelingInventory } from "../useModelingInventory";
import styles from "../modeling.module.css";

const PoseReview = dynamic(() => import("../PoseReview"), { ssr: false });
const seatedRun = "sam-20261120T015406Z-f427a95156b7";
const uprightRun = "sam-20261119T231348Z-842dd17bd33b";
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
const seatedSources: Record<string, { name: string; file: string }> = {
  "paulina-fas1-v1-sittande-front.png": { name: "Sittande framifrån", file: "sittande/front.png" },
  "paulina-fas1-v1-sittande-trekvart.png": { name: "Sittande i trekvart", file: "sittande/trekvart.png" },
  "paulina-fas1-v1-sittande-profil.png": { name: "Sittande i profil", file: "sittande/profil.png" },
};
const label = (name: string) => seatedSources[name]?.name
  ?? (knownViews[name] ? name.split("_")[0] + " · " + knownViews[name] : displayName(name));
const sourceForCutout: Record<string, string> = {
  "02_staende_frilagd.png": "01_staende_bakgrund.png",
  "04_sittande_frilagd.png": "03_sittande_bakgrund.png",
};
type View = "photo" | "mesh" | "sheet";
const poseKey = (pose: SamPose) => pose.run + "/" + pose.index;

function resolveVersion(pose: SamPose, version: string | null): PoseVersion {
  if (version === "rak" && pose.hasUpright) return "rak";
  if (version === "bordsvila" && pose.hasTablePose) return "bordsvila";
  if ((version === null || version === "utseende") && pose.hasAppearance) return "utseende";
  return "front";
}

export default function ModelingArchive() {
  const { inventory: data, loading, error, refresh } = useModelingInventory();
  const [imageName, setImageName] = useState("");
  const [poseId, setPoseId] = useState("");
  const [view, setView] = useState<View>("photo");
  const [initialVersion, setInitialVersion] = useState<PoseVersion>("front");
  const [linkNotice, setLinkNotice] = useState("");
  const openedLink = useRef(false);

  function applyPose(pose: SamPose, version: PoseVersion) {
    setPoseId(poseKey(pose));
    setImageName(pose.source);
    setInitialVersion(version);
    setView(pose.hasFront || pose.hasViewer ? "mesh" : pose.hasSheet ? "sheet" : "photo");
  }

  useEffect(() => {
    if (!data || openedLink.current) return;
    openedLink.current = true;
    const query = new URLSearchParams(window.location.search);
    const requested = query.get("pose");
    const key = requested ?? seatedRun + "/1";
    const selected = data.poses.find(pose => poseKey(pose) === key);
    if (!selected) {
      if (requested) setLinkNotice("Det länkade kroppsprovet saknas på den här labbdisken.");
      return;
    }
    const desiredVersion = query.get("version");
    const version = resolveVersion(selected, desiredVersion);
    if (desiredVersion && desiredVersion !== version) {
      setLinkNotice("Den länkade versionen saknas. Ett tillgängligt underlag från samma kroppsprov visas.");
    }
    applyPose(selected, version);
  }, [data]);

  const images = data?.images ?? [];
  const poses = data?.poses ?? [];
  const seated = poses.filter(pose => pose.run === seatedRun);
  const upright = poses.find(pose => pose.run === uprightRun && pose.index === 1 && pose.hasUpright);
  const photo = imageName || (images.includes("03_sittande_bakgrund.png") ? "03_sittande_bakgrund.png" : images[0]);
  const photoUrl = images.includes(photo) ? mediaUrl(photo)
    : seatedSources[photo] ? "/fotomall.html/fas-1/v1/" + seatedSources[photo].file : "";
  const pose = poses.find(item => poseKey(item) === poseId) ?? poses.find(item => item.source === (sourceForCutout[photo] ?? photo));
  const showingPhoto = view === "photo" || !pose;

  function selectPhoto(name: string) {
    setImageName(name);
    setPoseId("");
    setInitialVersion(poses.some(item => item.source === (sourceForCutout[name] ?? name) && item.hasAppearance) ? "utseende" : "front");
    setView("photo");
    setLinkNotice("");
    window.history.replaceState(window.history.state, "", "/ovrigt");
  }

  function selectPose(selected: SamPose, version: PoseVersion) {
    applyPose(selected, version);
    setLinkNotice("");
    const query = new URLSearchParams({ pose: poseKey(selected), version });
    window.history.replaceState(window.history.state, "", "/ovrigt?" + query);
  }

  return <>
    {error && <p role="alert" className="alert">{error}</p>}
    {linkNotice && <p role="status" className="alert">{linkNotice}</p>}
    <div className={styles.archiveJumps}>
      <section>
        <h2>SAM · sittande skattningar</h2>
        <p>Sittfronten i Fas 1 v1 gav den råa kroppen. Trekvart och profil skattades var för sig.</p>
        <div className={styles.archiveLinks}>
          {seated.map(item => <button key={item.index} aria-pressed={poseId === poseKey(item) && view === "mesh" && initialVersion === "front"}
            onClick={() => selectPose(item, "front")}>{["Sittfront", "Trekvart", "Profil"][item.index - 1] ?? label(item.source)}</button>)}
          {seated[0]?.hasComparison && <a href={resultUrl(seated[0], "comparison")} target="_blank" rel="noreferrer">Tre vyer mot sittfronten <ArrowUpRight size={14}/></a>}
          {!loading && !error && !seated.length && <small>Skattningarna saknas på den här datorn.</small>}
        </div>
      </section>
      <section>
        <h2>08-rak-v1 · rigg för kortutdraget</h2>
        <p>08-riggen driver Paulinas vänsterhand i bordsprovet. Stol 4 och stol 1 följer samma kort i tagningen skoriktning-70-30-v1.</p>
        <div className={styles.archiveLinks}>
          {upright && <button aria-pressed={poseId === poseKey(upright) && view === "mesh" && initialVersion === "rak"}
            onClick={() => selectPose(upright, "rak")}>Vrid 08-riggen</button>}
          <a href="/bordsprov/paulina-rak">Jämför upprätningen <ArrowUpRight size={14}/></a>
          <a href="/bordsprov/paulina-utdrag.html?avatar=paulina">Se kortutdraget <ArrowUpRight size={14}/></a>
        </div>
      </section>
    </div>

    <section className="modeling-grid" aria-label="Lokalt modelleringsunderlag">
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
            {showingPhoto ? photoUrl
              ? <img src={photoUrl} alt={label(photo)} />
              : <p>{loading ? "Läser labbets inkorg…" : photo ? "Källfotot saknas i labbets inkorg." : "Lägg en bild i labbets inkorg och uppdatera vyn."}</p>
              : view === "mesh" && pose.hasFront ? <PoseReview key={[poseKey(pose), pose.hasTablePose, pose.hasAppearance, pose.hasUpright, initialVersion].join("/")} pose={pose} initialVersion={initialVersion}/>
              : view === "mesh" ? <iframe key={resultUrl(pose, "mesh")} title={"Vridbar SAM-modell av " + label(pose.source)} sandbox="allow-scripts" src={resultUrl(pose, "mesh")} />
              : <img src={resultUrl(pose, "sheet")} alt={"Original, SAM-överlägg och vriden modell från " + label(pose.source)} />}
          </div>
          <figcaption><strong>{showingPhoto ? photo && label(photo) : label(pose.source)}</strong>
            <span>{showingPhoto ? photo : view === "mesh" ? "Dra för att vrida · scrolla för att zooma" : "Original · överlägg · 45°"}</span></figcaption>
        </figure>
        <div className="contact-heading"><h3>Bildinkorg</h3><span>{images.length} bilder</span>
          <button onClick={refresh} disabled={loading} aria-label="Uppdatera modelleringsunderlag"><RefreshCw size={15}/></button>
        </div>
        <div className="contact-strip">{images.map(name =>
          <button key={name} aria-pressed={photo === name && showingPhoto} onClick={() => selectPhoto(name)}>
            <img loading="lazy" src={mediaUrl(name)} alt="" /><span>{label(name)}</span>
          </button>)}</div>
      </section>

      <aside className="model-inspector">
        <section className="model-inspect-section">
          <h2>Sparade kroppsprov</h2>
          {poses.length ? <>
            <label htmlFor="sam-pose">Källbild och körning</label>
            <select id="sam-pose" value={pose ? poseKey(pose) : ""} onChange={e => {
              const selected = poses.find(item => poseKey(item) === e.target.value);
              if (selected) selectPose(selected, resolveVersion(selected, null));
            }}><option value="" disabled>Välj ett kroppsprov</option>{poses.map(item =>
              <option key={poseKey(item)} value={poseKey(item)}>{label(item.source)} · {item.run.slice(10, 12)}/{item.run.slice(8, 10)} {item.run.slice(13, 15)}.{item.run.slice(15, 17)} UTC</option>
            )}</select>
            {pose && <small>{pose.run} · index {pose.index}</small>}
            {pose?.hasComparison && <p><a href={resultUrl(pose, "comparison")} target="_blank" rel="noreferrer">Jämför proportioner och vinklar</a></p>}
            {pose?.hasAppearance && <p><a href="/bordsprov/paulina-utdrag.html?avatar=paulina">Se kortutdraget från båda stolarna</a></p>}
            {pose?.hasUpright && <p><a href="/bordsprov/paulina-rak">Jämför 08 före och efter upprätning</a></p>}
          </> : <p>{loading ? "Läser sparade prov…" : "Inga bevarade SAM-prov hittades."}</p>}
        </section>
        <section className="sam-card">
          <div className="machine-symbol"><Cpu size={21}/></div>
          <h2>SAM 3D Body</h2>
          <dl><dt>Grafikkort</dt><dd>{data ? data.gpu ?? "Kunde inte avläsas" : "Läser…"}</dd>
            <dt>Modellvikter på disk</dt><dd>{data ? data.checkpoints.join(" / ") || "Inga hittades" : "Läser…"}</dd></dl>
          <a href="https://github.com/facebookresearch/sam-3d-body" target="_blank" rel="noreferrer">Metas modellguide <ArrowUpRight size={14}/></a>
        </section>
        {data && <section className="model-inspect-section"><h2>Labbets bildinkorg</h2><small className="inbox-path"><FolderOpen size={14}/> {data.inbox}</small></section>}
        <details className={styles.historical}>
          <summary>Fotomall, rum och ljusprov</summary>
          <div className={styles.archiveLinks}>
            <a href="/ovrigt/fotomall">Äldre fotomall med docka <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/rumsprov.html?dealer=0">Tomt bordsprov <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/rumsprov.html">Tidigare rums- och skoprov <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/ljusprov.html">Bakgrund och studioljus <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/rum3d/atlas-jamforelse.html">Atlas · jämför rummen <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/rum3d/lampor.html">Belysning från två stolar <ArrowUpRight size={14}/></a>
            <a href="/bordsprov/rum3d?rum=atlas-full&stol=4&glas=1&blink=1">LJUS-02 · blinkande lampa <ArrowUpRight size={14}/></a>
          </div>
        </details>
      </aside>
    </section>
  </>;
}
