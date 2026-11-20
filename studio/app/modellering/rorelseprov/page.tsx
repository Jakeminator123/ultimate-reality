import { headers } from "next/headers";
import { dealerMaterial } from "../../../lib/dealer-material";
import type { DealerMaterial } from "../../../lib/material-types";
import { LocalError, requireLocal } from "../../../lib/storage";
import { FilmEvidence } from "../../MaterialEvidence";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rörelseprov · 3D-modellering" };

function Trial({ id, title, description, films, material }: {
  id: string; title: string; description: string; films: DealerMaterial["films"]; material: DealerMaterial;
}) {
  return <section id={id} className={id === "samspel" ? styles.combinedProof + " " + styles.proof : styles.proof}>
    <h2>{title}</h2><p>{description}</p>
    {films.length === 0 && <p role="status">Det finns ännu ingen registrerad tagning för den här modellutgåvan.</p>}
    {films.map((film, index) => {
      const motion = material.motions.find(m => m.sha256 === film.motion);
      const sources = motion?.motion.components?.map(hash => material.motions.find(m => m.sha256 === hash)?.motion.take ?? hash);
      return <FilmEvidence key={film.url} film={film} expanded={index === 0}>
        {sources && sources.length > 0 && <p>Källtagningar · {sources.join(" + ")}</p>}
        {motion && <a href={motion.url} download={film.take + ".glb"}>Hämta tagningens animerade 3D-modell</a>}
      </FilmEvidence>;
    })}
  </section>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ dealer?: string; revision?: string }> }) {
  const { dealer = "paulina", revision } = await searchParams;
  let material: DealerMaterial | undefined, message = "";
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    material = await dealerMaterial(dealer, revision || null);
  } catch (error) {
    if (!(error instanceof LocalError)) throw error;
    message = error.message;
  }
  const query = new URLSearchParams({ dealer });
  if (material?.revision) query.set("revision", material.revision);
  const films = [...(material?.films ?? [])].sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
  return <StudioSubpage area="rorelseprov"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href={"/?" + query + "#modellering"}>← Bildserie och 3D-modell</a></nav>
    <header className={styles.archiveHeader}><h1>Rörelseprov</h1>
      {material?.activeModel && <p>{material.activeModel.name} · {material.geometry?.joints} leder</p>}</header>
    {material ? <div className={styles.proofGrid}>
      {films.some(f => f.take.startsWith("samspel-")) && <Trial id="samspel" title="Ansikte och händer i samma giv" material={material}
        description="Se ansikte, händer och kort tillsammans. De två stolarna visar samma giv. Bildrutorna följer kortet från skon till filten och ögonlocken under återgången."
        films={films.filter(f => f.take.startsWith("samspel-"))}/>}
      <Trial id="hander" title="Händer och kort" material={material}
        description="Följ vänsterhandens utdrag, handbytet, högerhandens vändning och släppet. Jämför samma bildruta från de två stolarna."
        films={films.filter(f => f.take.startsWith("tvahandsgiv-"))}/>
      <Trial id="ansikte" title="Ansikte och blinkning" material={material}
        description="Jämför öppet öga, största slutning och återöppning. Kontrollera både ögonlockskanten och om iris syns i trekvart."
        films={films.filter(f => f.take.startsWith("ansiktsrigg-"))}/>
    </div> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
