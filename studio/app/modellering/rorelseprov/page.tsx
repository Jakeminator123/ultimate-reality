import { headers } from "next/headers";
import { dealerMaterial, readDealingStudy, type DealingStudy } from "../../../lib/dealer-material";
import type { DealerMaterial } from "../../../lib/material-types";
import { LocalError, requireLocal } from "../../../lib/storage";
import { FilmEvidence } from "../../MaterialEvidence";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rörelseprov · 3D-modellering" };

function matchesStudy(film: DealerMaterial["films"][number], study: DealingStudy | null | undefined) {
  return study?.geometry === film.geometry && study.appearance === film.appearance &&
    study.takes.some(t => t.take === film.take && t.movie === film.sha256 && t.motion === film.motion);
}

function Trial({ id, title, description, films, material, study, comparedMovie }: {
  id: string; title: string; description: string; films: DealerMaterial["films"]; material: DealerMaterial; study?: DealingStudy | null; comparedMovie?: string;
}) {
  return <section id={id} className={id === "samspel" ? styles.combinedProof + " " + styles.proof : styles.proof}>
    <h2>{title}</h2><p>{description}</p>
    {films.length === 0 && <p role="status">Det finns ännu ingen registrerad tagning för den här modellutgåvan.</p>}
    {films.map((film, index) => {
      const motion = material.motions.find(m => m.sha256 === film.motion);
      const sources = motion?.motion.components?.map(hash => material.motions.find(m => m.sha256 === hash)?.motion.take ?? hash);
      const audit = matchesStudy(film, study) ? study : null;
      const handover = film.marks.find(m => m.frame === audit?.handover.frame)?.seconds;
      const release = film.marks.find(m => m.frame === 41)?.seconds;
      const comparison = film.sha256 === comparedMovie && handover !== undefined && release !== undefined ? { handover, release } : undefined;
      return <FilmEvidence key={film.url} film={film} expanded={index === 0 || !!comparison} comparison={comparison} context={audit &&
        <p><b>Rörelsen är animerad i kod.</b> Howcast gav händelsernas ordning och tidpunkter. VIP användes för jämförelse.
          Lyftbåge, ledvinklar och fingerkontakt passades mot vår sko och vårt kort.</p>}>
        {audit && <details><summary>Källfilmer och uppmätt rörelse</summary>
          <p>Rutorna {audit.timing.frames.join("–")} i Howcast ligger till grund för utdrag, handbyte, vändning och släpp.
            VIP visar ett lågt handbyte från en annan kamera. Fingerdjupet och den fysiska lyfthöjden är okända i källfilmerna.
            {" "}<a href={audit.timing.url}>Spader två i Howcast</a> · <a href={audit.comparison.url}>Klöver nio i VIP</a></p>
          <p>Ruta {audit.draw.frames.join("–")} i vår modell går kortets framkant {Math.round(audit.draw.frontEdgeOutMm[1] - audit.draw.frontEdgeOutMm[0])} mm ut ur mynningen.
            Höjden över filten sjunker från {audit.draw.frontEdgeHeightMm[0].toLocaleString("sv-SE")} till {audit.draw.frontEdgeHeightMm[1].toLocaleString("sv-SE")} mm.</p>
          <p>Vid handbytet i ruta {audit.handover.frame} är kortets mitt {audit.handover.cardCentreHeightMm} mm över filten.
            Vänster armbågsled hamnar {(audit.handover.leftElbowAboveShoulderMm / 10).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} cm över axelleden. Den höga armbågen och den tvära handleden behöver korrigeras.</p>
        </details>}
        {audit?.decodedStill.movie === film.sha256 && <p><a href={film.url + "&ruta=" + audit.decodedStill.frame}>
          Öppna originalfilmens ruta {audit.decodedStill.frame} som PNG</a></p>}
        {sources && sources.length > 0 && <p>Källtagningar · {sources.join(" + ")}</p>}
        {motion && <a href={motion.url} download={film.take + ".glb"}>Hämta tagningens animerade 3D-modell</a>}
      </FilmEvidence>;
    })}
  </section>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ dealer?: string; revision?: string }> }) {
  const { dealer = "paulina", revision } = await searchParams;
  let material: DealerMaterial | undefined, message = "";
  let study: DealingStudy | null = null;
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    material = await dealerMaterial(dealer, revision || null);
    study = await readDealingStudy(dealer);
  } catch (error) {
    if (!(error instanceof LocalError)) throw error;
    message = error.message;
  }
  const query = new URLSearchParams({ dealer });
  if (material?.revision) query.set("revision", material.revision);
  const films = [...(material?.films ?? [])].sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
  const audited = films.filter(f => matchesStudy(f, study));
  const comparedMovie = (audited.find(f => f.take.startsWith("samspel-")) ?? audited.find(f => f.take.startsWith("tvahandsgiv-")))?.sha256;
  return <StudioSubpage area="rorelseprov"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href={"/?" + query + "#modellering"}>← Bildserie och 3D-modell</a></nav>
    <header className={styles.archiveHeader}><h1>Rörelseprov</h1>
      {material?.activeModel && <p>{material.activeModel.name} · {material.geometry?.joints} leder</p>}</header>
    {material ? <div className={styles.proofGrid}>
      {films.some(f => f.take.startsWith("samspel-")) && <Trial id="samspel" title="Ansikte och händer i samma giv" material={material} study={study} comparedMovie={comparedMovie}
        description="Se ansikte, händer och kort tillsammans. De två stolarna visar samma giv. Bildrutorna följer kortet från skon till filten och ögonlocken under återgången."
        films={films.filter(f => f.take.startsWith("samspel-"))}/>}
      <Trial id="hander" title="Händer och kort" material={material} study={study} comparedMovie={comparedMovie}
        description="Följ vänsterhandens utdrag, handbytet, högerhandens vändning och släppet. Jämför samma bildruta från de två stolarna."
        films={films.filter(f => f.take.startsWith("tvahandsgiv-"))}/>
      <Trial id="ansikte" title="Ansikte och blinkning" material={material}
        description="Jämför öppet öga, största slutning och återöppning. Kontrollera både ögonlockskanten och om iris syns i trekvart."
        films={films.filter(f => f.take.startsWith("ansiktsrigg-"))}/>
    </div> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
