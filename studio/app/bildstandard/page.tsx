import { access } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { dealerMaterial } from "../../lib/dealer-material";
import type { DealerMaterial } from "../../lib/material-types";
import { LocalError, requireLocal } from "../../lib/storage";
import Bildstandard from "./Bildstandard";
import { StudioSubpage } from "../StudioSidebar";
import type { PaulinaExempel } from "./exempeltyp";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bildstandard för en dealer · Ultimate Reality",
  description: "Återanvändbara bildvyer med lokala exempel och prompter för egna referensfoton.",
};

async function localProject(): Promise<DealerMaterial | null> {
  try {
    requireLocal(new Request("http://localhost", { headers: await headers() }));
  } catch (err) {
    if (err instanceof LocalError) return null;
    throw err;
  }

  return dealerMaterial();
}

export default async function Page() {
  const project = await localProject();
  const examples: PaulinaExempel[] = [];
  for (const photo of project?.photos ?? []) {
    if (!photo.observed) continue;
    const example: PaulinaExempel = { ...photo.observed, bildUrl: photo.url, bildbedomning: photo.review, filuppgifter: {
      ...photo.observed.filuppgifter, breddPx: photo.width, hojdPx: photo.height, format: photo.format,
    } };
    if (project?.edition === "fas-1/v1" && photo.id === "rorelsereferens/kortvandning-hoger") {
      const review = path.resolve("..", "avatars", "paulina", project.edition, "granskning", "index.html");
      example.granskning = await access(/* turbopackIgnore: true */ review).then(() => true, () => false);
    }
    examples.push(example);
  }
  return <StudioSubpage area="bilder"><Bildstandard exempel={examples} project={project}/></StudioSubpage>;
}
