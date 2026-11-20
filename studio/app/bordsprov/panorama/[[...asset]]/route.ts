import { readFile } from "node:fs/promises";
import path from "node:path";
import { LocalError, requireLocal } from "../../../../lib/storage";
import { panoramaRooms } from "../../../../lib/panorama-rooms";
import { panoramaDeals, samPanoramaDeals, samPanoramaTake, seatedPaulina } from "../../../../lib/panorama-deals";
import { currentSeatedTrial, dealerMaterial, readDealingStudies, reviewedTrialFilm } from "../../../../lib/dealer-material";
import { tableFinishes } from "../../../../lib/table-finishes";

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
      const view = seat && (requestedView === "golv" || requestedView === "paulina" || requestedView === "giv") ? requestedView : "";
      let deals: ReturnType<typeof panoramaDeals> = [];
      if (view === "giv") {
        const sam = samPanoramaTake;
        const [material, studies] = await Promise.all([dealerMaterial("paulina", seatedPaulina), readDealingStudies("paulina")]);
        const candidate = await currentSeatedTrial(material);
        const current = candidate && "film" in candidate && candidate.film && candidate.animation && candidate.receipt
          ? { film: candidate.film, animation: candidate.animation, receipt: candidate.receipt } : undefined;
        const frozen = current?.receipt === sam.receipt ? current :
          await reviewedTrialFilm("paulina", sam.geometry, sam.appearance, sam.motion, sam.receipt);
        deals = [...samPanoramaDeals(frozen, current), ...panoramaDeals(material, studies)];
      }
      const requestedTake = query.get("tagning");
      const deal = requestedTake ? deals.find(candidate => candidate.take === requestedTake) : deals[0];
      if (view === "giv" && !deal) return new Response("Givtagningen saknar verifierat material i studion.", { status: 404 });
      const frame = Number(query.get("ruta"));
      const frameQuery = deal && Number.isInteger(frame) && frame > 0 ? "&amp;ruta=" + Math.min(deal.lastFrame, frame) : "";
      const viewQuery = view ? "&amp;vy=" + view + (deal ? "&amp;tagning=" + deal.take : "") + frameQuery : "";
      const materials = tableFinishes.map(surface => ({
        ...surface, active: surface.options.find(option => option.value === query.get(surface.key)) ?? surface.options[0],
      }));
      const matParams = materials.filter(surface => surface.active !== surface.options[0])
        .map(surface => `${surface.key}=${surface.active.value}`).join("&amp;");
      const matQuery = matParams ? "&amp;" + matParams : "";
      const emptyQuery = matParams ? "?" + matParams : "";
      const materialControls = materials.map(({ key, name, options, active }) => {
        const choices = options.map(option => {
          const scan = option.scan ? ` data-scan="${option.scan}" data-metres="${option.metres}"` : "";
          return `<option value="${option.value}"${scan}${option.quarterTurn ? " data-quarter-turn" : ""}${option === active ? " selected" : ""}>${option.name}</option>`;
        }).join("");
        return `<label>${name} <select name="${key}">${choices}</select></label>`;
      }).join("");
      const panel = seat ? `<fieldset id="bordsmaterial" disabled><legend>Bordsmaterial</legend>${materialControls}<output role="status"></output></fieldset>` : "";
      const seatLinks = ["4", "1"].map(id => `<a data-seat="${id}" href="?stol=${id}${viewQuery}${matQuery}">Stol ${id}</a>`).join("");
      const seatMenu = `<nav aria-label="Kameraplats"><a data-seat="" href="/bordsprov/panorama/${room.id}${emptyQuery}">Tomt rum</a>${seatLinks}</nav>`;
      const roomQuery = seat ? `?stol=${seat}${viewQuery}${matQuery}` : emptyQuery;
      const roomLinks = panoramaRooms.map(candidate =>
        `<a data-room="${candidate.id}" href="/bordsprov/panorama/${candidate.id}${roomQuery}">${candidate.label}</a>`
      ).join("");
      let controls = "";
      const dealLink = view === "giv" ? "" : `<a href="?stol=${seat || "4"}&amp;vy=giv${matQuery}">Paulinas giv till plats 4</a>`;
      if (seat) {
        controls = view === "golv"
          ? `<a href="?stol=${seat}${matQuery}">Visa bordsskivan</a><label><input id="kontaktskugga" type="checkbox" checked> Kontaktskugga</label>`
          : `<a href="?stol=${seat}&amp;vy=golv${matQuery}">Visa bordsfötterna</a>`;
        if (view === "giv") controls += `<a href="?stol=${seat}${matQuery}">Visa bordet utan Paulina</a>`;
        controls += view === "paulina"
          ? `<a href="?stol=${seat}${matQuery}">Visa bordet utan Paulina</a>`
          : `<a href="?stol=${seat}&amp;vy=paulina${matQuery}">Placeringsprov med Paulina</a>`;
      }
      controls = dealLink + controls;
      const takeMenu = deals.length > 1 ? `<nav aria-label="Tagning">${deals.map(candidate =>
        `<a${candidate === deal ? ' aria-current="page"' : ""} href="?stol=${seat}&amp;vy=giv&amp;tagning=${candidate.take}${frameQuery}${matQuery}">${candidate.take.replace(/^giv-sam-v4-v(\d+)$/, "SAM-sittmodell v4 · givprov $1")}</a>`).join("")}</nav>` : "";
      const playback = deal ? `<fieldset id="givkontroll" disabled data-take="${deal.take}" data-motion="${deal.motion}" data-fps="${deal.fps}"><legend>Giv till plats 4 · ${deal.take}</legend>${takeMenu}
        <button type="button" id="spela">Spela upp</button>
        <label>Bildruta <input type="range" id="giv-ruta" min="0" max="${deal.lastFrame}" value="0" step="1"></label><output for="giv-ruta" id="giv-tid">0 / ${deal.lastFrame}</output>
        ${deal.jumps.map(jump => `<button type="button" data-frame="${jump.frame}">${jump.label}</button>`).join("")}</fieldset>` : "";
      const title = view === "giv" ? "Paulinas giv · " + room.name : view === "paulina" ? "Placeringsprov · Paulina v2 · pose 17" : room.name;
      return new Response(html.replaceAll("{{rum}}", room.name).replaceAll("{{title}}", title).replaceAll("{{id}}", key).replaceAll("{{blick}}", room.eye.join(",")).replaceAll("{{plats}}", seat).replace("{{vy}}", view).replace("{{matta}}", materials.find(surface => surface.key === "matta")!.active.value).replace("{{materialval}}", panel).replace("{{givkontroll}}", playback).replace("{{platser}}", seatMenu).replace("{{rumslankar}}", roomLinks).replace("{{standardsynfalt}}", seat ? "48" : "63").replace("{{kontroller}}", controls), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
      });
    }
    const resources = new Map([
      ["visare.mjs", ["test/bakgrund/polyhaven/brown-photostudio-01/ljus-v1/panorama.mjs", "text/javascript"]],
      ["bord.mjs", ["test/bakgrund/panorama/bord.mjs", "text/javascript"]],
      ["golv-v2.mjs", ["test/bakgrund/panorama/golv-v2/kontaktskugga.mjs", "text/javascript"]],
      ["placering.mjs", ["test/bakgrund/panorama/paulina-placering-v1/placering.mjs", "text/javascript"]],
      ["giv.mjs", ["test/bakgrund/panorama/paulina-giv-v1/giv.mjs", "text/javascript"]],
      ["dealer-face-light.mjs", ["studio/lib/dealer-face-light.mjs", "text/javascript"]],
      ["grasmatta.mjs", ["test/bakgrund/polyhaven/grass-ground-v1/grasmatta.mjs", "text/javascript"]],
      ["materialval.mjs", ["test/bord/materialval-v1/materialval.mjs", "text/javascript"]],
      ["studio.hdr", [room.photo, "application/octet-stream"]],
      ["forhandsvisning.jpg", [`test/bakgrund/panorama/rum-v2/${room.id}.jpg`, "image/jpeg"]],
      ["HDRLoader.js", ["studio/node_modules/three/examples/jsm/loaders/HDRLoader.js", "text/javascript"]],
    ]);
    for (const kind of ["diff", "nor_gl", "rough"]) {
      for (const { scan } of tableFinishes.flatMap(surface => surface.options)) {
        if (!scan) continue;
        const map = `${scan}_${kind}_2k.jpg`;
        const directory = scan === "grass_ground" ? "test/bakgrund/polyhaven/grass-ground-v1" : `test/bord/materialval-v1/${scan}`;
        resources.set(map, [`${directory}/${map}`, "image/jpeg"]);
      }
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
