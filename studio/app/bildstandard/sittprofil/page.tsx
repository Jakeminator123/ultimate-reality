import { headers } from "next/headers";
import { dealerMaterial, readSeatedProfileTrial, reviewedTakeForLink, seatedTrialModel } from "../../../lib/dealer-material";
import { reviewedDealChoices } from "../../../lib/reviewed-deal-versions";
import { LocalError, requireLocal } from "../../../lib/storage";
import { StudioSubpage } from "../../StudioSidebar";
import styles from "../../modeling.module.css";
import ProfileComparison from "./ProfileComparison";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paulinas nya sittprofil · Bildstandard" };

async function loadComparison(requestedTake?: string, requestedReceipt?: string) {
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
  const reviewed = candidate?.reviewedTakes ?? [];
  const choices = reviewedDealChoices(material.dealer, reviewed, candidate?.receipt);
  const defaultFilm = reviewed.find(row => row.receipt === choices.defaultAction?.receipt)?.film ?? candidate?.film;
  let film = defaultFilm;
  let selectedReceipt = choices.defaultAction?.receipt ?? candidate?.receipt;
  if (requestedTake !== undefined || requestedReceipt !== undefined) {
    const matches = reviewed.filter(row => row.film.take === requestedTake && (requestedReceipt === undefined || row.receipt === requestedReceipt));
    const selected = matches.length === 1 ? matches[0] : candidate && requestedTake ?
      await reviewedTakeForLink(material.dealer, candidate.id, requestedTake, requestedReceipt) : undefined;
    film = selected?.film;
    selectedReceipt = selected?.receipt;
  }
  const currentReceipts = new Set(choices.current.map(row => row.receipt));
  const continuations = choices.current.map(({ take, receipt, targetSeat, endPose }) => ({ take, receipt, targetSeat, end: endPose }));
  const previousTakes = reviewed.filter(row => !currentReceipts.has(row.receipt)).map(({ film, receipt }) => ({ take: film.take, receipt, end: film.poses?.end }));
  if (film && selectedReceipt && !currentReceipts.has(selectedReceipt) && !previousTakes.some(row => row.receipt === selectedReceipt))
    previousTakes.push({ take: film.take, receipt: selectedReceipt, end: film.poses?.end });
  return {
    trial: trial.photo, front: { ...front, seated: front.seated }, previous: { ...original, seated: original.seated }, model: material.activeModel,
    candidate: candidate && { id: candidate.id, name: candidate.name, url: candidate.url, run: candidate.run,
      appearanceUrl: candidate.appearanceUrl, appearanceError: candidate.appearanceError, defaultTake: defaultFilm?.take },
    candidateError, film, continuations, previousTakes, selectedReceipt,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ modell?: string; tagning?: string; kvitto?: string }> }) {
  const { modell, tagning, kvitto } = await searchParams;
  let comparison: Awaited<ReturnType<typeof loadComparison>> | undefined;
  let message = "";
  try { comparison = await loadComparison(tagning, kvitto); }
  catch (error) { if (!(error instanceof LocalError)) throw error; message = error.message; }
  return <StudioSubpage area="bilder"><main className={styles.archive}>
    <nav className={styles.archiveNav}><a href="/#modellering">← 3D-modellering</a><a href="/bildstandard/sitthojd">Sittande i tre vinklar</a></nav>
    <header className={styles.archiveHeader}><h1>Paulinas sittprofil</h1>
      <p>Jämför den nya sittprofilen med SAM-kroppsprovet och kroppsmodellen från Paulinas tidigare givfilmer.</p></header>
    {comparison ? <ProfileComparison {...comparison} openCandidate={modell === "prov" || tagning !== undefined || kvitto !== undefined} requestedTake={tagning ?? kvitto}/> : <p role="status">{message}</p>}
  </main></StudioSubpage>;
}
