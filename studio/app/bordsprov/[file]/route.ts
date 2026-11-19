import { readFile } from "node:fs/promises";
import path from "node:path";

const files = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["ljusprov.html", "text/html; charset=utf-8"],
  ["skoprov.html", "text/html; charset=utf-8"],
  ["grund-stol-4.png", "image/png"],
  ["grund-stol-1.png", "image/png"],
  ["kort-stol-4.png", "image/png"],
  ["kort-stol-1.png", "image/png"],
]);
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const type = files.get(file);
  if (!type) return new Response("Okänd provfil.", { status: 404 });
  const studies: Record<string, string> = {
    "ljusprov.html": "bakgrund/ljusprov-v1",
    "skoprov.html": "artefakter/kortsko-vanster-v1",
  };
  const recipe = studies[file] ?? "bord/filtdjup-v1";
  const directory = path.resolve(process.cwd(), "../test", recipe);
  try {
    return new Response(await readFile(path.join(directory, file)), {
      headers: { "Content-Type": type, "Cache-Control": "no-cache" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return new Response(`Bildprovet saknas. Följ anvisningarna i test/${recipe}/README.md.`, { status: 404 });
  }
}
