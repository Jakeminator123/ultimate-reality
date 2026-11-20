"use client";
import { useState } from "react";
import { Box, Camera, ImageOff, UserRoundPlus } from "lucide-react";
import { useCurrentModel } from "./useModelingInventory";
import styles from "./dealer-overview.module.css";

export default function DealerOverview({ dirty }: { dirty: boolean }) {
  const { inventory, loading, error } = useCurrentModel();
  const [hasPortrait, setHasPortrait] = useState(true);
  const external = dirty ? { target: "_blank", rel: "noreferrer" } : {};
  const model = inventory?.activeModel;
  const modelStatus = model ? "Sittande arbetsmodell v2" : loading ? "Läser lokal modell…" : error || "Modellfil saknas lokalt";
  return <section className={styles.dealers} aria-label="Dealerval">
    <article className={styles.current}>
      <div className={styles.portrait}>
        {hasPortrait ? <img src="/fotomall.html/fas-1/v1/ansikte/front.png" alt="Paulinas porträtt framifrån" onError={() => setHasPortrait(false)}/>
          : <span><ImageOff aria-hidden size={24}/> Porträttet saknas lokalt</span>}
      </div>
      <div className={styles.dealer}>
        <h2>Paulina</h2>
        <dl>
          <div><dt><Camera size={17} aria-hidden/> Fas 1 · Bildserie</dt><dd>11 grundvyer och en kortvändning</dd></div>
          <div><dt><Box size={17} aria-hidden/> Fas 2 · 3D-modell</dt><dd>{modelStatus}</dd></div>
        </dl>
        <a className={styles.open} href="#modellering">Öppna Paulinas modell</a>
        <a className={styles.images} href="/bildstandard" {...external}>Visa bildserien</a>
      </div>
    </article>
    <article className={styles.create}>
      <UserRoundPlus size={28} strokeWidth={1.5} aria-hidden/>
      <h2>Skapa en dealer</h2>
      <p>Börja med foton av samma person. Bildpipelinen skapar en stående front och använder den som referens för resten av serien.</p>
      <a href="/bildpipeline" {...external}>Börja med egna foton</a>
    </article>
  </section>;
}
