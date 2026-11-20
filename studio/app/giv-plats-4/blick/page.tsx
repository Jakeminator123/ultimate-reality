import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import BlickPlayer from "./BlickPlayer";
import styles from "../deal.module.css";

export const metadata: Metadata = { title: "Paulinas blick · Dealerstudio" };

export default function Page() {
  return <main className={styles.main}>
    <nav className={styles.navigation} aria-label="Paulinas prov">
      <a className={styles.back} href="/giv-plats-4/v4?kamera=120&ruta=0&vinkel=0&utsnitt=ansikte">
        <ArrowLeft size={16} aria-hidden /> Till Paulinas giv V4
      </a>
      <a className={styles.back} href="/giv-plats-4/minspel">Minspel</a>
    </nav>
    <header className={styles.header}><h1>Paulinas blick</h1></header>
    <BlickPlayer />
    <p className={styles.references}>
      <a href="/giv-plats-4/blick/blick.glb" download="paulina-blick-v1.glb">Ladda ner blickprovet i 3D</a>
      <a href="/giv-plats-4/blick/jamforelse.jpg">Jämför sex blicklägen</a>
    </p>
  </main>;
}
