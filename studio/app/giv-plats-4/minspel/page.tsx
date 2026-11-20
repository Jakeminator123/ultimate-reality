import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import ExpressionPlayer from "./ExpressionPlayer";
import { texturesV3 } from "../media";
import styles from "../deal.module.css";

export const metadata: Metadata = { title: "Paulinas minspel · Dealerstudio" };

export default function Page() {
  return <main className={styles.main}>
    <nav aria-label="Till given"><a className={styles.back} href="/giv-plats-4/v4?kamera=120&ruta=0&vinkel=0&utsnitt=ansikte">
      <ArrowLeft size={16} aria-hidden /> Till Paulinas giv V4
    </a></nav>
    <header className={styles.header}><h1>Paulinas minspel</h1></header>
    <p><a className={styles.back} href="/giv-plats-4/blick">Vrid blicken och huvudet</a></p>
    <ExpressionPlayer />
    <section className={styles.material} aria-labelledby="material">
      <h2 id="material">Material för Paulina</h2>
      <dl>
        <dt><a href="/bildstandard#utgavekontroll">Fotounderlag</a></dt>
        <dd><code>avatars/paulina/</code> innehåller sittfotot, helfiguren och referensbilderna.</dd>
        <dt><a href="/giv-plats-4/v4/giv.glb" download="paulina-giv-v4.glb">Giv V4 · GLB</a></dt>
        <dd>Modellen med rättade tummar, texturer, kortbord och givens animation.</dd>
        <dt><a href="/giv-plats-4/v3/minspel.glb" download="paulina-minspel.glb">Minspel · GLB</a></dt>
        <dd>Vilan från <a href="/giv-plats-4/v3/giv.glb" download="paulina-giv-v3.glb">V3</a> med en egen animation för mun och ögonbryn.</dd>
        <dt><a href="/giv-plats-4/v3/minspel.mp4">Spela minspel som MP4</a></dt>
        <dd>Ansiktet framifrån, från vila till snett leende och tillbaka.</dd>
        <dt><a href="/giv-plats-4/metod/bildutgava.pdf">Bildmetoden med Paulina · PDF</a></dt>
        <dd>Åtta sidor om originalbilderna, riggen, filmens rörelse och de 120 kameravinklarna.</dd>
      </dl>
      <details>
        <summary>De sex texturbilderna i V3 och V4</summary>
        <ul>{texturesV3.map(([file, label]) =>
          <li key={file}><a href={"/giv-plats-4/v3/" + file}>{label}</a></li>
        )}</ul>
      </details>
    </section>
  </main>;
}
