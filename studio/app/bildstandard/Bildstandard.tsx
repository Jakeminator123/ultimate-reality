"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Copy, Download } from "lucide-react";
import { basvyer, bildrecept, skapaBildprompt, valbaraRoller, type Bildreferens } from "../../fotomall/bildrecept";
import { skapaBildserie } from "../../fotomall/bildserie";
import { kortMedVitRam, referenskort } from "../../fotomall/kortstandard";
import type { PaulinaExempel } from "./exempeltyp";
import styles from "./bildstandard.module.css";

const grupper = Array.from(new Set(bildrecept.map((recept) => recept.grupp)));
const talformat = new Intl.NumberFormat("sv-SE");

function Fakta({ rader }: { rader: [string, ReactNode][] }) {
  return (
    <dl className={styles.fakta}>
      {rader.map(([namn, varde]) => (
        <div key={namn}>
          <dt>{namn}</dt>
          <dd>{varde}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Bildstandard({ exempel }: { exempel: PaulinaExempel[] }) {
  const [vy, setVy] = useState<string>(bildrecept[0].id);
  const [referenser, setReferenser] = useState<Bildreferens[]>([]);
  const [kopieringsstatus, setKopieringsstatus] = useState("");
  const promptfalt = useRef<HTMLTextAreaElement>(null);
  const filval = useRef<HTMLInputElement>(null);
  const recept = bildrecept.find((bild) => bild.id === vy) ?? bildrecept[0];
  const paulina = exempel.find((bild) => bild.id === recept.id);
  const prompt = skapaBildprompt(recept, referenser);
  const kortvandning = recept.id === "rorelsereferens/kortvandning-hoger";

  function laggTill(filer: FileList | null) {
    if (!filer) return;
    const filnamn = Array.from(filer, (fil) => fil.name);
    setReferenser((tidigare) => {
      const kanda = new Set(tidigare.map((ref) => ref.namn));
      const nya = Array.from(new Set(filnamn)).filter((namn) => !kanda.has(namn));
      const saknarHuvudfoto = !tidigare.some((ref) => ref.roll === "Identitet");
      return [...tidigare, ...nya.map((namn, index) => ({
        namn, roll: saknarHuvudfoto && index === 0 ? "Identitet" : "Kompletterande original",
      }))];
    });
    setKopieringsstatus("");
  }

  async function kopiera() {
    try {
      await navigator.clipboard.writeText(prompt);
      setKopieringsstatus("Prompten har kopierats.");
    } catch {
      promptfalt.current?.focus();
      promptfalt.current?.select();
      setKopieringsstatus("Prompten är markerad. Kopiera texten med din webbläsare.");
    }
  }

  function hamtaSerie(medExempel: boolean) {
    const serie = medExempel ? skapaBildserie([], "Paulina", exempel, kortMedVitRam) : skapaBildserie(referenser);
    const fil = new Blob([JSON.stringify(serie, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(fil);
    const lank = document.createElement("a");
    lank.href = url;
    lank.download = medExempel ? "paulina-bildstandard-v1.json" : "bildstandard-v1.json";
    document.body.append(lank);
    lank.click();
    lank.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className={styles.sida}>
      <nav className={styles.nav} aria-label="Studionavigering">
        <a href="/"><ArrowLeft size={16} aria-hidden /> Dealerstudion</a>
        <a href="/bildpipeline">Beställ bildserie i Runway <ArrowUpRight size={16} aria-hidden /></a>
        <a href="/bildstandard/sitthojd">Jämför sittbilderna <ArrowUpRight size={16} aria-hidden /></a>
      </nav>
      <header className={styles.huvud}>
        <p className="phase-caption">Fas 1 · Bildpipeline</p>
        <h1>Bildstandard för en dealer</h1>
        <p>Paulinas serie består av elva grundbilder och en extra kortvändning. Här kan du granska hennes bilder och förbereda referenser för nästa dealer. Runways beställningsflöde är i beta.</p>
        <details className={styles.upplosning}>
          <summary>Behöver Paulinas bilder högre upplösning?</summary>
          <p>Behåll nuvarande helbilder på 1083 × 1452 px för kroppens pose. I den sparade körningen lästes de in som 955 × 1280 px. Kroppsmodellen arbetade sedan med ett utsnitt på 512 × 512 px. Varje hand fick ett eget utsnitt.</p>
          <p>Fototexturen använder originalfilerna. Komplettera med skarpa närbilder där detaljer saknas, i första hand bakhuvudet och fingrarnas kontakt med kortet. En samtidig sidofilm av utdraget ger underlag för handens djup och släpptid. <a href="https://github.com/facebookresearch/sam-3d-body">Meta SAM 3D Body</a></p>
        </details>
      </header>
      <section aria-label="Välj en bildvy" className={styles.valrad}>
        <label htmlFor="bildvy">Bildvy</label>
        <select id="bildvy" value={recept.id} onChange={(e) => { setVy(e.target.value); setKopieringsstatus(""); }}>
          {grupper.map((grupp) => (
            <optgroup key={grupp} label={grupp}>
              {bildrecept.filter((bild) => bild.grupp === grupp).map((bild) => (
                <option key={bild.id} value={bild.id}>{bild.namn}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <nav className={styles.genvagar} aria-label="Bildstandardens avsnitt">
          <a href="#bildordning">Bildordning</a>
          <a href="#referenskort">Referenskort</a>
          <a href="#bildprompt">Till prompten ↓</a>
        </nav>
      </section>

      <div className={styles.jamforelse}>
        <section className={styles.panel} aria-labelledby="mallrubrik">
          <header className={styles.panelhuvud}>
            <p>Återanvändbar fotomall</p>
            <h2 id="mallrubrik">{recept.namn}</h2>
          </header>
          <Fakta rader={[
            ["Bildunderlag", recept.basvy ? `Personens originalfoton och ${basvyer[recept.basvy].roll.toLocaleLowerCase("sv")}.` : "Personens originalfoton."],
            ["Målvinkel", recept.vinkel], ["Riktning", recept.riktning], ["Kamera", recept.kamera],
            ["Utsnitt", recept.utsnitt], ["Pose", recept.pose], ["Ljus", recept.ljus],
            ["Bakgrund", recept.bakgrund], ["Målformat", recept.format],
          ]} />
          <div className={styles.kontroll}>
            <h3>Kontrollera i bilden</h3>
            <p>{recept.kontroll}</p>
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="exempelrubrik">
          <header className={styles.panelhuvud}>
            <p>Ifyllt exempel · Fas 1, v1</p>
            <h2 id="exempelrubrik">Paulina{kortvandning ? " · revision B" : ""}</h2>
          </header>
          {paulina ? (
            <>
              <figure className={styles.bild}>
                <a href={paulina.bildUrl} aria-label={`Öppna originalbilden av Paulina, ${recept.namn}`}>
                  <img src={paulina.bildUrl} alt={`Paulina, ${recept.namn}`} width={paulina.filuppgifter.breddPx} height={paulina.filuppgifter.hojdPx} />
                </a>
                <figcaption>{paulina.kalla}</figcaption>
              </figure>
              <Fakta rader={[
                ["Bildmått", `${talformat.format(paulina.filuppgifter.breddPx)} × ${talformat.format(paulina.filuppgifter.hojdPx)} px`],
                ["Filformat", paulina.filuppgifter.format], ["Kanaler", paulina.filuppgifter.kanaler],
                ["Filstorlek", `${talformat.format(paulina.filuppgifter.byte)} byte`],
                ["EXIF", paulina.filuppgifter.exif ? "Finns i filen" : "Saknas i filen"],
                ["Bakgrundsprov", <><span className={styles.fargprov} style={{ backgroundColor: paulina.filuppgifter.bakgrundsprov }} aria-hidden />{paulina.filuppgifter.bakgrundsprov} · median i bildens övre vänstra 16 × 16 px</>],
                ["Synlig riktning", paulina.observation.riktning], ["Synligt ljus", paulina.observation.ljus],
                ["Iakttagelse", paulina.observation.iakttagelse], ["Osäkerhet", paulina.osakerhet],
              ]} />
              <button type="button" className={styles.exempelknapp} onClick={() => hamtaSerie(true)}>
                <Download size={16} aria-hidden /> Hämta Paulinas ifyllda mall
              </button>
            </>
          ) : <p className={styles.tom}>Paulinas lokala exempelbild saknas för den här vyn. Fotomallen och prompten går att använda med egna referensfoton.</p>}
          {kortvandning && paulina?.granskning && <p className={styles.granskning}><a href="/fotomall.html/fas-1/v1/granskning/index.html">Jämför greppet med försöksversion D <ArrowUpRight size={15} aria-hidden /></a></p>}
        </section>
      </div>

      <div className={styles.anvisningar}>
        <section className={styles.panel} id="bildordning" aria-labelledby="ordningsrubrik">
          <header className={styles.panelhuvud}><h2 id="ordningsrubrik">Bildordning från egna foton</h2></header>
          <ol className={styles.steg}>
            <li><b>Ny stående front.</b> Lägg in exempelvis fyra foton av samma person. Runway skapar en ny helfigur framifrån även om originalen är selfies, profilbilder eller närbilder. Den blir kropps- och klädreferens för resten av serien.</li>
            <li><b>Stående 45°, stående 90° och sittande framifrån.</b> Dessa tre bilder kan skapas parallellt. Varje bild använder samma godkända ståfront för kläder och kropp samt originalfotona för identitet.</li>
            <li><b>Sittande 45° och 90°.</b> Skapa båda direkt från samma godkända sittfront och personens original. Behåll stol, pose och handplacering.</li>
          </ol>
          <p>I Runway-serien används ståfront och original även till porträtt och handryggar. Kortgreppen utgår från de genererade handryggarna. Kroppsdetaljer som saknas i originalen är uppskattade. <a href="/bildpipeline">Öppna bildbeställningen och läs den första prompten</a>.</p>
        </section>
        <section className={styles.panel} id="referenskort" aria-labelledby="kortrubrik">
          <header className={styles.panelhuvud}><h2 id="kortrubrik">Referenskort för nya handbilder</h2></header>
          <div className={styles.kortprov}>
            <a href={referenskort.fil} aria-label="Öppna referenskortets baksida">
              <img src={referenskort.fil} width={referenskort.breddPx} height={referenskort.hojdPx} alt="Mörkröd kortbaksida med ljust X i mitten och ljuslila punkt uppe till vänster" />
            </a>
            <Fakta rader={[
              ["Rygg · sRGB", referenskort.rygg.join(", ")],
              ["X · sRGB", referenskort.x.join(", ")],
              ["Punkt · sRGB", referenskort.punkt.join(", ")],
            ]} />
          </div>
          <p>{referenskort.breddMm} × {referenskort.hojdMm} mm. Punkten är {referenskort.punktlage.diameterMm} mm bred och sitter {referenskort.punktlage.franVansterMm} mm in från båda kanterna i kortets övre vänstra hörn. Den följer kortet under vändningen.</p>
          <p>Punkten identifierar hörnet. X:et och kortkonturen hjälper oss att bedöma lutningen. RGB-värdena gäller trycket, medan ljus, oskärpa och fingrar påverkar vad som syns i film. Det slutliga trycket kan läggas på i 3D-renderingen.</p>
          <a href={referenskort.fil} download>Hämta kortbaksidan som PNG</a>
        </section>
      </div>

      <section className={styles.promptpanel} id="bildprompt" aria-labelledby="promptrubrik">
        <header className={styles.panelhuvud}>
          <h2 id="promptrubrik">Prompt för egna referensfoton</h2>
          <p>Ge varje foto ett unikt filnamn. Välj Identitet för det tydligaste originalfotot och ange vilken vy en godkänd frontbild visar. Bifoga filerna för den valda vyn hos bildgeneratorn. Ett eget foto med rollen Kortets mönster styr korttrycket.</p>
        </header>
        <div className={styles.promptinnehall}>
          <div>
            <h3 className={styles.faltetikett}>Referensfoton</h3>
            <button type="button" onClick={() => filval.current?.click()}>Lägg till referensfoton</button>
            <input ref={filval} aria-label="Välj referensfoton" hidden type="file" multiple accept="image/*" onChange={(e) => { laggTill(e.target.files); e.target.value = ""; }} />
            {referenser.length > 0 && <ul className={styles.referenser}>
              {referenser.map((ref, index) => (
                <li key={ref.namn}>
                  <label htmlFor={`referensroll-${index}`}>{ref.namn}</label>
                  <div>
                    <select id={`referensroll-${index}`} aria-label={`Roll för ${ref.namn}`} value={ref.roll} onChange={(e) => {
                      const roll = e.target.value as Bildreferens["roll"];
                      setReferenser((rader) => rader.map((rad) => rad.namn === ref.namn ? { ...rad, roll } : rad));
                      setKopieringsstatus("");
                    }}>
                      {valbaraRoller.map((roll) => <option key={roll}>{roll}</option>)}
                    </select>
                    <button type="button" aria-label={`Ta bort ${ref.namn}`} onClick={() => {
                      setReferenser((rader) => rader.filter((rad) => rad.namn !== ref.namn));
                      setKopieringsstatus("");
                    }}>Ta bort</button>
                  </div>
                </li>
              ))}
            </ul>}
          </div>
          <div>
            <label className={styles.faltetikett} htmlFor="prompttext">{recept.namn}</label>
            <textarea id="prompttext" ref={promptfalt} className={styles.prompttext} rows={11} readOnly value={prompt} />
            <div className={styles.kopiering}>
              <button type="button" className={styles.kopiera} onClick={kopiera}><Copy size={16} aria-hidden /> Kopiera prompt</button>
              <button type="button" onClick={() => hamtaSerie(false)}><Download size={16} aria-hidden /> Hämta alla vyer som JSON</button>
              <span role="status">{kopieringsstatus}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
