import { headers } from "next/headers";
import { dealerMaterial, readSeatedProfileTrial } from "../../../lib/dealer-material";
import { LocalError, requireLocal } from "../../../lib/storage";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";
import ProfileComparison from "./ProfileComparison";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paulinas nya sittprofil · Bildstandard" };

async function loadComparison() {
  requireLocal(new Request("http://localhost", { headers: await headers() }));
  const trial = await readSeatedProfileTrial("paulina", "fas-1/v1");
  if (!trial) throw new LocalError("Det uppmätta profilprovet saknas på den här datorn.", 404);
  const material = await dealerMaterial("paulina", trial.revision);
  const front = material.photos.find(p => p.id === "sittande/front" && p.sha256 === trial.frontSha256);
  const original = material.photos.find(p => p.id === "sittande/profil");
  if (material.edition !== "fas-1/v1" || !front?.seated || !original?.seated)
    throw new LocalError("Modellens sittfront och tidigare profil behöver matcha bildutgåvan.", 409);
  if (!material.activeModel) throw new LocalError("Den jämförda kroppens modellfil saknas lokalt.", 404);
  return { trial: trial.photo, front: { ...front, seated: front.seated }, previous: { ...original, seated: original.seated }, model: material.activeModel };
}

export default async function Page() {
  let comparison: Awaited<ReturnType<typeof loadComparison>> | undefined;
  let message = "";
  try { comparison = await loadComparison(); }
  catch (error) { if (!(error instanceof LocalError)) throw error; message = error.message; }
  return <StudioSubpage area="bilder"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href="/#modellering">← 3D-modellering</a><a href="/bildstandard/sitthojd">Sittande i tre vinklar</a></nav>
    <header className={styles.archiveHeader}><h1>Paulinas sittprofil</h1>
      <p>Jämför den nya bilden från sittfronten med Paulinas befintliga arbetsmodell.</p></header>
    {comparison ? <ProfileComparison {...comparison}/> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
