import { headers } from "next/headers";
import { dealerMaterial, readDealingStudies, type DealingStudy } from "../../../lib/dealer-material";
import { dealReferences, referencesForTake } from "../../../lib/deal-references";
import type { DealerMaterial } from "../../../lib/material-types";
import { LocalError, requireLocal } from "../../../lib/storage";
import { FilmEvidence } from "../../MaterialEvidence";
import { MotionComponents, takeLabel, takeLink } from "../../MotionTake";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rörelseprov · 3D-modellering" };

type Film = DealerMaterial["films"][number];

function matchesStudy(film: Film, study: DealingStudy) {
  return study.geometry === film.geometry && study.appearance === film.appearance &&
    study.takes.some(t => t.take === film.take && t.movie === film.sha256 && t.motion === film.motion);
}

function viewGuide(material: DealerMaterial, film: Film, audit?: DealingStudy) {
  if (!audit || material.dealer !== "paulina" ||
      film.cameras.length !== 2 || material.geometry?.sha256 !== film.geometry) return;
  const layout = audit.frameLayout ?? (film.take === "samspel-v2-v1" ? "two-seats-with-details" : undefined);
  if (layout !== "two-seats-with-details") return;
  const [left, right] = film.cameras;
  const details = film.card && film.marks.some(mark => /ögonlock/i.test(mark.label)) ? ", först av kortet och sedan av ögonlocken" : "";
  return `Alla fyra bilderna visar samma Paulina och samma rigg med ${material.geometry.joints} leder. Överst visas ${left.id} till vänster och ${right.id} till höger. Nederst ser du detaljutsnitt från samma kameror i samma bildruta${details}.`;
}

function elbowHeight(mm: number) {
  if (mm === 0) return "i höjd med axelleden";
  const cm = (Math.abs(mm) / 10).toLocaleString("sv-SE", { maximumFractionDigits: 1 });
  return `${cm} cm ${mm > 0 ? "över" : "under"} axelleden`;
}

