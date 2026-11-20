import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { panoramaRooms } from "../../../../lib/panorama-rooms";
import { StudioSubpage } from "../../../StudioSidebar";
import { panoramaCatalog } from "../../navigation";
import SceneImage from "../../SceneImage";
import styles from "../../scene.module.css";

export const metadata = { title: panoramaCatalog.name + " · Dealerstudio" };

export default function Page() {
  return <StudioSubpage area={panoramaCatalog.id}><main className={styles.page}>
    <a className={styles.back} href="/scenmiljo/bakgrund"><ArrowLeft size={15} aria-hidden/> Bakgrund och ljus</a>
    <header className={styles.heading}>
      <h1>{panoramaCatalog.name}</h1>
      <p>Välj ett rum och vrid kameran. I visaren kan du också jämföra spelarstolar, bordsmatta och pose.</p>
    </header>
    <nav className={styles.rooms} aria-label="Välj panoramarum">
      {panoramaRooms.map(room => {
        const href = "/bordsprov/panorama/" + room.id;
        return <a key={room.id} className={styles.card} href={href}>
          <div className={styles.image}><SceneImage src={href + "/forhandsvisning.jpg"} alt=""/></div>
          <div className={styles.cardBody}><h2>{room.name}<ArrowUpRight size={18} aria-hidden/></h2></div>
        </a>;
      })}
    </nav>
  </main></StudioSubpage>;
}
