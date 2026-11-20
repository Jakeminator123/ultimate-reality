"use client";
import { useState } from "react";
import { Box, Camera, ImageOff, UserRoundPlus } from "lucide-react";
import { useCurrentModel } from "./useModelingInventory";
import { seriesCount } from "../lib/material-types";
import styles from "./dealer-overview.module.css";

export default function DealerOverview({ dirty }: { dirty: boolean }) {
  const { inventory, loading, error } = useCurrentModel();
  const [hasPortrait, setHasPortrait] = useState(true);
  const external = dirty ? { target: "_blank", rel: "noreferrer" } : {};
  const model = inventory?.activeModel;
  const photos = inventory?.photos ?? [];
  const photoStart = inventory && !inventory.revision && !model && photos.length > 0;
  const modelStatus = model?.name ?? (loading ? "Läser lokal modell…" : error ||
    (inventory?.motionTrialUrl ? "Rörelseprov v1 · Runway och två 3D-kameror" :
      photoStart ? "Nästa steg är en stilla modell av Paulina." : "Modellfil saknas lokalt"));
  const portrait = inventory?.photos.find(photo => photo.id === "ansikte/front");
  return <section className={styles.dealers} aria-label="Dealerval">
    <article className={styles.current}>
      <div className={styles.portrait}>
        {portrait && hasPortrait ? <img src={portrait.url} alt="Paulinas porträtt framifrån" onError={() => setHasPortrait(false)}/>
          : <span><ImageOff aria-hidden size={24}/> {loading ? "Läser porträttet…" : "Porträttet saknas lokalt"}</span>}
      </div>
      <div className={styles.dealer}>
        <h2>Paulina</h2>
        <dl>
          <div><dt><Camera size={17} aria-hidden/> Fas 1 · Bildserie</dt><dd>{inventory ? seriesCount(inventory.photos) : loading ? "Läser bildregistret…" : "Bildregistret saknas"}</dd></div>
          <div><dt><Box size={17} aria-hidden/> Fas 2 · 3D-modell</dt><dd>{modelStatus}</dd></div>
        </dl>
        {model && <a className={styles.open} href="#modellering">Öppna Paulinas modell</a>}
        {inventory?.motionTrialUrl && <a className={model ? styles.images : styles.open} href={inventory.motionTrialUrl} {...external}>Se rörelsen vid 0° och 70°</a>}
        <a className={model || inventory?.motionTrialUrl ? styles.images : styles.open} href="/bildstandard" {...external}>
          {photoStart ? `Öppna bildserien (${photos.length})` : photos.length ? "Visa bildserien" : "Öppna bildstandarden"}
        </a>
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
