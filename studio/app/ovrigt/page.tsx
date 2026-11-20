import { ArrowLeft, ArrowRight } from "lucide-react";
import ModelingArchive from "./ModelingArchive";
import styles from "../modeling.module.css";

export const metadata = {
  title: "Övrigt · Dealerstudio",
  description: "Sparade kroppsprov, äldre riggar och arbetsbilder från den lokala labbdisken.",
};

export default function Page() {
  return <main className={styles.archive}>
    <nav className={styles.archiveNav} aria-label="Studionavigering">
      <a href="/#modellering"><ArrowLeft size={15}/> Till 3D-modellering</a>
      <a href="/#film">Filmutkast <ArrowRight size={15}/></a>
    </nav>
    <header className={styles.archiveHeader}>
      <h1>Övrigt</h1>
      <p>Sparade kroppsprov, äldre riggar och arbetsbilder från labbet.</p>
    </header>
    <ModelingArchive/>
  </main>;
}
