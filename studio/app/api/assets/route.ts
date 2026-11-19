import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import {
  assetFile,
  errorResponse,
  folders,
  listAssets,
  requireLocal,
  LocalError,
  mediaType,
} from "../../../lib/storage";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireLocal(req);
    const name = new URL(req.url).searchParams.get("name");
    if (!name)
      return Response.json(await listAssets(), {
        headers: { "Cache-Control": "no-store" },
      });
    const { file, size, mime } = await assetFile(name);
    const range = req.headers.get("range");
    let start = 0,
      end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + size },
        });
      start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2]));
      end =
        match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start > end || start >= size)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + size },
        });
    }
    const headers = new Headers({
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    return new Response(
      size
        ? (Readable.toWeb(
            createReadStream(file, { start, end }),
          ) as ReadableStream)
        : null,
      { status: range ? 206 : 200, headers },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  let tmp: string | undefined;
  try {
    requireLocal(req);
    const name = new URL(req.url).searchParams.get("name") || "";
    const mime = mediaType(name);
    if (!req.body) throw new LocalError("Filen är tom.");
    const { inputs } = await folders();
    tmp = path.join(inputs, "." + randomUUID() + ".part");
    const hash = createHash("sha256");
    await pipeline(
      Readable.fromWeb(req.body as Parameters<typeof Readable.fromWeb>[0]),
      new Transform({
        transform(chunk, _encoding, done) {
          hash.update(chunk);
          done(null, chunk);
        },
      }),
      createWriteStream(tmp, { flags: "wx" }),
    );
    if (!(await fs.stat(/* turbopackIgnore: true */ tmp)).size)
      throw new LocalError("Filen är tom.");
    const ext = path.extname(name);
    const basename = path.basename(name, ext).slice(0, 100);
    const stored =
      basename + "--" + hash.digest("hex").slice(0, 16) + ext.toLowerCase();
    await fs.link(tmp, path.join(inputs, stored)).catch((err) => {
      if (err.code !== "EEXIST") throw err;
    });
    return Response.json({
      name: stored,
      kind: mime.startsWith("image/") ? "image" : "video",
    });
  } catch (e) {
    return errorResponse(e);
  } finally {
    if (tmp) await fs.unlink(tmp).catch(() => {});
  }
}
