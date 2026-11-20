import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ActiveDealerModel } from "./modeling";
import { LocalError } from "./storage";

const id = "paulina-fas1-v2";
const url = "/api/modeling?model=" + id;
const releaseFolder = path.resolve("..", "avatars", "paulina", "3d", "fas1-v2");
const filenames = { geometry: "paulina-fas1-v2.glb", appearance: "utseende/paulina-fas1-v2-utseende.glb" };
const hash = /^[a-f\d]{64}$/;
type Release = { geometrySha256: string; appearanceSha256?: string };

// A reviewed local release stays current when newer experiments are saved.
async function release(): Promise<Release | null> {
  const file = path.join(releaseFolder, "studio.json");
  try {
    const data = JSON.parse(await fs.readFile(/* turbopackIgnore: true */ file, "utf8"));
    if (data?.id !== id || typeof data.geometrySha256 !== "string" || !hash.test(data.geometrySha256))
      throw new LocalError("Versionsregistret för Paulinas arbetsmodell behöver kontrolleras.", 409);
    return { geometrySha256: data.geometrySha256,
      appearanceSha256: typeof data.appearanceSha256 === "string" && hash.test(data.appearanceSha256) ? data.appearanceSha256 : undefined };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function regularFile(kind: keyof typeof filenames) {
  const file = path.join(releaseFolder, filenames[kind]);
  const info = await fs.lstat(/* turbopackIgnore: true */ file).catch((err: NodeJS.ErrnoException) => {
    if (err.code !== "ENOENT") throw err;
    return null;
  });
  return info?.isFile() && info.size > 20 ? file : null;
}

export async function currentModel(): Promise<ActiveDealerModel | null> {
  const version = await release();
  if (!version || !await regularFile("geometry")) return null;
  const model: ActiveDealerModel = { id, name: "Paulina · sittmodell v2", url };
  if (version.appearanceSha256 && await regularFile("appearance")) model.appearanceUrl = url + "&yta=foto";
  return model;
}

export async function modelFile(query: URLSearchParams) {
  const kind = query.get("yta") === "foto" ? "appearance" : "geometry";
  if (query.get("model") !== id || (query.has("yta") && query.get("yta") !== "foto"))
    throw new LocalError("Den begärda modellversionen finns inte.", 404);
  const version = await release();
  const expected = kind === "geometry" ? version?.geometrySha256 : version?.appearanceSha256;
  const file = expected && await regularFile(kind);
  if (!file) throw new LocalError("Modellversionen saknas på labbdatorn.", 404);
  const bytes = await fs.readFile(/* turbopackIgnore: true */ file);
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new LocalError("GLB-filen avviker från den sparade modellversionen.", 409);
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "model/gltf-binary", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