function Trial({ id, title, description, films, material, audits, comparedMovie, selectedMovie, compareHowcastVip }: {
  id: string; title: string; description: string; films: Film[]; material: DealerMaterial;
  audits: Map<string, DealingStudy>; comparedMovie?: string; selectedMovie?: string; compareHowcastVip: boolean;
}) {
  const openMovie = selectedMovie ?? films.find(film => film.sha256 === comparedMovie)?.sha256 ?? films[0]?.sha256;
  return <section id={id} className={id === "samspel" ? styles.combinedProof + " " + styles.proof : styles.proof}>
    <h2>{title}</h2><p>{description}</p>
    {films.length > 1 && <nav className={styles.archiveJumps} aria-label={"Välj tagning för " + title}>
      {films.map(film => <a key={film.url} href={takeLink(material, film.take)}
        aria-current={film.sha256 === (selectedMovie ?? comparedMovie) ? "page" : undefined}>{takeLabel(film.take, film.title)}</a>)}
    </nav>}
    {films.length === 0 && <p role="status">Det finns ännu ingen registrerad tagning för den här modellutgåvan.</p>}
    {films.map(film => {
      const motion = material.motions.find(m => m.sha256 === film.motion);
      const audit = audits.get(film.sha256);
      const clips = referencesForTake(audit?.timing.referenceSha256);
      const secondsAt = (frame?: number) => film.marks.find(m => m.frame === frame)?.seconds;
      const handover = secondsAt(audit?.handover.frame);
      const release = film.marks.find(m => /lämnar kortet|släpp/i.test(m.label))?.seconds;
      const comparison = audit && clips.length > 0 && film.sha256 === comparedMovie && handover !== undefined && release !== undefined ? {
        clips: compareHowcastVip ? dealReferences : clips, times: { draw: secondsAt(audit.draw.frames[0]) ?? 0, push: secondsAt(audit.draw.pressFrame),
          handover, turn: secondsAt(audit.turn?.frame), release },
      } : undefined;
      const selected = film.sha256 === selectedMovie;
      const v1 = film.take === "samspel-v2-v1" || film.take === "tvahandsgiv-v2-v1";
      const note = audit?.handover.note ?? (v1 ? "Den höga armbågen och den tvära handleden behöver korrigeras." : undefined);
      return <FilmEvidence key={film.url} film={film} anchorId={selected ? "vald-tagning" : undefined}
        expanded={film.sha256 === openMovie} comparison={comparison} viewGuide={viewGuide(material, film, audit)} context={audit &&
        <><p><b>Rörelsen är animerad i kod.</b> {audit.timing.source} gav händelsernas ordning och tidpunkter.
          {clips.length > 1 && audit.comparison && " " + audit.comparison.source + " användes för jämförelse."}
          {" "}Kortets bana, ledvinklarna och fingrarnas lägen anpassades till vår sko och vårt kort.</p>
          {comparison && clips.length === 1 && <nav className={styles.archiveJumps} aria-label="Välj referensklipp för given">
            <a href={takeLink(material, film.take, "original")} aria-current={!compareHowcastVip ? "page" : undefined}>{clips[0].title}</a>
            <a href={takeLink(material, film.take, "howcast-vip")} aria-current={compareHowcastVip ? "page" : undefined}>Jämför med Howcast och VIP</a>
          </nav>}</>}>
        {audit && <details><summary>Källfilmer och uppmätt rörelse</summary>
          <p>Källrutorna {audit.timing.frames.join(audit.timing.frames.length === 2 ? "–" : ", ")} i {audit.timing.source} ger tiderna för utdrag, handbyte, vändning och släpp.
            {clips.length > 1 && audit.comparison && " " + audit.comparison.source + " visar ett lågt handbyte från en annan kamera."}
            {" "}Fingerdjup och fysisk lyfthöjd är okända i källmaterialet.
            {" "}<a href={audit.timing.url}>{clips[0]?.title ?? audit.timing.source}</a>
            {clips.length > 1 && audit.comparison && <> · <a href={audit.comparison.url}>{clips[1].title}</a></>}</p>
          {audit.handReference && <p><b>Fingerplacering.</b> Källrutorna {audit.handReference.frames.join(", ")} i Jakobs film{" "}
            <code title={"SHA-256 " + audit.handReference.sha256}>{audit.handReference.file.split(/[\\/]/).pop()}</code>{" "}
            används för att passa modellens fingrar mot kortet.</p>}
          <p>Ruta {audit.draw.frames.join("–")} i vår modell går kortets framkant {Math.round(audit.draw.frontEdgeOutMm[1] - audit.draw.frontEdgeOutMm[0])} mm ut ur mynningen.
            Framkanten är {audit.draw.frontEdgeHeightMm[0].toLocaleString("sv-SE")} mm över filten i början av utdraget och {audit.draw.frontEdgeHeightMm[1].toLocaleString("sv-SE")} mm i slutet.</p>
          <p>Vid handbytet i ruta {audit.handover.frame} är kortets mitt {audit.handover.cardCentreHeightMm} mm över filten.
            Vänster armbågsled ligger {elbowHeight(audit.handover.leftElbowAboveShoulderMm)}.{note && " " + note}</p>
        </details>}
        {audit?.decodedStill.movie === film.sha256 && <p><a href={film.url + "&ruta=" + audit.decodedStill.frame}>
          Öppna originalfilmens ruta {audit.decodedStill.frame} som PNG</a></p>}
        <MotionComponents material={material} motion={motion}/>
        {motion && <a href={motion.url} download={film.take + ".glb"}>Hämta tagningens animerade 3D-modell</a>}
      </FilmEvidence>;
    })}
  </section>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ dealer?: string; revision?: string; tagning?: string; referenser?: string }> }) {
  const { dealer = "paulina", revision, tagning, referenser } = await searchParams;
  let material: DealerMaterial | undefined, message = "";
  let studies: DealingStudy[] = [];
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    material = await dealerMaterial(dealer, revision || null);
    studies = await readDealingStudies(dealer);
  } catch (error) {
    if (!(error instanceof LocalError)) throw error;
    message = error.message;
  }
  const query = new URLSearchParams({ dealer });
  if (material?.revision) query.set("revision", material.revision);
  const films = [...(material?.films ?? [])].sort((a, b) => b.take.localeCompare(a.take, "sv", { numeric: true }));
  const audits = new Map<string, DealingStudy>();
  for (const film of films) {
    const audit = studies.find(study => matchesStudy(film, study));
    if (audit) audits.set(film.sha256, audit);
  }
  const selected = films.find(f => f.take === tagning);
  const audited = films.filter(f => audits.has(f.sha256));
  const comparedMovie = (selected ?? audited.find(f => f.take.startsWith("samspel-")) ?? audited.find(f => f.take.startsWith("tvahandsgiv-")))?.sha256;
  const trialProps = { audits, comparedMovie, selectedMovie: selected?.sha256, compareHowcastVip: referenser === "howcast-vip" };
  return <StudioSubpage area="rorelseprov"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href={"/?" + query + "#modellering"}>← Bildserie och 3D-modell</a></nav>
    <header className={styles.archiveHeader}><h1>Rörelseprov</h1>
      {material?.activeModel && <p>Gemensam kroppsmodell · {material.activeModel.name}{material.geometry && " · " + material.geometry.joints + " leder"}</p>}</header>
    {material && tagning && !selected && <p role="status">Tagningen {tagning} finns inte registrerad för den här modellutgåvan.</p>}
    {material ? <div className={styles.proofGrid}>
      {films.some(f => f.take.startsWith("samspel-")) && <Trial id="samspel" title="Ansikte och händer i samma giv" material={material} {...trialProps}
        description="Följ kortet från skon till filten och se blinkningen under återgången."
        films={films.filter(f => f.take.startsWith("samspel-"))}/>}
      <Trial id="hander" title="Händer och kort" material={material} {...trialProps}
        description="Följ vänsterhandens utdrag, handbytet, högerhandens vändning och släppet. Jämför samma bildruta från de två stolarna."
        films={films.filter(f => f.take.startsWith("tvahandsgiv-"))}/>
      <Trial id="ansikte" title="Ansikte och blinkning" material={material} {...trialProps}
        description="Jämför öppet öga, största slutning och återöppning. Kontrollera både ögonlockskanten och om iris syns i trekvart."
        films={films.filter(f => f.take.startsWith("ansiktsrigg-"))}/>
      {selected && !/^(samspel|tvahandsgiv|ansiktsrigg)-/.test(selected.take) &&
        <Trial id="annan-tagning" title="Valt filmprov" description={selected.title} material={material} films={[selected]} {...trialProps}/>}
    </div> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
