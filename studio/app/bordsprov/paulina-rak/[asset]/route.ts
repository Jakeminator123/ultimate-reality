import { readFile } from "node:fs/promises";
import path from "node:path";

const imageName = /^(fore|efter)-(0[1-9]|[12]\d|3[0-3])-(4|1)-(bord|hand)\.webp$/;

export async function GET(_request: Request, context: { params: Promise<{ asset: string }> }) {
  const { asset } = await context.params;
  const parts = imageName.exec(asset);
  if (!parts) return new Response("Okänd provbild.", { status: 404 });
  const [, version, frame, seat, view] = parts;
  const file = path.resolve(process.cwd(), "../test/dealer/paulina/08-rak-v1", version, frame + "-" + seat + "-" + view + ".webp");
  try {
    const buffer = await readFile(/* turbopackIgnore: true */ file);
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Provbilden saknas lokalt.", { status: 404 });
    throw error;
  }
}
