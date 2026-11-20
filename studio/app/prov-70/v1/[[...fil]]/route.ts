import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { rangedResponse } from "../../../../lib/byte-range";
import { errorResponse, requireLocal } from "../../../../lib/storage";

const allowed = new Map<string, [string, string]>([
  ["", ["studio/prov-70/index.html", "text/html; charset=utf-8"]],
  ["visare.mjs", ["studio/prov-70/visare.mjs", "text/javascript; charset=utf-8"]],
  ["modell.glb", ["avatars/paulina/prov-70/v1/modell/blackjack.glb", "model/gltf-binary"]],
  ["matning.json", ["avatars/paulina/prov-70/v1/visning/matning.json", "application/json"]],
  ["fotoyta.glb", ["avatars/paulina/prov-70/v1/modell/fotoyta-slut.glb", "model/gltf-binary"]],
  ["bord-och-stol.glb", ["avatars/paulina/prov-70/v1/modell/bord-och-stol-spelkant.glb", "model/gltf-binary"]],
  ["kallfilm.mp4", ["avatars/paulina/prov-70/v1/runway/original.mp4", "video/mp4"]],
  ["frilagd.webm", ["avatars/paulina/prov-70/v1/runway/frilaggning/frilagd.webm", "video/webm"]],
  ["jamforelse.mp4", ["avatars/paulina/prov-70/v1/visning/runway-front-70.mp4", "video/mp4"]],
  ["sida.png", ["avatars/paulina/prov-70/v1/referenser/sittande-sida-70.png", "image/png"]],
  ["film.mp4", ["avatars/paulina/prov-70/v1/visning/front-och-70.mp4", "video/mp4"]],
]);

async function respond(request: Request, context: { params: Promise<{ fil?: string[] }> }) {
  try {
    requireLocal(request);
    const item = allowed.get((await context.params).fil?.join("/") ?? "");
    if (!item) return new Response(null, { status: 404 });
    const root = await realpath(path.resolve(process.cwd(), ".."));
    const filename = path.join(root, item[0]);
    if (await realpath(/* turbopackIgnore: true */ filename) !== filename)
      return new Response(null, { status: 404 });
    const file = await stat(/* turbopackIgnore: true */ filename);
    if (!file.isFile()) return new Response(null, { status: 404 });
    if (request.method === "HEAD") {
      return new Response(null, { headers: { "Content-Type": item[1], "Content-Length": String(file.size),
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    return rangedResponse(file.size, item[1], request.headers.get("range"),
      (start, end) => Readable.toWeb(createReadStream(/* turbopackIgnore: true */ filename, { start, end })) as ReadableStream,
      "private, no-store");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return errorResponse(error);
  }
}

export const GET = respond;
export const HEAD = respond;
