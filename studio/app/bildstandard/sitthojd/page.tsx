import { promises as fs } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { LocalError, requireLocal } from "../../../lib/storage";
import { readPhotoEdition } from "../../../lib/dealer-material";
import SittingScale, { type MeasuredPhoto } from "./SittingScale";
import { StudioSubpage } from "../../StudioSidebar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sittande bildskala · Paulina" };

async function loadMeasurements(): Promise<MeasuredPhoto[]> {
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    const file = path.resolve("..", "avatars", "paulina", "fas-1", "v1", "sittande-bildskala.json");
    const record = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8"));
    const expected = ["sittande/front.png", "sittande/trekvart.png", "sittande/profil.png"];
    if (record.release !== "fas-1/v1" || record.views?.length !== expected.length) return [];
    const { photos } = await readPhotoEdition("paulina", record.release);
    return expected.every((name, i) => {
      const view = record.views[i];
      const photo = photos.find(p => p.file === name);
      return photo && view.sourceSha256 === photo.sha256 && view.width === photo.width && view.height === photo.height &&
        view.file === name && [view.width, view.height, view.crownY, view.soleY, view.seatX, view.seatY].every(Number.isFinite)
        && view.width > 0 && view.crownY >= 0 && view.crownY < view.seatY && view.seatY < view.soleY && view.soleY < view.height;
    }) ? record.views.map((view: MeasuredPhoto) => ({ ...view, url: photos.find(p => p.file === view.file)!.url })) : [];
  } catch (err) {
    if (err instanceof LocalError || (err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export default async function Page() {
  return <StudioSubpage area="bilder"><SittingScale views={await loadMeasurements()}/></StudioSubpage>;
}
