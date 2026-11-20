import { headers } from "next/headers";
import { dealerMaterial, readSeatedProfileTrial, seatedTrialModel } from "../../../lib/dealer-material";
import { LocalError, requireLocal } from "../../../lib/storage";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";
import ProfileComparison from "./ProfileComparison";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paulinas nya sittprofil · Bildstandard" };

async function loadComparison(requestedTake?: string) {
  requireLocal(new Request("http://localhost", { headers: await headers() }));
  const trial = await readSeatedProfileTrial("paulina", "fas-1/v1");
  if (!trial) throw new LocalError("Det uppmätta profilprovet saknas på den här datorn.", 404);
  const material = await dealerMaterial("paulina", trial.revision);
  const front = material.photos.find(p => p.id === "sittande/front" && p.sha256 === trial.frontSha256);
  const original = material.photos.find(p => p.id === "sittande/profil");
  if (material.edition !== "fas-1/v1" || !front?.seated || !original?.seated)
    throw new LocalError("Modellens sittfront och tidigare profil behöver matcha bildutgåvan.", 409);
  if (!material.activeModel) throw new LocalError("Den jämförda kroppens modellfil saknas lokalt.", 404);
  let candidate = null, candidateError = "";
  try { candidate = await seatedTrialModel(material, trial.photo, true); }
  catch (error) {
    if (!(error instanceof LocalError || error instanceof SyntaxError)) throw error;
    candidateError = "Kroppsprovet kunde inte verifieras mot sina källor.";
  }
  const films = new Map(candidate?.reviewedTakes?.map(({ film }) => [film.take, film]));
  if (candidate?.film) films.set(candidate.film.take, candidate.film);
  const film = requestedTake === undefined ? candidate?.film : films.get(requestedTake);
  const continuations = [...films.values()].flatMap(({ take, poses }) =>
    poses?.start === "A2.3" && (poses.end === "A1" || poses.end === "A2.3") ? [{ take, end: poses.end }] : []
  ).sort((a, b) => a.take.localeCompare(b.take, "sv", { numeric: true }));
  return {
    trial: trial.photo, front: { ...front, seated: front.seated }, previous: { ...original, seated: original.seated }, model: material.activeModel,
    candidate: candidate && { id: candidate.id, name: candidate.name, url: candidate.url, run: candidate.run,
      appearanceUrl: candidate.appearanceUrl, appearanceError: candidate.appearanceError, defaultTake: candidate.film?.take },
    candidateError, film, continuations,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ modell?: string; tagning?: string }> }) {
  const { modell, tagning } = await searchParams;
  let comparison: Awaited<ReturnType<typeof loadComparison>> | undefined;
  let message = "";
  try { comparison = await loadComparison(tagning); }
  catch (error) { if (!(error instanceof LocalError)) throw error; message = error.message; }
  return <StudioSubpage area="bilder"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href="/#modellering">← 3D-modellering</a><a href="/bildstandard/sitthojd">Sittande i tre vinklar</a></nav>
    <header className={styles.archiveHeader}><h1>Paulinas sittprofil</h1>
      <p>Jämför den nya sittprofilen med SAM-kroppsprovet och kroppsmodellen från Paulinas tidigare givfilmer.</p></header>
    {comparison ? <ProfileComparison {...comparison} openCandidate={modell === "prov" || tagning !== undefined} requestedTake={tagning}/> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
