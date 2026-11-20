import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { folders, LocalError, publishExclusive } from "./storage";

export async function pipelineFolder() {
  const { root } = await folders();
  const dir = path.join(root, "orders", "bildpipeline");
  await fs.mkdir(dir, { recursive: true });
  await checkFolder(dir);
  return dir;
}

export async function checkFolder(dir: string) {
  const resolved = await fs.realpath(/* turbopackIgnore: true */ dir).catch(() => "");
  if (!resolved || path.relative(dir, resolved) !== "")
    throw new LocalError("Bildrevisionens katalog saknas eller är länkad.", 404);
}

export async function optionalJson<T>(dir: string, file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(/* turbopackIgnore: true */ path.join(dir, file), "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

// Each event is published once, including across independent server processes.
export async function record(dir: string, file: string, value: unknown) {
  try {
    await publishExclusive(dir, file, JSON.stringify(value));
    return true;
  } catch (err) {
    if (err instanceof LocalError && err.status === 409) return false;
    throw err;
  }
}

export function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function imageMime(bytes: Buffer) {
  const format = await sharp(bytes).metadata().then((m) => m.format).catch(() => "");
  if (format === "jpeg" || format === "png" || format === "webp") return "image/" + format;
  throw new LocalError("Bildinnehållet måste vara JPEG, PNG eller WebP.");
}

export async function dataUri(bytes: Buffer, mime: string) {
  // Runway limits the entire encoded URI, including its prefix, to 5 MB.
  const encoded = (data: Buffer, type: string) => "data:" + type + ";base64," + data.toString("base64");
  const fits = (data: Buffer) => 4 * Math.ceil(data.length / 3) + 40 <= 5_000_000;
  if (fits(bytes)) return encoded(bytes, mime);
  for (const size of [4096, 2880, 1856]) {
    const resized = await sharp(bytes).rotate().resize({
      width: size, height: size, fit: "inside", withoutEnlargement: true,
    }).flatten({ background: "white" }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    if (fits(resized)) return encoded(resized, "image/jpeg");
  }
  const compact = await sharp(bytes).rotate().resize({
    width: 1600, height: 1600, fit: "inside", withoutEnlargement: true,
  }).flatten({ background: "white" }).jpeg({ quality: 80 }).toBuffer();
  if (fits(compact)) return encoded(compact, "image/jpeg");
  throw new LocalError("Referensen överskrider Runways gräns även efter skalning.");
}
