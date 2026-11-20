import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { requireLocal, LocalError } from "../../../../lib/storage";

const room = "test/bakgrund/kasinorum-fri-v1";
const lighting = "test/bakgrund/kasinorum-lampljus-v1";
const splatStudy = "test/bakgrund/atlas-splat-v1";
const lampStudy = "test/bakgrund/worldlabs/lampblink-v1";
const drawStudy = "test/bakgrund/worldlabs/pendelljus-kortutdrag-v1";
const fullSplat = "test/bakgrund/atlas-chisel-v1/full-splat-v1.spz";
const study = "test/artefakter/skoriktning-70-30";
const surfaces = "test/bord/polyhaven-material-v1";
const modules = "studio/node_modules";
const files = new Map<string, string>([
  ["", room + "/index.html"],
  ["arbetsrum.jpg", room + "/originalrum-med-bord.jpg"],
  ["scen.mjs", room + "/scen.mjs"],
  ["armaturer.mjs", lighting + "/armaturer.mjs"],
  ["pendel.mjs", lampStudy + "/pendel.mjs"],
  ["lampblink.mp4", lampStudy + "/lampblink.mp4"],
  ["utdrag.mjs", drawStudy + "/utdrag.mjs"],
  ["pendelljus-kortutdrag.mp4", drawStudy + "/pendelljus-kortutdrag.mp4"],
  ["pendelljus-ruta17.jpg", drawStudy + "/pendelljus-ruta17.jpg"],
  ["lampor.html", lighting + "/lampor.html"],
  ["foremal.mjs", "test/artefakter/glas-marker-v1/foremal.mjs"],
  ["rum.glb", "test/bakgrund/kasinorum-v1/Kasinorum.glb"],
  ["rum.spz", "test/bakgrund/atlas-chisel-v1/forhandsvisning-v1.spz"],
  ["full.spz", fullSplat],
  ["atlas-jamforelse.html", splatStudy + "/atlas-jamforelse.html"],
  ["layout.json", "studio/lib/table-layout.json"],
  ["kameror.json", "test/bord/filtdjup-v1/matt.json"],
  ["bana.json", study + "/bana.json"],
  ["hand.glb", study + "/drag-00.glb"],
  ["utseende.glb", "avatars/paulina/3d/paulina-08-utseende-01-03-v1.glb"],
  ["utseende.mjs", "test/artefakter/kasinorum-utdrag-100/avatarutseende.mjs"],
  ["sko.mjs", "studio/lib/card-shoe.mjs"],
  ["test/bord/filtdjup-v1/bord.mjs", "test/bord/filtdjup-v1/bord.mjs"],
  ["test/bakgrund/salong-v1.mjs", "test/bakgrund/salong-v1.mjs"],
  ["material.mjs", surfaces + "/material.mjs"],
  ["spark.js", modules + "/@sparkjsdev/spark/dist/spark.module.min.js"],
]);
for (let pose = 1; pose <= 8; pose++) {
  const name = "drag-" + String(pose).padStart(2, "0") + ".glb";
  files.set(name, study + "/" + name);
}
for (const name of ["three.module.js", "three.core.js"]) {
  files.set(name, modules + "/three/build/" + name);
}
for (const name of ["controls/OrbitControls.js", "loaders/GLTFLoader.js", "utils/BufferGeometryUtils.js", "utils/SkeletonUtils.js", "postprocessing/Pass.js", "lights/RectAreaLightUniformsLib.js", "lights/RectAreaLightTexturesLib.js"]) {
  files.set("addons/" + name, modules + "/three/examples/jsm/" + name);
}
for (const seat of [4, 1]) {
  for (const variant of ["snabb", "full"]) {
    const name = `stol-${seat}-${variant}.png`;
    files.set(name, splatStudy + "/" + name);
  }
  for (const light of ["fore", "efter"]) {
    const name = `stol-${seat}-${light}.png`;
    files.set(name, lighting + "/" + name);
  }
  const detail = `stol-${seat}-detaljer.jpg`;
  files.set(detail, lighting + "/" + detail);
}
for (const surface of ["scuba_suede", "brown_leather", "walnut_veneer"]) {
  for (const kind of ["diff", "nor_gl", "rough"]) {
    const file = `maps/${surface}_${kind}_2k.jpg`;
    files.set(file, surfaces + "/" + file);
  }
}
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript",
  ".json": "application/json", ".glb": "model/gltf-binary", ".spz": "application/octet-stream", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4",
};

async function roomPage(html: string, root: string) {
  try {
    const [asset, measurement] = await Promise.all([
      stat(/* turbopackIgnore: true */ path.join(root, fullSplat)),
      readFile(/* turbopackIgnore: true */ path.join(root, splatStudy, "matning.json"), "utf8"),
    ]);
    const { bytes, floorY } = JSON.parse(measurement).full;
    if (bytes !== asset.size || !Number.isFinite(floorY)) return html;
    html = html.replace("<!-- atlas-full -->", `<option value="atlas-full" data-src="full.spz" data-floor="${floorY}">Atlas · full 3D-version</option>`);
    await stat(/* turbopackIgnore: true */ path.join(root, splatStudy, "atlas-jamforelse.html"));
    return html.replace("<!-- atlas-comparison -->", '<a href="atlas-jamforelse.html">Jämför Atlas-versionerna</a> · ');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return html;
    throw err;
  }
}

export async function GET(request: Request, context: { params: Promise<{ asset?: string[] }> }) {
  try {
    requireLocal(request);
    const { asset } = await context.params;
    const name = (asset ?? []).join("/");
    const file = files.get(name);
    if (!file) return new Response("Okänd scenresurs.", { status: 404 });
    const root = path.resolve(process.cwd(), "..");
    const bytes = await readFile(/* turbopackIgnore: true */ path.join(root, file));
    const body = name === "" ? await roomPage(bytes.toString("utf8"), root) : bytes;
    return new Response(body, { headers: { "Content-Type": types[path.extname(file)], "Cache-Control": "private, no-cache" } });
  } catch (err) {
    if (err instanceof LocalError) return new Response(err.message, { status: err.status });
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Response("Den lokala scenresursen saknas.", { status: 404 });
    throw err;
  }
}
