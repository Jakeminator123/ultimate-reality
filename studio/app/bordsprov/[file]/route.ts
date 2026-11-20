import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const files = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["ljusprov.html", "text/html; charset=utf-8"],
  ["skoprov.html", "text/html; charset=utf-8"],
  ["paulina-utdrag.html", "text/html; charset=utf-8"],
  ["paulina-hallning.jpg", "image/jpeg"],
  ["grund-stol-4.png", "image/png"],
  ["grund-stol-1.png", "image/png"],
  ["kort-stol-4.png", "image/png"],
  ["kort-stol-1.png", "image/png"],
]);
const shoeTakes = [
  { id: "70-30", title: "70 % inåt · 30 % mot stol 4", file: "artefakter/skoriktning-70-30/utdrag.html" },
  { id: "100", title: "Tidigare 100°", file: "dealer/paulina/utseende-01-03-v1/utdrag.html" },
];

async function drawStudy(query: URLSearchParams, type: string) {
  const requested = query.get("riktning");
  const avatar = query.get("avatar");
  if (avatar && avatar !== "rigg" && avatar !== "paulina") return new Response("Okänd avatar.", { status: 404 });
  if (avatar === "rigg") {
    return requested && requested !== "100" ? new Response("Det tidigare riggprovet har 100° sko.", { status: 404 }) : null;
  }
  const directory = path.resolve(process.cwd(), "../test");
  const available = (await Promise.all(shoeTakes.map(async take => {
    try { return (await stat(/* turbopackIgnore: true */ path.join(directory,take.file))).isFile() ? take : null; }
    catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; throw err; }
  }))).filter(take => take !== null);
  const take = requested ? available.find(item => item.id === requested) : available[0];
  if (!take) return requested || avatar === "paulina" ? new Response("Det valda kortutdraget saknas på labbdisken.", { status: 404 }) : null;
  const bytes = await readFile(/* turbopackIgnore: true */ path.join(directory,take.file));
  const end = bytes.indexOf("</header>");
  if (end < 0) return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "no-cache" } });
  const switcher = available.map(item => item.id === take.id
    ? `<strong aria-current="page">${item.title}</strong>`
    : `<a data-direction href="?riktning=${item.id}">${item.title}</a>`).join(" · ");
  const postureFile = path.join(directory,"dealer/paulina/hallning-08-v1",take.id === "100" ? "paulina-hallning-100.jpg" : "paulina-hallning.jpg");
  const hasPosture = await stat(/* turbopackIgnore: true */ postureFile).then(s => s.isFile()).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return false;
    throw e;
  });
  const postureLink = hasPosture ? ` · <a href="/bordsprov/paulina-hallning.jpg?riktning=${take.id}">Hållning från sidan</a>` : "";
  const comparison = take.id === "70-30" && await stat(/* turbopackIgnore: true */ path.join(directory,"dealer/paulina/08-rak-v1/jamforelse.json"))
    .then(s => s.isFile()).catch((e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return false; throw e; });
  const compareLink = comparison ? ' · <a data-posture href="/bordsprov/paulina-rak">Jämför 08 före och efter upprätning</a>' : "";
  const nav = `<nav aria-label="Kortskons riktning"><span>Skoriktning</span> ${switcher}${postureLink}${compareLink}</nav>
  <script>addEventListener("DOMContentLoaded", () => {
    const url = new URL(location.href), slider = document.querySelector("#frame");
    const initial = Number(url.searchParams.get("ruta"));
    for (const key of ["size","finish"]) {
      const option = [...document.querySelectorAll("[data-"+key+"]")].find(el => el.dataset[key] === url.searchParams.get(key));
      if (option) option.click();
    }
    if (Number.isInteger(initial) && initial >= 1 && initial <= Number(slider.max)) {
      slider.value = String(initial); slider.dispatchEvent(new Event("input"));
    }
    document.querySelector("[data-posture]")?.addEventListener("click", event => {
      const link = event.currentTarget, target = new URL(link.href);
      target.searchParams.set("ruta",slider.value);
      target.searchParams.set("vy",document.querySelector("[data-view][aria-pressed=true]").dataset.view === "hand" ? "hand" : "hallning");
      link.href = target.href;
    });
    document.querySelectorAll("[data-direction]").forEach(link => link.addEventListener("click", () => {
      const target = new URL(link.href);
      target.searchParams.set("stol",document.querySelector("[data-seat][aria-pressed=true]").dataset.seat);
      target.searchParams.set("vy",document.querySelector("[data-view][aria-pressed=true]").dataset.view);
      for (const key of ["size","finish"]) target.searchParams.set(key,document.querySelector("[data-"+key+"][aria-pressed=true]").dataset[key]);
      target.searchParams.set("ruta",slider.value); link.href = target.href;
    }));
  });</script>`;
  const boundary = end + "</header>".length;
  return new Response(Buffer.concat([bytes.subarray(0,boundary),Buffer.from(nav),bytes.subarray(boundary)]), {
    headers: { "Content-Type": type, "Cache-Control": "no-cache" },
  });
}

export async function GET(request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const type = files.get(file);
  if (!type) return new Response("Okänd provfil.", { status: 404 });
  if (file === "paulina-utdrag.html") {
    const selected = await drawStudy(new URL(request.url).searchParams, type);
    if (selected) return selected;
  }
  const studies: Record<string, string> = {
    "paulina-utdrag.html": "artefakter/kasinorum-utdrag-100",
    "paulina-hallning.jpg": "dealer/paulina/hallning-08-v1",
    "ljusprov.html": "bakgrund/ljusprov-v1",
    "skoprov.html": "artefakter/kortsko-vanster-v1",
  };
  const recipe = studies[file] ?? "bord/filtdjup-v1";
  const directory = path.resolve(process.cwd(), "../test", recipe);
  try {
    const outputs: Record<string, string> = {
      "paulina-utdrag.html": "utdrag.html",
      "paulina-hallning.jpg": new URL(request.url).searchParams.get("riktning") === "100" ? "paulina-hallning-100.jpg" : "paulina-hallning.jpg",
    };
    const filename = outputs[file] ?? file;
    return new Response(await readFile(path.join(directory, filename)), {
      headers: { "Content-Type": type, "Cache-Control": "no-cache" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return new Response(`Bildprovet saknas. Följ anvisningarna i test/${recipe}/README.md.`, { status: 404 });
  }
}
