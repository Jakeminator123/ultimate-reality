import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { rangedResponse } from "../../../../lib/byte-range";
import { errorResponse, requireLocal } from "../../../../lib/storage";

const ui = "studio/app/prov-ankare/v1";
const trial = "avatars/paulina/prov-ankare/v1";
const files = new Map<string, [string, string]>([
  ["", [`${ui}/ankare.html`, "text/html; charset=utf-8"]],
  ["visare.mjs", [`${ui}/visare.mjs`, "text/javascript; charset=utf-8"]],
  ["film.mp4", [`${trial}/visning/fyra-filmprov.mp4`, "video/mp4"]],
  ["rigg.mp4", [`${trial}/kameror/a1-till-a23-synkron.mp4`, "video/mp4"]],
]);

function resource(name: string): [string, string] | undefined {
  const frame = /^bild\/((?:a1|a23)-(?:0[0-9]{2}|1[01][0-9])\.png)$/.exec(name);
  return frame ? [`${trial}/kameror/120-kameror/${frame[1]}`, "image/png"] : files.get(name);
}

async function respond(request: Request, context: { params: Promise<{ fil?: string[] }> }) {
  try {
    requireLocal(request);
    const entry = resource((await context.params).fil?.join("/") ?? "");
    if (!entry) return new Response(null, { status: 404 });
    const root = await realpath(path.resolve(process.cwd(), ".."));
    const file = path.join(root, entry[0]);
    if (await realpath(/* turbopackIgnore: true */ file) !== file) return new Response(null, { status: 404 });
    const details = await stat(/* turbopackIgnore: true */ file);
    if (!details.isFile()) return new Response(null, { status: 404 });

    const result = rangedResponse(details.size, entry[1], request.headers.get("range"), (start, end) =>
      request.method === "HEAD" ? new Uint8Array() :
        Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file, { start, end })) as ReadableStream,
      "private, no-store",
    );
    return request.method === "HEAD" ? new Response(null, { status: result.status, headers: result.headers }) : result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return errorResponse(error);
  }
}

export const GET = respond;
export const HEAD = respond;
