import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { errorResponse, requireLocal } from "../../../../../lib/storage";

export const dynamic = "force-dynamic";

const folder = path.resolve("..", "avatars", "paulina", "fas-1", "v1");
const photo = /^(staende|sittande|ansikte|hander|rorelsereferens)\/[a-z-]+\.png$/;
const reviewImages = new Set(["granskning/kortprov.png", "granskning/kortvandning-d.png"]);

export async function GET(request: Request, context: { params: Promise<{ fil: string[] }> }) {
  try {
    requireLocal(request);
    const file = (await context.params).fil.join("/");
    const html = file === "index.html" || file === "granskning/index.html";
    if (!html && !photo.test(file) && !reviewImages.has(file)) return new Response(null, { status: 404 });
    const bytes = await readFile(/* turbopackIgnore: true */ path.join(folder, file));
    const thumbnail = photo.test(file) && new URL(request.url).searchParams.get("vy") === "miniatyr";
    const image = thumbnail
      ? await sharp(bytes).resize({ width: 176, height: 152, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
      : bytes;
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": html ? "text/html; charset=utf-8" : thumbnail ? "image/webp" : "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return errorResponse(err);
  }
}
