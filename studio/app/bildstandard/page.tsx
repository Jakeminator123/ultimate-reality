import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { bildrecept } from "../../fotomall/bildrecept";
import type { GranskadVy } from "../../fotomall/bildserie";
import { LocalError, requireLocal } from "../../lib/storage";
import Bildstandard from "./Bildstandard";
import { StudioSubpage } from "../StudioSidebar";
import type { PaulinaExempel } from "./exempeltyp";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bildstandard för en dealer · Ultimate Reality",
  description: "Återanvändbara bildvyer med lokala exempel och prompter för egna referensfoton.",
};

const folder = path.resolve("..", "avatars", "paulina", "fas-1", "v1");
const gallery = "/fotomall.html/fas-1/v1";

async function optionalFile(file: string) {
  try {
    return await readFile(/* turbopackIgnore: true */ file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function localExamples(): Promise<PaulinaExempel[]> {
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
  } catch (err) {
    if (err instanceof LocalError) return [];
    throw err;
  }

  const manifest = await optionalFile(path.join(folder, "bildegenskaper.json"));
  if (!manifest) return [];
  const data: { schemaVersion: number; vyer: GranskadVy[] } = JSON.parse(manifest.toString("utf8"));
  if (data.schemaVersion !== 1 || !Array.isArray(data.vyer)) return [];

  // Pair each visual assessment with the exact version that was reviewed.
  const results: PaulinaExempel[] = [];
  for (const recept of bildrecept) {
    const filename = recept.id + ".png";
    const entry = data.vyer.find((bild) => bild.id === recept.id);
    if (!entry || entry.filuppgifter.fil !== filename) continue;
    const image = await optionalFile(path.join(folder, filename));
    if (!image || image.byteLength !== entry.filuppgifter.byte) continue;
    if (createHash("sha256").update(image).digest("hex") !== entry.filuppgifter.sha256) continue;
    const example: PaulinaExempel = { ...entry, bildUrl: gallery + "/" + filename };
    if (recept.id === "rorelsereferens/kortvandning-hoger") {
      example.granskning = Boolean(await optionalFile(path.join(folder, "granskning", "index.html")));
    }
    results.push(example);
  }
  return results;
}

export default async function Page() {
  return <StudioSubpage area="bilder"><Bildstandard exempel={await localExamples()}/></StudioSubpage>;
}
