import { readFile } from "node:fs/promises";
import path from "node:path";
import { LocalError, requireLocal } from "../../../../lib/storage";

const study = "test/bakgrund/polyhaven/brown-photostudio-01/handljus-v2";
const files = new Map<string, [string, string]>([
  ["", ["test/bakgrund/kasinorum-fri-v1/index.html", "text/html; charset=utf-8"]],
  ["scen.mjs", [study + "/scen.mjs", "text/javascript"]],
  ["pose.glb", ["avatars/paulina/3d/versioner/filer/c05b66757319c3742c8700c637dd6f32939714960b9479c37736c3b48be5577b.glb", "model/gltf-binary"]],
  ["kortdrag-v2.mp4", [study + "/kortdrag-v2.mp4", "video/mp4"]],
  ["grepp.jpg", [study + "/grepp.jpg", "image/jpeg"]],
  ["jamforelse.jpg", [study + "/jamforelse.jpg", "image/jpeg"]],
]);
for (const seat of [4, 1]) {
  for (const frame of [1, 17, 33]) {
    for (const light of ["utan", "mjukt"]) {
      const file = `stol-${seat}-ruta${frame}-${light}.png`;
      files.set(file, [study + "/" + file, "image/png"]);
    }
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ asset?: string[] }> }) {
  try {
    requireLocal(request);
    const name = ((await params).asset ?? []).join("/");
    const file = files.get(name);
    if (!file) return new Response("Okänd resurs i handljusprovet.", { status: 404 });
    const root = path.resolve(process.cwd(), "..");
    const bytes = await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, file[0]));
    const body = name ? bytes : bytes.toString("utf8").replace('src="scen.mjs"', 'src="/bordsprov/handljus/scen.mjs"');
    return new Response(body, { headers: { "Content-Type": file[1], "Cache-Control": "private, no-cache" } });
  } catch (error) {
    if (error instanceof LocalError) return new Response(error.message, { status: error.status });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Provfilen saknas på labbdatorn.", { status: 404 });
    throw error;
  }
}
