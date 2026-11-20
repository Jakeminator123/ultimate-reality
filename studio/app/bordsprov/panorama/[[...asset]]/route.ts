import { readFile } from "node:fs/promises";
import path from "node:path";
import { LocalError, requireLocal } from "../../../../lib/storage";
import { panoramaRooms } from "../../../../lib/panorama-rooms";

export async function GET(request: Request, { params }: { params: Promise<{ asset?: string[] }> }) {
  try {
    requireLocal(request);
    const [key = "fotostudio", asset = "", ...extra] = (await params).asset ?? [];
    const room = panoramaRooms.find(candidate => candidate.id === key);
    if (!room || extra.length) return new Response("Okänd panoramavy.", { status: 404 });
    const root = path.resolve(process.cwd(), "..");
    if (!asset) {
      const html = await readFile(/* turbopackIgnore: true */ path.join(root, "test/bakgrund/panorama/visare.html.tmpl"), "utf8");
      const query = new URL(request.url).searchParams;
      const selectedSeat = query.get("stol");
      const seat = selectedSeat === "4" || selectedSeat === "1" ? selectedSeat : "";
      const requestedView = query.get("vy");
      const view = seat && (requestedView === "golv" || requestedView === "paulina") ? requestedView : "";
      const viewQuery = view ? "&amp;vy=" + view : "";
      const grass = Boolean(seat && query.get("matta") === "gras");
      const matQuery = grass ? "&amp;matta=gras" : "";
      const seatLinks = ["4", "1"].map(id => `<a data-seat="${id}" href="?stol=${id}${viewQuery}${matQuery}">Stol ${id}</a>`).join("");
      const seatMenu = `<nav aria-label="Kameraplats"><a data-seat="" href="/bordsprov/panorama/${room.id}">Tomt rum</a>${seatLinks}</nav>`;
      const roomQuery = seat ? `?stol=${seat}${viewQuery}${matQuery}` : "";
      const roomLinks = panoramaRooms.map(candidate =>
        `<a data-room="${candidate.id}" href="/bordsprov/panorama/${candidate.id}${roomQuery}">${candidate.label}</a>`
      ).join("");
      let controls = "";
      if (seat) {
        controls = view === "golv"
          ? `<a href="?stol=${seat}${matQuery}">Visa bordsskivan</a><label><input id="kontaktskugga" type="checkbox" checked> Kontaktskugga</label>`
          : `<a href="?stol=${seat}&amp;vy=golv${matQuery}">Visa bordsfötterna</a>`;
        controls += view === "paulina"
          ? `<a href="?stol=${seat}${matQuery}">Visa bordet utan Paulina</a>`
          : `<a href="?stol=${seat}&amp;vy=paulina${matQuery}">Placeringsprov med Paulina</a>`;
        controls += grass
          ? `<a href="?stol=${seat}${viewQuery}">Visa grön filt</a>`
          : `<a href="?stol=${seat}${viewQuery}&amp;matta=gras">Prova gräsmattan</a>`;
      }
      const title = view === "paulina" ? "Placeringsprov · Paulina v2 · pose 17" : room.name;
      return new Response(html.replaceAll("{{rum}}", room.name).replaceAll("{{title}}", title).replaceAll("{{id}}", key).replaceAll("{{blick}}", room.eye.join(",")).replaceAll("{{plats}}", seat).replace("{{vy}}", view).replace("{{matta}}", grass ? "gras" : "filt").replace("{{platser}}", seatMenu).replace("{{rumslankar}}", roomLinks).replace("{{standardsynfalt}}", seat ? "48" : "63").replace("{{kontroller}}", controls), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    }
    const resources = new Map([
      ["visare.mjs", ["test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/panorama.mjs", "text/javascript"]],
      ["bord.mjs", ["test/bakgrund/panorama/bord.mjs", "text/javascript"]],
      ["golv-v2.mjs", ["test/bakgrund/panorama/golv-v2/kontaktskugga.mjs", "text/javascript"]],
      ["placering.mjs", ["test/bakgrund/panorama/paulina-placering-v1/placering.mjs", "text/javascript"]],
      ["grasmatta.mjs", ["test/bakgrund/polyhaven/grass-ground-v1/grasmatta.mjs", "text/javascript"]],
      ["studio.hdr", [room.photo, "application/octet-stream"]],
      ["forhandsvisning.jpg", [`test/bakgrund/panorama/rum-v2/${room.id}.jpg`, "image/jpeg"]],
      ["HDRLoader.js", ["studio/node_modules/three/examples/jsm/loaders/HDRLoader.js", "text/javascript"]],
    ]);
    for (const kind of ["diff", "nor_gl", "rough"]) {
      const file = `grass_ground_${kind}_2k.jpg`;
      resources.set(file, ["test/bakgrund/polyhaven/grass-ground-v1/" + file, "image/jpeg"]);
    }
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
