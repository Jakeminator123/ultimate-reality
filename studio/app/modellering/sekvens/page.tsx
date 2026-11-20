import { StudioSubpage } from "../../StudioSidebar";
import styles from "./sequence.module.css";

export const metadata = { title: "Blackjacksekvens · Dealerstudio" };

export default async function SequencePage({ searchParams }: {
  searchParams: Promise<{ dealer?: string; id?: string; ruta?: string; stol?: string }>;
}) {
  const { dealer = "paulina", id = "", ruta, stol } = await searchParams;
  const query = new URLSearchParams({ dealer, id });
  if (ruta) query.set("ruta", ruta);
  if (stol) query.set("stol", stol);
  return <StudioSubpage area="rorelseprov"><main className={styles.main}>
    <a href={"/?" + new URLSearchParams({ dealer }) + "#modellering"}>← 3D-modellering</a>
    <h1>Blackjacksekvens</h1>
    <iframe className={styles.player} title="Blackjacksekvens i 3D" src={"/modellering/sekvens/vy?" + query}/>
  </main></StudioSubpage>;
}
