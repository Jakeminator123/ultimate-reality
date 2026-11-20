import { readFile } from "node:fs/promises";
import path from "node:path";
import { LocalError, requireLocal } from "../../../../lib/storage";

const rooms = new Map([
  ["lounge", { name: "Lythwood Lounge", photo: "test/bakgrund/polyhaven/lythwood_lounge_4k.hdr", eye: "-0.87,0.04,-0.5" }],
  ["fotostudio", { name: "Brown Photostudio 01", photo: "test/bakgrund/polyhaven/brown-photostudio-01/brown_photostudio_01_4k.hdr", eye: "1,0.13,-1.05" }],
]);

export async function GET(request: Request, { params }: { params: Promise<{ asset?: string[] }> }) {
  try {
    requireLocal(request);
    const [key = "fotostudio", asset = "", ...extra] = (await params).asset ?? [];
    const room = rooms.get(key);
    if (!room || extra.length) return new Response("Okänd panoramavy.", { status: 404 });
    const root = path.resolve(process.cwd(), "..");
    if (!asset) {
      const html = await readFile(/* turbopackIgnore: true */ path.join(root, "test/bakgrund/panorama/visare.mall.html"), "utf8");
      const selectedSeat = new URL(request.url).searchParams.get("stol");
      const seat = key === "fotostudio" && (selectedSeat === "4" || selectedSeat === "1") ? selectedSeat : "";
      const seatMenu = key === "fotostudio" ? '<nav aria-label="Utsnitt i fotostudion"><a data-seat="" href="/bordsprov/panorama/fotostudio">Tomt rum</a><a data-seat="4" href="/bordsprov/panorama/fotostudio?stol=4">Stol 4</a><a data-seat="1" href="/bordsprov/panorama/fotostudio?stol=1">Stol 1</a></nav>' : "";
      return new Response(html.replaceAll("{{rum}}", room.name).replaceAll("{{id}}", key).replaceAll("{{blick}}", room.eye).replaceAll("{{plats}}", seat).replace("{{platser}}", seatMenu), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    }
    const resources = new Map([
      ["visare.mjs", ["test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/panorama.mjs", "text/javascript"]],
      ["bord.mjs", ["test/bakgrund/panorama/bord.mjs", "text/javascript"]],
      ["studio.hdr", [room.photo, "application/octet-stream"]],
      ["HDRLoader.js", ["studio/node_modules/three/examples/jsm/loaders/HDRLoader.js", "text/javascript"]],
    ]);
    const resource = resources.get(asset);
    if (!resource) return new Response("Okänd panoramaresurs.", { status: 404 });
    const data = await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ root, resource[0]));
    return new Response(data, { headers: { "Content-Type": resource[1], "Cache-Control": "private, no-cache" } });
  } catch (error) {
    if (error instanceof LocalError) return new Response(error.message, { status: error.status });
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Panoramat saknas på labbdatorn.", { status: 404 });
    throw error;
  }
}
