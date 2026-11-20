import { headers } from "next/headers";
import { LocalError, requireLocal } from "../../../lib/storage";
import { dealerMaterial, readPhotoEdition } from "../../../lib/dealer-material";
import SittingScale, { type MeasuredPhoto } from "./SittingScale";
import { StudioSubpage } from "../../StudioSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sittande i tre vinklar · Bildstandard" };

async function loadMeasurements(dealer: string, edition: string, revision?: string): Promise<MeasuredPhoto[]> {
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    const material = revision ? await dealerMaterial(dealer, revision) : await readPhotoEdition(dealer, edition);
    if ("edition" in material && material.edition !== edition) return [];
    return material.photos.filter((p): p is MeasuredPhoto => Boolean(p.seated));
  } catch (error) {
    if (error instanceof LocalError) return [];
    throw error;
  }
}

export default async function Page({ searchParams }: {
  searchParams: Promise<{ dealer?: string; edition?: string; revision?: string }>;
}) {
  const { dealer = "paulina", edition = "fas-1/v1", revision } = await searchParams;
  const views = await loadMeasurements(dealer, edition, revision);
  return <StudioSubpage area="bilder"><SittingScale dealer={dealer} edition={edition} views={views}/></StudioSubpage>;
}
