import { ArrowLeft } from "lucide-react";
import FilmPlayer from "./FilmPlayer";
import styles from "../deal.module.css";

export const metadata = { title: "Från Kling-film till Paulinas V4 · Dealerstudio" };

export default function Page() {
  return <main className={styles.main}>
    <nav><a className={styles.back} href="/giv-plats-4/v4"><ArrowLeft size={16} aria-hidden /> Till Paulinas giv</a></nav>
    <header className={styles.header}><h1>Filmens rörelse på Paulina V4</h1></header>
    <p>Paulina håller det röda kortet upprätt i högerhanden från ruta 0. Filmen och V4 följer samma bildruta.</p>
    <FilmPlayer />
    <p>V4-bordets filt ligger 4,65 cm högre än i filmrekonstruktionen. Handen och det röda kortet följs åt till
      landningen i ruta 62. I ruta 73 släpper fingrarna och kortet ligger kvar.
      Djupet har skattats från en kamera. Det helt gula kortet i skon hör till given till plats 4.</p>
    <nav className={styles.references} aria-label="Provets material">
      <a href="/giv-plats-4/filmrorelse/v2/filmrorelse.glb" download="paulina-v4-filmgrepp.glb">Hämta V4 med det röda kortet</a>
      <a href="/prov-70/v1/kallfilm.mp4">Öppna originalfilmen</a>
      <a href="/giv-plats-4/filmrorelse/v2/rorelsematning.json">Öppna rörelsemätningen</a>
      <a href="/giv-plats-4/metod/bildutgava.pdf">Läs bildmetoden med Paulina</a>
    </nav>
  </main>;
}
