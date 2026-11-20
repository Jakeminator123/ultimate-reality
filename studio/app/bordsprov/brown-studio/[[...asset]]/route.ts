import { readFile } from "node:fs/promises";
import path from "node:path";
import { LocalError, requireLocal } from "../../../../lib/storage";

const study = "test/bakgrund/polyhaven/brown-photostudio-01";
const version = study + "/ljus-v1";
const files: Record<string, [string, string]> = {
  "": ["test/bakgrund/kasinorum-fri-v1/index.html", "text/html; charset=utf-8"],
  "brown.mjs": [version + "/brown.mjs", "text/javascript"],
  "miljokarta.mjs": [version + "/miljokarta.mjs", "text/javascript"],
  "panorama.html": [version + "/panorama.html", "text/html; charset=utf-8"],
  "panorama.mjs": [version + "/panorama.mjs", "text/javascript"],
  "HDRLoader.js": ["studio/node_modules/three/examples/jsm/loaders/HDRLoader.js", "text/javascript"],
  "studio.hdr": [study + "/brown_photostudio_01_4k.hdr", "application/octet-stream"],
  "jamforelse.jpg": [version + "/jamforelse.jpg", "image/jpeg"],
  "detaljer.jpg": [version + "/detaljer.jpg", "image/jpeg"],
};
for (const seat of [4, 1]) {
  for (const light of ["studio", "mild", "hdr"]) {
    const name = `stol-${seat}-${light}.png`;
    files[name] = [version + "/" + name, "image/png"];
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ asset?: string[] }> }) {
  try {
    requireLocal(request);
    const name = ((await params).asset ?? []).join("/");
    if (!Object.hasOwn(files, name)) return new Response("Okänd provresurs.", { status: 404 });
    const [file, type] = files[name];
    const root = path.resolve(process.cwd(), "..");
    const data = await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, file));
    const body = name === "" ? data.toString("utf8").replace('src="scen.mjs"', 'src="/bordsprov/brown-studio/brown.mjs"') : data;
    return new Response(body, { headers: { "Content-Type": type, "Cache-Control": "private, no-cache" } });
  } catch (error) {
    if (error instanceof LocalError) return new Response(error.message, { status: error.status });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Provresursen saknas på labbdatorn.", { status: 404 });
    throw error;
  }
}
