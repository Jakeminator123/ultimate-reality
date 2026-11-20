import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { rangedResponse } from "./byte-range";
import { errorResponse, requireLocal } from "./storage";

export type TrialResource = readonly [relativePath: string, contentType: string];

/** Serve only a resource selected from the caller's project-local allowlist. */
export async function serveTrialResource(request: Request, entry: TrialResource | undefined) {
  try {
    requireLocal(request);
    if (!entry) return new Response(null, { status: 404 });
    const root = await realpath(path.resolve(process.cwd(), ".."));
    const file = path.resolve(root, entry[0]);
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative))
      return new Response(null, { status: 404 });
    if (await realpath(/* turbopackIgnore: true */ file) !== file) return new Response(null, { status: 404 });
    const details = await stat(/* turbopackIgnore: true */ file);
    if (!details.isFile()) return new Response(null, { status: 404 });

    const head = request.method === "HEAD";
    const result = rangedResponse(details.size, entry[1], request.headers.get("range"), (start, end) =>
      head ? new Uint8Array() :
        Readable.toWeb(createReadStream(/* turbopackIgnore: true */ file, { start, end })) as ReadableStream,
      "private, no-store",
    );
    return head ? new Response(null, { status: result.status, headers: result.headers }) : result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return errorResponse(error);
  }
}
