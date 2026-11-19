import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Asset } from "./model";

export const types: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/mp4",
};
export class LocalError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(err: unknown) {
  if (err instanceof LocalError)
    return Response.json({ error: err.message }, { status: err.status });
  console.error(err instanceof Error ? err.message : "Lokalt filfel");
  return Response.json(
    { error: "Labbdisken eller det lokala verktyget kunde inte läsas." },
    { status: 500 },
  );
}
export function requireLocal(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (
    !host ||
    !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ||
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && new URL(origin).host !== host)
  ) {
    throw new LocalError("Lokal åtkomst krävs.", 403);
  }
}
export function mediaType(name: string) {
  if (
    !name ||
    name !== path.basename(name) ||
    /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
    name.endsWith(".") ||
    name.endsWith(" ")
  )
    throw new LocalError("Ogiltigt filnamn.");
  const type = types[path.extname(name).toLowerCase()];
  if (!type)
    throw new LocalError("Välj JPG, PNG, WebP, MP4, MOV, M4V eller WebM.");
  return type;
}
export async function folders() {
  const parent =
    process.env.ULTIMATE_REALITY_STORAGE ||
    ((await fs
      .stat("D:/")
      .then((s) => s.isDirectory())
      .catch(() => false))
      ? "D:/"
      : path.resolve("..", ".lab-data"));
  const root = path.resolve(parent, "ultimate-reality-lab");
  const owner = await fs
    .readFile(path.join(root, ".owner"), "utf8")
    .catch(() => "");
  if (owner !== "ultimate-reality-lab/v1")
    throw new LocalError("Initiera labbdisken med lab.ps1 list.", 503);
  const inputs = path.join(root, "inputs");
  const orders = path.join(root, "orders");
  const revisions = path.join(orders, "giv-plats-4");
  for (const dir of [root, inputs, orders, revisions]) {
    if (dir === revisions) await fs.mkdir(dir, { recursive: true });
    if (
      path.normalize(await fs.realpath(dir)).toLowerCase() !==
      path.normalize(dir).toLowerCase()
    )
      throw new LocalError("Oväntad länk i labblagringen.");
  }
  return { root, inputs, revisions };
}
export async function promptFolder() {
  const { root } = await folders();
  const saved = path.join(root, "saved");
  const presets = path.join(saved, "promptmallar");
  for (const dir of [saved, presets]) {
    await fs.mkdir(dir, { recursive: true });
    if (path.normalize(await fs.realpath(/* turbopackIgnore: true */ dir)).toLowerCase() !== path.normalize(dir).toLowerCase())
      throw new LocalError("Oväntad länk i mallbiblioteket.");
  }
  return presets;
}
export async function listAssets(): Promise<Asset[]> {
  const { inputs } = await folders();
  return (
    await fs.readdir(/* turbopackIgnore: true */ inputs, {
      withFileTypes: true,
    })
  )
    .filter((e) => e.isFile() && types[path.extname(e.name).toLowerCase()])
    .map((e) => ({
      name: e.name,
      kind: types[path.extname(e.name).toLowerCase()].startsWith("image/")
        ? ("image" as const)
        : ("video" as const),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}
export async function assetFile(name: string) {
  const mime = mediaType(name);
  const { inputs } = await folders();
  const file = path.join(inputs, name);
  const st = await fs.lstat(file).catch(() => null);
  if (!st?.isFile() || st.isSymbolicLink())
    throw new LocalError("Källfilen saknas i inkorgen.", 404);
  return { file, size: st.size, mime };
}
export async function revisionIds(dir: string) {
  return (await fs.readdir(dir))
    .filter((n) => /^v\d+\.json$/.test(n))
    .map((n) => Number(n.slice(1, -5)))
    .sort((a, b) => b - a);
}
export async function publishExclusive(
  dir: string,
  target: string,
  value: string,
) {
  const tmp = path.join(dir, "." + randomUUID() + ".pending");
  await fs.writeFile(tmp, value, { flag: "wx" });
  try {
    await fs.link(tmp, path.join(dir, target));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST")
      throw new LocalError(
        "En nyare version finns på disken. Ladda om före nästa sparning.",
        409,
      );
    throw err;
  } finally {
    await fs.unlink(tmp);
  }
}
