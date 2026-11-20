import { ArrowLeft } from "lucide-react";
import FilmPlayer from "../filmrorelse/FilmPlayer";
import styles from "../deal.module.css";

export const metadata = { title: "Dashboardfilmens rörelse på Paulina · Dealerstudio" };

const edition = "/giv-plats-4/dashboardklipp/v1/";

export default function Page() {
  return <main className={styles.main}>
    <nav><a className={styles.back} href="/giv-plats-4/filmrorelse?ruta=0"><ArrowLeft size={16} aria-hidden /> Till Kling-filmen</a></nav>
    <header className={styles.header}><h1>Dashboardfilmens rörelse på Paulina</h1></header>
    <p>Originalfilmen är 99,43 sekunder lång och har 2 983 rutor. SAM mätte Paulinas rörelse var femte ruta i början av filmen.
      Visaren synkar de 40 mätningarna med filmen vid 30 bilder per sekund och stannar vid ruta 195, efter 6,50 sekunder.</p>
    <FilmPlayer filmId="dashboard" />
    <p>I filmens ruta 0 nyper vänster tumme och pekfinger om det gula kortet.
      På V4 ligger de cirka 12,8 respektive 15,9 mm från kortet i skon. Högerhanden har passats mot filten.
      På modellen korsar vänster lång- och ringfinger varandra i ruta 35. Ett utdraget kort behöver en egen bana.</p>
    <nav className={styles.references} aria-label="Dashboardklippets material">
      <a href={edition + "original.mp4"}>Öppna hela originalfilmen</a>
      <a href={edition + "overlay.mp4"}>Öppna SAM:s filmlager med 40 rutor</a>
      <a href={edition + "sam-ruta-000.glb"} download="sam-ruta-000.glb">Hämta SAM:s statiska kropp i ruta 0</a>
      <a href={edition + "filmrorelse.glb"} download="paulina-dashboard-rorelse.glb">Hämta Paulina med den uppmätta rörelsen</a>
      <a href={edition + "v4-front.mp4"}>Spela V4-rörelsen som MP4</a>
      <a href={edition + "rorelsematning.json"}>Öppna rörelsemätningen</a>
    </nav>
  </main>;
}
