import { promises as fs } from "node:fs";
import path from "node:path";
import { headers } from "next/headers";
import { LocalError, requireLocal } from "../../../lib/storage";
import SittingScale, { type MeasuredPhoto } from "./SittingScale";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sittande bildskala · Paulina" };

async function loadMeasurements(): Promise<MeasuredPhoto[]> {
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
    const file = path.resolve("..", "avatars", "paulina", "fas-1", "v1", "sittande-bildskala.json");
    const record = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8"));
    const expected = ["sittande/front.png", "sittande/trekvart.png", "sittande/profil.png"];
    if (record.release !== "fas-1/v1" || record.views?.length !== expected.length) return [];
    return expected.every((name, i) => {
      const view = record.views[i];
      return view.file === name && [view.width, view.height, view.crownY, view.soleY, view.seatX, view.seatY].every(Number.isFinite)
        && view.width > 0 && view.crownY >= 0 && view.crownY < view.seatY && view.seatY < view.soleY && view.soleY < view.height;
    }) ? record.views : [];
  } catch (err) {
    if (err instanceof LocalError || (err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export default async function Page() {
  return <SittingScale views={await loadMeasurements()}/>;
}
