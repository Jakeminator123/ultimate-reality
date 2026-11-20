import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorResponse, requireLocal } from "../../../../lib/storage";

const images = new Map([
  ["fotostudio-v1.jpg", "test/bakgrund/panorama/fotostudio.jpg"],
  ["bord-stol-4-v1.jpg", "test/bakgrund/panorama/stol-4.jpg"],
  ["paulina-placering-v1-stol-4.jpg", "test/bakgrund/panorama/paulina-placering-v1/stol-4-pose-17.jpg"],
]);

export async function GET(request: Request, { params }: { params: Promise<{ bild: string }> }) {
  try {
    requireLocal(request);
    const file = images.get((await params).bild);
    if (!file) return new Response(null, { status: 404 });
    const bytes = await readFile(/* turbopackIgnore: true */ path.resolve("..", file));
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/jpeg", "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return errorResponse(error);
  }
}
