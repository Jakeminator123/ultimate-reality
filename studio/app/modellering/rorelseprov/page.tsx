import { headers } from "next/headers";
import { currentSeatedTrial, dealerMaterial, readDealingStudies, reviewedTakeForLink, type DealingStudy } from "../../../lib/dealer-material";
import { bodyLabel, dealLabel } from "../../../lib/deal-versions";
import { reviewedDealChoices } from "../../../lib/reviewed-deal-versions";
import { listBlackjackSequences } from "../../../lib/blackjack-sequence-store";
import { dealReferences, placedCardReference, referencesForTake } from "../../../lib/deal-references";
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
  const description = `Alla fyra bilderna visar samma Paulina och samma rigg med ${material.geometry.joints} leder. Överst visas ${left.id} till vänster och ${right.id} till höger. Nederst ser du detaljutsnitt från samma kameror i samma bildruta${details}.`;
  return audit.frameLayoutNote ? description + " " + audit.frameLayoutNote : description;
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
          handover, turn: secondsAt(audit.turn?.frame), release, rest: secondsAt(audit.rest?.frame) },
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

export default async function Page({ searchParams }: { searchParams: Promise<{ dealer?: string; revision?: string; tagning?: string; referenser?: string; kvitto?: string }> }) {
  const { dealer = "paulina", revision, tagning, referenser, kvitto } = await searchParams;
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
  const selected = films.find(f => f.take === tagning && (kvitto === undefined || new URL(f.url, "http://localhost").searchParams.get("film") === kvitto));
  const body = material && await currentSeatedTrial(material);
  const reviewed = body?.reviewedTakes ?? [];
  const choices = reviewedDealChoices(dealer, reviewed, body?.receipt);
  const isExact = tagning !== undefined || kvitto !== undefined;
  const matched = reviewed.filter(row => row.film.take === tagning && (kvitto === undefined || row.receipt === kvitto));
  const pinned = matched.length === 1 ? matched[0] :
    tagning && !selected && body ? await reviewedTakeForLink(dealer, body.id, tagning, kvitto) : undefined;
  const shown = isExact ? pinned : reviewed.find(row => row.receipt === choices.defaultAction?.receipt);
  const shownFilm = shown?.film;
  const mark = (re: RegExp) => shownFilm?.marks.find(m => re.test(m.label))?.seconds;
  const handover = mark(/tar emot kortkanten|handbyte/i);
  const release = mark(/lämnar kortet|släpp/i);
  const modelLabel = shownFilm && body ? dealLabel(body.name, shownFilm.take, shownFilm.poses?.end) : "";
  const current = choices.current.some(a => a.receipt === shown?.receipt);
  const audited = films.filter(f => audits.has(f.sha256));
  const earlyStudy = audited.findLast(f => f.take.startsWith("samspel-") && referencesForTake(audits.get(f.sha256)?.timing.referenceSha256) === dealReferences);
  const placedStudy = audited.find(f => f.take === "samspel-v2-v4" && audits.get(f.sha256)?.timing.referenceSha256 === placedCardReference.sha256);
  const savedSequences = material && !isExact ? await listBlackjackSequences(dealer) : [];
  const comparedMovie = shown || (isExact && !selected) ? undefined :
    (selected ?? audited.find(f => f.take.startsWith("samspel-")) ?? audited.find(f => f.take.startsWith("tvahandsgiv-")))?.sha256;
  const trialProps = { audits, comparedMovie, selectedMovie: selected?.sha256, compareHowcastVip: referenser === "howcast-vip" || (!tagning && referenser !== "original") };
  return <StudioSubpage area="rorelseprov"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href={"/?" + query + "#modellering"}>← Bildserie och 3D-modell</a></nav>
    <header className={styles.archiveHeader}><h1>Rörelseprov</h1>
      {material?.activeModel && <p>Bildutgåvans grundmodell · {bodyLabel(material.activeModel.name)}{material.geometry && " · " + material.geometry.joints + " leder"}</p>}</header>
    {material && isExact && !selected && !shown && <p role="status">Tagningen {tagning} finns inte registrerad med det här versionsvalet.</p>}
    {material ? <div className={styles.proofGrid}>
      {!isExact && <section className={styles.combinedProof + " " + styles.proof}>
        <h2>Rörelsemönster från referensfilm</h2>
        <p>Följ en tvåhandsgiv i fyra steg. Vänstern skjuter ut kortet, högern tar emot kanten, vänder upp kortet och släpper på filten.</p>
        <ol>
          <li><b>Howcast och VIP.</b> Howcasts spader två gav ordningen och tiderna till de första v2-proven. VIP:s klöver nio visar samma handbyte från snett framifrån och en landning på knekten.
            {earlyStudy && <> <a href={takeLink(material, earlyStudy.take, "howcast-vip")}>Jämför det första givprovet med båda klippen</a>.</>}</li>
          {dealer === "paulina" && placedStudy && <li><b>Jakobs giv till plats 4.</b> Handtiderna i <code>pos4-v.mp4</code> styrde prov 4 på Paulinas sittmodell 2. Högern tar emot på ruta 9 och lämnar kortet på ruta 25.
            {" "}<a href={takeLink(material, placedStudy.take, "original")}>Jämför modellrörelsen med Jakobs film</a>.</li>}
          {dealer === "paulina" && reviewed.some(row => row.film.take === "giv-sam-v4-v7") && <li><b>Paulinas sittmodell 4.</b> Rörelsen från prov 4 överfördes till den nya kroppen. I givprov 7 återgår hon till REDO med en mjukare handledsrörelse. Kortet ligger kvar på plats 4.</li>}
        </ol>
        {shown && <a href="#jamfor-giv">Se rörelsemönstret i {modelLabel}</a>}
        {savedSequences.length > 0 && <details><summary>Sparade givsekvenser i 3D</summary>
          <ul>{savedSequences.map(row => <li key={row.id}><a href={"/modellering/sekvens?" + new URLSearchParams({ dealer, id: row.id })}>
            {row.name} · {row.stepCount} givningar</a></li>)}</ul>
        </details>}
      </section>}
      {body && (shown || choices.current.length > 0) && <section className={styles.combinedProof + " " + styles.proof}>
        <h2>{bodyLabel(body.name)} · giv från stol 4 och stol 1</h2>
        <nav className={styles.archiveJumps} aria-label="Aktuella givprov">
          {choices.current.map(a => <a key={a.receipt} aria-current={a.receipt === shown?.receipt ? "page" : undefined}
            href={"?" + new URLSearchParams({ dealer, ...(material.revision && { revision: material.revision }), tagning: a.take, kvitto: a.receipt }) + "#jamfor-giv"}>
            {dealLabel(body.name, a.take, a.endPose)}</a>)}
        </nav>
        {shownFilm && <FilmEvidence key={shown?.receipt} film={shownFilm} expanded displayName={modelLabel}
          context={<p>{current ? "Aktuell tagning" : "Tidigare tagning"}</p>}
          comparison={handover !== undefined && release !== undefined ? { clips: dealReferences, modelLabel,
            times: { draw: 0, handover, release } } : undefined}
          viewGuide={dealer === "paulina" && shownFilm.cameras[0]?.id === "Stol 4" && shownFilm.cameras[1]?.id === "Stol 1"
            ? "Stol 4 visas till vänster och stol 1 till höger. Detaljutsnitten under helbilderna följer samma bildruta." : undefined}/>}
      </section>}
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
