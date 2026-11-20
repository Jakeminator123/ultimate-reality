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
      const query = new URL(request.url).searchParams;
      const selectedSeat = query.get("stol");
      const seat = key === "fotostudio" && (selectedSeat === "4" || selectedSeat === "1") ? selectedSeat : "";
      const requestedView = query.get("vy");
      const view = seat && (requestedView === "golv" || requestedView === "paulina") ? requestedView : "";
      const viewQuery = view ? "&amp;vy=" + view : "";
      const seatLinks = ["4", "1"].map(id => `<a data-seat="${id}" href="?stol=${id}${viewQuery}">Stol ${id}</a>`).join("");
      const seatMenu = key === "fotostudio" ? `<nav aria-label="Utsnitt i fotostudion"><a data-seat="" href="/bordsprov/panorama/fotostudio">Tomt rum</a>${seatLinks}</nav>` : "";
      let controls = "";
      if (seat) {
        controls = view === "golv"
          ? `<a href="?stol=${seat}">Visa bordsskivan</a><label><input id="kontaktskugga" type="checkbox" checked> Kontaktskugga</label>`
          : `<a href="?stol=${seat}&amp;vy=golv">Visa bordsfötterna</a>`;
        controls += view === "paulina"
          ? `<a href="?stol=${seat}">Visa bordet utan Paulina</a>`
          : `<a href="?stol=${seat}&amp;vy=paulina">Placeringsprov med Paulina</a>`;
      }
      const title = view === "paulina" ? "Placeringsprov · Paulina v2 · pose 17" : room.name;
      return new Response(html.replaceAll("{{rum}}", room.name).replaceAll("{{title}}", title).replaceAll("{{id}}", key).replaceAll("{{blick}}", room.eye).replaceAll("{{plats}}", seat).replace("{{vy}}", view).replace("{{platser}}", seatMenu).replace("{{kontroller}}", controls), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    }
    const resources = new Map([
      ["visare.mjs", ["test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/panorama.mjs", "text/javascript"]],
      ["bord.mjs", ["test/bakgrund/panorama/bord.mjs", "text/javascript"]],
      ["golv-v2.mjs", ["test/bakgrund/panorama/golv-v2/kontaktskugga.mjs", "text/javascript"]],
      ["placering.mjs", ["test/bakgrund/panorama/paulina-placering-v1/placering.mjs", "text/javascript"]],
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
